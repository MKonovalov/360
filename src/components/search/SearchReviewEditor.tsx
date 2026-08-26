'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  searchPersonaDraftSchema,
  type SearchEditRequest,
  type SearchPersonaDraft,
  type SearchReviewProjection,
} from '@/lib/search/contracts';

export type SearchReviewRoleOption = { readonly id: number; readonly name: string };
export type SearchReviewEditPayload = Omit<SearchEditRequest, 'expectedRevision'>;

type PersonaField = keyof SearchPersonaDraft;
type EditablePersonaDraft = Record<PersonaField, string | null>;

const PERSONA_FIELDS: readonly { readonly key: PersonaField; readonly label: string }[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'fullName', label: 'Full name' },
  { key: 'title', label: 'Title' },
  { key: 'email', label: 'Email' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'department', label: 'Department' },
  { key: 'function', label: 'Function' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'companyName', label: 'Company name' },
  { key: 'companyDomain', label: 'Company domain' },
  { key: 'bio', label: 'Biography' },
  { key: 'photoUrl', label: 'Photo URL' },
];

export interface SearchReviewEditorProps {
  readonly review: SearchReviewProjection;
  readonly roleOptions: readonly SearchReviewRoleOption[];
  readonly isSaving: boolean;
  readonly errorMessage?: string | null;
  readonly onCancel: () => void;
  readonly onSave: (payload: SearchReviewEditPayload) => void;
}

export function createPersonaDraftFromReview(review: SearchReviewProjection): SearchPersonaDraft {
  return { ...review.persona };
}

export function buildSearchReviewEditPayload(input: {
  readonly persona: SearchPersonaDraft;
  readonly buyerRoleIds: readonly number[];
  readonly reason?: string;
}): SearchReviewEditPayload {
  const reason = input.reason?.trim();
  return {
    persona: input.persona,
    buyerRoleIds: [...new Set(input.buyerRoleIds)].sort((left, right) => left - right),
    ...(reason ? { reason } : {}),
  };
}

export function SearchReviewEditor({
  review,
  roleOptions,
  isSaving,
  errorMessage = null,
  onCancel,
  onSave,
}: SearchReviewEditorProps) {
  const [draft, setDraft] = useState<EditablePersonaDraft>(() => ({ ...createPersonaDraftFromReview(review) }));
  const [selectedRoleIds, setSelectedRoleIds] = useState<readonly number[]>(() =>
    review.buyerRoles.map((role) => role.buyerRoleId),
  );
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ ...createPersonaDraftFromReview(review) });
    setSelectedRoleIds(review.buyerRoles.map((role) => role.buyerRoleId));
    setReason('');
    setValidationError(null);
  }, [review]);

  const availableRoles = useMemo(() => {
    const roles = new Map<number, SearchReviewRoleOption>();
    for (const role of review.buyerRoles) roles.set(role.buyerRoleId, { id: role.buyerRoleId, name: role.buyerRoleName });
    for (const role of roleOptions) roles.set(role.id, role);
    return [...roles.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [review.buyerRoles, roleOptions]);

  function updateField(field: PersonaField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: field === 'fullName' ? value : value.trim() === '' ? null : value }));
    setValidationError(null);
  }

  function toggleRole(roleId: number, checked: boolean) {
    setSelectedRoleIds((previous) => {
      if (checked) return previous.includes(roleId) || previous.length >= 10 ? previous : [...previous, roleId];
      return previous.filter((id) => id !== roleId);
    });
    setValidationError(null);
  }

  function save() {
    const parsed = searchPersonaDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setValidationError('Enter a full name and valid values for the edited Persona fields.');
      return;
    }
    onSave(buildSearchReviewEditPayload({ persona: parsed.data, buyerRoleIds: selectedRoleIds, reason }));
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[14px] font-semibold leading-[1.5] text-slate-900">Edit staged candidate</h4>
          <p className="text-[12px] leading-[1.4] text-slate-500">Revision {review.revision} · changes remain in Search until approval.</p>
        </div>
        <span className="text-[12px] text-slate-500">All fields are optional except full name.</span>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {PERSONA_FIELDS.map(({ key, label }) => {
          const value = draft[key] ?? '';
          const fieldId = `search-review-${review.reviewId}-${key}`;
          return (
            <label key={key} htmlFor={fieldId} className={key === 'bio' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
              <span className="text-[12px] font-medium text-slate-700">{label}</span>
              {key === 'bio' ? (
                <Textarea id={fieldId} value={value} disabled={isSaving} onChange={(event) => updateField(key, event.target.value)} />
              ) : (
                <Input id={fieldId} value={value} disabled={isSaving} onChange={(event) => updateField(key, event.target.value)} />
              )}
            </label>
          );
        })}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[12px] font-medium text-slate-700">Buyer Role assignments</legend>
        <p className="text-[12px] text-slate-500">Add, remove, or change assignments. The server resolves role names and writes only the staged Search snapshot.</p>
        {availableRoles.length === 0 ? (
          <p className="text-[12px] text-slate-500">No Buyer Roles are available for this review.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {availableRoles.map((role) => (
              <label key={role.id} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700">
                <Checkbox
                  checked={selectedRoleIds.includes(role.id)}
                  disabled={isSaving || (!selectedRoleIds.includes(role.id) && selectedRoleIds.length >= 10)}
                  onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
                  aria-label={`Assign ${role.name}`}
                />
                <span className="truncate">{role.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label htmlFor={`search-review-${review.reviewId}-reason`} className="block space-y-1">
        <span className="text-[12px] font-medium text-slate-700">Edit note (optional)</span>
        <Textarea
          id={`search-review-${review.reviewId}-reason`}
          value={reason}
          disabled={isSaving}
          placeholder="Explain why the staged values changed"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      {(validationError || errorMessage) && (
        <p className="text-[14px] text-red-600" role="alert">{validationError ?? errorMessage}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
        <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>Cancel</Button>
        <Button type="button" disabled={isSaving} onClick={save}>{isSaving ? 'Saving staged edits…' : 'Save staged edits'}</Button>
      </div>
    </div>
  );
}
