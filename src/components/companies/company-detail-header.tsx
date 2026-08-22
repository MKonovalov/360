'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnrichMenu } from '@/components/enrichment/enrichment-review-dialog';
import { FieldSourceBadge } from '@/components/explorer/explorer-format';
import type { FieldSource } from '@/components/explorer/explorer-format';

export function CompanyDetailBackLink() {
  return (
    <Button asChild variant="ghost" size="icon" className="flex items-center" aria-label="Back to companies">
      <Link href="/companies">
        <ArrowLeftIcon />
      </Link>
    </Button>
  );
}

export function CompanyDetailHeader({
  companyName,
  industry,
  industrySource,
  recordId,
  canEnrich,
  disabledReason,
}: {
  readonly companyName: string;
  readonly industry: string | null;
  readonly industrySource?: FieldSource;
  readonly recordId: number;
  readonly canEnrich: boolean;
  readonly disabledReason: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
      <div className="flex min-w-0 items-start gap-3">
        <CompanyDetailBackLink />
        <div className="min-w-0">
          <h1 className="break-words text-[24px] font-semibold leading-[1.2] text-slate-900">{companyName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-normal leading-[1.5] text-slate-500">{industry ?? '—'}</p>
            <FieldSourceBadge source={industrySource} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EnrichMenu
          entityType="company"
          recordId={recordId}
          canEnrich={canEnrich}
          disabledReason={disabledReason}
          canAnalyze
        />
      </div>
    </header>
  );
}
