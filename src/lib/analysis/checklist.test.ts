import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checklistSnapshotSchema, type AnalysisTargetType } from './contracts';

const mocks = vi.hoisted(() => ({
  listActiveCompanySignalsForPracticeArea: vi.fn(),
  listActivePersonaSignalsForPracticeArea: vi.fn(),
}));

vi.mock('@/lib/db/queries/companySignals', () => ({
  listActiveCompanySignalsForPracticeArea: mocks.listActiveCompanySignalsForPracticeArea,
}));

vi.mock('@/lib/db/queries/personaSignals', () => ({
  listActivePersonaSignalsForPracticeArea: mocks.listActivePersonaSignalsForPracticeArea,
}));

import { deriveActiveChecklist } from './checklist';

const practiceArea = { id: 7, name: 'GBS' } as const;

describe('deriveActiveChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only ordered active Company signals for the required Practice Area', async () => {
    // Given
    const rows = [
      { id: 8, practiceAreaId: 7, name: 'Transformation mandate', category: 'leadership', description: 'A new mandate.', status: 'active' },
      { id: 2, practiceAreaId: 7, name: 'Draft signal', category: 'draft', description: 'Not active.', status: 'draft' },
      { id: 4, practiceAreaId: 7, name: 'Retired signal', category: 'retired', description: 'No longer active.', status: 'retired' },
      { id: 1, practiceAreaId: 9, name: 'Wrong area', category: 'financial', description: 'Different Practice Area.', status: 'active' },
      { id: 3, practiceAreaId: 7, name: 'Cost pressure', category: 'financial', description: 'Margin pressure is increasing.', status: 'active' },
    ];
    mocks.listActiveCompanySignalsForPracticeArea.mockImplementation(async (practiceAreaId: number) =>
      rows.filter((row) => row.practiceAreaId === practiceAreaId && row.status === 'active'),
    );

    // When
    const checklist = await deriveActiveChecklist('company', practiceArea);

    // Then
    expect(checklist).toEqual({
      schemaVersion: 1,
      targetType: 'company',
      practiceAreaId: 7,
      practiceAreaName: 'GBS',
      items: [
        { signalId: 3, status: 'active', name: 'Cost pressure', category: 'financial', description: 'Margin pressure is increasing.' },
        { signalId: 8, status: 'active', name: 'Transformation mandate', category: 'leadership', description: 'A new mandate.' },
      ],
    });
    expect(mocks.listActiveCompanySignalsForPracticeArea).toHaveBeenCalledOnce();
    expect(mocks.listActiveCompanySignalsForPracticeArea).toHaveBeenCalledWith(7);
    expect(mocks.listActivePersonaSignalsForPracticeArea).not.toHaveBeenCalled();
    expect(checklistSnapshotSchema.safeParse(checklist).success).toBe(true);
  });

  it('returns only ordered active Persona signals with buyer-role identity', async () => {
    // Given
    const rows = [
      { id: 12, practiceAreaId: 7, buyerRoleId: 5, name: 'CFO mandate', category: 'tenure', description: 'A new CFO starts a review.', status: 'active' },
      { id: 10, practiceAreaId: 7, buyerRoleId: 3, name: 'Draft role signal', category: 'draft', description: 'Not active.', status: 'draft' },
      { id: 9, practiceAreaId: 8, buyerRoleId: 4, name: 'Wrong area', category: 'engagement', description: 'Different Practice Area.', status: 'active' },
      { id: 7, practiceAreaId: 7, buyerRoleId: 2, name: 'GBS leader hired', category: 'hiring', description: 'A new GBS leader joins.', status: 'active' },
    ];
    mocks.listActivePersonaSignalsForPracticeArea.mockImplementation(async (practiceAreaId: number) =>
      rows.filter((row) => row.practiceAreaId === practiceAreaId && row.status === 'active'),
    );

    // When
    const checklist = await deriveActiveChecklist('persona', practiceArea);

    // Then
    expect(checklist).toEqual({
      schemaVersion: 1,
      targetType: 'persona',
      practiceAreaId: 7,
      practiceAreaName: 'GBS',
      items: [
        { signalId: 7, status: 'active', name: 'GBS leader hired', category: 'hiring', description: 'A new GBS leader joins.', buyerRoleId: 2 },
        { signalId: 12, status: 'active', name: 'CFO mandate', category: 'tenure', description: 'A new CFO starts a review.', buyerRoleId: 5 },
      ],
    });
    expect(mocks.listActivePersonaSignalsForPracticeArea).toHaveBeenCalledOnce();
    expect(mocks.listActivePersonaSignalsForPracticeArea).toHaveBeenCalledWith(7);
    expect(mocks.listActiveCompanySignalsForPracticeArea).not.toHaveBeenCalled();
    expect(checklistSnapshotSchema.safeParse(checklist).success).toBe(true);
  });

  it.each<AnalysisTargetType>(['company', 'persona'])(
    'returns a valid empty %s checklist when the active query has no matches',
    async (targetType) => {
      // Given
      mocks.listActiveCompanySignalsForPracticeArea.mockResolvedValue([]);
      mocks.listActivePersonaSignalsForPracticeArea.mockResolvedValue([]);

      // When
      const checklist = await deriveActiveChecklist(targetType, practiceArea);

      // Then
      expect(checklist.items).toEqual([]);
      expect(checklist.targetType).toBe(targetType);
      expect(checklistSnapshotSchema.safeParse(checklist).success).toBe(true);
      expect(mocks.listActiveCompanySignalsForPracticeArea).toHaveBeenCalledTimes(targetType === 'company' ? 1 : 0);
      expect(mocks.listActivePersonaSignalsForPracticeArea).toHaveBeenCalledTimes(targetType === 'persona' ? 1 : 0);
    },
  );
});
