import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import {
  searchApprovalDomainKey,
  searchApprovalEmailKey,
  searchApprovalLinkedInKey,
  searchApprovalLinkedInMatchKey,
} from './searchApprovalNormalization';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const queryChunks = Reflect.get(value, 'queryChunks');
  if (Array.isArray(queryChunks)) return queryChunks.map(flattenSql).join('');
  const nested = Reflect.get(value, 'value');
  if (nested !== undefined) return Array.isArray(nested) ? nested.map(flattenSql).join('') : flattenSql(nested);
  return Object.values(value).map(flattenSql).join('');
}

describe('search approval SQL normalization contracts', () => {
  it('normalizes NFKC before trimming and collapsing whitespace', () => {
    const text = flattenSql(searchApprovalEmailKey(sql`value`));

    expect(text).toContain("normalize(value, NFKC)");
    expect(text).toContain('chr(9)');
    expect(text).toContain('chr(65279)');
  });

  it('decodes and re-encodes LinkedIn query components like URLSearchParams', () => {
    const text = flattenSql(searchApprovalLinkedInKey(sql`value`));

    expect(text).toContain('regexp_matches');
    expect(text).toContain('convert_from(');
    expect(text).toContain('decode(');
    expect(text).toContain('encode(convert_to(');
  });

  it('keeps malformed domain paths in the fallback branch', () => {
    const text = flattenSql(searchApprovalDomainKey(sql`value`));

    expect(text).toContain('CASE');
    expect(text).toContain("'[/:?#].*$', '')");
  });

  it('preserves the LinkedIn www host and exposes fail-closed boundaries', () => {
    const text = flattenSql(searchApprovalLinkedInKey(sql`value`));
    const matchText = flattenSql(searchApprovalLinkedInMatchKey(sql`value`));

    expect(matchText).toContain('https://www\\.linkedin\\.com');
    expect(text).toContain('IS NULL');
    expect(text).toContain('octet_length');
  });
});
