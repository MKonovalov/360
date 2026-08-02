'use client';

import { useState } from 'react';
import { executeRollback, previewRollback } from '@/app/actions/rollback';
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
import { Skeleton } from '@/components/ui/skeleton';

// Entity-specific nouns for the confirmation copy (07-UI-SPEC.md Copywriting
// Contract: "{N} companies will be deleted"). Explicit lookup rather than
// naive `${entityType}s` pluralization — 'company' would become 'companys'
// (same Pitfall 3 the dashboard's ROUTE_BY_RECORD_TYPE map already closed).
const ENTITY_NOUN = {
  company: { singular: 'company', plural: 'companies' },
  persona: { singular: 'persona', plural: 'personas' },
} as const;

// previewRollback is only ever fired on Dialog open, so 'idle' is the state
// this component sits in for its entire life on a history page that is never
// interacted with — no network work happens on mount.
type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; willDelete: number; skipped: number }
  | { status: 'error' };

export function RollbackDialog({
  batchId,
  entityType,
}: {
  batchId: number;
  entityType: 'company' | 'persona';
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });
  const [isExecuting, setIsExecuting] = useState(false);
  // Holds executeRollback's ACTUAL returned counts — never previewRollback's
  // pre-check numbers (Pitfall 4/5: no transaction spans the preview→execute
  // gap on neon-http, so the two can legitimately differ).
  const [result, setResult] = useState<{ deleted: number; skipped: number } | null>(null);

  const noun = ENTITY_NOUN[entityType];

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    // The ONLY previewRollback call site. Deliberately not a useEffect on
    // mount — a history page with 50 rows would otherwise fire 50 read-only
    // rollback pre-checks (each of which walks every import_log row for
    // dependents) before staff has expressed any intent to roll anything back.
    setPreview({ status: 'loading' });
    try {
      const { willDelete, skipped } = await previewRollback(batchId);
      setPreview({ status: 'ready', willDelete, skipped });
    } catch {
      setPreview({ status: 'error' });
    }
  }

  async function handleConfirm() {
    setIsExecuting(true);
    try {
      const executed = await executeRollback(batchId);
      setResult({ deleted: executed.deleted, skipped: executed.skipped });
      setOpen(false);
      // Reset so a subsequent open re-previews against post-rollback state
      // rather than re-showing the now-stale pre-check counts.
      setPreview({ status: 'idle' });
    } catch {
      setPreview({ status: 'error' });
    } finally {
      setIsExecuting(false);
    }
  }

  // Post-rollback inline confirmation, shown in place of the trigger.
  //
  // Deliberately NOT paired with router.refresh(): the parent table omits this
  // component entirely once a batch reads isFullyRolledBack, so refreshing here
  // would unmount this component mid-render and destroy the actual-count
  // confirmation staff needs to see (the counts are the whole point — they can
  // differ from the preview). Staff stays on the history page with no
  // navigation; the row's Status badge reflects the new state on next load.
  if (result) {
    return (
      <p className="text-sm text-slate-600">
        {`Rolled back ${result.deleted} ${result.deleted === 1 ? 'record' : 'records'}. ${result.skipped} skipped — has dependent data.`}
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Roll back
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          {/* Rendered unconditionally, including during the loading state —
              Radix requires a DialogTitle for the dialog's accessible name,
              and this copy is static regardless of the preview outcome. */}
          <DialogTitle>Roll back this import?</DialogTitle>
          {preview.status === 'loading' || preview.status === 'idle' ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}
          {preview.status === 'error' ? (
            <DialogDescription>
              {"Something went wrong checking this import. Close this dialog and try again."}
            </DialogDescription>
          ) : null}
          {preview.status === 'ready' ? (
            <DialogDescription>
              {`${preview.willDelete} ${preview.willDelete === 1 ? noun.singular : noun.plural} will be deleted. ${preview.skipped} ${preview.skipped === 1 ? 'row' : 'rows'} skipped — has dependent data. This can't be undone.`}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={preview.status !== 'ready' || isExecuting}
            onClick={handleConfirm}
          >
            {preview.status === 'ready'
              ? `Roll back ${preview.willDelete} ${preview.willDelete === 1 ? 'record' : 'records'}`
              : 'Roll back'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
