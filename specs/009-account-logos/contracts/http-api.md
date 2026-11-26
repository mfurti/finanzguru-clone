# HTTP API: Logos for Banks, Brokers, Portfolios and Accounts (009)

All routes need the owner session. Errors `{ statusCode, statusMessage }` (German).

## Changed

### `GET /api/accounts`

Each item gains `logo` (LogoRef, 008), `logoSource`, `logoKey` (`institution:<institutionId>` or null for "Manuell").

### `GET /api/logos/brands?q=`

Also returns local brands (`slug: "local:<key>"`), listed first.

### `PUT/DELETE /api/logos/recipients/:key`, `POST …/upload`

Accept keys `institution:<institutionId>` (unchanged validation: 1–200 characters).

## New

### `GET /api/logos/brands/local/:key`

Serves the local logo file of `local:<key>` with its content type, `Cache-Control: private, max-age=86400`, `X-Content-Type-Options: nosniff`, and for SVG the 008 CSP. Unknown key → 404.
