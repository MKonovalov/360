import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('userModelSettings query boundaries', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let queries: typeof import('./userModelSettings');
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');
    queries = await import('./userModelSettings');
  });

  afterAll(async () => {
    if (!dbModule || !schema) return;
    const { inArray } = await import('drizzle-orm');
    if (userIds.length > 0) {
      await dbModule.db
        .delete(schema.userModelSettings)
        .where(inArray(schema.userModelSettings.userId, userIds));
    }
  });

  it('upsert creates a row with the full chain (REG-01/REG-02)', async () => {
    const userId = randomUUID();
    userIds.push(userId);

    await queries.upsertModelSettings({
      userId,
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbackModels: ['claude-haiku-4-5'],
      fallbackProviders: ['anthropic'],
    });

    const row = await queries.getModelSettingsForUser(userId);
    expect(row?.userId).toBe(userId);
    expect(row?.primaryModel).toBe('claude-sonnet-4-6');
    expect(row?.primaryProvider).toBe('anthropic');
    expect(row?.fallbackModels).toEqual(['claude-haiku-4-5']);
    expect(row?.fallbackProviders).toEqual(['anthropic']);
  });

  it('upsert overwrites the complete chain, never merges (REG-03 full-value)', async () => {
    const userId = randomUUID();
    userIds.push(userId);

    await queries.upsertModelSettings({
      userId,
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbackModels: ['claude-haiku-4-5'],
      fallbackProviders: ['anthropic'],
    });
    await queries.upsertModelSettings({
      userId,
      primaryModel: 'anthropic/claude-sonnet-4.6',
      primaryProvider: 'openrouter',
      fallbackModels: ['nousresearch/hermes-4-70b', 'big-pickle'],
      fallbackProviders: ['nousresearch', 'opencode'],
    });

    const row = await queries.getModelSettingsForUser(userId);
    expect(row?.primaryModel).toBe('anthropic/claude-sonnet-4.6');
    expect(row?.primaryProvider).toBe('openrouter');
    expect(row?.fallbackModels).toEqual(['nousresearch/hermes-4-70b', 'big-pickle']);
    expect(row?.fallbackProviders).toEqual(['nousresearch', 'opencode']);
  });

  it('concurrent upserts never half-merge (REG-03 atomicity, Pitfall 9)', async () => {
    const userId = randomUUID();
    userIds.push(userId);

    await Promise.all([
      queries.upsertModelSettings({
        userId,
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'anthropic',
        fallbackModels: ['claude-haiku-4-5'],
        fallbackProviders: ['anthropic'],
      }),
      queries.upsertModelSettings({
        userId,
        primaryModel: 'anthropic/claude-sonnet-4.6',
        primaryProvider: 'openrouter',
        fallbackModels: ['nousresearch/hermes-4-70b', 'big-pickle'],
        fallbackProviders: ['nousresearch', 'opencode'],
      }),
    ]);

    const row = await queries.getModelSettingsForUser(userId);
    expect(row?.userId).toBe(userId);
    // The final row must equal ONE complete chain, never a mix of both.
    const completeChains = [
      ['claude-sonnet-4-6', 'anthropic', ['claude-haiku-4-5'], ['anthropic']],
      [
        'anthropic/claude-sonnet-4.6',
        'openrouter',
        ['nousresearch/hermes-4-70b', 'big-pickle'],
        ['nousresearch', 'opencode'],
      ],
    ] as const;
    const matchesComplete = completeChains.some(
      ([primaryModel, primaryProvider, fallbackModels, fallbackProviders]) =>
        row?.primaryModel === primaryModel &&
        row?.primaryProvider === primaryProvider &&
        JSON.stringify(row?.fallbackModels) === JSON.stringify(fallbackModels) &&
        JSON.stringify(row?.fallbackProviders) === JSON.stringify(fallbackProviders),
    );
    expect(matchesComplete).toBe(true);
  });

  it('rejects fallback provider/model length mismatches at the write boundary', async () => {
    const userId = randomUUID();
    userIds.push(userId);

    await expect(
      queries.upsertModelSettings({
        userId,
        primaryModel: 'claude-sonnet-4-6',
        primaryProvider: 'anthropic',
        fallbackModels: ['claude-haiku-4-5'],
        fallbackProviders: [],
      }),
    ).rejects.toThrow('fallback provider/model length mismatch');
  });

  it('getModelSettingsForUser returns undefined for an unknown user (REG-05 absence)', async () => {
    expect(await queries.getModelSettingsForUser(randomUUID())).toBeUndefined();
  });
});
