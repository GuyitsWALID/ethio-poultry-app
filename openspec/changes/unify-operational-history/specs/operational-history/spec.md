## ADDED Requirements

### Requirement: One authorized read-only History browser
The system SHALL provide Farm Managers and CEOs a single History page with Daily records, Feeding, Deaths and culls, Health and checks, Stock, Sales, Expenses and Day closing categories. It MUST retain existing authoritative ledgers and mutation rules.

#### Scenario: Find an older record
- **WHEN** a user selects a category, date range and authorized context
- **THEN** server-side filtered, stably paginated records remain reachable beyond legacy list limits and details open without leaving History

#### Scenario: Unauthorized or revoked target
- **WHEN** a requested record is outside the current tenant or assignment
- **THEN** the server denies access, the client clears protected details, and no unrelated record is substituted

### Requirement: Corrections retain exact context
History SHALL use existing authorized correction workflows, preserve exact record/finding/approval context and provide a validated local return URL.

#### Scenario: Return after correction
- **WHEN** a user returns from the existing correction workflow
- **THEN** History restores the URL filters and selected source and independently rechecks access

### Requirement: Accessible bilingual navigation
Today-enabled manager navigation SHALL show Today, Flocks, Alerts, History and Reports, with Approvals, Record Checks and Feed templates under More. Enabled CEO navigation SHALL consolidate operational history without activating the broader CEO redesign. Disabled organizations and Admin MUST retain their existing navigation.

#### Scenario: Tablet in Amharic
- **WHEN** an Amharic-speaking user opens a record below 1280px
- **THEN** one detail expands beneath its row, controls have 48px touch targets and dates display in the Ethiopian calendar while API dates remain Gregorian

### Requirement: No protected History caching
History APIs MUST be private/no-store. History MUST NOT write business records or protected evidence into service-worker or offline outbox storage.

#### Scenario: Failed next page
- **WHEN** loading more records fails
- **THEN** loaded records remain visible with Retry and the failure is not represented as an empty or complete history
