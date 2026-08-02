// Pure mapping: Prospeo person-enrichment response → EnrichedField[].
// No network, no DB — mirrors apolloMap.ts's conventions exactly:
//  - Identity/match fields (name, email) are NEVER mapped for overwrite.
//  - Empty/null incoming values are omitted (nothing to fill).
//  - confidence stays undefined (Prospeo exposes no per-field score either).
import { mapSeniority, type EnrichedField } from './apolloMap';

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function pushField(out: EnrichedField[], field: string, value: string | undefined) {
  if (value === undefined) return;
  out.push({ field, incomingValue: value });
}

// Maps a Prospeo `person` object to persona columns. Prospeo exposes seniority
// on the CURRENT job_history entry (not top-level); the ladder is the same one
// Apollo uses, so mapSeniority is reused.
export function prospeoMapPersona(person: unknown): EnrichedField[] {
  const p = (person ?? {}) as Record<string, unknown>;
  const out: EnrichedField[] = [];

  pushField(out, 'title', nonEmptyString(p.current_job_title) ?? nonEmptyString(p.title));

  const currentJob = (Array.isArray(p.job_history) ? p.job_history : []).find(
    (j) => (j as Record<string, unknown>)?.current === true
  ) as Record<string, unknown> | undefined;
  const seniorityRaw = nonEmptyString(currentJob?.seniority) ?? nonEmptyString(p.seniority);
  pushField(out, 'seniority', seniorityRaw ? mapSeniority(seniorityRaw) : undefined);

  pushField(out, 'linkedinUrl', nonEmptyString(p.linkedin_url));

  return out;
}
