# Quickstart: Figures, Calculations and Layout Checked Against the Reference (010)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

Owner amounts go only into `apps/api/data/audit-010-local.md` (git-ignored); this file records status only.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Owner's real accounts selected; compare Übersicht, Kennzahlen (1 J), Positionen, Einnahmen & Ausgaben (current month) with the reference; run `pnpm --filter api audit:figures -- --accounts <ids>` | A1–A15 within ±1 € (quote differences aside); remaining differences explained |
| Q2 | US1 | Investments value chart 1 J | No single-day drop |
| Q3 | US2 | Current month, Ausgaben by category | ≤ 5 "Nicht kategorisiert" |
| Q4 | US3 | Transaktionen at 375 / 768 / 1440 px | Phone: date-grouped list, amount visible; tablet: Name, Datum, Kategorie, Betrag fit; desktop unchanged |
| Q5 | US3 | Positionen, Buchungen, Steuern at 375 / 768 / 1440 px | Fit at 1440; sticky first column when scrolling |
| Q6 | US4 | Any page | One dropdown height; figure boxes framed in dark and light; Analyse five figures in one row ≥ 1280 px |

## Status after the owner check T009 (2026-11-26, no amounts)

| Figure | Status |
|---|---|
| A1 Gesamtvermögen chart = Aufteilung | fixed (T003) |
| A2 Gewinn, A4 Kursgewinn (period) | open: reference period base not derivable from its UI (research R1) |
| A3 Investiertes Kapital, A10 Einstiegswert | fixed within 0,5 % (T004; rest: buy fees missing in broker data) |
| A5 Realisierte Gewinne | improved, still differs (period base, sell taxes missing in broker data) |
| A6 Steuern & Gebühren | partly: broker-account taxes counted (T005); sell taxes not in broker data |
| A7–A9 Gesamtertrag, TWROR, IZF, Realrendite | follow A2–A6 |
| A11 Wertverlauf ohne Einbruch | fixed (T003) |
| A12–A14 Ausgaben, Gespart, Saldo | fixed, equal to reference (T007) |
| A15 Sparquote | shown with documented formula (reference: PLUS) |
| A16 Nicht kategorisiert | fixed: 5 expenses left in the audited month (was 27); five main categories now equal the reference (T010, T011) |
| A17 Ungeprüfte | same rule; difference = different review marks (T008) |
| A18 Monatsbalken | open: 100 € in one month, cause not found on app side |

| B1 Transaktionen on phones | fixed: fits at 360/375 px, amount visible (T012); no date grouping, toolbar stays a row (reference: date groups, ⋮ menu) |
| B1 Transaktionen on tablets | fixed: short year ("24.11.26") below 1024 px, phone layout up to 767 px; fits at 360, 640, 700, 768, 1024, 1440 px (T013) |
| B2 Positionen | fixed: fits at 1440 px (name truncated, tooltip), sticky name column when scrolling (T014) |
| B3 Investments › Buchungen | fixed: fits at 768/1024/1280/1440 px (Depot from 1536 px, Steuern/Gebühren from 1280 px, cards below 768 px) (T014) |
| B4 Steuern › Vorabpauschale | scrolls on phones with a sticky first column (T014) |
| B5 Dropdowns | fixed: one height (32 px, Nuxt UI size md) on every page, checked by the layout guard (T016) |
| B6 Kennzahl-Kästen | fixed: framed Einnahmen/Ausgaben/Saldo and Gespart/Sparquote boxes (label left, value right), all five in one row from 1280 px on Budget › Analyse; checked dark/light (T017) |
