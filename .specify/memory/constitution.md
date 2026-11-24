# Vermögenskompass Constitution

## Core Principles

### I. Exact Money

- Amounts MUST be stored and computed as integer cents (EUR).
- Quantities, prices and rates MUST be decimal strings, computed with decimal.js.
- Rounding MUST be half-even. Breakdowns that are shown as parts of a total MUST add up to the
  total to the cent (largest remainder).

Rationale: a wealth tracker that is off by cents loses trust; floating point cannot be audited.

### II. Owner-Controlled, Local Data

- Financial data MUST stay on the owner's machine or server. No feature may send it to third
  parties, and fonts, avatars and search MUST be served by the app itself.
- External sources (broker, bank, price data) MUST be read-only. Every callable tool or endpoint
  MUST be on an explicit allowlist, and anything that can trade, transfer or change settings MUST
  stay blocked.
- Logins and consents at a bank or broker MUST be done by the owner on the provider's own page.
  The app MUST NOT see or store bank or broker passwords.
- Access grants and tokens MUST be stored AES-GCM encrypted and MUST NOT appear in any API
  response, log or error message.

Rationale: the owner keeps full control; a self-hosted tracker must not become a data leak.

### III. Public Repository Hygiene

- The repository is public. Commits, issues, pull requests and fixtures MUST NOT contain private
  infrastructure details: IP or MAC addresses, host names, server paths, secrets, passwords or
  personal financial data.
- A leak guard MUST run before every commit.
- Recorded provider responses MUST be anonymized (names, ids, ISINs, amounts, dates) before they
  become test fixtures; raw recordings stay in git-ignored folders.

Rationale: a public repo is permanent; one leaked value cannot be taken back.

### IV. Tested by Layer

- Every feature MUST have:
  - domain unit tests for calculations;
  - API e2e tests for endpoints;
  - component tests for non-trivial UI;
  - one Playwright journey per user story.
- Lint, format check and typecheck MUST pass before every task commit. The full suites MUST pass
  before a feature is marked "Implemented".
- A test that fails MUST be fixed or the behavior corrected. It MUST NOT be skipped to get green.

Rationale: many small slices only stay safe when each layer is pinned by tests.

### V. Local First, Deploy by Separate Plan

- Every change MUST be verified on the local dev server (web 3100, API 3101) before it counts
  as done.
- Feature specs, plans and tasks MUST NOT contain deployment work. Deployment is planned and
  delivered in its own plan.
- Every command on the owner's server MUST be shown first and run only after the owner's explicit OK.

Rationale: the owner tests locally and decides when and how the app goes live.

### VI. German, Responsive, Honest UI

- The UI MUST be German. Planning artifacts, code, commits and pull requests are in English.
- Every page MUST work from 360 px without horizontal page scroll, in dark and light mode.
- Missing data MUST show an empty state or "–". The UI MUST NOT show "NaN" or fake zero amounts.
- Amounts are shown in German format with a space before "€".

Rationale: the tool is used daily on phone and desktop; wrong-looking numbers destroy trust.

## Security Requirements

- Single owner account. Sessions use secure, httpOnly cookies. Login is rate-limited.
- The production Content-Security-Policy allows only the app's own origin for scripts, styles,
  fonts and connections.
- New external integrations MUST document in research which data leaves the server, to whom,
  and under which license or registration (e.g. PSD2 account-information service, FinTS product
  registration).

## Development Workflow

- Spec Kit flow: `speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`.
  Every plan's "Constitution Check" MUST pass against this document.
- One commit per task, pushed right after the gates pass. The feature issue's checklist MUST
  match `tasks.md` after every task.
- Deviations from a task's text MUST be written back into `tasks.md` (and research or contract
  when affected) in the same commit.

## Governance

- This constitution takes precedence over other practices in this repository.
- Amendments are made with `speckit-constitution`, with a version bump:
  - MAJOR: a principle is removed or redefined.
  - MINOR: a principle or section is added or materially expanded.
  - PATCH: wording only.
- Every plan's Constitution Check and every pull request MUST verify compliance. Exceptions MUST
  be recorded with their reason in the plan's Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-11-24 | **Last Amended**: 2026-11-24
