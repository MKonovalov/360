'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  archiveCompanySignalAction,
  archivePersonaSignalAction,
} from '@/app/actions/signals';
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

// SIG-08: archive is a confirmed, reversible soft status flip (status='retired')
// rather than a hard delete. The confirm button uses the default near-black
// variant — never the destructive red styling — because the action is fully
// undoable by editing the signal's status back to Active.

export function ArchiveSignalDialog({
  signalKind,
  signalId,
  onArchived,
  trigger,
}: {
  signalKind: 'company' | 'persona';
  signalId: number;
  onArchived?: () => void;
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
      const action =
        signalKind === 'company'
          ? archiveCompanySignalAction
          : archivePersonaSignalAction;
      try {
        const result = await action(signalId);
        if (!result.ok) {
          setError('Could not archive this signal. Please try again.');
          return;
        }
        setOpen(false);
        onArchived?.();
        router.refresh();
      } catch {
        setError('Could not archive this signal. Please try again.');
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
          <DialogTitle>Archive this signal?</DialogTitle>
          <DialogDescription>
            It will no longer appear in active views, but its history and any
            linked offerings are preserved. You can restore it later by editing
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
