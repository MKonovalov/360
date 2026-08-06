'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCompanySignalAction,
  createPersonaSignalAction,
  updateCompanySignalAction,
  updatePersonaSignalAction,
} from '@/app/actions/signals';
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
import { catalogStatusEnum } from '@/lib/db/schema';
import { LinkedOfferingsPicker } from './linked-offerings-picker';

export interface SignalFormSignal {
  id: number;
  practiceAreaId: number;
  name: string;
  category: string;
  description: string;
  status: 'active' | 'draft' | 'retired';
  buyerRoleId?: number;
}

export interface SignalFormProps {
  signalKind: 'company' | 'persona';
  mode: 'create' | 'edit';
  signal?: SignalFormSignal;
  existingLinkedOfferingIds?: number[];
  practiceAreas: Array<{ id: number; name: string }>;
  buyerRoles: Array<{ id: number; name: string }>;
  categories: string[];
  activeOfferingsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  trigger: React.ReactNode;
}

const STATUS_OPTIONS = catalogStatusEnum.enumValues;

export function SignalForm({
  signalKind,
  mode,
  signal,
  existingLinkedOfferingIds = [],
  practiceAreas,
  buyerRoles,
  categories,
  activeOfferingsByPracticeAreaId,
  trigger,
}: SignalFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [practiceAreaId, setPracticeAreaId] = useState<number>(signal?.practiceAreaId ?? practiceAreas[0]?.id ?? 0);
  const [buyerRoleId, setBuyerRoleId] = useState<number | undefined>(signal?.buyerRoleId ?? undefined);
  const [name, setName] = useState(signal?.name ?? '');
  const [category, setCategory] = useState(signal?.category ?? '');
  const [description, setDescription] = useState(signal?.description ?? '');
  const [status, setStatus] = useState<'active' | 'draft' | 'retired'>(signal?.status ?? 'active');
  const [offeringIds, setOfferingIds] = useState<number[]>(existingLinkedOfferingIds);

  function resetFields() {
    setPracticeAreaId(signal?.practiceAreaId ?? practiceAreas[0]?.id ?? 0);
    setBuyerRoleId(signal?.buyerRoleId ?? undefined);
    setName(signal?.name ?? '');
    setCategory(signal?.category ?? '');
    setDescription(signal?.description ?? '');
    setStatus(signal?.status ?? 'active');
    setOfferingIds(existingLinkedOfferingIds);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetFields();
    }
  }

  const isPersona = signalKind === 'persona';
  const title =
    mode === 'create'
      ? `New ${isPersona ? 'Persona' : 'Company'} Signal`
      : `Edit ${isPersona ? 'Persona' : 'Company'} Signal`;
  const canSave =
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    description.trim().length > 0 &&
    practiceAreaId > 0 &&
    (!isPersona || buyerRoleId !== undefined);

  function handleSubmit() {
    if (!canSave) return;

    startTransition(async () => {
      try {
        const payload = {
          practiceAreaId,
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          status,
          offeringIds,
          ...(isPersona ? { buyerRoleId: buyerRoleId! } : {}),
        };

        const result =
          mode === 'create'
            ? isPersona
              ? await createPersonaSignalAction(payload)
              : await createCompanySignalAction(payload)
            : isPersona
              ? await updatePersonaSignalAction(signal!.id, payload)
              : await updateCompanySignalAction(signal!.id, payload);

        if (!result.ok) {
          setError('Could not save this signal. Please try again.');
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError('Could not save this signal. Please try again.');
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
              ? 'Create a new signal linked to a Practice Area and its active Offerings.'
              : 'Update this signal and its linked Offerings.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Signal name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Practice Area</label>
            <Select
              value={String(practiceAreaId)}
              onValueChange={(value) => setPracticeAreaId(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a practice area" />
              </SelectTrigger>
              <SelectContent>
                {practiceAreas.map((area) => (
                  <SelectItem key={area.id} value={String(area.id)}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPersona && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Buyer Role</label>
              <Select
                value={buyerRoleId !== undefined ? String(buyerRoleId) : undefined}
                onValueChange={(value) => setBuyerRoleId(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      buyerRoles.length === 0 ? 'No buyer roles available' : 'Select a buyer role'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {buyerRoles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Category</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. GBS-state, Financial & commercial…"
              list="signal-categories"
            />
            <datalist id="signal-categories">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the signal and why it matters…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Linked Offerings</label>
            <LinkedOfferingsPicker
              offerings={activeOfferingsByPracticeAreaId[practiceAreaId] ?? []}
              selectedIds={offeringIds}
              onChange={setOfferingIds}
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
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!canSave || pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
