## ADDED Requirements

### Requirement: Farm-owned warehouse access follows farm assignment
The system SHALL grant an active same-tenant Farm Manager access to every active warehouse of an assigned farm and SHALL require an explicit assignment for shared warehouses, including feeding. Historical direct grants SHALL NOT override farm revocation. Existing operational compatibility, stock, lock and approval checks SHALL remain.

#### Scenario: Inherited store access
- **WHEN** a manager has an active farm assignment and no warehouse grants
- **THEN** every active warehouse belonging to that farm is accessible in Today, legacy workflows and Reports

#### Scenario: Shared store denied
- **WHEN** a manager has farm access but no shared-store grant
- **THEN** feeding and other operations using that shared store are denied

#### Scenario: Assignment ends
- **WHEN** farm access expires or is revoked
- **THEN** inherited warehouse access ends and old direct store grants do not preserve it

### Requirement: One manager and immediate audited handover
The system SHALL reject overlapping non-revoked manager assignment periods for a farm. CEO handover SHALL atomically replace the assignment, transfer unfinished farm/store fixes, preserve evidence/deadlines/escalation, require new acknowledgement and publish durable audit/notification evidence. Submitted verification work SHALL remain unchanged. Stale or concurrent requests SHALL NOT partially mutate state.

#### Scenario: Handover confirmation
- **WHEN** the CEO confirms a fresh preview with a reason
- **THEN** old inherited access ends, new inherited access starts and unfinished work transfers exactly once

#### Scenario: Stale handover
- **WHEN** assignment or previewed work changed before confirmation
- **THEN** handover fails without changing assignments or work

### Requirement: Safe migration and compatibility
The system SHALL preflight assignment overlaps, warehouse ownership, shared-feeding access and scheduled replacements. Unresolved conflicts SHALL block deployment. No manager, warehouse ownership or shared access SHALL be guessed. Source records SHALL remain unchanged and disabling Today SHALL NOT restore obsolete permissions.

#### Scenario: Conflicting existing managers
- **WHEN** preflight finds overlapping manager assignments
- **THEN** deployment stops for an explicit operator decision
