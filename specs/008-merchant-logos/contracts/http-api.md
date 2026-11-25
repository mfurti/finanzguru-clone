# HTTP API: Merchant Logos (008)

All routes need the owner session (existing guard). Errors are German `{ message }`.

## Changed

### `GET /api/transactions` (and every endpoint returning `TransactionListItem`)

Each item gains `logo`, `logoSource`, `recipientKey` (see data-model.md › LogoRef).

## New

### `GET /api/logos/brands?q=<text>&limit=<1-60, default 40>`

Search over title, slug and aliases (normalized, substring). Empty `q` → curated brands first.

```json
[{ "slug": "lidl", "title": "Lidl", "hex": "0050AA", "url": "/api/logos/brands/lidl.svg?v=16.38.1" }]
```

### `GET /api/logos/brands/:slug.svg`

`image/svg+xml`, 24×24 viewBox, `fill="#<hex>"`. `Cache-Control: public, max-age=31536000, immutable`. Unknown slug → 404.

### `PUT /api/logos/recipients/:key`

Body `{ "mode": "brand", "brandSlug": "lidl" }` or `{ "mode": "none" }`. Unknown slug → 400 "Unbekannte Marke". Key 1–200 chars (URL-encoded). Response: the saved `LogoRef` (or null for none).

### `DELETE /api/logos/recipients/:key`

Back to automatic; deletes an uploaded file. 204.

### `POST /api/logos/recipients/:key/upload`

`multipart/form-data`, one field `file`. > 256 KB → 413 "Bild zu groß (max. 256 KB)". Not PNG/JPEG/WebP by content → 415 "Nur PNG, JPEG oder WebP". Response: `LogoRef` `{ kind: 'upload', url }`.

### `GET /api/logos/files/:name`

Serves an uploaded file. Name must match `^[0-9a-f-]{36}\.(png|jpg|webp)$`, else 404. Headers: matching `Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`.
