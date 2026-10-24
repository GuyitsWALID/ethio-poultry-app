## 1. Specification and readers
- [x] 1.1 Save proposal, architecture, source mappings and requirements linked to simplify-farm-operations.
- [x] 1.2 Implement allowlisted read-only History contracts, filter/cursor validation and stable multi-source pagination.
- [x] 1.3 Implement tenant/farm/effective-warehouse authorization and list/detail API handlers.
## 2. Workspace and compatibility
- [x] 2.1 Build URL-driven filters and responsive list/detail workspace with distinct failure states.
- [x] 2.2 Add exact authorized correction links and validated Back to History navigation.
- [x] 2.3 Update enabled-manager/CEO sidebars, Reports visibility and flock History entry.
- [x] 2.4 Translate all controls/values and verify Ethiopian-calendar display. New terminology remains pending partner review, not falsely included in the earlier glossary approval.
## 3. Verification and release
- [x] 3.1 Add focused contract, authorization, paging, deep-link and responsive regressions.
- [x] 3.2 Run focused tests, TypeScript, lint, production/Cloudflare builds and OpenSpec validation. See verification.md for checked revisions and remaining staging acceptance.
- [x] 3.3 Validate authenticated staging, deploy any required reviewed indexes and release to notmain. Production requires separate approval.
  - History migration, notmain release, quality gate, Cloudflare deployment and signed-in CEO/Farm Manager History checks passed (staging run 39119039378).
  - Scope reconciliation 2026-10-24: History's own authenticated staging gate passed. The separate Reports assertion does not make this History release task incomplete; it remains tracked under `unify-farm-performance` 5.3 and parent Task 8. Earlier first-profile Reports evidence was not pinned to Laba. No populated assertion is weakened.
