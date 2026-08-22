'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function CompanyDetailLoading() {
  return (
    <div
      data-company-detail-loading="true"
      aria-busy="true"
      aria-label="Loading company detail"
      className="space-y-8 bg-white p-4 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 max-w-[60vw]" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="size-8 shrink-0 rounded-lg" />
      </div>
      <CompanyDetailTabLoading />
    </div>
  );
}

export function CompanyDetailTabLoading() {
  return (
    <div
      data-company-detail-tab-loading="true"
      role="status"
      aria-live="polite"
      className="space-y-4"
    >
      <span className="sr-only">Loading selected section</span>
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function retryCurrentRoute(): void {
  window.location.reload();
}

export function CompanyDetailErrorState({
  onRetry = retryCurrentRoute,
}: {
  readonly onRetry?: () => void;
}) {
  return (
    <div className="p-4 sm:p-8">
      <div
        role="alert"
        className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-8"
      >
        <div className="space-y-2">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Couldn&apos;t load company</p>
          <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
        </div>
        {onRetry ? (
          <Button type="button" onClick={onRetry} variant="outline">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CompanyDetailNotFoundState() {
  return (
    <div className="p-4 sm:p-8">
      <div
        role="status"
        className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-8"
      >
        <div className="space-y-2">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Company not found</p>
          <p className="text-sm text-slate-500">This company may have been removed or the link is invalid.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/companies">Back to companies</Link>
        </Button>
      </div>
    </div>
  );
}
