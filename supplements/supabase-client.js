// ByBens – Supabase client + shared data helpers
// Requires @supabase/supabase-js CDN to be loaded first.
// Wrapped in IIFE so const declarations don't collide with page scripts.

(function () {
  var _URL = window.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";
  var _KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";

  window.SUPABASE_URL = _URL;
  window.SUPABASE_ANON_KEY = _KEY;
  window.supabase = supabase.createClient(_URL, _KEY);

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

  window.deductStockForOrderItems = async function (orderItems) {
    if (!orderItems || !orderItems.length) return;
    try {
      var pRes = await fetch(_URL + "/rest/v1/products?select=*", { headers: { apikey: _KEY, Authorization: "Bearer " + _KEY } }).then(function(r) { return r.json(); });
      var iRes = await fetch(_URL + "/rest/v1/inventory_items?select=*", { headers: { apikey: _KEY, Authorization: "Bearer " + _KEY } }).then(function(r) { return r.json(); });

      var prods = Array.isArray(pRes) ? pRes : [];
      var invs = Array.isArray(iRes) ? iRes : [];

      for (var idx = 0; idx < orderItems.length; idx++) {
        var item = orderItems[idx];
        var qty = Number(item.qty) || 1;
        var targetId = String(item.productId || item.id || '').trim();
        var prod = prods.find(function(p) {
          return p.id === targetId || (p.name && item.name && p.name.toLowerCase().trim() === item.name.toLowerCase().trim());
        });

        if (prod) {
          var bItems = prod.bundle_items || prod.bundleItems || [];
          if (typeof bItems === 'string') {
            try { bItems = JSON.parse(bItems); } catch(e) { bItems = []; }
          }

          if (Array.isArray(bItems) && bItems.length > 0) {
            for (var bIdx = 0; bIdx < bItems.length; bIdx++) {
              var bItem = bItems[bIdx];
              var compQty = (Number(bItem.qty) || 1) * qty;
              var compSku = String(bItem.sku || bItem.productId || '').trim().toLowerCase();

              // 1. Deduct in inventory_items
              var invItem = invs.find(function(i) { return String(i.id).trim().toLowerCase() === compSku; });
              if (invItem) {
                var newInvStock = Math.max(0, (Number(invItem.stock) || 0) - compQty);
                await fetch(_URL + "/rest/v1/inventory_items?id=eq." + encodeURIComponent(invItem.id), {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", apikey: _KEY, Authorization: "Bearer " + _KEY },
                  body: JSON.stringify({ stock: newInvStock })
                });
              }

              // 2. Deduct in products
              var compProd = prods.find(function(p) {
                if (String(p.id).trim().toLowerCase() === compSku) return true;
                var vars = p.variants || [];
                for (var vIdx = 0; vIdx < vars.length; vIdx++) {
                  var v = vars[vIdx];
                  if (v.sku && String(v.sku).trim().toLowerCase() === compSku) return true;
                  if (v.flavorSkus) {
                    var fVals = Object.values(v.flavorSkus);
                    for (var fIdx = 0; fIdx < fVals.length; fIdx++) {
                      if (String(fVals[fIdx]).trim().toLowerCase() === compSku) return true;
                    }
                  }
                }
                return false;
              });

              if (compProd && compProd.variants && compProd.variants.length > 0) {
                var cVars = JSON.parse(JSON.stringify(compProd.variants));
                var cIdx = cVars.findIndex(function(v) {
                  if (v.sku && String(v.sku).trim().toLowerCase() === compSku) return true;
                  if (v.flavorSkus) {
                    var fVals = Object.values(v.flavorSkus);
                    for (var fIdx = 0; fIdx < fVals.length; fIdx++) {
                      if (String(fVals[fIdx]).trim().toLowerCase() === compSku) return true;
                    }
                  }
                  return String(v.weight || v.label || '').toLowerCase().indexOf(String(bItem.variant || '').toLowerCase()) !== -1;
                });
                if (cIdx < 0) cIdx = 0;
                if (cVars[cIdx]) {
                  var cv = cVars[cIdx];
                  if (cv.flavorStock && Object.keys(cv.flavorStock).length > 0) {
                    var targetFlavor = bItem.flavor || Object.keys(cv.flavorStock)[0];
                    if (cv.flavorStock[targetFlavor] !== undefined) {
                      cv.flavorStock[targetFlavor] = Math.max(0, (Number(cv.flavorStock[targetFlavor]) || 0) - compQty);
                    }
                    cv.stock = Object.values(cv.flavorStock).reduce(function(s, q) { return s + Number(q); }, 0);
                  } else {
                    cv.stock = Math.max(0, (Number(cv.stock) || 0) - compQty);
                  }
                  cVars[cIdx] = cv;
                  var newTotalStock = cVars.reduce(function(s, vv) { return s + (Number(vv.stock) || 0); }, 0);
                  await fetch(_URL + "/rest/v1/products?id=eq." + encodeURIComponent(compProd.id), {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", apikey: _KEY, Authorization: "Bearer " + _KEY },
                    body: JSON.stringify({ variants: cVars, stock: newTotalStock })
                  });
                }
              }
            }

            // Update bundle product stock itself
            var nextBundleStock = Math.max(0, (Number(prod.stock) || 0) - qty);
            await fetch(_URL + "/rest/v1/products?id=eq." + encodeURIComponent(prod.id), {
              method: "PATCH",
              headers: { "Content-Type": "application/json", apikey: _KEY, Authorization: "Bearer " + _KEY },
              body: JSON.stringify({ stock: nextBundleStock })
            });
          } else {
            // Standard Product stock deduction
            if (prod.variants && prod.variants.length > 0) {
              var pVars = JSON.parse(JSON.stringify(prod.variants));
              var pIdx = pVars.findIndex(function(v) { return String(v.weight || v.label || '').toLowerCase().indexOf(String(item.variant || '').toLowerCase()) !== -1; });
              if (pIdx < 0) pIdx = 0;
              if (pVars[pIdx]) {
                var pv = pVars[pIdx];
                if (pv.flavorStock && Object.keys(pv.flavorStock).length > 0) {
                  var targetFlavor2 = item.flavor || Object.keys(pv.flavorStock)[0];
                  if (pv.flavorStock[targetFlavor2] !== undefined) {
                    pv.flavorStock[targetFlavor2] = Math.max(0, (Number(pv.flavorStock[targetFlavor2]) || 0) - qty);
                  }
                  pv.stock = Object.values(pv.flavorStock).reduce(function(s, q) { return s + Number(q); }, 0);
                } else {
                  pv.stock = Math.max(0, (Number(pv.stock) || 0) - qty);
                }
                pVars[pIdx] = pv;
                var newProdTotalStock = pVars.reduce(function(s, vv) { return s + (Number(vv.stock) || 0); }, 0);
                await fetch(_URL + "/rest/v1/products?id=eq." + encodeURIComponent(prod.id), {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", apikey: _KEY, Authorization: "Bearer " + _KEY },
                  body: JSON.stringify({ variants: pVars, stock: newProdTotalStock })
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Global stock deduction error:", e);
    }
  };

  window.sendTelegramNotification = async function (orderData) {
    if (!orderData) return;
    var TELEGRAM_BOT_TOKEN = "8597076283:AAEcCim85KCQZQC-5ik4SLXdS8xPvOJg__o";
    var TELEGRAM_CHAT_ID = "-1003790940322";

    function esc(s) {
      if (!s) return "";
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    try {
      var items = orderData.items || [];
      var itemLines = items.map(function (it) {
        return "  • " + esc(it.name) + (it.flavor ? " – " + esc(it.flavor) : "") + (it.variant ? " (" + esc(it.variant) + ")" : "") + " x" + (it.qty || 1);
      }).join("\n");

      var timeStr = new Date().toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      var totalItems = items.reduce(function (s, it) { return s + (Number(it.qty) || 1); }, 0);
      var promoLine = orderData.promoCode ? "🎟️ Promo: " + esc(orderData.promoCode) + " (-" + (orderData.promoDiscount || 0) + " DA)\n" : "🎟️ No promo code\n";

      var msg =
        "🛒 <b>New Order!</b>\n" +
        "🕐 " + timeStr + "\n" +
        "📱 Source: " + (orderData.source === "checkout" ? "Cart" : "Product page") + "\n" +
        "👤 " + esc(orderData.firstName || "") + " " + esc(orderData.lastName || "") + "\n" +
        "📞 " + esc(orderData.phone || "") + "\n" +
        "📍 " + esc(orderData.wilaya || "") + " – " + esc(orderData.commune || "") + "\n" +
        "📦 " + esc(orderData.deliveryType || "") + "\n" +
        "🛍️ Items: " + totalItems + "\n\n" +
        itemLines + "\n\n" +
        "🏷️ Products: " + (orderData.subtotal || 0) + " DA\n" +
        "🚚 Delivery: " + (orderData.deliveryCost || 0) + " DA\n" +
        promoLine +
        "💰 Total: " + (orderData.total || 0) + " DA";

      await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
      });
    } catch (e) {
      console.warn("Client Telegram notification warning:", e);
    }
  };
})();
