import { describe, expect, it } from 'vitest';

import { renderSearchInstructions } from './renderSearchInstructions';

const TEMPLATE = [
  'Target company: <company.name> (<company.domain>).',
  '```json',
  '{ "id": "<company.id>", "name": "<company.name>", "domain": "<company.domain>" }',
  '```',
].join('\n');

describe('renderSearchInstructions', () => {
  it('substitutes every company token from the snapshot', () => {
    const out = renderSearchInstructions(TEMPLATE, { id: 117, name: 'Cinkarna Celje', domain: 'cinkarna.si' });
    expect(out).toContain('Target company: Cinkarna Celje (cinkarna.si).');
    expect(out).toContain('{ "id": "117", "name": "Cinkarna Celje", "domain": "cinkarna.si" }');
    expect(out).not.toMatch(/<company\./u);
  });

  it('JSON-escapes quotes and backslashes so the embedded JSON stays valid', () => {
    const out = renderSearchInstructions('{ "name": "<company.name>" }', { id: 1, name: 'A "B" \\ C', domain: null });
    expect(JSON.parse(out ?? '')).toEqual({ name: 'A "B" \\ C' });
  });

  it('renders a null domain as JSON null in JSON blocks and "unknown" in prose', () => {
    const out = renderSearchInstructions(TEMPLATE, { id: 5, name: 'Acme', domain: null });
    expect(out).toContain('"domain": null');
    expect(out).toContain('Target company: Acme (unknown).');
  });

  it('fails closed when an unknown company token remains', () => {
    expect(renderSearchInstructions('Find <company.ticker> people', { id: 1, name: 'A', domain: 'a.example' })).toBeUndefined();
  });

  it('leaves templates without tokens unchanged', () => {
    expect(renderSearchInstructions('No tokens here.', { id: 1, name: 'A', domain: null })).toBe('No tokens here.');
  });
});
