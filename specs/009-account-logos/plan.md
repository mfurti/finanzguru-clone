# Implementation Plan: Logos for Banks, Brokers, Portfolios and Accounts

**Branch**: `9-account-logos` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-account-logos/spec.md`

## Summary

Builds on 008 (catalogue, alias matching, `recipient_logo`, picker, uploads):

1. **Local logo set (US2)**: optional folder `dirname(DATABASE_PATH)/brand-logos/` (or `BRAND_LOGOS_DIR`), git-ignored with the data directory, holding image files and `brands.json` (`[{ "key", "title", "words": [], "file" }]`). Loaded at API start as a third set `local` that wins over the built-in sets; its words join the alias list ahead of built-in aliases of the same length. Served by `GET /api/logos/brands/local/:name` (raster or safe SVG).
2. **Institution logos (US1)**: `GET /api/accounts` items gain `logo`, `logoSource`, `logoKey`. The logo comes from the same `logoFor()` rule with the institution name as text and the choice stored in `recipient_logo` under the key `institution:<institutionId>` – no migration. Institution "Manuell" never gets a logo.
3. **Web (US1)**: composable `useAccountLogos()` (from `/api/accounts`, keyed by account id and institution name) feeds `MerchantLogo` in `AccountsCard`, `AccountRow`, `AccountDetail`, `AccountFilter`, `BookingPanel` (account line), `BankCard`, `ScalableCard`.
4. **Choice (US3)**: the 008 `LogoPicker` opens from the account detail logo with key `institution:<id>`; PUT/DELETE/upload routes reused unchanged.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node 22

**Primary Dependencies**: none new (008 catalogue, `@fastify/multipart`, Nuxt UI).

**Storage**: no migration; `recipient_logo` rows with key prefix `institution:`; local files in the git-ignored data directory. The unused column `institution.logo_key` stays unused (documented).

**Testing**: vitest unit (local set loader: valid/invalid files, priority), API e2e (accounts list logo, institution choice, local route), component tests (composable, account row), Playwright one journey per story (desktop + 360 px).

**Target Platform**: local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web app.

**Performance Goals**: local set read once at start; accounts list adds one map lookup per account.

**Constraints**: nothing from third-party hosts; no logo files in commits (folder ignored, leak guard); no layout shift.

**Scale/Scope**: ≈ 10 institutions, ≈ 20 accounts, ≈ 10 local logos.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Not touched | Pass |
| II. Owner-Controlled, Local Data | Local logo folder in the data directory; no external requests | Pass |
| III. Public Repo Hygiene | Unlicensed logos only in a git-ignored folder; tests use generated fixtures; leak guard checks for image files under `brand-logos` | Pass |
| IV. Tested by Layer | Unit, API e2e, component, Playwright per story | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | German texts, 360 px, dark/light, initials fallback | Pass |

Post-design re-check: unchanged.

## Project Structure

```text
specs/009-account-logos/ plan.md research.md data-model.md quickstart.md contracts/http-api.md tasks.md

apps/api/src/modules/logos/local-brands.ts        # loader for the local folder
apps/api/src/modules/logos/brand-catalog.ts       # third set "local"
apps/api/src/domain/logo.ts                       # extra (local) aliases ahead of built-in ones
apps/api/src/modules/logos/{logos.controller.ts,logos.service.ts}
apps/api/src/modules/accounts/accounts.service.ts # list adds logo fields
packages/shared/src/schemas/account.ts            # AccountDto.logo, logoSource, logoKey

apps/web/app/composables/useAccountLogos.ts
apps/web/app/components/{dashboard/AccountsCard.vue,accounts/AccountRow.vue,accounts/AccountDetail.vue,common/AccountFilter.vue,transactions/BookingPanel.vue,import/BankCard.vue,import/ScalableCard.vue}
```

## Complexity Tracking

No violations.
