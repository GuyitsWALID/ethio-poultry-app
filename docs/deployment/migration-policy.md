# Migration policy

The migration directory and the data-free production baseline are cryptographically locked by `supabase/migrations.lock.json`. This protects already-reviewed SQL from silent edits and makes an empty project reproducible.

## Rules

1. Never edit, rename, reorder, or delete an applied migration or history marker.
2. New files use a unique UTC name: `YYYYMMDDHHMMSS_description.sql`.
3. Test new SQL on a disposable production-like database with `psql --single-transaction --variable ON_ERROR_STOP=1`.
4. Run `npm run db:verify` after applying it.
5. Review the SQL and `git diff` before running `npm run migrations:lock`.
6. Commit the migration and updated lock together.
7. Compare local and remote migration history before every release. If SQL was applied manually, reconcile history deliberately; never rerun it merely to make the lists match.

Legacy date-only filenames were mapped to canonical 14-digit versions in `supabase/legacy-migration-map.json`. History markers match the migrations originally created in the Supabase dashboard. All are covered by the verified baseline and must remain unchanged. The migration contract rejects every date-only or duplicate version. Every new migration uses a unique 14-digit UTC timestamp.

## Existing database adoption

A database restored from the verified schema may have missing migration metadata even though its schema is correct. Inspect first, then explicitly adopt the baseline versions. Adoption changes only `supabase_migrations.schema_migrations`; it never executes historical business SQL.

```powershell
$env:DATABASE_URL = $env:STAGING_DB_URL
npm run db:history:inspect
$env:DATABASE_HISTORY_CONFIRM = "ADOPT_VERIFIED_BASELINE"
npm run db:history:adopt
Remove-Item Env:DATABASE_HISTORY_CONFIRM
```

The adoption command refuses an unknown remote migration version or a schema that fails the structural baseline preflight.

## Empty database bootstrap

Never run the legacy migration directory against an empty database; the early project schema originated in Supabase dashboard migrations. Use the guarded baseline interface:

```powershell
$env:DATABASE_URL = $env:EMPTY_DATABASE_URL
$env:DATABASE_BOOTSTRAP_CONFIRM = "BOOTSTRAP_EMPTY_DATABASE"
npm run db:bootstrap
Remove-Item Env:DATABASE_BOOTSTRAP_CONFIRM
Remove-Item Env:DATABASE_URL
```

Bootstrap refuses any database containing public tables or migration history. It restores the data-free baseline atomically, adopts covered history, applies pending locked migrations, and runs the full preflight.

## Routine migration deployment

```powershell
$env:DATABASE_URL = $env:STAGING_DB_URL
$env:DATABASE_DEPLOY_CONFIRM = "APPLY_LOCKED_MIGRATIONS"
npm run db:deploy
Remove-Item Env:DATABASE_DEPLOY_CONFIRM
Remove-Item Env:DATABASE_URL
```

`db:deploy` refuses empty databases, missing baseline history, unknown remote versions, and unlocked migration contents.

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
