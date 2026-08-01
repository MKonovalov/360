// Alias dictionaries are a project-specific judgment call — flagged in
// 07-RESEARCH.md Assumptions Log A2/A3. Exact match after normalization,
// no fuzzy/Levenshtein matching (consistent with the project's explicit
// anti-feature stance against fuzzy dedup — manual override per D-08 is
// the safety net, not a smarter guesser).

export const COMPANY_FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'company', 'company name', 'company_name', 'account name', 'organization', 'org name'],
  domain: ['domain', 'website', 'url', 'company domain', 'web site', 'site'],
  industry: ['industry', 'sector', 'vertical'],
  employee_count_band: ['employee count', 'employees', 'headcount', 'company size', 'employee count band', 'size'],
  hq_location: ['hq', 'hq location', 'headquarters', 'location', 'city', 'office location'],
  revenue_band: ['revenue', 'revenue band', 'annual revenue', 'arr', 'revenue range'],
  ownership_type: ['ownership', 'ownership type', 'company type', 'entity type'],
  tech_stack: ['tech stack', 'technologies', 'tools', 'tech', 'technology stack'],
};

export const PERSONA_FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'full name', 'contact name', 'person name', 'first last name'],
  title: ['title', 'job title', 'position', 'role', 'job role'],
  seniority: ['seniority', 'level', 'seniority level', 'career level'],
  email: ['email', 'email address', 'work email', 'business email', 'e-mail'],
  linkedin_url: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin link', 'profile url'],
};

// Per-enum alias dictionaries — maps common CSV phrasings to canonical DB enum values.
// Keys are normalized (lowercase, spaces) forms of what staff might type in a CSV.
export const REVENUE_BAND_ALIASES: Record<string, string> = {
  'under 50m': 'under_50m',
  '<50m': 'under_50m',
  '0-50m': 'under_50m',
  'under50m': 'under_50m',
  '50-250m': '50m_250m',
  '50m-250m': '50m_250m',
  '$50-250m': '50m_250m',
  '50m to 250m': '50m_250m',
  '250m-1b': '250m_1b',
  '250-1000m': '250m_1b',
  '250m to 1b': '250m_1b',
  '1b-5b': '1b_5b',
  '$1-5b': '1b_5b',
  '1b to 5b': '1b_5b',
  '1-5b': '1b_5b',
  '5b+': '5b_plus',
  '>5b': '5b_plus',
  'over 5b': '5b_plus',
  '5b plus': '5b_plus',
};

export const OWNERSHIP_TYPE_ALIASES: Record<string, string> = {
  'private': 'private',
  'privately held': 'private',
  'privately owned': 'private',
  'public': 'public',
  'publicly traded': 'public',
  'listed': 'public',
  'pe_backed': 'pe_backed',
  'pe backed': 'pe_backed',
  'pe-backed': 'pe_backed',
  'private equity': 'pe_backed',
  'private equity backed': 'pe_backed',
  'family_owned': 'family_owned',
  'family owned': 'family_owned',
  'family-owned': 'family_owned',
  'family business': 'family_owned',
  'cooperative': 'cooperative',
  'coop': 'cooperative',
  'co-op': 'cooperative',
  'cooperative group': 'cooperative',
  'state_owned': 'state_owned',
  'state owned': 'state_owned',
  'state-owned': 'state_owned',
  'government owned': 'state_owned',
  'government-owned': 'state_owned',
  'govt owned': 'state_owned',
  'state controlled': 'state_owned',
  'subsidiary': 'subsidiary',
  'sub': 'subsidiary',
  'division': 'subsidiary',
};

export const SENIORITY_ALIASES: Record<string, string> = {
  'ic': 'ic',
  'individual contributor': 'ic',
  'contributor': 'ic',
  'staff': 'ic',
  'manager': 'manager',
  'mgr': 'manager',
  'team lead': 'manager',
  'lead': 'manager',
  'director': 'director',
  'dir': 'director',
  'vp': 'vp',
  'vice president': 'vp',
  'vice-president': 'vp',
  'c level': 'c_level',
  'c-level': 'c_level',
  'c suite': 'c_level',
  'c-suite': 'c_level',
  'executive': 'c_level',
  'ceo': 'c_level',
  'cfo': 'c_level',
  'coo': 'c_level',
  'cto': 'c_level',
};

// Normalize a raw CSV header: trim, lowercase, collapse underscores/hyphens
// to single space, collapse repeated whitespace to single space.
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

// Suggest a field-name mapping for each CSV header using exact alias match
// after normalization. Returns null for headers that don't match any alias.
// No fuzzy/Levenshtein matching — manual override (D-08) is the safety net.
export function suggestColumnMapping(
  headers: string[],
  aliases: Record<string, string[]>
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const match = Object.entries(aliases).find(([, candidates]) =>
      candidates.some((c) => normalizeHeader(c) === normalized)
    );
    // null = unmapped, requires manual pick (D-08's override)
    mapping[header] = match ? match[0] : null;
  }
  return mapping;
}

// Suggest enum-value mappings for a set of raw CSV values using exact alias
// match after trim+lowercase normalization. Returns null for unrecognized values.
// Always overridable before commit (IMPT-02's "manual override").
export function suggestValueMapping(
  rawValues: string[],
  aliases: Record<string, string>
): Record<string, string | null> {
  const normalize = (v: string) => v.trim().toLowerCase();
  return Object.fromEntries(
    rawValues.map((v) => [v, aliases[normalize(v)] ?? null])
  );
}
