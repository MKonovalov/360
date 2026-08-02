import type { CompanyInput, LiveSignalInput } from './types';

// Pure, dependency-free prompt builder (D-07 lean). The model receives ONLY
// this text plus webSearch tool results — fetched content is never spliced
// into the instructions (T-09-02).
export function buildAnalyzePrompt(
  company: CompanyInput,
  liveSignals: LiveSignalInput[],
): string {
  const covered = liveSignals.map((s) => s.signalType);
  const companyFacts = [
    `Company: ${company.name}`,
    `Domain: ${company.domain ?? 'unknown'}`,
    `Industry: ${company.industry ?? 'unknown'}`,
    `HQ location: ${company.hqLocation ?? 'unknown'}`,
    `Employees: ${company.employeeCountBand ?? 'unknown'}`,
    `Revenue band: ${company.revenueBand ?? 'unknown'}`,
    `Ownership: ${company.ownershipType ?? 'unknown'}`,
    `Tech stack: ${company.techStack?.length ? company.techStack.join(', ') : 'unknown'}`,
  ].join('\n');

  return `You are ArcLumen 360's buying-signal analyst researching a target account.

Company context:
${companyFacts}

Search the web for evidence of these four buying-intent signal types:
- cost_pressure: the organization faces financial cost pressure
- immature_gbs_org: no mature GBS/SSC shared-services organization
- new_cfo_or_gbs_head: a new CFO or GBS head was recently appointed
- transformation_announcement: a large transformation program was announced

${
  covered.length > 0
    ? `These signal types are ALREADY COVERED by existing live signals — do NOT propose them again:\n${covered.join('\n')}`
    : 'No signal types are currently covered by live signals.'
}

Rules:
- NEVER fabricate evidence. Every claim must be backed by a real search-result URL (D-02); every proposal's evidenceUrl must resolve to an entry in evidenceAppendix.
- Rate each signal's reliability (R1-R3) and confidence (C1-C3) honestly; R3.C3 is not permitted on high-strength claims.
- If you find no credible signals, return an empty proposals list.
- You have a 60-second budget — search lean, do not go on multi-page dives.

Produce the analysis as structured JSON matching the provided output schema.`;
}
