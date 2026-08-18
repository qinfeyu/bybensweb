// ByBens – Supabase client + shared data helpers
// Requires @supabase/supabase-js CDN to be loaded first.
// Wrapped in IIFE so const declarations don't collide with page scripts.

(function () {
  // ── Global Error Telemetry & Exception Monitor ──

  // ── Global Error Telemetry & Exception Monitor ──
  window.addEventListener("error", function (evt) {
    console.warn("[ByBens Telemetry Error]", evt.message, "at", evt.filename, ":", evt.lineno);
  });

  window.addEventListener("unhandledrejection", function (evt) {
    console.warn("[ByBens Unhandled Promise Rejection]", evt.reason);
  });

  // ── Remapping helpers: snake_case (Supabase REST) → camelCase (app) ──

  function optimizeCloudinaryUrl(url) {
    if (!url || typeof url !== "string") return "";
    if (url.indexOf("res.cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
      if (url.indexOf("/f_auto") !== -1 || url.indexOf("/q_auto") !== -1) return url;
      return url.replace("/upload/", "/upload/f_auto,q_auto/");
    }
    return url;
  }

  function _remapProduct(p) {
    var rawUrls = Array.isArray(p.image_url) ? p.image_url : (p.image_url ? [p.image_url] : []);
    var optimizedUrls = rawUrls.map(optimizeCloudinaryUrl);

    return {
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      categoryIds: (p.category_ids || "").split(",").filter(Boolean),
      subCategoryIds: (p.sub_category_ids || "").split(",").filter(Boolean),
      description: p.description || "",
      imageUrl: optimizedUrls,
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
    if (!p) return null;
    const isApplyAll = p.applyToAll === true || String(p.applyToAll).toUpperCase() === "TRUE" ||
                      p.apply_to_all === true || String(p.apply_to_all).toUpperCase() === "TRUE";
    return {
      id: String(p.id),
      code: p.code ? String(p.code).trim() : "",
      type: p.type || "percent",
      value: Number(p.value) || 0,
      minOrder: Number(p.min_order !== undefined ? p.min_order : (p.minOrder || 0)),
      maxUses: p.max_uses != null ? Number(p.max_uses) : (p.maxUses != null ? Number(p.maxUses) : null),
      uses: Number(p.uses) || 0,
      expiry: p.expiry || "",
      status: p.status || "active",
      applyToAll: isApplyAll,
      apply_to_all: isApplyAll,
      createdAt: p.created_at,
    };
  }

  function _remapDeliveryPrice(d) {
    return { id: d.id, wilaya: d.wilaya, homePrice: Number(d.home_price) || 0, officePrice: Number(d.office_price) || 0, is_hidden: d.is_hidden === true || d.is_hidden === "true", createdAt: d.created_at };
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
    var bItems = bundle.bundleItems || bundle.bundle_items || [];
    if (!bundle || !Array.isArray(bItems) || bItems.length === 0) return null;
    
    var totalBasePrice = 0;
    var totalStock = Infinity;
    
    bItems.forEach(function (item) {
      var targetSku = String(item.sku || item.productId || '').trim().toLowerCase();
      var prod = productsList.find(function (p) {
        if (String(p.id).trim().toLowerCase() === targetSku) return true;
        if (p.sku && String(p.sku).trim().toLowerCase() === targetSku) return true;
        var vars = p.variants || [];
        for (var vIdx = 0; vIdx < vars.length; vIdx++) {
          var v = vars[vIdx];
          if (v.sku && String(v.sku).trim().toLowerCase() === targetSku) return true;
          if (v.flavorSkus) {
            var fValues = Object.values(v.flavorSkus);
            for (var fIdx = 0; fIdx < fValues.length; fIdx++) {
              if (String(fValues[fIdx]).trim().toLowerCase() === targetSku) return true;
            }
          }
        }
        return false;
      });

      if (prod) {
        var price = 0;
        var stock = Number(prod.stock) || 0;
        var variants = prod.variants || [];
        var v = null;

        if (item.variant && variants.length > 0) {
          v = variants.find(function (x) {
            var label = x.weight ? (x.weight + (x.unit || "")).trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
            return label === String(item.variant).trim().toLowerCase();
          });
          price = v ? Number(v.price) || 0 : Number(variants[0].price) || 0;
          if (v && Number(v.stock) > 0) stock = Number(v.stock);
        } else {
          price = variants.length > 0 ? Number(variants[0].price) || 0 : 0;
        }

        if (item.flavor) {
          if (v && v.flavorStock && v.flavorStock[item.flavor] !== undefined) {
            stock = Number(v.flavorStock[item.flavor]) || 0;
          } else if (Array.isArray(prod.flavors)) {
            var fObj = prod.flavors.find(function (f) {
              var name = typeof f === "object" ? f.name : f;
              return String(name).trim() === item.flavor;
            });
            if (fObj && typeof fObj === "object") {
              stock = Number(fObj.qty) || stock;
            }
          }
        }

        totalBasePrice += price * (Number(item.qty) || 1);
        totalStock = Math.min(totalStock, Math.floor(stock / (Number(item.qty) || 1)));
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
      var bItems = p.bundleItems || p.bundle_items || [];
      if (Array.isArray(bItems) && bItems.length > 0) {
        var calc = calculateBundleStockAndPrice(p, productsRemapped);
        var existingStock = Number(p.stock) || 0;
        var finalStock = (calc && calc.stock > 0) ? calc.stock : existingStock;
        p.stock = finalStock;

        var existingPrice = (p.variants && p.variants.length > 0 && Number(p.variants[0].price)) ? Number(p.variants[0].price) : (Number(p.price) || 0);
        var finalPrice = (existingPrice > 0) ? existingPrice : (calc ? calc.price : 0);
        
        if (p.variants && p.variants.length > 0) {
          p.variants[0].price = finalPrice;
          p.variants[0].stock = finalStock;
        } else {
          p.variants = [{ weight: "1", unit: "Bundle", price: finalPrice, stock: finalStock }];
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
  window.getInitialData = function () {
    var CACHE_KEY = "bb_initial_data_cache";
    var CACHE_TIME = 5 * 60 * 1000; // 5 minutes

    try {
      var cachedStr = sessionStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        var cachedObj = JSON.parse(cachedStr);
        if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CACHE_TIME) && cachedObj.data && Array.isArray(cachedObj.data.products) && cachedObj.data.products.length > 0) {
          return Promise.resolve(window.sbRemapInitialData(cachedObj.data));
        }
      }
    } catch(e) {}

    var src = (window.__initialDataPromise ? window.__initialDataPromise : Promise.resolve(null))
      .then(function (d) {
        if (d && Array.isArray(d.products) && d.products.length > 0) return d;
        return fetch("/api/initial-data").then(function (r) { return r.ok ? r.json() : null; });
      });
      
    return src.then(function (rawData) {
      if (!rawData) return null;
      if (Array.isArray(rawData.products) && rawData.products.length > 0) {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: rawData }));
        } catch(e) {}
      }
      return window.sbRemapInitialData(rawData);
    });
  };

  window.deductStockForOrderItems = async function (_orderItems) {
    // Stock deduction is handled securely on the server side via submit-order endpoint
    return;
  };

  var _lastSentTelegramMsg = "";
  var _lastSentTelegramTime = 0;

  window.sendTelegramNotification = async function (_orderData) {
    // Telegram notifications are handled securely on the backend (Edge Function) to protect Bot Credentials
    return;
  };
})();
