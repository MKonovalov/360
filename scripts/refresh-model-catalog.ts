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
import { writeFileSync, mkdirSync } from 'node:fs';
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
// name, family, status, api{npm,url}, cost{input,output}, limit{context,output}.
// api.url === '' marks a vendor-default servable model. Missing fields default
// to '' / 0 so the snapshot shape stays total and deterministic.
function trimRecord(m: Record<string, unknown>) {
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
  };
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

  const models = parseModels(raw).map(trimRecord);
  const snapshot = { generatedAt: new Date().toISOString(), models };

  mkdirSync(join(process.cwd(), 'src/lib/models'), { recursive: true });
  writeFileSync(
    join(process.cwd(), 'src/lib/models/catalog.json'),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(`Wrote src/lib/models/catalog.json: ${models.length} models (${snapshot.generatedAt})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
