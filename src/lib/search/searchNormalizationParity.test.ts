import { describe, expect, it } from 'vitest';

import {
  normalizeSearchEmail,
  normalizeSearchDomain,
  normalizeSearchLinkedInUrl,
} from './normalizeSearchPacket';

describe('Search identity normalization parity cases', () => {
  it('sorts retained LinkedIn parameters and preserves pathname casing', () => {
    const reordered = normalizeSearchLinkedInUrl(
      'HTTPS://WWW.LINKEDIN.COM/in/Ada/?b=2&utm_source=ignored&a=1&trk=ignored#about',
    );

    expect(reordered).toBe('https://www.linkedin.com/in/Ada?a=1&b=2');
    expect(normalizeSearchLinkedInUrl('https://www.linkedin.com/in/Ada')).not.toBe(
      normalizeSearchLinkedInUrl('https://www.linkedin.com/in/ada'),
    );
  });

  it('normalizes trailing-dot Company domains', () => {
    expect(normalizeSearchDomain(' HTTPS://WWW.Example.COM./ ')).toBe('example.com');
    expect(normalizeSearchDomain('\u00a0HTTPS://WWW.Example.COM.\u00a0')).toBe('example.com');
  });

  it('trims email after NFKC normalization', () => {
    expect(normalizeSearchEmail('\t\u00a0Ada@example.com\u00a0\t')).toBe('ada@example.com');
  });

  it('decodes, filters, and re-encodes LinkedIn query parameters', () => {
    const plusEncoded = normalizeSearchLinkedInUrl(
      'https://www.linkedin.com/in/Ada?%74rk=ignored&keep=a+b',
    );
    const percentEncoded = normalizeSearchLinkedInUrl(
      'https://www.linkedin.com/in/Ada?keep=a%20b',
    );

    expect(plusEncoded).toBe('https://www.linkedin.com/in/Ada?keep=a+b');
    expect(percentEncoded).toBe(plusEncoded);
  });

  it('fails closed for malformed domain input', () => {
    expect(normalizeSearchDomain('not a domain/path')).toBeNull();
  });

  it('fails closed for malformed LinkedIn percent encoding', () => {
    expect(normalizeSearchLinkedInUrl('https://www.linkedin.com/in/Ada?a=%FF')).toBeNull();
  });

  it('fails closed for userinfo-like domains', () => {
    expect(normalizeSearchDomain('user@example.com')).toBeNull();
  });

  it('fails closed for valid UTF-8 query bytes outside the SQL grammar', () => {
    expect(normalizeSearchLinkedInUrl('https://www.linkedin.com/in/Ada?a=%C3%A9')).toBeNull();
  });
});
