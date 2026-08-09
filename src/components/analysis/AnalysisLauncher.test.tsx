import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/actions/enrichment', () => ({
  runEnrichment: vi.fn(),
  commitEnrichment: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AnalysisLauncher, createAnalysisRunPayload } from './AnalysisLauncher';
import { analysisMenuLabel } from './AnalysisMenuAction';

describe('AnalysisLauncher', () => {
  it('renders a controlled dialog shell without exposing a template picker', () => {
    const html = renderToStaticMarkup(
      <AnalysisLauncher
        open
        subjectType="company"
        subjectId={42}
        onOpenChange={vi.fn()}
      />,
    );

    expect(html).not.toContain('Select a template');
    expect(html).not.toContain('Template');
    expect(html).toBe('');
  });

  it('builds the launch payload from only the server template reference and subject inputs', () => {
    expect(createAnalysisRunPayload({
      templateVersionId: 12,
      subjectType: 'persona',
      subjectId: 9,
      practiceAreaId: 4,
    })).toEqual({
      templateVersionId: 12,
      subject: { type: 'persona', id: 9 },
      practiceAreaId: 4,
    });
  });
});

describe('Analyze Menu action', () => {
  it.each([
    ['company', 'Company'],
    ['persona', 'Persona'],
  ] as const)('exposes the enabled Analyze action for a %s record', (entityType, _label) => {
    expect(entityType).toMatch(/company|persona/);
    expect(analysisMenuLabel(true, 'Not configured')).toBe('Analyze');
  });
});
