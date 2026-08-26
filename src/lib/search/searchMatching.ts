import { normalizeSearchDomain, normalizeSearchEmail, normalizeSearchLinkedInUrl, normalizeSearchName, type NormalizedSearchCandidate } from './normalizeSearchPacket';
import type { SearchMatch } from './contracts';

export interface PersonaMatchRecord {
  readonly id: number;
  readonly name: string;
  readonly title?: string | null;
  readonly email: string | null | undefined;
  readonly linkedinUrl: string | null | undefined;
  readonly companyDomain: string | null | undefined;
}

export interface SearchMatchingInput {
  readonly candidate: NormalizedSearchCandidate;
  readonly companyDomain: string | null;
  readonly personas: readonly PersonaMatchRecord[];
}

function normalizeLinkedInMatchKey(value: string | null | undefined): string | null {
  const normalized = normalizeSearchLinkedInUrl(value);
  return normalized?.replace('://www.linkedin.com', '://linkedin.com') ?? null;
}

function uniquePersonaMatches(personas: readonly PersonaMatchRecord[]): PersonaMatchRecord[] {
  const byId = new Map<number, PersonaMatchRecord>();
  for (const persona of personas) byId.set(persona.id, persona);
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

function resultForMatches(
  personas: readonly PersonaMatchRecord[],
  matchedBy: Extract<SearchMatch, { kind: 'existing_persona' | 'ambiguous' }>['matchedBy'],
): SearchMatch {
  const matches = uniquePersonaMatches(personas);
  if (matches.length === 0) return { kind: 'new_persona' };
  if (matches.length === 1) return { kind: 'existing_persona', personaId: matches[0].id, matchedBy };
  return { kind: 'ambiguous', personaIds: matches.map(({ id }) => id), matchedBy };
}

export function matchSearchCandidate(input: SearchMatchingInput): SearchMatch {
  const { candidate, personas } = input;
  const candidateEmail = normalizeSearchEmail(candidate.normalizedKeys.email ?? candidate.persona.email);
  if (candidateEmail) {
    const emailMatches = personas.filter((persona) => normalizeSearchEmail(persona.email) === candidateEmail);
    const emailResult = resultForMatches(emailMatches, 'email');
    if (emailResult.kind !== 'new_persona') return emailResult;
  }

  const candidateLinkedIn = normalizeLinkedInMatchKey(candidate.normalizedKeys.linkedinUrl ?? candidate.persona.linkedinUrl);
  if (candidateLinkedIn) {
    const linkedInMatches = personas.filter(
      (persona) => normalizeLinkedInMatchKey(persona.linkedinUrl) === candidateLinkedIn,
    );
    const linkedInResult = resultForMatches(linkedInMatches, 'linkedin_url');
    if (linkedInResult.kind !== 'new_persona') return linkedInResult;
  }

  const selectedCompanyDomain = normalizeSearchDomain(input.companyDomain);
  if (!selectedCompanyDomain) return { kind: 'new_persona' };
  const candidateName = normalizeSearchName(candidate.normalizedKeys.name || candidate.persona.fullName);
  const nameMatches = personas.filter((persona) => {
    const personaDomain = normalizeSearchDomain(persona.companyDomain);
    return personaDomain === selectedCompanyDomain && normalizeSearchName(persona.name) === candidateName;
  });
  return resultForMatches(nameMatches, 'name_company_domain');
}
