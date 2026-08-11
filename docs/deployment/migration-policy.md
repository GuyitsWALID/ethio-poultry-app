# Migration policy

The migration directory is cryptographically locked by `supabase/migrations.lock.json`. This protects already-reviewed SQL from silent edits.

## Rules

1. Never edit, rename, reorder, or delete an applied migration.
2. New files use a unique UTC name: `YYYYMMDDHHMMSS_description.sql`.
3. Test new SQL on a disposable production-like database with `psql --single-transaction --variable ON_ERROR_STOP=1`.
4. Run `npm run db:verify` after applying it.
5. Review the SQL and `git diff` before running `npm run migrations:lock`.
6. Commit the migration and updated lock together.
7. Compare local and remote migration history before every release. If SQL was applied manually, reconcile history deliberately; never rerun it merely to make the lists match.

The repository contains legacy date-only migration versions, including repeated dates. They are recorded in the lock as historical exceptions. They must remain unchanged. Every new migration must use the full 14-digit UTC timestamp.

## Production-like dry run

```powershell
$env:DATABASE_URL = "postgresql://...disposable-database..."
psql --single-transaction --variable ON_ERROR_STOP=1 --file "supabase\migrations\YYYYMMDDHHMMSS_change.sql" --dbname $env:DATABASE_URL
npm run db:verify
Remove-Item Env:DATABASE_URL
```

Do not put a database password in shell history. Prefer a temporary environment variable or a protected CI secret.

## Backward compatibility

- **Expand:** add nullable columns, tables, functions, or compatible policies.
- **Migrate:** deploy code that understands old and new representations and backfill safely.
- **Contract:** remove obsolete structures only in a later release after evidence confirms they are unused.

Destructive changes require a specific backup and restore plan before approval.
