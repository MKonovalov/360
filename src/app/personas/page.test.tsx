import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listDistinctCurrentCompanyNames: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/personas', () => ({ listDistinctCurrentCompanyNames: mocks.listDistinctCurrentCompanyNames }));
vi.mock('@/components/personas/persona-list', () => ({
  PersonaList: ({ selectedId }: { readonly selectedId: number | undefined }) => (
    <div data-persona-selected-id={selectedId ?? ''} />
  ),
}));
vi.mock('@/components/personas/persona-search-input', () => ({ PersonaSearchInput: () => null }));
vi.mock('@/components/personas/persona-filters', () => ({ PersonaFilters: () => null }));
vi.mock('@/components/explorer/explorer-menu', () => ({ ExplorerMenu: () => null }));

import PersonasPage from './page';

describe('/personas selection compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.listDistinctCurrentCompanyNames.mockResolvedValue([{ name: 'Acme Corporation' }]);
  });

  it('preserves the first selected persona id from the legacy query shape', async () => {
    const element = await PersonasPage({
      searchParams: Promise.resolve({ selected: ['7', '8'], hasSignals: 'false' }),
    });

    expect(renderToStaticMarkup(element)).toContain('data-persona-selected-id="7"');
  });

  it('keeps an absent selection absent', async () => {
    const element = await PersonasPage({ searchParams: Promise.resolve({}) });

    expect(renderToStaticMarkup(element)).toContain('data-persona-selected-id=""');
  });
});
