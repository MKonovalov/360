import { describe, expect, it } from 'vitest';

import { buildApproveSearchReviewSql } from './approveSearchReviewSql';

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

describe('Search approval SQL', () => {
  it('uses a safe alias while preserving current name-match joins', () => {
    // Given: the approval statement is built for a valid review request.
    const query = flattenSql(buildApproveSearchReviewSql({ reviewId: 73, expectedRevision: 2, actorUserId: 'user_123' }));

    // When: the generated SQL is inspected for the current-role name-match branch.
    // Then: the reserved keyword is absent as an alias and both joins remain intact.
    expect(query).not.toMatch(/\bcurrent_role\b/);
    expect(query).toContain('INNER JOIN company_persona_role cpr ON cpr.company_id = keys.company_id AND cpr.is_current = true');
    expect(query).toContain('INNER JOIN persona matched ON matched.id = cpr.persona_id');
  });
});
