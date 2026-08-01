// Pure mapping functions: Apollo enrichment response objects → EnrichedField[].
// No network, no DB — called by the apollo.ts client after a response is fetched
// and by unit tests directly. Analogous to src/lib/import/rowMapper.ts.
//
// Design rules (08-RESEARCH.md):
//  - Match-key / identity fields are NEVER mapped for overwrite:
//    company.domain, persona.email, persona.name are excluded from output.
//  - Any field whose incoming value is empty/null is omitted (nothing to fill).
//  - Employee count (int) and revenue (int/printed string) are bucketed into the
//    existing banded enums — lossy but deterministic.
//  - confidence stays undefined for Apollo (its enrich endpoints expose no
//    per-field score — ENRC-05 documented resolution). The optional field is
//    kept so a future scoring vendor needs no structural change.

export type EnrichedField = {
  field: string;
  incomingValue: string | string[];
  confidence?: number;
};

// revenueBandEnum values: under_50m | 50m_250m | 250m_1b | 1b_5b | 5b_plus
export function bucketRevenue(annual: number): string | undefined {
  if (!Number.isFinite(annual) || annual <= 0) return undefined;
  if (annual < 50_000_000) return 'under_50m';
  if (annual < 250_000_000) return '50m_250m';
  if (annual < 1_000_000_000) return '250m_1b';
  if (annual < 5_000_000_000) return '1b_5b';
  return '5b_plus';
}

// Best-effort parse of Apollo's printed revenue string (e.g. "$1.2B", "450M",
// "12,000,000") into a number, for use when only organization_revenue_printed
// is present. Returns undefined when unparseable.
export function parsePrintedRevenue(printed: string): number | undefined {
  const m = printed.trim().match(/([0-9][0-9,.]*)\s*([kmbt]?)/i);
  if (!m) return undefined;
  const base = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, '': 1 };
  return base * (mult[m[2].toLowerCase()] ?? 1);
}

// employeeCountBand is free banded text (e.g. "51-200"). We derive a band label
// from Apollo's estimated_num_employees integer. Boundaries chosen to be
// human-recognizable size bands; the column is display-only text, not an enum.
export function bucketEmployees(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  if (count <= 5000) return '1001-5000';
  if (count <= 10000) return '5001-10000';
  return '10000+';
}

// Apollo seniority → our seniorityEnum (ic | manager | director | vp | c_level)
export function mapSeniority(raw: string): string | undefined {
  switch (raw.trim().toLowerCase()) {
    case 'c_suite':
    case 'c-suite':
    case 'cxo':
    case 'founder':
    case 'owner':
    case 'partner':
      return 'c_level';
    case 'vp':
      return 'vp';
    case 'head':
    case 'director':
      return 'director';
    case 'manager':
      return 'manager';
    case 'senior':
    case 'entry':
    case 'intern':
      return 'ic';
    default:
      return undefined; // unknown → omit rather than guess
  }
}

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function pushField(out: EnrichedField[], field: string, value: string | string[] | undefined) {
  if (value === undefined) return;
  if (Array.isArray(value) && value.length === 0) return;
  out.push({ field, incomingValue: value });
}

// Maps an Apollo Organization Enrichment `organization` object to EnrichedField[]
// targeting company columns. Input is `unknown` — read defensively so a
// missing/renamed field degrades to "omitted", never a throw.
export function apolloMapCompany(org: unknown): EnrichedField[] {
  const o = (org ?? {}) as Record<string, unknown>;
  const out: EnrichedField[] = [];

  pushField(out, 'industry', nonEmptyString(o.industry));

  const employees = typeof o.estimated_num_employees === 'number' ? o.estimated_num_employees : undefined;
  pushField(out, 'employeeCountBand', employees !== undefined ? bucketEmployees(employees) : undefined);

  // hqLocation: join non-empty city/state/country
  const locParts = [nonEmptyString(o.city), nonEmptyString(o.state), nonEmptyString(o.country)].filter(
    (p): p is string => Boolean(p)
  );
  pushField(out, 'hqLocation', locParts.length ? locParts.join(', ') : undefined);

  // revenueBand: prefer numeric annual_revenue, else parse the printed string
  let revenue: number | undefined;
  if (typeof o.annual_revenue === 'number') revenue = o.annual_revenue;
  else if (typeof o.organization_revenue === 'number') revenue = o.organization_revenue;
  else {
    const printed = nonEmptyString(o.organization_revenue_printed);
    if (printed) revenue = parsePrintedRevenue(printed);
  }
  pushField(out, 'revenueBand', revenue !== undefined ? bucketRevenue(revenue) : undefined);

  // techStack: technology_names (string[]) or current_technologies[].name — dedupe
  const tech = new Set<string>();
  if (Array.isArray(o.technology_names)) {
    for (const t of o.technology_names) {
      const s = nonEmptyString(t);
      if (s) tech.add(s);
    }
  }
  if (Array.isArray(o.current_technologies)) {
    for (const t of o.current_technologies) {
      const s = nonEmptyString((t as Record<string, unknown>)?.name);
      if (s) tech.add(s);
    }
  }
  pushField(out, 'techStack', tech.size ? Array.from(tech).slice(0, 100) : undefined);

  // NOTE: domain is deliberately NOT mapped — it is the match key, never overwritten.
  // ownershipType has no reliable Apollo equivalent — left unmapped.
  return out;
}
