# Feature Specification: Broker Sync and Open Follow-ups

**Feature Branch**: `4-broker-sync`

**Created**: 2026-11-24

**Status**: Implemented

**Input**: User description: "Offene Arbeit aus Features 001–003 bündeln (Stand 2026-11-24): (1) Scalable Capital Sync aus 001 US3 (T054–T058) … (2) Folgearbeit aus 003: Wertentwicklungs-Chart nach Assetklasse filtern … Nicht im Umfang: Deployment (eigener Plan, erst alles lokal testen) und Live-Bankabruf für Girokonten."

## Overview

A review of issues #1, #3 and #4 on 2026-11-24 found these items still open. Everything else is delivered and verified.

| Source | Open item | Why it is still open |
|---|---|---|
| 001 US3 (T054–T058) | Scalable Capital sync | Needs the owner's own Scalable login and consent; never started |
| 003 US5 (T056 deviation) | Performance chart filtered by asset class | The chart is built from depot-level values; a per-security value history is missing |

The open tasks are moved here. Issues #1, #3 and #4 are closed with a reference to the new issue.

Deployment (001 T079–T083) is **not** part of this feature. Everything is tested locally first; deployment gets its own plan later.

Not in scope: live retrieval of checking-account data (for example Sparkasse). It needs a separate decision between a direct bank protocol with its own product registration and a licensed account-information service. See Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync my Scalable Capital depot (Priority: P1)

As the owner, I connect my Scalable Capital account once via Scalable's official connection. After that, positions, bookings and the cash balance refresh without manual exports:

- With "Synchronisieren" in Einstellungen › Datenquellen.
- With "Aktualisieren" in Portfolios & Konten.
- Optionally once a day.

**Why this priority**: The depot is the largest part of the net worth. Today it only updates through CSV exports.

**Independent Test**: Connect, synchronise, and compare positions and the reference account with Scalable's own view.

**Acceptance Scenarios**:

1. **Given** no connection, **When** I choose "Scalable Capital verbinden", **Then** I complete login and consent myself in Scalable's own flow. The app stores only the resulting access grant, encrypted.
2. **Given** a connection, **When** I press "Synchronisieren" or "Aktualisieren", **Then** new bookings are added without duplicates. Positions and cash match Scalable within the same day, and the card shows the time of the last sync.
3. **Given** a sync is already running, **When** I start another, **Then** the second request is refused with a clear message.
4. **Given** the grant expired or was revoked, **When** a sync runs, **Then** the source shows "Neu verbinden". No data is lost, and the last state stays visible.
5. **Given** the daily sync is switched on, **Then** one sync runs per day. It is off by default.
6. **Given** I choose "Verbindung trennen", **Then** the grant is deleted. Imported data stays.

---

### User Story 2 - Performance chart by asset class (Priority: P3)

As the owner, I click an asset-class chip (e.g. "ETF") and both the positions table and the performance chart show only that asset class.

**Why this priority**: Visual completeness. Today the chips filter only the table.

**Independent Test**: Select "ETF" and check that the chart's value equals the sum of the ETF positions shown in the table.

**Acceptance Scenarios**:

1. **Given** the chip "ETF", **Then** the chart shows value, invested capital and return of ETF holdings only, over the selected period.
2. **Given** "Alle", **Then** the chart is identical to today's chart.
3. **Given** an asset class without holdings in part of the period, **Then** the chart shows 0 for that time, never "NaN".

### Edge Cases

- Scalable's connection is unreachable: the sync fails with a clear message, and the last data stays.
- A booking already imported via CSV comes again through the sync: it is detected as a duplicate and not doubled.
- A booking the owner deleted comes again through the sync: it stays deleted (deleted-import markers from 003).
- Two depots at Scalable: each becomes its own depot with its reference account.
- A security without prices for part of the period: the asset-class chart carries the last known price forward, like the depot chart.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to connect, synchronise and disconnect Scalable Capital in Einstellungen › Datenquellen. Login and consent always happen in Scalable's own flow, never in this app.
- **FR-002**: The access grant MUST be stored encrypted and never be returned by the app's interface.
- **FR-003**: A sync MUST import positions, bookings and cash balances idempotently. Repeated syncs MUST NOT create duplicates, including against earlier CSV imports, and MUST respect deleted-import markers.
- **FR-004**: Only one sync per source may run at a time. A running sync MUST reject a second start.
- **FR-005**: "Aktualisieren" in Portfolios & Konten MUST start the sync for accounts whose source supports it, and show the last sync time.
- **FR-006**: An optional daily sync MUST exist, switched off by default.
- **FR-007**: The performance chart MUST filter by the asset class selected in the positions chips, with value, invested capital and return.

### Key Entities

- **Data source connection**: Provider, status (active, needs re-auth, error, disabled), encrypted grant, last sync time, last error.
- **Sync run**: Start, end, result (imported, skipped, failed), error text; one at a time per source.
- **Instrument value history**: Daily value and invested amount per security per depot, derived from bookings and prices; basis for asset-class charts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a sync, positions and cash of the Scalable depot match Scalable's own view to the cent for 100 % of positions.
- **SC-002**: Ten syncs in a row add no duplicate bookings.
- **SC-003**: A manual sync completes in under 1 minute for 5 years of history.
- **SC-004**: No private infrastructure value appears in the public repository, issues or pull requests (checked by the leak guard on every commit).
- **SC-005**: For every asset class, the chart's current value equals the sum of that class's positions in the table.

## Assumptions

- Scalable Capital offers an official connection for its customers that the owner may use for their own depot. The owner does login and consent personally (001 US3).
- Everything in this feature is verified on the local dev server (web 3100, API 3101); deployment follows in a separate plan.
- **Live bank data for checking accounts is out of scope.** Research on 2026-11-24 found these routes:
  - The reference tool uses licensed account-information services (wealthAPI, finAPI) under PSD2. Banks ask for a renewed consent about every 90 days.
  - For a self-hosted app, the realistic routes are:
    - The bank protocol FinTS (PIN/TAN). It needs a free product registration with the Deutsche Kreditwirtschaft, which takes days to weeks.
    - A PSD2 service with a free mode for one's own accounts, e.g. Enable Banking.
  - GoCardless Bank Account Data no longer accepts new sign-ups (since July 2025).
- The per-security value history is derived from existing bookings and prices. No new external data is fetched.
