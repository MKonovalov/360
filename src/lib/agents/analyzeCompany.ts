import { anthropic } from '@ai-sdk/anthropic';
import { env } from '@/lib/env';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { getModelSettingsForUser } from '@/lib/db/queries/userModelSettings';
import { validateRunArtifacts } from '@/lib/validation/validateReport';
import type { Verdict } from '@/lib/validation/airsRules';
import { runAgent } from './runAgent';
import { dedupProposals } from './dedup';
import { resolveModelChain, classifyModelError } from './modelConfig';
import type { CompanyInput, DerivedEvidenceAppendix, LiveSignalInput, ProposalSignal, RunOutput } from './types';

// analyzeCompany — the Analyze orchestration (ANLZ-01/05, 09-01-03 anchor).
// Chains: load company + live signals → runAgent → derive the evidence
// appendix from REAL webSearch tool results (D-02) → fail-closed gate (D-03)
// → post-run dedup (D-11) → clean proposal set. This module performs NO DB
// writes — persisting the run + proposals is the Route Handler's job (Plan
// 03), keeping the AI-domain failure domain separate from the DB domain (D-08).
type RunResult = Awaited<ReturnType<typeof runAgent>>;

export type AnalyzeResult =
  | {
      ok: true;
      output: Omit<RunOutput, 'evidenceAppendix'> & { evidenceAppendix: DerivedEvidenceAppendix };
      verdict: Verdict;
      usage: RunResult['usage'];
      proposals: ProposalSignal[];
      // FAL-05 audit identity (Pitfall 5): the raw provider ID that actually
      // served + the resolved chain snapshot + the D-05 fallback flag — the
      // route persists these (model_used/model_chain) and surfaces usedFallback.
      modelUsed: string;
      modelChain: string[];
      usedFallback: boolean;
    }
  | {
      ok: false;
      reason: 'gate_failed' | 'not_configured' | 'company_not_found' | 'db_error' | 'rate_limited';
      errors?: string[];
    };

export async function analyzeCompany(companyId: number, userId: string): Promise<AnalyzeResult> {
  // D-15 env gate (mirror enrichment.ts's not_configured): unset keys disable
  // the Analyze action, never crash. Checked at call time, not import time.
  if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  const loaded = await loadCompanyAndSignals(companyId);
  if (!loaded.ok) return loaded;

  // FAL-01 snapshot-at-entry (Pitfall 6/9): settings read ONCE here, chain
  // resolved ONCE — a mid-run settings edit never changes the in-flight run's
  // chain or its audit row. modelChain doubles as the model_chain snapshot the
  // route persists (D-05). Never re-read settings inside runAgent/loop.
  const settings = await getModelSettingsForUser(userId);
  const modelChain = resolveModelChain(settings);

  // AI-domain try/catch (D-08): only misconfiguration throws map to a
  // structured result; genuine agent/provider failures propagate fail-loud
  // (D-06) so the Route Handler's AI-domain scope reports them.
  let run: RunResult;
  try {
    run = await runAgent({
      company: loaded.company,
      liveSignals: loaded.liveSignals,
      // Pitfall 11: raw IDs mapped to LanguageModel[] ONCE at entry — never
      // strings, never a per-attempt settings read.
      models: modelChain.map((id) => anthropic(id)),
    });
  } catch (err) {
    if (isMisconfigurationError(err)) return { ok: false, reason: 'not_configured' };
    // D-04 carve-out: ONLY 429 gets a distinct structured reason; all other
    // non-failover classes propagate fail-loud to the route's generic 502
    // analysis_failed (classifyModelError handles RetryError unwrap-first).
    if (classifyModelError(err) === 'rate_limited') return { ok: false, reason: 'rate_limited' };
    throw err;
  }

  // D-02: the appendix the gate validates against is derived from the run's
  // REAL webSearch tool results — a model-recited appendix is never trusted.
  const evidenceAppendix = deriveEvidenceAppendix(run.steps);
  // D-04: lightweight verdict derived from the proposal set (no scoring
  // machinery this phase). Required by the gate's empty-signals rule.
  const verdict = deriveVerdict(run.output.proposals);

  // D-03: FAILS CLOSED — a gate failure returns ok:false and nothing is
  // persisted (T-09-03). Proposals never enter the review queue ungated.
  const gate = validateRunArtifacts({ ...run.output, evidenceAppendix, verdict });
  if (!gate.valid) {
    return { ok: false, reason: 'gate_failed', errors: gate.errors };
  }

  // D-11/ANLZ-05 post-run dedup against the live-signal list (pre-run skip
  // was already passed to runAgent above via liveSignals).
  const proposals = dedupProposals(run.output.proposals, loaded.liveSignals);

  return {
    ok: true,
    output: { ...run.output, evidenceAppendix },
    verdict,
    usage: run.usage,
    proposals,
    // FAL-05: the audit identity survives from the loop return (Pitfall 5).
    modelUsed: run.modelUsed,
    modelChain,
    usedFallback: run.usedFallback,
  };
}

type LoadedCompanyAndSignals =
  | { ok: true; company: CompanyInput; liveSignals: LiveSignalInput[] }
  | { ok: false; reason: 'company_not_found' | 'db_error' };

// Step 1: read company + live signals (the D-11 pre-check input). A missing
// company and a DB failure are DISTINCT reasons (fail-loud, D-06) — callers
// must be able to tell "nothing to analyze" from "data layer is down".
async function loadCompanyAndSignals(companyId: number): Promise<LoadedCompanyAndSignals> {
  try {
    const company = await getCompanyById(companyId);
    if (!company) return { ok: false, reason: 'company_not_found' };
    const liveSignals = await listSignalsForCompany(companyId);
    return { ok: true, company, liveSignals };
  } catch {
    return { ok: false, reason: 'db_error' };
  }
}

// Loose structural views of the v7 StepResult shape (ai@7) so this module
// stays decoupled from AI SDK internals: steps carry toolResults, and the
// webSearch tool's output is a { url, title, snippet }[] (tools.ts).
export interface ToolResultLike {
  toolName?: string;
  output?: unknown;
}
export interface StepLike {
  toolResults?: ToolResultLike[];
}

// D-02: flatten REAL webSearch tool results from the run's steps into the
// evidence appendix. First-seen URL wins (dedupe); malformed entries are
// skipped rather than trusted.
export function deriveEvidenceAppendix(steps: readonly StepLike[]): DerivedEvidenceAppendix {
  const entries: DerivedEvidenceAppendix = [];
  const seen = new Set<string>();
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      if (result.toolName !== 'webSearch') continue;
      const items = (Array.isArray(result.output) ? result.output : []) as Array<{
        url?: unknown;
        title?: unknown;
        snippet?: unknown;
      }>;
      for (const item of items) {
        if (!item || typeof item.url !== 'string' || seen.has(item.url)) continue;
        seen.add(item.url);
        entries.push({
          url: item.url,
          title: typeof item.title === 'string' ? item.title : '',
          snippet: typeof item.snippet === 'string' ? item.snippet : '',
          retentionTag: retentionTagForUrl(item.url),
        });
      }
    }
  }
  return entries;
}

// T-09-08: retention classification for derived appendix entries — personal/
// social platforms carry individual-user data (personal_data); everything
// else is public business info. Root-domain match (www./locale subdomains
// ignored); unparseable URLs fail toward public_biz, never crash.
const PERSONAL_DATA_HOSTS = new Set([
  'linkedin.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
]);

export function retentionTagForUrl(url: string): 'public_biz' | 'personal_data' {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const root = hostname.split('.').slice(-2).join('.');
    return PERSONAL_DATA_HOSTS.has(root) ? 'personal_data' : 'public_biz';
  } catch {
    return 'public_biz';
  }
}

// D-04: verdict "falls out naturally" from the proposal set — no composite
// scoring this phase. Empty proposals ⇒ no_intent (the gate requires it);
// any high-strength proposal ⇒ active; otherwise emerging.
export function deriveVerdict(proposals: ProposalSignal[]): Verdict {
  if (proposals.length === 0) return 'no_intent';
  return proposals.some((p) => p.strength === 'high') ? 'active' : 'emerging';
}

function isMisconfigurationError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not configured|api key/i.test(message);
}
