# Decisions

- Use nullable `text[]` selector columns rather than singular columns or synthetic-only resolver metadata. Null remains a valid uncurated state for existing Offerings and Signals Buyer Roles.
- Keep explicit IDs ahead of selector matches and order selector lookup by Buyer Role ID. A missing required explicit ID fails even when another selector matches; an optional missing explicit ID produces a diagnostic while preserving selector matches.
- Deep-freeze every template rule, selector array, evidence-policy array/object, role snapshot, and rule-evidence object before returning a successful launch resolution.
- Extract Buyer Role rule resolution into `resolveBuyerRoleRules.ts` while re-exporting its public types/function from `resolveSearchLaunch.ts`; this keeps the approved public API and the implementation modules reviewable.
