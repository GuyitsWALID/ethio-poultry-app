# Staging environment and validation

Staging must be isolated from production: separate Supabase project, credentials, application URL, storage, scheduled jobs, and test users. Production service-role keys must never be configured in staging.

## GitHub environment

Create a protected GitHub environment named `staging` with an approval requirement and these secrets:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SUPABASE_PROJECT_REF`
- `STAGING_DATABASE_URL`
- `STAGING_ADMIN_ACCESS_CODE`

Deploy the candidate commit through the hosting provider's immutable preview or staging deployment. Then manually run **Staging release gate** and supply that deployment's HTTPS URL.

## Cloudflare Workers staging

The repository pins `@opennextjs/cloudflare` and Wrangler and owns both `wrangler.jsonc` and `open-next.config.ts`. Do not use `npx wrangler deploy` to auto-migrate the project during a release.

Use these Cloudflare Workers Build settings for the staging Worker:

- Build command: `npm run cloudflare:build`
- Deploy command: `npx wrangler deploy --env staging --keep-vars`
- Worker name: `ethio-poultry-app-staging` (declared by the `staging` Wrangler environment)

Configure the following in both **Build variables and secrets** and the Worker's **Runtime variables and secrets** where applicable:

- `APP_ENVIRONMENT=staging`
- `APP_RELEASE=<the full candidate commit SHA>`
- `APP_BASE_URL=https://<the staging Worker hostname>`
- `NEXT_PUBLIC_SUPABASE_URL=https://uzmhpecehmlwojdmitgj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging publishable key>`
- `SUPABASE_SERVICE_ROLE_KEY=<staging service-role secret>`
- `SUPABASE_PROJECT_REF=uzmhpecehmlwojdmitgj`
- `RECONCILIATION_AI_ENABLED=true` when validating the Record Checks advisor
- `GROQ_MODEL=openai/gpt-oss-120b`
- `GROQ_API_KEY` as a server-only secret when the advisor is enabled
- `ADMIN_ACCESS_CODE=<strong staging-only secret>`

Never copy `.dev.vars` into a deployment or use it as a substitute for runtime bindings. The `--keep-vars` flag preserves values configured in the Cloudflare dashboard.

For the first staging setup, restore the verified data-free baseline with `npm run db:bootstrap`, or use `npm run db:history:adopt` when the schema has already been restored and passed the baseline preflight. Routine releases use `npm run db:deploy`. Do not run the legacy date-only migrations directly against an empty database.

## Required smoke evidence

- Anonymous access is redirected to sign-in and `/api/me/context` returns `401`.
- CEO can view all tenant farms, reconciliation, governance, reports, inventory, and sales but cannot submit routine farm operations.
- Farm manager can write only within active farm and warehouse assignments.
- An expired or revoked assignment receives `403`.
- Daily Record save and Feed Control close produce one synchronized feed total and one inventory issue.
- Reopen/reclose is idempotent and preserves non-feed Daily Record fields.
- Physical inventory count creates a reconciliation variance when the count differs from the ledger.
- Locked operating-day changes require an approved correction.
- Retired and unknown roles are denied.
- Alert dropdown and `/app/reconciliation` load without server errors.

Record screenshots or test output, the release manifest, the database preflight output, and the reviewer decision. Test data must be clearly marked and must not contain copied production personal data.
