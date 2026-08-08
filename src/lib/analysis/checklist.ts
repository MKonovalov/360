import { listActiveCompanySignalsForPracticeArea } from '@/lib/db/queries/companySignals';
import { listActivePersonaSignalsForPracticeArea } from '@/lib/db/queries/personaSignals';
import { checklistSnapshotSchema, type AnalysisTargetType } from './contracts';

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

function assertNever(targetType: never): never {
  throw new TypeError(`Unexpected checklist target: ${String(targetType)}`);
}
