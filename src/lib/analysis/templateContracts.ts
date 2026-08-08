import { z } from 'zod';

import {
  analysisTargetTypes,
  STANDARD_EXECUTION_BUDGET,
  supportedEfforts,
} from './contracts';
import type { AnalysisEffort, AnalysisTargetType } from './contracts';

export const FIXED_ANALYSIS_TEMPLATES = [
  {
    key: 'company-buying-signal-analysis',
    name: 'Company Buying Signal Analysis',
    targetType: 'company',
  },
  {
    key: 'persona-buying-signal-analysis',
    name: 'Persona Buying Signal Analysis',
    targetType: 'persona',
  },
] as const satisfies readonly {
  readonly key: string;
  readonly name: string;
  readonly targetType: AnalysisTargetType;
}[];

export type FixedAnalysisTemplate = (typeof FIXED_ANALYSIS_TEMPLATES)[number];
export type FixedAnalysisTemplateKey = FixedAnalysisTemplate['key'];

const templateKeySchema = z.enum([
  'company-buying-signal-analysis',
  'persona-buying-signal-analysis',
]);
const templateEffortSchema = z.enum(supportedEfforts);
const templateTargetTypeSchema = z.enum(analysisTargetTypes);

const contentInputSchema = z
  .object({
    operation: z.literal('content'),
    templateKey: templateKeySchema,
    instruction: z.string().trim().min(1).max(20_000),
    defaultEffort: templateEffortSchema,
  })
  .strict();

const lifecycleInputSchema = z
  .object({
    operation: z.literal('lifecycle'),
    templateKey: templateKeySchema,
    status: z.enum(['active', 'retired']),
  })
  .strict();

export const templateManagementInputSchema = z.discriminatedUnion('operation', [
  contentInputSchema,
  lifecycleInputSchema,
]);

export type TemplateManagementInput = z.infer<typeof templateManagementInputSchema>;

export type TemplateVersionRead = {
  readonly templateVersionId: number;
  readonly version: number;
  readonly instruction: string;
  readonly supportedEfforts: readonly AnalysisEffort[];
  readonly defaultEffort: AnalysisEffort;
  readonly futureBudget: typeof STANDARD_EXECUTION_BUDGET;
  readonly createdBy: string;
  readonly createdAt: string;
};

export type ManagedAnalysisTemplateRead = {
  readonly templateId: number;
  readonly key: FixedAnalysisTemplateKey;
  readonly name: FixedAnalysisTemplate['name'];
  readonly targetType: AnalysisTargetType;
  readonly status: 'active' | 'retired';
  readonly latest: TemplateVersionRead;
  readonly history: readonly TemplateVersionRead[];
};

export type TemplateManagementResult =
  | {
      readonly ok: true;
      readonly kind: 'version_appended';
      readonly template: ManagedAnalysisTemplateRead;
    }
  | {
      readonly ok: true;
      readonly kind: 'no_op' | 'lifecycle_updated';
      readonly template: ManagedAnalysisTemplateRead;
    }
  | {
      readonly ok: false;
      readonly reason: 'conflict' | 'not_found';
    };
