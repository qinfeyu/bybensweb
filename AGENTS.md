# ByBen's Nutrition - Agent Instructions

## Project Overview
Multilingual (EN/FR/AR) sports supplement e-commerce for Algeria. Vanilla HTML/CSS/JS storefront + React 19 admin panel, backed by Supabase, deployed on Vercel. Storefront has **no build step**.

## Key Directories
| Path | Purpose |
|------|---------|
| `/supplements/{home,products,product-detail,checkout,privacy,mgmt9kx}/index.html` | Storefront pages (each page = dir with `index.html/css/js`) |
| `/supplements/panel4rz/` | Admin panel (React + TS + Vite). **Built artifacts `index.html` + `assets/` are committed** and served directly |
| `/supplements/panel4rz/src/` | Admin panel source - edit here |
| `/supplements/panel4rz_legacy/` | Old vanilla-JS admin - do not edit, remove when safe |
| `/api` | **Active** Vercel serverless backend (all data/orders route through it) |
| `/supabase/functions` | Edge Functions (Deno/TS) - legacy, not called by current frontend |
| `/content.js` | Root i18n strings, loaded with `defer` by every storefront page |

## Development Commands

### Storefront (root, no build)
```bash
npx serve .        # or: python -m http.server 8080
```
Open at `http://localhost:PORT/supplements/home` (clean URLs via `serve.json`).

### Admin Panel (`/supplements/panel4rz`)
```bash
npm run dev       # Vite dev server
npm run lint      # oxlint
npm run build     # tsc -b && vite build (outputs to gitignored dist/)
```
**After editing React source you must `npm run build`, then sync `dist/` output into the panel4rz root** (`index.html` + `assets/*`). Vercel has no build step - it serves the committed files. Check `git status` shows updated hashed assets.

## Architecture
- **Data flow**: Every storefront page sets `window.__initialDataPromise = fetch("/api/initial-data")` inline in `<head>`; `supplements/supabase-client.js` `getInitialData()` remaps snake_case->camelCase and caches in **`sessionStorage` key `bb_initial_data_cache` (5 min)**. Promo/delivery edits appear stale up to 5 min.
- **Order submission**: Storefront POSTs to `/api/submit-order` (inserts order, bumps promo `uses`, deducts stock across `variants[].flavorStock` + global `stock` + `inventory_items` SKUs, sends Telegram). Never reimplement stock math client-side.
- **Admin panel backend**: Routes via `/api/config`, `/api/admin-login`, `/api/admin-data`, `/api/admin-mutate`, `/api/admin-orders-sync`, `/api/admin-logs`. `src/lib/supabase.ts` proxies writes through `adminMutate`; auth stored in `localStorage` (`bb_admin_auth` etc.).
- **Audit trail**: Admin actions are recorded in the `audit_logs` table (30-day auto-prune + 2000-row cap, pruned server-side on every read). Logger lives in `api/_lib/audit-log.js`, called (and `await`ed — serverless teardown kills fire-and-forget fetches) from `admin-login.js` and `admin-mutate.js`; the panel's **Audit Logs** page (`LogsPage.tsx`, `'logs'` tab) lists/deletes via `/api/admin-logs` (GET filters: `action/actor/days/limit`; DELETE `ids|olderThanDays|all`). Table is created by `supplements/panel4rz/sql/audit_logs.sql` - apply it to Supabase on any fresh environment. Writes need `SUPABASE_SERVICE_ROLE_KEY` on Vercel (table has only a SELECT RLS policy; no insert/delete policies). `supplements/panel4rz/sql/audit_logs_uuid_to_bigint.sql` was a one-shot rebuild for this project's legacy uuid-schema table.
- **Stock sync quirk**: `InventoryPage` syncs `inventory_items` -> `products` stock; edits use smart timestamp cache merging (`bb_inventory_*` keys). Beware of the 5-min storefront cache on top.
- **i18n**: `content.js` at root URL, `data-i18n` attributes, `localStorage bybens_lang`; RTL for Arabic. Product names/descriptions are single-language.
- **Data format**: IDs = millisecond timestamp strings; `variants`, `flavors`, `image_url`, `items` are `jsonb`; `category_ids`, `sub_category_ids`, `promo_code_ids` are comma-separated `text`.
- **Root scripts**: `import-data.js`, `fix_cust.js`, `test-*.js`, top-level SQL - one-off scratch, not part of the app. Root `package.json` has no deps/scripts.
- Don't hardcode secrets in `api/*.js` - they read `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_*` (some files also ship insecure fallback defaults; avoid touching those).

## Gotchas
- Admin promo/delivery/cache changes take up to 5 min on storefront (only `products` edits get cache-busted via sync).
- Deleting an order without cancelling first does **not** restore stock.
- Admin panel temp branch/live: built `assets/` accumulate - clean stale hashed files when committing a rebuild.
- Edge Functions use the service role key (never browser-exposed); frontend only has anon key via `/api/config`.