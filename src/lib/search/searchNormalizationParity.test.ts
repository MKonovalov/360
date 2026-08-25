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

  it('preserves the path in the malformed-domain fallback', () => {
    expect(normalizeSearchDomain('not a domain/path')).toBe('not a domain/path');
  });

  it('normalizes malformed LinkedIn percent encoding without throwing', () => {
    expect(normalizeSearchLinkedInUrl('https://www.linkedin.com/in/Ada?a=%FF')).toBe(
      'https://www.linkedin.com/in/Ada?a=%EF%BF%BD',
    );
  });

  it('parses userinfo-like domains through the TypeScript URL contract', () => {
    expect(normalizeSearchDomain('user@example.com')).toBe('example.com');
  });
});
