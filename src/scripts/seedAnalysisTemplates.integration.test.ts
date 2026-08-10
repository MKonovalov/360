import assert from 'node:assert/strict';

import { and, asc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for Phase 32 seed evidence');
}

describe('analysis template seed', () => {
  let dbModule: typeof import('@/lib/db');
  let schema: typeof import('@/lib/db/schema');
  let seedAnalysisTemplates: () => Promise<void>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();

    const seedModule = await import('./seedAnalysisTemplates');
    seedAnalysisTemplates = seedModule.seedAnalysisTemplates;
    dbModule = await import('@/lib/db');
    schema = await import('@/lib/db/schema');

    await seedAnalysisTemplates();
  });

  it('seeds exactly two active typed templates with immutable version 1 contracts', async () => {
    // Given: the seed has run against the live test database.
    // When: all active templates and all template versions are loaded.
    const templates = await dbModule.db
      .select()
      .from(schema.analysisTemplate)
      .where(eq(schema.analysisTemplate.status, 'active'))
      .orderBy(asc(schema.analysisTemplate.key));
    const versions = await dbModule.db
      .select()
      .from(schema.analysisTemplateVersion)
      .orderBy(asc(schema.analysisTemplateVersion.templateId));

    // Then: only the two locked natural keys and matching target types exist.
    expect(
      templates.map(({ key, targetType, createdBy, updatedBy }) => ({
        key,
        targetType,
        createdBy,
        updatedBy,
      }))
    ).toEqual([
      {
        key: 'company-buying-signal-analysis',
        targetType: 'company',
        createdBy: 'seed-script',
        updatedBy: 'seed-script',
      },
      {
        key: 'persona-buying-signal-analysis',
        targetType: 'persona',
        createdBy: 'seed-script',
        updatedBy: 'seed-script',
      },
    ]);
    expect(versions).toHaveLength(2);
    expect(
      versions.map(({ version, supportedEfforts, defaultEffort, futureBudget, createdBy }) => ({
        version,
        supportedEfforts,
        defaultEffort,
        futureBudget,
        createdBy,
      }))
    ).toEqual([
      {
        version: 1,
        supportedEfforts: ['standard'],
        defaultEffort: 'standard',
        futureBudget: {
          maxAttempts: 2,
          maxToolCalls: 12,
          maxExecutionSeconds: 300,
          maxSpendUsd: 2.5,
        },
        createdBy: 'seed-script',
      },
      {
        version: 1,
        supportedEfforts: ['standard'],
        defaultEffort: 'standard',
        futureBudget: {
          maxAttempts: 2,
          maxToolCalls: 12,
          maxExecutionSeconds: 300,
          maxSpendUsd: 2.5,
        },
        createdBy: 'seed-script',
      },
    ]);
  });

  it('preserves template and version identities and content on rerun', async () => {
    // Given: both templates and version rows already exist.
    const templatesBefore = await dbModule.db
      .select()
      .from(schema.analysisTemplate)
      .orderBy(asc(schema.analysisTemplate.key));
    const versionsBefore = await dbModule.db
      .select()
      .from(schema.analysisTemplateVersion)
      .orderBy(asc(schema.analysisTemplateVersion.templateId));

    // When: the seed is rerun.
    await seedAnalysisTemplates();

    // Then: no row or immutable field changes and no duplicate is added.
    const templatesAfter = await dbModule.db
      .select()
      .from(schema.analysisTemplate)
      .orderBy(asc(schema.analysisTemplate.key));
    const versionsAfter = await dbModule.db
      .select()
      .from(schema.analysisTemplateVersion)
      .orderBy(asc(schema.analysisTemplateVersion.templateId));
    expect(templatesAfter).toEqual(templatesBefore);
    expect(versionsAfter).toEqual(versionsBefore);
    expect(templatesAfter).toHaveLength(2);
    expect(versionsAfter).toHaveLength(2);
  });

  it('rejects conflicting immutable version content without overwriting it', async () => {
    // Given: an existing version has deliberately conflicting instruction content.
    const [companyTemplate] = await dbModule.db
      .select({ id: schema.analysisTemplate.id })
      .from(schema.analysisTemplate)
      .where(eq(schema.analysisTemplate.key, 'company-buying-signal-analysis'));
    assert.ok(companyTemplate);
    const [companyVersion] = await dbModule.db
      .select()
      .from(schema.analysisTemplateVersion)
      .where(
        and(
          eq(schema.analysisTemplateVersion.templateId, companyTemplate.id),
          eq(schema.analysisTemplateVersion.version, 1)
        )
      );
    assert.ok(companyVersion);
    const conflictingInstruction = `${companyVersion.instruction}\nIntegration-test conflict`;

    await dbModule.db
      .update(schema.analysisTemplateVersion)
      .set({ instruction: conflictingInstruction })
      .where(eq(schema.analysisTemplateVersion.id, companyVersion.id));

    try {
      // When: the seed resolves the same natural key and immutable version number.
      const rerun = seedAnalysisTemplates();

      // Then: it fails safely and leaves the conflicting row untouched.
      await expect(rerun).rejects.toMatchObject({
        name: 'AnalysisTemplateSeedConflictError',
        templateKey: 'company-buying-signal-analysis',
        field: 'instruction',
      });
      const [rowAfterConflict] = await dbModule.db
        .select({ instruction: schema.analysisTemplateVersion.instruction })
        .from(schema.analysisTemplateVersion)
        .where(eq(schema.analysisTemplateVersion.id, companyVersion.id));
      expect(rowAfterConflict?.instruction).toBe(conflictingInstruction);
    } finally {
      await dbModule.db
        .update(schema.analysisTemplateVersion)
        .set({ instruction: companyVersion.instruction })
        .where(eq(schema.analysisTemplateVersion.id, companyVersion.id));
    }
  });
});
