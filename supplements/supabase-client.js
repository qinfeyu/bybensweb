// ByBens – Supabase client + shared data helpers
// Requires @supabase/supabase-js CDN to be loaded first.
// Wrapped in IIFE so const declarations don't collide with page scripts.

(function () {
  var _URL = window.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";
  var _KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";

  window.SUPABASE_URL = _URL;
  window.SUPABASE_ANON_KEY = _KEY;
  window.supabase = supabase.createClient(_URL, _KEY);

  // ── Remapping helpers: snake_case (Supabase REST) → camelCase (app) ──

  function _remapProduct(p) {
    return {
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      categoryIds: (p.category_ids || "").split(",").filter(Boolean),
      subCategoryIds: (p.sub_category_ids || "").split(",").filter(Boolean),
      description: p.description || "",
      imageUrl: Array.isArray(p.image_url) ? p.image_url : (p.image_url ? [p.image_url] : []),
      variants: p.variants || [],
      flavors: p.flavors || [],
      stock: Number(p.stock) || 0,
      discount: Number(p.discount) || 0,
      allowPromo: p.allow_promo === true || p.allow_promo === "true",
      promoCodeIds: (p.promo_code_ids || "").split(",").filter(Boolean),
      status: p.status || "active",
      createdAt: p.created_at,
      bundleItems: p.bundle_items || [],
    };
  }

  function _remapCategory(c) {
    return { id: c.id, name: c.name, description: c.description || "", createdAt: c.created_at };
  }

  function _remapSubCategory(s) {
    return { id: s.id, name: s.name, categoryIds: (s.category_ids || "").split(",").filter(Boolean), createdAt: s.created_at };
  }

  function _remapBundle(b) {
    if (!b) return { bundleId: "", titleEn: "", titleFr: "", titleAr: "", descriptionEn: "", descriptionFr: "", descriptionAr: "" };
    return {
      bundleId:      b.bundle_id || "",
      titleEn:       b.title_en || "",
      titleFr:       b.title_fr || "",
      titleAr:       b.title_ar || "",
      descriptionEn: b.description_en || "",
      descriptionFr: b.description_fr || "",
      descriptionAr: b.description_ar || "",
    };
  }

  function _remapPromo(p) {
    return {
      id: p.id, code: p.code, type: p.type, value: Number(p.value) || 0,
      minOrder: Number(p.min_order) || 0,
      maxUses: p.max_uses != null ? Number(p.max_uses) : null,
      uses: Number(p.uses) || 0, expiry: p.expiry || "",
      status: p.status || "active",
      applyToAll: p.apply_to_all === true || p.apply_to_all === "true",
      createdAt: p.created_at,
    };
  }

  function _remapDeliveryPrice(d) {
    return { id: d.id, wilaya: d.wilaya, homePrice: Number(d.home_price) || 0, officePrice: Number(d.office_price) || 0, createdAt: d.created_at };
  }

  function _remapOrder(o) {
    return {
      id: o.id, source: o.source || "", firstName: o.first_name || "", lastName: o.last_name || "",
      phone: o.phone || "", address: o.address || "", wilaya: o.wilaya || "", commune: o.commune || "",
      deliveryType: o.delivery_type || "", deliveryCost: Number(o.delivery_cost) || 0,
      promoCode: o.promo_code || "", promoDiscount: Number(o.promo_discount) || 0,
      items: Array.isArray(o.items) ? o.items : [],
      subtotal: Number(o.subtotal) || 0, total: Number(o.total) || 0,
      status: o.status || "waiting", createdAt: o.created_at,
    };
  }

  function calculateBundleStockAndPrice(bundle, productsList) {
    if (!bundle || !Array.isArray(bundle.bundleItems) || bundle.bundleItems.length === 0) return null;
    
    var totalBasePrice = 0;
    var totalStock = Infinity;
    
    bundle.bundleItems.forEach(function (item) {
      var prod = productsList.find(function (p) { return p.id === item.productId; });
      if (prod) {
        var price = 0;
        var stock = 0;
        var variants = prod.variants || [];
        if (item.variant && variants.length > 0) {
          var v = variants.find(function (x) {
            var label = x.weight ? (x.weight + (x.unit || "")).trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
            return label === String(item.variant).trim().toLowerCase();
          });
          price = v ? Number(v.price) || 0 : Number(variants[0].price) || 0;
          stock = v ? Number(v.stock) || 0 : 0;
        } else {
          price = variants.length > 0 ? Number(variants[0].price) || 0 : 0;
          stock = Number(prod.stock) || 0;
        }
        totalBasePrice += price * (Number(item.qty) || 1);
        totalStock = Math.min(totalStock, Math.floor(stock / (Number(item.qty) || 1)));
      } else {
        totalStock = 0;
      }
    });
    
    if (totalStock === Infinity) totalStock = 0;
    
    return {
      price: totalBasePrice,
      stock: totalStock
    };
  }

  window.sbRemapInitialData = function (raw) {
    if (!raw) return null;
    var prods = Array.isArray(raw.products) ? raw.products : [];

    var productsRemapped = prods.map(_remapProduct);
    
    // Post-process bundles to calculate dynamic price & stock
    productsRemapped.forEach(function (p) {
      if (p.bundleItems && p.bundleItems.length > 0) {
        var calc = calculateBundleStockAndPrice(p, productsRemapped);
        if (calc) {
          p.stock = calc.stock;
          if (p.variants && p.variants.length > 0) {
            p.variants[0].price = calc.price;
            p.variants[0].stock = calc.stock;
          } else {
            p.variants = [{ weight: "1", unit: "Bundle", price: calc.price, stock: calc.stock }];
          }
        }
      }
    });

    var bundleRow = raw.bundle;
    if (Array.isArray(bundleRow)) bundleRow = bundleRow[0] || {};

    return {
      success: true,
      products: productsRemapped,
      categories: (Array.isArray(raw.categories) ? raw.categories : []).map(_remapCategory),
      subCategories: (Array.isArray(raw.subCategories) ? raw.subCategories : Array.isArray(raw.sub_categories) ? raw.sub_categories : []).map(_remapSubCategory),
      bundle: _remapBundle(bundleRow),
      promos: (Array.isArray(raw.promos) ? raw.promos : Array.isArray(raw.promo_codes) ? raw.promo_codes : []).map(_remapPromo),
      deliveryPrices: (Array.isArray(raw.deliveryPrices) ? raw.deliveryPrices : Array.isArray(raw.delivery_prices) ? raw.delivery_prices : []).map(_remapDeliveryPrice),
      orders: (Array.isArray(raw.orders) ? raw.orders : []).map(_remapOrder),
      settings: Array.isArray(raw.settings) ? raw.settings : [],
    };
  };

  // Direct Supabase fallback — used when /api/initial-data is unavailable.
  // Orders intentionally excluded: anon no longer has SELECT on that table.
  function _sbFetchAllTables() {
    var h = { apikey: _KEY, Authorization: "Bearer " + _KEY };
    function sf(path) {
      return fetch(_URL + "/rest/v1/" + path, { headers: h }).then(function (r) { return r.json(); });
    }
    return Promise.all([
      sf("products?select=id,name,brand,category_ids,sub_category_ids,description,image_url,variants,flavors,stock,discount,allow_promo,promo_code_ids,status,created_at,bundle_items&hidden=not.is.true"),
      sf("categories?select=*"),
      sf("sub_categories?select=*"),
      sf("bundle?select=*&limit=1"),
      sf("promo_codes?select=*"),
      sf("delivery_prices?select=*"),
      sf("settings?select=*"),
    ]).then(function (results) {
      return {
        products:       Array.isArray(results[0]) ? results[0] : [],
        categories:     Array.isArray(results[1]) ? results[1] : [],
        subCategories:  Array.isArray(results[2]) ? results[2] : [],
        bundle:         (Array.isArray(results[3]) ? results[3][0] : null) || {},
        promos:         Array.isArray(results[4]) ? results[4] : [],
        deliveryPrices: Array.isArray(results[5]) ? results[5] : [],
        settings:       Array.isArray(results[6]) ? results[6] : [],
        orders:         [],
      };
    });
  }

  window.getInitialData = function () {
    // Prefer the edge-cached /api/initial-data prefetch; fall back to direct calls.
    var src = window.__initialDataPromise
      ? window.__initialDataPromise.then(function (d) { return d || _sbFetchAllTables(); })
      : _sbFetchAllTables();
    return src.then(function (rawData) {
      if (!rawData) return null;
      return window.sbRemapInitialData(rawData);
    });
  };
})();
