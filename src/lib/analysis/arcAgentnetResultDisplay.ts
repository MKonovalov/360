import { z } from 'zod';

// Read-only display model for a stored Arc Agent Net analysis result. The
// stored projection (see arcAgentnetResultValidation.ts) is partner-authored,
// so everything is re-validated, bounded, and reduced to plain strings before
// it reaches a component. Unknown or malformed parts are dropped, not guessed.

const MAX_FINDINGS = 50;
const MAX_SOURCES = 100;
const MAX_TEXT = 4_000;
const MAX_LABEL = 300;

export type ArcAgentnetDisplaySource = {
  readonly sourceId: string;
  readonly title: string;
  readonly publisher: string | null;
  readonly sourceType: string | null;
  // Only absolute https links survive; anything else is shown as text only.
  readonly url: string | null;
  readonly supportRole: string | null;
};

export type ArcAgentnetDisplayFinding = {
  readonly findingId: string;
  readonly label: string;
  readonly status: string;
  readonly confidence: string | null;
  readonly claim: string;
  readonly reasoning: string | null;
  readonly sources: readonly ArcAgentnetDisplaySource[];
};

export type ArcAgentnetResultDisplay = {
  readonly narrative: string | null;
  readonly findings: readonly ArcAgentnetDisplayFinding[];
};

const text = (max: number) => z.string().trim().min(1).transform((value) => value.slice(0, max));

const findingSchema = z.object({
  findingId: text(MAX_LABEL),
  identity: z.object({ label: text(MAX_LABEL) }).passthrough(),
  status: text(64),
  confidence: text(64).optional(),
  claim: text(MAX_TEXT),
  reasoningSummary: text(MAX_TEXT).optional(),
}).passthrough();

const sourceSchema = z.object({
  sourceId: text(MAX_LABEL),
  title: text(MAX_LABEL),
  url: z.string().optional(),
  publisher: text(MAX_LABEL).optional(),
  sourceType: text(MAX_LABEL).optional(),
}).passthrough();

const linkSchema = z.object({
  findingId: text(MAX_LABEL),
  sourceId: text(MAX_LABEL),
  supportRole: text(64).optional(),
}).passthrough();

const legacyFindingSchema = z.object({
  label: text(MAX_LABEL),
  status: text(64).optional(),
  observedEvidence: text(MAX_TEXT).optional(),
  inference: text(MAX_TEXT).optional(),
}).passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function httpsUrl(value: string | undefined): string | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.toString() : null;
  } catch {
    return null;
  }
}

function projectPacket(packet: Record<string, unknown>): ArcAgentnetResultDisplay | null {
  const sources = new Map<string, z.infer<typeof sourceSchema>>();
  for (const raw of (Array.isArray(packet.sources) ? packet.sources : []).slice(0, MAX_SOURCES)) {
    const parsed = sourceSchema.safeParse(raw);
    if (parsed.success) sources.set(parsed.data.sourceId, parsed.data);
  }
  const links = (Array.isArray(packet.links) ? packet.links : []).flatMap((raw) => {
    const parsed = linkSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });

  const findings = (Array.isArray(packet.findings) ? packet.findings : []).slice(0, MAX_FINDINGS).flatMap((raw) => {
    const parsed = findingSchema.safeParse(raw);
    if (!parsed.success) return [];
    const finding = parsed.data;
    const linked = links
      .filter((link) => link.findingId === finding.findingId)
      .flatMap((link) => {
        const source = sources.get(link.sourceId);
        return source === undefined ? [] : [{
          sourceId: source.sourceId,
          title: source.title,
          publisher: source.publisher ?? null,
          sourceType: source.sourceType ?? null,
          url: httpsUrl(source.url),
          supportRole: link.supportRole ?? null,
        }];
      });
    return [{
      findingId: finding.findingId,
      label: finding.identity.label,
      status: finding.status,
      confidence: finding.confidence ?? null,
      claim: finding.claim,
      reasoning: finding.reasoningSummary ?? null,
      sources: linked,
    }];
  });

  const narrative = typeof packet.narrative === 'string' && packet.narrative.trim() !== ''
    ? packet.narrative.trim().slice(0, MAX_TEXT)
    : null;
  return findings.length === 0 && narrative === null ? null : { narrative, findings };
}

// Older partner runs stored { raw: "<json>" } with { result: { checklistFindings } }.
function projectLegacy(value: Record<string, unknown>): ArcAgentnetResultDisplay | null {
  if (typeof value.raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.raw);
  } catch {
    return null;
  }
  const result = isRecord(parsed) && isRecord(parsed.result) ? parsed.result : undefined;
  const raw = result !== undefined && Array.isArray(result.checklistFindings) ? result.checklistFindings : [];
  const findings = raw.slice(0, MAX_FINDINGS).flatMap((entry, index) => {
    const finding = legacyFindingSchema.safeParse(entry);
    if (!finding.success) return [];
    const { label, status, observedEvidence, inference } = finding.data;
    return [{
      findingId: `F-${index + 1}`,
      label,
      status: status ?? 'unknown',
      confidence: null,
      claim: observedEvidence ?? inference ?? label,
      reasoning: observedEvidence !== undefined ? inference ?? null : null,
      sources: [],
    }];
  });
  return findings.length === 0 ? null : { narrative: null, findings };
}

export function projectArcAgentnetResultDisplay(projection: unknown): ArcAgentnetResultDisplay | null {
  if (!isRecord(projection)) return null;
  if (isRecord(projection.packet)) return projectPacket(projection.packet);
  return projectLegacy(projection);
}
