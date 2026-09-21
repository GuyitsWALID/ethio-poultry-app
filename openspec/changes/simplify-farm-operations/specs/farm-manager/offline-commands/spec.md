# Spec Delta

## Purpose

Allow authorized Farm Managers to capture the current operating day's work during connectivity loss and synchronize it without duplicate or silent conflicting mutations.

## ADDED Requirements

### Requirement: Current-day offline authorization
The system SHALL allow offline drafting only after a successful online sign-in and load of an assigned Today workspace, and that offline authorization SHALL expire at the next Addis Ababa operating day.

#### Scenario: Connection drops during work
- **WHEN** an authorized manager loses connectivity after Today has loaded
- **THEN** the manager can continue drafting work for the loaded farm, flocks, and date

#### Scenario: New operating day begins
- **WHEN** the device reaches the next Addis Ababa operating day without reconnecting
- **THEN** new editing is locked until online authentication and assignment refresh succeed

#### Scenario: Offline sign-in
- **WHEN** a signed-out user has no network connection
- **THEN** the system does not permit offline authentication or reveal cached operational content

### Requirement: Durable local drafts and outbox
The system SHALL persist Today drafts and queued commands across refreshes, browser restarts, and application-shell updates using storage isolated by tenant and user.

#### Scenario: Browser restarts offline
- **WHEN** a manager restarts the browser during the authorized operating day
- **THEN** the system restores the draft and clearly labels it Saved on tablet

#### Scenario: Storage cannot accept a write
- **WHEN** browser storage is unavailable or full
- **THEN** the system blocks the affected save, retains already stored commands, and gives a recovery instruction

### Requirement: Ordered foreground synchronization
The system SHALL synchronize queued commands in dependency order whenever a usable connection is available and SHALL not depend on browser background-sync support.

#### Scenario: Feed close depends on sessions
- **WHEN** feed-session commands and a dependent feed-close command are queued
- **THEN** all required session commands are applied before the close is attempted

#### Scenario: Partial queue failure
- **WHEN** one command is rejected
- **THEN** independent commands may continue while dependent commands remain blocked with an explanation

### Requirement: Transactional idempotency
Every mutating command SHALL carry a durable client command ID and payload hash, and receipt claiming, authoritative mutation, and result persistence SHALL share one database transaction.

#### Scenario: Same command is retried
- **WHEN** the same organization, user, command ID, and payload are received again
- **THEN** the system returns the stored result without repeating the domain mutation

#### Scenario: Command ID is reused with different data
- **WHEN** a prior command ID is submitted with a different payload hash
- **THEN** the system rejects it as an idempotency conflict and performs no mutation

#### Scenario: Domain validation fails
- **WHEN** the authoritative operation rejects the command
- **THEN** the transaction leaves no partial receipt, stock movement, sale, health event, or operational record

### Requirement: Per-resource concurrency
Mutable commands SHALL include the revision of the record they intend to change, while append-only commands SHALL use idempotency and current authorization without a workspace-wide overwrite rule.

#### Scenario: Unrelated record changed
- **WHEN** another user changes an unrelated Today card
- **THEN** the manager's command for an unchanged resource is not rejected solely because the workspace changed

#### Scenario: Target record changed
- **WHEN** the target resource revision no longer matches
- **THEN** the command returns conflict with readable tablet and server values and does not overwrite either silently

### Requirement: Server reauthorization
The server SHALL recheck tenant, role, assignment, operating window, day lock, item category, stock balance, and relevant revisions for every synchronized command.

#### Scenario: Assignment was removed offline
- **WHEN** a queued command synchronizes after the manager lost the relevant assignment
- **THEN** the command is rejected and its local evidence remains available for supervised recovery without changing business data

### Requirement: Minimal protected caching
The offline implementation SHALL cache only the application shell and minimum previously authorized Today context, SHALL mark private operational responses non-publicly cacheable, and SHALL clear accessible business data when the identity or tenant changes.

#### Scenario: User signs out
- **WHEN** a user signs out successfully
- **THEN** the system removes that user's readable Today snapshots, drafts, and outbox from browser storage

#### Scenario: Protected evidence route
- **WHEN** the service worker handles CEO, Admin, Governance evidence, or protected audit requests
- **THEN** it bypasses persistent runtime caching

### Requirement: Cross-browser web baseline
The system SHALL support online operation and foreground offline synchronization in current Chrome, Edge, Firefox, and Safari, while treating installation and background synchronization as progressive enhancements.

#### Scenario: Background Sync is unavailable
- **WHEN** the browser does not implement Background Sync
- **THEN** queued work synchronizes when the application is foregrounded and connectivity returns
