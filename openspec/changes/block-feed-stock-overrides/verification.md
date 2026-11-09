# Combined findings 8–9 checks — 2026-11-09

609 unit tests passed. All 30 database integration files passed in a dedicated disposable copy, after applying both forward migrations to the security-hardened fixture schema. The real historical preflight queries also executed successfully. No source clone or normal local database was modified.

Shortage regressions try both Farm Manager and CEO actors, with null, manager and fabricated CEO reason text. Every attempt is rejected before closure, Daily Record feed fields or stock postings change. A receipt through the existing inventory RPC then allows a successful close; repeated closure leaves exactly one canonical deduction. Finding 8's voided-session, pending-session, feed-type, unassigned-store, preservation and reopen/reclose assertions still pass.

Legacy UI/API no longer offers or forwards reason-based stock permission. Today version-one queued payloads retain their accepted shape, but the database never treats text as authority. New shortage guidance has English/Amharic catalog coverage. Historic override notes remain readable.

Read-only production preflight found zero voided-closure candidates, zero legacy-override closure candidates and zero current feed item/store deficits. No historical data repair is proposed. Production migration and application release are gated on the fresh encrypted backup, static checks and release CI.

Findings 10–20 remain outside this release. Signed-in production usability checks are not inferred from SQL/API regression results.
