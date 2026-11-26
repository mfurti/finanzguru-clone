# web

Nuxt 4 + Nuxt UI 4 frontend of Vermögenskompass (German UI via `@nuxtjs/i18n`, charts with Unovis).

## Layout

| Path                             | What                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/pages`                      | Übersicht (`index`), `investments/*` (Positionen, Transaktionen, Analyse, Dividenden, Steuern, Watchlists, instrument detail), `budget/*`, `insurance`, `settings/*` (sources, categories, inflation), `login` |
| `app/components`                 | Referenced by file name (`pathPrefix: false`): `common`, `dashboard`, `investments`, `analysis`, `dividends`, `taxes`, `watchlists`, `budget`, `import`, `insurance`, `brand`                                  |
| `app/composables`                | `useApi`/`apiFetch` (cookie forwarding, 401 handling), account filter, budget period, category options                                                                                                         |
| `app/middleware/auth.global.ts`  | Redirects to `/login` without a session                                                                                                                                                                        |
| `server/routes/api/[...path].ts` | Proxies `/api/**` to the NestJS API (`NUXT_API_BASE_URL`), so the browser uses one origin                                                                                                                      |
| `i18n/locales/de.json`           | All UI texts                                                                                                                                                                                                   |

## Configuration

- `NUXT_API_BASE_URL` (runtime) or `API_BASE_URL` (build time): where the API listens. Default `http://localhost:3001`.
- Production responses carry a same-origin CSP and other security headers (`nuxt.config.ts`).

## Scripts

| Command                   | What                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `pnpm --filter web dev`   | Dev server on :3000 (`dev:local` on :3100)                       |
| `pnpm --filter web build` | Production build in `.output/` (`node .output/server/index.mjs`) |
| `pnpm --filter web test`  | Component tests with `@nuxt/test-utils`                          |
