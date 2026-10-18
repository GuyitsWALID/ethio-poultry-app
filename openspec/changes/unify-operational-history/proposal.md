# Unified History and Simplified Navigation

## Why
Farm Managers and CEOs currently visit separate operational pages to find past records. A single read-only browser reduces navigation without merging ledgers or weakening corrections.

## What Changes
- Add `/app/history` with eight categories, date/context filters, cursor pagination and in-place details.
- Add tenant/assignment-authorized History list and detail APIs over existing source records.
- Keep corrections in their existing exact-record workflows with a safe return to History.
- Promote History and Reports in Today-enabled navigation. Retain legacy routes and disabled-tenant behavior.
- Enable flock-filtered History links and English/Amharic controls, including Ethiopian dates.

## Non-goals
No new ledger, business mutation endpoint, report formula, offline History cache, export, embedded correction editor or broader CEO redesign.

## Related Changes
Extends `simplify-farm-operations`. This is a narrow, explicit exception to Task 7.4's unchanged CEO sidebar, not activation of `simplified_ceo_workspace`. Production release still requires separate approval.
