'use client';

import { useEffect } from 'react';
import { recordView } from '@/app/actions';

// D-04/D-08: fire-and-forget telemetry — mounts once per detail-panel open
// (click, keyboard Enter, or a deep-linked ?selected=<id> URL all render the
// same detail component) and records a recently-viewed row for the signed-in
// staff member. The empty .catch() is deliberate: this must never surface an
// error or block the detail panel from rendering, matching the codebase's
// established empty-catch convention for non-critical calls.
export function RecordViewTracker({
  recordType,
  recordId,
}: {
  recordType: 'company' | 'persona';
  recordId: number;
}) {
  useEffect(() => {
    recordView(recordType, recordId).catch(() => {});
  }, [recordType, recordId]);

  return null;
}
