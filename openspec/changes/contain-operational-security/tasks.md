## Security containment

- [x] 1 Deny anonymous business mutations and narrow internal RPC grants.
- [x] 2 Require active profile authority for organization/CEO setup.
- [x] 3 Apply current farm and effective warehouse access to direct operational reads.
- [x] 4 Require an approved Governance application for feed-template changes.
- [x] 5 Edit legacy health source/evidence atomically with original/destination access and revision checks.
- [x] 6 Reject missing/weak manager passwords; remove predictable fallback.
- [x] 7 Reauthorize notification reads/counts and email delivery against current source access.
- [x] 8 Run combined unit/API regressions, isolated migration/RLS tests, TypeScript, lint and build.
- [x] 9 Separately authorized production deployment and release checks. PR #5 merged as `1871012`; production migration `20261108000000`, clean PR/master gates, verified encrypted backup, preserved source fingerprints, production build and anonymous-denial smoke checks passed.
- [ ] Confirm staging parity and signed-in acceptance for the current integrated release. The staging release-branch rejection is the retained `notmain` guard, not proof of application acceptance.
- [ ] Review accounts created under the retired fallback-password path and arrange owner-controlled resets where applicable; removing the fallback does not reset existing credentials.

Evidence: [PR #5](https://github.com/GuyitsWALID/ethio-poultry-app/pull/5). See [current audit repair status](../../../docs/deployment/audit-repair-status.md).
