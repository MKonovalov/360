import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const defaultConfig = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8');
const integrationConfig = readFileSync(resolve(root, 'vitest.integration.config.ts'), 'utf8');
const liveProviderConfig = readFileSync(resolve(root, 'vitest.live-provider.config.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  readonly scripts?: Record<string, string>;
};

const databaseIntegrationFiles = [
  'src/lib/db/analysisSchema.integration.test.ts',
  'src/lib/db/analysisResultsSchema.integration.test.ts',
  'src/lib/db/reviewSchema.integration.test.ts',
  'src/lib/db/queries/analysisReviews.integration.test.ts',
  'src/lib/db/queries/analysisTemplates.integration.test.ts',
  'src/lib/db/queries/analysisRuns.integration.test.ts',
  'src/lib/db/queries/analysisResults.integration.test.ts',
  'src/lib/db/queries/confirmedCandidates.integration.test.ts',
  'src/lib/db/queries/personaSignals.integration.test.ts',
  'src/lib/db/queries/companySignals.integration.test.ts',
  'src/lib/db/queries/buyerRoles.integration.test.ts',
  'src/lib/db/queries/signalOfferingLinks.integration.test.ts',
  'src/lib/db/queries/offerings.integration.test.ts',
  'src/lib/db/queries/practiceAreas.integration.test.ts',
  'src/lib/db/queries/domains.integration.test.ts',
  'src/lib/db/queries/enrichment.integration.test.ts',
  'src/lib/db/queries/organizationDataSourceSettings.integration.test.ts',
  'src/lib/db/queries/userModelSettings.integration.test.ts',
  'src/lib/verification/phase36Adversarial.integration.test.ts',
  'src/lib/verification/phase36FixtureReset.integration.test.ts',
  'src/lib/verification/phase39Adversarial.integration.test.ts',
];

const workflowFiles = [
  'src/workflows/analysisRun.integration.test.ts',
  'src/workflows/workflowProof.integration.test.ts',
];

const liveProviderFiles = [
  'src/lib/agents/structured-outputs-probe.test.ts',
  'src/lib/agents/openrouter-only-chain.test.ts',
  'src/lib/agents/opencode-only-chain.test.ts',
  'src/lib/agents/nousresearch-only-chain.test.ts',
];

describe('Vitest verification lanes', () => {
  it('keeps prerequisite-gated inventories disjoint', () => {
    const inventories = [databaseIntegrationFiles, workflowFiles, liveProviderFiles];
    const allFiles = inventories.flat();

    expect(new Set(allFiles).size).toBe(allFiles.length);
    expect(new Set(allFiles).size).toBe(
      databaseIntegrationFiles.length + workflowFiles.length + liveProviderFiles.length,
    );
  });

  it('excludes integration and live-provider suites from the default lane', () => {
    expect(defaultConfig).toContain('...configDefaults.exclude');
    expect(defaultConfig).toContain("'**/*.integration.test.ts'");
    expect(defaultConfig).toContain("setupFiles: ['./vitest.setup.ts']");
    expect(defaultConfig).toContain("'src/lib/agents/structured-outputs-probe.test.ts'");
    expect(defaultConfig).toContain("'src/lib/agents/openrouter-only-chain.test.ts'");
    expect(defaultConfig).toContain("'src/lib/agents/opencode-only-chain.test.ts'");
    expect(defaultConfig).toContain("'src/lib/agents/nousresearch-only-chain.test.ts'");
  });

  it('assigns every prerequisite-gated suite to an explicit config', () => {
    expect(integrationConfig).toContain("include: ['src/**/*.integration.test.ts']");
    expect(integrationConfig).toContain("'src/workflows/**/*.integration.test.ts'");
    expect(integrationConfig).toContain("'src/scripts/seedGbs.integration.test.ts'");
    expect(databaseIntegrationFiles.every((file) => file.endsWith('.integration.test.ts'))).toBe(true);
    expect(workflowFiles.every((file) => file.includes('/workflows/'))).toBe(true);
    for (const file of liveProviderFiles) expect(liveProviderConfig).toContain(file);
    expect(packageJson.scripts?.['test:integration:db']).toBeDefined();
    expect(packageJson.scripts?.['test:live:providers']).toBeDefined();
    expect(packageJson.scripts?.['test:workflow']).toContain('vitest run --config vitest.workflow.config.ts');
    expect(packageJson.scripts?.['test:integration:analysis-reviews']).toContain('vitest run --config vitest.analysis-reviews.config.ts');
  });
});
