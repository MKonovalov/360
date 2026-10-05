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
import { createCompany, updateCompany } from '@/app/actions/companies';
import { humanizeEnum } from '@/components/explorer/explorer-format';

const REVENUE_BANDS = ['under_50m', '50m_250m', '250m_1b', '1b_5b', '5b_plus'] as const;
const OWNERSHIP_TYPES = ['public', 'private', 'family_owned', 'pe_backed', 'cooperative', 'state_owned', 'subsidiary'] as const;

export interface CompanyActionsTarget {
  readonly id: number;
  readonly version: number;
  readonly name: string;
  readonly domain: string | null;
  readonly industry: string | null;
  readonly employeeCountBand: string | null;
  readonly hqLocation: string | null;
  readonly revenueBand: (typeof REVENUE_BANDS)[number] | null;
  readonly ownershipType: (typeof OWNERSHIP_TYPES)[number] | null;
}

const labelClass = 'flex flex-col gap-1 text-sm font-medium text-slate-700';

// One form for both flows: pass `company` to edit, omit it to add a new one.
export function CompanyFormDialog({
  open,
  onClose,
  company,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly company?: CompanyActionsTarget;
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
    const revenueBand = text('revenueBand');
    const ownershipType = text('ownershipType');
    const values = {
      name: text('name'),
      domain: text('domain'),
      industry: text('industry'),
      employeeCountBand: text('employeeCountBand'),
      hqLocation: text('hqLocation'),
      revenueBand: revenueBand === '' ? null : revenueBand,
      ownershipType: ownershipType === '' ? null : ownershipType,
    };
    setError(null);
    startTransition(async () => {
      if (company) {
        const result = await updateCompany({ id: company.id, baseVersion: company.version, ...values });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        close();
        router.refresh();
        return;
      }
      const result = await createCompany(values);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      close();
      router.push(`/companies/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? 'Edit company' : 'Add company'}</DialogTitle>
          <DialogDescription>Fields you enter are marked as manually entered.</DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
            <label className={labelClass}>
              Name
              <Input name="name" defaultValue={company?.name ?? ''} required />
            </label>
            <label className={labelClass}>
              Domain
              <Input name="domain" defaultValue={company?.domain ?? ''} />
            </label>
            <label className={labelClass}>
              Industry
              <Input name="industry" defaultValue={company?.industry ?? ''} />
            </label>
            <label className={labelClass}>
              Employee count band
              <Input name="employeeCountBand" defaultValue={company?.employeeCountBand ?? ''} />
            </label>
            <label className={labelClass}>
              HQ location
              <Input name="hqLocation" defaultValue={company?.hqLocation ?? ''} />
            </label>
            <label className={labelClass}>
              Revenue band
              <select
                name="revenueBand"
                defaultValue={company?.revenueBand ?? ''}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">—</option>
                {REVENUE_BANDS.map((value) => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Ownership type
              <select
                name="ownershipType"
                defaultValue={company?.ownershipType ?? ''}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">—</option>
                {OWNERSHIP_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </select>
            </label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : company ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
