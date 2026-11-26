# Research: Figures, Calculations and Layout Checked Against the Reference (010)

Status: initial findings from the audit on 2026-11-26; open points are resolved in task T002 and recorded here (definitions only, no owner amounts).

## R1 – Invested capital, entry value, price gain

- **Observed**: the reference shows the same quantity but a lower average entry price for the open ETF position; its positions page shows Kursgewinn = current value − Einstiegswert of the open position; its Kennzahlen show a smaller period Kursgewinn (1 J) whose percentage base is larger than the entry value.
- **Hypothesis**: Einstiegswert = cost of the remaining lots after FIFO matching of sells (app: average cost incl. earlier lots); period Kursgewinn = value change of holdings in the period minus net purchases.
- **To decide in T002**: verify FIFO vs. average with the owner's trade list (locally) and with an invented fixture whose two methods give different results; document the period base.

## R2 – Realized gains, taxes and fees

- **Observed**: reference shows realized gains brutto and netto (difference = taxes) and a separate "Steuern & Gebühren" line; the app shows brutto = netto and 0 taxes/fees.
- **To decide in T002**: where taxes/fees of imported trades are stored today (broker sync, CSV) and how the reference matches sells to lots (same as R1).

## R3 – Value series gaps

- **Observed**: one day between a full sell and a re-buy drops to a fraction of the value in the app.
- **Decision (proposed)**: value on a day = holdings × last known quote + cash; a sell and re-buy on different days keeps the cash part of the depot (Referenzkonto) in the series, or the day is carried from the previous valuation when the cash leg is outside the selected accounts. Final rule in T002.

## R4 – Expenses, Gespart, Sparquote

- **Observed**: the reference counts the category "Sparen und Anlegen" as expense and shows its sum as Gespart; Saldo = Einnahmen − Ausgaben including it; Sparquote is a PLUS feature.
- **Decision**: same rule; Sparquote = Gespart ÷ Einnahmen (0 when no income), ⓘ text states the formula.

## R5 – Default categories

- **Observed**: the reference categorizes all bookings (provider categories); the app's defaults leave many common merchants uncategorized.
- **Decision**: extend default rules with generic merchant words (marketplaces, payment providers, streaming, telecom, supermarkets, drugstores, fuel, public transport) mapped to the reference category tree; owner rules and manual categories keep priority; applied to uncategorized bookings only.

## R6 – Unreviewed count and monthly bars

- **Observed**: unreviewed count differs by about 2 %; one month's bar differs by 100 €.
- **To decide in T002**: which bookings the reference counts (e.g. transfers, trades) and which booking causes the monthly difference.

## R7 – Tables on phone and tablet

- **Decision**: phone (< 640 px) booking list as date-grouped rows (logo, name, category below, signed amount right, checkbox), toolbar in a ⋮ menu; tablet (640–1023 px) columns Name, Datum (short "24.11.26"), Kategorie, Betrag; desktop unchanged (007). Positions: fewer default columns so the table fits at 1440 px, sticky first column when scrolling; investment bookings and taxes tables sticky first column.

## R8 – Control size and figure boxes

- **Observed**: reference dropdown triggers are uniform; app mixes 24/28/32 px.
- **Decision**: one size (Nuxt UI `size: 'md'`, 32 px, 14 px text) for all select/dropdown triggers via `app.config.ts` defaults; explicit `size` props removed. Figure boxes: border `border-accented`, darker surface, label-left/value-right rows for Gespart/Sparquote, five-column grid on Analyse from 1280 px.
