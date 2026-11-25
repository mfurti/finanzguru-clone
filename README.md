# Vermögenskompass

Self-hosted personal wealth tracker: net worth, investments, budget and insurance in one dashboard. Runs on your own machine or home server; your financial data never leaves it.

- **Übersicht**: net worth over time (period tabs or custom date range), allocation, KPIs (TWROR, XIRR, gains), top/flop holdings, unreviewed bookings, cashflow and budgets.
  - **Portfolios & Konten**: one card per group with sparkline, masked IBAN with copy, last import or sync; detail page per account and depot.
  - **Transaktionen**: all bookings with search, filter panel, sorting, tags, multi-select (category, tags, reviewed, delete with undo), category chip, column choice, 25/50/100 rows and CSV export; review unreviewed bookings here.
- **Investments**: performance chart, sortable positions with WKN/ISIN copy and asset-class chips, asset classes, bookings table with filter panel, sorting and CSV export, per-instrument detail and classification.
  - **Analyse**: split by asset class, region, sector, currency, volatility, return and own groupings; returns as line, month × year heatmap and yearly bars; IZF vs. inflation vs. real return by year or trailing period (1M … Gesamt); depot comparison.
  - **Dividenden**: last 12 months, Ø per month, yield, CAGR, yearly history, per security, split by securities, regions and sectors, calendar (list or month grid) with expected payments.
  - **Steuern**: Freistellungsaufträge per broker with used/remaining amount, Vorabpauschale estimate per broker.
  - **Watchlists** and **Vergleichen mit** (benchmark line in the net-worth and investment charts).
- **Budget**: Analyse (cashflow by month/quarter/year with period picker, categories with icons, linked pie chart and detail pages), Sankey page with the period's bookings, Budgets page (12-month budget vs. spending chart and table with Gesamtbudget).
- **Versicherung**: insurance contracts with yearly cost.

Global search (magnifier or Ctrl/Cmd+K) over pages, securities, accounts and bookings. German UI with the Outfit font (bundled, no font CDN), dark and light mode, usable down to 360 px.

## Architecture

pnpm monorepo, Node 26, TypeScript.

| Path                                 | What                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                           | Nuxt 4 + Nuxt UI 4 frontend (SSR). Proxies `/api/**` to the API, so the browser talks to one origin.                 |
| `apps/api`                           | NestJS 11 on Fastify. SQLite via Drizzle ORM and `better-sqlite3`. All money in integer cents.                       |
| `packages/shared`                    | Zod schemas, DTO types, enums and formatters used by both apps.                                                      |
| `e2e`                                | Playwright journeys (desktop and 360 px).                                                                            |
| `specs/001-wealth-tracker-dashboard` | Spec, plan, data model, API contracts, tasks and the [quickstart](specs/001-wealth-tracker-dashboard/quickstart.md). |
| `specs/002-investment-analysis`      | Analyse, Dividenden, Steuern, benchmarks, watchlists ([quickstart](specs/002-investment-analysis/quickstart.md)).    |

```
Browser ──> web (Nuxt, :3000) ──/api/**──> api (Nest, :3001) ──> SQLite file
                                                │
                                                └──> data sources (CSV, Scalable MCP)
```

## Data sources

| Source                | Status    | How                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kursliste (CSV)       | available | Daily closes (`Datum;Schlusskurs`, optional `ISIN`) for benchmarks, watchlists or missing prices.                                                                                                                                                                                                                                                                                                                  |
| CSV import            | available | Sparkasse (CSV-CAMT) and Scalable Capital exports are detected automatically; any other CSV via column mapping. Duplicates are skipped.                                                                                                                                                                                                                                                                            |
| Scalable Capital MCP  | available | Official MCP server, OAuth login on Scalable's own page, **read-only**: trading tools are blocked by an allowlist. Card under Einstellungen › Datenquellen (verbinden, synchronisieren, trennen), "Aktualisieren" in Portfolios & Konten, optional daily sync at 06:00 with `SCALABLE_DAILY_SYNC=true`. Also used for "Asset suchen" in watchlists and for quotes, refreshed every 15 minutes during market hours. |
| Bank (Enable Banking) | available | PSD2 account information through Enable Banking: you log in and approve read access on your bank's page; the app never sees the bank password. Balances and booked transactions; bookings already imported by CSV are linked, not duplicated. See [Bank connection](#bank-connection-enable-banking).                                                                                                              |

### Bank connection (Enable Banking)

1. Create an account at Enable Banking and register an application in **restricted production** mode. In this mode the application may read only accounts you link to it yourself, which fits a single-owner app.
2. Add the redirect URL of your app (`https://…/api/sources/bank/callback`; production applications accept only `https`) and the public certificate of your key. Locally, run `pnpm dev:local:https` and use `https://localhost:3100/api/sources/bank/callback`.
3. Set `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_KEY_FILE` (path to the key file, outside the repository) and, if needed, `ENABLE_BANKING_REDIRECT_URL` in `apps/api/.env`. Optional: `BANK_DAILY_SYNC=true`.
4. In the app: Einstellungen › Datenquellen › "Bank verbinden", choose your bank, log in there.

The consent lasts about 90 days. From 14 days before it ends the app shows a notice with "Zugang erneuern". "Trennen" deletes the access; accounts and bookings stay.

## Setup

Requires Node.js 26 and pnpm (`corepack enable`).

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env   # fill API_SESSION_SECRET and API_ENCRYPTION_KEY
Copy-Item apps/web/.env.example apps/web/.env
pnpm --filter api db:migrate
pnpm --filter api db:seed                       # default categories; add -- --demo for demo data
pnpm --filter api owner:set-password
pnpm dev                                        # http://localhost:3000
```

`pnpm dev:local` runs the same on ports 3100 (web) and 3101 (API) to avoid clashes with other local projects.

## Scripts

| Command                                        | What                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:local`                  | API and web in watch mode                                           |
| `pnpm build`                                   | Build all workspaces                                                |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Quality gates                                                       |
| `pnpm test`                                    | Vitest: domain logic, parsers, API e2e (Fastify inject), components |
| `pnpm test:e2e`                                | Playwright journeys                                                 |
| `pnpm --filter api perf`                       | Load test: 5 years of history, 10k transactions, 50k-row CSV import |
| `pnpm docker:local` / `pnpm docker:local:down` | Local container test with `compose.local.yaml`                      |

## Deployment

Images are built by GitHub Actions and published to GHCR (`ghcr.io/mfurti/finanzguru-clone-web` and `-api`). The server only needs a `compose.yaml` and an `.env`; see the quickstart for the rollout steps.

## Privacy and security

- Single owner, password login (scrypt hash), sealed httpOnly session cookie, login rate limit.
- Everything is stored in one local SQLite file. Nothing is sent to third parties except the data sources you connect.
- Data source credentials are encrypted with AES-256-GCM (`API_ENCRYPTION_KEY`) and never returned by the API or written to logs.
- Scalable Capital access is read-only by design; the app cannot place orders or move money.
- Security headers (helmet on the API, CSP on the web app); CSV uploads limited to 20 MB.
- Keep `.env` files and the `data` directory out of version control and backups you share.

Regions, sectors, Basiszins and inflation rates are entered by you; there is no market-data feed. The Vorabpauschale is an estimate; your broker's statement is authoritative.

This is a personal tool, not financial or tax advice.
