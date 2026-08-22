import { describe, expect, it } from 'vitest';
import { parsePersonaFilters, parseSelectedId as parsePersonaSelectedId } from './personaFilters';
import {
  buildCompanyCanonicalPath,
  buildCompanyLegacyRedirect,
  parseCompanyId,
  parseCompanyTab,
} from './companyRoute';

describe('company route contracts', () => {
  it.each(['0', '-1', '1.5', 'abc', ' 2', '2 '])('rejects malformed company id %s', (raw) => {
    expect(parseCompanyId(raw)).toBeUndefined();
  });

  it('accepts only positive integer company ids', () => {
    expect(parseCompanyId('42')).toBe(42);
    expect(parseCompanyId('00042')).toBe(42);
  });

  it('rejects an id outside the safe integer range', () => {
    expect(parseCompanyId('9007199254740992')).toBeUndefined();
  });

  it.each([
    [undefined, 'general'],
    ['unknown', 'general'],
    ['personas', 'personas'],
    [['analysis', 'knowledge'], 'analysis'],
  ])('normalizes tab %s', (raw, expected) => {
    expect(parseCompanyTab(raw)).toBe(expected);
  });

  it('builds the canonical company URL without a selected query parameter', () => {
    expect(buildCompanyCanonicalPath(42, 'personas')).toBe('/companies/42?tab=personas');
    expect(buildCompanyCanonicalPath(42, 'general')).toBe('/companies/42');
  });

  it('redirects a valid legacy selection with only its recognized tab state', () => {
    expect(
      buildCompanyLegacyRedirect({
        selected: '42',
        tab: 'analysis',
        search: 'Acme',
        industry: 'Technology',
        signal: 'cost_pressure',
        revenueBand: 'under_50m',
        ownershipType: 'private',
      }),
    ).toBe('/companies/42?tab=analysis');
  });

  it.each([
    [{ selected: '42' }, '/companies/42'],
    [{ selected: '42', tab: 'unknown', search: 'Acme' }, '/companies/42'],
    [{ selected: '42', tab: ['analysis', 'knowledge'], search: 'Acme' }, '/companies/42?tab=analysis'],
    [{ selected: '42', tab: ['unknown', 'analysis'], search: 'Acme' }, '/companies/42'],
  ])('drops missing or invalid legacy tab state: %j', (params, expected) => {
    expect(buildCompanyLegacyRedirect(params)).toBe(expected);
  });

  it('does not redirect malformed, non-positive, or absent legacy selections', () => {
    expect(buildCompanyLegacyRedirect({ selected: 'nope' })).toBeUndefined();
    expect(buildCompanyLegacyRedirect({ selected: '0' })).toBeUndefined();
    expect(buildCompanyLegacyRedirect({})).toBeUndefined();
  });

  it('does not create a redirect loop from the canonical route', () => {
    expect(buildCompanyLegacyRedirect({ selected: '42' })).toBe('/companies/42');
    expect(buildCompanyLegacyRedirect({ tab: 'general' })).toBeUndefined();
  });

  it('leaves persona selected parsing and filters unchanged', () => {
    expect(parsePersonaSelectedId({ selected: '0' })).toBe(0);
    expect(parsePersonaFilters({ hasSignals: 'false', selected: '7' })).toEqual({
      search: undefined,
      seniority: undefined,
      currentCompany: undefined,
      hasSignals: false,
    });
  });
});
