# ByBen's — Sports Nutrition E-Commerce

A multilingual (Arabic / French / English) e-commerce storefront for sports supplements in Algeria. Built with static HTML/CSS/JS, backed by Supabase, and deployed on Vercel.

---

## Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Frontend         | Vanilla HTML, CSS, JavaScript (no framework, no build)  |
| Database         | Supabase (PostgreSQL)                                   |
| Auth             | Supabase Auth (email + password, admin only)            |
| Edge Functions   | Supabase Edge Functions (Deno/TypeScript)               |
| Image hosting    | Cloudinary CDN                                          |
| Deployment       | Vercel (static, clean URLs via `vercel.json`)           |
| Client storage   | `localStorage` (cart, language, 5-min data cache)       |

---

## Project Structure

```
bybens/
├── supplements/
│   ├── index.html          # Homepage — hero, featured products, bundle banner
│   ├── products.html       # Product listing with category/brand/price filters
│   ├── product-detail.html # Single product page — variants, flavors, quick order
│   ├── checkout.html       # Cart review & order submission form
│   ├── privacy.html        # Privacy policy (EN / FR / AR)
│   ├── mgmt9kx.html        # Admin login
│   ├── panel4rz.html       # Admin panel (products, orders, promos, delivery)
│   ├── supabase-client.js  # Supabase client singleton (window.supabase)
│   ├── shared-utils.js     # Cart, showToast, computeBadge, parseField
│   ├── footer.js           # Injects footer HTML + shipping/returns/about modals
│   ├── footer.css          # Footer + modal styles (shared across all pages)
│   ├── marquee.js          # Injects promo bar into #marqueePlaceholder
│   └── content.js          # i18n strings for EN / FR / AR
├── supabase/
│   └── functions/
│       ├── submit-order/       # Creates order, deducts stock, validates promos
│       ├── update-order-status/ # Changes order status, restores stock on cancel
│       └── submit-contact/     # Stores contact form messages
├── data/                   # CSV exports from Google Sheets (one-time import)
├── images/                 # Static image assets
├── import-data.js          # Node.js script — one-shot CSV → Supabase import
├── code.gs                 # Legacy Google Apps Script (kept for reference)
├── vercel.json             # Clean URLs, redirects, cache headers
└── content.js              # i18n strings (root copy, loaded by all pages)
```

---

## Supabase Database Schema

| Table              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `categories`       | Product categories                                             |
| `sub_categories`   | Subcategories; `category_ids` is a comma-separated string      |
| `products`         | Products with variants, flavors (JSON), stock, discount        |
| `promo_codes`      | Discount codes — fixed or percentage, expiry, usage limits     |
| `delivery_prices`  | Home & office delivery cost for each of the 58 wilayas         |
| `bundle`           | Single-row config — featured bundle shown on the homepage      |
| `orders`           | Customer orders with items (JSON), status, delivery details    |

IDs are millisecond timestamps stored as strings. JSON fields (`variants`, `flavors`, `image_url`, `items`) are stored as PostgreSQL `jsonb` columns. Comma-separated string columns (`category_ids`, `sub_category_ids`, `promo_code_ids`) are `text`.

---

## Edge Functions

All three functions run on Supabase Edge (Deno). They use the **service role key** (never exposed to the browser) for privileged database writes.

| Function              | Trigger               | What it does                                                 |
| --------------------- | --------------------- | ------------------------------------------------------------ |
| `submit-order`        | Customer checkout     | Validates cart, applies promo, deducts stock, inserts order  |
| `update-order-status` | Admin panel           | Updates order status; restores stock when status → cancelled |
| `submit-contact`      | Footer contact form   | Stores name, contact, message                                |

---

## Data Flow

### Customer-facing pages

Every page fires a parallel Supabase REST fetch **before the DOM finishes parsing** (inline `<script>` in `<head>`):

```
window.__initialDataPromise = Promise.all([
  products, categories, sub_categories, bundle, promo_codes, delivery_prices, orders
])
```

The page's main JS `await`s the promise once the DOM is ready. A **5-minute `localStorage` cache** (`bybens_cache_getInitialData`) means repeat visits skip the network entirely.

```
Cold visit:  loader shown → Supabase fetch → render → loader hidden
Warm visit:  loader suppressed instantly → render from cache
```

### Admin panel (`panel4rz.html`)

Makes direct Supabase client calls for all CRUD. Order status changes go through the `update-order-status` Edge Function (needs service role for stock restoration). Admin session is stored in `sessionStorage` as `bb_admin_auth` after `supabase.auth.signInWithPassword`.

---

## Authentication

- **Admin**: Supabase Auth email/password. Login at `/supplements/mgmt9kx`. Session guard on every tab switch in the admin panel.
- **Customers**: No accounts. Orders are anonymous — identified by phone number only.

---

## Languages

Three languages switchable at runtime via buttons in the nav:

| Code | Language | Direction |
| ---- | -------- | --------- |
| `en` | English  | LTR       |
| `fr` | French   | LTR       |
| `ar` | Arabic   | RTL       |

Preference stored in `localStorage` as `bybens_lang`. Static UI strings use `data-i18n="key"` attributes and are populated from `window.BYBENS_CONTENT` (defined in `content.js`). Product names and descriptions are stored in one language only.

---

## Admin Panel Features

Access at `/supplements/mgmt9kx` → `/supplements/panel4rz`.

- Product management — add / edit / delete, Cloudinary image upload, stock tracking
- Category & subcategory management
- Promo code management (fixed / percentage, expiry, per-product or global)
- Delivery price configuration per wilaya (home & office)
- Order management — status updates, cancel (restores stock), delete
- Bundle banner assignment (featured product on homepage)
- Account settings — email / password change via Supabase Auth

---

## Vercel Configuration

`vercel.json` handles:

| Rule                     | Action                                         |
| ------------------------ | ---------------------------------------------- |
| `/`                      | Redirect → `/supplements`                      |
| `/products`, `/checkout`, `/product-detail` | Redirect → `/supplements/*`  |
| `/privacy`               | Redirect → `/supplements/privacy`              |
| `/mgmt9kx`, `/panel4rz`  | Redirect → `/supplements/*`                    |
| `/images/*`              | 1-year immutable cache                         |
| `/*.html`                | No-cache (always fresh)                        |

---

## Local Development

No build step. Serve with any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

Open at `http://localhost:PORT/supplements/index.html` or just `http://localhost:PORT/`.

---

## Data Import

The `import-data.js` script does a one-shot import from the original Google Sheets CSV exports into Supabase. Run once with Node 18+:

```bash
node import-data.js
```

Upserts in dependency order: `categories` → `sub_categories` → `products` → `promo_codes` → `delivery_prices`.

---

## Known Limitations

- `handleDeletePromo` and `handleAddPromo` in the admin panel do not invalidate the client-side cache — promo changes take up to 5 minutes to appear on the storefront.
- Same for `handleAddDeliveryPrice`, `handleUpdateDeliveryPrice`, `handleDeleteDeliveryPrice`.
- Deleting an order directly (without cancelling first) does **not** restore stock. Always cancel before deleting.
