'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOfferingAction, updateOfferingAction } from '@/app/actions/offerings';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { catalogStatusEnum, offerTypeEnum } from '@/lib/db/schema';
import { RankedBuyerRolesPicker } from './ranked-buyer-roles-picker';

export interface OfferingFormOffering {
  id: number;
  practiceAreaId: number;
  domainId: number | null;
  name: string;
  offerType: string;
  description: string;
  commercialModelText: string | null;
  status: 'active' | 'draft' | 'retired';
}

export interface OfferingFormLinkedSignal {
  signalType: 'company' | 'persona';
  signalId: number;
  name: string;
}

export interface OfferingFormProps {
  mode: 'create' | 'edit';
  offering?: OfferingFormOffering;
  existingRankedBuyerRoles?: Array<{ buyerRoleId: number; name: string; rank: number }>;
  // OFR-07 reverse lookup — server-resolved names passed as a prop; this
  // component never fetches or writes signal data itself (T-30-05-01).
  linkedSignals?: OfferingFormLinkedSignal[];
  practiceAreas: Array<{ id: number; name: string }>;
  domainsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  buyerRoles: Array<{ id: number; name: string }>;
  trigger: React.ReactNode;
}

// Enum options sourced from the schema — never hardcoded arrays (OFR-04).
const OFFER_TYPE_OPTIONS = offerTypeEnum.enumValues;
const STATUS_OPTIONS = catalogStatusEnum.enumValues;

export function OfferingForm({
  mode,
  offering,
  existingRankedBuyerRoles,
  linkedSignals,
  practiceAreas,
  domainsByPracticeAreaId,
  buyerRoles,
  trigger,
}: OfferingFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(offering?.name ?? '');
  const [practiceAreaId, setPracticeAreaId] = useState<number>(
    offering?.practiceAreaId ?? practiceAreas[0]?.id ?? 0
  );
  const [domainId, setDomainId] = useState<number | null>(offering?.domainId ?? null);
  const [offerType, setOfferType] = useState<string>(offering?.offerType ?? OFFER_TYPE_OPTIONS[0]);
  const [description, setDescription] = useState(offering?.description ?? '');
  const [commercialModelText, setCommercialModelText] = useState(
    offering?.commercialModelText ?? ''
  );
  const [selectedRanked, setSelectedRanked] = useState(
    existingRankedBuyerRoles?.map((r) => ({ buyerRoleId: r.buyerRoleId, rank: r.rank })) ?? []
  );
  const [status, setStatus] = useState<'active' | 'draft' | 'retired'>(
    offering?.status ?? STATUS_OPTIONS[0]
  );

  const companySignals = linkedSignals?.filter((s) => s.signalType === 'company') ?? [];
  const personaSignals = linkedSignals?.filter((s) => s.signalType === 'persona') ?? [];

  function resetFields() {
    setName(offering?.name ?? '');
    setPracticeAreaId(offering?.practiceAreaId ?? practiceAreas[0]?.id ?? 0);
    setDomainId(offering?.domainId ?? null);
    setOfferType(offering?.offerType ?? OFFER_TYPE_OPTIONS[0]);
    setDescription(offering?.description ?? '');
    setCommercialModelText(offering?.commercialModelText ?? '');
    setSelectedRanked(
      existingRankedBuyerRoles?.map((r) => ({ buyerRoleId: r.buyerRoleId, rank: r.rank })) ?? []
    );
    setStatus(offering?.status ?? STATUS_OPTIONS[0]);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetFields();
    }
  }

  const title = mode === 'create' ? 'New Offering' : 'Edit Offering';
  const canSave =
    name.trim().length > 0 && practiceAreaId > 0 && description.trim().length > 0;

  function handleSubmit() {
    if (!canSave) return;

    startTransition(async () => {
      try {
        // sortOrder is server-computed (T-30-02-03) — the form never sends it.
        // domainId: null is the valid OFR-04 "No domain" payload; empty
        // commercialModelText normalizes to undefined (optional field).
        const payload = {
          practiceAreaId,
          domainId,
          name: name.trim(),
          offerType,
          description: description.trim(),
          commercialModelText: commercialModelText.trim() || undefined,
          status,
          buyerRoles: selectedRanked,
        };

        const result =
          mode === 'create'
            ? await createOfferingAction(payload)
            : await updateOfferingAction(offering!.id, payload);

        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason (T-30-04-02).
          setError('Could not save this Offering. Please try again.');
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError('Could not save this Offering. Please try again.');
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      {/* This is the ONLY Sheet in this phase with a width override (D-03):
          the Offering form carries 8 fields + the ranked picker + the
          read-only Linked Signals section. */}
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Create a new offering with ranked buyer roles and optional domain scope.'
              : 'Update this offering and its ranked buyer roles.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Offering name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Practice Area</label>
            <Select
              value={String(practiceAreaId)}
              onValueChange={(value) => {
                // Re-scoping the Domain list — a stale domainId from the
                // previous practice area could point at a domain that no
                // longer appears in the filtered options (OFR-04), so clear
                // it in the same state update.
                setPracticeAreaId(Number(value));
                setDomainId(null);
              }}
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

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Domain (optional)</label>
            <Select
              value={domainId === null ? 'none' : String(domainId)}
              onValueChange={(value) =>
                setDomainId(value === 'none' ? null : Number(value))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {/* shadcn Select cannot hold an empty-string SelectItem value,
                    so the null option serializes as the literal 'none' and is
                    mapped back to null on change. */}
                <SelectItem value="none">No domain (goes straight to Practice Area)</SelectItem>
                {(domainsByPracticeAreaId[practiceAreaId] ?? []).map((domain) => (
                  <SelectItem key={domain.id} value={String(domain.id)}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Offer Type</label>
            <Select value={offerType} onValueChange={setOfferType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an offer type" />
              </SelectTrigger>
              <SelectContent>
                {OFFER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the offering…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Commercial Model Text
            </label>
            <Textarea
              value={commercialModelText}
              onChange={(e) => setCommercialModelText(e.target.value)}
              placeholder="e.g. Fixed fee, short, ≈3–5 weeks"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Buyer Roles (ranked)</label>
            <RankedBuyerRolesPicker
              buyerRoles={buyerRoles}
              selectedRanked={selectedRanked}
              onChange={setSelectedRanked}
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

          {mode === 'edit' && linkedSignals !== undefined && (
            <>
              <Separator className="my-2" />
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">Linked Signals</p>
                {linkedSignals.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No signals are currently linked to this offering.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {companySignals.length > 0 && (
                      <div>
                        <p className="text-[12px] text-slate-500">Company Signals</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
                          {companySignals.map((signal) => (
                            <li key={signal.signalId}>{signal.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {personaSignals.length > 0 && (
                      <div>
                        <p className="text-[12px] text-slate-500">Persona Signals</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
                          {personaSignals.map((signal) => (
                            <li key={signal.signalId}>{signal.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

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
