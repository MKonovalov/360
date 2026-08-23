import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { parseFixtureDatabaseUrl } from '@/lib/verification/databaseIdentity';
import type { AnalyzeCallbackPayload } from '@/lib/arc-agentnet/callback';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl && parseFixtureDatabaseUrl(testDatabaseUrl) ? describe : describe.skip;

describeWithDatabase('durable partner callback persistence', () => {
  it('registers a job before applying callbacks and replays identical events safely', async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    const [{ db }, schema, queries] = await Promise.all([
      import('../index'),
      import('../schema'),
      import('./partnerCallbacks'),
    ]);
    const suffix = randomUUID();
    const input = {
      partnerJobId: `job-${suffix}`,
      requestId: `request-${suffix}`,
      idempotencyKey: `idempotency-${suffix}`,
      status: 'queued' as const,
    };

    const registered = await queries.registerPartnerJob(input);
    const repeatedRegistration = await queries.registerPartnerJob(input);
    const callback: AnalyzeCallbackPayload = {
      eventId: `event-${suffix}`,
      jobId: input.partnerJobId,
      requestId: input.requestId,
      status: 'succeeded',
      result: { findings: [{ id: 'finding-1' }] },
    };

    const applied = await queries.applyPartnerCallback({
      callback,
      payloadHash: 'a'.repeat(64),
      resultSizeBytes: 35,
      receivedAt: new Date('2026-08-23T12:00:00.000Z'),
      expiresAt: new Date('2026-08-23T12:05:00.000Z'),
    });
    const replayed = await queries.applyPartnerCallback({
      callback,
      payloadHash: 'a'.repeat(64),
      resultSizeBytes: 35,
      receivedAt: new Date('2026-08-23T12:00:01.000Z'),
      expiresAt: new Date('2026-08-23T12:05:00.000Z'),
    });
    const conflict = await queries.applyPartnerCallback({
      callback: { ...callback, result: { findings: [{ id: 'different' }] } },
      payloadHash: 'b'.repeat(64),
      resultSizeBytes: 32,
      receivedAt: new Date('2026-08-23T12:00:02.000Z'),
      expiresAt: new Date('2026-08-23T12:05:00.000Z'),
    });
    const terminalConflict = await queries.applyPartnerCallback({
      callback: { ...callback, eventId: `event-terminal-${suffix}`, status: 'failed' },
      payloadHash: 'd'.repeat(64),
      resultSizeBytes: 0,
      receivedAt: new Date('2026-08-23T12:00:03.000Z'),
      expiresAt: new Date('2026-08-23T12:05:00.000Z'),
    });
    const [job] = await db.select().from(schema.partnerJobMapping)
      .where(eq(schema.partnerJobMapping.partnerJobId, input.partnerJobId));

    try {
      expect(registered).toMatchObject({ ok: true });
      expect(repeatedRegistration).toMatchObject({ ok: true });
      expect(applied).toEqual({ kind: 'applied' });
      expect(replayed).toEqual({ kind: 'replayed' });
      expect(conflict).toEqual({ kind: 'event_conflict' });
      expect(terminalConflict).toEqual({ kind: 'event_conflict' });
      expect(job).toMatchObject({
        partnerJobId: input.partnerJobId,
        requestId: input.requestId,
        status: 'succeeded',
        result: callback.result,
      });
    } finally {
      await db.delete(schema.partnerCallbackEvent).where(eq(schema.partnerCallbackEvent.jobMappingId, job?.id ?? -1));
      await db.delete(schema.partnerJobMapping).where(eq(schema.partnerJobMapping.partnerJobId, input.partnerJobId));
    }
  });

  it('rejects unknown jobs before recording a callback event', async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    const queries = await import('./partnerCallbacks');
    const unknown = await queries.applyPartnerCallback({
      callback: {
        eventId: `event-${randomUUID()}`,
        jobId: 'missing-job',
        requestId: 'missing-request',
        status: 'cancelled',
      },
      payloadHash: 'c'.repeat(64),
      resultSizeBytes: 0,
      receivedAt: new Date(),
      expiresAt: new Date(Date.now() + 300_000),
    });

    expect(unknown).toEqual({ kind: 'unknown_job' });
  });
});
