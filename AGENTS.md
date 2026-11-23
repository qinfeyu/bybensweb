# ByBen's — Agent Instructions

## Project Overview
Multilingual (EN/FR/AR) sports supplement e-commerce for Algeria. Vanilla HTML/CSS/JS storefront + React 19 admin panel, Supabase data, deployed on Vercel. Storefront has **no build step**. No tests, no CI, no linter at root — Vercel serves committed files as-is.

> **`README.md` is stale.** It documents a layout that no longer exists (flat `*.html`, `supplements/shared-utils.js`, Supabase Edge Functions, `data/`, `code.gs`, `import-data.js`, `localStorage` cache). Trust the code and `vercel.json` over any prose.

## Key Directories
| Path | Purpose |
|------|---------|
| `/supplements/{home,products,product-detail,checkout,privacy,track}/` | Storefront pages (each page = dir with `index.html`/`index.css`/`index.js`) |
| `/supplements/mgmt9kx/` | Admin **login** page → POST `/api/admin-login` → redirect to panel |
| `/supplements/panel4rz/` | Admin panel (React + TS + Vite). **Built `index.html` + `assets/` are committed** and served directly |
| `/supplements/panel4rz/src/` | Panel source — edit here, then rebuild the artifact |
| `/supplements/supabase-client.js`, `footer.js/css`, `marquee.js` | Shared storefront modules |
| `/api` | Vercel serverless backend — all data/orders/writes route through it |
| `/content.js` | Root i18n strings (only copy), loaded by the 6 storefront pages (not the panel or login page) |

## Development Commands

### Storefront (root, no build)
```bash
npx serve .        # or: python -m http.server 8080
```
Open `http://localhost:PORT/supplements/home` (clean URLs via `serve.json`). A static server does **not** run `/api/*`: the inline `fetch("/api/initial-data")` catches to `null` and pages render empty. Full local flow needs `npx vercel dev` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_*`, `ECOTRACK_*`. On this machine use `npm.cmd`/`npx.cmd` — PowerShell blocks `npm.ps1`.

Root `package.json` has **no dependencies or scripts** (only `engines.node >= 18`); don't try to `npm install`/`npm run` anything at root.

### Admin Panel (`/supplements/panel4rz`)
```bash
npm.cmd run build  # tsc -b && vite build → dist/ (gitignored)
npx.cmd tsc -b     # focused, fast typecheck — the real quality gate, passes on a clean tree
npm.cmd run lint   # oxlint — RED on a clean tree (see below)
```

**`panel4rz/index.html` is a committed build artifact, not the Vite source entry — build and dev are broken out of the box:**
- `npm run build` fails with `Failed to resolve /supplements/panel4rz/assets/index-*.js from .../index.html`.
- `npm run dev` serves whatever `index.html` points at, so with the artifact checked in, `src/` edits never appear.
- Rebuild procedure: strip the hashed `assets/*` `<script>`/`<link>`/`modulepreload` tags from `index.html` and put `<script type="module" src="/src/main.tsx"></script>` before `</body>`, run `npm run build`, then copy `dist/index.html` → `index.html` and `dist/assets/*` → `assets/` (delete stale hashed files). `vite.config.ts` sets `base: '/supplements/panel4rz/'`, so `dist/index.html` already has correct absolute paths. **Commit the artifact** — production serves it; a source entry in production breaks the panel.
- `npm run lint` baseline is red: oxlint also lints the minified `assets/` (thousands of warnings) and `src/` still fails on ~12 pre-existing `react-hooks(rules-of-hooks)` errors in `src/components/BudgetModal.tsx` plus many `no-unused-vars` warnings. Not your regression — don't "fix" the baseline; don't use lint to validate a change.

## Architecture
- **Initial data**: every storefront page except the `mgmt9kx` login sets `window.__initialDataPromise = fetch("/api/initial-data")` inline in `<head>`; `supabase-client.js` `getInitialData()` remaps snake_case→camelCase and caches in **`sessionStorage` `bb_initial_data_cache` (5 min)**. Gift config has its own 30 s cache (`bb_gift_config_cache`). `/api/initial-data` sends `s-maxage=30, max-age=15`. Net effect: admin promo/delivery/category edits look stale for up to 5 min.
- **Order submission**: storefront POSTs `/api/submit-order` (inserts order, bumps promo `uses`, deducts stock across `variants[].flavorStock` + global `stock` + `inventory_items` SKUs, sends Telegram). Never reimplement *that* stock math client-side — `deductStockForOrderItems`/`sendTelegramNotification` in `supabase-client.js` are deliberate no-op stubs; keep them. `/api/submit-order` checks `res.ok` on every stock PATCH and Telegram-flags partial deduction failures (`issues[]`).
- **Bundle packs are never stocked directly**: selling one deducts `component.qty × orderQty` from each component SKU, recursively (max depth 5), and re-derives bundle stock as `min(floor(componentStock / componentQty))`. Both `/api/submit-order` and the panel POS/cancel path implement this — change them together.
- **Cancelling/restoring stock is client-side**, in `src/App.tsx` (`adjustBundleStock`, `syncProductsWithInventory`, direction-based restore). There is no server restore path; deleting an order without cancelling first restores nothing.
- **Panel state is centralized**: `src/App.tsx` (~3k lines) owns all data, auth, realtime, and handlers; `src/pages/*` are presentational components fed by props. Add features there (state + handler in `App.tsx`, prop in the page), not by fetching inside a page.
- **Panel reads vs writes**: bootstrap is `GET /api/admin-data` (service role, every table) with a parallel direct-Supabase fallback in `App.tsx`; order polling is `GET /api/admin-orders-sync?since=<ISO>` (incremental, 2000-row cap); other reads use the anon key from `/api/config`. Writes are diverted to `/api/admin-mutate` by the `supabase` wrapper in `src/lib/supabase.ts` — **only** `upsert`/`insert` (unchained), `update(...).eq(...)`, and `delete()` chained with `.eq()`, `.in()`, or `.like()`. Anything else (e.g. `update().in()`, `.neq`, `.match`, `.order`) silently falls through to the direct anon client and fails under RLS. Keep writes to the supported shapes; if a write "works" in dev but not prod, this is why.
- **No auth on admin APIs**: `/api/admin-mutate` validates nothing and has no table allowlist — `bb_admin_auth`/`bb_admin_name`/`bb_admin_token` in `localStorage` are cosmetic (login UI + audit actor) and `actor_email` is client-supplied. Never assume an `/api/admin-*` route is protected.
- **Other API routes**: `/api/product-detail-page` server-renders product HTML and is what `vercel.json` routes `/product-detail` and `/supplements/product-detail` to (SEO); `/api/ecotrack` proxies the delivery carrier (used by `/supplements/track` and panel `OrdersPage`); `/api/submit-contact` writes the `contacts` table and notifies `TELEGRAM_CONTACTS_CHAT_ID || TELEGRAM_CHAT_ID`; `/api/cron/daily-summary` is the Vercel cron (21:00 UTC) Telegram summary, also callable from `DashboardPage`.
- **Audit trail**: admin actions land in `audit_logs` (30-day prune + 2000-row cap, enforced server-side on read). Logger `api/_lib/audit-log.js` is `await`ed from `admin-login.js`/`admin-mutate.js` — fire-and-forget fetches get killed by serverless teardown. `LogsPage.tsx` uses `/api/admin-logs` (GET filters `action/actor/days/limit`; DELETE `ids|olderThanDays|all`). Tables live in `supplements/panel4rz/sql/` (some are one-off migrations, e.g. `audit_logs_uuid_to_bigint.sql`, `bundle_items_productid_normalize.sql`) — apply with the Supabase SQL editor when a change requires it.
- **Stock sync quirk**: `InventoryPage` syncs `inventory_items` → `products` stock. The panel merge is **cloud-authoritative for stock** (`_lastUpdated` is a client-only marker, never persisted — never let local timestamps override cloud stock); `localStorage` (`bb_inventory_items`, `bb_products_cache`, `bb_customers_cache`) only keeps rows missing in cloud / non-stock fields. New-order events trigger a throttled (~10 s) lean refetch of `inventory_items(id,stock)` + `products(id,stock,variants)`; there is no stock polling.
- **i18n**: root `content.js`, `data-i18n` attributes, `localStorage bybens_lang`, RTL for Arabic. Product names/descriptions are single-language.
- **Data format**: IDs = millisecond timestamp strings; `variants`, `flavors`, `image_url`, `items`, `bundle_items` are `jsonb`; `category_ids`, `sub_category_ids`, `promo_code_ids` are comma-separated `text`. Customer names: the storefront full-name field (and POS/pre-orders) store the whole name in `orders.first_name` with `last_name = ''`; UI code composes `first_name + last_name`, so don't split it. `api/submit-order` also still accepts legacy `firstName`/`lastName` for cached bundles.
- **Secrets**: `api/*.js` reads `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_*`, `ECOTRACK_*` (files ship a hardcoded public Supabase URL fallback plus empty key fallbacks; never add a real key). Browsers only ever get the anon key via `/api/config`.

## Gotchas
- **Storefront JS/CSS is cached 1 year** (`vercel.json`: `/supplements/*.js|css` → `max-age=31536000`), so every `<script>`/`<link>` carries `?v=N`. Editing one of those files without bumping its `?v=` in *every* page that loads it leaves users stale for a year. Versions differ per page today (`content.js` is `v=2` on some pages, `v=3` on others) — grep `\?v=` and bump the exact reference, don't assume one global number. `/*.html` is no-cache; `content.js` is 1 h.
- `/images/*` is `immutable, max-age=31536000` — never overwrite an image file; upload a new filename.
- Header/nav markup is copy-pasted in each page's `index.html` (only the footer is injected by `footer.js`) — storefront chrome changes must be repeated across all 6 storefront pages; the `mgmt9kx` login page has no shared nav/footer.
- Cloudinary uploads use an unsigned client preset in `src/lib/cloudinary.ts` — intentional; don't move it behind an API.
- Built `assets/` accumulate across rebuilds — delete stale hashed files when committing a new build.
