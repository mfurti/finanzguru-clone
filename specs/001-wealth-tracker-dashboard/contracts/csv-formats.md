# Contract: CSV formats

Detection: decode the file (UTF-8, falling back to Windows-1252), sniff the delimiter (`;`, `,`, `\t`), normalize the header row (trim, lowercase, strip quotes), and match against known header signatures. On no match, `needsMapping: true` is returned and the user maps the columns (saved as `csv_mapping`).

## Known layouts (v1)

### `sparkasse-camt-v8` — Sparkasse online banking "CSV-CAMT V8"
- Delimiter `;`, encoding Windows-1252 or UTF-8, decimal `,`, date `DD.MM.YY`.
- Required columns: `Auftragskonto`, `Buchungstag`, `Valutadatum`, `Buchungstext`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Kontonummer/IBAN`, `Betrag`, `Waehrung`.
- Mapping: `Auftragskonto` → account IBAN; `Betrag` (signed) → `amountCents`; `Beguenstigter/Zahlungspflichtiger` → counterparty; `Kontonummer/IBAN` → counterpartyIban; type = income/expense by sign, transfer when counterpartyIban is an own account.

### `sparkasse-mt940` — Sparkasse "CSV-MT940"
- Same handling; columns `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer;BLZ;Betrag;Waehrung;Info`.

### `scalable-transactions` — Scalable Capital transaction export
- Delimiter `;`, decimal `,`, date `YYYY-MM-DD`.
- Expected columns (verify against a real export during implementation): `date`, `time`, `status`, `reference`, `description`, `assetType`, `type`, `isin`, `shares`, `price`, `amount`, `fee`, `tax`, `currency`.
- Mapping: `reference` → `sourceRef`; `type` (`Buy`, `Sell`, `Savings plan`, `Distribution`, `Interest`, `Deposit`, `Withdrawal`, `Fee`, `Taxes`, `Corporate action`) → transaction type; `status` ≠ `Executed` rows are skipped as "nicht ausgeführt".

## Generic mapped CSV
- Required mapping fields: `date`, `amount`. Optional: `valueDate`, `counterparty`, `iban`, `purpose`, `isin`, `quantity`, `price`, `fee`, `tax`, `type`.
- Options: delimiter, encoding, date format (`DD.MM.YYYY`, `DD.MM.YY`, `YYYY-MM-DD`), decimal separator (`,` / `.`), skip leading rows.

## Kursliste (price list, feature 002)

Detected when the header has a date column (`Datum` or `Date`) and a close column (`Schlusskurs`, `Kurs` or `Close`) and no `Betrag`/`Amount` column. Format id `price-list`.

| Column | Required | Values |
|---|---|---|
| `Datum` / `Date` | yes | `DD.MM.YYYY` or `YYYY-MM-DD` |
| `Schlusskurs` / `Kurs` / `Close` | yes | > 0, decimal comma (`1.001,25`) or point (`1001.25`) |
| `ISIN` | no | valid ISIN; without this column the confirm body must carry `instrumentId` |

Prices are upserted per `(instrument, date)` with source `csv`. Job counts: `imported` = new or changed prices, `skipped` = unchanged, `failed` = invalid rows or unknown ISINs (reported per line). Depots holding an affected instrument are recomputed. Fixtures: `price-list.csv`, `price-list-isin.csv`.

## Row errors
Each failing row is reported as `{ line, reason }`. Reasons: `invalid_date`, `invalid_amount`, `unknown_currency_no_rate`, `missing_isin`, `invalid_isin`, `missing_quantity`, `not_executed`. Valid rows are still imported (job status `partial`).

## Test fixtures
`apps/api/test/fixtures/csv/` holds synthetic files per layout, plus one file with malformed rows and one duplicate re-import case. Real personal exports are never committed.
