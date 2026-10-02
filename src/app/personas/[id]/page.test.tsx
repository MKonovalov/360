import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireStaffAccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/components/personas/persona-detail', () => ({
  PersonaDetail: ({ id, tab }: { readonly id: number; readonly tab: string }) => (
    <div data-persona-id={id} data-persona-tab={tab} />
  ),
}));

import PersonaDetailPage from './page';

describe('/personas/[id] route tab mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('passes the id and normalized tab to the detail', async () => {
    const element = await PersonaDetailPage({
      params: Promise.resolve({ id: '23' }),
      searchParams: Promise.resolve({ tab: 'analysis' }),
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('data-persona-id="23"');
    expect(markup).toContain('data-persona-tab="analysis"');
  });

  it('defaults unknown tabs to general', async () => {
    const element = await PersonaDetailPage({
      params: Promise.resolve({ id: '23' }),
      searchParams: Promise.resolve({ tab: 'personas' }),
    });

    expect(renderToStaticMarkup(element)).toContain('data-persona-tab="general"');
  });

  it.each(['abc', '0'])('rejects malformed id %s through notFound', async (id) => {
    await expect(
      PersonaDetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
