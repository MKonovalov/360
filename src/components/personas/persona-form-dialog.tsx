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
import { Input } from '@/components/ui/input';
import { createPersona, updatePersona } from '@/app/actions/personas';
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

// One form for both flows: pass `persona` to edit, omit it to add a new one.
export function PersonaFormDialog({
  open,
  onClose,
  persona,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly persona?: PersonaActionsTarget;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function save(formData: FormData) {
    const text = (key: string) => String(formData.get(key) ?? '');
    const seniority = text('seniority');
    const values = {
      name: text('name'),
      title: text('title'),
      seniority: seniority === '' ? null : seniority,
      email: text('email'),
      linkedinUrl: text('linkedinUrl'),
    };
    setError(null);
    startTransition(async () => {
      if (persona) {
        const result = await updatePersona({ id: persona.id, baseVersion: persona.version, ...values });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        close();
        router.refresh();
        return;
      }
      const result = await createPersona(values);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      close();
      router.push(`/personas/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{persona ? 'Edit persona' : 'Add persona'}</DialogTitle>
          <DialogDescription>Fields you enter are marked as manually entered.</DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
            <label className={labelClass}>
              Name
              <Input name="name" defaultValue={persona?.name ?? ''} required maxLength={200} />
            </label>
            <label className={labelClass}>
              Title
              <Input name="title" defaultValue={persona?.title ?? ''} maxLength={300} />
            </label>
            <label className={labelClass}>
              Seniority
              <select
                name="seniority"
                defaultValue={persona?.seniority ?? ''}
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
              <Input name="email" type="email" defaultValue={persona?.email ?? ''} maxLength={320} />
            </label>
            <label className={labelClass}>
              LinkedIn URL
              <Input name="linkedinUrl" type="url" defaultValue={persona?.linkedinUrl ?? ''} maxLength={500} />
            </label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : persona ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
