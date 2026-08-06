'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDomainAction, updateDomainAction } from '@/app/actions/offerings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export interface DomainFormDomain {
  id: number;
  name: string;
}

export interface DomainFormProps {
  mode: 'create' | 'edit';
  practiceAreaId: number;
  domain?: DomainFormDomain;
  trigger: React.ReactNode;
}

export function DomainForm({ mode, practiceAreaId, domain, trigger }: DomainFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Domain has NO status column (30-02 design note) — a single Name field only.
  const [name, setName] = useState(domain?.name ?? '');

  function resetFields() {
    setName(domain?.name ?? '');
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetFields();
    }
  }

  const title = mode === 'create' ? 'New Domain' : 'Edit Domain';
  const canSave = name.trim().length > 0;

  function handleSubmit() {
    if (!canSave) return;

    startTransition(async () => {
      try {
        // practiceAreaId comes from the parent hierarchy row (a prop, never a
        // form field) — the domain's scope is implied by where it was opened.
        // sortOrder is server-computed (T-30-02-03) — never sent.
        const result =
          mode === 'create'
            ? await createDomainAction({ practiceAreaId, name: name.trim() })
            : await updateDomainAction(domain!.id, { practiceAreaId, name: name.trim() });

        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason (T-30-04-02).
          setError('Could not save this Domain. Please try again.');
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError('Could not save this Domain. Please try again.');
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Create a new domain scoped to this practice area.'
              : 'Update this domain.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Domain name"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit} disabled={!canSave || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
