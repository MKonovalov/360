'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

// OFR-08: reversible status-flip confirm shared by Practice Area and Offering
// (never Domain or Buyer Role — neither has a status column). The caller
// supplies onArchive (e.g. `() => archivePracticeAreaAction(id)` or
// `() => archiveOfferingAction(id)`) so this dialog stays entity-agnostic —
// it never imports one specific Server Action (T-30-06-02).
//
// D-10 (LOCKED): the confirm button uses the default near-black variant, never
// destructive red — archiving is a reversible status flip, mirroring
// ArchiveSignalDialog (Phase 29).

export function ArchiveEntityDialog({
  entityLabel,
  onArchive,
  trigger,
}: {
  entityLabel: string;
  onArchive: () => Promise<{ ok: boolean; reason?: string }>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
    }
  }

  function confirm() {
    startTransition(async () => {
      try {
        const result = await onArchive();
        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason.
          setError(`Could not archive this ${entityLabel}. Please try again.`);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError(`Could not archive this ${entityLabel}. Please try again.`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            Archive
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this {entityLabel}?</DialogTitle>
          <DialogDescription>
            It will no longer appear in active pickers, but its history and
            dependent records are preserved. You can restore it later by editing
            its status back to Active.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="default" onClick={confirm} disabled={pending}>
            {pending ? 'Archiving…' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
