import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dateFormatter } from '@/components/explorer/explorer-format';
import { RollbackDialog } from '@/components/import/rollback-dialog';
import type { listImportBatchesWithRollbackStatus } from '@/lib/db/queries/importBatches';

// Display label for the Entity column. Explicit map rather than a capitalize
// helper so the copy stays greppable and matches 07-UI-SPEC.md verbatim.
const ENTITY_LABEL = {
  company: 'Company',
  persona: 'Persona',
} as const;

export function ImportHistoryTable({
  batches,
  entityType,
}: {
  batches: Awaited<ReturnType<typeof listImportBatchesWithRollbackStatus>>;
  entityType: 'company' | 'persona';
}) {
  if (batches.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">No imports yet</p>
        <p className="text-sm text-slate-500">
          {'Run your first CSV import from Menu → Import on the Company or Persona list.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Uploaded by</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell className="text-slate-900">
                {dateFormatter.format(batch.createdAt)}
              </TableCell>
              <TableCell>{ENTITY_LABEL[batch.entityType]}</TableCell>
              <TableCell className="text-slate-600">
                {/* Clerk userId (import_batch.createdBy has no FK — Clerk is
                    external). Truncated on a span, not the <td>: TableCell is
                    whitespace-nowrap, so max-width alone would overflow the row. */}
                <span className="block max-w-48 truncate">{batch.createdBy}</span>
              </TableCell>
              <TableCell>{batch.actualCreated ?? '—'}</TableCell>
              <TableCell>{batch.actualUpdated ?? '—'}</TableCell>
              <TableCell>
                {/* isFullyRolledBack is read DIRECTLY off the row — the
                    aggregate that computes it lives in one SQL query in
                    listImportBatchesWithRollbackStatus. Never re-derive it
                    here from counts; the two would silently drift. */}
                {batch.isFullyRolledBack ? (
                  <Badge variant="destructive">Rolled back</Badge>
                ) : (
                  <Badge variant="secondary">Committed</Badge>
                )}
              </TableCell>
              <TableCell>
                {/* Omitted entirely rather than rendered disabled once the
                    batch is fully rolled back — there is nothing left to undo,
                    so a greyed-out button would advertise an action that can
                    never succeed. entityType comes from the page scope (D-05:
                    one entity type per flow); listImportBatchesWithRollbackStatus
                    already filtered these batches by that same value. */}
                {batch.isFullyRolledBack ? null : (
                  <RollbackDialog batchId={batch.id} entityType={entityType} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
