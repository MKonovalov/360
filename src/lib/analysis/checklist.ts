import {
  listActiveCompanySignalsForPracticeArea,
  listActiveCompanySignalsForPracticeAreaAndCategory,
} from '@/lib/db/queries/companySignals';
import {
  listActivePersonaSignalsForPracticeArea,
  listActivePersonaSignalsForPracticeAreaAndCategory,
} from '@/lib/db/queries/personaSignals';
import { checklistSnapshotSchema, checklistSnapshotV2Schema, type AnalysisTargetType } from './contracts';

export type ChecklistPracticeArea = {
  readonly id: number;
  readonly name: string;
};

export async function deriveActiveChecklist(
  targetType: AnalysisTargetType,
  practiceArea: ChecklistPracticeArea,
) {
  switch (targetType) {
    case 'company': {
      const signals = await listActiveCompanySignalsForPracticeArea(practiceArea.id);
      return checklistSnapshotSchema.parse({
        schemaVersion: 1,
        targetType,
        practiceAreaId: practiceArea.id,
        practiceAreaName: practiceArea.name,
        items: signals
          .map((signal) => ({
            signalId: signal.id,
            status: 'active' as const,
            name: signal.name,
            category: signal.category,
            description: signal.description,
          }))
          .sort((left, right) => left.signalId - right.signalId),
      });
    }
    case 'persona': {
      const signals = await listActivePersonaSignalsForPracticeArea(practiceArea.id);
      return checklistSnapshotSchema.parse({
        schemaVersion: 1,
        targetType,
        practiceAreaId: practiceArea.id,
        practiceAreaName: practiceArea.name,
        items: signals
          .map((signal) => ({
            signalId: signal.id,
            status: 'active' as const,
            name: signal.name,
            category: signal.category,
            description: signal.description,
            buyerRoleId: signal.buyerRoleId,
          }))
          .sort((left, right) => left.signalId - right.signalId),
      });
    }
    default:
      return assertNever(targetType);
  }
}

// Category-scoped counterpart to deriveActiveChecklist: the caller supplies
// only (targetType, practiceArea, selectedCategory) -- never signal ids --
// and the *AndCategory queries are the sole server-side source that resolves
// that pair into signal rows, so every signalId in the resulting v2 snapshot
// is server-derived, the same guarantee deriveActiveChecklist gives for v1.
export async function deriveActiveChecklistForCategory(
  targetType: AnalysisTargetType,
  practiceArea: ChecklistPracticeArea,
  selectedCategory: string,
) {
  switch (targetType) {
    case 'company': {
      const signals = await listActiveCompanySignalsForPracticeAreaAndCategory(practiceArea.id, selectedCategory);
      return checklistSnapshotV2Schema.parse({
        schemaVersion: 2,
        targetType,
        practiceAreaId: practiceArea.id,
        practiceAreaName: practiceArea.name,
        selectedCategory,
        items: signals
          .map((signal) => ({
            signalId: signal.id,
            status: 'active' as const,
            name: signal.name,
            category: signal.category,
            description: signal.description,
          }))
          .sort((left, right) => left.signalId - right.signalId),
      });
    }
    case 'persona': {
      const signals = await listActivePersonaSignalsForPracticeAreaAndCategory(practiceArea.id, selectedCategory);
      return checklistSnapshotV2Schema.parse({
        schemaVersion: 2,
        targetType,
        practiceAreaId: practiceArea.id,
        practiceAreaName: practiceArea.name,
        selectedCategory,
        items: signals
          .map((signal) => ({
            signalId: signal.id,
            status: 'active' as const,
            name: signal.name,
            category: signal.category,
            description: signal.description,
            buyerRoleId: signal.buyerRoleId,
          }))
          .sort((left, right) => left.signalId - right.signalId),
      });
    }
    default:
      return assertNever(targetType);
  }
}

function assertNever(targetType: never): never {
  throw new TypeError(`Unexpected checklist target: ${String(targetType)}`);
}
