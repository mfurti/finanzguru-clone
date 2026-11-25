# Research: Popups, Tables and Charts Like the Reference (007)

## R1 – Why Betrag is cut off

- **Finding** (measured 2026-11-25, 1440 px): headers Name, Datum, Kategorie, Eigenschaften, Konto, Betrag; table 1 240 px in a 1 116 px box. Long names with a purpose line and the Konto column (~200 px) cause it.
- **Decision**: default columns as the reference (Konto and Verwendungszweck off, choosable); name cell `max-w` with truncation and `title` for the full text; Betrag column right-aligned, never wrapped. Saved column choices from before are migrated once: a stored choice that has Konto on keeps it.
- **Alternative**: sticky Betrag column (keeps scroll, worse on phones).

## R2 – One category window

- **Decision**: `CategoryWindow.vue` (`UModal`, width ~640 px): search, tabs Alle/Eigene (own = `isDefault false`), main categories as collapsible groups with icon, sub-categories as single-select rows, current one marked; "Neue Kategorie erstellen" opens the existing create form inline. Below: the 006 options (scope, merken, `RuleFields`). One "Speichern". The 006 `CategoryChangeDialog` is folded in and removed; the same PATCH/bulk calls are used.

## R3 – Booking side panel

- **Decision**: `USlideover` right, full screen below 640 px. Data from the list row plus `note`. Editable: category (opens R2), type, reviewed, transfer (type `transfer`), tags, note; delete with undo (existing). Row click opens it; checkbox, chip and delete icon stop propagation.
- **Not now**: "Aus den Statistiken entfernen", "Transaktion aufteilen" (need their own data model).

## R4 – Filter side panel and direction

- **Decision**: `BookingFilterPanel` in a `USlideover`; new filter `direction` (`in` → amount > 0, `out` → amount < 0) in the shared filter, API where-clause and URL sync. Accounts and tags reuse existing filters.

## R5 – Dashboard layout

- **Decision**: two fixed columns at ≥ 1024 px — left `allocation`, `kpis`, `holdings`; right `accounts`, `review`, `cashflow`, `budgets`; `networth` full width on top. Visibility and order within a column still come from `dashboard_layout`, so the owner's customization keeps working. One column below 1024 px.
- Card titles become links via a small `CardTitle.vue` (title, "›" link, optional ⋮ menu with what the card can do, e.g. €/% or hide).

## R6 – Chart details

- Net-worth chart: header row (tabs left; periods, calendar, menu right), ⓘ with `InfoTooltip` texts ("Summe aller Konten und Depots", "Veränderung im Zeitraum ohne Einzahlungen"), `VisLine` without `VisArea`, compact axis via `Intl.NumberFormat('de-DE', { notation: 'compact' })` → "5K €"? German compact gives "5000" → use own formatter: ≥ 1 000 → `${n/1000}K €`, ≥ 1 000 000 → `M €` (matches the reference's look).
- Month axis: first line short month, second line year only at January or the first bar; a divider line at year change.
- Donut: `padAngle` 0, centre label "Gesamtausgaben"/"Gesamteinnahmen".

## R7 – Add window

- **Decision**: `AddWindow.vue` replaces `AddMenu.vue`: tabs Anbieter/Assets; Anbieter = static list of supported providers (Scalable Capital: automatic + CSV; owner's bank via Enable Banking: automatic; Sparkasse CSV: file; manual account); search filters by name, IBAN or BIC (bank list from the 005 institutions endpoint only when configured). Step 2 "Wie möchtest du importieren?" links to the existing flows (bank card connect, Scalable connect, CSV upload, account form). Assets tab: Konto anlegen, Transaktion erfassen, Wertpapier suchen (005).
