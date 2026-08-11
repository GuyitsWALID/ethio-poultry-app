# EthioPoultry release and rollback runbook

This runbook is the authoritative order for staging and production releases. A release is an immutable application commit plus the exact migration aggregate emitted by `npm run release:manifest`.

## Required authority

- One release operator performs the deployment.
- The tenant CEO approves planned downtime or materially risky database work.
- A second person verifies the backup, target project reference, and post-release checks.
- Never paste database URLs, service-role keys, or backup encryption keys into tickets or chat.

## Release preparation

1. Confirm the branch is clean and the intended commit is tagged or recorded.
2. Use Node `22.16.0`, npm `10.9.2`, and `npm ci`.
3. Set `APP_ENVIRONMENT`, `APP_RELEASE`, `APP_BASE_URL`, and `SUPABASE_PROJECT_REF` for the target.
4. Run `npm run release:verify`.
5. Run `npm run release:manifest` and retain the output with the release evidence.
6. Compare `SUPABASE_PROJECT_REF` with the target Supabase dashboard URL. Stop on any mismatch.

## Staging gate

1. Deploy the exact candidate commit to the staging application environment.
2. Apply pending migrations to staging in a single controlled change window.
3. Set `DATABASE_URL` locally without printing it, then run `npm run db:verify`.
4. Run the GitHub **Staging release gate** against the immutable staging URL.
5. Complete the role smoke tests in [staging-validation.md](staging-validation.md).
6. Do not promote a different commit than the one that passed staging.

## Production release

1. Announce the release window and suspend routine entry if the migration is not backward compatible.
2. Confirm the latest automated backup completed. Record its timestamp and recovery target.
3. Take an additional pre-release database backup when the migration changes business data or constraints.
4. Verify the production migration history and review the SQL diff. Never edit or rename an applied migration.
5. Apply database changes before application code only when the changes are backward compatible. Otherwise use the expand/migrate/contract sequence across separate releases.
6. Run `npm run db:verify` against production.
7. Deploy the exact staged application commit.
8. Verify sign-in, CEO read access, farm-manager assigned-farm access, alerts, Daily Records, Feed Control, inventory, sales, governance, and reconciliation.
9. Watch error rate, API latency, database connections, and reconciliation findings for at least 30 minutes.
10. Record the commit, manifest, migration head, operator, verifier, start/end times, and outcome.

## Stop and rollback criteria

Rollback or halt the release when any of these occurs:

- tenant isolation or assignment authorization fails;
- routine writes produce duplicate, missing, or cross-scope records;
- migrations or the database preflight fail;
- authentication is unavailable for supported roles;
- error rate or database saturation materially increases;
- reconciliation reports new critical contradictions caused by the release.

## Application rollback

1. Stop further deployments and routine writes if data integrity is at risk.
2. Redeploy the last known-good immutable commit/build.
3. Keep additive database changes in place when the old application remains compatible.
4. Re-run the smoke tests and database preflight.
5. Open an incident record and preserve logs and release evidence.

## Database recovery

Production migrations roll forward. Do not write an improvised destructive down migration.

1. If the schema is compatible, create a corrective forward migration and pass the staging gate again.
2. If data was corrupted, stop writes and determine the recovery point before making further changes.
3. Restore into a disposable project first and verify tenant counts, critical ledgers, authentication metadata, and the reconciliation preflight.
4. The CEO and release operator approve the production restore window.
5. Restore production, rotate any credentials exposed during the incident, deploy the compatible application commit, and run all post-release checks.

The existence of a backup is not release evidence. A successful disposable restore is.
