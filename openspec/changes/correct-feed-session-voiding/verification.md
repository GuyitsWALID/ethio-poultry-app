# Finding 8 verification — 2026-11-09

- Full unit suite: 606 passed on the current working tree, including the separately completed Today/opening-gap work. That work was not edited by this change.
- Focused new-test lint, migration lock/contract (104 files) and diff whitespace checks passed.
- New migration applied successfully to a dedicated disposable copy of the existing security-hardened fixture database. The existing source clone, normal local database and all remote databases were left untouched by these checks.
- All 30 database integration files passed. Feed regressions cover voided completed and pending sessions, no active sessions, valid pending-session rejection, planned/actual/variance totals, feed type, ignored unassigned stores for voided evidence, stock issues, repeated close and reopen/void/reclose. Existing Daily Record observations and non-feed usage remain preserved.
- The actual read-only preflight query was executed against transactional fixtures: correct closures were excluded; deliberately inconsistent feed types and closure totals were identified. Fixtures rolled back.

No production TypeScript or UI code changed for this finding; a new app build, browser checks and full TypeScript/lint reruns were not repeated. Initial Docker startup/clone-extension setup and fixture/harness errors were corrected before the successful database pass.

## Release and historical evidence

`20261109000000_exclude_voided_feed_sessions.sql` is forward-only and changes no source, closure or ledger rows during migration. Current permissions and all non-voiding close rules are preserved. Apply the migration only through a separately authorized release.

Run `supabase/verification/voided_feed_session_preflight.sql` on each authorized target before sign-off. A historical mismatch needs exact reviewed correction using the existing operating-window/Governance process; do not silently rebalance stock or rerun closed days. No remote inspection, migration, commit or push was performed for finding 8.

Finding 9 (free-text stock override authority) and findings 10–20 remain separate work.
