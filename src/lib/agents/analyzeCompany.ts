import { env } from '@/lib/env';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { validateRunArtifacts } from '@/lib/validation/validateReport';
import type { Verdict } from '@/lib/validation/airsRules';
import { runAgent } from './runAgent';
import { dedupProposals } from './dedup';
import type { CompanyInput, EvidenceAppendix, LiveSignalInput, ProposalSignal, RunOutput } from './types';

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
      output: RunOutput;
      verdict: Verdict;
      usage: RunResult['usage'];
      proposals: ProposalSignal[];
    }
  | {
      ok: false;
      reason: 'gate_failed' | 'not_configured' | 'company_not_found' | 'db_error';
      errors?: string[];
    };

export async function analyzeCompany(companyId: number): Promise<AnalyzeResult> {
  // D-15 env gate (mirror enrichment.ts's not_configured): unset keys disable
  // the Analyze action, never crash. Checked at call time, not import time.
  if (!env.ANTHROPIC_API_KEY || !env.FIRECRAWL_API_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  const loaded = await loadCompanyAndSignals(companyId);
  if (!loaded.ok) return loaded;

  // AI-domain try/catch (D-08): only misconfiguration throws map to a
  // structured result; genuine agent/provider failures propagate fail-loud
  // (D-06) so the Route Handler's AI-domain scope reports them.
  let run: RunResult;
  try {
    run = await runAgent({ company: loaded.company, liveSignals: loaded.liveSignals });
  } catch (err) {
    if (isMisconfigurationError(err)) return { ok: false, reason: 'not_configured' };
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
export function deriveEvidenceAppendix(steps: readonly StepLike[]): EvidenceAppendix {
  const entries: EvidenceAppendix = [];
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
        });
      }
    }
  }
  return entries;
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
