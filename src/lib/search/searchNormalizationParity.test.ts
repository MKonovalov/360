import { describe, expect, it } from 'vitest';

import {
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
});
