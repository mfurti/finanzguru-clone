# Implementation Plan: Settings (014)

**Branch**: created with the issue (`gh issue develop`) | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-settings/spec.md`

## Summary

1. **Settings foundation**: typed owner settings (shared zod schema with defaults) stored in the existing `user_setting` key-value table; `GET/PATCH /api/settings`; `useSettings()` composable; settings area with a side navigation (Konten & Daten, Anzeige, Finanzen & Steuern, Sicherheit, Datenquellen, Kategorien & Regeln, Inflation, Über die App) reusing the section layout.
2. **Konten & Daten (US1)**: account list with rename, hide, archive and drag/arrow reorder (existing `account.sort_order`, new `account.archived_at`); demo removal moves here (013 card); automatic refresh schedule (off / daily at HH:MM / every n hours) driving the existing sync scheduler and the 013 refresh-all; bank consent notice from 14 days before expiry; backup download (zip: SQLite snapshot via `VACUUM INTO` + logo folder), restore (upload → validated → staged, applied on the next API start, with confirmation and the app showing "Neustart nötig"), CSV export of all bookings.
3. **Anzeige (US2)**: start page redirect, default chart period (PeriodTabs default), colour mode (stored server-side, applied on load; system default), privacy mode (`Money`/`Percent` mask amounts, header toggle), table density (compact padding via a root class).
4. **Finanzen & Steuern (US3)**: default assessment for new tax years; church tax (Bundesland → 8 % BY/BW, else 9 %) in the tax estimates; "Wertpapierkäufe zählen als gespart" switch in the cash-flow domain; budget month start day (1–28) applied to cash-flow and budget periods; display rounding (cents / whole euros).
5. **Sicherheit (US4)**: change password (verify current, scrypt hash as today), sessions table (id in the encrypted cookie; guard checks and touches it), list with device hint and "Überall abmelden", automatic logout after n idle minutes (guard compares last seen).
6. **Über die App (US4)**: version, database size, last fetch per source (013 state).

## Technical Context

**Language/Version**: TypeScript 5 strict, Vue 3.5, Nuxt 4, NestJS 11, Drizzle/SQLite

**Primary Dependencies**: `fflate` (MIT) for the backup zip – only new dependency.

**Storage**: migration: `account.archived_at` text (order reuses `sort_order`); new table `session` (id, created_at, last_seen_at, user_agent); settings in `user_setting` (keys `settings.*`, JSON values).

**Testing**: domain unit (church tax, budget month start periods, saved rule, rounding), API e2e (settings CRUD with validation, accounts management, backup round trip with equal counts and sums, password change, sessions and idle logout), component (settings forms, privacy masking), Playwright (each group, start page redirect, layout guard incl. settings pages).

**Constraints**: passwords never shown or logged; restore only after confirmation and only from a backup of this app (schema version check); no deployment.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Rounding is display only; computations stay in cents | Pass |
| II. Owner-Controlled, Local Data | Backup is a download to the owner; nothing leaves otherwise | Pass |
| III. Public Repo Hygiene | No credentials in settings or logs | Pass |
| IV. Tested by Layer | Unit, API e2e, component, Playwright | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | German labels, 375/768/1440, dark/light, privacy mode | Pass |

## Project Structure

```text
specs/014-settings/ plan.md research.md data-model.md contracts/http-api.md quickstart.md tasks.md

packages/shared/src/schemas/settings.ts
apps/api/src/modules/settings/…            # settings, backup, about
apps/api/src/modules/auth/…                # password, sessions, idle logout
apps/api/src/domain/{tax.ts,cashflow.ts,period.ts}
apps/web/app/pages/settings.vue (+ children) # settings frame and groups
apps/web/app/composables/useSettings.ts
apps/web/app/components/common/{Money.vue,Percent.vue}
```

## Complexity Tracking

No violations.
