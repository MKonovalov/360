import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireDebugAdminAccess: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/lib/auth/requireDebugAdminAccess', () => ({
  requireDebugAdminAccess: mocks.requireDebugAdminAccess,
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/components/layout/app-shell-layout', () => ({
  AppShellLayout: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/reviews/debug-analysis-run', () => ({
  DebugAnalysisRun: ({ applicationRunId }: { readonly applicationRunId: number }) => (
    <div>debug run {applicationRunId}</div>
  ),
}));

import DebugAnalysisRunPage from './page';

describe('/reviews/debug/[id]', () => {
  it('authorizes before reading route params', async () => {
    let paramsRead = false;
    mocks.requireDebugAdminAccess.mockRejectedValue(new Error('NEXT_NOT_FOUND'));

    const context = {
      get params(): Promise<{ readonly id: string }> {
        paramsRead = true;
        return Promise.resolve({ id: '39' });
      },
    };

    await expect(DebugAnalysisRunPage(context)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(paramsRead).toBe(false);
  });

  it('returns a 404-safe page for malformed ids after debug authorization', async () => {
    mocks.requireDebugAdminAccess.mockResolvedValue({ userId: 'user_debug' });
    mocks.notFound.mockImplementation(() => { throw new Error('NEXT_NOT_FOUND'); });

    await expect(DebugAnalysisRunPage({ params: Promise.resolve({ id: 'not-a-number' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('renders only the dedicated debug surface for an authorized id', async () => {
    mocks.requireDebugAdminAccess.mockResolvedValue({ userId: 'user_debug' });

    const html = renderToStaticMarkup(
      await DebugAnalysisRunPage({ params: Promise.resolve({ id: '39' }) }),
    );

    expect(html).toContain('debug run 39');
    expect(html).not.toContain('rawAudit');
  });
});
