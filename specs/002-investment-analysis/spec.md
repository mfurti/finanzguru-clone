# Feature Specification: Investment Analysis, Dividends, Taxes and Watchlists

**Feature Branch**: `2-investment-analysis`

**Created**: 2026-11-23

**Status**: Implemented

**Input**: User description: "Investment-Analyse und Erweiterungen für Vermögenskompass (Lücken-Analyse Referenz-Tool vs. Dev-Seite, 2026-11-23). Analyse-Seite (Aufteilungen nach Assetklassen, Regionen, Branchen, Währungen, Volatilität, Rendite, eigene Aufteilung; Rendite als Linie/Heatmap/Balken; Wertentwicklung pro Jahr mit IZF, Inflation, Realrendite; Portfoliovergleich), Dividenden, Steuern (Freistellungsaufträge, Vorabpauschale), Benchmark-Vergleich, Watchlists, Buchungen als Tabelle, Budget-Kreisdiagramm. Nicht im Umfang: Teilen, Reverse Breakdown, Werbung/PLUS. Feature 001 hat noch offene Arbeit (US3 Scalable, Deploy), die erhalten bleibt."

## Overview

Feature 001 delivered the four main tabs (Übersicht, Investments, Budget, Versicherung). A side-by-side review of the reference tool and the local dev site on 2026-11-23 showed these gaps, all inside the Investments and Budget areas:

| Area | Reference | Dev site today |
|---|---|---|
| Analyse | Breakdown by asset class, region, sector, currency, volatility, return, custom groups; return line/heatmap/bars; yearly IZF vs. inflation vs. real return; portfolio comparison | Asset classes only (table on Positionen) |
| Dividenden | Last 12 months, Ø per month, yield, CAGR, yearly history, per security, calendar | Dividends only as transactions and a KPI row |
| Steuern | Exemption orders per broker with allowance used, Vorabpauschale estimate | – |
| Vergleichen mit | Benchmark line in the net-worth and investment charts | – |
| Watchlists | Lists of securities with price development | – |
| Buchungen | Table with Depot, Kaufpreis, Steuern, Gebühren, Gesamtbetrag, filter, export | Simple list |
| Budget | Pie chart next to the category list | Category list only |

Everything stays self-hosted for one owner with data stored locally. No new external data feeds: values that the reference gets from market-data providers (regions, sectors, benchmark prices, dividend dates) are entered by the owner or imported from CSV.

Open work from feature 001 stays in 001 and is not replaced: US3 Scalable Capital sync (T054–T058) and the deployment (T079–T083).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyse portfolio composition and returns (Priority: P1)

The owner opens Investments › Analyse and sees how the portfolio is split by asset class, region, sector, currency, volatility class and return class, plus any custom grouping they defined. For each instrument they can store weighted regions, sectors and currencies once (for example an ETF with 60 % USA, 15 % Europe). They see their return over time as a line, as a month × year heatmap and as yearly bars, and a yearly table with IZF, inflation and real return. They can compare the return of two or more depots.

**Why this priority**: Understanding diversification and real returns is the main reason to track investments; it builds only on data that already exists.

**Independent Test**: With the demo data, set region weights on one ETF, open Analyse and check that the region split, heatmap and yearly table show plausible, consistent figures.

**Acceptance Scenarios**:

1. **Given** positions with stored region weights, **When** the owner selects "Regionen", **Then** each region shows value and share, and the shares add up to 100 % (instruments without weights appear as "Nicht zugeordnet").
2. **Given** an instrument without classification, **When** the owner opens it and enters weights that do not sum to 100 %, **Then** saving is refused with a message naming the current sum.
3. **Given** five years of history, **When** the owner switches the return view to "Heatmap", **Then** each cell shows the monthly return and the yearly total matches the yearly table.
4. **Given** the yearly table, **When** a year has an inflation value, **Then** real return = (1 + IZF) / (1 + inflation) − 1, shown to two decimals.
5. **Given** two depots, **When** the owner selects both in "Portfoliovergleich", **Then** both return lines start at 0 % on the first common day.
6. **Given** a custom grouping "Kern/Satellit", **When** the owner assigns instruments to groups, **Then** the split shows these groups, and unassigned instruments appear as "Nicht zugeordnet".

---

### User Story 2 - Track dividend income (Priority: P2)

The owner opens Investments › Dividenden and sees dividend income for the last 12 months, the average per month, the dividend yield for the current year, the CAGR of yearly dividend income, a yearly bar chart with a table (year, amount, change to the previous year), and the split per security. They can record expected payments (security, date, amount per share) and see them in a calendar together with received payments.

**Why this priority**: Dividends are already imported as transactions; a dedicated view adds income planning with little new data.

**Independent Test**: With the demo data (dividends from a distributing ETF), open Dividenden and check that the 12-month total equals the sum of dividend transactions in that window.

**Acceptance Scenarios**:

1. **Given** dividend transactions, **When** the page opens, **Then** "Letzte 12 Monate" equals their net sum over the last 12 months and "Ø pro Monat" equals that sum / 12.
2. **Given** at least two full years of dividends, **When** the page opens, **Then** CAGR is computed from the first to the last full year; with fewer than two full years it shows "–".
3. **Given** an expected payment entered for next month, **When** the owner opens the calendar, **Then** it appears as "erwartet" with amount = shares held on that date × amount per share.
4. **Given** a received dividend that matches an expected one (same security, same month), **Then** the calendar shows it as "erhalten" instead of listing it twice.

---

### User Story 3 - Bookings as a filterable table (Priority: P2)

Investments › Transaktionen shows a table with the columns Datum, Typ, Name (with WKN/ISIN), Depot, Kaufpreis/Stück, Stück, Steuern, Gebühren and Gesamtbetrag. The owner can filter by type, depot, period and security, hide columns, and export exactly the visible rows and columns as CSV.

**Why this priority**: Checking imports and fees needs a detailed view; the data exists already.

**Independent Test**: Filter the demo bookings to type "Kauf" and one security, export, and compare the CSV with the visible rows.

**Acceptance Scenarios**:

1. **Given** the filter "Typ = Verkauf", **When** applied, **Then** only sales are shown, and the footer total equals the sum of their Gesamtbetrag.
2. **Given** hidden columns, **When** the owner exports, **Then** the CSV contains only the visible columns, in German number format, with the active filters applied.
3. **Given** a phone at 360 px, **When** the table opens, **Then** it shows a compact card per booking without horizontal page scroll.

---

### User Story 4 - Manage exemption orders and estimate Vorabpauschale (Priority: P3)

Investments › Steuern lists exemption orders (Freistellungsaufträge) per broker and year. For each one it shows the amount, the part used (from recorded taxable income and taxes of that broker's accounts), and the remainder. A summary shows the total against the saver's allowance (1.000 € single, 2.000 € joint assessment). It also estimates the Vorabpauschale per fund position for the year from the base rate (Basiszins) and the partial exemption (Teilfreistellung).

**Why this priority**: Useful once a year; depends on correct transactions and settings, so it comes after the core views.

**Independent Test**: Enter exemption orders of 800 € and 200 € for two brokers, record 150 € dividends at the first broker, and check used/remaining values and the warning thresholds.

**Acceptance Scenarios**:

1. **Given** exemption orders summing to more than the allowance, **When** saving, **Then** the app warns that the legal maximum is exceeded (and still saves, because the owner decides).
2. **Given** taxable income of 150 € at broker A in the year, **Then** A shows "150,00 € von 800,00 € genutzt".
3. **Given** a fund position with a value at the start of the year, a base rate and a fund type, **Then** the estimate = start value × base rate × 0,7, limited to the actual gain plus distributions, minus distributions, reduced by the partial exemption (30 % equity funds, 15 % mixed funds, 0 % other), and pro-rated by 1/12 for each full month before purchase in that year.
4. **Given** no base rate stored for a year, **Then** the estimate shows "Basiszins fehlt" with a link to the settings.

---

### User Story 5 - Compare with a benchmark (Priority: P3)

In the net-worth chart (Rendite mode) and in the investment chart, the owner picks "Vergleichen mit" and selects a benchmark (an index or ETF whose prices exist in the app, imported via CSV or entered manually). The benchmark line shows its return over the same period, starting at 0 % on the first day of the period.

**Why this priority**: Motivating context, but requires the owner to supply benchmark prices.

**Independent Test**: Import a benchmark price CSV, select it in the 1J view, and check the end value equals the benchmark's price change over the period.

**Acceptance Scenarios**:

1. **Given** a benchmark with prices covering the period, **When** selected, **Then** a second line appears in a distinct color with a legend entry, and the tooltip shows both values.
2. **Given** missing benchmark prices on some days, **Then** the last known price is carried forward; before the first price the line starts at its first available day.
3. **Given** the owner reloads the page, **Then** the selected benchmark is remembered.

---

### User Story 6 - Watchlists (Priority: P4)

The owner creates watchlists, adds securities by ISIN (with name), and sees each security's price and change over 1W, 1M, YTD, 1J, 3J, 5J and All-time from the prices available in the app (CSV import or manual entry).

**Why this priority**: Nice to have; does not affect wealth figures.

**Independent Test**: Create a list, add an ISIN with imported prices, switch periods and compare the change with the price file.

**Acceptance Scenarios**:

1. **Given** an invalid ISIN (bad checksum), **When** adding, **Then** the input is rejected with a message.
2. **Given** a security without prices, **Then** the row shows "Keine Kurse" and a link to the price import.
3. **Given** several lists, **When** the owner renames or deletes one, **Then** other lists are unchanged.

---

### User Story 7 - Budget pie chart (Priority: P4)

On Budget › Analyse, next to the category list, a pie chart shows expenses (or income) by main category for the selected period, switchable between € and %. Hovering a slice highlights the matching list row and vice versa; clicking a slice opens the category like the list does.

**Why this priority**: Small visual addition to an existing page.

**Independent Test**: For a month with known expenses, check that the slices match the category list and add up to the total.

**Acceptance Scenarios**:

1. **Given** the period November, **Then** slice values equal the list values, and in % mode the shares add up to 100 % (±0,1 for rounding).
2. **Given** a period without expenses, **Then** the chart shows the empty state instead of an empty circle.

---

### Edge Cases

- Instruments with weights summing to less than 100 % in one dimension: the remainder counts as "Nicht zugeordnet".
- Cash: counts as its own asset class, as region "Nicht zugeordnet" unless the owner assigns one, and as currency EUR.
- Return views for periods shorter than one month: the heatmap shows only the existing months; the yearly table shows the current year as YTD.
- Depots without any transactions in "Portfoliovergleich" cannot be selected.
- Dividends in foreign currency are counted in EUR as booked (no conversion).
- Exemption orders for past years are read-only views of what was recorded; changing them does not change transactions.
- The Vorabpauschale is an estimate only and must be labeled as such; negative results show 0 €.
- Benchmark and watchlist prices older than 4 days in a 1W view are marked as outdated (same rule as feature 001).
- Very long tables (10,000+ bookings) stay responsive through paging.

## Requirements *(mandatory)*

### Functional Requirements

**Analyse (US1)**

- **FR-001**: The app MUST show the portfolio split by asset class, region, sector, currency, volatility class, return class and each custom grouping, as a donut plus a list with value and share, for the selected depots.
- **FR-002**: The owner MUST be able to store weighted region, sector and currency shares per instrument; each dimension's shares MUST be between 0 and 100 % and sum to at most 100 %.
- **FR-003**: Volatility MUST be the annualized standard deviation of daily returns over the last 12 months per instrument, grouped into classes (niedrig < 10 %, mittel 10–20 %, hoch > 20 %); instruments with fewer than 60 price days are "Nicht berechenbar".
- **FR-004**: Return classes MUST group positions by unrealized gain in % (< −10 %, −10–0 %, 0–10 %, 10–25 %, > 25 %).
- **FR-005**: The owner MUST be able to create custom groupings with named groups and assign each instrument to at most one group per grouping.
- **FR-006**: The return view MUST offer a line (TWROR over time), a heatmap (monthly TWROR, months × years) and yearly bars, for the periods 1W–All-time.
- **FR-007**: The yearly table MUST show per year IZF, inflation and real return, with the current year as YTD; inflation values per year MUST be maintainable by the owner (the existing inflation setting is reused as default).
- **FR-008**: The portfolio comparison MUST show the TWROR lines of two or more selected depots over a common period.

**Dividenden (US2)**

- **FR-009**: The app MUST show dividend income for the last 12 months, Ø per month, current-year yield (dividends YTD / average portfolio value YTD), CAGR of full years, and a per-year chart and table with the change to the previous year.
- **FR-010**: The app MUST show dividends per security for a selected period, as a list with share of total.
- **FR-011**: The owner MUST be able to record, edit and delete expected payments (security, pay date, amount per share, optional ex-date); the calendar MUST show expected and received payments per month.

**Buchungen (US3)**

- **FR-012**: The bookings view MUST show a paged table with the columns Datum, Typ, Name (WKN/ISIN), Depot, Kaufpreis/Stück, Stück, Steuern, Gebühren, Gesamtbetrag, sortable by date and amount.
- **FR-013**: The owner MUST be able to filter by type, depot, period and security, hide columns, and export the filtered rows with the visible columns as CSV (German format, UTF-8 with BOM).

**Steuern (US4)**

- **FR-014**: The owner MUST be able to record exemption orders per broker (institution) and year with an amount, and set the assessment type (single or joint) per year.
- **FR-015**: The app MUST compute the used part per exemption order from that broker's taxable income in the year (dividends, interest, realized gains) up to the order amount, and show used, remaining and the total against the allowance, warning when the total exceeds it.
- **FR-016**: The app MUST estimate the Vorabpauschale per fund position and year as described in US4, scenario 3, using an owner-maintained base rate per year and a fund type per instrument (Aktienfonds, Mischfonds, sonstiger Fonds), clearly labeled as an estimate.

**Vergleichen mit (US5)**

- **FR-017**: The owner MUST be able to mark any instrument with prices as a benchmark and select one benchmark in the net-worth chart (Rendite mode) and the investment chart; the selection MUST be remembered per chart.
- **FR-018**: Benchmark prices MUST be importable through the existing price CSV import or entered manually per day.

**Watchlists (US6)**

- **FR-019**: The owner MUST be able to create, rename and delete watchlists and add or remove securities by ISIN (validated) with a name.
- **FR-020**: Each watchlist row MUST show the latest price, its date, and the change in € and % for the selected period.

**Budget (US7)**

- **FR-021**: Budget › Analyse MUST show a pie chart of expenses or income by main category for the selected period, with €/% toggle and linked hover between slices and list rows.

**General**

- **FR-022**: All new pages MUST follow the existing layout, German texts, dark/light mode, account/depot filter and the 360 px rule (no horizontal page scroll).
- **FR-023**: All new figures MUST be calculated from stored data only; no data is sent to third parties.
- **FR-024**: The Investments navigation MUST offer Positionen, Transaktionen, Analyse, Dividenden, Steuern and Watchlists.

### Key Entities

- **Instrument classification**: Per instrument and dimension (region, sector, currency) a set of weighted shares; plus the fund type for tax purposes and a benchmark flag.
- **Custom grouping**: A named grouping with named groups; assigns instruments to one group each.
- **Inflation rate**: Per year, the inflation rate used for real returns.
- **Expected dividend**: Security, pay date, optional ex-date, amount per share, status derived from received dividends.
- **Exemption order**: Institution, year, amount; the year also stores the assessment type.
- **Base rate**: Per year, the Basiszins for the Vorabpauschale.
- **Watchlist**: Name and ordered entries (instrument).
- **Chart preference**: The selected benchmark per chart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the demo dataset, every breakdown (asset class, region, sector, currency, custom) adds up to the total depot value to the cent.
- **SC-002**: Yearly IZF values in the Analyse table match the KPI card of feature 001 for the same period within 0,01 percentage points.
- **SC-003**: The 12-month dividend total and the per-year table match the sum of dividend transactions to the cent.
- **SC-004**: The Vorabpauschale estimate matches hand calculations for three reference cases (full year, purchase mid-year, gain below the basic return) to the cent.
- **SC-005**: Each new page loads in under 2 seconds with 5 years of history and 10,000 bookings (same test data as feature 001).
- **SC-006**: Exported booking CSVs contain exactly the filtered rows and visible columns in 100 % of test cases.
- **SC-007**: All new pages pass the 360 px, dark and light checks without horizontal scroll or "NaN".
- **SC-008**: The owner can classify an instrument (three regions) in under 1 minute.

## Assumptions

- Regions, sectors, currencies, fund types, dividend dates, base rates and benchmark prices are entered or imported by the owner; there is no market-data provider.
- Taxes follow German rules as of 2026: allowance 1.000 € single and 2.000 € joint; partial exemption 30 % equity funds, 15 % mixed funds; Vorabpauschale factor 0,7. Church tax and loss offset pots are out of scope.
- "Taxable income" for exemption orders = dividends + interest + realized gains − fees of the broker's accounts in that year, as recorded; withheld taxes recorded on transactions mean the exemption was already used up.
- Volatility uses daily closing prices already stored for net-worth history.
- Out of scope: sharing, reverse breakdown (ETF look-through), promotional content, automated dividend forecasts.
- Feature 001 is the base: authentication, data model, imports, charts and layout are reused. Its open work (US3 Scalable sync, deployment) continues separately and is not blocked by this feature.
