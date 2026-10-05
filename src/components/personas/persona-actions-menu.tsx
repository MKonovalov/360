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
import { Input } from '@/components/ui/input';
import { deletePersona, updatePersona } from '@/app/actions/personas';
import { humanizeEnum } from '@/components/explorer/explorer-format';

const SENIORITIES = ['ic', 'manager', 'director', 'vp', 'c_level'] as const;

export interface PersonaActionsTarget {
  readonly id: number;
  readonly version: number;
  readonly name: string;
  readonly title: string | null;
  readonly seniority: (typeof SENIORITIES)[number] | null;
  readonly email: string | null;
  readonly linkedinUrl: string | null;
}

const labelClass = 'flex flex-col gap-1 text-sm font-medium text-slate-700';

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

  function save(formData: FormData) {
    const text = (key: string) => String(formData.get(key) ?? '');
    const seniority = text('seniority');
    setError(null);
    startTransition(async () => {
      const result = await updatePersona({
        id: persona.id,
        baseVersion: persona.version,
        name: text('name'),
        title: text('title'),
        seniority: seniority === '' ? null : seniority,
        email: text('email'),
        linkedinUrl: text('linkedinUrl'),
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      close();
      router.refresh();
    });
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

      <Dialog open={dialog === 'edit'} onOpenChange={(open) => (open ? undefined : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit persona</DialogTitle>
            <DialogDescription>Changed fields are marked as manually entered.</DialogDescription>
          </DialogHeader>
          <form action={save} className="space-y-4">
            <label className={labelClass}>
              Name
              <Input name="name" defaultValue={persona.name} required maxLength={200} />
            </label>
            <label className={labelClass}>
              Title
              <Input name="title" defaultValue={persona.title ?? ''} maxLength={300} />
            </label>
            <label className={labelClass}>
              Seniority
              <select
                name="seniority"
                defaultValue={persona.seniority ?? ''}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">—</option>
                {SENIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Email
              <Input name="email" type="email" defaultValue={persona.email ?? ''} maxLength={320} />
            </label>
            <label className={labelClass}>
              LinkedIn URL
              <Input name="linkedinUrl" type="url" defaultValue={persona.linkedinUrl ?? ''} maxLength={500} />
            </label>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
