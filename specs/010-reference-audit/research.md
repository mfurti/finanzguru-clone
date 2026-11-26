# Research: Figures, Calculations and Layout Checked Against the Reference (010)

Status: T002 resolved 2026-11-26 with the owner's trade list (computed locally) and the reference UI (read only). Definitions only, no owner amounts.

## R1 – Invested capital, entry value, price gain

- **Observed**: the reference shows the same quantity but a lower average entry price for the open ETF position; its positions page shows Kursgewinn = current value − Einstiegswert of the open position; its Kennzahlen show a smaller period Kursgewinn (1 J) whose percentage base is larger than the entry value.
- **Finding (T002)**: the app matches sells FIFO (its entry value equals the FIFO result exactly). The reference's entry value equals the **moving average cost** (gleitender Durchschnittspreis: each sell removes cost at the current average, buys add their cost) within 0,5 %; the rest is buy fees that the synced trades do not carry (see R2).
- **Decision**: cost basis = moving average cost for Einstiegswert, ⌀ Kaufpreis, Investiertes Kapital (sum over open positions) and the positions' Kursgewinn (= current value − moving-average cost). FIFO stays only where tax rules need it (exemption/Vorabpauschale are not affected).
- **Period Kursgewinn (Kennzahlen, 1 J …)**: unrealized gain at period end minus unrealized gain at period start (positions held at the start are valued at the start date), so a period never shows gains earned before it. Remaining difference to the reference is documented in the quickstart if it persists after T004.
- **Result (T004)**: with the moving average, invested capital and entry value are within 0,5 % of the reference. The reference's period Kursgewinn and realized gains still differ markedly; its Gesamtertrag does not equal its own period Gewinn, so its Kennzahlen use a base that its UI does not reveal. The app keeps the documented definition (Δ unrealized gain in the period; realized = proceeds − moving-average cost) and lists the gap in the quickstart.

## R2 – Realized gains, taxes and fees

- **Observed**: reference shows realized gains brutto and netto (difference = taxes) and a separate "Steuern & Gebühren" line; the app shows brutto = netto and 0 taxes/fees.
- **Finding (T002)**: all synced trades carry fee 0 and tax 0, so "Steuern & Gebühren" is 0 and netto = brutto. Realized gains of the last 12 months with moving-average cost come closer to the reference than FIFO but still differ; the reference evidently deducts taxes and counts fees.
- **Decision**: realized gain per sell = proceeds − moving-average cost of the sold quantity − fees of the sell; netto = brutto − taxes of the sell. T005 first checks whether the broker data (sync recordings) contains fee and tax amounts and maps them into the existing trade fields; if the source has none, the gap is documented.

## R3 – Value series gaps

- **Observed**: one day between a full sell and a re-buy drops to a fraction of the value in the app.
- **Finding (T002)**: the drop happens on the day between a full sell and the re-buy: the proceeds sit on the broker's cash account, whose history has no balance (only today's balance is known), so the cash leg is missing for that day. Separately, the series' last point uses an older quote than the positions (chart total ≠ allocation total, A1).
- **Decision**: (a) broker cash accounts without balance history get a daily balance reconstructed from their bookings (deposits, withdrawals, sells, buys, dividends, interest) anchored at today's balance; (b) the last point of every value series uses the same quotes as positions and allocation.

## R4 – Expenses, Gespart, Sparquote

- **Observed**: the reference counts the category "Sparen und Anlegen" as expense and shows its sum as Gespart; Saldo = Einnahmen − Ausgaben including it; Sparquote is a PLUS feature.
- **Decision**: same rule; Sparquote = Gespart ÷ Einnahmen (0 when no income), ⓘ text states the formula.

## R5 – Default categories

- **Observed**: the reference categorizes all bookings (provider categories); the app's defaults leave many common merchants uncategorized.
- **Decision**: extend default rules with generic merchant words (marketplaces, payment providers, streaming, telecom, supermarkets, drugstores, fuel, public transport) mapped to the reference category tree; owner rules and manual categories keep priority; applied to uncategorized bookings only.

## R6 – Unreviewed count and monthly bars

- **Observed**: unreviewed count differs by about 2 %; one month's bar differs by 100 €.
- **Finding (T002)**: for the same accounts the app counts about 2 % fewer unreviewed bookings; the 100 € month difference is a single booking classified differently (income/expense vs. transfer).
- **Decision**: T008 compares the counted types per account against the reference list (read only) and aligns the rule (likely: trades and broker cash bookings count as unreviewed too); the bar difference follows the R4 rule or is documented.

## R7 – Tables on phone and tablet

- **Decision**: phone (< 640 px) booking list as date-grouped rows (logo, name, category below, signed amount right, checkbox), toolbar in a ⋮ menu; tablet (640–1023 px) columns Name, Datum (short "24.11.26"), Kategorie, Betrag; desktop unchanged (007). Positions: fewer default columns so the table fits at 1440 px, sticky first column when scrolling; investment bookings and taxes tables sticky first column.

## R8 – Control size and figure boxes

- **Observed**: reference dropdown triggers are uniform; app mixes 24/28/32 px.
- **Decision**: one size (Nuxt UI `size: 'md'`, 32 px, 14 px text) for all select/dropdown triggers via `app.config.ts` defaults; explicit `size` props removed. Figure boxes: border `border-accented`, darker surface, label-left/value-right rows for Gespart/Sparquote, five-column grid on Analyse from 1280 px.
