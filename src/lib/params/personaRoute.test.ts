import { describe, expect, it } from 'vitest';
import {
  buildPersonaCanonicalPath,
  buildPersonaLegacyRedirect,
  parsePersonaId,
  parsePersonaTab,
} from './personaRoute';

describe('personaRoute', () => {
  it.each([['23', 23], ['abc', undefined], ['0', undefined], ['-1', undefined], ['1.5', undefined], ['', undefined]])(
    'parses id %j',
    (raw, expected) => expect(parsePersonaId(raw)).toBe(expected),
  );

  it('normalizes tabs and defaults to general', () => {
    expect(parsePersonaTab('analysis')).toBe('analysis');
    expect(parsePersonaTab(['knowledge', 'analysis'])).toBe('knowledge');
    expect(parsePersonaTab('personas')).toBe('general');
    expect(parsePersonaTab(undefined)).toBe('general');
  });

  it('builds canonical paths', () => {
    expect(buildPersonaCanonicalPath(23, 'general')).toBe('/personas/23');
    expect(buildPersonaCanonicalPath(23, 'analysis')).toBe('/personas/23?tab=analysis');
  });

  it('maps the legacy ?selected= shape to the canonical path', () => {
    expect(buildPersonaLegacyRedirect({ selected: '23' })).toBe('/personas/23');
    expect(buildPersonaLegacyRedirect({ selected: ['7', '8'], tab: 'knowledge' })).toBe('/personas/7?tab=knowledge');
    expect(buildPersonaLegacyRedirect({ selected: 'x' })).toBeUndefined();
    expect(buildPersonaLegacyRedirect({})).toBeUndefined();
  });
});
