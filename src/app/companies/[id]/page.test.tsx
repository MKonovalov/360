import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireStaffAccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/components/companies/company-detail', () => ({
  CompanyDetail: ({ id, tab }: { readonly id: number; readonly tab: string }) => (
    <div data-company-id={id} data-company-tab={tab} />
  ),
}));

import CompanyDetailPage from './page';

describe('/companies/[id] route tab mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  it('passes the normalized URL tab to one detail route', async () => {
    const element = await CompanyDetailPage({
      params: Promise.resolve({ id: '42' }),
      searchParams: Promise.resolve({ tab: 'analysis' }),
    });

    expect(renderToStaticMarkup(element)).toContain('data-company-tab="analysis"');
    expect(renderToStaticMarkup(element)).toContain('data-company-id="42"');
  });

  it('defaults unknown URL tabs to General', async () => {
    const element = await CompanyDetailPage({
      params: Promise.resolve({ id: '42' }),
      searchParams: Promise.resolve({ tab: 'unknown' }),
    });

    expect(renderToStaticMarkup(element)).toContain('data-company-tab="general"');
  });

  it.each(['abc', '0'])('rejects malformed record ids %s through notFound', async (id) => {
    await expect(
      CompanyDetailPage({
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('accepts 2147483647 as a valid positive id and leaves missing-record handling to CompanyDetail', async () => {
    const element = await CompanyDetailPage({
      params: Promise.resolve({ id: '2147483647' }),
      searchParams: Promise.resolve({}),
    });

    expect(renderToStaticMarkup(element)).toContain('data-company-id="2147483647"');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('checks staff access before parsing or rendering the record', async () => {
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error('NEXT_REDIRECT: /sign-in'));

    await expect(
      CompanyDetailPage({
        params: Promise.resolve({ id: '42' }),
        searchParams: Promise.resolve({ tab: 'analysis' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT: /sign-in');

    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
