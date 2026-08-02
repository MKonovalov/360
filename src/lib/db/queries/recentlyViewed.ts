import { desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { recentlyViewed, recordTypeEnum } from '../schema';

export interface RecordViewInput {
  userId: string;
  recordType: (typeof recordTypeEnum.enumValues)[number];
  recordId: number;
}

// Verified against installed drizzle-orm@0.45.2 PgInsert.onConflictDoUpdate
// type: `target` accepts an IndexColumn[] matching the composite unique
// constraint's columns — no need to reference the constraint by name.
export async function recordView({ userId, recordType, recordId }: RecordViewInput) {
  await db
    .insert(recentlyViewed)
    .values({ userId, recordType, recordId })
    .onConflictDoUpdate({
      target: [recentlyViewed.userId, recentlyViewed.recordType, recentlyViewed.recordId],
      set: { viewedAt: new Date() },
    });
}

// D-05: 5 most-recent items for the current user, newest first.
export async function listRecentlyViewedForUser(userId: string, limit = 5) {
  return db
    .select()
    .from(recentlyViewed)
    .where(eq(recentlyViewed.userId, userId))
    .orderBy(desc(recentlyViewed.viewedAt))
    .limit(limit);
}
