# Feature Specification: Chart Look – Sankey Redrawn, Donuts Made Uniform

**Feature Branch**: `15-chart-look-sankey-on-apache-echarts-one-donut-look-011`

**Created**: 2026-11-26

**Status**: Implemented

**Input**: User description: "Für das Sankey Diagramm schaust du bitte mal bei Apache ECharts nach, das aktuelle ist pothässlich. Des Weiteren sind noch nicht alle Donut Diagramme gleich, orientiere dich an dem aus dem Dashboard."

**Origin**: Review of the app on 2026-11-26 at 1440 px (dark mode) on Budget › Sankey, Budget › Analyse, Investments › Dividenden, Investments › Analyse and the dashboard.

## Findings

### A. Sankey (Budget › Sankey page, Sankey card on Budget › Analyse)

| # | Gap found |
|---|---|
| S1 | Blocks are wide flat rectangles; the label sits inside in tiny text and is unreadable on small blocks |
| S2 | Links are a muddy grey-blue instead of the category colours; flows cannot be followed by colour |
| S3 | Spacing between blocks is uneven; small categories at the bottom are squeezed together and their labels overlap |
| S4 | The whole drawing looks dated compared with the rest of the app (no rounded corners, no colour gradient, no smooth transition) |

### B. Donuts (reference: the dashboard Aufteilung donut)

| # | Place | Gap found |
|---|---|---|
| D1 | Budget › Analyse › Kategorien | Larger ring, thicker ring, no gaps or rounded ends between slices, much larger centre text |
| D2 | Investments › Dividenden › Aufteilung | Smaller, thinner ring, no centre text (no total, no hovered amount) |
| D3 | Investments › Analyse › Aufteilung | Same look as the dashboard; check only |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sankey that is pleasant to read (Priority: P1)

The owner opens Budget › Sankey and sees at a glance where the income of the period goes: income on the left, main categories in the middle, sub categories on the right, plus what is left (Saldo). Every flow has the colour of its category, blocks are slim with their name and amount next to them, and hovering a block or flow highlights everything connected to it.

**Why this priority**: The owner called the current Sankey ugly; it is the main visual of the budget area.

**Independent Test**: Open Budget › Sankey for a month with bookings; compare with the findings S1–S4; hover, click and switch €/%.

**Acceptance Scenarios**:

1. **Given** a month with income and expenses, **When** the owner opens Budget › Sankey, **Then** three columns appear (income → main categories → sub categories) plus a Saldo block when income exceeds expenses, each flow coloured from its source to its target category colour.
2. **Given** the Sankey, **When** the owner reads a block, **Then** its name and amount (or share in % after switching to %) stand next to the block in normal reading size, without overlapping another label.
3. **Given** the Sankey, **When** the owner hovers a block or a flow, **Then** that element and everything connected to it stays fully visible, the rest fades, and a tooltip shows name, amount and share of income.
4. **Given** the Sankey page, **When** the owner clicks a category block, **Then** the bookings below are filtered to that category as today; clicking it again (or the empty area) clears the filter.
5. **Given** Budget › Analyse, **When** the owner looks at the Sankey card, **Then** it shows the same drawing in a compact height and a click opens the category as today.
6. **Given** dark or light mode, **When** the Sankey is shown, **Then** background, labels and tooltip follow the app theme.

---

### User Story 2 - All donuts look the same (Priority: P2)

Every donut in the app looks like the dashboard Aufteilung donut: same diameter, same ring thickness, small gaps and rounded ends between slices, the total in the centre with a short label, and the hovered slice's amount and name in the centre while hovering.

**Why this priority**: Consistency; smaller visual change than the Sankey.

**Independent Test**: Open the dashboard, Budget › Analyse, Investments › Analyse and Investments › Dividenden; compare the donuts side by side.

**Acceptance Scenarios**:

1. **Given** the four pages, **When** the owner compares the donuts, **Then** diameter, ring thickness, gaps, rounded ends and centre text style are identical.
2. **Given** the Dividenden Aufteilung donut, **When** no slice is hovered, **Then** the centre shows the total amount and a label; **When** a slice or list row is hovered, **Then** the centre shows that item's amount and name.
3. **Given** the Budget categories donut, **When** the owner hovers a slice, **Then** the list row lights up and the centre shows the category as today; clicking still opens the category.

---

### User Story 3 - Works on every screen size (Priority: P3)

The redrawn Sankey and the donuts stay usable at phone (375 px), tablet (768 px) and desktop (1440 px) width without page-level sideways scrolling.

**Why this priority**: Guard against regressions of the 010 layout work.

**Independent Test**: Layout guard at 375 / 768 / 1440 px on all pages.

**Acceptance Scenarios**:

1. **Given** a phone width, **When** the owner opens Budget › Sankey, **Then** the page does not scroll sideways; the Sankey either fits or scrolls inside its own card.
2. **Given** reduced motion is set in the system, **When** a chart appears, **Then** it shows without animation.

### Edge Cases

- Month without bookings: empty state as today, no empty drawing.
- Expenses larger than income: no Saldo block; flows still add up; shares refer to income (or to expenses when income is zero, as today).
- Many small sub categories: labels must not overlap; very small blocks may hide their label and show it in the tooltip only.
- Category without colour: default colour as today.
- Switching period or €/% while hovering: highlight resets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sankey MUST show the levels income → main categories → sub categories, plus a Saldo block when income exceeds expenses, in the existing order that avoids crossing flows.
- **FR-002**: Each flow MUST be coloured with a gradient from its source block colour to its target block colour; blocks MUST use the category colour.
- **FR-003**: Blocks MUST be slim with rounded corners and a consistent gap between them; labels (name and amount or %) MUST stand next to the block in at least the app's small text size.
- **FR-004**: Hovering a block or flow MUST highlight it and everything connected and fade the rest; a tooltip MUST show name, amount and share.
- **FR-005**: The €/% switch MUST change the labels and tooltip between amount and share of income.
- **FR-006**: Clicking a category block on the Sankey page MUST filter the bookings below as today; on the Analyse card it MUST open the category as today.
- **FR-007**: The Sankey MUST follow the dark and light theme, adapt to the card width and use a compact height on the Analyse card.
- **FR-008**: The Sankey MUST respect the system's reduced-motion setting.
- **FR-009**: All donuts (dashboard Aufteilung, Investments › Analyse, Investments › Dividenden, Budget categories) MUST share the dashboard donut's diameter, ring thickness, slice gaps, rounded ends, hover halo and centre text style.
- **FR-010**: Every donut MUST show the total and a label in the centre and, while a slice or its list row is hovered, that item's amount and name.
- **FR-011**: Existing behaviour MUST stay: list ↔ donut hover link, click to open a category, empty states, legend/list next to the donut.
- **FR-012**: No page may scroll sideways at 375, 768 and 1440 px.

### Key Entities

- **Sankey graph**: blocks (income, main category, sub category, Saldo) with colour and amount; flows with source, target and amount. Data comes from the existing budget Sankey data; no change to it.
- **Donut item**: key, amount, colour, label. No change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner rates the new Sankey as clearly better than today in a side-by-side look (findings S1–S4 resolved).
- **SC-002**: All labels of a typical month (≥ 15 categories) are readable without overlap at 1440 px; blocks too small for a label still show it in the tooltip.
- **SC-003**: The four donuts measure the same diameter and ring thickness (±1 px) and use the same centre text style.
- **SC-004**: Zero page-level sideways scroll on all pages at 375, 768 and 1440 px.
- **SC-005**: Filtering bookings by clicking a Sankey category works as before (existing tests stay green).

## Assumptions

- Only the Sankey switches to a new drawing library; donuts and other charts keep their current drawing and only change look.
- The budget categories donut drops its no-gap look (decided in 007 to match the reference); the owner now wants the dashboard look everywhere.
- The Sankey's data and order logic stay unchanged.
- Local only; no deployment.
