# Spec Delta

## Purpose

Provide Farm Managers with one plain daily workspace that derives required work from authoritative farm records and safely finishes the operating day.

## ADDED Requirements

### Requirement: Assigned daily context
The system SHALL present a Today workspace containing only farms and flocks the signed-in Farm Manager is currently authorized to operate, using the Addis Ababa operating date by default.

#### Scenario: Manager opens Today
- **WHEN** an assigned Farm Manager opens the application
- **THEN** the system opens Today with the assigned farm, current Addis Ababa date, and an applicable flock selected

#### Scenario: Unauthorized target
- **WHEN** a user requests a farm, flock, or date outside their current assignment or operating window
- **THEN** the system rejects the request without exposing that target's operational data

### Requirement: Deterministic job applicability
The system SHALL derive required jobs separately for every flock active during any portion of the selected operating day and SHALL derive optional farm-level jobs from applicable records and assignments.

#### Scenario: Layer flock
- **WHEN** a layer or parent-stock flock is active on the selected date
- **THEN** Today requires bird movement, feed, eggs and water, health and deaths, and routine-supply confirmation

#### Scenario: Non-layer flock
- **WHEN** a broiler or rearing flock is active on the selected date
- **THEN** Today requires bird movement, feed, water, health and deaths, and routine-supply confirmation without displaying egg inputs

#### Scenario: No active flock
- **WHEN** the farm has no flock active on the selected date
- **THEN** Today shows no active flock work while keeping applicable stock, sale, expense, assigned-fix, and Finish day actions available

### Requirement: Authoritative prefilling
The system SHALL prefill identity, age, opening population, prior closing population, batch, and other trusted values from authoritative records and SHALL not ask the manager to re-enter calculated values.

#### Scenario: Previous closing count exists
- **WHEN** a prior authoritative Daily Record supplies the opening balance
- **THEN** Today displays that balance as the starting bird count and identifies its source date

#### Scenario: Required source is missing
- **WHEN** an authoritative opening value cannot be derived
- **THEN** the affected card enters Needs attention and links to the exact correction or governed-change workflow

### Requirement: Observable job state
Each Today job SHALL expose exactly one derived state: Not started, Draft on tablet, Waiting to sync, Complete, or Needs attention. Completion SHALL be derived from authoritative server evidence rather than stored as an independent business result.

#### Scenario: Explicit zero activity
- **WHEN** a manager confirms zero deaths, no health problem, or no routine supplies and the confirmation synchronizes successfully
- **THEN** the corresponding job can become Complete without creating a false operational event

#### Scenario: Source changes after completion
- **WHEN** a completed source is reopened, corrected, voided, or reversed
- **THEN** the system recalculates the affected job and removes Complete when its requirements are no longer satisfied

#### Scenario: Validation failure
- **WHEN** a synchronized command fails authorization, lock, stock, category, or revision validation
- **THEN** the affected job becomes Needs attention with a plain explanation and an exact recovery action

### Requirement: Focused data entry
Today SHALL use focused cards or sheets with one primary action, progressive disclosure, field-level guidance, and touch targets of at least 44 CSS pixels.

#### Scenario: Conditional details
- **WHEN** the manager records a non-zero death, treatment, vaccination, or supply usage
- **THEN** the system reveals only the additional evidence and inventory fields required for that event

#### Scenario: Small choice set
- **WHEN** a field has between two and five practical options
- **THEN** the system presents large choice controls instead of requiring a compact dropdown

### Requirement: Existing ledgers remain authoritative
Today SHALL execute work through the existing Daily Record, Feed, Health, Mortality, Inventory, Sales, Expenses, Action Desk, Governance, and operating-day rules, including their atomic stock and audit behavior.

#### Scenario: Feed day closes
- **WHEN** the manager completes all required feed sessions and closes feeding from Today
- **THEN** the existing feed close synchronizes Daily Record feed totals and deducts inventory exactly once

#### Scenario: Health stock is insufficient
- **WHEN** a treatment or vaccination requires more stock than is available
- **THEN** neither the operational event nor the inventory movement is committed

### Requirement: Review and Finish day
The system SHALL provide a Review step that lists complete jobs, missing jobs, queued drafts, rejected work, feed status, and required corrections before Finish day is enabled.

#### Scenario: Day is ready
- **WHEN** the user is online, authorized, has no pending or rejected commands, holds fresh relevant revisions, and every applicable required job is complete
- **THEN** Finish day atomically revalidates authoritative records and closes the operating day exactly once

#### Scenario: Concurrent source change
- **WHEN** a source changes between Review and Finish day
- **THEN** the close is rejected with the exact jobs that must be refreshed or corrected

#### Scenario: Device is offline
- **WHEN** the manager attempts Finish day without server connectivity
- **THEN** the system preserves local work and explains that synchronization is required before the day can close

### Requirement: Advanced correction continuity
Today SHALL preserve existing deep links and SHALL route locked, historical, ambiguous, or governed corrections to the exact authoritative source workflow.

#### Scenario: Locked Daily Record needs correction
- **WHEN** the manager tries to change protected historical work
- **THEN** Today opens the existing prefilled Governance path rather than bypassing the lock
