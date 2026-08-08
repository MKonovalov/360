import { config } from 'dotenv';
import { and, eq } from 'drizzle-orm';

import {
  STANDARD_EXECUTION_BUDGET,
  supportedEfforts,
} from '../lib/analysis/contracts';

config({ path: '.env.local' });

const SEEDED_BY = 'seed-script';
const INITIAL_VERSION = 1;

type TemplateSeed = {
  readonly key: string;
  readonly name: string;
  readonly targetType: 'company' | 'persona';
  readonly instruction: string;
};

type ConflictField =
  | 'name'
  | 'targetType'
  | 'status'
  | 'instruction'
  | 'supportedEfforts'
  | 'defaultEffort'
  | 'futureBudget';

const TEMPLATE_SEEDS = [
  {
    key: 'company-buying-signal-analysis',
    name: 'Company Buying Signal Analysis',
    targetType: 'company',
    instruction:
      'Assess the selected company against the snapshotted active GBS Company Signal checklist. Produce source-grounded findings for each applicable checklist item, clearly distinguish observed evidence from inference, and never invent evidence or perform writes.',
  },
  {
    key: 'persona-buying-signal-analysis',
    name: 'Persona Buying Signal Analysis',
    targetType: 'persona',
    instruction:
      'Assess the selected persona against the snapshotted active GBS Persona Signal checklist. Produce source-grounded findings for each applicable checklist item, clearly distinguish observed evidence from inference, and never invent evidence or perform writes.',
  },
] as const satisfies readonly TemplateSeed[];

export class AnalysisTemplateSeedConflictError extends Error {
  readonly name = 'AnalysisTemplateSeedConflictError';

  constructor(
    readonly templateKey: string,
    readonly field: ConflictField
  ) {
    super(`Analysis template seed conflict for key "${templateKey}" in field "${field}"`);
  }
}

class AnalysisTemplateSeedInsertError extends Error {
  readonly name = 'AnalysisTemplateSeedInsertError';

  constructor(readonly templateKey: string) {
    super(`Analysis template seed insert returned no row for key "${templateKey}"`);
  }
}

export async function seedAnalysisTemplates(): Promise<void> {
  const { db } = await import('../lib/db');
  const { analysisTemplate, analysisTemplateVersion } = await import('../lib/db/schema');
  const existingTemplateIds = new Map<string, number>();
  const existingVersionKeys = new Set<string>();

  for (const seed of TEMPLATE_SEEDS) {
    const [existingTemplate] = await db
      .select()
      .from(analysisTemplate)
      .where(eq(analysisTemplate.key, seed.key));

    if (!existingTemplate) continue;

    if (existingTemplate.name !== seed.name) {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'name');
    }
    if (existingTemplate.targetType !== seed.targetType) {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'targetType');
    }
    if (existingTemplate.status !== 'active') {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'status');
    }

    existingTemplateIds.set(seed.key, existingTemplate.id);
    const [existingVersion] = await db
      .select()
      .from(analysisTemplateVersion)
      .where(
        and(
          eq(analysisTemplateVersion.templateId, existingTemplate.id),
          eq(analysisTemplateVersion.version, INITIAL_VERSION)
        )
      );

    if (!existingVersion) continue;

    if (existingVersion.instruction !== seed.instruction) {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'instruction');
    }
    if (
      existingVersion.supportedEfforts.length !== supportedEfforts.length ||
      existingVersion.supportedEfforts.some(
        (effort, index) => effort !== supportedEfforts[index]
      )
    ) {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'supportedEfforts');
    }
    if (existingVersion.defaultEffort !== 'standard') {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'defaultEffort');
    }
    if (
      existingVersion.futureBudget.maxAttempts !== STANDARD_EXECUTION_BUDGET.maxAttempts ||
      existingVersion.futureBudget.maxToolCalls !== STANDARD_EXECUTION_BUDGET.maxToolCalls ||
      existingVersion.futureBudget.maxExecutionSeconds !==
        STANDARD_EXECUTION_BUDGET.maxExecutionSeconds ||
      existingVersion.futureBudget.maxSpendUsd !== STANDARD_EXECUTION_BUDGET.maxSpendUsd
    ) {
      throw new AnalysisTemplateSeedConflictError(seed.key, 'futureBudget');
    }

    existingVersionKeys.add(seed.key);
  }

  for (const seed of TEMPLATE_SEEDS) {
    let templateId = existingTemplateIds.get(seed.key);

    if (templateId === undefined) {
      const [insertedTemplate] = await db
        .insert(analysisTemplate)
        .values({
          key: seed.key,
          name: seed.name,
          targetType: seed.targetType,
          status: 'active',
          createdBy: SEEDED_BY,
          updatedBy: SEEDED_BY,
        })
        .returning({ id: analysisTemplate.id });

      if (!insertedTemplate) {
        throw new AnalysisTemplateSeedInsertError(seed.key);
      }
      templateId = insertedTemplate.id;
    }

    if (existingVersionKeys.has(seed.key)) continue;

    await db.insert(analysisTemplateVersion).values({
      templateId,
      version: INITIAL_VERSION,
      instruction: seed.instruction,
      supportedEfforts,
      defaultEffort: 'standard',
      futureBudget: STANDARD_EXECUTION_BUDGET,
      createdBy: SEEDED_BY,
    });
  }

  console.log('Seeded 2 active analysis templates with immutable version 1');
}

if (process.env.VITEST !== 'true') {
  seedAnalysisTemplates()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Analysis template seed failed');
      process.exit(1);
    });
}
