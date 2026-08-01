'use client';

import { useState, useTransition } from 'react';
import { rejectProposalAction } from '@/app/actions/reviews';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// OBSV-02/D-14: the correction-reason capture dialog IS the confirmation for a
// reject (UI-SPEC §5) — no separate "are you sure" step, because forcing the
// structured reason is the whole point. The confirm button stays disabled until
// a reason is selected AND (reason ≠ "Other" OR a note is present), which
// guarantees an "Other" rejection always carries content for tuning.

const REASON_OPTIONS = [
  { value: 'wrong_signal_type', label: 'Wrong signal type' },
  { value: 'missed_criteria', label: 'Missed inclusion-exclusion criteria' },
  { value: 'hallucinated_no_evidence', label: 'Hallucinated — no real evidence' },
  { value: 'other', label: 'Other' },
] as const;

// Fail-loud copy table (D-06) mirroring the action's structured reasons —
// a rejection that cannot be persisted must say why, never silently succeed.
const ERROR_COPY: Record<string, string> = {
  not_found: 'This proposal no longer exists.',
  no_trace: 'This proposal has no run trace to attach the correction to.',
  already_resolved: 'This proposal was already reviewed.',
  invalid_reason: 'Please pick a reason from the list.',
  action_failed: 'Could not save the rejection. Please try again.',
};

function errorMessage(reason: string): string {
  return ERROR_COPY[reason] ?? 'Could not save the rejection. Please try again.';
}

export function RejectDialog({
  proposalId,
  onRejected,
}: {
  proposalId: number;
  onRejected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // UI-SPEC §5 enabling logic: confirm requires a reason AND (reason ≠ Other OR
  // note non-empty). Reset on close so the next reject starts clean.
  const isOther = reason === 'other';
  const canConfirm = reason !== null && (!isOther || note.trim().length > 0);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason(null);
      setNote('');
      setError(null);
    }
  }

  function confirm() {
    if (!canConfirm || !reason) return;
    startTransition(async () => {
      try {
        const result = await rejectProposalAction(proposalId, {
          reason,
          note: note.trim() || undefined,
        });
        if (!result.ok) {
          setError(errorMessage(result.reason));
          return;
        }
        setOpen(false);
        onRejected();
      } catch {
        setError(errorMessage('action_failed'));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why are you rejecting this proposal?</DialogTitle>
          <DialogDescription>
            Your reason helps improve future analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={reason ?? undefined} onValueChange={setReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isOther ? 'Describe the issue…' : 'Add a note (optional)'}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={!canConfirm || pending}>
            {pending ? 'Rejecting…' : 'Reject proposal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
