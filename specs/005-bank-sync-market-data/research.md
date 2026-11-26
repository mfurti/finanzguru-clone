# Research: Bank Sync and Market Data (005)

## R1 – Bank access through Enable Banking

- **Decision**: Use Enable Banking's account-information API in restricted production mode. The owner registers an application in the Enable Banking control panel, links their own accounts there, and stores the application id and the RS256 private key path in the local, git-ignored config (`ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_KEY_FILE`). Each request carries a short-lived JWT (`iss: enablebanking.com`, `aud: api.enablebanking.com`, `kid` = app id, lifetime ≤ 1 h) signed with `jose`.
- **Flow**: `POST /auth` (bank name/country, `valid_until` = today + 90 days, `state`, `redirect_url` = `/api/sources/bank/callback`) → owner logs in at the bank → callback with `code` → `POST /sessions` → session id plus approved accounts → `GET /accounts/{uid}/balances` and `GET /accounts/{uid}/transactions?date_from=…` (paged by `continuation_key`). `DELETE /sessions/{id}` on "Trennen".
- **Allowlist**: the client accepts only these method/path pairs: `GET /aspsps`, `POST /auth`, `POST /sessions`, `GET /sessions/{id}`, `DELETE /sessions/{id}`, `GET /accounts/{uid}/details|balances|transactions`. Payment endpoints (`/payments…`) are refused before any request.
- **Data leaving the server**: the signed JWT (app id), the chosen bank, the redirect URL, the session id and account uids. No bookings or balances are sent anywhere; they only come in. Recipient: Enable Banking Oy (Finland), a registered AISP under PSD2 (FIN-FSA), passported in the EU. Registration: restricted production application of the owner.
- **Rationale**: free for the owner's own accounts, no bank password in the app, licensed provider (same model as the reference app's PSD2 provider).
- **Alternatives**: FinTS direct (needs a Die Deutsche Kreditwirtschaft product registration and handles PIN/TAN in the app — violates Constitution II); GoCardless Bank Account Data (closed to new sign-ups); CSV only (status quo, manual).

## R2 – No duplicates against CSV history

- **Decision**: Live bookings carry `source = 'enable_banking'` and `sourceRef = entry_reference` (or a hash of the raw booking when missing). Before inserting, `domain/bank-match.ts` looks for an existing row on the same account with the same booking date (±1 day), same amount in cents and no `sourceRef` of this source. If exactly one is found, it is linked (gets the `sourceRef`) instead of a new row. Ambiguous cases (2+ candidates) match by normalized counterparty; still ambiguous → insert and leave "ungeprüft".
- **Rationale**: CSV purpose texts differ from PSD2 remittance text, so the 001 fingerprint alone would create duplicates.
- **Alternatives**: start sync after the last CSV date only (loses late-booked items); fuzzy text matching (unpredictable).

## R3 – Pending bookings and balances

- **Decision**: Import only `status = BOOK`. Balance: prefer `CLBD` (closing booked), then `ITAV`/`XPCD`; stored on the account as `balanceCents`. Foreign currency → row error `unknown_currency_no_rate`, as in CSV.

## R4 – Consent lifetime

- **Decision**: Store `valid_until` from the session in `bank_consent.valid_until`. From 14 days before, `GET /api/sources` returns `consentEndsAt` and the web shows a notice with "Zugang erneuern" (starts `/auth` again, then replaces the session). After expiry, or on 401/`EXPIRED_SESSION`, the source status becomes `consent_expired` and syncs stop.

## R5 – Per-class performance like the reference app

- **Decision**: Add `flow_cents` to `instrument_value_snapshot` (net buys minus sells, in cents, on that day). `domain/class-performance.ts` sums value and flow per class per day and chains a daily TWROR: `r_t = (V_t − F_t) / V_{t−1} − 1`, with `r_t = 0` when `V_{t−1} = 0` (no holdings). The cumulative line therefore stays flat while the class is not held. € view uses `V_t`.
- **Rationale**: matches the observed reference behavior (stock line about −26 % stays flat after the sale; € line drops to 0).
- **Alternatives**: unrealized gain / invested (current 004 approach) — wrong after a sale.

## R6 – Search, quotes and charts from Scalable

- **Decision**: Add `search_securities`, `get_security_quote` and `get_security_chart` to `READ_TOOLS`. They are read-only (no order, transfer or settings verbs) and pass the description deny check. Search is called on demand (debounced 300 ms, min 2 characters). Quotes for watchlist and held instruments refresh every 15 minutes Mon–Fri 08:00–22:00 Europe/Berlin, and on "Aktualisieren". Daily closes from the chart tool are stored in `price` with `source = 'scalable'`.
- **Data leaving the server**: search text and ISINs of watched securities, sent to Scalable Capital through the owner's existing MCP grant (same recipient and consent as 004).
- **Class mapping**: Scalable security types map to the app's asset classes; unknown types become `other` and show under "Sonstige".
- **Alternatives**: third-party market-data APIs (new recipient, keys, licensing) — out of scope per spec.

## R7 – Gain split

- **Decision**: Reuse `realizedNetCents` from the FIFO state in `domain/positions.ts`. `priceGainCents = valueCents − remainingCostCents`; `totalGainCents = realizedNetCents + priceGainCents`. Dividends stay out of both, as in the reference app.

## R8 – Recording fixtures

- **Decision**: `scripts/enable-banking-record.ts` writes raw responses to git-ignored `apps/api/data/enable-banking-raw/`. An anonymizer replaces IBANs, names, references, amounts (scaled) and shifts dates before files go to `test/fixtures/enable-banking/`.

## Addendum (2026-11-25, observed)

- **R6 confirmed** on the local dev server with the owner's Scalable grant: the market-data calls send only the search text, ISINs and the chart timeframe. `search_securities` and `get_security_quote` answer within the owner's portfolio context (Scalable returns the `portfolioId`, which the app neither stores nor shows; fixtures replace it). Responses are quotes in EUR with a UTC time stamp, intraday performance and hits typed `STOCK`/`ETF`; no WKN is returned, so hits carry `wkn: null`. The chart tool has no five-year timeframe; the app offers `1M`, `6M`, `1Y` and `MAX`.
- **R1 (unchanged, not yet observed)**: what the client sends to Enable Banking is fixed by the endpoint allowlist and pinned by the API e2e test (signed JWT with the app id, bank name and country, redirect URL, session id and account uids). The observation against the real bank follows with T016 when the owner has registered the application.
