import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checklistSnapshotSchema, type AnalysisTargetType } from './contracts';

const mocks = vi.hoisted(() => ({
  listActiveCompanySignalsForPracticeArea: vi.fn(),
  listActiveCompanySignalsForPracticeAreaAndCategory: vi.fn(),
  listActivePersonaSignalsForPracticeArea: vi.fn(),
  listActivePersonaSignalsForPracticeAreaAndCategory: vi.fn(),
}));

vi.mock('@/lib/db/queries/companySignals', () => ({
  listActiveCompanySignalsForPracticeArea: mocks.listActiveCompanySignalsForPracticeArea,
  listActiveCompanySignalsForPracticeAreaAndCategory: mocks.listActiveCompanySignalsForPracticeAreaAndCategory,
}));

vi.mock('@/lib/db/queries/personaSignals', () => ({
  listActivePersonaSignalsForPracticeArea: mocks.listActivePersonaSignalsForPracticeArea,
  listActivePersonaSignalsForPracticeAreaAndCategory: mocks.listActivePersonaSignalsForPracticeAreaAndCategory,
}));

import { deriveActiveChecklist, deriveActiveChecklistForCategory } from './checklist';

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

describe('deriveActiveChecklistForCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only ordered active Company signals matching the selected GBS-state category', async () => {
    // Given
    const rows = [
      { id: 8, name: 'GBS recently stood up', category: 'GBS-state', description: 'A GBS org stood up in the last year.' },
      { id: 3, name: 'No GBS/SSC exists', category: 'GBS-state', description: 'No shared services org exists yet.' },
    ];
    mocks.listActiveCompanySignalsForPracticeAreaAndCategory.mockResolvedValue(rows);

    // When
    const checklist = await deriveActiveChecklistForCategory('company', practiceArea, 'GBS-state');

    // Then
    expect(checklist).toEqual({
      schemaVersion: 2,
      targetType: 'company',
      practiceAreaId: 7,
      practiceAreaName: 'GBS',
      selectedCategory: 'GBS-state',
      items: [
        { signalId: 3, status: 'active', name: 'No GBS/SSC exists', category: 'GBS-state', description: 'No shared services org exists yet.' },
        { signalId: 8, status: 'active', name: 'GBS recently stood up', category: 'GBS-state', description: 'A GBS org stood up in the last year.' },
      ],
    });
    // Identity: each item's signalId is exactly the id the server-side query
    // returned -- never a client-invented or re-derived id.
    expect(checklist.items.map((item) => item.signalId)).toEqual(rows.map((row) => row.id).sort((a, b) => a - b));
    expect(mocks.listActiveCompanySignalsForPracticeAreaAndCategory).toHaveBeenCalledOnce();
    expect(mocks.listActiveCompanySignalsForPracticeAreaAndCategory).toHaveBeenCalledWith(7, 'GBS-state');
    expect(mocks.listActivePersonaSignalsForPracticeAreaAndCategory).not.toHaveBeenCalled();
    expect(checklistSnapshotSchema.safeParse(checklist).success).toBe(true);
  });

  it('returns only ordered active Persona signals matching the selected GBS-state category, with buyer-role identity', async () => {
    // Given
    const rows = [
      { id: 12, buyerRoleId: 5, name: 'GBS leader recently hired', category: 'GBS-state', description: 'A new GBS leader joined this year.' },
      { id: 7, buyerRoleId: 2, name: 'No GBS leader in role', category: 'GBS-state', description: 'No dedicated GBS leader exists yet.' },
    ];
    mocks.listActivePersonaSignalsForPracticeAreaAndCategory.mockResolvedValue(rows);

    // When
    const checklist = await deriveActiveChecklistForCategory('persona', practiceArea, 'GBS-state');

    // Then
    expect(checklist).toEqual({
      schemaVersion: 2,
      targetType: 'persona',
      practiceAreaId: 7,
      practiceAreaName: 'GBS',
      selectedCategory: 'GBS-state',
      items: [
        { signalId: 7, status: 'active', name: 'No GBS leader in role', category: 'GBS-state', description: 'No dedicated GBS leader exists yet.', buyerRoleId: 2 },
        { signalId: 12, status: 'active', name: 'GBS leader recently hired', category: 'GBS-state', description: 'A new GBS leader joined this year.', buyerRoleId: 5 },
      ],
    });
    expect(checklist.items.map((item) => item.signalId)).toEqual(rows.map((row) => row.id).sort((a, b) => a - b));
    expect(mocks.listActivePersonaSignalsForPracticeAreaAndCategory).toHaveBeenCalledOnce();
    expect(mocks.listActivePersonaSignalsForPracticeAreaAndCategory).toHaveBeenCalledWith(7, 'GBS-state');
    expect(mocks.listActiveCompanySignalsForPracticeAreaAndCategory).not.toHaveBeenCalled();
    expect(checklistSnapshotSchema.safeParse(checklist).success).toBe(true);
  });

  it.each<AnalysisTargetType>(['company', 'persona'])(
    'throws rather than persisting an empty %s category checklist when the server finds no matches',
    async (targetType) => {
      // Given
      mocks.listActiveCompanySignalsForPracticeAreaAndCategory.mockResolvedValue([]);
      mocks.listActivePersonaSignalsForPracticeAreaAndCategory.mockResolvedValue([]);

      // When / Then
      await expect(deriveActiveChecklistForCategory(targetType, practiceArea, 'GBS-state')).rejects.toThrow();
    },
  );
});
