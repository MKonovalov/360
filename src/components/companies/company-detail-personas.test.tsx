import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyDetailPersonas } from './company-detail-personas';

describe('CompanyDetailPersonas', () => {
  it('links each persona name to its profile page', () => {
    const personaRoles = [
      { persona: { id: 23, name: 'Nina Larsson' }, role: { title: 'CFO' } },
    ] as unknown as Parameters<typeof CompanyDetailPersonas>[0]['personaRoles'];

    const markup = renderToStaticMarkup(<CompanyDetailPersonas personaRoles={personaRoles} />);

    expect(markup).toContain('href="/personas/23"');
    expect(markup).toContain('Nina Larsson');
    expect(markup).toContain('CFO');
  });
});
