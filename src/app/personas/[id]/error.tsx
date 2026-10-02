'use client';

import { PersonaDetailErrorState } from '@/components/personas/persona-detail-states';

export default function PersonaDetailErrorBoundary({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return <PersonaDetailErrorState onRetry={reset} />;
}
