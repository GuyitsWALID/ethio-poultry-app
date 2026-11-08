# Contain operational security gaps

Linked changes: `simplify-farm-operations`, `inherit-farm-warehouse-access`.

Address audit findings 1–7 without changing ledgers, stock calculations or rollout flags. Deny anonymous business RPCs; require active profile authority for setup; apply current farm/store read access; make feed-template application approval-only; atomically edit authorized legacy health schedules; reject missing/weak manager passwords; and reauthorize notifications on read and delivery.

Use a forward-only migration. Preserve source rows and audit history. Deployment to staging/production and Git pushes require separate authorization. Findings 8–20 remain out of scope.
