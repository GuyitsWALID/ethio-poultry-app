# Tasks

- [x] 1. Preserve Task 7.6 separately and save the approved specification.
- [x] 2. Add effective-access database helpers, single-manager enforcement and migration preflight.
- [x] 3. Route server readers, RLS and authoritative mutations through effective access; remove automatic shared-store feeding.
- [x] 4. Add CEO-only atomic assignment, handover and revocation with audit/task/notification evidence.
- [x] 5. Add readable inherited access, shared grants and bilingual handover/setup controls.
- [x] 6. Add unit, SQL/RLS/single-manager exclusion/stale-handover and tablet browser regressions.
- [x] 7. Pass Docker migration dry run, full tests, lint, TypeScript and production/Cloudflare builds.
- [ ] 8. Resolve staging preflight conflicts explicitly; migrate staging, validate populated Reports and authenticated rollback compatibility.
- [x] 9. Commit and push reviewed changes to notmain; document exact evidence and remaining pilot gates.

Evidence: `docs/deployment/farm-warehouse-access.md`. Task 8 staging migrations and all nine database integration files passed; `1a029f8` passed GitHub and Cloudflare staging builds. Protected run `37488388925` passed populated CEO and manager Reports, including stock and effective-access agreement. Broader authenticated rollback/revocation/offline acceptance remains pending. Production unchanged.
