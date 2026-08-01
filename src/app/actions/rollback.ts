'use server';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  deleteRollbackRecord,
  findRollbackableRows,
  markRolledBack,
} from '@/lib/db/queries/importBatches';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503'
  );
}

export async function previewRollback(batchId: number) {
  await requireStaffAccess();
  const { deletable, skipped } = await findRollbackableRows(batchId);
  return { willDelete: deletable.length, skipped: skipped.length };
}

export async function executeRollback(batchId: number) {
  await requireStaffAccess();
  const { deletable, skipped } = await findRollbackableRows(batchId);
  let deleted = 0;
  let raceSkipped = 0;

  for (const row of deletable) {
    try {
      const wasDeleted = await deleteRollbackRecord(row);
      if (!wasDeleted) {
        raceSkipped++;
        continue;
      }
      await markRolledBack([row.id]);
      deleted++;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        raceSkipped++;
      } else {
        throw error;
      }
    }
  }

  return { deleted, skipped: skipped.length + raceSkipped };
}
