# Production promotion — 2026-11-05

## Authority and scope

The owner authorized applying the 40 staging migrations to production and merging `notmain` into `master`. This promotes schema and application code, not staging business records. Tenant rollout flags remain unchanged. The owner is the release and rollback operator; the unavailable independent verifier is an explicitly recorded exception. Real-farm pilot Tasks 8.5–8.6 remain unaccepted.

## Verified candidate

- Application candidate: `c6b7f88564648edbd04079f4e34a63a4cc69080e`.
- Quality gate `42000127020`: success; 596 unit tests, TypeScript, lint, production and Cloudflare builds passed.
- Signed-in staging role/report/History/bilingual checks: run `41800702799` passed on business-equivalent `7d7b469`; subsequent offline fixes passed focused full-day reconnect acceptance and the candidate build.
- Migration lock: 102 files. Production starts at `20260916000000`; staging/candidate ends at `20261104000000`, with exactly 40 pending and no divergent history.

## Backup and recovery evidence

- Retained AES-256 encrypted full logical backup, including Auth, source roles and migration history. Recovery key kept separately by the owner, who confirmed custody before production application. No key uploaded to GitHub.
- Decryption/archive hashes verified. Restored into a disposable PostgreSQL 17.6 container with networking disabled; 17 critical source fingerprints matched, including four Auth users. No Storage objects or Vault secrets required separate recovery.
- All 40 unchanged locked migrations then passed against that restored production copy using the non-superuser production database role. Warehouse/lifecycle preflight found no conflicts; final deployment preflight passed; original source identities and values were preserved.
- Backup SHA-256: `892740d08bf9b04b70d9f0e42580acefb69501c8c6ae7506514a97dcb193e0e0`.
- Private operational files and backup locations are deliberately excluded from this public repository.

## Remaining release limitations

Daily managed-backup monitoring remains degraded because managed backups are unavailable. This verified manual backup is not a daily retained-backup service; Task 8.4 stays open. The operator must arrange retained daily recovery before authoritative pilot data.

Cross-browser/physical-device/upgrade-failure acceptance, the full bilingual Today recording acceptance, live tenant-disable rollback, and the real-farm pilot remain open where not evidenced. A successful deployment does not mark these complete. Production signed-in operator smoke checks and the runbook's 30-minute observation must be recorded separately; no unattended period or second-person approval is inferred.

## Deployment outcome

Production application passed: all 40 migrations applied, database deployment preflight passed, migration head is `20261104000000`, and the original critical source records match the verified backup. Staging and production migration histories now agree at 102 versions. Application promotion is tracked by the `notmain` → `master` merge and its production Workers build.

If a later release check fails, halt and inspect the exact state; do not attempt destructive down migrations. Keep the encrypted backup and use the existing recovery runbook for any restore decision.
