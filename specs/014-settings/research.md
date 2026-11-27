# Research: Settings (014)

## R1 – Where settings live

- **Decision**: one typed `OwnerSettings` object (zod, every field with a default) stored per key in `user_setting` (`settings.<name>` → JSON); `GET /api/settings` returns the merged object, `PATCH` validates and stores changed keys only.
- **Rationale**: the key-value table exists; adding a setting needs no migration.

## R2 – Backup and restore

- **Decision**: backup = zip with `app.sqlite` (from `VACUUM INTO` a temp file, consistent while the app runs), the logo folder and a `manifest.json` (app version, last migration, created at). Restore uploads the zip, checks the manifest (same or older schema), stages it as `data/restore/` and applies it on the next API start before migrations run; the app shows "Wiederherstellung bereit – App neu starten".
- **Alternatives**: swapping the live database file (unsafe with open connections); table-by-table copy (slow, fragile with constraints).

## R3 – Sessions and logout

- **Decision**: a `session` table; login inserts a row and stores its id in the encrypted cookie; the guard rejects unknown ids, updates `last_seen_at` at most once a minute and ends sessions idle longer than the setting; "Überall abmelden" deletes all rows except the current one; a password change deletes all others.

## R4 – Budget month start

- **Decision**: cash-flow and budget periods start on the chosen day (1–28); "November" with start 25 covers 25.10.–24.11.; quarters and years shift the same way. Applied in the period domain used by cash flow, budgets and Sankey.

## R5 – Church tax

- **Decision**: church tax 8 % (BY, BW) or 9 % (other states) of the capital-gains tax in tax estimates (Vorabpauschale, realized gains estimate); off by default.

## R6 – Privacy mode and display

- **Decision**: `Money`/`Percent` read a shared `privacy` state and render "•••• €" / "•• %"; charts hide axis values; a header eye button toggles it. Colour mode stored server-side and applied on load (falls back to system). Density switches table cell padding via a class on `<html>`.

## R7 – Automatic refresh

- **Decision**: schedule `off | daily HH:MM | every n hours` in settings; the existing scheduler (SchedulerRegistry) re-plans on change and calls the 013 refresh-all.
