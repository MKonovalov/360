# Findings

- Review follow-up confirmed that the existing `buyer_role` table had no persisted department, function, seniority, or geography selector metadata. The production fix is four nullable PostgreSQL `text[]` columns projected by `listBuyerRoles()`.
- Search template JSONB is runtime data despite Drizzle's compile-time `$type`; malformed rule or evidence JSON must be rejected before array copying. The query now returns the existing safe unavailable result (`undefined`), which resolves to `template_not_found`.
- Task 1's persisted `SearchBuyerRoleSnapshot` is intentionally `{ id, name }`. Rule and selector evidence is now a separate `buyerRoleEvidence` projection so persisted role snapshots remain contract-compatible and downstream proposal evidence is lossless.
- The fixture-gated DB integration lane remains unavailable in this environment: `TEST_DATABASE_URL` does not carry the required `phase39-fixture` marker. Drizzle check and migration artifact validation pass independently.
- Downstream candidate sanitization previously revalidated proposals only against `buyerRoleIds`, so selector-only and mixed selector resolutions were discarded despite valid launch evidence. The fix persists a typed `buyerRoleEvidenceSnapshot` with the Search run and validates each proposed rule against that immutable role-to-rule evidence map.
