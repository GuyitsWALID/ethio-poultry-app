# Design

## Boundaries
History filters -> authorized server-only readers -> existing tables -> summaries/details.
No business writes. Correction links -> existing authorized editor -> validated local History return.

The list defaults to Daily records, 30 inclusive Addis Ababa operating dates and all authorized farms. URL state takes precedence over remembered page filters. Exactly one detail expands directly beneath its selected row at every screen width. Clicking the selected row again closes it without scrolling to the top. This replaces the initial desktop split view following usability feedback. No modal or analytics dashboard.

## Sources
| Category | Authoritative evidence |
| --- | --- |
| Daily records | daily_farm_records; linked stock_ledger routine usage |
| Feeding | feeding_session_records (completed/missed); feed_day_closures |
| Deaths/culls | daily_farm_records official counts; mortality_events supporting allocations (not additional losses) |
| Health/checks | health_events; recorded vaccination completion evidence; biosecurity_checks; weight_records |
| Stock | stock_ledger canonical movements through the internal history_stock_movements date projection; inventory_physical_counts |
| Sales | daily_sales_records |
| Expenses | cost_entries |
| Day closing | farm_operating_days |

Adapters select explicit fields. UUIDs are internal identities, never visible field values. Operational dates sort descending, followed by source kind and ID descending. Read 51 rows per source, merge to 50, and bind the next cursor to all list filters. Scope predicates are applied in SQL before limits; permission failures are never empty-history success.

Schema verification found stock_ledger.transaction_date is timestamptz. Migration 20261018000000 adds a service-role-only, security-invoker read view projecting its Africa/Addis_Ababa operating date. This avoids midnight-boundary and same-date pagination omissions without rewriting ledger dates or quantities. The application still independently authorizes tenant and effective warehouse scope. Browser roles receive no view grant.

Farm access uses current, non-revoked assignments; warehouse access uses the effective-access helpers, including explicit shared-store grants. Archived identities are not excluded. Cross-scope selections fail closed. All reads are private/no-store and excluded from offline storage. Errors retain filters; failed pagination retains already loaded records. Permission failures clear protected details.

## Compatibility and rollout
Today-enabled organizations receive new navigation for managers and the limited CEO cleanup. Legacy routes, exact correction targets, configuration and disabled-tenant navigation stay intact. Reports calculations and the broader CEO rollout gate do not change. No business-data migration is planned; any proven index requirement must be a separately verified forward migration.
