// allow: SIZE_OK — single-purpose dev-time CLI script (never imported by app
// runtime code); was already over the 250-pure-LOC threshold pre-fix, and the
// fix's own task scope directs keeping its extracted test helpers in this
// file rather than a new module, to avoid widening the change beyond the
// catalogue-refresh implementation/tests.
//
// Dev-time snapshot generator: shells the local opencode CLI (`opencode models
// --verbose`), trims each record to the UI-needed field set, and writes a
// committed snapshot at src/lib/models/catalog.json (CAT-01/CAT-02).
// Run with `npm run models:fetch` (tsx scripts/refresh-model-catalog.ts).
//
// Deliberate placement deviation: repo-root scripts/, NOT src/scripts/ —
// this script uses child_process, and the Phase 18 verification gate greps
// zero `exec|spawn|child_process` in src/ (Pitfall 4). The committed snapshot
// is the only runtime dependency; this script never runs on Vercel.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Binary resolution (research STACK.md): OPENCODE_BIN → `which opencode` →
// ~/.opencode/bin/opencode. Fail with a clear message when all three miss —
// the committed snapshot stays usable by design (Pitfall 3).
function resolveOpencodeBin(): string {
  if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN;
  try {
    return execFileSync('which', ['opencode'], { encoding: 'utf8' }).trim();
  } catch {
    // which returned non-zero — fall through to the default path.
  }
  return join(process.env.HOME ?? '', '.opencode', 'bin', 'opencode');
}

// Brace delta for one line, ignoring braces inside quoted strings — so a
// model name or URL containing `{`/`}` can never unbalance the accumulator.
function braceDelta(line: string): number {
  let delta = 0;
  let inString = false;
  let escaped = false;
  for (const ch of line) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      delta += 1;
    } else if (ch === '}') {
      delta -= 1;
    }
  }
  return delta;
}

// Parse `opencode models --verbose` stdout: multi-line pretty-JSON records,
// each preceded by a `provider/id` header line at column 0 that is NOT JSON.
// Accumulate from an opening `{` at column 0 through its balanced closing `}`
// at column 0, then JSON.parse the block; skip header/non-JSON lines and
// tolerate unparseable blocks (defensive parse — Pitfall 3).
function parseModels(raw: string): Record<string, unknown>[] {
  const models: Record<string, unknown>[] = [];
  const buffer: string[] = [];
  let depth = 0;

  for (const line of raw.split('\n')) {
    if (buffer.length === 0) {
      if (!line.startsWith('{')) continue; // header / blank line
      buffer.push(line);
      depth = braceDelta(line);
    } else {
      buffer.push(line);
      depth += braceDelta(line);
      if (depth <= 0) {
        const block = buffer.join('\n');
        buffer.length = 0;
        try {
          models.push(JSON.parse(block) as Record<string, unknown>);
        } catch {
          // Skip a malformed record; the committed snapshot stays usable.
        }
      }
    }
  }
  return models;
}

// Trim each record to EXACTLY the UI-needed fields (D-07/D-08): id, providerID,
// name, family, status, api{npm,url}, cost{input,output}, limit{context,output},
// structuredOutputs (D-08 capability flag).
// api.url === '' marks a vendor-default servable model. Missing fields default
// to '' / 0 so the snapshot shape stays total and deterministic.
function trimRecord(m: Record<string, unknown>, structuredOutputs: boolean) {
  const api = (m.api ?? {}) as Record<string, unknown>;
  const cost = (m.cost ?? {}) as Record<string, unknown>;
  const limit = (m.limit ?? {}) as Record<string, unknown>;
  return {
    id: (m.id as string) ?? '',
    providerID: (m.providerID as string) ?? '',
    name: (m.name as string) ?? '',
    family: (m.family as string) ?? '',
    status: (m.status as string) ?? '',
    api: {
      npm: (api.npm as string) ?? '',
      url: (api.url as string) ?? '',
    },
    cost: {
      input: (cost.input as number) ?? 0,
      output: (cost.output as number) ?? 0,
    },
    limit: {
      context: (limit.context as number) ?? 0,
      output: (limit.output as number) ?? 0,
    },
    // D-08: derived from live API supported_parameters, NOT family-name
    // heuristics (D-09 research caveat 4 — llama-3.3-70b/deepseek support
    // structured_outputs, qwen3-235b does NOT; only the exact-id join
    // classifies correctly).
    structuredOutputs,
  };
}

// Named alias for trimRecord's inferred return shape — lets preserved-row
// helpers (Zen known-drift exception) declare an exact, non-`any` element
// type instead of widening to `Record<string, unknown>`.
type CatalogRow = ReturnType<typeof trimRecord>;

// D-08: live OpenRouter capability source. Public GET, no key (verified HTTP
// 200). scripts/ placement keeps child_process AND fetch OUT of src/ — the
// Phase 18 verification gate greps zero exec|spawn|child_process in src/.
// THROWS on any failure so main() aborts WITHOUT writing: the committed
// snapshot stays usable instead of being replaced by a flag-less one (T-19-06).
async function fetchOpenRouterStructuredOutputs(): Promise<Map<string, boolean>> {
  const url = 'https://openrouter.ai/api/v1/models';
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `Failed to fetch OpenRouter model roster from ${url} — snapshot NOT regenerated`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenRouter model roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`
    );
  }
  const body = (await res.json()) as {
    data?: Array<{ id?: unknown; supported_parameters?: unknown[] }>;
  };
  const byId = new Map<string, boolean>();
  for (const row of body.data ?? []) {
    if (typeof row.id === 'string') {
      byId.set(row.id, (row.supported_parameters ?? []).includes('structured_outputs'));
    }
  }
  return byId;
}

// D-09 fallback for openrouter rows the live join misses (research verified
// 100% join coverage, so effectively unreachable). Derive from
// supported_parameters, NEVER from family name alone — family misclassifies:
// llama-3.3-70b and deepseek-v4-flash DO support structured_outputs, qwen3-235b
// does NOT (research l.50-51).
function familyFallbackStructuredOutputs(family: string): boolean {
  return !/qwen|llama|deepseek|mistral|gemma|glm/.test(family.toLowerCase());
}

// The raw Nous roster row shape as consumed by the pre-map (CAT-01/02/03).
// pricing.prompt/completion are STRING-typed per-token dollars (Pitfall 2);
// top_provider.max_completion_tokens is null for 66/292 rows (defaults to 0).
type NousRosterRow = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  top_provider?: { max_completion_tokens?: number | null };
  supported_parameters?: string[];
};

// CAT-01: anonymous NousResearch roster. Public GET, no key (verified HTTP
// 200, 292 rows). Mirrors fetchOpenRouterStructuredOutputs' throws-not-degrades
// contract — any failure aborts main() WITHOUT writing (T-24-04, Pitfall 3).
// Returns only rows whose id is a string (defensive shape cast, T-24-04).
async function fetchNousRoster(): Promise<NousRosterRow[]> {
  const url = 'https://inference-api.nousresearch.com/v1/models';
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `Failed to fetch NousResearch model roster from ${url} — snapshot NOT regenerated`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch NousResearch model roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`
    );
  }
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return (body.data ?? []).filter(
    (r): r is NousRosterRow => typeof r.id === 'string'
  );
}

// CAT-03: family from the id prefix. Strip a leading '~' (D-24-08 aliases ship
// verbatim — the flag is never stored, D-24-09), take the model part after
// '/', then the first dash-token: 'nousresearch/hermes-4-70b' → 'hermes',
// 'qwen/qwen3.8-max' → 'qwen3.8', '~anthropic/claude-sonnet-latest' → 'claude'.
function deriveNousFamily(id: string): string {
  const stripped = id.startsWith('~') ? id.slice(1) : id;
  const modelPart = stripped.split('/')[1] ?? '';
  return modelPart.split('-')[0] || '';
}

// CAT-02 / Pitfall 2: Nous pricing is string-typed per-token dollars; convert
// to per-MTok (×1e6) and round to 6 dp to kill float noise
// ('0.0000016000' → 1.6; hermes pair → 0.05/0.2, 0.09/0.37 per live data).
function perMTok(perToken: string | undefined): number {
  return Math.round(parseFloat(perToken ?? '0') * 1e6 * 1e6) / 1e6;
}

// CAT-01/02/03 Nous pre-map: shape each raw roster row into trimRecord's field
// contract (trimRecord owns the missing-field defaults). providerID/status/api
// are fixed constants (D-24-02, roster has no status field — never 'deprecated');
// ids pass VERBATIM incl. ~latest (D-24-08, D-04); structuredOutputs is the
// live supported_parameters join (never family-name heuristics — Pitfall 5).
function nousPreMap(r: NousRosterRow) {
  return trimRecord(
    {
      id: r.id,
      providerID: 'nousresearch',
      name: r.name ?? '',
      family: deriveNousFamily(r.id),
      status: 'active',
      api: {
        npm: '@ai-sdk/openai-compatible',
        url: 'https://inference-api.nousresearch.com/v1',
      },
      cost: {
        input: perMTok(r.pricing?.prompt),
        output: perMTok(r.pricing?.completion),
      },
      limit: {
        context: r.context_length ?? 0,
        output: r.top_provider?.max_completion_tokens ?? 0,
      },
    },
    (r.supported_parameters ?? []).includes('structured_outputs')
  );
}

// D-24-07 amendment (DELIBERATE, user-approved strictness exception, 2026-08-04):
// models.dev's Go block lags the live https://opencode.ai/zen/go/v1/models roster
// by these 7 ids (opencode CLI 1.18.12 = npm latest, verified 2026-08-04). The Go
// compare accepts them as KNOWN drift; any NEW live-only id NOT in this set — and
// ANY CLI-only id — still aborts the run. Never silent: accepted drift is logged
// on every run. Go ids are NEVER preserved into the snapshot (they were never in
// it, unlike the Zen exception below) — this exception only tolerates their
// absence; it does not resurrect a row for them.
const GO_KNOWN_LIVE_ONLY_IDS = new Set([
  'minimax-m2.5',
  'kimi-k2.5',
  'glm-5',
  'qwen3.5-plus',
  'mimo-v2-pro',
  'mimo-v2-omni',
  'hy3-preview',
]);

// Zen known-drift exception (DELIBERATE, scoped ONLY to Zen — never broadens
// GO_KNOWN_LIVE_ONLY_IDS or reuses the Go exception path). `opencode models
// --verbose` (CLI 1.18.15, npm latest as of 2026-08-12) has not yet picked up
// this id, but it IS live on https://opencode.ai/zen/v1/models AND already
// exists as a fully-reviewed `opencode` row in the committed
// src/lib/models/catalog.json (written by an earlier successful run). Unlike
// the Go exception, an accepted Zen id's row is PRESERVED verbatim from that
// committed snapshot (see loadPreviousCatalogProviderRows) rather than merely
// tolerated — the live lean roster (`{data:[{id}]}`) proves presence/id only,
// never the full UI metadata (name/cost/limit/api), so a row synthesized from
// just the id is never acceptable. If a pinned id's row is ever absent from
// the previous snapshot, resolveRosterDrift throws (fail-closed) instead of
// fabricating one. Any OTHER Zen live-only id, or any CLI-only id, still
// aborts the run — Zen strictness is otherwise unchanged.
const ZEN_KNOWN_LIVE_ONLY_IDS = new Set(['ling-3.0-flash-free']);

// Grouped input for resolveRosterDrift (Smell 2: >3 params) — also documents
// the one behavioral fork the two exceptions need: Go's knownLiveOnlyIds are
// gated on the id STILL being live right now (`missing`-based, D-24-07's
// original semantics, unchanged); Zen's are gated on CLI-omission ALONE
// (`cliOmissionOnly: true`). Zen needs the looser gate because its own live
// lean roster (opencode.ai/zen/v1/models) is itself observed to rotate free
// -tier ids in real time — gating "preserve this pinned id" on "still
// reported live this instant" would silently re-drop the row the moment
// live's rotation, not just the CLI's lag, stops mentioning it, defeating
// the whole point of the exception.
export type RosterDriftInput<T extends Record<string, unknown>> = {
  readonly label: string;
  readonly cliIds: readonly string[];
  readonly liveIds: readonly string[];
  readonly knownLiveOnlyIds: ReadonlySet<string>;
  readonly cliOmissionOnly: boolean;
  readonly previousProviderRows: readonly T[] | null;
  readonly requirePreservedRow: boolean;
};

// Pure id-set/preservation decision, factored out of the network-calling
// compare loop so it is directly unit-testable (no fetch/fs mocking needed).
// Contract: any live-only id NOT accepted as known drift, or any CLI-only id,
// throws (fail-closed, snapshot NOT regenerated). An accepted id's row must
// be found by exact id match in previousProviderRows when requirePreservedRow
// is true, or this throws too — never fabricate a row from only an id.
export function resolveRosterDrift<T extends Record<string, unknown>>(
  input: RosterDriftInput<T>
): { acceptedIds: readonly string[]; preservedRows: readonly T[] } {
  const { label, cliIds, liveIds, knownLiveOnlyIds, cliOmissionOnly, previousProviderRows, requirePreservedRow } =
    input;
  const cliSet = new Set(cliIds);
  const liveSet = new Set(liveIds);
  const missing = liveIds.filter((id) => !cliSet.has(id)); // live has, CLI lacks
  const extra = cliIds.filter((id) => !liveSet.has(id)); // CLI has, live lacks
  const knownDrift = cliOmissionOnly
    ? [...knownLiveOnlyIds].filter((id) => !cliSet.has(id))
    : missing.filter((id) => knownLiveOnlyIds.has(id));
  const unexpectedMissing = missing.filter((id) => !knownDrift.includes(id));
  if (unexpectedMissing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} roster drift — snapshot NOT regenerated. ` +
        `Live-only ids (${unexpectedMissing.length}): ${unexpectedMissing.join(', ')}. ` +
        `CLI-only ids (${extra.length}): ${extra.join(', ')}. ` +
        `Update the opencode CLI (opencode upgrade) and re-run.`
    );
  }
  // Accepted drift is documented on every run — the exception is never silent.
  if (knownDrift.length > 0) {
    console.error(`Known ${label} roster drift accepted (pinned exception): ${knownDrift.join(', ')}`);
  }
  if (!requirePreservedRow || knownDrift.length === 0) {
    return { acceptedIds: knownDrift, preservedRows: [] };
  }
  const preservedRows = knownDrift.map((id) => {
    const row = (previousProviderRows ?? []).find((r) => r.id === id);
    if (!row) {
      throw new Error(
        `${label} roster drift — snapshot NOT regenerated. Known-drift id "${id}" has no ` +
          `preserved row in the committed snapshot — restore its row or remove it from the ` +
          `known-drift exception; a row can never be fabricated from only an id.`
      );
    }
    return row;
  });
  return { acceptedIds: knownDrift, preservedRows };
}

// Reads one provider bucket from the CURRENTLY COMMITTED snapshot (before this
// run's write) so an accepted known-drift id's row can be preserved verbatim —
// the source of truth for metadata this run never re-derives. Returns []
// on any read/parse failure or a missing/malformed bucket so the caller's
// "no preserved row found" check (resolveRosterDrift, requirePreservedRow)
// fires uniformly rather than silently treating a corrupt file as "nothing to
// preserve, so nothing is missing".
function loadPreviousCatalogProviderRows(providerID: string): CatalogRow[] {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), 'src/lib/models/catalog.json'), 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as { providers?: Record<string, unknown> };
    const rows = parsed.providers?.[providerID];
    return Array.isArray(rows) ? (rows as CatalogRow[]) : [];
  } catch {
    return [];
  }
}

// D-08/CAT-04 sibling: live lean-roster id fetch, shared by both the Zen and
// Go compares. THROWS on any failure (throws-not-degrades) so main() aborts
// WITHOUT writing and the committed snapshot stays usable.
async function fetchLiveIds(url: string, label: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Failed to fetch ${label} roster from ${url} — snapshot NOT regenerated`);
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${label} roster from ${url} (HTTP ${res.status}) — snapshot NOT regenerated`
    );
  }
  const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return (body.data ?? []).map((r) => r.id).filter((x): x is string => typeof x === 'string');
}

// CAT-04 + D-24-06/07 + Zen known-drift exception: Zen/Go roster-verify.
// Fetches the two anonymous lean rosters and compares id-sets against the
// CLI-parsed roster by providerID ('opencode' ↔ live Zen, 'opencode-go' ↔
// live Go). ANY unexpected difference throws (no write, T-24-06/D-24-10) so
// the committed snapshot stays usable. The Go compare carries the
// user-approved GO_KNOWN_LIVE_ONLY_IDS exception (D-24-07 amendment,
// tolerate-only, no preservation); the Zen compare separately carries
// ZEN_KNOWN_LIVE_ONLY_IDS (this fix, preserve-verbatim) — the two exception
// sets are never merged or applied cross-provider. Returns the Zen-accepted
// ids' preserved rows for main() to fold back into the new snapshot.
async function verifyZenGoRosters(
  parsed: Record<string, unknown>[]
): Promise<readonly CatalogRow[]> {
  const zenLiveIds = await fetchLiveIds('https://opencode.ai/zen/v1/models', 'Zen');
  const zenCliIds = parsed.filter((m) => m.providerID === 'opencode').map((m) => m.id as string);
  const zenResult = resolveRosterDrift<CatalogRow>({
    label: 'Zen',
    cliIds: zenCliIds,
    liveIds: zenLiveIds,
    knownLiveOnlyIds: ZEN_KNOWN_LIVE_ONLY_IDS,
    cliOmissionOnly: true,
    previousProviderRows: loadPreviousCatalogProviderRows('opencode'),
    requirePreservedRow: true,
  });

  const goLiveIds = await fetchLiveIds('https://opencode.ai/zen/go/v1/models', 'Go');
  const goCliIds = parsed.filter((m) => m.providerID === 'opencode-go').map((m) => m.id as string);
  resolveRosterDrift<CatalogRow>({
    label: 'Go',
    cliIds: goCliIds,
    liveIds: goLiveIds,
    knownLiveOnlyIds: GO_KNOWN_LIVE_ONLY_IDS,
    cliOmissionOnly: false,
    previousProviderRows: null,
    requirePreservedRow: false,
  });

  return zenResult.preservedRows;
}

async function main() {
  const bin = resolveOpencodeBin();
  let raw: string;
  try {
    // maxBuffer: the verbose registry is ~65K lines / several MB — well past
    // execFileSync's 1MB default, which throws ENOBUFS.
    raw = execFileSync(bin, ['models', '--verbose'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `opencode CLI not found at "${bin}" — install it or set OPENCODE_BIN (the committed catalog.json stays usable regardless)`
    );
  }

  const parsed = parseModels(raw);
  // D-08: live OpenRouter capability join — exact-id, openrouter rows only.
  // Throws (aborts, no write) on failure so the committed snapshot stays usable.
  const live = await fetchOpenRouterStructuredOutputs();
  const models = parsed.map((m) =>
    trimRecord(
      m,
      m.providerID === 'openrouter'
        ? (live.get(m.id as string) ?? familyFallbackStructuredOutputs(m.family as string))
        : true
    )
  );
  // CAT-01/02/03: anonymous Nous roster — all 292 rows ship (D-24-01), pricing
  // ×1e6 (Pitfall 2), family from the id prefix (CAT-03), structuredOutputs
  // live-joined from supported_parameters (CAT-02). Throws (aborts, no write).
  const nousRows = (await fetchNousRoster()).map(nousPreMap);
  // CAT-04 + D-24-06/07 + Zen known-drift exception: strict Zen/Go drift
  // check — ANY unexpected id-set difference throws (aborts, no write,
  // D-24-10) so the committed snapshot stays usable. zenPreservedRows carries
  // any accepted-but-CLI-omitted Zen id's row, copied verbatim from the
  // previously committed snapshot (never fabricated).
  const zenPreservedRows = await verifyZenGoRosters(parsed);
  const allModels = [...models, ...nousRows, ...zenPreservedRows];
  // D-24-03/05: grouped snapshot keyed by each row's own providerID string
  // (opencode and opencode-go stay separate); sorted keys for diff stability.
  // generatedAt stays top-level (settings/page.tsx l.129).
  const snapshot = {
    generatedAt: new Date().toISOString(),
    providers: Object.fromEntries(
      [...new Set(allModels.map((m) => m.providerID))].sort().map((p) => [
        p,
        allModels.filter((m) => m.providerID === p),
      ])
    ),
  };

  mkdirSync(join(process.cwd(), 'src/lib/models'), { recursive: true });
  writeFileSync(
    join(process.cwd(), 'src/lib/models/catalog.json'),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(`Wrote src/lib/models/catalog.json: ${allModels.length} models (${snapshot.generatedAt})`);
}

// Guarded like the other scripts/*.ts CLI entrypoints (e.g.
// validate-drizzle-migrations.ts) so importing this module's exported pure
// helpers from a test file never triggers the live CLI/network run.
if (process.argv[1]?.endsWith('refresh-model-catalog.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
