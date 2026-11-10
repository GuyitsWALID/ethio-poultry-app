# Audit findings 12–14

- [x] 12. Shared retry-safe non-egg sale transaction, request fingerprint, current authority and atomic audit; legacy/Today adapters.
- [x] 13. Authoritative actual-entry date guards, both old/new evidence, configurable Addis cutoff, closed/locked days and governed exception.
- [x] 14. Stable complete Today warehouse/catalog/ledger/count pagination, preserving effective access.
- [x] Focused runtime and SQL regressions, migration dry run and compatibility checks. All 31 SQL files passed across the combined run and affected-file rerun; final dry run includes atomic audit rollback. Existing future/historical fixtures now use valid routine dates or explicit historical setup.
- [ ] Full unit suite, TypeScript, lint and production build.
- [ ] Verified fresh production backup, allowlisted migrations, master release and health checks.
