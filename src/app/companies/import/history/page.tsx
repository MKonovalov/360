import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listImportBatchesWithRollbackStatus } from '@/lib/db/queries/importBatches';
import { ImportHistoryTable } from '@/components/import/import-history-table';

export default async function CompanyImportHistoryPage() {
  await requireStaffAccess();

  const batches = await listImportBatchesWithRollbackStatus('company');

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Company Import History</h1>
      <ImportHistoryTable batches={batches} entityType="company" />
    </div>
  );
}
