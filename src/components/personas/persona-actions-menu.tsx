'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EnrichMenu, type EnrichMenuProps } from '@/components/enrichment/enrichment-review-dialog';
import { deletePersona } from '@/app/actions/personas';
import { PersonaFormDialog, type PersonaActionsTarget } from '@/components/personas/persona-form-dialog';

// The one upper-right menu: Edit/Delete first, then Enrich/Analyze.
export function PersonaActionsMenu({
  persona,
  enrich,
}: {
  readonly persona: PersonaActionsTarget;
  readonly enrich: Omit<EnrichMenuProps, 'leadingActions'>;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setDialog(null);
    setError(null);
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deletePersona({ id: persona.id });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      router.push('/personas');
    });
  }

  return (
    <>
      <EnrichMenu
        {...enrich}
        leadingActions={[
          { label: 'Edit', onSelect: () => setDialog('edit') },
          { label: 'Delete', destructive: true, onSelect: () => setDialog('delete') },
        ]}
      />

      <PersonaFormDialog open={dialog === 'edit'} onClose={close} persona={persona} />

      <Dialog open={dialog === 'delete'} onOpenChange={(open) => (open ? undefined : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {persona.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the persona and its company role history. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
