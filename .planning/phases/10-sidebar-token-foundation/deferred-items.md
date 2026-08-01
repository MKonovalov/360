# Deferred Items — Phase 10

Out-of-scope discoveries logged during plan execution (per executor scope-boundary rule).

## 10-01 (sidebar token foundation)

- **Untracked `.claude/` directory at repo root** — present before 10-01 execution started (`?? .claude/` in initial `git status`). Contains `.claude/skills/{neon,neon-postgres}`, `launch.json`, `settings.local.json`, and `.claude/worktrees/`. Not created by this plan and not gitignored. Left untouched (out of scope; likely intentional-but-uncommitted local tooling state). Decide whether to commit or gitignore it outside plan execution.
- **Pre-existing `.planning/STATE.md` drift** — was already modified at execution start ("Phase 10 execution started" update from plan-phase completion). Folded into the 10-01 final docs commit (63278691) since it was the canonical state file being updated anyway.
