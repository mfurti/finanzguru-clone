# Data Model: Figures, Calculations and Layout Checked Against the Reference (010)

No schema change planned.

- **Default categorization rules**: more built-in rows in the existing rule store (generic merchant words → reference categories); flagged as default so owner rules (006) keep priority. If existing databases cannot receive them via the seed, a data-only migration inserts them (decided in T002).
- **Trades**: existing fields for fees and taxes are used for "Steuern & Gebühren" and realized netto (R2); no new columns unless T002 finds them missing (then a separate, reviewed migration task is added).
- **Audit record**: local file `apps/api/data/audit-010-local.md` (git-ignored) with reference value, app value and status per figure; the public quickstart holds only the status.
