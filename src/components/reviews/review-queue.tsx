'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLinkIcon } from 'lucide-react';
import { acceptProposalAction } from '@/app/actions/reviews';
import { Button } from '@/components/ui/button';
import { SignalBadge } from '@/components/companies/signal-badge';
import { humanizeEnum, dateFormatter } from '@/components/explorer/explorer-format';
import { RejectDialog } from '@/components/reviews/reject-dialog';
import type { listPendingProposals } from '@/lib/db/queries/proposals';

// Type-only import above is erased at compile time — the query module stays
// server-side; this component only receives already-fetched rows as props.
type PendingProposal = Awaited<ReturnType<typeof listPendingProposals>>[number];

// UI-SPEC §4 proposal card. ANLZ-03: evidence inline (URL, snippet, reasoning,
// R/C rating) — nothing behind a click except the two review actions.
//
// Per-card action state mirrors the rollback-dialog confirmation precedent:
// after a successful Accept/Reject the card shows the copy-contract inline
// confirmation in place of the action buttons and does NOT router.refresh() —
// a refresh would unmount this card mid-render (the proposal is no longer
// pending) and destroy the confirmation staff needs to see. The revalidatePath
// in the Server Action keeps the server cache fresh; the badge/count surfaces
// re-sync on the next navigation or refresh.
type CardState =
  | { status: 'idle' }
  | { status: 'accepting' }
  | { status: 'accepted' }
  | { status: 'rejected' }
  | { status: 'error'; message: string };

const ERROR_COPY: Record<string, string> = {
  already_resolved: 'This proposal was already reviewed.',
  duplicate_signal: 'A signal of this type already exists for this company.',
  not_found: 'This proposal no longer exists.',
  action_failed: 'Could not accept this proposal. Please try again.',
};

export function ReviewQueue({ proposals }: { proposals: PendingProposal[] }) {
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [, startTransition] = useTransition();

  function setCard(proposalId: number, state: CardState) {
    setCardStates((prev) => ({ ...prev, [proposalId]: state }));
  }

  function handleAccept(proposal: PendingProposal) {
    setCard(proposal.id, { status: 'accepting' });
    startTransition(async () => {
      const result = await acceptProposalAction(proposal.id);
      if (result.ok) {
        setCard(proposal.id, { status: 'accepted' });
      } else {
        // already_resolved / duplicate_signal are terminal — the proposal is no
        // longer pending, so refresh to drop it from the queue (the message is
        // the point here, and the card is leaving the list regardless).
        setCard(proposal.id, { status: 'error', message: ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed });
      }
    });
  }

  if (proposals.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">No proposals to review</p>
        <p className="text-sm text-slate-500">
          Run Menu → Analyze on a Company detail page to generate signal proposals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {proposals.map((proposal) => {
        const state = cardStates[proposal.id] ?? { status: 'idle' };
        return (
          <div
            key={proposal.id}
            className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            {/* (a) header row — company link + run date */}
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/companies?selected=${proposal.companyId}`}
                className="text-[14px] font-normal leading-[1.5] text-indigo-600"
              >
                {proposal.companyName}
              </Link>
              <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                {dateFormatter.format(new Date(proposal.createdAt))}
              </span>
            </div>

            {/* (b) SignalBadge + strength + R/C rating */}
            <div className="flex flex-wrap items-center gap-2">
              <SignalBadge signalType={proposal.signalType} />
              <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                {humanizeEnum(proposal.strength)}
              </span>
              <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                {proposal.reliability} · {proposal.confidence}
              </span>
            </div>

            {/* (c) evidence block */}
            <div className="space-y-1">
              {proposal.evidenceUrl ? (
                <a
                  href={proposal.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {proposal.evidenceUrl}
                </a>
              ) : null}
              <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
                {proposal.evidenceSnippet}
              </p>
              <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
                {proposal.reasoning}
              </p>
            </div>

            {/* (d) footer row — actions + trace link */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {state.status === 'idle' || state.status === 'accepting' ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={state.status === 'accepting'}
                    onClick={() => handleAccept(proposal)}
                  >
                    {state.status === 'accepting' ? 'Accepting…' : 'Accept'}
                  </Button>
                  <RejectDialog
                    proposalId={proposal.id}
                    onRejected={() => setCard(proposal.id, { status: 'rejected' })}
                  />
                </div>
              ) : state.status === 'accepted' ? (
                <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
                  {`Accepted — ${humanizeEnum(proposal.signalType)} signal created for ${proposal.companyName}.`}
                </p>
              ) : state.status === 'rejected' ? (
                <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
                  Rejected — reason recorded.
                </p>
              ) : (
                <p className="text-[14px] font-normal leading-[1.5] text-red-600">
                  {state.message}
                </p>
              )}

              {proposal.traceUrl ? (
                <a
                  href={proposal.traceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  View trace
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
