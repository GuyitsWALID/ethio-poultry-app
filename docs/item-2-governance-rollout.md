# Item 2 governance rollout

Apply `20260804000000_governance_permissions_foundation.sql` additively before deploying the application changes. The migration deliberately fails on duplicate active CEOs; resolve those organizations explicitly instead of choosing an account silently.

Before enforcement, review:

- inactive `veterinarian` and `store_keeper` profiles requiring CEO reassignment;
- farms created from former branch grants and their effective assignment windows;
- warehouses returned by `/api/governance/assignments` as unassigned;
- organizations without exactly one active CEO;
- availability of `pg_cron`; without it, invoke `lock_overdue_operating_days()` from the platform scheduler every 15 minutes.

Supabase Auth controls that remain deployment configuration, not repository code:

- enable compromised-password detection;
- configure sign-in and password-reset rate limits;
- set the project password minimum to 12 characters to match the onboarding API;
- retain the documented residual risk that MFA and approval-time reauthentication are out of scope.

Run `npm run check`, apply the migration to a disposable database, exercise CEO/farm-manager/system-admin browser journeys, and only then enable the release for production tenants.
