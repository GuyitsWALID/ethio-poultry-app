# EthioPoultry Management System

Governed poultry operations for CEO oversight and assigned-farm execution. The application uses Next.js 16, Supabase/PostgreSQL, TypeScript, and a locked npm dependency graph.

## Required toolchain

- Node.js `22.16.0`
- npm `10.9.2`
- PostgreSQL `psql` for database verification
- Supabase CLI and Docker-compatible runtime for local database work

Copy `.env.example` to `.env.local` and replace every placeholder. Never commit `.env.local`.

```powershell
npm ci
npm run env:check
npm run dev
```

## Verification

```powershell
npm run migrations:verify
npm run check
npm run build
```

`npm run build` uses Webpack deliberately, giving the same production compiler on Windows and CI without relying on platform-specific Turbopack bindings. Application fonts are stored locally, so the build does not download fonts.

For a disposable or staging database:

```powershell
$env:DATABASE_URL = "postgresql://..."
npm run db:verify
Remove-Item Env:DATABASE_URL
```

Database releases use guarded interfaces rather than raw migration commands:

```powershell
npm run db:history:inspect  # read-only history comparison
npm run db:history:adopt    # one-time metadata adoption after verified restore
npm run db:deploy           # apply pending locked migrations
npm run db:bootstrap        # empty databases only
```

See the migration policy before using a mutating database command. Confirmation variables are required, credentials are never printed, and the verified baseline contains schema only—not production business data.

## Deployment

- [Release and rollback runbook](docs/deployment/release-runbook.md)
- [Staging validation](docs/deployment/staging-validation.md)
- [Migration policy](docs/deployment/migration-policy.md)
- [Production-readiness gates](docs/production-readiness.md)
