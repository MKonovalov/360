import { eq } from 'drizzle-orm';
import { db } from '../index';
import { signal, signalTypeEnum, signalStrengthEnum } from '../schema';

export interface InsertSignalInput {
  companyId: number;
  signalType: (typeof signalTypeEnum.enumValues)[number];
  strength: (typeof signalStrengthEnum.enumValues)[number];
  source?: string;
  detectedAt: string;
  note?: string;
}

export async function insertSignal(row: InsertSignalInput) {
  const [inserted] = await db
    .insert(signal)
    .values({
      companyId: row.companyId,
      signalType: row.signalType,
      strength: row.strength,
      source: row.source,
      detectedAt: row.detectedAt,
      note: row.note,
    })
    .returning();
  return inserted;
}

export async function listSignalsForCompany(companyId: number) {
  return db.select().from(signal).where(eq(signal.companyId, companyId));
}
