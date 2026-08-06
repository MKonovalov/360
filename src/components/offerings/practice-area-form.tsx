'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createPracticeAreaAction,
  updatePracticeAreaAction,
} from '@/app/actions/offerings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { practiceAreaStatusEnum } from '@/lib/db/schema';

export interface PracticeAreaFormPracticeArea {
  id: number;
  name: string;
  shortCode: string;
  description: string | null;
  status: 'active' | 'draft';
}

export interface PracticeAreaFormProps {
  mode: 'create' | 'edit';
  practiceArea?: PracticeAreaFormPracticeArea;
  trigger: React.ReactNode;
}

// Exactly 2 lifecycle states — driven by practiceAreaStatusEnum (schema.ts:305),
// never a hardcoded array. 'retired' does not exist for practice areas.
const STATUS_OPTIONS = practiceAreaStatusEnum.enumValues;

export function PracticeAreaForm({
  mode,
  practiceArea,
  trigger,
}: PracticeAreaFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(practiceArea?.name ?? '');
  const [shortCode, setShortCode] = useState(practiceArea?.shortCode ?? '');
  const [description, setDescription] = useState(practiceArea?.description ?? '');
  const [status, setStatus] = useState<'active' | 'draft'>(practiceArea?.status ?? 'active');

  function resetFields() {
    setName(practiceArea?.name ?? '');
    setShortCode(practiceArea?.shortCode ?? '');
    setDescription(practiceArea?.description ?? '');
    setStatus(practiceArea?.status ?? 'active');
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetFields();
    }
  }

  const title = mode === 'create' ? 'New Practice Area' : 'Edit Practice Area';
  const canSave = name.trim().length > 0 && shortCode.trim().length > 0;

  function handleSubmit() {
    if (!canSave) return;

    startTransition(async () => {
      try {
        // sortOrder is server-computed (T-30-02-03) — the form never sends it.
        const payload = {
          name: name.trim(),
          shortCode: shortCode.trim(),
          description: description.trim() || undefined,
          status,
        };

        const result =
          mode === 'create'
            ? await createPracticeAreaAction(payload)
            : await updatePracticeAreaAction(practiceArea!.id, payload);

        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason (T-30-04-02).
          setError('Could not save this Practice Area. Please try again.');
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError('Could not save this Practice Area. Please try again.');
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
              ? 'Create a new top-level practice area with a unique short code.'
              : 'Update this practice area.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Practice area name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Short Code</label>
            <Input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="e.g. GBS-DBR"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the practice area…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Status</label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
