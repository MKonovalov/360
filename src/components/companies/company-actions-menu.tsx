'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EllipsisVerticalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteCompany } from '@/app/actions/companies';
import { CompanyFormDialog, type CompanyActionsTarget } from '@/components/companies/company-form-dialog';

export function CompanyActionsMenu({ company }: { readonly company: CompanyActionsTarget }) {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Company actions">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('add')}>Add</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
