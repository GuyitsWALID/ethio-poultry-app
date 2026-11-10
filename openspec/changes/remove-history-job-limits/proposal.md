# Remove history and background-job limits

Follow-up to the full-system audit, findings 17–20. Linked to `simplify-farm-operations`, `simplify-flock-lifecycle` and `unify-farm-performance`.

Preserve history, jobs, stock rules and existing authorization. Remove the failure modes instead:

1. Page archived Daily Records, load selected correction evidence by exact identity, preserve drafts across pages and recheck cycle revisions. PostgreSQL still validates the complete cycle before application.
2. Select eligible email deliveries before limiting, claim with row locks, append delivery phases, recheck recipients immediately before sending, and stop automatic retries when provider acceptance is unknown.
3. Persist schedule failures and retry delays, pause invalid creators/repeated failures, and advance stable due pages past broken schedules across bounded dispatches. Retain due operating periods and atomic snapshot claims. Each invocation performs at most one full generation attempt or 20 failed prechecks, so catching up does not exhaust the Worker request budget. The existing 15-minute monitor dispatches remaining work.
4. Read Today resource tokens in one authorized bounded farm snapshot, reusing authoritative revision/fingerprint functions and recording-start checks.

No historical deletion, real test emails, new business ledger or permission relaxation. Release to master and production is explicitly approved subject to tests, migration dry runs, encrypted backup and deployment checks. Preserve unrelated local Today changes.
