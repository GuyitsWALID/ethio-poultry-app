# Findings 1–7 containment evidence

## Implementation

1. Privileged business functions no longer inherit anonymous/PUBLIC execution. Internal API-only functions remain callable by service_role and trusted SQL owners; the authenticated operating-day entry point is retained. Future postgres-owned functions require explicit grants.
2. Organization onboarding and CEO setup use the shared active-profile access resolver. Editable authentication metadata cannot authorize either endpoint.
3. Restrictive read policies intersect legacy ALL/SELECT policies. Current active farm and effective warehouse permission checks apply to operational records, including legacy sales and warehouse expenses. Assigned-flock SELECT policies preserve legitimate weight/history reads. Direct expense mutations use the existing guarded server operations.
4. Feed-template changes submit Governance requests. Direct RPC execution is private and additionally requires the existing approved-apply transaction flag. Approved manager application remains tested. Support cannot bypass approval.
5. A service-only transaction locks the original schedule, checks original/destination access and source revision, validates location/closure/completion, updates canonical and linked metadata rows, and appends audit evidence. The legacy UI no longer writes the source before PATCH. A forced metadata failure proves rollback of the source write.
6. CEO setup requires an explicit password satisfying the shared policy. The UI generator uses cryptographic randomness. No existing password is changed by this release.
7. Notification lists, unread counts and outbox selection use a service-only effective-access view before pagination. Delivery rechecks access immediately before looking up the recipient email. Direct authenticated reads use the matching restriction; retained notices are not deleted.

## Local checks — 2026-11-08

- Full unit suite: 602 passed, including six security regressions and the real active-profile/forged-metadata resolver check.
- TypeScript and lint: passed.
- Migration lock/contract and whitespace checks: passed; 103 reviewed migrations.
- Clean disposable Docker rebuild: all 35 migrations after the unchanged local baseline passed, with populated preservation checks.
- All 30 database integration files plus archived-cycle correction assertions passed, including the new security fixture.
- Next production build: passed (110 generated pages; local/unversioned environment). The initial sandbox attempt was blocked by Wrangler's local log/registry permissions; the permitted local rerun passed. Browserslist reported an outdated compatibility dataset; dependencies were not changed.

The existing `test-flock-lifecycle-dryrun.mjs` rebuilt only `ethio_flock_lifecycle_dryrun_20261007`. The normal local database and all remote databases were untouched. Fixtures roll back their business rows. No real emails were sent by tests.

## Release boundary / remaining checks

Deploy `20261108000000_contain_operational_security.sql` before the matching application: notification readers and schedule editing require its view/functions. Recheck signed-in manager/CEO/support workflows on staging before production. No commit, push, staging migration, production migration, separate Cloudflare bundle or live browser acceptance was performed in this change.

Existing accounts created using the removed predictable fallback require a separate password reset; changing the creation path does not rotate their credentials. Until migration and application deployment, the deployed system does not receive these fixes. Findings 8–20 remain separate work.
