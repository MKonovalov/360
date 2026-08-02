import { and, count, desc, eq, exists, gte, not, sql } from 'drizzle-orm';
import { db } from '../index';
import { company, persona, signal, recentlyViewed, signalTypeEnum } from '../schema';

export async function getDashboardCounts() {
  const [[{ companies }], [{ personas }], [{ signals }]] = await Promise.all([
    db.select({ companies: count() }).from(company),
    db.select({ personas: count() }).from(persona),
    db.select({ signals: count() }).from(signal),
  ]);
  return { companies, personas, signals };
}

export async function listRecentSignals(limit = 5) {
  return db
    .select({ signal, companyName: company.name })
    .from(signal)
    .innerJoin(company, eq(signal.companyId, company.id))
    .orderBy(desc(signal.detectedAt))
    .limit(limit);
}

// D-06/D-07: Companies with a HIGH-strength signal that no staff member has
// viewed (any user's recentlyViewed row counts) within the last N days.
// EXISTS/NOT EXISTS (not a JOIN) to avoid duplicate company rows when a
// company has multiple high-strength signals — same reasoning as
// companies.ts's signalType filter (Pitfall 5 there).
export async function listNeedsAttention(notReviewedDays = 14) {
  const cutoff = new Date(Date.now() - notReviewedDays * 24 * 60 * 60 * 1000);

  return db
    .select()
    .from(company)
    .where(
      and(
        exists(
          db
            .select({ one: sql`1` })
            .from(signal)
            .where(and(eq(signal.companyId, company.id), eq(signal.strength, 'high')))
        ),
        not(
          exists(
            db
              .select({ one: sql`1` })
              .from(recentlyViewed)
              .where(
                and(
                  eq(recentlyViewed.recordType, 'company'),
                  eq(recentlyViewed.recordId, company.id),
                  gte(recentlyViewed.viewedAt, cutoff)
                )
              )
          )
        )
      )
    );
}

// D-05: zero-fill all 4 enum types so the widget always shows 4 rows,
// even when a type has no signals yet (UI-SPEC: "no special empty-state copy").
export async function getSignalTypeBreakdown() {
  const rows = await db
    .select({ signalType: signal.signalType, count: count() })
    .from(signal)
    .groupBy(signal.signalType);

  const counts = new Map(rows.map((r) => [r.signalType, r.count]));
  return signalTypeEnum.enumValues.map((signalType) => ({
    signalType,
    count: counts.get(signalType) ?? 0,
  }));
}
