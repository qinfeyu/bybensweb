# ByBen's Nutrition - Agent Instructions

## Project Overview
Multilingual (EN/FR/AR) sports supplement e-commerce for Algeria. Vanilla HTML/CSS/JS storefront + React 19 admin panel, backed by Supabase, deployed on Vercel. Storefront has **no build step**. No tests, no CI — Vercel serves committed files as-is.

> **`README.md` is stale** — it documents an older layout (flat `*.html`, `shared-utils.js`, Edge Functions `submit-order`/`update-order-status`, `data/`, `code.gs`, `localStorage` cache) that no longer exists. Trust the code and `vercel.json` over any prose.

## Key Directories
| Path | Purpose |
|------|---------|
| `/supplements/{home,products,product-detail,checkout,privacy,track,mgmt9kx}/index.html` | Storefront pages (each page = dir with `index.html/css/js`) |
| `/supplements/panel4rz/` | Admin panel (React + TS + Vite). **Built artifacts `index.html` + `assets/` are committed** and served directly |
| `/supplements/panel4rz/src/` | Admin panel source - edit here |
| `/api` | **Active** Vercel serverless backend (all data/orders route through it) |
| `/content.js` | Root i18n strings (only copy), loaded by every storefront page |

## Development Commands

### Storefront (root, no build)
```bash
npx serve .        # or: python -m http.server 8080
```
Open at `http://localhost:PORT/supplements/home` (clean URLs via `serve.json`).
A plain static server does **not** execute `/api/*`: the inline `fetch("/api/initial-data")` catches to `null` and pages render empty. Full local flow needs `npx vercel dev` with env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_*`, `ECOTRACK_*`). On this machine use `npm.cmd`/`npx` — PowerShell's execution policy blocks `npm.ps1`.

### Admin Panel (`/supplements/panel4rz`)
```bash
npm.cmd run dev    # Vite dev server
npm.cmd run lint   # oxlint
npm.cmd run build  # tsc -b && vite build (outputs to gitignored dist/)
```

**`panel4rz/index.html` is a committed build artifact, not the Vite source entry — build/dev are broken out of the box:**
- `npm run build` fails: `Failed to resolve /supplements/panel4rz/assets/index-*.js from index.html`.
- `npm run dev` "works" but silently serves the stale prebuilt bundle in `assets/` — `src/` edits never appear.
- Rebuild procedure: edit `index.html` back into a source entry (remove the hashed `assets/*` `<script>`/`<link>` tags, add `<script type="module" src="/src/main.tsx"></script>` before `</body>`), run `npm run build`, then copy `dist/index.html` → `index.html` and `dist/assets/*` → `assets/` (delete stale hashed files). **Commit the artifact** — Vercel serves it; a source entry in production breaks the panel.
- The real verification gate is `tsc -b` (runs inside `npm run build`) — it passes on a clean tree.
- `npm run lint` is red on a clean tree: ~12 pre-existing errors (conditional hooks in `src/components/BudgetModal.tsx`) and oxlint also lints the minified `assets/`. Not your regression; don't try to "fix" the baseline.

## Architecture
- **Data flow**: Every storefront page sets `window.__initialDataPromise = fetch("/api/initial-data")` inline in `<head>`; `supplements/supabase-client.js` `getInitialData()` remaps snake_case->camelCase and caches in **`sessionStorage` key `bb_initial_data_cache` (5 min)**. Gift config has its own 30 s cache (`bb_gift_config_cache`). Promo/delivery edits appear stale up to 5 min.
- **Order submission**: Storefront POSTs to `/api/submit-order` (inserts order, bumps promo `uses`, deducts stock across `variants[].flavorStock` + global `stock` + `inventory_items` SKUs, sends Telegram). Never reimplement stock math client-side (`deductStockForOrderItems`/`sendTelegramNotification` in `supabase-client.js` are deliberate no-op stubs — keep them).
- **Admin panel backend**: Routes via `/api/config`, `/api/admin-login`, `/api/admin-data`, `/api/admin-mutate`, `/api/admin-orders-sync`, `/api/admin-logs`. `src/lib/supabase.ts` proxies **all writes** through `adminMutate()`; auth flags in `localStorage` (`bb_admin_auth`, `bb_admin_name`, `bb_admin_token`).
- **Other API routes**: `/api/product-detail-page` renders the product page's HTML server-side (used by `/product-detail` routes for SEO); `/api/ecotrack` proxies delivery-carrier calls (called by `/supplements/track` and panel `OrdersPage`); `/api/cron/daily-summary` is a Vercel cron (21:00 UTC) sending a Telegram summary.
- **Audit trail**: Admin actions land in the `audit_logs` table (30-day auto-prune + 2000-row cap, pruned server-side on every read). Logger: `api/_lib/audit-log.js`, `await`ed from `admin-login.js` and `admin-mutate.js` (fire-and-forget fetches get killed by serverless teardown). Panel's **Audit Logs** page (`LogsPage.tsx`) lists/deletes via `/api/admin-logs` (GET filters `action/actor/days/limit`; DELETE `ids|olderThanDays|all`). Table schema: `supplements/panel4rz/sql/audit_logs.sql` (apply on fresh environments); `audit_logs_uuid_to_bigint.sql` was a one-shot migration for the legacy uuid schema. Writes need `SUPABASE_SERVICE_ROLE_KEY` on Vercel (table has only a SELECT RLS policy).
- **Stock sync quirk**: `InventoryPage` syncs `inventory_items` -> `products` stock; edits use timestamp cache merging (`bb_inventory_items`, `bb_products_cache`, `bb_customers_cache` in `localStorage`). Beware of the 5-min storefront cache on top.
- **i18n**: root `content.js`, `data-i18n` attributes, `localStorage bybens_lang`; RTL for Arabic. Product names/descriptions are single-language.
- **Data format**: IDs = millisecond timestamp strings; `variants`, `flavors`, `image_url`, `items` are `jsonb`; `category_ids`, `sub_category_ids`, `promo_code_ids` are comma-separated `text`.
- Don't hardcode secrets in `api/*.js` - read `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_*`, `ECOTRACK_*` (most files also ship a hardcoded Supabase URL fallback and empty-key fallbacks; never add a real key).

## Gotchas
- **Storefront JS/CSS is cached 1 year** (`vercel.json` gives `/supplements/*.js|css` `max-age=31536000`), so every `<script>`/`<link>` carries a `?v=N` query. When you edit one of these files, bump its `?v=` in every page that loads it or users stay stale for up to a year. `content.js` is cached 1 h; `/*.html` is no-cache.
- `/images/*` is `immutable, max-age=31536000` — never overwrite an image file; upload a new filename instead.
- Admin promo/delivery/cache changes take up to 5 min on storefront (only `products` edits get cache-busted via sync).
- Deleting an order without cancelling first does **not** restore stock.
- Built `assets/` accumulate across rebuilds - delete stale hashed files when committing a new build.
- Frontend only ever has the anon key (via `/api/config`); serverless code uses the service role key (never browser-exposed).
