# CSV fixtures (synthetic)

All data is made up; IBANs are public test IBANs. Expected results of a first import into an empty database:

| File                        | Layout                                              | Rows | Imported        | Skipped | Failed | Notes                                                         |
| --------------------------- | --------------------------------------------------- | ---- | --------------- | ------- | ------ | ------------------------------------------------------------- |
| `sparkasse-camt-v8.csv`     | `sparkasse-camt-v8` (Windows-1252, `;`, `DD.MM.YY`) | 8    | 8               | 0       | 0      | Sum +1.367,77 €; two identical grocery rows on different days |
| `sparkasse-mt940.csv`       | `sparkasse-mt940`                                   | 3    | 3               | 0       | 0      | Sum +2,05 €                                                   |
| `scalable-transactions.csv` | `scalable-transactions` (UTF-8, `;`, `YYYY-MM-DD`)  | 9    | 8               | 0       | 1      | Row 10 is `Cancelled` → `not_executed`; 3 instruments; 1 sell |
| `malformed.csv`             | `sparkasse-camt-v8`                                 | 4    | 2               | 0       | 2      | Line 3 `invalid_date` (31.02.), line 4 `invalid_amount`       |
| `unknown-layout.csv`        | none → needs mapping                                | 3    | 3 after mapping | 0       | 0      | `,` delimiter, `.` decimals, `YYYY-MM-DD`                     |

Re-importing any file imports 0 rows and skips all previously imported rows (SC-003).
Line numbers count the header as line 1.
