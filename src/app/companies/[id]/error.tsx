'use client';

import { CompanyDetailErrorState } from '@/components/companies/company-detail-states';

export default function CompanyDetailErrorBoundary({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return <CompanyDetailErrorState onRetry={reset} />;
}
