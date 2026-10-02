import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireStaffAccess: vi.fn(),
  listDistinctCurrentCompanyNames: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/personas', () => ({ listDistinctCurrentCompanyNames: mocks.listDistinctCurrentCompanyNames }));
vi.mock('@/components/personas/persona-list', () => ({ PersonaList: () => <div data-persona-list="true" /> }));
vi.mock('@/components/personas/persona-search-input', () => ({ PersonaSearchInput: () => null }));
vi.mock('@/components/personas/persona-filters', () => ({ PersonaFilters: () => null }));
vi.mock('@/components/explorer/explorer-menu', () => ({ ExplorerMenu: () => null }));

import PersonasPage from './page';

describe('/personas legacy selection redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.listDistinctCurrentCompanyNames.mockResolvedValue([{ name: 'Acme Corporation' }]);
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it('redirects the legacy ?selected= shape to the detail route', async () => {
    await expect(
      PersonasPage({ searchParams: Promise.resolve({ selected: ['7', '8'], hasSignals: 'false' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/personas/7');
  });

  it('renders the list when nothing is selected', async () => {
    const element = await PersonasPage({ searchParams: Promise.resolve({}) });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(element)).toContain('data-persona-list="true"');
  });
});
