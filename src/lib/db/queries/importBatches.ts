import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, importBatch, importLog, persona, signal, companyPersonaRole } from '../schema';

export async function createImportBatch(input: {
  entityType: 'company' | 'persona';
  rawCsv: string;
  createdBy: string;
}) {
  const [inserted] = await db
    .insert(importBatch)
    .values({
      entityType: input.entityType,
      rawCsv: input.rawCsv,
      createdBy: input.createdBy,
    })
    .returning();
  return inserted;
}

// Returns undefined if not found — never throws, caller decides what to do.
export async function getImportBatchById(id: number) {
  const rows = await db.select().from(importBatch).where(eq(importBatch.id, id));
  return rows[0];
}

export async function updateImportBatch(
  id: number,
  patch: Partial<typeof importBatch.$inferInsert>
) {
  const [updated] = await db
    .update(importBatch)
    .set(patch)
    .where(eq(importBatch.id, id))
    .returning();
  return updated;
}

export async function listImportBatches(entityType: 'company' | 'persona') {
  return db
    .select()
    .from(importBatch)
    .where(eq(importBatch.entityType, entityType))
    .orderBy(desc(importBatch.createdAt));
}

// Returns each batch merged with isFullyRolledBack: boolean.
// A batch is fully rolled back when it has at least one created-action log row
// AND every such row has been rolled back. A batch with zero created-action
// rows is NEVER considered fully rolled back (nothing to undo).
export async function listImportBatchesWithRollbackStatus(entityType: 'company' | 'persona') {
  const batches = await listImportBatches(entityType);

  // Aggregate import_log: per batchId, count created-action rows and
  // count those that have been rolled back (rolledBackAt IS NOT NULL).
  // Uses FILTER (WHERE ...) — standard SQL:2003, supported by Postgres.
  const aggregates = await db
    .select({
      batchId: importLog.batchId,
      createdCount: sql<number>`count(*) filter (where ${importLog.action} = 'created')`,
      rolledBackCount: sql<number>`count(*) filter (where ${importLog.action} = 'created' and ${importLog.rolledBackAt} is not null)`,
    })
    .from(importLog)
    .groupBy(importLog.batchId);

  const aggregateMap = new Map(
    aggregates.map((row) => [
      row.batchId,
      { createdCount: Number(row.createdCount), rolledBackCount: Number(row.rolledBackCount) },
    ])
  );

  return batches.map((batch) => {
    const agg = aggregateMap.get(batch.id);
    const createdCount = agg?.createdCount ?? 0;
    const rolledBackCount = agg?.rolledBackCount ?? 0;
    // Zero created-action rows → never fully rolled back (nothing was created)
    const isFullyRolledBack = createdCount > 0 && createdCount === rolledBackCount;
    return { ...batch, isFullyRolledBack };
  });
}

export async function insertImportLog(input: {
  batchId: number;
  entityType: 'company' | 'persona';
  recordId: number;
  action: 'created' | 'updated';
}) {
  const [inserted] = await db
    .insert(importLog)
    .values({
      batchId: input.batchId,
      entityType: input.entityType,
      recordId: input.recordId,
      action: input.action,
    })
    .returning();
  return inserted;
}

// True if any signal or companyPersonaRole row references this company.
// Uses LIMIT 1 to short-circuit — we only need existence, not a full count.
export async function hasCompanyDependents(companyId: number): Promise<boolean> {
  const [signalRow] = await db
    .select({ one: sql`1` })
    .from(signal)
    .where(eq(signal.companyId, companyId))
    .limit(1);
  if (signalRow) return true;
  const [roleRow] = await db
    .select({ one: sql`1` })
    .from(companyPersonaRole)
    .where(eq(companyPersonaRole.companyId, companyId))
    .limit(1);
  return Boolean(roleRow);
}

// True if any companyPersonaRole row references this persona.
export async function hasPersonaDependents(personaId: number): Promise<boolean> {
  const [roleRow] = await db
    .select({ one: sql`1` })
    .from(companyPersonaRole)
    .where(eq(companyPersonaRole.personaId, personaId))
    .limit(1);
  return Boolean(roleRow);
}

async function wasEnrichedAfterImport(row: typeof importLog.$inferSelect): Promise<boolean> {
  const record =
    row.entityType === 'company'
      ? (await db.select({ lastEnrichedAt: company.lastEnrichedAt }).from(company).where(eq(company.id, row.recordId)))[0]
      : (await db.select({ lastEnrichedAt: persona.lastEnrichedAt }).from(persona).where(eq(persona.id, row.recordId)))[0];
  return Boolean(record?.lastEnrichedAt && record.lastEnrichedAt > row.createdAt);
}

// Selects import_log rows for the batch that are created-action and not yet
// rolled back, then partitions them into deletable (no dependents) and skipped
// (has dependents). This is a pre-check only — no transaction spans the gap
// between this call and executeRollback (Pitfall 4: neon-http has no
// transaction support). FK constraints are the hard backstop at execute time.
export async function findRollbackableRows(batchId: number): Promise<{
  deletable: (typeof importLog.$inferSelect)[];
  skipped: (typeof importLog.$inferSelect)[];
}> {
  const createdRows = await db
    .select()
    .from(importLog)
    .where(
      and(
        eq(importLog.batchId, batchId),
        eq(importLog.action, 'created'),
        isNull(importLog.rolledBackAt)
      )
    );

  const deletable: (typeof importLog.$inferSelect)[] = [];
  const skipped: (typeof importLog.$inferSelect)[] = [];

  for (const row of createdRows) {
    const hasDependents =
      row.entityType === 'company'
        ? await hasCompanyDependents(row.recordId)
        : await hasPersonaDependents(row.recordId);
    const enrichedAfterImport = await wasEnrichedAfterImport(row);
    (hasDependents || enrichedAfterImport ? skipped : deletable).push(row);
  }

  return { deletable, skipped };
}

export async function deleteRollbackRecord(row: typeof importLog.$inferSelect): Promise<boolean> {
  const freshness =
    row.entityType === 'company'
      ? or(isNull(company.lastEnrichedAt), lte(company.lastEnrichedAt, row.createdAt))
      : or(isNull(persona.lastEnrichedAt), lte(persona.lastEnrichedAt, row.createdAt));
  const deleted =
    row.entityType === 'company'
      ? await db
          .delete(company)
          .where(and(eq(company.id, row.recordId), freshness))
          .returning({ id: company.id })
      : await db
          .delete(persona)
          .where(and(eq(persona.id, row.recordId), freshness))
          .returning({ id: persona.id });
  return deleted.length === 1;
}

// Sets rolledBackAt = now on the given import_log row ids.
export async function markRolledBack(logIds: number[]): Promise<void> {
  if (logIds.length === 0) return;
  await db
    .update(importLog)
    .set({ rolledBackAt: new Date() })
    .where(sql`${importLog.id} = any(${logIds})`);
}
