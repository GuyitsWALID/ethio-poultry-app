# Spec Delta

## Purpose

Organize daily operations around user intent and role instead of database modules while preserving access to advanced history, corrections, and deep links.

## ADDED Requirements

### Requirement: Farm Manager primary navigation
The Farm Manager primary navigation SHALL contain Today, Flocks, Stock, Sales, Alerts, and History & More.

#### Scenario: Manager signs in
- **WHEN** a Farm Manager completes authentication without a trusted destination
- **THEN** the system routes the manager to Today

#### Scenario: Manager needs advanced history
- **WHEN** the manager expands History & More
- **THEN** the system exposes authorized Daily Record, Feed, Mortality, Health, Daily Close, Governance, Record Check, analytics, and report destinations

### Requirement: Existing route compatibility
Existing authorized operational URLs and trusted deep links SHALL continue to open their original source records during the pilot.

#### Scenario: Notification opens a source record
- **WHEN** a manager follows an existing Action Desk, Governance, or Record Check link
- **THEN** the linked page opens with its exact context and is not redirected to an unrelated Today card

### Requirement: Feature-scoped rollout
Simplified navigation and Today SHALL be enabled by tenant configuration so the pilot organization can use them without forcing an unfinished workflow on other organizations.

#### Scenario: Tenant is not enabled
- **WHEN** a Farm Manager belongs to an organization without the Today feature
- **THEN** the existing navigation and landing behavior remain available

#### Scenario: Tenant is enabled
- **WHEN** a Farm Manager belongs to an enabled organization
- **THEN** the simplified navigation and Today landing are used while legacy routes remain accessible

### Requirement: CEO simplification follows manager validation
The CEO primary workspace SHALL not be reorganized until the Farm Manager pilot acceptance gate passes, after which its primary destinations SHALL focus on Today's status, Needs attention, Performance, and Approvals.

#### Scenario: Manager pilot is still active
- **WHEN** the seven-day pilot has not passed
- **THEN** the existing CEO navigation remains in place apart from the bilingual language control

#### Scenario: CEO simplification is enabled
- **WHEN** the manager pilot passes and the CEO feature flag is enabled
- **THEN** the CEO receives the simplified primary workspace while advanced analytics, reports, access, Governance, and audit history remain available

### Requirement: Accessible responsive navigation
Primary navigation SHALL support keyboard use, screen readers, portrait and landscape tablet layouts, and touch targets of at least 44 CSS pixels.

#### Scenario: Narrow tablet viewport
- **WHEN** the application is used on a portrait tablet
- **THEN** the same primary destinations remain reachable without horizontal scrolling
