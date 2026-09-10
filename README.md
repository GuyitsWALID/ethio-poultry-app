# EthioPoultry Management System

EthioPoultry is a governed poultry-operations platform for multi-farm organizations. It connects daily farm work, flock performance, feed, health, inventory, sales, management reporting, and controlled corrections in one auditable system.

The application is designed around a clear separation of duties:

- Farm Managers record and correct work only inside their assigned farms and warehouses.
- CEOs configure the organization, oversee performance, assign work, review exceptions, and authorize protected corrections.
- System Administrators operate the platform but cannot enter a tenant's business data without a time-limited, CEO-approved support session.

The system uses deterministic calculations and database-backed controls for official records. Its Groq-powered AI assistant can explain a Record Check and recommend investigation steps, but it cannot edit data, approve an exception, or clear a finding.

## Contents

- [What the system solves](#what-the-system-solves)
- [How the operating model works](#how-the-operating-model-works)
- [Roles and permissions](#roles-and-permissions)
- [Main capabilities](#main-capabilities)
- [Typical workflows](#typical-workflows)
- [Architecture](#architecture)
- [Data integrity and security](#data-integrity-and-security)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Database and migrations](#database-and-migrations)
- [Testing and verification](#testing-and-verification)
- [Deployment and operations](#deployment-and-operations)
- [Current release boundaries](#current-release-boundaries)
- [Further documentation](#further-documentation)

## What the system solves

Poultry operations often spread the same fact across notebooks, spreadsheets, warehouse records, and management reports. That creates avoidable questions: which flock used the feed, whether mortality events match the official daily total, whether sold eggs existed in recorded production, or whether a locked record changed without approval.

EthioPoultry gives each fact an authoritative source and then cross-checks related sources automatically. Missing data remains **unavailable** rather than being presented as zero, and disagreements become guided Record Checks with a clear correction destination.

The result is one operational chain from the farm floor to management:

```text
Organization setup and assignments
                |
                v
Daily Records + Feed + Health + Inventory + Sales
                |
                v
Deterministic calculations and cross-checks
                |
                v
Alerts and accountable Action Desk tasks
                |
                v
Source correction or governed authorization
                |
                v
System recheck, audit evidence, analytics, and reports
```

## How the operating model works

The platform follows five principles:

1. **Record work at its source.** Feed is entered in Feed Control, treatment in Health Log, stock receipts in Inventory, and commercial activity in Sales.
2. **Calculate once from authoritative evidence.** Dashboards and reports reuse the same scoped server-side calculations instead of maintaining separate totals.
3. **Treat contradictions as work, not decoration.** Alerts can become assigned tasks with an owner, due date, response history, and deterministic completion check.
4. **Correct protected data through Governance.** Approval authorizes an exact, one-time correction; approval alone never changes a business record.
5. **Retain evidence.** Sensitive mutations, decisions, assignments, AI analyses, reports, and monitoring checks leave append-only history.

## Roles and permissions

| Role | Intended responsibility | Can do | Cannot do |
| --- | --- | --- | --- |
| **CEO** | Organization-wide management and control | Configure branches and operating structure, assign farm and warehouse access, view tenant-wide analytics, assign actions, approve governance requests, reconcile financial periods, and review audit history | Perform routine Farm Manager data entry merely because they can see the organization |
| **Farm Manager** | Execute day-to-day work for assigned operations | Manage Daily Records, feed, mortality, health, inventory, and sales inside active farm or warehouse assignments; submit governed-change requests; respond to assigned actions | Access unassigned farms or warehouses, approve their own protected changes, or make CEO decisions |
| **System Administrator** | Platform onboarding, availability, and support | Onboard organizations, inspect platform health, request tenant support access, and work inside an approved break-glass session | View or change tenant business data outside an active CEO-approved support session; approve tenant business requests |

Unknown, missing, inactive, and retired roles are denied. Branch membership is a navigation or reporting concept and does not independently grant authority to operate a farm.

## Main capabilities

### Organization and access setup

- Create the organization structure from branch to farm, house, flock, and batch cycle.
- Track active and historical flock/batch lineage.
- Assign Farm Managers directly to farms and warehouses with start, expiry, revocation, and reason history.
- Keep CEO authority separate from routine operational entry.

### Executive command center

- View organization-wide production, bird population, mortality, feed, sales, receivables, inventory, and record-coverage indicators.
- Compare current performance with the immediately preceding equivalent period.
- Filter each analytical page independently by the scope relevant to that page.
- Drill from a management signal into the affected farm, flock, operational record, or action.

### Farm and flock operations

- Monitor farm capacity, active flocks, production readiness, and missing evidence.
- Create controlled batch cycles while preserving prior lineage.
- Inspect a farm, house, or flock and follow links to the exact operational source requiring attention.
- Keep flock counts, placement dates, age, production type, and batch custody connected.

### Daily Records and operating-day control

- Capture flock-day production, opening and closing bird counts, egg grades, mortality totals, weights, and operational observations.
- Support multiple routine-supply usage rows while keeping feed, medicine, and vaccine usage in their authoritative workflows.
- Allow a governed seven-day entry window before records require controlled correction.
- Close operating days only when required flock records and feed evidence are complete.
- Protect locked records from unapproved changes.

### Feed Control

- Maintain age-based feed templates, intake targets, weight bands, and feed plans.
- Record feeding sessions and weight milestones by batch.
- Close a feeding day once, synchronize its total to the Daily Record, and deduct inventory once.
- Reopen and re-close without duplicating feed or stock movements.
- Calculate feed per bird-day, layer feed conversion, growth feed conversion, and inventory cover from eligible evidence.

### Mortality and health

- Analyze mortality by flock, day, rate, trend, and cause.
- Preserve missing Daily Records as visible gaps in the analysis.
- Reconcile detailed mortality causes to the official Daily Record death total.
- Plan and complete vaccination, biosecurity, weight, and treatment work in the Health Log.
- Deduct administered medicine and vaccines from an assigned warehouse as part of the same controlled operation.
- Present the upcoming 14-day health runway and overdue work.

### Warehouse-first inventory

- Work from one assigned warehouse and reporting month.
- Register opening stock once, receive purchases, and retain a warehouse-specific stock ledger.
- Show carried opening balance, receipts, operational usage, transfers, adjustments, current balance, latest count, reorder status, and stock value by item.
- Reduce stock automatically from Feed Control, Daily Records routine supplies, treatments, and vaccinations.
- Submit a whole-warehouse physical count without silently replacing the ledger balance.
- Create a Record Check when shelf quantity and system quantity disagree.
- Keep monthly and one-off expenses separate from physical stock quantities.

### Sales and profitability

- Record egg, bird, package, consultancy, training, and equipment/medicine sales.
- Connect a sale to its farm, house, flock, and batch where applicable.
- Track gross sales, collected cash, balances due, payment method, customer context, and product mix.
- Record direct and allocated costs and reconcile monthly profit periods.
- Preserve unresolved evidence gaps rather than presenting an unreliable profit result.

### Operational analytics and reports

- Calculate HDEP, feed per bird-day, mortality per 1,000 bird-days, marketable egg rate, feed consumed, and record coverage.
- Compare flock performance with age-specific healthy bands and configured breed targets.
- Align production, feed, mortality, and evidence coverage by date in a production fingerprint.
- Rank farms and flocks that require attention without converting missing data into false performance.
- Generate permanent management snapshots and download branded HTML or CSV reports.
- Create CEO-governed weekly or monthly report schedules and retain failed attempts for auditability.

### Record Checks and AI investigation assistance

Record Checks compare authoritative sources using deterministic rules. Current controls include:

- opening-to-closing bird custody;
- farm, house, batch, and flock lineage;
- feed sessions, closed feed days, synchronized Daily Records, and stock issues;
- mortality totals and cause allocation;
- egg production, classifications, and sales;
- inventory ledger balances and physical counts;
- cost allocations and financial-period status; and
- protected records changed outside an approved correction.

Each finding explains what disagrees, why it matters, who should handle it, which values were checked, and where to correct the source. The finding remains open until the records agree on a fresh deterministic recheck or the CEO approves a valid exception.

When enabled, the AI investigation assistant sends a sanitized, finding-specific evidence packet to Groq through the Vercel AI SDK. The validated response may summarize the difference, rank likely causes, cite supplied evidence, identify missing evidence, and propose investigation steps. It remains advisory and read-only. UUIDs, credentials, contact details, unrelated tenant data, tools, browser access, and hidden reasoning are excluded.

### Alerts, notifications, and the Action Desk

- Combine operational alerts, Record Checks, and Governance events into one scoped work queue.
- Assign an action to a specific Farm Manager with an explicit deadline.
- Track acknowledgement, work started, resolution evidence, overdue escalation, completion submission, and CEO verification.
- Keep corrected work visible until the manager submits completion and the source system verifies it.
- Notify only relevant recipients and keep direct CEO assignments visible even when optional update preferences are restricted.
- Preserve notification actor snapshots so historical messages identify who assigned or completed work.
- Support optional external email delivery after a verified Cloudflare sender is configured.

### Contextual Governance

Governance handles changes that should not bypass a lock or overwrite protected history.

```text
Blocked source action
      -> prefilled change request
      -> CEO review and decision note
      -> seven-day one-time authorization
      -> assigned manager applies the exact approved values
      -> source version and scope are rechecked atomically
      -> audit history and Record Check refresh
```

Requests show readable source context, current and proposed values, the submitting manager's immutable identity, relevant assignment, supporting references, and source freshness. An approval is valid only for the exact record, fields, and values requested. It expires, conflicts when the source version changes, and cannot be reused.

### Platform administration and recovery

- Onboard organizations and their initial CEO account behind an administrator activation gate.
- Display application, database, scheduler, backup, and recovery evidence in the System Administrator dashboard.
- Probe staging and production application contracts every 15 minutes.
- Dispatch scheduled notification and report work through protected internal endpoints.
- Record monitoring evidence without request secrets or raw business records.
- Run isolated recovery drills against local Supabase rather than restoring over a remote target.
- Require CEO-approved, tenant-scoped, time-limited break-glass access for support.

## Typical workflows

### Set up a new operating organization

1. A System Administrator onboards the organization and initial CEO.
2. The CEO creates the branch, farm, house, flock, and initial batch structure.
3. The CEO creates warehouses where physical stock belongs.
4. The CEO assigns each Farm Manager to the farms and warehouses they operate.
5. The Farm Manager opens the warehouse, registers initial stock once, and begins daily operations.

### Complete a normal farm day

1. Record flock production, bird counts, mortality, weights, and routine observations in Daily Records.
2. Record feeding sessions in Feed Control and close the feed day.
3. Record treatments or completed vaccinations in Health Log, including the stock used.
4. Enter any sales made for the relevant farm/flock context.
5. Close the operating day after the required records and feed evidence are complete.

### Resolve a discrepancy

1. Open the alert or Record Check.
2. Review the plain-language comparison and source evidence.
3. Optionally ask the AI assistant for evidence-grounded investigation guidance.
4. Open the linked source record and correct it.
5. If the source is locked, submit the prefilled governed-change request and wait for CEO authorization.
6. Apply the approved correction and select **Check again**.
7. The finding clears only when the deterministic rule passes.

### Manage warehouse stock

1. Select an assigned warehouse and month.
2. Review the current balance and automatic operational usage.
3. Receive newly purchased stock against an existing or new catalogue item.
4. Submit the full start-of-month or surprise shelf count.
5. Investigate any variance through Record Checks instead of manually replacing the ledger.
6. Record payroll, utilities, repairs, or other costs separately because expenses do not change stock quantity.

### Produce a management report

1. Choose the reporting period and operational scope on the Reports page.
2. Review data-trust coverage and resolve material gaps where practical.
3. Generate a permanent snapshot.
4. Download the branded HTML report or its CSV evidence export.
5. If recurring reporting is needed, the CEO creates a weekly or monthly schedule and optionally shares it with another active manager.

## Architecture

EthioPoultry is a Next.js application deployed to Cloudflare Workers through OpenNext. Supabase provides authentication and PostgreSQL storage.

```text
Browser
  |
  | authenticated page and API requests
  v
Next.js 16 / React 19 on Cloudflare Workers
  |
  +-- route authorization and Zod validation
  +-- server-only domain modules
  +-- deterministic calculations and reconciliation
  +-- optional Groq AI analysis
  |
  v
Supabase Auth + PostgreSQL
  |
  +-- tenant and assignment-aware RLS
  +-- atomic database functions
  +-- append-only audit and analysis history
  +-- stock, flock, feed, health, sales, and governance ledgers
```

Important architectural boundaries:

- Browser code never receives the Supabase service-role key, Groq key, monitoring token, or administrator activation code.
- Protected workflows go through server routes and domain modules; UI visibility is not treated as authorization.
- Database row-level security (RLS) provides an additional tenant and assignment boundary.
- Official findings and metrics are deterministic. AI output is supplemental guidance.
- Inventory quantities are warehouse-specific, while item definitions are organization-wide.
- Operational source records remain authoritative; notes, actions, and approvals do not silently rewrite them.

## Data integrity and security

The system includes the following controls:

- organization, farm, and warehouse scoping on server reads and writes;
- active assignment windows with expiry and revocation;
- CEO/Farm Manager separation of duties;
- four-hour maximum CEO-approved support sessions;
- seven-day operational entry grace before protected correction is required;
- version checks for governed corrections;
- one-time, value-specific approved corrections with seven-day expiry;
- idempotency identities for stock, reports, monitoring, and other retryable operations;
- append-only governance, action, AI-analysis, monitoring, and sensitive audit evidence;
- per-organization SHA-256 audit hash chains;
- recursive secret redaction from semantic audit snapshots;
- deterministic migration manifests and a cryptographically locked schema baseline; and
- production environment checks that reject local endpoints, project-reference mismatches, weak monitoring tokens, or public secret variables.

Security-sensitive values must never use a `NEXT_PUBLIC_*` name unless they are specifically intended for browser use. Never commit `.env.local`, `.dev.vars`, database URLs, service-role keys, monitoring tokens, or real account credentials.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js `16.3.0`, React `19.2.4`, TypeScript |
| Styling and interface | Tailwind CSS, Lucide icons, Recharts, locally bundled Fraunces and IBM Plex Sans fonts |
| Authentication and database | Supabase Auth, PostgreSQL, row-level security, database functions and triggers |
| AI guidance | Vercel AI SDK, `@ai-sdk/groq`, configurable Groq model (default `openai/gpt-oss-120b`) |
| Validation | Zod |
| Deployment | OpenNext for Cloudflare, Cloudflare Workers, Wrangler |
| Verification | Node test runner, ESLint, TypeScript, Playwright, SQL integration tests, GitHub Actions |

## Project structure

```text
src/
  app/
    admin/                 System Administrator entry and health dashboard
    app/                   Authenticated CEO and Farm Manager pages
    api/                   Authorized server API routes
    auth/                  User sign-in and organization sign-up
  components/              Role workspaces, dashboards, forms, and shared UI
  lib/                     Server/domain modules and deterministic calculations
  utils/supabase/          Browser, server, and middleware Supabase clients

supabase/
  baselines/               Verified data-free production schema baseline
  migrations/              Canonical forward migration history
  seeds/                   Clearly marked demonstration data
  verification/            Database and deployment preflight SQL
  migration-baseline.json  Baseline identity and SHA-256 metadata
  migrations.lock.json     Locked migration-chain manifest

scripts/                   Deployment, database, monitoring, and recovery tooling
tests/                     Unit, contract, browser, RLS, and integration coverage
docs/                      Release, migration, staging, recovery, and readiness guides
```

## Local development

### Prerequisites

- Node.js `22.16.0`
- npm `10.9.2`
- Git
- Docker Desktop or another Docker-compatible runtime for local Supabase
- Supabase CLI (installed through the locked npm dependency graph)
- PostgreSQL `psql` for direct database verification

### Start the application

1. Install the locked dependencies:

   ```powershell
   npm ci
   ```

2. Copy the environment template and replace its placeholders:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start local Supabase when database work is required:

   ```powershell
   npx supabase start
   ```

4. Validate configuration and start Next.js:

   ```powershell
   npm run env:check
   npm run dev
   ```

5. Open `http://localhost:3000`.

`npm run build` uses Webpack deliberately so Windows development and CI use the same production compiler without relying on platform-specific Turbopack bindings. Application fonts are bundled locally, so builds do not need to download fonts.

## Environment configuration

Start from [`.env.example`](.env.example). The main variables are:

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `APP_ENVIRONMENT` | Deployment identity: `local`, `ci`, `staging`, or `production` | Always required |
| `APP_RELEASE` | Immutable release/commit identity | Required for staging and production release evidence |
| `APP_BASE_URL` | Canonical application origin | Always required; local URLs are rejected in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by browser and server clients | Always required |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable browser key | Always required |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database authority | Required by server workflows; never expose publicly |
| `SUPABASE_PROJECT_REF` | Expected remote project identity | Required in staging and production to prevent cross-project deployment |
| `ADMIN_ACCESS_CODE` | Gate for platform administrator onboarding/access | Server-only; use a strong unique value |
| `MONITORING_INGEST_TOKEN` | Authenticates scheduled monitoring, notification, and report dispatch | Server-only; use a different strong value per environment |
| `MANAGED_BACKUPS_REQUIRED` | Makes a missing completed provider backup fail the monitoring job | Set to `false` only while the environment has no managed-backup capability; change to `true` when retention is enabled |
| `RECONCILIATION_AI_ENABLED` | Enables explicit AI analysis on Record Checks | Optional feature flag; defaults to `false` |
| `GROQ_MODEL` | Groq model name | Optional; defaults to `openai/gpt-oss-120b` |
| `GROQ_API_KEY` | Groq provider credential | Required in staging/production only when AI is enabled; server-only |
| `NOTIFICATION_EMAIL_ENABLED` | Enables external notification delivery | Optional; defaults to `false` |
| `NOTIFICATION_EMAIL_FROM` | Verified sender used by Cloudflare Email | Required when external notification email is enabled |
| `DATABASE_URL` | Direct PostgreSQL connection used by database scripts | Required only for database verification or release commands |
| `E2E_*` | Dedicated role accounts for protected browser testing | Required when `E2E_REQUIRE_ROLE_CREDENTIALS=true` |
| `OLLAMA_URL`, `OLLAMA_VISION_MODEL` | Optional local feed-template extraction integration | Optional |

Cloudflare variables needed during compilation must be configured in the build environment. Runtime secrets must also be configured on the Worker. The staging and production projects must use isolated Supabase projects and distinct credentials.

## Database and migrations

The repository uses a verified, data-free baseline plus a locked forward migration chain. Do not edit, rename, or reorder an applied migration.

Use the guarded interfaces instead of raw migration commands:

```powershell
npm run migrations:verify   # verify baseline and migration hashes
npm run db:history:inspect  # compare local and remote migration history (read-only)
npm run db:history:adopt    # one-time metadata adoption after a verified restore
npm run db:deploy           # run preflight and apply pending locked migrations
npm run db:bootstrap        # initialize an empty database from the verified baseline
npm run db:verify           # verify the target database contract
```

Mutating database commands require explicit confirmation variables and verify the target environment and Supabase project reference before applying changes. Read [the migration policy](docs/deployment/migration-policy.md) before any staging or production database operation.

For a disposable local or staging target:

```powershell
$env:DATABASE_URL = "postgresql://user:password@host:port/database"
npm run db:verify
Remove-Item Env:DATABASE_URL
```

Never paste a real database URL into source code, documentation commits, tickets, or logs.

## Testing and verification

### Standard application gate

```powershell
npm run migrations:verify
npm run check
npm run build
```

`npm run check` runs zero-warning ESLint, TypeScript verification, and the Node test suite.

### Database integration tests

```powershell
npm run test:db:integration
```

The database suite creates isolated fixtures inside a transaction, verifies Feed Control and Daily Record synchronization, and rolls the fixtures back.

### Browser role tests

```powershell
npm run test:browser
```

Playwright covers anonymous, CEO, Farm Manager, and System Administrator journeys, including permitted and denied API requests. Use dedicated staging-only accounts; never reuse production credentials.

### Full release gate

```powershell
npm run release:verify
npm run release:manifest
```

The manifest identifies the application release, verified baseline, and exact migration chain that belong together.

## Deployment and operations

The application targets Cloudflare Workers through OpenNext.

```powershell
npm run cloudflare:build
npm run cloudflare:deploy:staging
npm run cloudflare:deploy:production
```

Production releases must follow this order:

1. Verify a clean, immutable candidate commit.
2. Run the complete local release gate and retain the release manifest.
3. Deploy that exact commit to the isolated staging Worker and staging Supabase project.
4. Inspect and apply pending migrations through the guarded database command.
5. Run the protected GitHub **Staging release gate** and role smoke tests.
6. Promote the exact staged commit—never an untested replacement—to production.
7. Verify sign-in, role scope, Daily Records, Feed Control, inventory, sales, alerts, Governance, Record Checks, and reports.
8. Watch application errors, database health, scheduler state, and new reconciliation findings after release.

Do not use deployment as a substitute for migration management. Application deployment and database migration are separate controlled operations.

## Current release boundaries

The core governed poultry workflows are implemented and covered by automated tests. The following operational limitations remain explicit:

- Managed backup retention is not yet established on the current Supabase plan. Production requires either a plan with retained managed backups or an approved, separately secured off-site logical-backup process.
- External notification email remains disabled until a verified sending domain and sender are configured. In-app notifications continue to work independently.
- Staged end-to-end role validation remains an operational release requirement even when unit and build gates pass.
- Mobile and unreliable-connectivity validation is still part of the next delivery wave; offline drafts should be introduced only where field testing proves they are necessary.
- CRM, Fleet, HR, and Training routes are deferred placeholders and are not part of the production release gate.

See [production readiness](docs/production-readiness.md) for the authoritative launch checklist and current evidence status.

## Further documentation

- [Production-readiness gates](docs/production-readiness.md)
- [Release and rollback runbook](docs/deployment/release-runbook.md)
- [Staging environment and validation](docs/deployment/staging-validation.md)
- [Migration policy](docs/deployment/migration-policy.md)
- [Incident recovery runbook](docs/deployment/incident-recovery-runbook.md)
- [Governance rollout notes](docs/item-2-governance-rollout.md)

## License and repository status

This repository is private and does not currently declare an open-source license. Treat its source code, schema, operational procedures, and deployment configuration as proprietary project material unless the repository owner states otherwise.
