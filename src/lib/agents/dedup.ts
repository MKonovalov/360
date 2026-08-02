import type { LiveSignalInput, ProposalSignal } from './types';

// Pure dedup (D-11/ANLZ-05). liveSignals arrive pre-scoped to the company
// (listSignalsForCompany), so the (companyId, signalType) key reduces to
// signalType. Drops proposals whose signalType is already live, then
// within-set duplicate signalTypes (keeping the first occurrence).
export function dedupProposals(
  proposals: ProposalSignal[],
  liveSignals: LiveSignalInput[],
): ProposalSignal[] {
  const covered = new Set(liveSignals.map((s) => s.signalType));
  const seen = new Set<string>();
  const kept: ProposalSignal[] = [];
  for (const p of proposals) {
    if (covered.has(p.signalType)) continue;
    if (seen.has(p.signalType)) continue;
    seen.add(p.signalType);
    kept.push(p);
  }
  return kept;
}

// Unique covered signalTypes in first-appearance order, for the UI's
// "already covered" message.
export function alreadyCoveredSignalTypes(liveSignals: LiveSignalInput[]): string[] {
  const seen = new Set<string>();
  return liveSignals
    .filter((s) => {
      if (seen.has(s.signalType)) return false;
      seen.add(s.signalType);
      return true;
    })
    .map((s) => s.signalType);
}
