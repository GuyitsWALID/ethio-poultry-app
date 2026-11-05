# Farm Assignment Includes Farm Warehouse Access

## Why

Separate farm and warehouse grants make routine work fail after a manager is assigned to a farm. Feeding currently bypasses the separate shared-store grant, making permissions inconsistent. This change supports `simplify-farm-operations` without merging ledgers or weakening approvals.

## What Changes

- One active manager per farm; non-overlapping non-revoked assignment periods.
- Farm assignments include all active farm-owned warehouses. Shared warehouses require explicit grants, including feeding.
- Farm revocation ends inherited access even if an old warehouse grant exists.
- Immediate CEO-confirmed handover atomically replaces access and transfers unfinished assigned fixes; submitted work remains awaiting verification.
- Shared database-backed access across Today, legacy pages, Reports, Governance, reconciliation, audit and operational SQL.
- Read-only release preflight; no automatic manager choice, warehouse classification or shared access grant.

## Capabilities

### New Capabilities

- `access/farm-warehouse-inheritance`: Effective access, one-manager enforcement and atomic handover.

### Modified Capabilities

None. Existing routes and ledger operations remain; their permission checks change consistently.

## Impact

Forward migrations, shared server authorization, assignment response metadata, bilingual setup/permission messages, handover preview/confirmation, integration tests and staging validation. Preserve Task 7.6 in commit `4ada05e`. Production requires separate approval. Disabling Today does not disable this access model.
