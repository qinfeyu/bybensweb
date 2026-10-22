-- =============================================================================
-- Normalise composite bundle component ids
-- =============================================================================
-- The bundle builder used to store a synthetic component id built from the
-- catalogue key ("<productId>_<variant>_<flavor>"). That string is not a real
-- product id, which made the component impossible to resolve by id (stock
-- adjustments and catalogue lookups then had to rely on the SKU alone).
--
-- This script rewrites every `bundle_items[].productId` to the real catalogue
-- product id. Components are matched by longest product-id prefix, so product
-- ids containing underscores (e.g. "prod_1712345678901") are handled correctly.
--
-- Components that are pure inventory SKUs (no catalogue product) are left
-- untouched on purpose: their `productId` IS the inventory SKU id, which is
-- the correct identity for them.
--
-- The script is IDEMPOTENT: running it twice produces the same result.
--
-- Run it in the Supabase SQL editor (or `psql`) against the live database.
-- =============================================================================

-- ── 1. BEFORE: list the synthetic component ids that will be rewritten ──────
SELECT
  p.id                AS bundle_product_id,
  p.name              AS bundle_product_name,
  c.value->>'productId' AS current_product_id,
  c.value->>'sku'       AS component_sku
FROM products p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.bundle_items, '[]'::jsonb)) AS c(value)
WHERE jsonb_typeof(p.bundle_items) = 'array'
  AND jsonb_array_length(p.bundle_items) > 0
  AND strpos(COALESCE(c.value->>'productId', ''), '_') > 0
  AND NOT EXISTS (
    SELECT 1 FROM products p2
    WHERE strpos(COALESCE(c.value->>'productId', ''), p2.id || '_') = 1
  );


-- ── 2. THE MIGRATION ────────────────────────────────────────────────────────
UPDATE products b
SET bundle_items = (
  SELECT jsonb_agg(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM products p
        WHERE strpos(COALESCE(ci.value->>'productId', ''), p.id || '_') = 1
      )
      THEN jsonb_set(
        ci.value,
        '{productId}',
        to_jsonb((
          SELECT p.id FROM products p
          WHERE strpos(COALESCE(ci.value->>'productId', ''), p.id || '_') = 1
          ORDER BY length(p.id) DESC
          LIMIT 1
        ))
      )
      ELSE ci.value
    END
  )
  FROM jsonb_array_elements(COALESCE(b.bundle_items, '[]'::jsonb)) AS ci
)
WHERE jsonb_typeof(b.bundle_items) = 'array'
  AND jsonb_array_length(b.bundle_items) > 0;


-- ── 3. AFTER: must return 0 rows (no synthetic component id left) ──────────
SELECT
  p.id                  AS bundle_product_id,
  p.name                AS bundle_product_name,
  c.value->>'productId' AS current_product_id,
  c.value->>'sku'       AS component_sku
FROM products p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.bundle_items, '[]'::jsonb)) AS c(value)
WHERE jsonb_typeof(p.bundle_items) = 'array'
  AND jsonb_array_length(p.bundle_items) > 0
  AND strpos(COALESCE(c.value->>'productId', ''), '_') > 0
  AND NOT EXISTS (
    SELECT 1 FROM products p2
    WHERE strpos(COALESCE(c.value->>'productId', ''), p2.id || '_') = 1
  );


-- ── 4. RECONCILIATION REPORT (read-only) ───────────────────────────────────
-- Bundle stock is derived from its components:
--     sellable packs = MIN( component_inventory_stock / component_qty )
-- Use this report after the migration to spot bundles whose stored stock no
-- longer matches their components (e.g. orders placed before the server-side
-- bundle unpacking was fixed, or components whose SKU link is missing).
SELECT
  b.id                                          AS bundle_product_id,
  b.name                                        AS bundle_product_name,
  b.stock                                       AS stored_bundle_stock,
  c.value->>'sku'                               AS component_sku,
  c.value->>'productId'                         AS component_product_id,
  (c.value->>'qty')::numeric                    AS component_qty,
  inv.stock                                     AS component_inventory_stock,
  FLOOR(COALESCE(inv.stock, 0) / NULLIF((c.value->>'qty')::numeric, 0))
                                                 AS packs_allowed_by_component,
  (inv.id IS NULL)                              AS sku_not_linked
FROM products b
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.bundle_items, '[]'::jsonb)) AS c(value)
LEFT JOIN inventory_items inv
  ON LOWER(inv.id) = LOWER(COALESCE(c.value->>'sku', ''))
WHERE jsonb_typeof(b.bundle_items) = 'array'
  AND jsonb_array_length(b.bundle_items) > 0
ORDER BY b.name, component_sku;
