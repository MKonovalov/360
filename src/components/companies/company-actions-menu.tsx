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
import { deleteCompany } from '@/app/actions/companies';
import { CompanyFormDialog, type CompanyActionsTarget } from '@/components/companies/company-form-dialog';

// The one upper-right menu: Add/Edit/Delete first, then Enrich/Search/Analyze.
export function CompanyActionsMenu({
  company,
  enrich,
}: {
  readonly company: CompanyActionsTarget;
  readonly enrich: Omit<EnrichMenuProps, 'leadingActions'>;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'add' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setDialog(null);
    setError(null);
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCompany({ id: company.id });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      router.push('/companies');
    });
  }

  return (
    <>
      <EnrichMenu
        {...enrich}
        leadingActions={[
          { label: 'Add', onSelect: () => setDialog('add') },
          { label: 'Edit', onSelect: () => setDialog('edit') },
          { label: 'Delete', destructive: true, onSelect: () => setDialog('delete') },
        ]}
      />

      <CompanyFormDialog open={dialog === 'edit' || dialog === 'add'} onClose={close} company={dialog === 'edit' ? company : undefined} />

      <Dialog open={dialog === 'delete'} onOpenChange={(open) => (open ? undefined : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {company.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the company with its signals, proposals, agent runs, Search runs and candidates, and its links to personas. The personas themselves are kept. It cannot be undone.
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
