import { z } from 'zod';

import { getAnalysisTemplateVersion } from '@/lib/db/queries/analysisTemplates';
import { getCompanyById } from '@/lib/db/queries/companies';
import { getPersonaById } from '@/lib/db/queries/personas';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';
import { executionTargetSchema, type ExecutorValidationReason } from './executionTarget';
import {
  analysisSubjectSchema,
  type AnalysisSubject,
  type AnalysisTargetType,
} from './contracts';

export const analysisResolutionReasons = [
  'invalid_input',
  'template_not_active',
  'template_version_not_current',
  'template_version_not_found',
  'subject_type_mismatch',
  'subject_not_found',
  'practice_area_required',
  'practice_area_not_found',
] as const;

export type AnalysisResolutionReason = (typeof analysisResolutionReasons)[number];

type Resolution<T> =
  | { readonly ok: true; readonly value: Readonly<T> }
  | { readonly ok: false; readonly reason: AnalysisResolutionReason | ExecutorValidationReason };

export type ResolvedAnalysisSubject =
  | { readonly type: 'company'; readonly id: number; readonly displayName: string }
  | { readonly type: 'persona'; readonly id: number; readonly displayName: string };

export type ResolvedPracticeArea = {
  readonly id: number;
  readonly name: string;
  readonly shortCode: string;
};

const positiveIdSchema = z.number().int().positive();

export async function resolveAnalysisSubject(
  input: unknown,
  templateTargetType: AnalysisTargetType,
): Promise<Resolution<ResolvedAnalysisSubject>> {
  const parsed = analysisSubjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  if (parsed.data.type !== templateTargetType) {
    return { ok: false, reason: 'subject_type_mismatch' };
  }

  switch (parsed.data.type) {
    case 'company': {
      const company = await getCompanyById(parsed.data.id);
      if (!company) return { ok: false, reason: 'subject_not_found' };
      return {
        ok: true,
        value: { type: 'company', id: company.id, displayName: company.name },
      };
    }
    case 'persona': {
      const persona = await getPersonaById(parsed.data.id);
      if (!persona) return { ok: false, reason: 'subject_not_found' };
      return {
        ok: true,
        value: { type: 'persona', id: persona.id, displayName: persona.name },
      };
    }
    default:
      return assertNeverSubject(parsed.data);
  }
}

export async function resolveAnalysisTemplateVersion(input: unknown) {
  const parsed = positiveIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' } as const;

  const version = await getAnalysisTemplateVersion(parsed.data);
  if (!version) return { ok: false, reason: 'template_version_not_found' } as const;
  if (version.status !== 'active') {
    return { ok: false, reason: 'template_not_active' } as const;
  }
  if (!version.isCurrent) {
    return { ok: false, reason: 'template_version_not_current' } as const;
  }
  if (!executionTargetSchema.safeParse(version.executor).success) {
    return { ok: false, reason: 'invalid_executor_configuration' } as const;
  }
  return { ok: true, value: version } as const;
}

export async function resolveActivePracticeArea(
  input: unknown,
): Promise<Resolution<ResolvedPracticeArea>> {
  if (input === undefined || input === null) {
    return { ok: false, reason: 'practice_area_required' };
  }

  const parsed = positiveIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };

  const practiceAreas = await listActivePracticeAreas();
  const practiceArea = practiceAreas.find((candidate) => candidate.id === parsed.data);
  if (!practiceArea) return { ok: false, reason: 'practice_area_not_found' };

  return {
    ok: true,
    value: {
      id: practiceArea.id,
      name: practiceArea.name,
      shortCode: practiceArea.shortCode,
    },
  };
}

function assertNeverSubject(subject: never): never {
  throw new AnalysisSubjectInvariantError(subject);
}

class AnalysisSubjectInvariantError extends Error {
  readonly name = 'AnalysisSubjectInvariantError';

  constructor(readonly subject: AnalysisSubject) {
    super(`Unexpected analysis subject type: ${subject.type}`);
  }
}
