# Platform incident and recovery runbook

This runbook covers application outages, database degradation, failed backups, and recovery events. It does not authorize a production restore by itself. A restore is a controlled change requiring a named operator and verifier.

## Ownership and evidence

- The System Administrator owns platform detection, triage, Cloudflare/Supabase coordination, and the incident timeline.
- The tenant CEO owns business-operational communication and approves any write freeze or recovery window affecting their organization.
- A second person verifies the recovery source, destination, and post-recovery checks.
- Preserve the application release, migration head, timestamps, dashboard evidence, provider incident references, and all actions taken.
- Never paste credentials, database URLs, session cookies, raw database rows, or customer contact data into incident notes.

## Health signals and thresholds

The System Administrator dashboard is the operational summary. A green signal requires current evidence; missing evidence is never treated as healthy.

| Signal | Healthy evidence | Attention threshold |
| --- | --- | --- |
| Application | Sign-in returns `200` and unauthenticated context returns `401` | No probe for 45 minutes, unexpected status, or probe latency above 3 seconds |
| Database | Live privileged count query succeeds | Round trip above 2 seconds or query failure |
| Daily locks | Scheduler completed within 45 minutes | Missing or late scheduler evidence |
| Backups | Supabase reports a completed backup within 36 hours | Backup older than 36 hours or no completed backup |
| Recovery | Isolated restore and verification succeeded within 35 days | Missing, failed, or stale restore drill |

Server exceptions are emitted as structured `application.request_error` events in Cloudflare Workers Logs. The event deliberately excludes headers, query strings, credentials, raw rows, and exception messages.

## Severity

- **SEV-1:** cross-tenant exposure, destructive corruption, authentication unavailable for all supported roles, or the production application is unavailable.
- **SEV-2:** a critical workflow is unavailable, database performance is severely degraded, or current backup/recovery evidence failed.
- **SEV-3:** partial degradation, late monitoring evidence, or a non-critical workflow failure with a safe workaround.

## First 15 minutes

1. Open the System Administrator dashboard and record the failed signal, observation time, environment, and release.
2. Confirm impact using the public probe. Do not test mutations against customer records.
3. Check Cloudflare Workers Logs for structured request errors and invocation failures.
4. Check Supabase project health, database connections, and the latest completed backup.
5. Identify the last known-good application release and migration head.
6. If integrity or tenant isolation may be affected, stop releases and ask tenant CEOs to pause routine writes.
7. Assign an incident owner, verifier, severity, and next update time.

## Application recovery

1. If the database is healthy and the issue began with an application release, redeploy the last known-good immutable Worker version.
2. Do not reverse an applied migration unless a separately reviewed forward correction has proved unsafe or impossible.
3. Run sign-in, role authorization, assigned-scope reads, Daily Records, Feed Control, inventory, sales, Governance, and Record Checks smoke tests.
4. Watch error rate and latency for at least 30 minutes before resolving the incident.

## Database recovery decision

Prefer a corrective forward migration when the database is reachable and evidence is intact. Consider restoration only when data is unavailable or materially corrupted.

Before a restore:

1. Freeze writes and record the start time.
2. Select the recovery point and calculate the expected data-loss window.
3. Restore into a disposable environment first.
4. Verify critical tables, tenant counts, profiles, Daily Records, stock ledger, governance audit history, and application compatibility.
5. Obtain operator and verifier approval for the exact recovery point.
6. Follow Supabase's supported restore procedure; never point the repository drill script at a remote destination. The script refuses non-local targets by design.
7. Rotate credentials if exposure is suspected, deploy the compatible application release, and complete the full staging gate against recovery.

## Scheduled evidence

- `.github/workflows/platform-monitoring.yml` probes staging and production every 15 minutes and checks Supabase backup status.
- `.github/workflows/recovery-drill.yml` runs an isolated production logical restore on the first day of each month.
- Recovery files stay in the runner's temporary directory and are deleted; they are never uploaded as artifacts.
- The recovery drill restores only to `localhost`/`127.0.0.1`, then checks critical tables and row readability.
- Successful and failed evidence is retained in the append-only `platform_operational_evidence` table.

Required configuration:

- Cloudflare production secret: `MONITORING_INGEST_TOKEN`
- Cloudflare staging secret: `MONITORING_INGEST_TOKEN`
- GitHub secrets with the matching values: `PRODUCTION_MONITORING_INGEST_TOKEN`, `STAGING_MONITORING_INGEST_TOKEN`
- GitHub fine-grained Supabase token with `backups_read`: `SUPABASE_BACKUP_READ_TOKEN`
- GitHub production session-pooler connection string: `PRODUCTION_RECOVERY_DATABASE_URL`

Use a different monitoring intake token for staging and production. The recovery database URL must be stored only as a secret and must never appear in logs.

## Closure

An incident closes only after service is stable, data checks pass, tenant communication is complete, and monitoring evidence is current again. Record cause, impact, recovery actions, missing controls, and a named follow-up owner. A backup existing is not proof of recovery; the isolated restore drill is.
