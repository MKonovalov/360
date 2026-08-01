import { describe, it, expect } from 'vitest';
import { normalizeDomain, normalizeEmail, buildUpdatePatch } from './dedupKeys';

describe('normalizeDomain', () => {
  it('strips protocol, www, and trailing slash', () => {
    expect(normalizeDomain('HTTP://WWW.Foo.com/')).toBe('foo.com');
  });

  it('is a no-op for an already-normalized domain', () => {
    expect(normalizeDomain('foo.com')).toBe('foo.com');
  });

  it('strips https protocol', () => {
    expect(normalizeDomain('https://bar.io')).toBe('bar.io');
  });

  it('strips www without protocol', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDomain('  acme.com  ')).toBe('acme.com');
  });

  it('lowercases the domain', () => {
    expect(normalizeDomain('ACME.COM')).toBe('acme.com');
  });
});

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM  ')).toBe('jane.doe@example.com');
  });

  it('is a no-op for an already-normalized email', () => {
    expect(normalizeEmail('jane.doe@example.com')).toBe('jane.doe@example.com');
  });

  it('trims only leading whitespace', () => {
    expect(normalizeEmail('  user@test.org')).toBe('user@test.org');
  });

  it('lowercases mixed-case local part', () => {
    expect(normalizeEmail('ADMIN@COMPANY.COM')).toBe('admin@company.com');
  });
});

describe('buildUpdatePatch', () => {
  it('keeps non-blank fields and drops empty string and undefined', () => {
    expect(
      buildUpdatePatch({ name: 'Acme', domain: '', industry: undefined, hqLocation: 'Chicago' })
    ).toEqual({ name: 'Acme', hqLocation: 'Chicago' });
  });

  it('returns empty object for empty input', () => {
    expect(buildUpdatePatch({})).toEqual({});
  });

  it('returns all fields when none are blank', () => {
    expect(buildUpdatePatch({ a: 'x', b: 'y' })).toEqual({ a: 'x', b: 'y' });
  });

  it('drops a field whose value is an empty string', () => {
    expect(buildUpdatePatch({ name: 'Acme', domain: '' })).toEqual({ name: 'Acme' });
  });

  it('drops a field whose value is undefined', () => {
    expect(buildUpdatePatch({ name: 'Acme', industry: undefined })).toEqual({ name: 'Acme' });
  });

  it('keeps a field whose value is 0 (falsy but not blank)', () => {
    expect(buildUpdatePatch({ count: 0, name: '' })).toEqual({ count: 0 });
  });
});
