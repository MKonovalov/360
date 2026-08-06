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

// OFR-08: guarded hard-delete confirm shared by ALL four entity kinds (Practice
// Area, Domain, Offering, Buyer Role). The caller supplies onDelete (e.g.
// `() => deletePracticeAreaAction(id)`, `() => deleteDomainAction(id)`,
// `() => deleteOfferingAction(id)`, `() => deleteBuyerRoleAction(id)`) so this
// ONE component serves every guarded entity kind — it never imports a specific
// Server Action (T-30-06-02); the `requireStaffAccess()` gate and the entity
// scope live in the action the caller's callback wraps.
//
// Three render states driven by the action's discriminated-union result:
// null (pre-attempt) and 'confirm' show the standard confirm; 'blocked' (the
// dependents guard refused the delete) shows the blocking copy with NO confirm
// action at all — the delete is genuinely refused, with no UI path to retry
// from inside the dialog (T-30-06-01). The underlying deleteXAction re-checks
// hasXDependents() fresh on every call regardless, so even a hypothetical
// stale-UI bypass would be re-rejected server-side.
//
// D-10 (LOCKED): the dialog's own confirm button is variant="default"
// (near-black) in every branch — never destructive red. Destructive red is
// reserved EXCLUSIVELY for the row-level Delete TRIGGER (the button that opens
// this dialog), since the pre-check is informative, not the point-of-no-return
// styling. This resolves the UI-SPEC Copywriting/Row-Anatomy self-contradiction
// in favor of D-10 + the Color section.

export function DeleteGuardDialog({
  entityLabel,
  onDelete,
  trigger,
}: {
  entityLabel: string;
  onDelete: () => Promise<{ ok: boolean; reason?: string }>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'confirm' | 'blocked' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setState(null);
      setError(null);
    }
  }

  function confirm() {
    startTransition(async () => {
      try {
        const result = await onDelete();
        if (!result.ok) {
          if (result.reason === 'has_dependents') {
            // Blocked: stay open, do NOT close, do NOT refresh — the delete is
            // refused (T-30-06-01).
            setState('blocked');
            return;
          }
          // Generic copy only — never the Server Action's raw reason.
          setError(`Could not delete this ${entityLabel}. Please try again.`);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError(`Could not delete this ${entityLabel}. Please try again.`);
      }
    });
  }

  const isBlocked = state === 'blocked';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        {isBlocked ? (
          <>
            <DialogHeader>
              <DialogTitle>Cannot delete this {entityLabel}</DialogTitle>
              <DialogDescription>
                This {entityLabel} has dependent records — remove or reassign
                them first, or use Archive instead if it's still in use.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete this {entityLabel}?</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
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
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
