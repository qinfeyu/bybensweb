      // ════════════════════════════════════════════
      // CONFIG — SUPABASE_URL / SUPABASE_ANON_KEY set by supabase-client.js
      // ════════════════════════════════════════════
      const SUPABASE_URL = window.SUPABASE_URL;
      const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
      const sb = window.supabase;
      const CLOUDINARY_CLOUD = "dbxna1ipc";
      const CLOUDINARY_PRESET = "Bybens";

      // ════════════════════════════════════════════
      // AUTH GUARD — redirect to login if not authenticated
      // ════════════════════════════════════════════
      if (localStorage.getItem("bb_admin_auth") !== "1") {
        window.location.href = "/supplements/mgmt9kx";
      }

      // ── STATE ──
      let sidebarCollapsed = false;
      let editingProductId = null;
      let editingPromoId = null;
      let editingDeliveryId = null;
      let editingCatId = null;
      let editingSubCatId = null;
      let currentImageUrls = [];
      let editingBundleItems = [];
      let categories = [],
        subCategories = [],
        products = [],
        promos = [],
        deliveryPrices = [],
        orders = [],
        settings = {};
      let ordersTotal = 0, productsTotal = 0;
      let _dashOrders = [];
      const _PAGE = 15;
      let productPage = 1, catPage = 1, deliveryPage = 1, orderPage = 1;
      let _prodFilter = "", _delFilter = "", _prodAvailabilityFilter = "";
      function _pagCtrl(total, cur, setFn, pageSize = _PAGE) {
        const totalPages = Math.ceil(total / pageSize);
        if (totalPages <= 1) return "";
        const from = (cur - 1) * pageSize + 1;
        const to = Math.min(cur * pageSize, total);
        let btns = "";
        if (cur > 1) btns += `<button class="pag-btn" onclick="${setFn}(${cur - 1})">&#8249;</button>`;
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= cur - 2 && i <= cur + 2)) {
            btns += `<button class="pag-btn${i === cur ? " active" : ""}" onclick="${setFn}(${i})">${i}</button>`;
          } else if (i === cur - 3 || i === cur + 3) {
            btns += `<button class="pag-btn" style="cursor:default;pointer-events:none" disabled>&#8230;</button>`;
          }
        }
        if (cur < totalPages) btns += `<button class="pag-btn" onclick="${setFn}(${cur + 1})">&#8250;</button>`;
        return `<div class="pag-wrap"><span class="pag-info">Showing ${from}–${to} of ${total}</span><div class="pag-btns">${btns}</div></div>`;
      }
      function setProductPage(n) { productPage = n; renderProducts(_prodFilter); }
      function setCatPage(n) { catPage = n; renderCats(); }
      function setDeliveryPage(n) { deliveryPage = n; renderDelivery(_delFilter); }
      function setOrderPage(n) { orderPage = n; _fetchOrdersPage().then(renderOrders).catch(() => renderOrders()); }

      async function _fetchOrdersPage() {
        const from = (orderPage - 1) * _PAGE;
        const to = from + _PAGE - 1;
        let q = sb.from("orders").select("*", { count: "exact" });
        if (ordersFilter !== "all") q = q.eq("status", ordersFilter);
        if (ordersSearch) {
          q = q.or(
            `first_name.ilike.%${ordersSearch}%,last_name.ilike.%${ordersSearch}%,phone.ilike.%${ordersSearch}%,wilaya.ilike.%${ordersSearch}%,commune.ilike.%${ordersSearch}%`
          );
        }
        switch (ordersSort) {
          case "date-asc":   q = q.order("created_at", { ascending: true }); break;
          case "total-desc": q = q.order("total", { ascending: false }); break;
          case "total-asc":  q = q.order("total", { ascending: true }); break;
          case "name-asc":   q = q.order("first_name", { ascending: true }); break;
          case "name-desc":  q = q.order("first_name", { ascending: false }); break;
          default:           q = q.order("created_at", { ascending: false });
        }
        const { data, count, error } = await q.range(from, to);
        if (error) throw error;
        orders = (data || []).map(_remapOrderRow);
        ordersTotal = count || 0;
      }

      async function _fetchDashOrders() {
        const { data } = await sb.from("orders")
          .select("id,source,status,total,created_at,items,first_name,last_name,phone,wilaya")
          .order("created_at", { ascending: false });
        _dashOrders = (data || []).map(o => ({
          id: o.id, source: o.source || "", status: o.status, total: o.total,
          createdAt: o.created_at, items: o.items || [],
          firstName: o.first_name || "", lastName: o.last_name || "",
          phone: o.phone || "", wilaya: o.wilaya || ""
        }));
      }

      // ════════════════════════════════════════════
      // ROW MAPPERS (snake_case → camelCase)
      // ════════════════════════════════════════════
      function _remapProductRow(r) {
        return { id: r.id, name: r.name, brand: r.brand, categoryIds: (r.category_ids || "").split(",").filter(Boolean), subCategoryIds: (r.sub_category_ids || "").split(",").filter(Boolean), description: r.description, imageUrl: r.image_url || [], variants: r.variants || [], flavors: r.flavors || [], stock: r.stock, discount: r.discount, allowPromo: r.allow_promo, promoCodeIds: (r.promo_code_ids || "").split(",").filter(Boolean), status: r.status, hidden: r.hidden || false, nutritionalFacts: r.nutritional_facts, benefits: r.benefits, createdAt: r.created_at, bundleItems: r.bundle_items || [] };
      }
      function _remapCategoryRow(r) {
        return { id: r.id, name: r.name, description: r.description, createdAt: r.created_at };
      }
      function _remapSubCategoryRow(r) {
        return { id: r.id, name: r.name, categoryIds: (r.category_ids || "").split(",").filter(Boolean), createdAt: r.created_at };
      }
      function _remapPromoRow(r) {
        return { id: r.id, code: r.code, type: r.type, value: r.value, minOrder: r.min_order, maxUses: r.max_uses, uses: r.uses, expiry: r.expiry, status: r.status, applyToAll: r.apply_to_all, createdAt: r.created_at };
      }
      function _remapDeliveryRow(r) {
        return { id: r.id, wilaya: r.wilaya, homePrice: r.home_price, officePrice: r.office_price, createdAt: r.created_at };
      }
      function _remapOrderRow(r) {
        return { id: r.id, source: r.source, firstName: r.first_name, lastName: r.last_name, phone: r.phone, address: r.address, wilaya: r.wilaya, commune: r.commune, deliveryType: r.delivery_type, deliveryCost: r.delivery_cost, promoCode: r.promo_code, promoDiscount: r.promo_discount, items: r.items || [], subtotal: r.subtotal, total: r.total, status: r.status, createdAt: r.created_at };
      }
      // ROW BUILDERS (camelCase → snake_case)
      function _toProductRow(p) {
        return { name: p.name, brand: p.brand || "", category_ids: (p.categoryIds || []).join(","), sub_category_ids: (p.subCategoryIds || []).join(","), description: p.description || "", image_url: p.imageUrl || [], variants: p.variants || [], flavors: p.flavors || [], stock: p.stock || 0, discount: p.discount || 0, allow_promo: p.allowPromo || false, promo_code_ids: (p.promoCodeIds || []).join(","), status: p.status || "active", hidden: p.hidden || false, nutritional_facts: p.nutritionalFacts || "", benefits: p.benefits || "", bundle_items: p.bundleItems || [] };
      }
      function _toPromoRow(p) {
        return { code: (p.code || "").toUpperCase(), type: p.type, value: p.value || 0, min_order: p.minOrder || 0, max_uses: p.maxUses || null, expiry: p.expiry || "", status: p.status || "active", apply_to_all: p.applyToAll || false };
      }

      // ════════════════════════════════════════════
      // API HELPERS (Supabase)
      // ════════════════════════════════════════════
      async function apiGet(action, params = {}) {
        switch (action) {
          case "getInitialData": {
            const [
              { data: prods, error: e1 }, { data: cats, error: e2 }, { data: subs, error: e3 },
              { data: promoRows, error: e4 }, { data: dpRows, error: e5 },
              { data: bndRow, error: e6 },
            ] = await Promise.all([
              sb.from("products").select("*").order("created_at", { ascending: false }),
              sb.from("categories").select("*").order("created_at", { ascending: true }),
              sb.from("sub_categories").select("*"),
              sb.from("promo_codes").select("*").order("created_at", { ascending: false }),
              sb.from("delivery_prices").select("*").order("wilaya", { ascending: true }),
              sb.from("bundle").select("*").eq("id", 1).maybeSingle(),
            ]);
            if (e1 || e2 || e3 || e4 || e5 || e6) throw e1 || e2 || e3 || e4 || e5 || e6;
            return { success: true, products: (prods || []).map(_remapProductRow), categories: (cats || []).map(_remapCategoryRow), subCategories: (subs || []).map(_remapSubCategoryRow), promos: (promoRows || []).map(_remapPromoRow), deliveryPrices: (dpRows || []).map(_remapDeliveryRow), bundle: bndRow ? { bundleId: bndRow.bundle_id, bundleDescription: bndRow.description_en } : {} };
          }
          case "getProducts": {
            const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
            if (error) throw error;
            return { success: true, products: (data || []).map(_remapProductRow) };
          }
          case "getCategories": {
            const { data, error } = await sb.from("categories").select("*").order("created_at", { ascending: true });
            if (error) throw error;
            return { success: true, categories: (data || []).map(_remapCategoryRow) };
          }
          case "getSubCategories": {
            const { data, error } = await sb.from("sub_categories").select("*");
            if (error) throw error;
            return { success: true, subCategories: (data || []).map(_remapSubCategoryRow) };
          }
          case "getPromos": {
            const { data, error } = await sb.from("promo_codes").select("*").order("created_at", { ascending: false });
            if (error) throw error;
            return { success: true, promos: (data || []).map(_remapPromoRow) };
          }
          case "getDeliveryPrices": {
            const { data, error } = await sb.from("delivery_prices").select("*").order("wilaya", { ascending: true });
            if (error) throw error;
            return { success: true, deliveryPrices: (data || []).map(_remapDeliveryRow) };
          }
          case "getBundle": {
            const { data, error } = await sb.from("bundle").select("*").eq("id", 1).maybeSingle();
            if (error) throw error;
            return {
              success: true,
              bundleId: data?.bundle_id || "",
              titleEn: data?.title_en || "",
              titleFr: data?.title_fr || "",
              titleAr: data?.title_ar || "",
              descriptionEn: data?.description_en || "",
              descriptionFr: data?.description_fr || "",
              descriptionAr: data?.description_ar || "",
            };
          }
          case "getOrders": {
            const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
            if (error) throw error;
            return { success: true, orders: (data || []).map(_remapOrderRow) };
          }
          case "getSettings": {
            const { data, error } = await sb.from("settings").select("*");
            if (error) throw error;
            const s = {};
            (data || []).forEach((row) => { s[row.key] = row.value; });
            return { success: true, settings: s };
          }
          case "login": {
            const { data: authData, error } = await sb.auth.signInWithPassword({ email: params.username, password: params.password });
            return { success: !error && !!authData?.session };
          }
          default:
            return { success: false, error: "Unknown action: " + action };
        }
      }

      async function apiPost(body) {
        const { action, id, ...rest } = body;
        switch (action) {
          // ── PRODUCTS ──
          case "addProduct": {
            const row = _toProductRow(rest);
            row.id = String(Date.now());
            const { data, error } = await sb.from("products").insert(row).select().single();
            if (error) throw error;
            return { success: true, id: data.id };
          }
          case "updateProduct": {
            const { error } = await sb.from("products").update(_toProductRow(rest)).eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          case "deleteProduct": {
            const { error } = await sb.from("products").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          // ── CATEGORIES ──
          case "addCategory": {
            const catId = String(Date.now());
            const { error: catErr } = await sb.from("categories").insert({ id: catId, name: rest.name, description: rest.description || "" });
            if (catErr) throw catErr;
            for (const subName of (rest.subCategories || [])) {
              if (!subName) continue;
              await new Promise((r) => setTimeout(r, 5));
              await sb.from("sub_categories").insert({ id: String(Date.now()), name: subName, category_ids: catId });
            }
            return { success: true, id: catId };
          }
          case "updateCategory": {
            const { error } = await sb.from("categories").update({ name: rest.name, description: rest.description || "" }).eq("id", id);
            if (error) throw error;
            for (const sub of (rest.subCategories || [])) {
              if (sub.id) {
                await sb.from("sub_categories").update({ name: sub.name }).eq("id", sub.id);
              } else if (sub.name) {
                await new Promise((r) => setTimeout(r, 5));
                await sb.from("sub_categories").insert({ id: String(Date.now()), name: sub.name, category_ids: id });
              }
            }
            return { success: true };
          }
          case "deleteCategory": {
            await sb.from("sub_categories").delete().like("category_ids", "%" + id + "%");
            const { error } = await sb.from("categories").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          case "updateSubCategory": {
            const { error } = await sb.from("sub_categories").update({ name: rest.name }).eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          case "deleteSubCategory": {
            const { error } = await sb.from("sub_categories").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          // ── PROMOS ──
          case "addPromo": {
            const row = _toPromoRow(rest);
            row.id = String(Date.now());
            row.uses = 0;
            const { data, error } = await sb.from("promo_codes").insert(row).select().single();
            if (error) throw error;
            return { success: true, id: data.id };
          }
          case "updatePromo": {
            const { error } = await sb.from("promo_codes").update(_toPromoRow(rest)).eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          case "deletePromo": {
            const { error } = await sb.from("promo_codes").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          // ── DELIVERY ──
          case "addDeliveryPrice": {
            const row = { id: String(Date.now()), wilaya: rest.wilaya, home_price: rest.homePrice, office_price: rest.officePrice };
            const { data, error } = await sb.from("delivery_prices").insert(row).select().single();
            if (error) throw error;
            return { success: true, id: data.id };
          }
          case "updateDeliveryPrice": {
            const { error } = await sb.from("delivery_prices").update({ wilaya: rest.wilaya, home_price: rest.homePrice, office_price: rest.officePrice }).eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          case "deleteDeliveryPrice": {
            const { error } = await sb.from("delivery_prices").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          // ── BUNDLE ──
          case "saveBundle": {
            const { error } = await sb.from("bundle").update({
              bundle_id:      rest.bundleId || "",
              title_en:       rest.titleEn || "",
              title_fr:       rest.titleFr || "",
              title_ar:       rest.titleAr || "",
              description_en: rest.descriptionEn || "",
              description_fr: rest.descriptionFr || "",
              description_ar: rest.descriptionAr || "",
            }).eq("id", 1);
            if (error) throw error;
            return { success: true };
          }
          // ── ORDERS ──
          case "updateOrderStatus": {
            const res = await fetch(SUPABASE_URL + "/functions/v1/update-order-status", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_ANON_KEY },
              body: JSON.stringify({ id, status: rest.status }),
            });
            return res.json();
          }
          case "deleteOrder": {
            const { error } = await sb.from("orders").delete().eq("id", id);
            if (error) throw error;
            return { success: true };
          }
          // ── SETTINGS ──
          case "updateSettings": {
            if (rest.updates) {
              const upserts = Object.entries(rest.updates).map(([key, value]) => ({ key, value: String(value) }));
              const { error } = await sb.from("settings").upsert(upserts, { onConflict: "key" });
              if (error) throw error;
            }
            return { success: true };
          }
          default:
            return { success: false, error: "Unknown action: " + action };
        }
      }
      // Apply a getInitialData-shaped response to the in-memory state and re-render
      function applyInitialData(res, settingsRes) {
        if (!res) return;
        if (Array.isArray(res.products)) { products = res.products; productsTotal = products.length; }
        if (Array.isArray(res.categories)) categories = res.categories;
        if (Array.isArray(res.subCategories)) subCategories = res.subCategories;
        if (Array.isArray(res.promos)) promos = res.promos;
        if (Array.isArray(res.deliveryPrices)) deliveryPrices = res.deliveryPrices;
        // orders are fetched separately via _fetchOrdersPage() / _fetchDashOrders()
        if (res.bundle && res.bundle.bundleId) {
          // mirror loadBundle() side effects without a network call
          window._cachedBundle = res.bundle;
        }
        if (settingsRes && settingsRes.success && settingsRes.settings) {
          settings = settingsRes.settings;
          var u = document.getElementById("set-username");
          var d = document.getElementById("set-displayname");
          if (u) u.value = settings.admin_username || "";
          if (d) d.value = settings.admin_displayname || "";
          var name = settings.admin_displayname || settings.admin_username || "Admin";
          var sb = document.getElementById("sb-username");
          if (sb) sb.textContent = name;
          var av = document.querySelector(".sb-avatar");
          if (av) av.textContent = name[0].toUpperCase();

          // Populate marquee settings
          var me = document.getElementById("set-marquee-enabled");
          var mt = document.getElementById("set-marquee-text");
          if (me) me.checked = settings.marquee_enabled !== "false" && settings.marquee_enabled !== false;
          if (mt) mt.value = settings.marquee_text || "";
        }
        renderCats();
        renderProducts();
        renderPromos();
        renderDelivery();
        renderBundleList(document.getElementById("bundle-search")?.value || "");
        if (typeof renderBundleSelected === "function" && window._cachedBundle) {
          try { renderBundleSelected(window._cachedBundle); } catch (e) {}
        }
      }
      function showLoading(msg = "Loading…") {
        document.getElementById("loading-text").textContent = msg;
        document.getElementById("loading-overlay").classList.add("show");
      }
      function hideLoading() {
        document.getElementById("loading-overlay").classList.remove("show");
      }

      // ════════════════════════════════════════════
      // REAL-TIME POLLING (silent — no spinner)
      // ════════════════════════════════════════════
      function updateLastUpdated() {
        const el = document.getElementById("last-updated");
        if (el) el.textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }


      // ════════════════════════════════════════════
      // INIT
      // ════════════════════════════════════════════
      async function initDashboard() {
        if (!SUPABASE_URL || !sb) {
          showToast("Supabase not configured!", "error");
          return;
        }
        showLoading("Loading dashboard…");
        // Fetch fresh data from Supabase
        try {
          const [initRes, settingsRes, bundleRes] = await Promise.all([
            apiGet("getInitialData"),
            apiGet("getSettings"),
            apiGet("getBundle"),
          ]);
          if (initRes && initRes.success) {
            applyInitialData(initRes, settingsRes);
            if (bundleRes && bundleRes.success) {
              if (bundleRes.bundleId) {
                bundleSelectedId = bundleRes.bundleId;
                const p = products.find((x) => x.id === bundleRes.bundleId);
                const lbl = document.getElementById("bundle-selected-label");
                if (lbl) lbl.innerHTML = p
                  ? `Selected: <strong>${p.name}</strong>`
                  : `Selected: <strong>${bundleRes.bundleId}</strong>`;
              }
              if (bundleRes.bundleDescription) {
                const desc = document.getElementById("bundle-description");
                if (desc) desc.value = bundleRes.bundleDescription;
              }
              renderBundleList(document.getElementById("bundle-search")?.value || "");
            }
            await Promise.all([_fetchDashOrders(), _fetchOrdersPage()]);
            renderOrders();
            updateDashboard();
            updateLastUpdated();
          } else {
            showToast("Failed to load data", "error");
          }
        } catch (e) {
          showToast("Failed to load: " + e.message, "error");
        }
        hideLoading();
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDashboard);
      } else {
        initDashboard();
      }

      async function loadSubCategories() {
        const r = await apiGet("getSubCategories");
        if (r.success) subCategories = r.subCategories;
      }
      async function loadCategories() {
        const [catRes, subRes] = await Promise.all([
          apiGet("getCategories"),
          apiGet("getSubCategories"),
        ]);
        if (catRes.success) categories = catRes.categories;
        if (subRes.success) subCategories = subRes.subCategories;
        renderCats();
      }
      async function loadProducts() {
        const r = await apiGet("getProducts");
        if (r.success) {
          products = r.products;
          renderProducts();
          renderBundleList(document.getElementById("bundle-search")?.value || "");
        }
      }
      async function loadPromos() {
        const r = await apiGet("getPromos");
        if (r.success) {
          promos = r.promos;
          renderPromos();
        }
      }
      async function loadDeliveryPrices() {
        const r = await apiGet("getDeliveryPrices");
        if (r.success) {
          deliveryPrices = r.deliveryPrices;
          renderDelivery();
        }
      }
      async function loadSettings() {
        const r = await apiGet("getSettings");
        if (r.success) {
          settings = r.settings;
          document.getElementById("set-username").value =
            settings.admin_username || "";
          document.getElementById("set-displayname").value =
            settings.admin_displayname || "";
          const name =
            settings.admin_displayname || settings.admin_username || "Admin";
          document.getElementById("sb-username").textContent = name;
          document.querySelector(".sb-avatar").textContent =
            name[0].toUpperCase();
        }
      }
      function fmtRevenue(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        return Math.round(n).toLocaleString("fr-DZ");
      }

      function updateDashboard() {
        const elProds = document.getElementById("stat-products");
        if (elProds) elProds.textContent = productsTotal || products.length;

        const elOrders = document.getElementById("stat-orders");
        if (elOrders) elOrders.textContent = _dashOrders.length;

        const elPromos = document.getElementById("stat-promos");
        if (elPromos) elPromos.textContent = promos.filter((p) => p.status === "active").length;

        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const weekOrders = _dashOrders.filter((o) => {
          const rawDate = o.createdAt || o.created_at || o.date;
          if (!rawDate) return false;
          try { return new Date(rawDate) >= weekAgo; } catch (e) { return false; }
        });

        const elWeekOrders = document.getElementById("stat-week-orders");
        if (elWeekOrders) elWeekOrders.textContent = weekOrders.length;

        const elPending = document.getElementById("stat-pending");
        if (elPending) elPending.textContent = _dashOrders.filter((o) => o.status === "waiting").length;

        // POS Checkout Stats
        const posCount = (typeof allSales !== "undefined" && allSales.length) 
          ? allSales.length 
          : _dashOrders.filter(o => o.source === "POS Checkout" || (o.id && String(o.id).startsWith("pos-"))).length;
        
        const posRevenue = (typeof allSales !== "undefined" && allSales.length)
          ? allSales.reduce((s, sl) => s + (Number(sl.total_amount) || 0), 0)
          : _dashOrders.filter(o => o.source === "POS Checkout" || (o.id && String(o.id).startsWith("pos-"))).reduce((s, o) => s + (Number(o.total) || 0), 0);

        const elPosCount = document.getElementById("stat-pos-count");
        if (elPosCount) elPosCount.textContent = posCount;

        const elPosRev = document.getElementById("stat-pos-revenue");
        if (elPosRev) elPosRev.textContent = fmtRevenue(posRevenue);

        const totalRev = _dashOrders.reduce((s, o) => s + (Number(o.total || o.total_amount) || 0), 0);
        const weekRev = weekOrders.reduce((s, o) => s + (Number(o.total || o.total_amount) || 0), 0);

        const elRevTotal = document.getElementById("stat-revenue-total");
        if (elRevTotal) elRevTotal.textContent = fmtRevenue(totalRev);

        const elRevWeek = document.getElementById("stat-revenue-week");
        if (elRevWeek) elRevWeek.textContent = fmtRevenue(weekRev);

        const trendEl = document.getElementById("stat-week-trend");
        if (trendEl) {
          const prevWeekOrders = _dashOrders.filter((o) => {
            const rawDate = o.createdAt || o.created_at || o.date;
            if (!rawDate) return false;
            try {
              const d = new Date(rawDate);
              return d >= new Date(now - 14 * 24 * 60 * 60 * 1000) && d < weekAgo;
            } catch (e) { return false; }
          });
          if (prevWeekOrders.length > 0) {
            const diff = weekOrders.length - prevWeekOrders.length;
            trendEl.textContent = diff >= 0 ? `↑ ${diff} vs last week` : `↓ ${Math.abs(diff)} vs last week`;
            trendEl.className = "stat-trend " + (diff >= 0 ? "up" : "neutral");
          } else {
            trendEl.textContent = "";
          }
        }

        // Top products from order items
        const productQty = {};
        _dashOrders.forEach((o) => {
          (o.items || []).forEach((it) => {
            const name = (it.name || "Unknown").split(" (")[0].trim();
            productQty[name] = (productQty[name] || 0) + (Number(it.qty) || 1);
          });
        });
        const topList = Object.entries(productQty)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7);
        const maxQty = topList.length ? topList[0][1] : 1;
        const rankClass = ["gold", "silver", "bronze"];
        const topEl = document.getElementById("top-products-list");
        if (topEl) {
          topEl.innerHTML = topList.length
            ? topList.map(([name, qty], i) => `
                <div class="top-product-item">
                  <div class="top-product-rank ${rankClass[i] || ""}">${i + 1}</div>
                  <div class="top-product-name" title="${name}">${name}</div>
                  <div class="top-product-bar-wrap"><div class="top-product-bar-fill" style="width:${Math.round((qty/maxQty)*100)}%"></div></div>
                  <div class="top-product-qty">${qty} sold</div>
                </div>`).join("")
            : `<div style="padding:24px;text-align:center;color:var(--g400);font-size:13px">No order data yet</div>`;
        }

        // Recent orders (last 6)
        const recentEl = document.getElementById("recent-orders-list");
        if (recentEl) {
          const recent = _dashOrders.slice(0, 6);
          recentEl.innerHTML = recent.length
            ? recent.map((o) => {
                const name = `${o.firstName || o.first_name || ""} ${o.lastName || o.last_name || ""}`.trim() || "—";
                const badge = `<span class="badge ${getOrderBadgeClass(o.status)}" style="font-size:10px;padding:2px 8px">${cap(o.status)}</span>`;
                let date = "—";
                const rawDate = o.createdAt || o.created_at || o.date;
                if (rawDate) try { date = new Date(rawDate).toLocaleDateString("en-GB"); } catch (e) {}
                return `<div class="recent-order-row" onclick="showPage('orders',document.querySelector('.sb-link[onclick*=orders]'));setTimeout(()=>openOrderDetail('${o.id}'),100)">
                  <div class="recent-order-name">${name}<div class="recent-order-meta">${date} · ${(o.items||[]).length} item${(o.items||[]).length!==1?'s':''}</div></div>
                  ${badge}
                  <div class="recent-order-total">${Number(o.total||o.total_amount||0).toLocaleString("fr-DZ")} DA</div>
                </div>`;
              }).join("")
            : `<div style="padding:24px;text-align:center;color:var(--g400);font-size:13px">No orders yet</div>`;
        }

        // Status overview bar
        const total = _dashOrders.length || 1;
        const statuses = ["waiting","confirmed","delivered","canceled"];
        const counts = {};
        statuses.forEach(s => { counts[s] = _dashOrders.filter(o => o.status === s).length; });
        const barEl = document.getElementById("status-ov-bar");
        if (barEl) {
          barEl.innerHTML = statuses
            .filter(s => counts[s] > 0)
            .map(s => `<div class="ov-seg ov-seg-${s}" style="width:${(counts[s]/total*100).toFixed(1)}%" title="${cap(s)}: ${counts[s]}"></div>`)
            .join("") || `<div class="ov-seg ov-seg-waiting" style="width:100%;opacity:0.2"></div>`;
        }
        const legendEl = document.getElementById("status-ov-legend");
        if (legendEl) {
          const dotColor = { waiting: "var(--orange)", confirmed: "var(--green)", delivered: "var(--blue)", canceled: "#dc2626" };
          legendEl.innerHTML = statuses.map(s => `
            <div class="status-ov-item">
              <div class="status-ov-dot" style="background:${dotColor[s]}"></div>
              <span>${cap(s)}</span>
              <strong>${counts[s]}</strong>
              <span style="color:var(--g400)">(${total > 0 ? (counts[s]/total*100).toFixed(0) : 0}%)</span>
            </div>`).join("");
        }
        if (typeof computeBusinessDashboard === "function") computeBusinessDashboard();
      }

      // ════════════════════════════════════════════
      // SIDEBAR & NAV
      // ════════════════════════════════════════════
      function toggleSidebar() {
        if (window.innerWidth < 768) {
          const isOpen = document.getElementById("sidebar").classList.toggle("mobile-open");
          document.getElementById("sb-overlay").classList.toggle("show", isOpen);
        } else {
          sidebarCollapsed = !sidebarCollapsed;
          document.getElementById("sidebar").classList.toggle("collapsed", sidebarCollapsed);
          document.getElementById("main").classList.toggle("full", sidebarCollapsed);
        }
      }
      function closeSidebar() {
        document.getElementById("sidebar").classList.remove("mobile-open");
        document.getElementById("sb-overlay").classList.remove("show");
      }
      const pageNames = {
        dashboard: "Dashboard",
        products: "Products",
        categories: "Categories",
        promos: "Promo Codes",
        delivery: "Delivery Prices",
        bundle: "Bundle",
        orders: "Orders",
        settings: "Settings",
        pos: "POS Checkout",
        preorders: "Pre-Orders",
        expenses: "Expenses Logger",
        customers: "Customers Ledger",
        inventory: "Inventory Manager"
      };
      function showPage(name, el) {
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document.getElementById("page-" + name).classList.add("active");
        document
          .querySelectorAll(".sb-link")
          .forEach((l) => l.classList.remove("active"));
        if (el) el.classList.add("active");
        document.getElementById("page-title").textContent =
          pageNames[name] || name;
        if (name === "orders") clearOrdersBadge();
        if (name === "settings") loadAdminUsers();
        if (name === "pos") loadPOS();
        if (name === "preorders") loadPreorders();
        if (name === "expenses") loadExpenses();
        if (name === "customers") loadCustomers();
        if (name === "inventory") loadInventoryPage();
        if (window.innerWidth < 768) closeSidebar();
      }
      function doLogout() {
        sb.auth.signOut();
        localStorage.removeItem("bb_admin_auth");
        localStorage.removeItem("bb_admin_name");
        window.location.href = "/supplements/mgmt9kx";
      }

      // ════════════════════════════════════════════
      // CLOUDINARY
      // ════════════════════════════════════════════
      function renderImageGrid() {
        const grid = document.getElementById("images-grid");
        if (!grid) return;
        grid.innerHTML = "";
        currentImageUrls.forEach((url, idx) => {
          const wrap = document.createElement("div");
          wrap.className = "img-thumb-wrap";
          wrap.innerHTML = `<img src="${url}" /><span class="img-thumb-remove" onclick="removeImage(${idx})">×</span>`;
          grid.appendChild(wrap);
        });
        const addBtn = document.createElement("div");
        addBtn.className = "upload-box-add";
        addBtn.innerHTML = `<input type="file" accept="image/*" onchange="handleImageUpload(event)" /><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
        grid.appendChild(addBtn);
        updateVariantImageDropdowns();
      }

      function removeImage(idx) {
        currentImageUrls.splice(idx, 1);
        renderImageGrid();
      }

      async function uploadToCloudinary(file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", CLOUDINARY_PRESET);
        fd.append("folder", "bybens-products");
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
          { method: "POST", body: fd }
        );
        const data = await res.json();
        if (data.secure_url) {
          return data.secure_url;
        }
        throw new Error(data.error?.message || "Upload failed");
      }

      async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";
        document.getElementById("upload-spinner").style.display = "block";
        try {
          const url = await uploadToCloudinary(file);
          currentImageUrls.push(url);
          renderImageGrid();
          showToast("Image uploaded!");
        } catch (err) {
          showToast("Upload error: " + err.message, "error");
        } finally {
          document.getElementById("upload-spinner").style.display = "none";
        }
      }

      async function handleRowImageUpload(e, rowEl, selectClass) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";
        
        const uploadBtn = e.target.closest(".row-upload-btn");
        if (uploadBtn) uploadBtn.classList.add("loading");
        
        try {
          const url = await uploadToCloudinary(file);
          currentImageUrls.push(url);
          renderImageGrid();
          
          const newIdx = currentImageUrls.length - 1;
          const select = rowEl.querySelector("." + selectClass);
          if (select) {
            select.value = String(newIdx);
          }
          showToast("Image uploaded and assigned!");
        } catch (err) {
          showToast("Upload error: " + err.message, "error");
        } finally {
          if (uploadBtn) uploadBtn.classList.remove("loading");
        }
      }
      window.handleRowImageUpload = handleRowImageUpload;

      // ════════════════════════════════════════════
      // CHECKBOX HELPERS (FIXED — no double-toggle)
      // ════════════════════════════════════════════
      function buildCheckboxGroup(
        containerId,
        items,
        selectedIds = [],
        onChangeFn = null,
      ) {
        const container = document.getElementById(containerId);
        if (!items.length) {
          container.innerHTML =
            '<span style="font-size:12px;color:var(--g400)">None available</span>';
          return;
        }
        container.innerHTML = items
          .map((item) => {
            const checked = selectedIds.includes(item.id);
            return `<div class="checkbox-item ${checked ? "checked" : ""}" data-value="${item.id}" onclick="handleCheckboxClick(this${onChangeFn ? ",'" + onChangeFn + "'" : ""})">
          <input type="checkbox" value="${item.id}" ${checked ? "checked" : ""} />
          ${item.label || item.name || item.code}
        </div>`;
          })
          .join("");
      }

      function handleCheckboxClick(el, callbackName) {
        const cb = el.querySelector('input[type="checkbox"]');
        cb.checked = !cb.checked;
        el.classList.toggle("checked", cb.checked);
        if (callbackName && window[callbackName]) window[callbackName]();
      }

      function getCheckedValues(containerId) {
        return Array.from(
          document.querySelectorAll(
            `#${containerId} input[type="checkbox"]:checked`,
          ),
        ).map((cb) => cb.value);
      }

      // ════════════════════════════════════════════
      // PRODUCTS
      // ════════════════════════════════════════════
      function filterProducts(q = "") {
        productPage = 1;
        _prodFilter = q.toLowerCase();
        renderProducts(_prodFilter);
      }
      window.filterProducts = filterProducts;

      function filterProductsByAvailability(val) {
        productPage = 1;
        _prodAvailabilityFilter = val;
        renderProducts(_prodFilter);
      }
      window.filterProductsByAvailability = filterProductsByAvailability;

      function renderProducts(filter = "") {
        _selReset("product");
        const tbody = document.getElementById("products-tbody");
        const pag = document.getElementById("products-pag");
        const filtered = products.filter(
          (p) => {
            const matchesText = !filter ||
              p.name.toLowerCase().includes(filter) ||
              (p.brand || "").toLowerCase().includes(filter);
            
            let matchesAvailability = true;
            if (_prodAvailabilityFilter === "in-stock") {
              matchesAvailability = Number(p.stock) > 0;
            } else if (_prodAvailabilityFilter === "out-of-stock") {
              matchesAvailability = Number(p.stock) <= 0;
            }
            
            return matchesText && matchesAvailability;
          }
        );
        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>No products</p></div></td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }
        const pageItems = filtered.slice((productPage - 1) * _PAGE, productPage * _PAGE);
        tbody.innerHTML = pageItems
          .map((p) => {
            const catNames = (p.categoryIds || [])
              .map((id) => {
                const c = categories.find((x) => x.id === id);
                return c ? c.name : "";
              })
              .filter(Boolean)
              .join(", ");
            const subNames = (p.subCategoryIds || [])
              .map((id) => {
                const s = subCategories.find((x) => x.id === id);
                return s ? s.name : "";
              })
              .filter(Boolean)
              .join(", ");
            const flavorStr = (p.flavors || []).map((f) => f.name).join(", ");
            const variantStr = (p.variants || [])
              .map(
                (v) =>
                  `${v.weight}${v.unit} — ${Number(v.price).toLocaleString()} DA`,
              )
              .join("<br>");
            const promoNames = (p.promoCodeIds || [])
              .map((id) => {
                const pr = promos.find((x) => x.id === id);
                return pr ? pr.code : "";
              })
              .filter(Boolean);
            const promoStr = p.allowPromo
              ? promoNames.length
                ? promoNames
                    .map(
                      (c) =>
                        `<span class="code-tag" style="margin:1px">${c}</span>`,
                    )
                    .join(" ")
                : '<span class="badge badge-active">All</span>'
              : '<span class="badge badge-inactive">No</span>';
            const _firstImg = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
            const imgHtml = _firstImg
              ? `<img src="${_firstImg}" alt="" />`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
            return `<tr>
          <td class="cb-td"><input type="checkbox" class="row-cb" data-sel-type="product" data-sel-id="${p.id}" onchange="_selToggle('product','${p.id}',this.checked)"></td>
          <td><div class="prod-info"><div class="prod-thumb">${imgHtml}</div><div class="prod-name-block"><div class="name">${p.name}</div><div class="sub">${p.brand || ""}</div></div></div></td>
          <td><span style="font-size:12px">${catNames}${subNames ? '<br><span style="color:var(--g400)">' + subNames + "</span>" : ""}</span></td>
          <td style="font-size:12px;color:var(--g600)">${flavorStr || "—"}</td>
          <td style="font-size:12px">${variantStr || "—"}</td>
          <td>${promoStr}</td>
          <td>${p.stock}</td>
          <td><span class="badge badge-${p.status}">${cap(p.status)}</span>${p.hidden ? '<span class="badge" style="margin-left:4px;background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb">Hidden</span>' : ''}</td>
          <td><div class="action-group"><button class="act-btn act-edit" onclick="editProduct('${p.id}')">Edit</button><button class="act-btn ${p.hidden ? 'act-confirm' : ''}" style="gap:4px" onclick="toggleProductVisibility('${p.id}',${p.hidden})">${p.hidden ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Show' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Hide'}</button><button class="act-btn act-delete" onclick="confirmDelete('product','${p.id}')">Delete</button></div></td>
        </tr>`;
          })
          .join("");

        const cardsContainer = document.getElementById("products-mobile-cards");
        if (cardsContainer) {
          if (!filtered.length) {
            cardsContainer.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;"><p>No products found.</p></div>`;
          } else {
            cardsContainer.innerHTML = pageItems.map(p => {
              const catNames = (p.categoryIds || [])
                .map(id => categories.find(x => x.id === id)?.name)
                .filter(Boolean)
                .join(", ");
              const _firstImg = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
              const imgHtml = _firstImg
                ? `<img src="${_firstImg}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--g200)" />`
                : `<div style="width:52px;height:52px;background:var(--g100);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--g400);font-size:20px">📦</div>`;

              const stockBadge = Number(p.stock) > 0
                ? `<span class="badge badge-active" style="font-weight:700">Stock: ${p.stock}</span>`
                : `<span class="badge badge-inactive" style="font-weight:700">Out of Stock</span>`;

              const variantStr = (p.variants || [])
                .map(v => `<span style="display:inline-block;background:var(--g100);padding:3px 6px;border-radius:4px;font-size:11px;font-weight:600;margin-right:4px;margin-bottom:4px">${v.weight}${v.unit}: ${Number(v.price).toLocaleString()} DA</span>`)
                .join("");

              return `
                <div class="prod-mobile-card" style="background:#fff; border:1px solid var(--g200); border-radius:12px; padding:14px; box-shadow:var(--sh-sm); display:flex; flex-direction:column; gap:10px;">
                  <div style="display:flex; gap:12px; align-items:center;">
                    ${imgHtml}
                    <div style="flex:1;">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span class="badge" style="background:var(--red-light); color:var(--red); font-weight:700; font-size:10px;">${p.brand || 'No Brand'}</span>
                        ${stockBadge}
                      </div>
                      <h4 style="margin:4px 0 0 0; font-size:15px; font-weight:700; color:var(--black); line-height:1.2;">${p.name}</h4>
                      ${catNames ? `<div style="font-size:11px; color:var(--g500); margin-top:2px;">${catNames}</div>` : ''}
                    </div>
                  </div>

                  ${variantStr ? `<div style="background:var(--g50); padding:8px; border-radius:8px; border:1px solid var(--g100);">${variantStr}</div>` : ''}

                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:2px;">
                    <button class="btn-primary" onclick="editProduct('${p.id}')" style="width:100%; justify-content:center; min-height:40px; font-size:13px;">✏ Edit</button>
                    <button class="btn-danger" onclick="confirmDelete('product','${p.id}')" style="width:100%; justify-content:center; min-height:40px; font-size:13px;">🗑 Delete</button>
                  </div>
                </div>
              `;
            }).join("");
          }
        }

        if (pag) pag.innerHTML = _pagCtrl(filtered.length, productPage, "setProductPage");
      }

      function refreshSubCatCheckboxes() {
        const selectedCatIds = getCheckedValues("pm-categories");
        const filteredSubs = subCategories.filter((s) =>
          s.categoryIds.some((cid) => selectedCatIds.includes(cid)),
        );
        // Preserve currently checked subs that are still valid
        const currentSubIds = getCheckedValues("pm-subcategories");
        const validSubIds = currentSubIds.filter((id) =>
          filteredSubs.some((s) => s.id === id),
        );
        buildCheckboxGroup("pm-subcategories", filteredSubs, validSubIds);
      }

      function togglePromoSection() {
        const on = document.getElementById("pm-promo-toggle").checked;
        document.getElementById("pm-promo-section").style.display = on
          ? ""
          : "none";
      }

      function openProductModal(id = null) {
        editingProductId = id;
        currentImageUrls = [];
        editingBundleItems = [];
        document.getElementById("pm-title").textContent = id
          ? "Edit Product"
          : "Add Product";
        document.getElementById("variants-list").innerHTML = "";
        document.getElementById("flavors-list").innerHTML = "";
        renderImageGrid();

        if (id) {
          const p = products.find((x) => x.id === id);
          if (p) {
            document.getElementById("pm-name").value = p.name;
            document.getElementById("pm-brand").value = p.brand || "";
            document.getElementById("pm-desc").innerHTML = p.description || "";
            document.getElementById("pm-nutritional").innerHTML = p.nutritionalFacts || "";
            document.getElementById("pm-benefits").innerHTML = p.benefits || "";
            document.getElementById("pm-stock").value = p.stock;
            document.getElementById("pm-discount").value = p.discount;
            document.getElementById("pm-status").value = p.status;
            document.getElementById("pm-promo-toggle").checked =
              p.allowPromo !== false;
            currentImageUrls = Array.isArray(p.imageUrl) ? [...p.imageUrl] : (p.imageUrl ? [p.imageUrl] : []);
            renderImageGrid();
            buildCheckboxGroup(
              "pm-categories",
              categories,
              p.categoryIds || [],
              "refreshSubCatCheckboxes",
            );
            setTimeout(() => {
              const selectedCatIds = p.categoryIds || [];
              const filteredSubs = subCategories.filter((s) =>
                s.categoryIds.some((cid) => selectedCatIds.includes(cid)),
              );
              buildCheckboxGroup(
                "pm-subcategories",
                filteredSubs,
                p.subCategoryIds || [],
              );
            }, 30);
            const activePromos = promos.filter((pr) => pr.status === "active");
            buildCheckboxGroup(
              "pm-promo-codes",
              activePromos.map((pr) => ({ 
                id: pr.id, 
                name: pr.code + ( (pr.applyToAll===true || String(pr.applyToAll).toUpperCase()==="TRUE") ? " (Global)" : "" ) 
              })),
              p.promoCodeIds || [],
            );
            document.getElementById("variants-list").innerHTML = "";
            document.getElementById("flavors-list").innerHTML = "";

            const isB = p.bundleItems && p.bundleItems.length > 0;
            document.getElementById("pm-bundle-toggle").checked = isB;
            editingBundleItems = isB ? [...p.bundleItems] : [];
            toggleBundleSection();
            renderBundleItems();

            if (!isB) {
              (p.variants || []).forEach((v) => addVariant(v));
              (p.flavors || []).forEach((f) => addFlavor(f));
              refreshStockMatrix();
            }
          }
        } else {
          ["pm-name", "pm-brand", "pm-stock", "pm-discount"].forEach(
            (x) => (document.getElementById(x).value = ""),
          );
          document.getElementById("pm-desc").innerHTML = "";
          document.getElementById("pm-nutritional").innerHTML = "";
          document.getElementById("pm-benefits").innerHTML = "";
          document.getElementById("variants-list").innerHTML = "";
          document.getElementById("flavors-list").innerHTML = "";
          document.getElementById("stock-matrix-section").style.display = "none";
          document.getElementById("variant-stock-section").style.display = "none";
          document.getElementById("pm-stock").readOnly = false;
          document.getElementById("pm-stock-hint").style.display = "none";
          document.getElementById("pm-status").value = "active";
          document.getElementById("pm-promo-toggle").checked = true;
          
          document.getElementById("pm-bundle-toggle").checked = false;
          editingBundleItems = [];
          toggleBundleSection();

          buildCheckboxGroup(
            "pm-categories",
            categories,
            [],
            "refreshSubCatCheckboxes",
          );
          buildCheckboxGroup("pm-subcategories", [], []);
          const activePromos = promos.filter((pr) => pr.status === "active");
          buildCheckboxGroup(
            "pm-promo-codes",
            activePromos.map((pr) => ({ 
              id: pr.id, 
              name: pr.code + ( (pr.applyToAll===true || String(pr.applyToAll).toUpperCase()==="TRUE") ? " (Global)" : "" ) 
            })),
            [],
          );
          addVariant();
          addFlavor();
        }
        togglePromoSection();
        openModal("product-modal");
      }

      window.toggleBundleSection = function() {
        const isBundle = document.getElementById("pm-bundle-toggle").checked;
        const bundleSection = document.getElementById("pm-bundle-section");
        const variantsList = document.getElementById("variants-list");
        const flavorsList = document.getElementById("flavors-list");
        const addVariantBtn = document.querySelector('button[onclick="addVariant()"]');
        const addFlavorBtn = document.querySelector('button[onclick="addFlavor()"]');
        const vstockSection = document.getElementById("variant-stock-section");
        const matrixSection = document.getElementById("stock-matrix-section");
        const pmStock = document.getElementById("pm-stock");

        if (isBundle) {
          if (bundleSection) bundleSection.style.display = "";
          if (variantsList) variantsList.style.display = "none";
          if (flavorsList) flavorsList.style.display = "none";
          if (addVariantBtn) addVariantBtn.style.display = "none";
          if (addFlavorBtn) addFlavorBtn.style.display = "none";
          if (vstockSection) vstockSection.style.display = "none";
          if (matrixSection) matrixSection.style.display = "none";
          if (pmStock) pmStock.disabled = true;
          populateBundleProductsDropdown();
          updateBundleCalculations();
        } else {
          if (bundleSection) bundleSection.style.display = "none";
          if (variantsList) variantsList.style.display = "";
          if (flavorsList) flavorsList.style.display = "";
          if (addVariantBtn) addVariantBtn.style.display = "";
          if (addFlavorBtn) addFlavorBtn.style.display = "";
          if (pmStock) pmStock.disabled = false;
          refreshStockMatrix();
        }
      };

      window.populateBundleProductsDropdown = function() {
        const select = document.getElementById("bundle-item-select");
        if (!select) return;
        const filtered = products.filter(p => (!editingProductId || p.id !== editingProductId) && Number(p.stock) > 0);
        select.innerHTML = filtered.map(p => `<option value="${p.id}">${p.brand ? p.brand + ' - ' : ''}${p.name} (Stock: ${p.stock})</option>`).join("");
        onBundleItemSelectChange();
      };

      window.onBundleItemSelectChange = function() {
        const select = document.getElementById("bundle-item-select");
        const varGroup = document.getElementById("bundle-variant-group");
        const varSelect = document.getElementById("bundle-variant-select");
        const flavorGroup = document.getElementById("bundle-flavor-group");
        const flavorSelect = document.getElementById("bundle-flavor-select");
        if (!select || !varGroup || !varSelect || !flavorGroup || !flavorSelect) return;

        const productId = select.value;
        const prod = products.find(p => p.id === productId);
        if (prod && Array.isArray(prod.variants) && prod.variants.length > 0) {
          varGroup.style.display = "";
          varSelect.innerHTML = prod.variants.map(v => {
            const label = v.weight ? `${v.weight}${v.unit || ""}`.trim() : `Default`;
            return `<option value="${label}">${label} (${v.price} DA)</option>`;
          }).join("");
        } else {
          varGroup.style.display = "none";
          varSelect.innerHTML = "";
        }

        updateBundleFlavorsDropdown();
      };

      window.updateBundleFlavorsDropdown = function() {
        const select = document.getElementById("bundle-item-select");
        const varGroup = document.getElementById("bundle-variant-group");
        const varSelect = document.getElementById("bundle-variant-select");
        const flavorGroup = document.getElementById("bundle-flavor-group");
        const flavorSelect = document.getElementById("bundle-flavor-select");
        if (!select || !flavorGroup || !flavorSelect) return;

        const productId = select.value;
        const prod = products.find(p => p.id === productId);
        if (!prod) {
          flavorGroup.style.display = "none";
          flavorSelect.innerHTML = "";
          updateBundleQtyMax();
          return;
        }

        let flavorsList = [];
        const variants = prod.variants || [];
        if (varGroup.style.display !== "none" && varSelect && varSelect.value) {
          const selectedLabel = varSelect.value.trim().toLowerCase();
          const v = variants.find(x => {
            const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
            return label === selectedLabel;
          });
          if (v && v.flavorStock) {
            flavorsList = Object.keys(v.flavorStock);
          }
        }

        if (flavorsList.length === 0 && Array.isArray(prod.flavors)) {
          flavorsList = prod.flavors.map(f => typeof f === "object" ? f.name : f).filter(Boolean);
        }

        if (flavorsList.length > 0) {
          flavorGroup.style.display = "";
          flavorSelect.innerHTML = flavorsList.map(fn => `<option value="${fn}">${fn}</option>`).join("");
        } else {
          flavorGroup.style.display = "none";
          flavorSelect.innerHTML = "";
        }

        updateBundleQtyMax();
      };

      window.updateBundleQtyMax = function() {
        const select = document.getElementById("bundle-item-select");
        const varGroup = document.getElementById("bundle-variant-group");
        const varSelect = document.getElementById("bundle-variant-select");
        const flavorGroup = document.getElementById("bundle-flavor-group");
        const flavorSelect = document.getElementById("bundle-flavor-select");
        const qtyInp = document.getElementById("bundle-item-qty");
        if (!select || !qtyInp) return;

        const productId = select.value;
        const prod = products.find(p => p.id === productId);
        if (!prod) return;

        let availableStock = 0;
        let selectedVariant = null;

        if (varGroup.style.display !== "none" && varSelect && varSelect.value) {
          const selectedLabel = varSelect.value.trim().toLowerCase();
          const variants = prod.variants || [];
          selectedVariant = variants.find(x => {
            const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
            return label === selectedLabel;
          });
          availableStock = selectedVariant ? Number(selectedVariant.stock) || 0 : 0;
        } else {
          availableStock = Number(prod.stock) || 0;
        }

        if (flavorGroup.style.display !== "none" && flavorSelect && flavorSelect.value) {
          const selectedFlavorName = flavorSelect.value.trim();
          if (selectedVariant && selectedVariant.flavorStock && selectedVariant.flavorStock[selectedFlavorName] !== undefined) {
            availableStock = Number(selectedVariant.flavorStock[selectedFlavorName]) || 0;
          } else if (Array.isArray(prod.flavors)) {
            const fObj = prod.flavors.find(f => {
              const name = typeof f === "object" ? f.name : f;
              return String(name).trim() === selectedFlavorName;
            });
            if (fObj) {
              availableStock = typeof fObj === "object" ? Number(fObj.qty) || 0 : Number(prod.stock) || 0;
            }
          }
        }

        qtyInp.max = availableStock;
        if (parseInt(qtyInp.value) > availableStock) {
          qtyInp.value = availableStock;
        }
        if (availableStock <= 0) {
          qtyInp.value = 0;
          qtyInp.min = 0;
        } else {
          qtyInp.min = 1;
          if (parseInt(qtyInp.value) < 1) qtyInp.value = 1;
        }
      };

      window.addBundleItem = function() {
        const select = document.getElementById("bundle-item-select");
        const qtyInp = document.getElementById("bundle-item-qty");
        const varGroup = document.getElementById("bundle-variant-group");
        const varSelect = document.getElementById("bundle-variant-select");
        const flavorGroup = document.getElementById("bundle-flavor-group");
        const flavorSelect = document.getElementById("bundle-flavor-select");
        if (!select || !qtyInp || !varSelect || !flavorSelect) return;

        const productId = select.value;
        if (!productId) return;
        const qty = parseInt(qtyInp.value) || 1;
        const variant = varGroup.style.display !== "none" ? varSelect.value : "";
        const flavor = flavorGroup.style.display !== "none" ? flavorSelect.value : "";

        const selectedProd = products.find(p => p.id === productId);
        if (!selectedProd) return;

        const existingIndex = editingBundleItems.findIndex(x => x.productId === productId && x.variant === variant && x.flavor === flavor);
        if (existingIndex >= 0) {
          editingBundleItems[existingIndex].qty += qty;
        } else {
          editingBundleItems.push({
            productId,
            qty,
            variant,
            flavor,
            name: selectedProd.name,
            brand: selectedProd.brand || ""
          });
        }

        renderBundleItems();
        updateBundleCalculations();
      };

      window.removeBundleItem = function(index) {
        editingBundleItems.splice(index, 1);
        renderBundleItems();
        updateBundleCalculations();
      };

      function renderBundleItems() {
        const list = document.getElementById("bundle-items-list");
        if (!list) return;
        if (editingBundleItems.length === 0) {
          list.innerHTML = `<div style="color:var(--g400);font-size:13px;padding:4px 0">No items in this bundle yet.</div>`;
          return;
        }
        list.innerHTML = editingBundleItems.map((item, index) => {
          const variantText = item.variant ? ` (${item.variant})` : "";
          const flavorText = item.flavor ? ` - ${item.flavor}` : "";
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#fff; border:1px solid var(--gray-100); border-radius:6px; font-size:13px; margin-bottom:4px;">
              <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                <strong>${item.brand ? item.brand + ' - ' : ''}${item.name}</strong>${variantText}${flavorText} <span style="color:var(--black);font-weight:600;">x${item.qty}</span>
              </div>
              <button type="button" class="btn-text-danger" onclick="removeBundleItem(${index})" style="background:none; border:none; color:var(--red); cursor:pointer; font-weight:600; padding:2px 8px; font-size:12px;">Remove</button>
            </div>
          `;
        }).join("");
      }

      function updateBundleCalculations() {
        let totalBasePrice = 0;
        let totalStock = Infinity;

        editingBundleItems.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            let price = 0;
            let stock = 0;
            const vList = prod.variants || [];
            let v = null;
            if (item.variant && vList.length > 0) {
              v = vList.find(x => {
                const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
                return label === String(item.variant).trim().toLowerCase();
              });
              price = v ? Number(v.price) || 0 : Number(vList[0].price) || 0;
              stock = v ? Number(v.stock) || 0 : 0;
            } else {
              price = vList.length > 0 ? Number(vList[0].price) || 0 : 0;
              stock = Number(prod.stock) || 0;
            }

            if (item.flavor) {
              if (v && v.flavorStock && v.flavorStock[item.flavor] !== undefined) {
                stock = Number(v.flavorStock[item.flavor]) || 0;
              } else if (Array.isArray(prod.flavors)) {
                const fObj = prod.flavors.find(f => {
                  const name = typeof f === "object" ? f.name : f;
                  return String(name).trim() === item.flavor;
                });
                if (fObj) {
                  stock = typeof fObj === "object" ? Number(fObj.qty) || 0 : Number(prod.stock) || 0;
                }
              }
            }

            totalBasePrice += price * item.qty;
            totalStock = Math.min(totalStock, Math.floor(stock / item.qty));
          }
        });

        if (totalStock === Infinity) totalStock = 0;

        const stockHint = document.getElementById("pm-stock-hint");
        if (stockHint) {
          stockHint.textContent = `Auto-calculated stock: ${totalStock}`;
          stockHint.style.display = "block";
        }
        const pmStock = document.getElementById("pm-stock");
        if (pmStock) {
          pmStock.value = totalStock;
        }
      }

      function editProduct(id) {
        openProductModal(id);
      }

      function getVariantImageOptions(selectedIdx) {
        let html = '<option value="">Default (First)</option>';
        currentImageUrls.forEach((url, index) => {
          const isSelected = selectedIdx !== undefined && selectedIdx !== null && String(selectedIdx) === String(index);
          html += `<option value="${index}" ${isSelected ? "selected" : ""}>Image ${index + 1}</option>`;
        });
        return html;
      }

      function updateVariantImageDropdowns() {
        document.querySelectorAll(".variant-image-select").forEach(select => {
          const curVal = select.value;
          select.innerHTML = getVariantImageOptions(curVal);
        });
        document.querySelectorAll(".flavor-image-select").forEach(select => {
          const curVal = select.value;
          select.innerHTML = getVariantImageOptions(curVal);
        });
      }

      function addVariant(v = null) {
        const list = document.getElementById("variants-list");
        const div = document.createElement("div");
        div.className = "variant-row";
        if (v && v.flavorStock) div.dataset.flavorStock = JSON.stringify(v.flavorStock);
        if (v && v.stock !== undefined) div.dataset.varStock = String(v.stock);

        const selectedImgIdx = v && v.imageIndex !== undefined && v.imageIndex !== null ? String(v.imageIndex) : "";

        div.innerHTML = `
          <div class="form-group">
            <label>Weight</label>
            <input type="number" class="form-control variant-weight-input" placeholder="e.g. 908" value="${v ? v.weight : ""}" oninput="refreshStockMatrix()" />
          </div>
          <div class="form-group">
            <label>Unit</label>
            <select class="form-control form-select variant-unit-select" onchange="refreshStockMatrix()">
              <option ${v && v.unit === "g" ? "selected" : ""}>g</option>
              <option ${v && v.unit === "kg" ? "selected" : ""}>kg</option>
              <option ${v && v.unit === "caps" ? "selected" : ""}>caps</option>
              <option ${v && v.unit === "ml" ? "selected" : ""}>ml</option>
              <option ${v && v.unit === "L" ? "selected" : ""}>L</option>
              <option ${v && v.unit === "pcs" ? "selected" : ""}>pcs</option>
            </select>
          </div>
           <div class="form-group">
            <label>Price (DA)</label>
            <input type="number" class="form-control variant-price-input" placeholder="0" value="${v ? v.price : ""}" />
          </div>
          <div class="form-group">
            <label>Cost (DA)</label>
            <input type="number" class="form-control variant-cost-input" placeholder="0" value="${v && v.cost !== undefined ? v.cost : ""}" />
          </div>
          <div class="form-group" style="min-width: 180px;">
            <label>Link SKU (Optional)</label>
            <input type="text"
                   class="form-control variant-sku-search-input"
                   list="inventory-skus-datalist"
                   placeholder="Type SKU or Name to search..."
                   value="${v && v.sku ? getInventorySkuDisplayLabel(v.sku) : ''}"
                   onfocus="ensureInventorySkuDatalist()"
                   oninput="onVariantSkuSearchInput(this)"
                   onchange="onVariantSkuSearchInput(this)" />
            <input type="hidden" class="variant-sku-select" value="${v ? (v.sku || '') : ''}" />
          </div>
          <div class="form-group">
            <label>Image</label>
            <div class="row-image-control">
              <select class="form-control form-select variant-image-select">
                ${getVariantImageOptions(selectedImgIdx)}
              </select>
              <label class="row-upload-btn">
                <input type="file" accept="image/*" style="display:none" onchange="handleRowImageUpload(event, this.closest('.variant-row'), 'variant-image-select')" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </label>
            </div>
          </div>
          <button class="btn-remove-variant" onclick="this.closest('.variant-row').remove();refreshStockMatrix()">×</button>
        `;
        list.appendChild(div);
        refreshStockMatrix();
      }
      window.addVariant = addVariant;

      function addFlavor(f = null) {
        const list = document.getElementById("flavors-list");
        const div = document.createElement("div");
        div.className = "flavor-row";

        const selectedImgIdx = f && f.imageIndex !== undefined && f.imageIndex !== null ? String(f.imageIndex) : "";

        div.innerHTML = `
          <div class="form-group">
            <label>Flavor Name</label>
            <input type="text" class="form-control flavor-name-input" placeholder="e.g. Chocolate" value="${f ? f.name : ""}" oninput="refreshStockMatrix()" />
          </div>
          <div class="form-group flavor-qty-cell">
            <label>Qty (no variants)</label>
            <input type="number" class="form-control flavor-qty-input" placeholder="0" value="${f && f.qty ? f.qty : ""}" min="0" oninput="refreshStockMatrix()" />
          </div>
          <div class="form-group">
            <label>Image</label>
            <div class="row-image-control">
              <select class="form-control form-select flavor-image-select">
                ${getVariantImageOptions(selectedImgIdx)}
              </select>
              <label class="row-upload-btn">
                <input type="file" accept="image/*" style="display:none" onchange="handleRowImageUpload(event, this.closest('.flavor-row'), 'flavor-image-select')" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </label>
            </div>
          </div>
          <button class="btn-remove-variant" onclick="this.closest('.flavor-row').remove();refreshStockMatrix()">×</button>
        `;
        list.appendChild(div);
        refreshStockMatrix();
      }
      window.addFlavor = addFlavor;

      /* ── Stock Matrix helpers ── */
      function refreshStockMatrix() {
        const variantRows = Array.from(document.querySelectorAll("#variants-list .variant-row"));
        const flavorRows  = Array.from(document.querySelectorAll("#flavors-list .flavor-row"));
        const flavors = flavorRows.map(r => (r.querySelector(".flavor-name-input")?.value || "").trim()).filter(Boolean);
        const hasVariants = variantRows.length > 0;
        const hasFlavors  = flavors.length > 0;
        const showMatrix  = hasVariants && hasFlavors;

        // Preserve current values before re-render
        const matrixVals = {};
        document.querySelectorAll("#stock-matrix-body input").forEach(inp => {
          matrixVals[`${inp.dataset.vi}_${inp.dataset.fn}`] = parseInt(inp.value) || 0;
        });
        const vstockVals = {};
        document.querySelectorAll("#variant-stock-list .vstock-input").forEach(inp => {
          vstockVals[String(inp.dataset.vi)] = parseInt(inp.value) || 0;
        });
        // If switching matrix→variant-only: seed variant stocks from matrix row totals
        if (!Object.keys(vstockVals).length && Object.keys(matrixVals).length) {
          document.querySelectorAll("#stock-matrix-body tr").forEach((row, vi) => {
            vstockVals[String(vi)] = Array.from(row.querySelectorAll("input")).reduce((s, i) => s + (parseInt(i.value) || 0), 0);
          });
        }

        const pmStock = document.getElementById("pm-stock");
        const pmHint  = document.getElementById("pm-stock-hint");

        document.querySelectorAll(".flavor-qty-cell").forEach(el => {
          el.style.display = showMatrix ? "none" : "";
        });

        if (showMatrix) {
          document.getElementById("variant-stock-section").style.display = "none";
          document.getElementById("stock-matrix-section").style.display = "";
          pmStock.readOnly = true; pmHint.style.display = "";

          const varMeta = variantRows.map((row, vi) => {
            const ins = row.querySelectorAll("input,select");
            const w = ins[0]?.value || ""; const u = ins[1]?.value || "";
            return { vi, label: w ? `${w}${u}` : `V${vi+1}`, fs: JSON.parse(row.dataset.flavorStock || "{}") };
          });

          let head = "<tr><th>Variant</th>";
          flavors.forEach(fn => { head += `<th>${fn}</th>`; });
          head += "<th>Total</th></tr>";
          document.getElementById("stock-matrix-head").innerHTML = head;

          let body = "";
          varMeta.forEach(({ vi, label, fs }) => {
            const row = variantRows[vi];
            const skuSelect = row ? row.querySelector(".variant-sku-select") : null;
            const sku = skuSelect ? skuSelect.value : "";
            let isReadOnly = false;
            let invStock = 0;
            if (sku) {
              const inv = inventoryItems.find(x => x.id === sku);
              invStock = inv ? inv.stock : 0;
              isReadOnly = true;
            }

            body += `<tr><td>${label}</td>`;
            let rowTotal = 0;
            flavors.forEach(fn => {
              const key = `${vi}_${fn}`;
              let val = 0;
              if (isReadOnly) {
                // If linked to single SKU but we have flavors, let first cell hold inventory stock and others 0
                val = flavors.indexOf(fn) === 0 ? invStock : 0;
              } else {
                val = matrixVals[key] !== undefined ? matrixVals[key] : (fs[fn] !== undefined ? Number(fs[fn]) : 0);
              }
              rowTotal += val;
              body += `<td><input type="number" class="form-control matrix-cell" min="0" value="${val}" data-vi="${vi}" data-fn="${fn}" ${isReadOnly ? "readonly disabled style='background:var(--g50); opacity:0.75; cursor:not-allowed;'" : "oninput='updateMatrixTotals()'"} /></td>`;
            });
            body += `<td class="matrix-total" id="mrt-${vi}">${isReadOnly ? invStock : rowTotal}</td></tr>`;
          });
          document.getElementById("stock-matrix-body").innerHTML = body;
          updateMatrixTotals();

        } else if (hasVariants) {
          document.getElementById("stock-matrix-section").style.display = "none";
          document.getElementById("variant-stock-section").style.display = "";
          pmStock.readOnly = true; pmHint.style.display = "";

          document.getElementById("variant-stock-list").innerHTML = variantRows.map((row, vi) => {
            const ins = row.querySelectorAll("input,select");
            const w = ins[0]?.value || ""; const u = ins[1]?.value || "";
            const label = w ? `${w}${u}` : `V${vi+1}`;
            
            const skuSelect = row.querySelector(".variant-sku-select");
            const sku = skuSelect ? skuSelect.value : "";
            let stock = 0;
            let isReadOnly = false;
            if (sku) {
              const inv = inventoryItems.find(x => x.id === sku);
              stock = inv ? inv.stock : 0;
              isReadOnly = true;
            } else {
              stock = vstockVals[String(vi)] !== undefined ? vstockVals[String(vi)] : (parseInt(row.dataset.varStock) || 0);
            }

            return `
              <div class="vstock-row" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span class="vstock-label" style="min-width:60px;">${label}</span>
                <input type="number" class="form-control vstock-input" data-vi="${vi}" value="${stock}" min="0" placeholder="0" ${isReadOnly ? "readonly disabled style='background:var(--g50); opacity:0.75; cursor:not-allowed;'" : "oninput='refreshStockTotal()'"} />
                ${isReadOnly ? `<span style="font-size:11.5px; color:var(--green); font-weight:600; font-family:var(--font-b);">✓ Linked to SKU [${sku}]</span>` : ""}
              </div>`;
          }).join("");
          refreshStockTotal();

        } else {
          document.getElementById("stock-matrix-section").style.display = "none";
          document.getElementById("variant-stock-section").style.display = "none";
          pmStock.readOnly = false; pmHint.style.display = "none";
          if (hasFlavors) {
            pmStock.value = flavorRows.reduce((s, r) => s + (parseInt(r.querySelector(".flavor-qty-input")?.value) || 0), 0);
          }
        }
      }

      function updateMatrixTotals() {
        let grand = 0;
        const variantRows = Array.from(document.querySelectorAll("#variants-list .variant-row"));
        document.querySelectorAll("#stock-matrix-body tr").forEach((row, vi) => {
          const vRow = variantRows[vi];
          const skuSelect = vRow ? vRow.querySelector(".variant-sku-select") : null;
          const sku = skuSelect ? skuSelect.value : "";
          let sum = 0;
          if (sku) {
            const inv = inventoryItems.find(x => x.id === sku);
            sum = inv ? inv.stock : 0;
          } else {
            sum = Array.from(row.querySelectorAll("input")).reduce((s, i) => s + (parseInt(i.value) || 0), 0);
          }
          const cell = document.getElementById(`mrt-${vi}`);
          if (cell) cell.textContent = sum;
          grand += sum;
        });
        document.getElementById("pm-stock").value = grand;
      }

      function refreshStockTotal() {
        let total = 0;
        const variantRows = Array.from(document.querySelectorAll("#variants-list .variant-row"));
        document.querySelectorAll("#variant-stock-list .vstock-input").forEach((inp) => {
          const vi = parseInt(inp.dataset.vi);
          const vRow = variantRows[vi];
          const skuSelect = vRow ? vRow.querySelector(".variant-sku-select") : null;
          const sku = skuSelect ? skuSelect.value : "";
          if (sku) {
            const inv = inventoryItems.find(x => x.id === sku);
            total += inv ? inv.stock : 0;
          } else {
            total += parseInt(inp.value) || 0;
          }
        });
        document.getElementById("pm-stock").value = total;
      }

      async function saveProduct() {
        const name = document.getElementById("pm-name").value.trim();
        if (!name) {
          showToast("Product name required", "error");
          return;
        }

        const isBundle = document.getElementById("pm-bundle-toggle").checked;
        const categoryIds = getCheckedValues("pm-categories");
        const subCategoryIds = getCheckedValues("pm-subcategories");

        // Enforce bundles category for bundle products
        const bundlesCat = categories.find(c => c.name.trim().toLowerCase() === "bundles (packs)");
        if (isBundle) {
          if (!bundlesCat) {
            showToast("Please create a category named 'Bundles (Packs)' first before adding a bundle.", "error");
            return;
          }
          if (editingBundleItems.length === 0) {
            showToast("Please add at least one item to the bundle.", "error");
            return;
          }
          if (!categoryIds.includes(bundlesCat.id)) {
            categoryIds.push(bundlesCat.id);
          }
        }

        const promoCodeIds = document.getElementById("pm-promo-toggle").checked
          ? getCheckedValues("pm-promo-codes")
          : [];

        let variants = [];
        let flavors = [];
        let globalStock = 0;
        let bundleItems = [];

        if (isBundle) {
          // Calculate sum of base prices and min stock
          let totalBasePrice = 0;
          let totalStock = Infinity;
          editingBundleItems.forEach(item => {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
              let price = 0;
              let stock = 0;
              const vList = prod.variants || [];
              let v = null;
              if (item.variant && vList.length > 0) {
                v = vList.find(x => {
                  const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
                  return label === String(item.variant).trim().toLowerCase();
                });
                price = v ? Number(v.price) || 0 : Number(vList[0].price) || 0;
                stock = v ? Number(v.stock) || 0 : 0;
              } else {
                price = vList.length > 0 ? Number(vList[0].price) || 0 : 0;
                stock = Number(prod.stock) || 0;
              }

              if (item.flavor) {
                if (v && v.flavorStock && v.flavorStock[item.flavor] !== undefined) {
                  stock = Number(v.flavorStock[item.flavor]) || 0;
                } else if (Array.isArray(prod.flavors)) {
                  const fObj = prod.flavors.find(f => {
                    const name = typeof f === "object" ? f.name : f;
                    return String(name).trim() === item.flavor;
                  });
                  if (fObj) {
                    stock = typeof fObj === "object" ? Number(fObj.qty) || 0 : Number(prod.stock) || 0;
                  }
                }
              }

              totalBasePrice += price * item.qty;
              totalStock = Math.min(totalStock, Math.floor(stock / item.qty));
            }
          });
          if (totalStock === Infinity) totalStock = 0;
          
          variants = [{ weight: "1", unit: "Bundle", price: totalBasePrice, stock: totalStock }];
          flavors = [];
          globalStock = totalStock;
          bundleItems = editingBundleItems;
        }

        let description = document.getElementById("pm-desc").innerHTML.trim();
        if (isBundle) {
          let bundleDesc = `<div class="bundle-includes-section" style="margin-top:20px; padding:16px; background:var(--gray-50); border:1px solid var(--gray-100); border-radius:8px;">`;
          bundleDesc += `<h4 style="margin:0 0 10px 0; font-size:14px; font-weight:600; color:var(--black);">Pack Includes:</h4>`;
          bundleDesc += `<ul style="margin:0; padding-left:20px; font-size:13px; color:var(--gray-600); line-height:1.6;">`;
          editingBundleItems.forEach(item => {
            const variantText = item.variant ? ` (${item.variant})` : "";
            const flavorText = item.flavor ? ` - ${item.flavor}` : "";
            bundleDesc += `<li style="margin-bottom:4px;"><strong>${item.brand ? item.brand + ' - ' : ''}${item.name}</strong>${variantText}${flavorText} x${item.qty}</li>`;
          });
          bundleDesc += `</ul></div>`;
          
          const cleanDesc = description.replace(/<div class="bundle-includes-section"[\s\S]*?<\/div>/g, "");
          description = cleanDesc.trim() + "\n" + bundleDesc;
        }

        if (!isBundle) {
          // Standard product logic
          const showMatrix = document.getElementById("stock-matrix-section").style.display !== "none";
          const showVStock = document.getElementById("variant-stock-section").style.display !== "none";

          variants = Array.from(document.querySelectorAll("#variants-list .variant-row"))
            .map((r, vi) => {
              const weightInput = r.querySelector(".variant-weight-input");
              const unitSelect = r.querySelector(".variant-unit-select");
              const priceInput = r.querySelector(".variant-price-input");
              const imgSelect = r.querySelector(".variant-image-select");

              const costInput = r.querySelector(".variant-cost-input");
              const skuSelect = r.querySelector(".variant-sku-select");
              const sku = skuSelect ? skuSelect.value : "";

              const v = {
                weight: weightInput ? weightInput.value : "",
                unit: unitSelect ? unitSelect.value : "g",
                price: priceInput ? parseFloat(priceInput.value) || 0 : 0,
                cost: costInput ? parseFloat(costInput.value) || 0 : 0,
                sku: sku
              };

              const imgVal = imgSelect ? imgSelect.value : "";
              if (imgVal !== "") {
                v.imageIndex = parseInt(imgVal);
              }

              if (showMatrix) {
                v.flavorStock = {};
                document.querySelectorAll(`#stock-matrix-body input[data-vi="${vi}"]`).forEach(inp => {
                  v.flavorStock[inp.dataset.fn] = parseInt(inp.value) || 0;
                });
                v.stock = Object.values(v.flavorStock).reduce((s, q) => s + q, 0);
              } else if (showVStock) {
                const vstockInp = document.querySelector(`#variant-stock-list .vstock-input[data-vi="${vi}"]`);
                v.stock = parseInt(vstockInp?.value) || 0;
              }
              return v;
            })
            .filter((v) => v.weight);

          flavors = Array.from(document.querySelectorAll("#flavors-list .flavor-row"))
            .map((r) => {
              const name = r.querySelector(".flavor-name-input")?.value.trim() || "";
              const qty  = parseInt(r.querySelector(".flavor-qty-input")?.value) || 0;
              const imgSelect = r.querySelector(".flavor-image-select");
              const f = { name, qty };
              const imgVal = imgSelect ? imgSelect.value : "";
              if (imgVal !== "") {
                f.imageIndex = parseInt(imgVal);
              }
              return f;
            })
            .filter((f) => f.name);

          // Compute global stock
          if (variants.length > 0) {
            globalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
          } else if (flavors.length > 0) {
            globalStock = flavors.reduce((s, f) => s + f.qty, 0);
          } else {
            globalStock = parseInt(document.getElementById("pm-stock").value) || 0;
          }
        }

        const payload = {
          name,
          brand: document.getElementById("pm-brand").value.trim(),
          categoryIds,
          subCategoryIds,
          description: description,
          nutritionalFacts: document.getElementById("pm-nutritional").innerHTML.trim(),
          benefits: document.getElementById("pm-benefits").innerHTML.trim(),
          imageUrl: currentImageUrls,
          variants,
          flavors,
          stock: globalStock,
          discount: parseInt(document.getElementById("pm-discount").value) || 0,
          allowPromo: document.getElementById("pm-promo-toggle").checked,
          promoCodeIds,
          status: document.getElementById("pm-status").value,
          bundleItems,
        };
        document.getElementById("pm-save-btn").disabled = true;
        showLoading("Saving product…");
        try {
          payload.action = editingProductId ? "updateProduct" : "addProduct";
          if (editingProductId) payload.id = editingProductId;
          const r = await apiPost(payload);
          if (r.success) {
            showToast(editingProductId ? "Product updated!" : "Product added!");
            closeModal("product-modal");
            // Local mutation — no refetch round-trip
            if (editingProductId) {
              const idx = products.findIndex(p => p.id === editingProductId);
              if (idx >= 0) products[idx] = { ...products[idx], ...payload, id: editingProductId };
            } else {
              const newProduct = { ...payload, id: r.id || ("tmp_" + Date.now()) };
              products.unshift(newProduct);
            }
            renderProducts();
            renderBundleList(document.getElementById("bundle-search")?.value || "");
            updateDashboard();
            // Silent background sync to pick up server-canonical IDs
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        document.getElementById("pm-save-btn").disabled = false;
        hideLoading();
      }

      // ════════════════════════════════════════════
      // CATEGORIES
      // ════════════════════════════════════════════
      function renderCats() {
        _selReset("cat");
        const tree = document.getElementById("cat-tree");
        const pag = document.getElementById("cat-pag");
        if (!categories.length) {
          tree.innerHTML =
            '<div class="empty-state"><p>No categories yet</p></div>';
          if (pag) pag.innerHTML = "";
          return;
        }
        const pageItems = categories.slice((catPage - 1) * _PAGE, catPage * _PAGE);
        tree.innerHTML = pageItems
          .map((c) => {
            const subs = subCategories.filter((s) =>
              s.categoryIds && s.categoryIds.includes(c.id),
            );
            return `<div class="cat-node"><div class="cat-row" id="cat-row-${c.id}" onclick="toggleCat('${c.id}',event)"><input type="checkbox" class="row-cb" data-sel-type="cat" data-sel-id="${c.id}" onclick="event.stopPropagation()" onchange="_selToggleCat('${c.id}',this.checked)" style="margin-right:8px;width:15px;height:15px;accent-color:var(--red);cursor:pointer;flex-shrink:0"><div class="cat-expand" id="cat-exp-${c.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div><div class="cat-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg></div><div class="cat-name">${c.name}</div>${c.description ? `<span style="font-size:11px;color:var(--g400);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.description}</span>` : ""}${subs.length > 0 ? `<span class="cat-count">${subs.length} sub${subs.length !== 1 ? "s" : ""}</span>` : ""}<div class="action-group"><button class="act-btn act-edit" onclick="editCat('${c.id}');event.stopPropagation()">Edit</button><button class="act-btn act-delete" onclick="confirmDelete('cat','${c.id}');event.stopPropagation()">Delete</button></div></div><div class="sub-cats" id="sub-cats-${c.id}">${subs.map((s) => `<div class="sub-node"><div class="sub-icon"></div><div class="sub-name">${s.name}</div><div class="sub-actions"><button class="act-btn act-edit" onclick="editSubCat('${s.id}')">Edit</button><button class="act-btn act-delete" onclick="confirmDelete('subcat','${s.id}')">Delete</button></div></div>`).join("")}</div></div>`;
          })
          .join("");
        if (pag) pag.innerHTML = _pagCtrl(categories.length, catPage, "setCatPage");
      }

      function _selToggleCat(id, checked) {
        if (checked) _sel.cat.add(id);
        else _sel.cat.delete(id);
        const bar = document.getElementById("sel-bar-cat");
        if (bar) bar.classList.toggle("visible", _sel.cat.size > 0);
        const label = document.getElementById("sel-count-cat");
        const n = _sel.cat.size;
        if (label) label.textContent = n + " item" + (n !== 1 ? "s" : "") + " selected";
      }
      function toggleCat(catId, e) {
        if (e && e.target.closest("button")) return;
        const sub = document.getElementById("sub-cats-" + catId);
        const exp = document.getElementById("cat-exp-" + catId);
        if (!sub || !exp) return;
        const isOpen = sub.classList.toggle("open");
        exp.classList.toggle("open", isOpen);
      }
      function openCatModal() {
        editingCatId = null;
        document.getElementById("cat-modal-title").textContent = "Add Category";
        document.getElementById("cat-name").value = "";
        document.getElementById("cat-desc").value = "";
        document.getElementById("sub-items-list").innerHTML = "";
        openModal("cat-modal");
      }
      function editCat(id) {
        const cat = categories.find((c) => c.id === id);
        if (!cat) return;
        editingCatId = id;
        document.getElementById("cat-modal-title").textContent = "Edit Category";
        document.getElementById("cat-name").value = cat.name || "";
        document.getElementById("cat-desc").value = cat.description || "";
        const subs = subCategories.filter((s) => s.categoryIds && s.categoryIds.includes(id));
        document.getElementById("sub-items-list").innerHTML = subs
          .map((s) => `<div class="sub-item-row"><input type="text" class="form-control" style="flex:1" value="${s.name.replace(/"/g,'&quot;')}" data-sub-id="${s.id}" /><button class="btn-rem-sub" onclick="this.closest('.sub-item-row').remove()">×</button></div>`)
          .join("");
        openModal("cat-modal");
      }
      function addSubItem() {
        const list = document.getElementById("sub-items-list");
        const div = document.createElement("div");
        div.className = "sub-item-row";
        div.innerHTML = `<input type="text" class="form-control" style="flex:1" placeholder="Sub-category name…" /><button class="btn-rem-sub" onclick="this.closest('.sub-item-row').remove()">×</button>`;
        list.appendChild(div);
      }
      async function saveCat() {
        const name = document.getElementById("cat-name").value.trim();
        if (!name) { showToast("Name required", "error"); return; }
        const subRows = Array.from(document.querySelectorAll("#sub-items-list .sub-item-row input"));
        const subs = subRows.map((i) => ({ id: i.dataset.subId || "", name: i.value.trim() })).filter((s) => s.name);
        showLoading(editingCatId ? "Updating category…" : "Saving category…");
        try {
          const payload = editingCatId
            ? { action: "updateCategory", id: editingCatId, name, description: document.getElementById("cat-desc").value.trim(), subCategories: subs }
            : { action: "addCategory", name, description: document.getElementById("cat-desc").value.trim(), subCategories: subs.map((s) => s.name) };
          const r = await apiPost(payload);
          if (r.success) {
            showToast(editingCatId ? "Category updated!" : "Category saved!");
            closeModal("cat-modal");
            editingCatId = null;
            // Local mutation + silent background sync
            if (payload.action === "updateCategory") {
              const idx = categories.findIndex(c => c.id === payload.id);
              if (idx >= 0) categories[idx] = { ...categories[idx], name: payload.name, description: payload.description };
            } else {
              categories.push({ id: r.id || ("tmp_cat_" + Date.now()), name: payload.name, description: payload.description });
            }
            renderCats();
            updateDashboard();
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }
      function editSubCat(id) {
        const sub = subCategories.find((s) => s.id === id);
        if (!sub) return;
        editingSubCatId = id;
        document.getElementById("subcat-name-input").value = sub.name || "";
        openModal("subcat-edit-modal");
      }
      async function saveSubCat() {
        const name = document.getElementById("subcat-name-input").value.trim();
        if (!name) { showToast("Name required", "error"); return; }
        showLoading("Updating sub-category…");
        try {
          const r = await apiPost({ action: "updateSubCategory", id: editingSubCatId, name });
          if (r.success) {
            showToast("Sub-category updated!");
            closeModal("subcat-edit-modal");
            const sIdx = subCategories.findIndex(s => s.id === editingSubCatId);
            if (sIdx >= 0) subCategories[sIdx] = { ...subCategories[sIdx], name };
            editingSubCatId = null;
            renderCats();
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // PROMOS
      // ════════════════════════════════════════════
      function renderPromos() {
        _selReset("promo");
        const tbody = document.getElementById("promos-tbody");
        if (!promos.length) {
          tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>No promo codes</p></div></td></tr>`;
          return;
        }
        tbody.innerHTML = promos
          .map((p) => {
            const typeLabel =
              p.type === "percent"
                ? "Percentage"
                : p.type === "fixed"
                  ? "Fixed"
                  : "Free Delivery";
            const valStr =
              p.type === "free_delivery"
                ? "—"
                : p.type === "percent"
                  ? p.value + "%"
                  : p.value.toLocaleString() + " DA";
            const appliesToAll = p.applyToAll === true || String(p.applyToAll).toUpperCase() === "TRUE";
            const targetStr = appliesToAll
              ? '<span class="badge badge-active" style="margin-top:4px">All Products</span>' 
              : '<span class="badge badge-inactive" style="margin-top:4px">Specific Only</span>';
            return `<tr><td class="cb-td"><input type="checkbox" class="row-cb" data-sel-type="promo" data-sel-id="${p.id}" onchange="_selToggle('promo','${p.id}',this.checked)"></td>
          <td><span class="code-tag">${p.code}</span><br>${targetStr}</td>
          <td>${typeLabel}</td><td><strong>${valStr}</strong></td><td>${p.minOrder ? p.minOrder.toLocaleString() + " DA" : "—"}</td><td>${p.uses}${p.maxUses ? " / " + p.maxUses : ""}</td><td style="font-size:12px;color:var(--g600)">${p.expiry || "—"}</td><td><span class="badge badge-${p.status}">${cap(p.status)}</span></td><td><div class="action-group"><button class="act-btn act-edit" onclick="editPromo('${p.id}')">Edit</button><button class="act-btn act-delete" onclick="confirmDelete('promo','${p.id}')">Delete</button></div></td></tr>`;
          })
          .join("");
      }
      function updatePromoValueLabel() {
        const t = document.getElementById("promo-type").value;
        const row = document.getElementById("promo-value-row");
        if (t === "free_delivery") {
          row.style.display = "none";
        } else {
          row.style.display = "";
          document.getElementById("promo-value-label").textContent =
            t === "percent" ? "Percentage (%) *" : "Amount (DA) *";
        }
      }
      function openPromoModal(id = null) {
        editingPromoId = id;
        document.getElementById("promo-modal-title").textContent = id
          ? "Edit Promo Code"
          : "New Promo Code";
        if (id) {
          const p = promos.find((x) => x.id === id);
          if (p) {
            document.getElementById("promo-code").value = p.code;
            document.getElementById("promo-type").value = p.type;
            document.getElementById("promo-value").value = p.value || "";
            document.getElementById("promo-min").value = p.minOrder || "";
            document.getElementById("promo-max-uses").value = p.maxUses || "";
            document.getElementById("promo-expiry").value = p.expiry || "";
            document.getElementById("promo-status").value = p.status;
            document.getElementById("promo-apply-all").checked = p.applyToAll === true || String(p.applyToAll).toUpperCase() === "TRUE";
          }
        } else {
          [
            "promo-code",
            "promo-value",
            "promo-min",
            "promo-max-uses",
            "promo-expiry",
          ].forEach((x) => (document.getElementById(x).value = ""));
          document.getElementById("promo-type").value = "percent";
          document.getElementById("promo-status").value = "active";
          document.getElementById("promo-apply-all").checked = false;
        }
        updatePromoValueLabel();
        openModal("promo-modal");
      }
      function editPromo(id) {
        openPromoModal(id);
      }
      async function savePromo() {
        const code = document
          .getElementById("promo-code")
          .value.trim()
          .toUpperCase();
        const type = document.getElementById("promo-type").value;
        const value =
          type === "free_delivery"
            ? 0
            : parseFloat(document.getElementById("promo-value").value);
        if (!code) {
          showToast("Code required", "error");
          return;
        }
        if (type !== "free_delivery" && !value) {
          showToast("Value required", "error");
          return;
        }
        const duplicate = promos.find(p => p.code.toUpperCase() === code && p.id !== editingPromoId);
        if (duplicate) {
          showToast("A promo code with this name already exists", "error");
          return;
        }
        const payload = {
          code,
          type,
          value,
          minOrder: parseFloat(document.getElementById("promo-min").value) || 0,
          maxUses:
            parseInt(document.getElementById("promo-max-uses").value) || null,
          expiry: document.getElementById("promo-expiry").value,
          status: document.getElementById("promo-status").value,
          applyToAll: document.getElementById("promo-apply-all").checked,
        };
        showLoading("Saving promo…");
        try {
          payload.action = editingPromoId ? "updatePromo" : "addPromo";
          if (editingPromoId) payload.id = editingPromoId;
          const r = await apiPost(payload);
          if (r.success) {
            showToast(editingPromoId ? "Promo updated!" : "Promo created!");
            closeModal("promo-modal");
            if (editingPromoId) {
              const idx = promos.findIndex(p => p.id === editingPromoId);
              if (idx >= 0) promos[idx] = { ...promos[idx], ...payload, id: editingPromoId, uses: promos[idx].uses || 0 };
            } else {
              promos.push({ ...payload, id: r.id || ("tmp_promo_" + Date.now()), uses: 0 });
            }
            renderPromos();
            updateDashboard();
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // SETTINGS
      // ════════════════════════════════════════════
      async function saveUsername() {
        const u = document.getElementById("set-username").value.trim();
        const d = document.getElementById("set-displayname").value.trim();
        if (!u) {
          showToast("Username required", "error");
          return;
        }
        showLoading("Saving…");
        try {
          const r = await apiPost({
            action: "updateSettings",
            updates: { admin_username: u, admin_displayname: d || u },
          });
          if (r.success) {
            settings.admin_username = u;
            settings.admin_displayname = d || u;
            document.getElementById("sb-username").textContent = d || u;
            document.querySelector(".sb-avatar").textContent = (d ||
              u)[0].toUpperCase();
            showToast("Account info saved!");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }
      async function saveMarqueeSettings() {
        const text = document.getElementById("set-marquee-text").value.trim();
        const enabled = document.getElementById("set-marquee-enabled").checked;
        showLoading("Saving…");
        try {
          const r = await apiPost({
            action: "updateSettings",
            updates: { marquee_text: text, marquee_enabled: String(enabled) },
          });
          if (r.success) {
            settings.marquee_text = text;
            settings.marquee_enabled = String(enabled);
            showToast("Banner settings saved!");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }
      async function disableBannerQuick() {
        showLoading("Disabling banner…");
        try {
          const r = await apiPost({
            action: "updateSettings",
            updates: { marquee_enabled: "false" },
          });
          if (r.success) {
            settings.marquee_enabled = "false";
            var me = document.getElementById("set-marquee-enabled");
            if (me) me.checked = false;
            showToast("Banner disabled successfully!");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }
      async function savePassword() {
        const cur = document.getElementById("set-cur-pass").value;
        const nw = document.getElementById("set-new-pass").value;
        const cf = document.getElementById("set-confirm-pass").value;
        if (!cur) { showToast("Enter current password", "error"); return; }
        if (nw.length < 4) { showToast("Min 4 characters", "error"); return; }
        if (nw !== cf) { showToast("Passwords do not match", "error"); return; }
        showLoading("Verifying…");
        try {
          const { data: { user } } = await sb.auth.getUser();
          const email = user?.email;
          if (!email) { hideLoading(); showToast("Session error — please re-login", "error"); return; }
          const { error: verifyErr } = await sb.auth.signInWithPassword({ email, password: cur });
          if (verifyErr) { hideLoading(); showToast("Current password is wrong", "error"); return; }
          const { error: updateErr } = await sb.auth.updateUser({ password: nw });
          if (updateErr) {
            showToast("Error: " + updateErr.message, "error");
          } else {
            ["set-cur-pass", "set-new-pass", "set-confirm-pass"].forEach((x) => (document.getElementById(x).value = ""));
            showToast("Password updated!");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // MANAGE USERS
      // ════════════════════════════════════════════
      let _adminUsers = [];

      async function loadAdminUsers() {
        const res = await fetch(SUPABASE_URL + "/functions/v1/manage-users", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: "list" }),
        });
        const r = await res.json();
        if (!r.success) { document.getElementById("users-list").innerHTML = '<div style="color:var(--danger);font-size:13px">Failed to load users</div>'; return; }
        _adminUsers = r.users;
        const { data: { user: me } } = await sb.auth.getUser();
        const list = document.getElementById("users-list");
        if (!_adminUsers.length) { list.innerHTML = '<div style="color:var(--g400);font-size:13px">No users found</div>'; return; }
        list.innerHTML = _adminUsers.map((u) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--g50);border-radius:8px;border:1px solid var(--g100)">
            <div>
              <div style="font-size:14px;font-weight:500">${u.email}</div>
              <div style="font-size:11px;color:var(--g400)">Created ${new Date(u.created_at).toLocaleDateString()}</div>
            </div>
            ${u.id !== me?.id ? `<button onclick="deleteAdminUser('${u.id}','${u.email}')" style="background:none;border:none;cursor:pointer;color:var(--danger);padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">Delete</button>` : `<span style="font-size:11px;color:var(--g400);padding:4px 8px">You</span>`}
          </div>`).join("");
      }

      async function createAdminUser() {
        const email = document.getElementById("new-user-email").value.trim();
        const password = document.getElementById("new-user-pass").value;
        if (!email) { showToast("Email is required", "error"); return; }
        if (!password) { showToast("Password is required", "error"); return; }
        showLoading("Creating user…");
        try {
          const res = await fetch(SUPABASE_URL + "/functions/v1/manage-users", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_ANON_KEY },
            body: JSON.stringify({ action: "create", email, password }),
          });
          const r = await res.json();
          if (r.success) {
            document.getElementById("new-user-email").value = "";
            document.getElementById("new-user-pass").value = "";
            showToast("User created!");
            await loadAdminUsers();
          } else {
            showToast("Error: " + r.error, "error");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      async function deleteAdminUser(uid, email) {
        if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
        showLoading("Deleting user…");
        try {
          const res = await fetch(SUPABASE_URL + "/functions/v1/manage-users", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_ANON_KEY },
            body: JSON.stringify({ action: "delete", uid }),
          });
          const r = await res.json();
          if (r.success) {
            showToast("User deleted");
            await loadAdminUsers();
          } else {
            showToast("Error: " + r.error, "error");
          }
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // CONFIRM DELETE
      // ════════════════════════════════════════════
      function confirmDelete(type, id) {
        const msgs = {
          product: "This product will be permanently deleted.",
          cat: "This category and its sub-categories will be removed.",
          subcat: "This sub-category will be removed.",
          promo: "This promo code will be deleted.",
          delivery: "This delivery price will be permanently deleted.",
          order: "This order will be permanently deleted and cannot be recovered.",
        };
        document.getElementById("confirm-msg").textContent =
          msgs[type] || "This action cannot be undone.";
        document.getElementById("confirm-ok").onclick = async () => {
          closeConfirm();
          showLoading("Deleting…");
          try {
            let action;
            if (type === "product") action = "deleteProduct";
            else if (type === "cat") action = "deleteCategory";
            else if (type === "subcat") action = "deleteSubCategory";
            else if (type === "promo") action = "deletePromo";
            else if (type === "delivery") action = "deleteDeliveryPrice";
            else if (type === "order") action = "deleteOrder";
            const r = await apiPost({ action, id });
            if (r.success) {
              showToast(
                cap(type === "subcat" ? "sub-category" : type) + " deleted",
              );
              // Local mutation
              if (type === "product") {
                products = products.filter(p => p.id !== id);
                renderProducts();
                renderBundleList(document.getElementById("bundle-search")?.value || "");
                  } else if (type === "cat") {
                categories = categories.filter(c => c.id !== id);
                subCategories = subCategories.filter(s => !(s.categoryIds || []).includes(id));
                renderCats();
                  } else if (type === "subcat") {
                subCategories = subCategories.filter(s => s.id !== id);
                renderCats();
                  } else if (type === "promo") {
                promos = promos.filter(p => p.id !== id);
                renderPromos();
                  } else if (type === "delivery") {
                deliveryPrices = deliveryPrices.filter(d => d.id !== id);
                renderDelivery();
                  } else if (type === "order") {
                document.getElementById("order-detail-modal").classList.remove("open");
                await Promise.all([_fetchDashOrders(), _fetchOrdersPage()]);
                renderOrders();
              }
              updateDashboard();
            } else showToast("Error: " + (r.error || "Unknown"), "error");
          } catch (e) {
            showToast("Error: " + e.message, "error");
          }
          hideLoading();
        };
        document.getElementById("confirm-overlay").classList.add("open");
      }
      function closeConfirm() {
        document.getElementById("confirm-overlay").classList.remove("open");
      }

      // ════════════════════════════════════════════
      // MULTI-SELECT DELETE
      // ════════════════════════════════════════════
      const _sel = {
        product: new Set(), cat: new Set(), promo: new Set(),
        delivery: new Set(), order: new Set()
      };

      function _selToggle(type, id, checked) {
        if (checked) _sel[type].add(id);
        else _sel[type].delete(id);
        _selUpdateBar(type);
        const cb = document.querySelector(`input.row-cb[data-sel-type="${type}"][data-sel-id="${id}"]`);
        if (cb && cb.closest("tr")) cb.closest("tr").classList.toggle("row-selected", checked);
      }

      function _selAll(type, checked) {
        const cbs = document.querySelectorAll(`input.row-cb[data-sel-type="${type}"]`);
        cbs.forEach(cb => {
          cb.checked = checked;
          const id = cb.dataset.selId;
          if (checked) _sel[type].add(id);
          else _sel[type].delete(id);
          if (cb.closest("tr")) cb.closest("tr").classList.toggle("row-selected", checked);
        });
        _selUpdateBar(type);
      }

      function _selUpdateBar(type) {
        const bar = document.getElementById("sel-bar-" + type);
        if (!bar) return;
        const n = _sel[type].size;
        bar.classList.toggle("visible", n > 0);
        const label = document.getElementById("sel-count-" + type);
        if (label) label.textContent = n + " item" + (n !== 1 ? "s" : "") + " selected";
        const allCb = document.getElementById("selall-" + type);
        if (allCb) {
          const total = document.querySelectorAll(`input.row-cb[data-sel-type="${type}"]`).length;
          allCb.indeterminate = n > 0 && n < total;
          allCb.checked = total > 0 && n === total;
        }
      }

      function _selReset(type) {
        _sel[type].clear();
        const bar = document.getElementById("sel-bar-" + type);
        if (bar) bar.classList.remove("visible");
        const allCb = document.getElementById("selall-" + type);
        if (allCb) { allCb.checked = false; allCb.indeterminate = false; }
      }

      function _selClear(type) {
        document.querySelectorAll(`input.row-cb[data-sel-type="${type}"]`).forEach(cb => {
          cb.checked = false;
          if (cb.closest("tr")) cb.closest("tr").classList.remove("row-selected");
        });
        _selReset(type);
      }

      async function deleteSelected(type) {
        const ids = [..._sel[type]];
        if (!ids.length) return;
        const n = ids.length;
        const labels = { product: "product", cat: "category", promo: "promo code", delivery: "delivery price", order: "order" };
        const typeLabel = labels[type] || type;
        document.getElementById("confirm-msg").textContent =
          "Delete " + n + " selected " + typeLabel + (n !== 1 ? "s" : "") + "? This cannot be undone.";
        document.getElementById("confirm-ok").onclick = async () => {
          closeConfirm();
          showLoading("Deleting " + n + " items…");
          const actionMap = { product: "deleteProduct", cat: "deleteCategory", promo: "deletePromo", delivery: "deleteDeliveryPrice", order: "deleteOrder" };
          const action = actionMap[type];
          let failed = 0;
          const deletedIds = [];
          const deletePromises = ids.map(id => {
            return apiPost({ action, id })
              .then(r => {
                if (r.success) deletedIds.push(id);
                else failed++;
              })
              .catch(() => { failed++; });
          });
          await Promise.all(deletePromises);
          _selReset(type);
          const deletedSet = new Set(deletedIds);
          if (type === "product") {
            products = products.filter(p => !deletedSet.has(p.id));
            renderProducts();
            renderBundleList(document.getElementById("bundle-search")?.value || "");
          } else if (type === "cat") {
            categories = categories.filter(c => !deletedSet.has(c.id));
            subCategories = subCategories.filter(s => !(s.categoryIds || []).some(cid => deletedSet.has(cid)));
            renderCats();
          } else if (type === "promo") {
            promos = promos.filter(p => !deletedSet.has(p.id));
            renderPromos();
          } else if (type === "delivery") {
            deliveryPrices = deliveryPrices.filter(d => !deletedSet.has(d.id));
            renderDelivery();
          } else if (type === "order") {
            await Promise.all([_fetchDashOrders(), _fetchOrdersPage()]);
            renderOrders();
          }
          updateDashboard();
          hideLoading();
          if (failed) showToast(failed + " item(s) failed to delete", "error");
          else showToast(n + " item" + (n !== 1 ? "s" : "") + " deleted");
        };
        document.getElementById("confirm-overlay").classList.add("open");
      }

      // ════════════════════════════════════════════
      // MODALS & TOAST
      // ════════════════════════════════════════════
      function openModal(id) {
        document.getElementById(id).classList.add("open");
      }
      function closeModal(id) {
        document.getElementById(id).classList.remove("open");
      }
      document.querySelectorAll(".modal-overlay").forEach((o) => {
        o.addEventListener("click", (e) => {
          if (e.target === o) o.classList.remove("open");
        });
      });
      let toastTimer;
      /* ── Rich Text Editor helpers ── */
      function rteCmd(cmd, edId) {
        const ed = document.getElementById(edId || "pm-desc");
        ed.focus();
        document.execCommand(cmd, false, null);
      }

      // Auto-upload pasted images in RTE fields to Cloudinary instead of embedding base64
      async function _rteUploadPastedImage(file, editorEl) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", CLOUDINARY_PRESET);
        fd.append("folder", "bybens-nutritional-facts");
        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
          if (!res.ok) throw new Error();
          const data = await res.json();
          const img = document.createElement("img");
          img.src = data.secure_url;
          img.style.maxWidth = "100%";
          const sel = window.getSelection();
          if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            editorEl.appendChild(img);
          }
        } catch (e) {
          showToast("Image upload failed", "error");
        }
      }

      document.querySelectorAll(".rte-editor").forEach(function(ed) {
        ed.addEventListener("paste", function(e) {
          const items = (e.clipboardData || e.originalEvent.clipboardData).items;
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              _rteUploadPastedImage(item.getAsFile(), ed);
              return;
            }
          }
        });
      });

      function showToast(msg, type = "success") {
        const t = document.getElementById("toast");
        document.getElementById("toast-msg").textContent = msg;
        t.className = "";
        t.classList.add("show");
        if (type === "error") t.classList.add("error");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
      }
      // ════════════════════════════════════════════
      // DELIVERY PRICES
      // ════════════════════════════════════════════
      function filterDelivery(q = "") {
        deliveryPage = 1;
        _delFilter = q.toLowerCase();
        renderDelivery(_delFilter);
      }

      function renderDelivery(filter = "") {
        _selReset("delivery");
        const tbody = document.getElementById("delivery-tbody");
        const pag = document.getElementById("delivery-pag");
        const filtered = deliveryPrices.filter(
          (d) => !filter || d.wilaya.toLowerCase().includes(filter),
        );
        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>No delivery prices added yet</p></div></td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }
        const pageStart = (deliveryPage - 1) * _PAGE;
        const pageItems = filtered.slice(pageStart, pageStart + _PAGE);
        tbody.innerHTML = pageItems
          .map(
            (d, idx) => `<tr>
          <td class="cb-td"><input type="checkbox" class="row-cb" data-sel-type="delivery" data-sel-id="${d.id}" onchange="_selToggle('delivery','${d.id}',this.checked)"></td>
          <td style="color:var(--g400);font-size:12px">${pageStart + idx + 1}</td>
          <td><strong>${d.wilaya}</strong></td>
          <td>${Number(d.homePrice).toLocaleString()} DA</td>
          <td>${Number(d.officePrice).toLocaleString()} DA</td>
          <td><div class="action-group">
            <button class="act-btn act-edit" onclick="editDelivery('${d.id}')">Edit</button>
            <button class="act-btn act-delete" onclick="confirmDelete('delivery','${d.id}')">Delete</button>
          </div></td>
        </tr>`,
          )
          .join("");
        if (pag) pag.innerHTML = _pagCtrl(filtered.length, deliveryPage, "setDeliveryPage");
      }

      function openDeliveryModal(id = null) {
        editingDeliveryId = id;
        document.getElementById("delivery-modal-title").textContent = id
          ? "Edit Wilaya"
          : "Add Wilaya";
        if (id) {
          const d = deliveryPrices.find((x) => x.id === id);
          if (d) {
            document.getElementById("delivery-wilaya").value = d.wilaya;
            document.getElementById("delivery-home").value = d.homePrice;
            document.getElementById("delivery-office").value = d.officePrice;
          }
        } else {
          document.getElementById("delivery-wilaya").value = "";
          document.getElementById("delivery-home").value = "";
          document.getElementById("delivery-office").value = "";
        }
        openModal("delivery-modal");
      }

      function editDelivery(id) {
        openDeliveryModal(id);
      }

      async function saveDelivery() {
        const wilaya = document.getElementById("delivery-wilaya").value.trim();
        const homePrice = parseFloat(
          document.getElementById("delivery-home").value,
        );
        const officePrice = parseFloat(
          document.getElementById("delivery-office").value,
        );
        if (!wilaya) {
          showToast("Wilaya name required", "error");
          return;
        }
        if (isNaN(homePrice) || isNaN(officePrice)) {
          showToast("Both prices are required", "error");
          return;
        }
        const payload = {
          wilaya,
          homePrice,
          officePrice,
        };
        showLoading("Saving…");
        try {
          payload.action = editingDeliveryId
            ? "updateDeliveryPrice"
            : "addDeliveryPrice";
          if (editingDeliveryId) payload.id = editingDeliveryId;
          const r = await apiPost(payload);
          if (r.success) {
            showToast(
              editingDeliveryId ? "Delivery price updated!" : "Wilaya added!",
            );
            closeModal("delivery-modal");
            if (editingDeliveryId) {
              const idx = deliveryPrices.findIndex(d => d.id === editingDeliveryId);
              if (idx >= 0) deliveryPrices[idx] = { ...deliveryPrices[idx], wilaya, homePrice, officePrice };
            } else {
              deliveryPrices.push({ id: r.id || ("tmp_dp_" + Date.now()), wilaya, homePrice, officePrice });
            }
            renderDelivery();
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      function cap(s) {
        return s ? s[0].toUpperCase() + s.slice(1) : s;
      }

      function normalizePhone(p) {
        if (!p) return "";
        const digits = String(p).replace(/\D/g, "");
        return digits.slice(-9);
      }

      // ════════════════════════════════════════════
      // BUNDLE — single product select
      // ════════════════════════════════════════════
      let bundleSelectedId = null;

      function renderBundleList(filter = "") {
        const list = document.getElementById("bundle-product-list");
        if (!list) return;
        const q = filter.toLowerCase();
        const filtered = products.filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            (p.brand || "").toLowerCase().includes(q),
        );
        if (!filtered.length) {
          list.innerHTML = `<div style="text-align:center;color:var(--g400);padding:32px 0;font-size:13px;">${
            products.length
              ? "No products match your search."
              : "No products yet. Add some first."
          }</div>`;
          return;
        }
        list.innerHTML = filtered
          .map((p) => {
            const sel = bundleSelectedId === p.id;
            const _bundleFirstImg = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
            const imgHtml = _bundleFirstImg
              ? `<img src="${_bundleFirstImg}" alt="" />`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
            const safeName = p.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            return `<div class="bundle-item${sel ? " selected" : ""}" onclick="selectBundleItem('${p.id}','${safeName}')">
            <div class="bundle-item-thumb">${imgHtml}</div>
            <div class="bundle-item-info">
              <div class="bundle-item-name">${p.name}</div>
              <div class="bundle-item-brand">${p.brand || "No brand"}</div>
            </div>
            <div class="bundle-radio"></div>
          </div>`;
          })
          .join("");
      }

      function selectBundleItem(id, name) {
        bundleSelectedId = id;
        document.getElementById("bundle-selected-label").innerHTML =
          `Selected: <strong>${name}</strong>`;
        renderBundleList(document.getElementById("bundle-search")?.value || "");
      }

      function filterBundleProducts(q) {
        renderBundleList(q);
      }

      function clearBundle() {
        bundleSelectedId = null;
        document.getElementById("bundle-selected-label").textContent =
          "No product selected";
        renderBundleList(document.getElementById("bundle-search")?.value || "");
      }

      async function loadBundle() {
        try {
          const r = await apiGet("getBundle");
          if (r.success && r.bundleId) {
            bundleSelectedId = r.bundleId;
            const p = products.find((x) => x.id === r.bundleId);
            const lbl = document.getElementById("bundle-selected-label");
            if (lbl)
              lbl.innerHTML = p
                ? `Selected: <strong>${p.name}</strong>`
                : `Selected: <strong>${r.bundleId}</strong>`;
          }
          if (r.success) {
            const fields = {
              "bundle-title-en":       r.titleEn,
              "bundle-title-fr":       r.titleFr,
              "bundle-title-ar":       r.titleAr,
              "bundle-description-en": r.descriptionEn,
              "bundle-description-fr": r.descriptionFr,
              "bundle-description-ar": r.descriptionAr,
            };
            Object.entries(fields).forEach(([id, val]) => {
              const el = document.getElementById(id);
              if (el && val) el.value = val;
            });
          }
        } catch (e) {
          /* silent */
        }
        renderBundleList();
      }

      async function saveBundle() {
        showLoading("Saving bundle…");
        try {
          const g = (id) => (document.getElementById(id) || {}).value?.trim() || "";
          const r = await apiPost({
            action:        "saveBundle",
            bundleId:      bundleSelectedId || "",
            titleEn:       g("bundle-title-en"),
            titleFr:       g("bundle-title-fr"),
            titleAr:       g("bundle-title-ar"),
            descriptionEn: g("bundle-description-en"),
            descriptionFr: g("bundle-description-fr"),
            descriptionAr: g("bundle-description-ar"),
          });
          if (r.success) showToast("Bundle saved!");
          else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // ORDERS
      // ════════════════════════════════════════════
      let ordersFilter = "all";
      let ordersSearch = "";
      let ordersSort = "date-desc";

      let ordersSearchTimeout = null;
      function searchOrders(val) {
        ordersSearch = val.trim().toLowerCase();
        orderPage = 1;
        if (ordersSearchTimeout) clearTimeout(ordersSearchTimeout);
        ordersSearchTimeout = setTimeout(() => {
          _fetchOrdersPage().then(renderOrders).catch(() => renderOrders());
        }, 300);
      }

      function sortOrders(val) {
        ordersSort = val;
        orderPage = 1;
        _fetchOrdersPage().then(renderOrders).catch(() => renderOrders());
      }

      async function loadOrders() {
        showLoading("Refreshing orders…");
        try {
          await Promise.all([_fetchDashOrders(), _fetchOrdersPage()]);
          renderOrders();
          updateDashboard();
          showToast("Orders refreshed");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      function filterOrders(f, btn) {
        ordersFilter = f;
        orderPage = 1;
        document
          .querySelectorAll(".order-filter-btn")
          .forEach((b) => b.classList.remove("active"));
        if (btn) btn.classList.add("active");
        _fetchOrdersPage().then(renderOrders).catch(() => renderOrders());
      }

      function getOrderBadgeClass(status) {
        const map = {
          waiting: "badge-waiting",
          confirmed: "badge-confirmed",
          delivered: "badge-delivered",
          canceled: "badge-canceled",
        };
        return map[status] || "badge-waiting";
      }

      function renderOrders() {
        _selReset("order");
        const tbody = document.getElementById("orders-tbody");
        if (!tbody) return;

        // Filter button counts come from the full lightweight dataset
        const searchBase = ordersSearch
          ? _dashOrders.filter((o) => {
              const q = ordersSearch;
              return (
                `${o.firstName} ${o.lastName}`.toLowerCase().includes(q) ||
                (o.phone || "").toLowerCase().includes(q) ||
                (o.wilaya || "").toLowerCase().includes(q)
              );
            })
          : _dashOrders;

        document.querySelectorAll(".order-filter-btn").forEach((btn) => {
          const f = btn.dataset.filter;
          const countEl = btn.querySelector(".count");
          if (!countEl) return;
          countEl.textContent =
            f === "all"
              ? searchBase.length
              : searchBase.filter((o) => o.status === f).length;
        });

        if (!orders.length && ordersTotal === 0) {
          tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><p>${ordersSearch ? "No orders match your search" : "No orders"}</p></div></td></tr>`;
          const pag = document.getElementById("orders-pag");
          if (pag) pag.innerHTML = "";
          return;
        }

        tbody.innerHTML = orders
          .map((o) => {
            const name = `${o.firstName} ${o.lastName}`.trim() || "—";
            const shortId = o.id ? o.id.slice(-8) : "—";
            const itemCount = Array.isArray(o.items) ? o.items.length : 0;
            let date = "—";
            if (o.createdAt) {
              try { date = new Date(o.createdAt).toLocaleDateString("en-GB"); } catch (e) {}
            }
            const badgeClass = getOrderBadgeClass(o.status);
            const safeId = o.id.replace(/'/g, "\\'");
            return `<tr>
              <td class="cb-td"><input type="checkbox" class="row-cb" data-sel-type="order" data-sel-id="${o.id}" onchange="_selToggle('order','${o.id}',this.checked)"></td>
              <td><span style="font-size:12px;color:var(--g400);font-family:monospace">#${shortId}</span></td>
              <td><div class="prod-name-block"><div class="name">${name}</div></div></td>
              <td>${o.phone || "—"}</td>
              <td style="font-size:12px">${o.wilaya || "—"}</td>
              <td style="font-size:12px">${o.address || "—"}</td>
              <td style="text-align:center">${itemCount}</td>
              <td><strong>${Number(o.total).toLocaleString("fr-DZ")} DA</strong></td>
              <td><span style="font-size:11px;color:var(--g400);background:var(--g100);padding:2px 7px;border-radius:4px">${o.source || "—"}</span></td>
              <td style="font-size:12px;color:var(--g600)">${date}</td>
              <td><span class="badge ${badgeClass}">${cap(o.status)}</span></td>
              <td><div class="action-group"><button class="act-btn act-view" onclick="openOrderDetail('${safeId}')">View More</button><button class="act-btn act-delete" onclick="confirmDelete('order','${safeId}')">Delete</button></div></td>
            </tr>`;
          })
          .join("");
        const pag = document.getElementById("orders-pag");
        if (pag) pag.innerHTML = _pagCtrl(ordersTotal, orderPage, "setOrderPage");
      }

      function openOrderDetail(id) {
        const o = orders.find((x) => x.id === id);
        if (!o) return;
        const safeId = id.replace(/'/g, "\\'");
        const itemsHtml = (o.items || [])
          .map(
            (it) => `<tr>
            <td>${it.name || "—"}</td>
            <td>${it.flavor || "—"}</td>
            <td>${it.variant || "—"}</td>
            <td style="text-align:center">${it.qty || 1}</td>
            <td>${Number(it.unitPrice || 0).toLocaleString("fr-DZ")} DA</td>
            <td><strong>${Number(it.lineTotal || 0).toLocaleString("fr-DZ")} DA</strong></td>
          </tr>`,
          )
          .join("");

        const promoRow = o.promoCode
          ? `<div class="summary-row"><span>Promo (${o.promoCode})</span><span style="color:var(--green)">-${Number(o.promoDiscount || 0).toLocaleString("fr-DZ")} DA</span></div>`
          : "";

        document.getElementById("order-detail-body").innerHTML = `
          <div class="order-detail-section">
            <div class="order-detail-title">Customer Info</div>
            <div class="order-detail-grid">
              <div><span class="order-detail-label">Name</span><span>${o.firstName} ${o.lastName}</span></div>
              <div><span class="order-detail-label">Phone</span><span>${o.phone || "—"}</span></div>
              <div><span class="order-detail-label">Wilaya</span><span>${o.wilaya || "—"}</span></div>
              <div><span class="order-detail-label">Commune</span><span>${o.commune || "—"}</span></div>
              <div><span class="order-detail-label">Address</span><span>${o.address || "—"}</span></div>
              <div><span class="order-detail-label">Delivery Type</span><span>${o.deliveryType === "home" ? "🏠 Home Delivery" : "📦 Office Pickup"}</span></div>
              <div><span class="order-detail-label">Source</span><span>${o.source || "—"}</span></div>
            </div>
          </div>
          <div class="order-detail-section">
            <div class="order-detail-title">Ordered Items</div>
            <div class="table-wrap" style="margin-top:8px">
              <table>
                <thead><tr>
                  <th>Product</th><th>Flavor</th><th>Variant</th>
                  <th style="text-align:center">Qty</th><th>Unit Price</th><th>Line Total</th>
                </tr></thead>
                <tbody>${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:var(--g400)">No items</td></tr>'}</tbody>
              </table>
            </div>
          </div>
          <div class="order-detail-section">
            <div class="order-detail-title">Summary</div>
            <div class="order-detail-summary">
              <div class="summary-row"><span>Subtotal</span><span>${Number(o.subtotal || 0).toLocaleString("fr-DZ")} DA</span></div>
              ${promoRow}
              <div class="summary-row"><span>Delivery (${o.deliveryType === "home" ? "Home" : "Office"})</span><span>${Number(o.deliveryCost || 0).toLocaleString("fr-DZ")} DA</span></div>
              <div class="summary-row total-row"><span>Total</span><strong>${Number(o.total || 0).toLocaleString("fr-DZ")} DA</strong></div>
            </div>
          </div>
          <div class="order-detail-section">
            <div class="order-detail-title">Update Status</div>
            <div class="order-status-btns" id="order-status-btns-${safeId}">
              <button class="status-btn status-waiting${o.status==='waiting'?' active':''}" onclick="updateOrderStatus('${safeId}','waiting')">⏳ Waiting</button>
              <button class="status-btn status-confirmed${o.status==='confirmed'?' active':''}" onclick="updateOrderStatus('${safeId}','confirmed')">✅ Confirmed</button>
              <button class="status-btn status-delivered${o.status==='delivered'?' active':''}" onclick="updateOrderStatus('${safeId}','delivered')">📦 Delivered</button>
              <button class="status-btn status-canceled${o.status==='canceled'?' active':''}" onclick="updateOrderStatus('${safeId}','canceled')">✖ Canceled</button>
            </div>
          </div>
          <div class="order-detail-section" style="padding-top:0">
            <button class="act-btn act-delete" style="width:100%;justify-content:center;padding:9px" onclick="confirmDelete('order','${safeId}')">Delete Order</button>
          </div>`;

        document.getElementById("order-detail-id").textContent =
          `Order #${id.slice(-8)}`;
        document.getElementById("order-detail-modal").classList.add("open");
      }

      async function toggleProductVisibility(id, hidden) {
        showLoading(hidden ? "Making visible…" : "Hiding product…");
        try {
          const { error } = await sb.from("products").update({ hidden: !hidden }).eq("id", id);
          if (error) throw error;
          const p = products.find(x => x.id === id);
          if (p) p.hidden = !hidden;
          renderProducts(_prodFilter);
          showToast(hidden ? "Product is now visible on the store" : "Product hidden from the store");
        } catch(e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      async function updateOrderStatus(id, status) {
        showLoading("Updating status…");
        try {
          const r = await apiPost({ action: "updateOrderStatus", id, status });
          if (r.success) {
            // Update both caches optimistically
            const o = orders.find((x) => x.id === id);
            if (o) o.status = status;
            const d = _dashOrders.find((x) => x.id === id);
            if (d) d.status = status;
            // Update buttons in modal
            const safeId = id.replace(/'/g, "\\'");
            const container = document.getElementById(`order-status-btns-${safeId}`);
            if (container) {
              container.querySelectorAll(".status-btn").forEach((b) => {
                b.classList.remove("active");
                if (b.classList.contains(`status-${status}`)) b.classList.add("active");
              });
            }
            renderOrders();
            updateDashboard();
            showToast("Status updated to " + cap(status) + "!");
          } else showToast("Error: " + (r.error || "Unknown"), "error");
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      }

      // ════════════════════════════════════════════
      // BUSINESS PORTAL (POS, PREORDERS, EXPENSES, CUSTOMERS)
      // ════════════════════════════════════════════
      let posCart = [];
      let allSales = [];
      let allSaleItems = [];
      let allPreorders = [];
      let allPreorderItems = [];
      let allExpenses = [];
      let manualCustomers = [];
      let deletedCustomerPhones = [];
      let inventoryItems = [];
      let activeInventoryTab = "supplement";
      let inventorySpreadsheetMode = false;
      let inventorySortColumn = "id";
      let inventorySortDirection = "asc";
      let inventoryPage = 1;
      const inventoryPageSize = 20;
      let preorderPage = 1;
      const preorderPageSize = 20;
      let expensePage = 1;
      const expensePageSize = 20;
      let customerPage = 1;
      const customerPageSize = 20;

      async function refreshBusinessPortalData() {
        try {
          const salesP = sb.from("sales").select("*").order("date", { ascending: false }).then(r => r.data || []).catch(() => []);
          const saleItemsP = sb.from("sale_items").select("*").then(r => r.data || []).catch(() => []);
          const preP = sb.from("pre_orders").select("*").order("date", { ascending: false }).then(r => r.data || []).catch(() => []);
          const preItemsP = sb.from("pre_order_items").select("*").then(r => r.data || []).catch(() => []);
          const expP = sb.from("expenses").select("*").order("date", { ascending: false }).then(r => r.data || []).catch(() => []);
          const custP = sb.from("customers").select("*").order("name", { ascending: true })
            .then(r => {
              if (r.error) throw r.error;
              return r.data || [];
            })
            .catch(async () => {
              // Fallback: If "name" column is missing, query without ordering
              const res = await sb.from("customers").select("*");
              return res.data || [];
            });
          const delCustP = sb.from("deleted_customers").select("*").then(r => r.data || []).catch(() => []);
          const invP = sb.from("inventory_items").select("*").order("created_at", { ascending: false }).then(r => r.data || []).catch(() => []);

          const [sales, saleItems, pre, preItems, exp, cust, delCust, inv] = await Promise.all([
            salesP, saleItemsP, preP, preItemsP, expP, custP, delCustP, invP
          ]);

          allSales = sales;
          allSaleItems = saleItems;
          allPreorders = pre;
          allPreorderItems = preItems;
          allExpenses = exp;
          manualCustomers = cust;
          
          // Load inventory items with localStorage fallback
          let localInv = [];
          try {
            localInv = JSON.parse(localStorage.getItem("bb_inventory_items") || "[]");
          } catch(e){}
          const mergedInv = {};
          localInv.forEach(item => { if (item.id) mergedInv[item.id] = item; });
          inv.forEach(item => { if (item.id) mergedInv[item.id] = item; });
          inventoryItems = Object.values(mergedInv);
          
          // Sync any variant stocks linked to these items
          syncAllLinkedProductsStock();

          let localDeleted = [];
          try {
            localDeleted = JSON.parse(localStorage.getItem("bb_deleted_customers") || "[]");
          } catch(e){}
          deletedCustomerPhones = [
            ...new Set([
              ...delCust.map(x => String(x.phone || "").trim()),
              ...localDeleted.map(x => String(x || "").trim())
            ])
          ];

          // Compute business metrics for dashboard KPIs
          buildCustomersLedger();
          computeBusinessDashboard();
        } catch (e) {
          console.warn("Failed to fetch business portal tables:", e);
        }
      }

      function getExpenseCurrencyAndAmount(e) {
        if (e.currency === "EUR" || e.currency === "DZD") {
          return { currency: e.currency, amount: Number(e.amount) || 0 };
        }
        const desc = (e.description || "").trim();
        if (desc.startsWith("[EUR]")) {
          return { currency: "EUR", amount: Number(e.amount) || 0 };
        }
        if (desc.startsWith("[DZD]")) {
          return { currency: "DZD", amount: Number(e.amount) || 0 };
        }
        const cat = (e.category || "").trim().toLowerCase();
        if (cat.includes("(eur)")) {
          return { currency: "EUR", amount: Number(e.amount) || 0 };
        }
        return { currency: "DZD", amount: Number(e.amount) || 0 };
      }

      // ─── COMPLETE FINANCE MANAGER & PROFIT ENGINE ───
      let currentFinancialPeriod = "all"; // 'all', 'today', 'week', 'month'

      window.setFinancialPeriod = function(period, btnEl) {
        currentFinancialPeriod = period;
        if (btnEl) {
          const container = btnEl.parentElement;
          if (container) {
            container.querySelectorAll(".fin-period-btn").forEach(b => b.classList.remove("active"));
            btnEl.classList.add("active");
          }
        }
        computeBusinessDashboard();
      };

      function isDateInFinancialPeriod(dateStr) {
        if (currentFinancialPeriod === "all" || !dateStr) return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (currentFinancialPeriod === "today") {
          return d >= startOfToday;
        }
        if (currentFinancialPeriod === "week") {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return d >= sevenDaysAgo;
        }
        if (currentFinancialPeriod === "month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      }

      function getProductPricingAndCost(productId, variantName, fallbackPrice = 0) {
        const eurRate = parseFloat(settings.budget_rate) || 250;
        let retailPrice = Number(fallbackPrice) || 0;
        let unitCost = 0;
        let productName = "";
        let inv = null;

        const pIdStr = String(productId || "").toLowerCase().trim();
        const vNameStr = String(variantName || "").toLowerCase().trim();

        // 1. Direct SKU ID match in inventoryItems (if productId is already a SKU like SUP-8801)
        inv = inventoryItems.find(x => String(x.id || "").toLowerCase().trim() === pIdStr);

        // 2. Look up in products catalog to find variant & its linked SKU
        const prod = products.find(p => 
          String(p.id || "").toLowerCase().trim() === pIdStr || 
          String(p.name || "").toLowerCase().trim() === pIdStr
        );

        if (prod) {
          productName = `${prod.brand ? prod.brand + ' - ' : ''}${prod.name}`;
          if (prod.variants && prod.variants.length > 0) {
            const v = prod.variants.find(x => {
              const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
              return label === vNameStr || !vNameStr;
            }) || prod.variants[0];

            if (v) {
              if (Number(v.price)) retailPrice = Number(v.price);
              
              // IF VARIANT HAS LINKED SKU (v.sku), FIND IT IN INVENTORYITEMS!
              if (v.sku) {
                const linkedInv = inventoryItems.find(x => String(x.id || "").toLowerCase().trim() === String(v.sku).toLowerCase().trim());
                if (linkedInv) {
                  inv = linkedInv;
                }
              }

              if (!inv) {
                if (Number(v.cost)) unitCost = Number(v.cost);
                else if (Number(v.cost_eur)) unitCost = Number(v.cost_eur) * eurRate;
              }
            }
          }
        }

        // 3. Fallback search in inventoryItems by Name
        if (!inv && pIdStr) {
          inv = inventoryItems.find(x => String(x.name || "").toLowerCase().trim() === pIdStr);
        }
        if (!inv && pIdStr) {
          inv = inventoryItems.find(x => {
            const full = `${x.brand || ''} ${x.name || ''}`.toLowerCase().trim();
            return full.includes(pIdStr) || pIdStr.includes(full);
          });
        }

        // 4. Calculate landed unit cost & retail price from matched inventory item
        if (inv) {
          const rate = Number(inv.rate) || eurRate;
          const pEur = Number(inv.price_eur) || 0;
          const del = Number(inv.delivery_dzd) || 0;
          unitCost = (pEur * rate) + del;
          if (Number(inv.retail_dzd)) {
            retailPrice = Number(inv.retail_dzd);
          }
          productName = `${inv.brand ? inv.brand + ' - ' : ''}${inv.name}${inv.variant_spec ? ' (' + inv.variant_spec + ')' : ''}`;
        }

        if (!productName) productName = String(productId || "Unknown Item");
        if (!retailPrice && fallbackPrice) retailPrice = Number(fallbackPrice);

        // Fallback: If unit cost is still missing and retailPrice > 0
        if (!unitCost && retailPrice) {
          unitCost = retailPrice * 0.7;
        }

        return { productName, retailPrice, unitCost };
      }

      function computeBusinessDashboard() {
        const eurRate = parseFloat(settings.budget_rate) || 250;

        // 1. Compute filtered expenses total
        let totalExpDzd = 0;
        let totalExpEur = 0;
        allExpenses.forEach(e => {
          if (!isDateInFinancialPeriod(e.date)) return;
          const { currency, amount } = getExpenseCurrencyAndAmount(e);
          if (currency === "EUR") totalExpEur += amount;
          else totalExpDzd += amount;
        });
        const totalOpexDzd = totalExpDzd + (totalExpEur * eurRate);

        // Update budget labels
        const budgetEur = parseFloat(settings.budget_eur) || 0;
        const budgetDzd = parseFloat(settings.budget_dzd) || 0;
        const lblEur = document.getElementById("lbl-budget-eur");
        const lblDzd = document.getElementById("lbl-budget-dzd");
        if (lblEur) lblEur.textContent = budgetEur.toFixed(2) + " €";
        if (lblDzd) lblDzd.textContent = Math.round(budgetDzd).toLocaleString() + " DA";

        const expBadge = document.getElementById("total-expenses-badge");
        if (expBadge) expBadge.textContent = `Total: ${totalExpDzd.toLocaleString()} DA / ${totalExpEur.toFixed(2)} €`;

        // 2. Revenue, COGS, and Profitability Breakdown per product
        let grossRevenue = 0;
        let totalCOGS = 0;
        const productProfitabilityMap = {};

        const trackItemProfitability = (skuOrName, qty, itemRevenue, itemCogs) => {
          if (!skuOrName) return;
          const key = skuOrName;
          if (!productProfitabilityMap[key]) {
            productProfitabilityMap[key] = { name: skuOrName, qty: 0, revenue: 0, cogs: 0 };
          }
          productProfitabilityMap[key].qty += qty;
          productProfitabilityMap[key].revenue += itemRevenue;
          productProfitabilityMap[key].cogs += itemCogs;
        };

        // A. Process POS Sales
        allSales.forEach(s => {
          if (!isDateInFinancialPeriod(s.date)) return;

          const saleItems = allSaleItems.filter(x => x.sale_id === s.id);
          const netSaleRev = Number(s.total_amount) || 0;

          if (saleItems.length > 0) {
            let grossItemTotal = 0;
            const itemInfos = saleItems.map(item => {
              const qty = Number(item.qty) || 1;
              const fallbackP = Number(item.price) || (netSaleRev ? netSaleRev / saleItems.length : 0);
              const info = getProductPricingAndCost(item.product_id, item.variant, fallbackP);
              const undiscountedPrice = Number(item.price) || info.retailPrice || fallbackP;
              grossItemTotal += undiscountedPrice * qty;
              return { item, qty, undiscountedPrice, info };
            });

            // Discount factor accounts for POS discount / promo code
            const discountFactor = (grossItemTotal > 0 && netSaleRev > 0) ? (netSaleRev / grossItemTotal) : 1;

            itemInfos.forEach(({ item, qty, undiscountedPrice, info }) => {
              const itemRev = undiscountedPrice * qty * discountFactor;
              const itemCogs = info.unitCost * qty;

              grossRevenue += itemRev;
              totalCOGS += itemCogs;

              trackItemProfitability(info.productName, qty, itemRev, itemCogs);
            });
          } else {
            const saleCogs = netSaleRev * 0.7;
            grossRevenue += netSaleRev;
            totalCOGS += saleCogs;
            trackItemProfitability("POS Sale", 1, netSaleRev, saleCogs);
          }
        });

        // B. Process Online Orders (excluding mirrored POS sales & pre-orders to prevent double-counting)
        _dashOrders.forEach(o => {
          if (o.source === "POS Checkout" || (o.id && String(o.id).startsWith("pos-"))) return;
          if (o.source === "pre order" || o.source === "Pre-Order" || (o.id && String(o.id).startsWith("pre-"))) return;

          const rawDate = o.createdAt || o.created_at || o.date;
          if (!isDateInFinancialPeriod(rawDate)) return;

          const orderItems = o.items || [];
          const delCost = Number(o.delivery_cost || o.deliveryCost) || 0;
          const orderNetRev = Math.max(0, (Number(o.total || o.total_amount) || 0) - delCost);

          if (orderItems.length > 0) {
            let grossItemTotal = 0;
            const itemInfos = orderItems.map(item => {
              const qty = Number(item.qty) || 1;
              const fallbackP = Number(item.price) || 0;
              const info = getProductPricingAndCost(item.productId || item.id || item.name, item.variantName || item.variant, fallbackP);
              const undiscountedPrice = Number(item.price) || info.retailPrice || fallbackP;
              grossItemTotal += undiscountedPrice * qty;
              return { item, qty, undiscountedPrice, info };
            });

            // Discount factor accounts for promo code or order level discount
            const discountFactor = (grossItemTotal > 0 && orderNetRev > 0) ? (orderNetRev / grossItemTotal) : 1;

            itemInfos.forEach(({ item, qty, undiscountedPrice, info }) => {
              const itemRev = undiscountedPrice * qty * discountFactor;
              const itemCogs = info.unitCost * qty;

              grossRevenue += itemRev;
              totalCOGS += itemCogs;

              trackItemProfitability(info.productName || item.name || "Online Order Item", qty, itemRev, itemCogs);
            });
          } else {
            const orderCogs = orderNetRev * 0.7;
            grossRevenue += orderNetRev;
            totalCOGS += orderCogs;
            trackItemProfitability("Online Order", 1, orderNetRev, orderCogs);
          }
        });

        // C. Process Pre-Orders (Fulfilled)
        allPreorders.filter(p => p.status === "fulfilled").forEach(p => {
          if (!isDateInFinancialPeriod(p.date)) return;

          const preItems = allPreorderItems.filter(x => x.pre_order_id === p.id);
          const netPreRev = Number(p.total_amount) || 0;

          if (preItems.length > 0) {
            let grossItemTotal = 0;
            const itemInfos = preItems.map(item => {
              const qty = Number(item.qty) || 1;
              const info = getProductPricingAndCost(item.product_id || item.product_name, item.variant, 0);
              const undiscountedPrice = info.retailPrice || 0;
              grossItemTotal += undiscountedPrice * qty;
              return { item, qty, undiscountedPrice, info };
            });

            const discountFactor = (grossItemTotal > 0 && netPreRev > 0) ? (netPreRev / grossItemTotal) : 1;

            itemInfos.forEach(({ item, qty, undiscountedPrice, info }) => {
              const itemRev = undiscountedPrice * qty * discountFactor;
              const itemCogs = info.unitCost * qty;

              grossRevenue += itemRev;
              totalCOGS += itemCogs;

              trackItemProfitability(item.product_name || info.productName, qty, itemRev, itemCogs);
            });
          } else {
            const preCogs = netPreRev * 0.7;
            grossRevenue += netPreRev;
            totalCOGS += preCogs;
            trackItemProfitability("Pre-Order", 1, netPreRev, preCogs);
          }
        });

        // 3. Compute Gross & Net Profits & Margins
        const grossProfit = grossRevenue - totalCOGS;
        const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

        const netProfit = grossProfit - totalOpexDzd;
        const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

        // 4. Stock Valuation (Warehouse Asset Values)
        let stockTotalCostEur = 0;
        let stockTotalCostDzd = 0;
        let stockTotalRetailDzd = 0;
        inventoryItems.forEach(inv => {
          const stk = Number(inv.stock) || 0;
          if (stk > 0) {
            const rate = Number(inv.rate) || eurRate;
            const pEur = Number(inv.price_eur) || 0;
            const delDzd = Number(inv.delivery_dzd) || 0;
            const landedUnit = (pEur * rate) + delDzd;

            stockTotalCostEur += pEur * stk;
            stockTotalCostDzd += landedUnit * stk;
            stockTotalRetailDzd += (Number(inv.retail_dzd) || 0) * stk;
          }
        });

        // 5. Update KPI Cards UI
        const elRev = document.getElementById("stat-revenue-total");
        if (elRev) elRev.textContent = fmtRevenue(grossRevenue);

        const elCogs = document.getElementById("stat-cogs-total");
        if (elCogs) {
          const cogsEur = totalCOGS / eurRate;
          elCogs.textContent = `${Math.round(totalCOGS).toLocaleString()} DA (${cogsEur.toFixed(2)} €)`;
        }

        const elGrossProfit = document.getElementById("stat-gross-profit");
        const badgeGrossMargin = document.getElementById("badge-gross-margin");
        if (elGrossProfit) elGrossProfit.textContent = `${Math.round(grossProfit).toLocaleString()} DA`;
        if (badgeGrossMargin) {
          badgeGrossMargin.textContent = `${grossMarginPct.toFixed(1)}%`;
          badgeGrossMargin.className = `fin-badge ${grossProfit >= 0 ? 'positive' : 'negative'}`;
        }

        const elExpenses = document.getElementById("stat-total-expenses");
        if (elExpenses) {
          elExpenses.textContent = `${Math.round(totalOpexDzd).toLocaleString()} DA (${totalExpEur.toFixed(2)} €)`;
        }

        const elNetProfit = document.getElementById("stat-net-profit");
        const badgeNetMargin = document.getElementById("badge-net-margin");
        if (elNetProfit) {
          elNetProfit.textContent = `${Math.round(netProfit).toLocaleString()} DA`;
          elNetProfit.style.color = netProfit >= 0 ? "var(--green)" : "var(--red)";
        }
        if (badgeNetMargin) {
          badgeNetMargin.textContent = `${netMarginPct.toFixed(1)}%`;
          badgeNetMargin.className = `fin-badge ${netProfit >= 0 ? 'positive' : 'negative'}`;
        }

        const elStockVal = document.getElementById("stat-stock-valuation");
        if (elStockVal) {
          elStockVal.textContent = `${Math.round(stockTotalCostDzd).toLocaleString()} DA (${stockTotalCostEur.toFixed(2)} €)`;
        }

        // 6. Render Product Profitability Breakdown Table
        renderFinancialProfitabilityTable(productProfitabilityMap);

        renderLowStockAlerts();
      }

      function renderFinancialProfitabilityTable(profitabilityMap) {
        const tbody = document.getElementById("financial-profitability-tbody");
        if (!tbody) return;

        const items = Object.values(profitabilityMap);
        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--g400); padding:20px;">No sales recorded for this period.</td></tr>`;
          return;
        }

        // Sort by Gross Profit descending
        items.sort((a, b) => (b.revenue - b.cogs) - (a.revenue - a.cogs));

        tbody.innerHTML = items.slice(0, 10).map(item => {
          const profit = item.revenue - item.cogs;
          const marginPct = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
          const marginColor = profit >= 0 ? "var(--green)" : "var(--red)";

          return `
            <tr>
              <td style="font-weight:600; color:var(--black);">${item.name}</td>
              <td style="text-align:center; font-weight:700;">${item.qty}</td>
              <td style="text-align:right;">${Math.round(item.revenue).toLocaleString()} DA</td>
              <td style="text-align:right; color:var(--g600);">${Math.round(item.cogs).toLocaleString()} DA</td>
              <td style="text-align:right; font-weight:700; color:${marginColor};">${Math.round(profit).toLocaleString()} DA</td>
              <td style="text-align:center;">
                <span class="fin-badge ${profit >= 0 ? 'positive' : 'negative'}">${marginPct.toFixed(1)}%</span>
              </td>
            </tr>
          `;
        }).join("");
      }

      let lowStockViewAll = false;

      window.toggleLowStockViewAll = function() {
        lowStockViewAll = !lowStockViewAll;
        renderLowStockAlerts();
      };

      function renderLowStockAlerts() {
        const listEl = document.getElementById("low-stock-alerts-list");
        const btn = document.getElementById("low-stock-view-all-btn");
        if (!listEl) return;

        const lowStockThreshold = 2;
        const alerts = [];

        products.forEach(p => {
          if (p.status !== "active") return;

          // Check variants stock
          (p.variants || []).forEach((v, vi) => {
            const variantLabel = v.weight ? `${v.weight}${v.unit || ""}`.trim() : `V${vi+1}`;

            // Check flavor stocks if matrix exists
            if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
              Object.entries(v.flavorStock).forEach(([flavor, stock]) => {
                if (stock <= lowStockThreshold) {
                  alerts.push({
                    name: p.name,
                    brand: p.brand || "",
                    variant: variantLabel,
                    flavor: flavor,
                    stock: stock
                  });
                }
              });
            } else {
              // Otherwise check variant overall stock
              const stock = v.stock !== undefined ? v.stock : (p.stock || 0);
              if (stock <= lowStockThreshold) {
                alerts.push({
                  name: p.name,
                  brand: p.brand || "",
                  variant: variantLabel,
                  flavor: "",
                  stock: stock
                });
              }
            }
          });
        });

        if (alerts.length === 0) {
          listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--g400);font-size:13px">All products are well stocked!</div>`;
          if (btn) btn.style.display = "none";
          return;
        }

        // Sort alerts by lowest stock level first
        alerts.sort((a, b) => a.stock - b.stock);

        // Control Visibility toggle button
        if (btn) {
          if (alerts.length > 3) {
            btn.style.display = "inline-block";
            btn.textContent = lowStockViewAll ? "Show Less" : "View All";
          } else {
            btn.style.display = "none";
          }
        }

        const visibleAlerts = lowStockViewAll ? alerts : alerts.slice(0, 3);

        listEl.innerHTML = visibleAlerts.map(a => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid var(--g100);font-size:13px">
            <div>
              <strong>${a.brand ? a.brand + ' - ' : ''}${a.name}</strong>
              <div style="font-size:11px;color:var(--g500);margin-top:2px">
                Variant: <code>${a.variant}</code> ${a.flavor ? ' | Flavor: <code>' + a.flavor + '</code>' : ''}
              </div>
            </div>
            <div>
              <span class="badge" style="background:${a.stock === 0 ? 'var(--red)' : 'var(--orange)'};color:#fff;font-weight:bold;font-size:11px;padding:3px 8px;border-radius:4px">
                Stock: ${a.stock} unit${a.stock !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        `).join("");
      }

      // ─── POS SYSTEM ───
      window.loadPOS = function() {
        // Populate category dropdown
        const catSelect = document.getElementById("pos-cat-filter");
        if (catSelect) {
          catSelect.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
        }
        // Populate POS customers datalist for dynamic search
        const posCustDatalist = document.getElementById("pos-cust-list");
        if (posCustDatalist) {
          posCustDatalist.innerHTML = uniqueCustomers.map(c => `<option value="${c.name} (${c.phone})"></option>`).join("");
        }
        renderPOSProductsList();
        renderPOSCart();
      };

      window.filterPOSProducts = function() {
        renderPOSProductsList();
      };

      function renderPOSProductsList() {
        const grid = document.getElementById("pos-catalog-grid");
        if (!grid) return;

        const q = (document.getElementById("pos-search")?.value || "").toLowerCase().trim();
        const catFilter = document.getElementById("pos-cat-filter")?.value || "";

        let filtered = products.filter(p => p.status === "active");

        if (catFilter) {
          filtered = filtered.filter(p => p.categoryIds && p.categoryIds.includes(catFilter));
        }
        if (q) {
          filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)));
        }

        if (filtered.length === 0) {
          grid.innerHTML = `<div style="grid-column: 1/-1;text-align:center;color:var(--g400);padding:40px 0;font-size:13px">No products found</div>`;
          return;
        }

        grid.innerHTML = filtered.map(p => {
          // get display price and stock
          let priceStr = "—";
          if (p.variants && p.variants.length > 0) {
            priceStr = (Number(p.variants[0].price) || 0).toLocaleString() + " DA";
          }
          let stockVal = p.stock || 0;
          if (p.variants && p.variants.length > 0) {
            const hasSkuLinks = p.variants.some(v => v.sku);
            if (hasSkuLinks) {
              stockVal = p.variants.reduce((total, v) => {
                if (v.sku) {
                  const inv = inventoryItems.find(x => String(x.id || "").trim().toLowerCase() === String(v.sku).trim().toLowerCase());
                  return total + (inv ? (Number(inv.stock) || 0) : (Number(v.stock) || 0));
                }
                return total + (Number(v.stock) || 0);
              }, 0);
            }
          }

          return `
            <div class="pos-card" onclick="openPOSFlavorModal('${p.id}')">
              <div>
                <div class="pos-card-name">${p.brand ? '<strong>' + p.brand + '</strong> ' : ''}${p.name}</div>
                <div class="pos-card-price">${priceStr}</div>
              </div>
              <div class="pos-card-stock">Stock: ${stockVal}</div>
            </div>
          `;
        }).join("");
      }

      window.openPOSFlavorModal = function(prodId) {
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;

        document.getElementById("pos-modal-prod-id").value = prodId;

        const flavorGroup = document.getElementById("pos-modal-flavors-group");
        const flavorSelect = document.getElementById("pos-modal-flavor");
        const varGroup = document.getElementById("pos-modal-variants-group");
        const varSelect = document.getElementById("pos-modal-variant");
        const priceInput = document.getElementById("pos-modal-price");
        document.getElementById("pos-modal-qty").value = 1;

        // Flavors
        if (prod.flavors && prod.flavors.length > 0) {
          flavorGroup.style.display = "block";
          flavorSelect.innerHTML = prod.flavors.map(f => `<option value="${f.name || f}">${f.name || f}</option>`).join("");
        } else {
          flavorGroup.style.display = "none";
          flavorSelect.innerHTML = "";
        }

        // Variants
        if (prod.variants && prod.variants.length > 0) {
          varGroup.style.display = "block";
          varSelect.innerHTML = prod.variants.map((v, i) => {
            const label = v.weight ? `${v.weight}${v.unit || ""}`.trim() : `V${i+1}`;
            let vStock = v.stock;
            if (v.sku) {
              const inv = inventoryItems.find(x => String(x.id || "").trim().toLowerCase() === String(v.sku).trim().toLowerCase());
              if (inv) vStock = inv.stock;
            }
            return `<option value="${i}">${label} (${(Number(v.price)||0).toLocaleString()} DA) — Stock: ${vStock !== undefined ? vStock : 0}</option>`;
          }).join("");
          priceInput.value = prod.variants[0].price;
          
          varSelect.onchange = function() {
            const selectedV = prod.variants[parseInt(varSelect.value)];
            if (selectedV) priceInput.value = selectedV.price;
          };
        } else {
          varGroup.style.display = "none";
          varSelect.innerHTML = "";
          priceInput.value = 0;
        }

        document.getElementById("pos-flavor-modal").classList.add("open");
      };

      window.confirmAddCartItem = function() {
        const prodId = document.getElementById("pos-modal-prod-id").value;
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;

        const flavorGroup = document.getElementById("pos-modal-flavors-group");
        const flavor = flavorGroup.style.display !== "none" ? document.getElementById("pos-modal-flavor").value : "";
        
        const varGroup = document.getElementById("pos-modal-variants-group");
        const varIdx = varGroup.style.display !== "none" ? parseInt(document.getElementById("pos-modal-variant").value) : 0;
        const selectedVariant = prod.variants && prod.variants[varIdx] ? prod.variants[varIdx] : null;

        const qty = parseInt(document.getElementById("pos-modal-qty").value) || 1;
        const price = parseFloat(document.getElementById("pos-modal-price").value) || 0;

        const variantName = selectedVariant ? (selectedVariant.weight ? `${selectedVariant.weight}${selectedVariant.unit || ""}`.trim() : `Default`) : "";

        // Check stock availability
        let availableStock = prod.stock || 0;
        if (selectedVariant) {
          if (selectedVariant.sku) {
            const inv = inventoryItems.find(x => String(x.id || "").trim().toLowerCase() === String(selectedVariant.sku).trim().toLowerCase());
            if (inv) {
              availableStock = inv.stock;
            } else if (selectedVariant.stock !== undefined && selectedVariant.stock !== null) {
              availableStock = selectedVariant.stock;
            }
          } else if (selectedVariant.flavorStock && flavor && selectedVariant.flavorStock[flavor] !== undefined) {
            availableStock = selectedVariant.flavorStock[flavor];
          } else if (selectedVariant.stock !== undefined && selectedVariant.stock !== null) {
            availableStock = selectedVariant.stock;
          }
        }

        if (availableStock < qty) {
          showToast(`Insufficient stock! Only ${availableStock} units available.`, "error");
          return;
        }

        posCart.push({
          productId: prodId,
          name: prod.name,
          brand: prod.brand,
          flavor,
          variant: variantName,
          variantIndex: varIdx,
          qty,
          price
        });

        closeModal("pos-flavor-modal");
        renderPOSCart();
        showToast("Added to POS cart!");
      };

      function renderPOSCart() {
        const list = document.getElementById("pos-cart-items-list");
        if (!list) return;

        if (posCart.length === 0) {
          list.innerHTML = `<div style="text-align:center;color:var(--g400);padding:40px 0;font-size:13px">Cart is empty</div>`;
          updatePOSTotals();
          return;
        }

        list.innerHTML = posCart.map((item, index) => `
          <div class="pos-cart-item">
            <div class="pos-item-desc">
              <strong>${item.brand ? item.brand + ' - ' : ''}${item.name}</strong>
              <div class="pos-item-sub">${item.variant || ""}${item.flavor ? ' | ' + item.flavor : ""}</div>
            </div>
            <div class="pos-item-meta">
              <span class="pos-item-qty">x${item.qty}</span>
              <div style="font-weight:600">${(item.price * item.qty).toLocaleString()} DA</div>
            </div>
            <button class="pos-item-del" onclick="removePOSCartItem(${index})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `).join("");

        updatePOSTotals();
      }

      window.removePOSCartItem = function(index) {
        posCart.splice(index, 1);
        renderPOSCart();
      };

      window.updatePOSTotals = function() {
        const subtotal = posCart.reduce((s, item) => s + (item.price * item.qty), 0);
        const discount = parseFloat(document.getElementById("pos-discount").value) || 0;
        const total = Math.max(0, subtotal - discount);

        document.getElementById("pos-subtotal").textContent = subtotal.toLocaleString() + " DA";
        document.getElementById("pos-discount-val").textContent = discount.toLocaleString() + " DA";
        document.getElementById("pos-total").textContent = total.toLocaleString() + " DA";
      };

      window.submitPOSSale = async function() {
        if (posCart.length === 0) {
          showToast("Cart is empty!", "error");
          return;
        }

        showLoading("Recording sale...");
        try {
          const discount = parseFloat(document.getElementById("pos-discount").value) || 0;
          const custName = document.getElementById("pos-cust-name").value.trim();
          const custPhone = document.getElementById("pos-cust-phone").value.trim();

          const subtotal = posCart.reduce((s, item) => s + (item.price * item.qty), 0);
          const totalAmount = Math.max(0, subtotal - discount);

          const saleId = String(Date.now());

          // Insert Sales row
          const { error: saleErr } = await sb.from("sales").insert({
            id: saleId,
            date: new Date().toISOString(),
            total_amount: totalAmount,
            discount: discount,
            customer_name: custName || null,
            customer_phone: custPhone || null,
            operator: localStorage.getItem("bb_admin_name") || "Admin"
          });

          if (saleErr) throw saleErr;

          // Insert Sale items and decrement product stocks
          for (const item of posCart) {
            const itemId = String(Date.now()) + Math.random().toString(36).substr(2, 4);
            const { error: itemErr } = await sb.from("sale_items").insert({
              id: itemId,
              sale_id: saleId,
              product_id: item.productId,
              product_name: item.name,
              flavor: item.flavor || null,
              variant: item.variant || null,
              qty: item.qty,
              price: item.price
            });
            if (itemErr) throw itemErr;

            // Decrement stock in database
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
              const updatedVariants = JSON.parse(JSON.stringify(prod.variants));
              const selectedV = updatedVariants[item.variantIndex];
              if (selectedV) {
                if (selectedV.flavorStock && item.flavor && selectedV.flavorStock[item.flavor] !== undefined) {
                  selectedV.flavorStock[item.flavor] = Math.max(0, selectedV.flavorStock[item.flavor] - item.qty);
                  selectedV.stock = Object.values(selectedV.flavorStock).reduce((a, b) => a + b, 0);
                } else if (selectedV.stock !== undefined) {
                  selectedV.stock = Math.max(0, selectedV.stock - item.qty);
                }

                if (selectedV.sku) {
                  try {
                    const invItem = inventoryItems.find(x => x.id === selectedV.sku);
                    if (invItem) {
                      const newStock = Math.max(0, invItem.stock - item.qty);
                      invItem.stock = newStock;
                      await sb.from("inventory_items").update({ stock: newStock }).eq("id", selectedV.sku);
                      selectedV.stock = newStock;
                    }
                  } catch(e) { console.warn("Failed to deduct inventory stock:", e); }
                }
              }
              const totalStock = updatedVariants.reduce((a, b) => a + (Number(b.stock) || 0), 0);

              const { error: stockErr } = await sb.from("products").update({
                variants: updatedVariants,
                stock: totalStock
              }).eq("id", item.productId);

              if (stockErr) throw stockErr;
            }
          }

          // Insert corresponding entry into orders table so POS Checkout sales appear under Orders tab & metrics
          const nameParts = (custName || "POS Customer").trim().split(" ");
          const firstName = nameParts[0] || "POS";
          const lastName = nameParts.slice(1).join(" ") || "Customer";

          const orderId = `pos-${saleId}`;
          const orderItems = posCart.map(item => ({
            id: item.productId,
            name: item.name,
            flavor: item.flavor || "",
            variant: item.variant || "",
            qty: Number(item.qty) || 1,
            price: Number(item.price) || 0
          }));

          const { error: insertOrderErr } = await sb.from("orders").insert({
            id: orderId,
            source: "POS Checkout",
            first_name: firstName,
            last_name: lastName,
            phone: custPhone || "0000000000",
            address: "In-Store POS Purchase",
            wilaya: "In-Store",
            commune: "",
            delivery_type: "In-Store",
            delivery_cost: 0,
            items: orderItems,
            subtotal: subtotal,
            total: totalAmount,
            status: "delivered", // In-store POS sales are completed/delivered immediately
            created_at: new Date().toISOString()
          });

          if (insertOrderErr) {
            console.error("Error inserting POS order into orders table:", insertOrderErr);
          }

          // Reset cart
          posCart = [];
          document.getElementById("pos-cust-name").value = "";
          document.getElementById("pos-cust-phone").value = "";
          document.getElementById("pos-discount").value = "0";

          // Increment DZD budget
          const curDzd = parseFloat(settings.budget_dzd) || 0;
          const newDzd = curDzd + totalAmount;
          await sb.from("settings").upsert([
            { key: "budget_dzd", value: String(newDzd) }
          ], { onConflict: "key" });
          settings.budget_dzd = String(newDzd);

          showToast("Sale recorded successfully!");
          
          // Reload products list, orders page, and dashboards
          const dataRes = await apiGet("getInitialData");
          if (dataRes && dataRes.success) {
            products = dataRes.products;
          }
          await Promise.all([
            _fetchDashOrders(),
            _fetchOrdersPage(),
            refreshBusinessPortalData()
          ]);
          renderOrders();
          updateDashboard();
          renderPOSProductsList();
          renderPOSCart();
        } catch (e) {
          showToast("Failed to complete sale: " + e.message, "error");
        }
        hideLoading();
      };

      // ─── EXPENSES SYSTEM ───
      window.loadExpenses = async function() {
        await refreshBusinessPortalData();
        renderExpensesList();
      };

      window.setExpensePage = function(n) {
        expensePage = n;
        renderExpensesList();
      };

      function renderExpensesList() {
        const body = document.getElementById("expenses-table-body");
        if (!body) return;

        const pag = document.getElementById("expenses-pag");
        if (allExpenses.length === 0) {
          body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--g400);padding:24px">No expenses logged yet</td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }

        const totalItems = allExpenses.length;
        const totalPages = Math.ceil(totalItems / expensePageSize) || 1;
        expensePage = Math.max(1, Math.min(expensePage, totalPages));
        const pageItems = allExpenses.slice((expensePage - 1) * expensePageSize, expensePage * expensePageSize);

        if (pag) {
          pag.innerHTML = _pagCtrl(totalItems, expensePage, "setExpensePage", expensePageSize);
        }

        body.innerHTML = pageItems.map(e => {
          const { currency, amount } = getExpenseCurrencyAndAmount(e);
          const amountStr = currency === "EUR" ? `${amount.toFixed(2)} €` : `${amount.toLocaleString()} DA`;
          return `
            <tr>
              <td>${new Date(e.date).toLocaleDateString()}</td>
              <td><span class="badge" style="background:var(--g100);color:var(--g800)">${e.category}</span></td>
              <td>${e.description || "—"}</td>
              <td style="font-weight:700;color:var(--red)">${amountStr}</td>
              <td style="text-align:center">
                <button class="btn-text-danger" style="color:var(--red);font-weight:bold;font-size:14px;padding:2px 4px" onclick="deleteExpenseRow('${e.id}')" title="Delete">🗑</button>
              </td>
            </tr>
          `;
        }).join("");
      }

      window.saveExpense = async function() {
        const amountInp = document.getElementById("exp-amount");
        const categoryInp = document.getElementById("exp-category");
        const descInp = document.getElementById("exp-description");
        const currencyInp = document.getElementById("exp-currency");

        const amount = parseFloat(amountInp.value) || 0;
        const category = categoryInp.value;
        const description = descInp.value.trim();
        const currency = currencyInp ? currencyInp.value : "DZD";

        if (amount <= 0) {
          showToast("Please enter a valid amount!", "error");
          return;
        }

        showLoading("Saving expense...");
        try {
          const expenseId = String(Date.now());
          const payload = {
            id: expenseId,
            date: new Date().toISOString(),
            amount,
            category,
            description: description || null
          };

          const dbPayload = { ...payload };

          try {
            dbPayload.currency = currency;
            const { error } = await sb.from("expenses").insert(dbPayload);
            if (error) throw error;
          } catch(err) {
            console.warn("Failed to insert with currency column, trying fallback:", err);
            // Prepend currency marker to description for fallback parser
            const fallbackDesc = `[${currency}] ${description || ""}`.trim();
            const fallbackPayload = {
              ...payload,
              description: fallbackDesc
            };
            const { error: fbError } = await sb.from("expenses").insert(fallbackPayload);
            if (fbError) throw fbError;
            payload.description = fallbackDesc;
          }

          // Deduct from appropriate budget automatically!
          const curDzd = parseFloat(settings.budget_dzd) || 0;
          const curEur = parseFloat(settings.budget_eur) || 0;
          let newDzd = curDzd;
          let newEur = curEur;
          if (currency === "EUR") {
            newEur = Math.max(0, curEur - amount);
          } else {
            newDzd = Math.max(0, curDzd - amount);
          }

          // Persist budget deduction
          await sb.from("settings").upsert([
            { key: "budget_dzd", value: String(newDzd) },
            { key: "budget_eur", value: String(newEur) }
          ], { onConflict: "key" });

          settings.budget_dzd = String(newDzd);
          settings.budget_eur = String(newEur);

          // Update local cache
          allExpenses.unshift({ ...payload, currency });

          amountInp.value = "";
          descInp.value = "";
          descInp.value = "";

          showToast("Expense logged successfully!");
          await loadExpenses();
        } catch (e) {
          showToast("Failed to log expense: " + e.message, "error");
        }
        hideLoading();
      };

      window.deleteExpenseRow = async function(id) {
        if (!confirm("Are you sure you want to delete this expense record?")) return;
        showLoading("Deleting expense...");
        try {
          const exp = allExpenses.find(e => e.id === id);
          if (exp) {
            const { currency, amount } = getExpenseCurrencyAndAmount(exp);
            const curDzd = parseFloat(settings.budget_dzd) || 0;
            const curEur = parseFloat(settings.budget_eur) || 0;
            let newDzd = curDzd;
            let newEur = curEur;
            if (currency === "EUR") {
              newEur = curEur + amount;
            } else {
              newDzd = curDzd + amount;
            }
            await sb.from("settings").upsert([
              { key: "budget_dzd", value: String(newDzd) },
              { key: "budget_eur", value: String(newEur) }
            ], { onConflict: "key" });
            
            settings.budget_dzd = String(newDzd);
            settings.budget_eur = String(newEur);
          }

          const { error } = await sb.from("expenses").delete().eq("id", id);
          if (error) throw error;
          showToast("Expense record deleted!");
          await loadExpenses();
        } catch (e) {
          showToast("Error deleting: " + e.message, "error");
        }
        hideLoading();
      };

      // ─── PRE-ORDERS SYSTEM ───
      let preorderItemRows = [];

      window.loadPreorders = async function() {
        showLoading("Refreshing pre-orders...");
        await refreshBusinessPortalData();
        renderPreordersList();
        hideLoading();
        showToast("Pre-orders list refreshed!");
      };

      window.openPreorderModal = function(id = "") {
        const modal = document.getElementById("preorder-modal");
        const title = document.getElementById("preorder-modal-title");
        const nameInp = document.getElementById("preorder-cust-name");
        const phoneInp = document.getElementById("preorder-cust-phone");
        const notesInp = document.getElementById("preorder-notes");
        const statusGroup = document.getElementById("preorder-status-group");
        const statusSelect = document.getElementById("preorder-status");
        
        document.getElementById("preorder-id").value = id;
        const typeFilterEl = document.getElementById("preorder-type-filter");
        if (typeFilterEl) typeFilterEl.value = "all";
        preorderItemRows = [];
        const itemsContainer = document.getElementById("preorder-items-list");
        if (itemsContainer) itemsContainer.innerHTML = "";

        // Build preorder customers datalist (ONLY PRIVATE GROUP)
        const custDatalist = document.getElementById("preorder-cust-list");
        const custSearchInput = document.getElementById("preorder-cust-search");
        if (custDatalist) {
          const privateCusts = uniqueCustomers.filter(c => c.group === 'private');
          custDatalist.innerHTML = privateCusts.map(c => `<option value="${c.name} (${c.phone})"></option>`).join("");
        }
        if (custSearchInput) custSearchInput.value = "";

        if (!id) {
          title.textContent = "New Pre-Order";
          nameInp.value = "";
          phoneInp.value = "";
          notesInp.value = "";
          document.getElementById("preorder-delivery-price").value = "0";
          statusGroup.style.display = "none";
          addPreorderItemRow();
        } else {
          title.textContent = "Edit Pre-Order";
          const pre = allPreorders.find(x => x.id === id);
          if (pre) {
            nameInp.value = pre.customer_name;
            phoneInp.value = pre.customer_phone;
            
            const notesMeta = parsePreorderNotes(pre.notes);
            notesInp.value = notesMeta.notes;
            document.getElementById("preorder-delivery-price").value = notesMeta.deliveryPrice;

            statusGroup.style.display = "block";
            statusSelect.value = pre.status;

            // Load items
            const items = allPreorderItems.filter(x => x.pre_order_id === id);
            items.forEach(itm => {
              addPreorderItemRow({
                productId: itm.product_id,
                flavor: itm.flavor,
                variant: itm.variant,
                qty: itm.qty
              });
            });
          }
        }

        recalcPreorderTotals();
        modal.classList.add("open");
      };

      window.addPreorderItemRow = function(data = null) {
        const container = document.getElementById("preorder-items-list");
        if (!container) return;

        const rowId = String(Math.random().toString(36).substr(2, 6));
        const div = document.createElement("div");
        div.className = "preorder-item-row";
        div.id = `preorder-row-${rowId}`;
        div.style.display = "flex";
        div.style.gap = "8px";
        div.style.alignItems = "center";
        div.style.marginBottom = "8px";

        // Build datalist options from inventory items based on category filter
        const typeFilter = document.getElementById("preorder-type-filter")?.value || "all";
        const filteredInventory = inventoryItems.filter(item => {
          if (typeFilter === "all") return true;
          return item.type === typeFilter;
        });

        const datalistOptions = filteredInventory.map(item => {
          const specStr = [item.variant_spec, item.size].filter(Boolean).join(" - ");
          const textLabel = `[${item.id}] ${item.brand || ''} - ${item.name} ${specStr ? `(${specStr})` : ''}`.trim();
          return `<option value="${textLabel}" data-id="${item.id}"></option>`;
        }).join("");

        // Pre-fill name if editing
        let prefilledName = "";
        if (data) {
          const selectedItem = inventoryItems.find(x => x.id === data.productId);
          if (selectedItem) {
            const specStr = [selectedItem.variant_spec, selectedItem.size].filter(Boolean).join(" - ");
            prefilledName = `[${selectedItem.id}] ${selectedItem.brand || ''} - ${selectedItem.name} ${specStr ? `(${specStr})` : ''}`.trim();
          } else {
            prefilledName = data.productName || "";
          }
        }

        div.innerHTML = `
          <div style="display:flex;flex-direction:column;flex:3;gap:4px;min-width:180px">
            <input type="text" class="form-control pre-prod-search" list="inv-datalist-${rowId}" placeholder="Search inventory SKU or name…" value="${prefilledName}" oninput="resolvePreorderInventoryItem(this.value, '${rowId}')" style="font-size:12px" />
            <datalist id="inv-datalist-${rowId}">${datalistOptions}</datalist>
            <input type="hidden" class="pre-prod-id" value="${data ? data.productId : ''}" />
            <input type="hidden" class="pre-flavor-select" value="${data ? (data.flavor || '') : ''}" />
            <input type="hidden" class="pre-var-select" value="${data ? (data.variant || '') : ''}" />
          </div>
          <div style="width:70px">
            <input type="number" class="form-control pre-qty-input" style="width:100%" value="${data ? data.qty : '1'}" min="1" oninput="recalcPreorderTotals()" />
          </div>
          <button class="btn-text-danger" style="color:var(--red);font-weight:bold;padding:6px;font-size:18px" onclick="this.closest('.preorder-item-row').remove(); recalcPreorderTotals();">×</button>
        `;

        container.appendChild(div);
        recalcPreorderTotals();
      };

      window.updatePreorderItemsDatalists = function() {
        const typeFilter = document.getElementById("preorder-type-filter")?.value || "all";
        const rows = document.querySelectorAll(".preorder-item-row");
        
        const filteredInventory = inventoryItems.filter(item => {
          if (typeFilter === "all") return true;
          return item.type === typeFilter;
        });
        
        const datalistOptions = filteredInventory.map(item => {
          const specStr = [item.variant_spec, item.size].filter(Boolean).join(" - ");
          return `[${item.id}] ${item.brand || ''} - ${item.name} ${specStr ? `(${specStr})` : ''}`.trim();
        });
        
        rows.forEach(row => {
          const rowId = row.id.replace("preorder-row-", "");
          const datalist = document.getElementById(`inv-datalist-${rowId}`);
          if (datalist) {
            datalist.innerHTML = filteredInventory.map(item => {
              const specStr = [item.variant_spec, item.size].filter(Boolean).join(" - ");
              const textLabel = `[${item.id}] ${item.brand || ''} - ${item.name} ${specStr ? `(${specStr})` : ''}`.trim();
              return `<option value="${textLabel}" data-id="${item.id}"></option>`;
            }).join("");
          }
        });
      };

      window.updatePreorderRowOptions = function(rowId, selectedFlavor = "", selectedVariant = "") {
        const row = document.getElementById(`preorder-row-${rowId}`);
        if (!row) return;

        const prodId = row.querySelector(".pre-prod-id").value;
        const flavorSelect = row.querySelector(".pre-flavor-select");
        const varSelect = row.querySelector(".pre-var-select");

        if (!prodId) {
          flavorSelect.innerHTML = '<option value="">Flavor...</option>';
          varSelect.innerHTML = '<option value="">Variant...</option>';
          return;
        }

        const prod = products.find(p => p.id === prodId);
        if (!prod) return;

        // Flavors
        if (prod.flavors && prod.flavors.length > 0) {
          flavorSelect.innerHTML = '<option value="">Flavor...</option>' + prod.flavors.map(f => `<option value="${f.name || f}" ${selectedFlavor === (f.name || f) ? 'selected' : ''}>${f.name || f}</option>`).join("");
        } else {
          flavorSelect.innerHTML = '<option value="">—</option>';
        }

        // Variants
        if (prod.variants && prod.variants.length > 0) {
          varSelect.innerHTML = '<option value="">Variant...</option>' + prod.variants.map((v, i) => {
            const label = v.weight ? `${v.weight}${v.unit || ""}`.trim() : `V${i+1}`;
            return `<option value="${label}" ${selectedVariant === label ? 'selected' : ''}>${label}</option>`;
          }).join("");
        } else {
          varSelect.innerHTML = '<option value="">—</option>';
        }
      };

      window.savePreorder = async function() {
        const id = document.getElementById("preorder-id").value;
        const name = document.getElementById("preorder-cust-name").value.trim();
        const phone = document.getElementById("preorder-cust-phone").value.trim();
        const notes = document.getElementById("preorder-notes").value.trim();
        const deliveryPrice = parseInt(document.getElementById("preorder-delivery-price").value) || 0;
        const status = document.getElementById("preorder-status").value;

        if (!name || !phone) {
          showToast("Name and phone are required!", "error");
          return;
        }

        const itemRows = document.querySelectorAll("#preorder-items-list .preorder-item-row");
        if (itemRows.length === 0) {
          showToast("Add at least one item!", "error");
          return;
        }

        // Calculate total amount based on item prices in inventory
        let subtotalVal = 0;
        for (const row of itemRows) {
          const prodId = row.querySelector(".pre-prod-id").value; // SKU
          const qty = parseInt(row.querySelector(".pre-qty-input").value) || 1;

          if (prodId) {
            const invItem = inventoryItems.find(x => x.id === prodId);
            const price = invItem ? (Number(invItem.retail_dzd) || 0) : 0;
            subtotalVal += price * qty;
          }
        }
        const totalAmount = subtotalVal; // Delivery price excluded from total as requested

        const serializedNotes = serializePreorderNotes(notes, deliveryPrice);

        showLoading("Saving pre-order...");
        try {
          const preId = id || String(Date.now());
          
          if (!id) {
            // Insert new Pre-Order
            const { error: insertErr } = await sb.from("pre_orders").insert({
              id: preId,
              date: new Date().toISOString(),
              customer_name: name,
              customer_phone: phone,
              notes: serializedNotes || null,
              status: "pending",
              total_amount: totalAmount
            });
            if (insertErr) throw insertErr;
          } else {
            // Update Pre-Order
            const { error: updateErr } = await sb.from("pre_orders").update({
              customer_name: name,
              customer_phone: phone,
              notes: serializedNotes || null,
              status: status,
              total_amount: totalAmount
            }).eq("id", preId);
            if (updateErr) throw updateErr;

            // Delete existing pre-order items to overwrite
            await sb.from("pre_order_items").delete().eq("pre_order_id", preId);
          }

          // Insert pre-order items
          for (const row of itemRows) {
            const prodId = row.querySelector(".pre-prod-id").value; // SKU
            const flavor = row.querySelector(".pre-flavor-select").value;
            const variant = row.querySelector(".pre-var-select").value;
            const qty = parseInt(row.querySelector(".pre-qty-input").value) || 1;

            if (prodId) {
              const invItem = inventoryItems.find(x => x.id === prodId);
              const itemId = String(Date.now()) + Math.random().toString(36).substr(2, 4);

              // Use formatted inventory details
              const brandName = invItem ? `${invItem.brand || ''} - ${invItem.name}`.trim() : "Inventory Item";
              const specStr = invItem ? [invItem.variant_spec, invItem.size].filter(Boolean).join(" - ") : "";

              const { error: itemErr } = await sb.from("pre_order_items").insert({
                id: itemId,
                pre_order_id: preId,
                product_id: prodId,
                product_name: brandName,
                flavor: flavor || null,
                variant: specStr || variant || null,
                qty
              });
              if (itemErr) throw itemErr;
            }
          }

          await checkAndFulfillPreorder(preId, status);

          closeModal("preorder-modal");
          showToast("Pre-order saved successfully!");
          await loadPreorders();
        } catch (e) {
          showToast("Failed to save: " + e.message, "error");
        }
        hideLoading();
      };

      window.deletePreorderRow = async function(id) {
        if (!confirm("Are you sure you want to delete this pre-order?")) return;
        showLoading("Deleting pre-order...");
        try {
          const { error } = await sb.from("pre_orders").delete().eq("id", id);
          if (error) throw error;
          showToast("Pre-order deleted!");
          await loadPreorders();
        } catch (e) {
          showToast("Error deleting: " + e.message, "error");
        }
        hideLoading();
      };

      window.togglePreorderStatus = async function(id, currentStatus) {
        const nextStatus = currentStatus === "pending" ? "fulfilled" : (currentStatus === "fulfilled" ? "cancelled" : "pending");
        showLoading("Updating pre-order...");
        try {
          const { error } = await sb.from("pre_orders").update({ status: nextStatus }).eq("id", id);
          if (error) throw error;
          await checkAndFulfillPreorder(id, nextStatus);
          showToast(`Status updated to ${nextStatus}!`);
          await loadPreorders();
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      };

      window.setPreorderPage = function(n) {
        preorderPage = n;
        renderPreordersList();
      };

      function renderPreordersList() {
        const body = document.getElementById("preorders-table-body");
        if (!body) return;

        const filter = document.getElementById("preorder-status-filter")?.value || "";

        let filtered = allPreorders;
        if (filter) {
          filtered = filtered.filter(p => p.status === filter);
        }

        const pag = document.getElementById("preorders-pag");
        if (filtered.length === 0) {
          body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--g400);padding:24px">No pre-orders found</td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / preorderPageSize) || 1;
        preorderPage = Math.max(1, Math.min(preorderPage, totalPages));
        const pageItems = filtered.slice((preorderPage - 1) * preorderPageSize, preorderPage * preorderPageSize);

        if (pag) {
          pag.innerHTML = _pagCtrl(totalItems, preorderPage, "setPreorderPage", preorderPageSize);
        }

        body.innerHTML = pageItems.map(p => {
          const items = allPreorderItems.filter(x => x.pre_order_id === p.id);
          const itemsText = items.map(itm => `${itm.product_name} (${itm.variant || '—'}${itm.flavor ? ' | ' + itm.flavor : ''}) x${itm.qty}`).join("<br>");

          const subtotalFromItems = items.reduce((sum, itm) => {
            const invItem = inventoryItems.find(x => x.id === itm.product_id);
            const price = invItem ? (Number(invItem.retail_dzd) || 0) : 0;
            return sum + (price * (Number(itm.qty) || 1));
          }, 0);
          const displayTotal = subtotalFromItems > 0 ? subtotalFromItems : (Number(p.total_amount) || 0);

          return `
            <tr>
              <td>${new Date(p.date).toLocaleDateString()}</td>
              <td><strong>${p.customer_name}</strong></td>
              <td>${p.customer_phone}</td>
              <td style="font-size:12px;line-height:1.4">${itemsText}</td>
              <td>${displayTotal ? displayTotal.toLocaleString() + ' DA' : '—'}</td>
              <td><span class="badge badge-${p.status}">${cap(p.status)}</span></td>
              <td>
                <div class="action-group" style="position: relative;">
                  <button class="act-btn act-edit" onclick="openPreorderModal('${p.id}')">Edit</button>
                  
                  <!-- Download/Print Dropdown -->
                  <div class="inv-dropdown" style="display: inline-block; position: relative;">
                    <button class="act-btn act-download" onclick="togglePreorderDownloadDropdown('${p.id}', event)" style="background: var(--g50); color: var(--g700); border-color: var(--g300); display: flex; align-items: center; gap: 4px;">
                      📥 Print…
                    </button>
                    <div id="dl-drop-${p.id}" class="inv-dropdown-content" style="display: none; position: absolute; right: 0; bottom: 100%; background: #fff; border: 1px solid var(--g200); border-radius: 6px; box-shadow: var(--sh-md); z-index: 100; min-width: 170px; margin-bottom: 6px; text-align: left;">
                      <a href="#" onclick="printPreorder('${p.id}', 'customer', event)" style="display: block; padding: 10px 14px; font-size: 13px; color: var(--black); text-decoration: none; border-bottom: 1px solid var(--g100); font-family: var(--font-b); font-weight: 500;">📄 Customer Invoice</a>
                      <a href="#" onclick="printPreorder('${p.id}', 'delivery', event)" style="display: block; padding: 10px 14px; font-size: 13px; color: var(--black); text-decoration: none; font-family: var(--font-b); font-weight: 500;">📦 Courier Slip</a>
                    </div>
                  </div>
                  
                  <button class="act-btn act-delete" onclick="deletePreorderRow('${p.id}')">Delete</button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }

      // ─── CUSTOMERS LEDGER ───
      let uniqueCustomers = [];

      window.loadCustomers = async function() {
        await refreshBusinessPortalData();
        buildCustomersLedger();
        renderCustomersList();
      };

      function buildCustomersLedger() {
        const ledger = {};

        // Helper to check if a phone is in deleted list (using normalized phone matching)
        const isDeleted = (ph) => {
          const norm = normalizePhone(ph);
          if (!norm) return false;
          return deletedCustomerPhones.some(x => normalizePhone(x) === norm);
        };

        // 0. Seed ledger with manual customers
        manualCustomers.forEach(c => {
          if (!c.phone) return;
          const phone = c.phone.trim();
          if (isDeleted(phone)) return;
          
          const cName = c.name ? c.name.trim() : `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Customer";
          
          ledger[phone] = {
            name: cName,
            phone,
            group: c.group_type || 'public',
            ordersCount: 0,
            totalSpent: 0,
            history: []
          };
        });

        // 1. Process Online orders
        _dashOrders.forEach(o => {
          if (!o.phone) return;
          const phone = o.phone.trim();
          if (isDeleted(phone)) return;
          const name = `${o.firstName} ${o.lastName}`.trim() || "Customer";

          if (!ledger[phone]) {
            ledger[phone] = {
              name,
              phone,
              group: 'public',
              ordersCount: 0,
              totalSpent: 0,
              history: []
            };
          }
          ledger[phone].ordersCount++;
          ledger[phone].totalSpent += Number(o.total) || 0;
          ledger[phone].history.push({
            type: "Online Order",
            id: o.id,
            date: o.createdAt,
            total: o.total,
            status: o.status
          });
        });

        // 2. Process POS sales
        allSales.forEach(s => {
          if (!s.customer_phone) return;
          const phone = s.customer_phone.trim();
          if (isDeleted(phone)) return;
          const name = s.customer_name ? s.customer_name.trim() : "Walk-in Customer";

          if (!ledger[phone]) {
            ledger[phone] = {
              name,
              phone,
              group: 'public',
              ordersCount: 0,
              totalSpent: 0,
              history: []
            };
          }
          ledger[phone].ordersCount++;
          ledger[phone].totalSpent += Number(s.total_amount) || 0;
          ledger[phone].history.push({
            type: "In-Store POS Sale",
            id: s.id,
            date: s.date,
            total: s.total_amount,
            status: "completed"
          });
        });

        uniqueCustomers = Object.values(ledger);
      }

      let activeCustomerTab = 'public';

      window.toggleCustomerTab = function(group) {
        activeCustomerTab = group;
        customerPage = 1;
        document.querySelectorAll("#page-customers .cust-tab-bar .cust-tab-btn").forEach(btn => btn.classList.remove("active"));
        if (group === 'public') document.getElementById("cust-tab-public").classList.add("active");
        if (group === 'private') document.getElementById("cust-tab-private").classList.add("active");
        renderCustomersList();
      };

      window.setCustomerPage = function(n) {
        customerPage = n;
        renderCustomersList();
      };

      window.renderCustomersList = function() {
        const body = document.getElementById("customers-table-body");
        if (!body) return;

        const q = (document.getElementById("cust-search")?.value || "").toLowerCase().trim();
        
        // Filter by tab group
        let filtered = uniqueCustomers.filter(c => c.group === activeCustomerTab);

        if (q) {
          filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
        }

        const pag = document.getElementById("customers-pag");
        if (filtered.length === 0) {
          body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--g400);padding:24px">No customer ledger records found</td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / customerPageSize) || 1;
        customerPage = Math.max(1, Math.min(customerPage, totalPages));
        const pageItems = filtered.slice((customerPage - 1) * customerPageSize, customerPage * customerPageSize);

        if (pag) {
          pag.innerHTML = _pagCtrl(totalItems, customerPage, "setCustomerPage", customerPageSize);
        }

        // Search original index to support viewCustomerHistory logs correctly
        body.innerHTML = pageItems.map(c => {
          const originalIndex = uniqueCustomers.indexOf(c);
          return `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone}</td>
              <td><span class="badge badge-${c.group === 'private' ? 'waiting' : 'active'}">${cap(c.group)}</span></td>
              <td>${c.ordersCount}</td>
              <td style="font-weight:700;color:var(--green)">${c.totalSpent.toLocaleString()} DA</td>
              <td>
                <button class="act-btn act-view" onclick="viewCustomerHistory('${originalIndex}')">View Purchase Logs</button>
                <button class="act-btn act-delete" style="margin-left:5px" onclick="deleteCustomerProfile('${c.phone}')">Delete</button>
              </td>
            </tr>
          `;
        }).join("");
      };

      window.viewCustomerHistory = function(index) {
        const c = uniqueCustomers[parseInt(index)];
        if (!c) return;

        document.getElementById("cust-history-title").textContent = `${c.name} — Purchase History`;
        const body = document.getElementById("cust-history-body");

        body.innerHTML = `
          <div style="margin-bottom:15px; font-size:13px; color:var(--g600)">
            <strong>Phone:</strong> ${c.phone}<br>
            <strong>Total Records:</strong> ${c.ordersCount} transaction(s)<br>
            <strong>Total Value:</strong> ${c.totalSpent.toLocaleString()} DA
          </div>
          <table class="data-table" style="font-size:12px">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${c.history.map(h => `
                <tr>
                  <td>${new Date(h.date).toLocaleDateString()}</td>
                  <td>${h.type}</td>
                  <td><code>${h.id}</code></td>
                  <td><strong>${Number(h.total).toLocaleString()} DA</strong></td>
                  <td><span class="badge badge-${h.status === 'completed' ? 'active' : h.status}">${h.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        document.getElementById("cust-history-modal").classList.add("open");
      };

      window.openCustomerModal = function() {
        document.getElementById("cust-modal-name").value = "";
        document.getElementById("cust-modal-phone").value = "";
        openModal("customer-modal");
      };

      window.saveCustomer = async function() {
        const name = document.getElementById("cust-modal-name").value.trim();
        const phone = document.getElementById("cust-modal-phone").value.trim();
        const group = document.getElementById("cust-modal-group").value;

        if (!name || !phone) {
          showToast("Name and phone are required!", "error");
          return;
        }

        showLoading("Saving customer...");
        try {
          const custId = String(Date.now());
          const cleanPhone = phone.replace(/[^0-9a-zA-Z]/g, "") || custId;
          const parts = name.split(" ");
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "";

          // Populate payload with safe placeholders for ALL potential database columns
          const payload = {
            id: custId,
            name: name,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            email: `${cleanPhone}@bybens.placeholder`,
            password: `pb_${custId}`,
            address: "",
            group_type: group,
            created_at: new Date().toISOString()
          };

          let success = false;
          let lastError = null;

          // Attempt insert, dropping non-existent columns dynamically based on PostgREST error messages
          for (let attempt = 0; attempt < 6; attempt++) {
            const { error } = await sb.from("customers").insert(payload);
            if (!error) {
              success = true;
              break;
            }

            lastError = error;
            console.warn(`Customer insert attempt ${attempt} failed: ${error.message}`);

            // Detect missing column error (PostgREST schema cache error)
            const match = error.message.match(/Could not find the '([^']+)' column/);
            if (match && match[1]) {
              const missingCol = match[1];
              console.warn(`Removing missing column '${missingCol}' from insertion payload...`);
              delete payload[missingCol];
              continue;
            }

            // Detect duplicate key constraint
            if (error.code === "23505") {
              if (error.message.includes("phone")) {
                throw new Error("Phone number already registered!");
              } else if (error.message.includes("email")) {
                payload.email = `${cleanPhone}_${Math.random().toString(36).substr(2, 4)}@bybens.placeholder`;
                continue;
              }
            }

            // Any other database error cannot be self-healed, so break the loop
            break;
          }

          if (!success) {
            throw lastError || new Error("An unexpected error occurred while saving the customer.");
          }

          closeModal("customer-modal");
          showToast("Customer saved successfully!");
          await loadCustomers();
        } catch (e) {
          showToast("Failed to save: " + e.message, "error");
        }
        hideLoading();
      };

      window.fillPreorderCustomerInfo = function() {}; // kept for legacy compatibility

      window.fillPreorderCustomerInfoDynamic = function(val) {
        const privateCusts = uniqueCustomers.filter(c => c.group === 'private');
        const c = privateCusts.find(x => `${x.name} (${x.phone})` === val || x.phone === val || x.name === val);
        if (c) {
          document.getElementById("preorder-cust-name").value = c.name;
          document.getElementById("preorder-cust-phone").value = c.phone;
        }
      };

      async function checkAndFulfillPreorder(preId, nextStatus) {
        if (nextStatus !== "fulfilled") return;

        // Check if already fulfilled to prevent duplicates
        const alreadyFulfilled = _dashOrders.some(o => o.id === `pre-${preId}`);
        if (alreadyFulfilled) {
          console.log("Pre-order already recorded in orders.");
          return;
        }

        // Retrieve preorder details from Supabase if not loaded yet
        let pre = allPreorders.find(x => x.id === preId);
        if (!pre) {
          const { data } = await sb.from("pre_orders").select("*").eq("id", preId).single();
          pre = data;
        }
        if (!pre) return;

        // Retrieve preorder items
        let items = allPreorderItems.filter(x => x.pre_order_id === preId);
        if (items.length === 0) {
          const { data } = await sb.from("pre_order_items").select("*").eq("pre_order_id", preId);
          items = data || [];
        }
        if (items.length === 0) return;

        // 1. Create an order entry in orders table
        const notesMeta = parsePreorderNotes(pre.notes);
        const orderId = `pre-${preId}`;
        const nameParts = pre.customer_name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        const orderItems = [];
        let subtotalVal = 0;
        
        for (const item of items) {
          const invItem = inventoryItems.find(x => x.id === item.product_id);
          const price = invItem ? (Number(invItem.retail_dzd) || 0) : 0;
          
          orderItems.push({
            id: item.product_id, // SKU
            name: item.product_name,
            flavor: item.flavor || "",
            variant: item.variant || "",
            qty: Number(item.qty) || 1,
            price: price
          });
          subtotalVal += price * item.qty;
        }
        
        const deliveryCost = Number(notesMeta.deliveryPrice) || 0;
        const totalVal = subtotalVal; // Delivery price excluded from order total as requested

        const { error: orderErr } = await sb.from("orders").insert({
          id: orderId,
          source: "pre order",
          first_name: firstName,
          last_name: lastName,
          phone: pre.customer_phone,
          address: notesMeta.notes || "",
          wilaya: "",
          commune: "",
          delivery_type: "",
          delivery_cost: deliveryCost,
          items: orderItems,
          subtotal: subtotalVal,
          total: totalVal,
          status: "delivered", // Marked as delivered directly
          created_at: new Date().toISOString()
        });
        if (orderErr) throw orderErr;

        // 2. Deduct stock from inventory items directly
        const stockPromises = [];
        for (const item of items) {
          const invItem = inventoryItems.find(x => x.id === item.product_id);
          if (invItem) {
            const newStock = Math.max(0, invItem.stock - item.qty);
            invItem.stock = newStock;
            stockPromises.push(
              sb.from("inventory_items").update({ stock: newStock }).eq("id", invItem.id)
            );
          }
        }
        if (stockPromises.length > 0) {
          await Promise.all(stockPromises);
        }
        
        // Increment DZD budget
        const curDzd = parseFloat(settings.budget_dzd) || 0;
        const newDzd = curDzd + totalVal;
        await sb.from("settings").upsert([
          { key: "budget_dzd", value: String(newDzd) }
        ], { onConflict: "key" });
        settings.budget_dzd = String(newDzd);

        // 3. Delete from pre_orders table (cascades to delete pre_order_items too)
        const { error: delErr } = await sb.from("pre_orders").delete().eq("id", preId);
        if (delErr) {
          console.warn("Could not delete fulfilled preorder from table:", delErr.message);
        }

        // Mutate local state arrays immediately to remove from list without waiting for refresh
        allPreorders = allPreorders.filter(x => x.id !== preId);
        allPreorderItems = allPreorderItems.filter(x => x.pre_order_id !== preId);

        // Sync storefront variants link stocks
        await syncAllLinkedProductsStock();
      }

      window.resolvePreorderInventoryItem = function(val, rowId) {
        const row = document.getElementById(`preorder-row-${rowId}`);
        if (!row) return;

        const hiddenInput = row.querySelector(".pre-prod-id");
        if (!hiddenInput) return;

        // Resolve by matching the SKU in brackets [SKU]
        const match = val.match(/^\[([^\]]+)\]/);
        const sku = match ? match[1] : val;

        const matched = inventoryItems.find(x => x.id === sku || `[${x.id}]` === val.substring(0, x.id.length + 2));
        if (matched) {
          hiddenInput.value = matched.id; // SKU
        } else {
          hiddenInput.value = "";
        }
        recalcPreorderTotals();
      };

      window.deleteCustomerProfile = async function(phone) {
        if (!confirm(`Are you sure you want to delete customer with phone "${phone}"?`)) return;

        showLoading("Deleting customer...");
        try {
          // 1. If it's a manually created customer, try to delete all matching records from customers table
          const normDel = normalizePhone(phone);
          const matchingCusts = manualCustomers.filter(c => c.phone && normalizePhone(c.phone) === normDel);
          for (const c of matchingCusts) {
            const { error: delErr } = await sb.from("customers").delete().eq("id", c.id);
            if (delErr) {
              console.warn(`Could not delete customer ID ${c.id} from database table:`, delErr.message);
            }
          }

          // 2. Try to add to Supabase deleted_customers table
          const delId = String(Date.now());
          const { error: delCustErr } = await sb.from("deleted_customers").insert({
            id: delId,
            phone: phone.trim()
          });
          if (delCustErr) {
            console.warn("deleted_customers insert skipped or failed:", delCustErr.message);
          }

          // Mutate local manualCustomers array immediately to give instant UI response
          manualCustomers = manualCustomers.filter(c => !c.phone || normalizePhone(c.phone) !== normDel);

          // Save locally as secondary/primary cache
          let localDeleted = [];
          try {
            localDeleted = JSON.parse(localStorage.getItem("bb_deleted_customers") || "[]");
          } catch(e){}
          localDeleted.push(phone.trim());
          localStorage.setItem("bb_deleted_customers", JSON.stringify([...new Set(localDeleted)]));
          
          // Re-populate deletedCustomerPhones list locally immediately
          if (!deletedCustomerPhones.includes(phone.trim())) {
            deletedCustomerPhones.push(phone.trim());
          }

          showToast("Customer deleted successfully!");
          await loadCustomers();
        } catch (e) {
          // Fall back gracefully to local storage
          const normDel = normalizePhone(phone);
          manualCustomers = manualCustomers.filter(c => !c.phone || normalizePhone(c.phone) !== normDel);

          let localDeleted = [];
          try {
            localDeleted = JSON.parse(localStorage.getItem("bb_deleted_customers") || "[]");
          } catch(e){}
          localDeleted.push(phone.trim());
          localStorage.setItem("bb_deleted_customers", JSON.stringify([...new Set(localDeleted)]));

          if (!deletedCustomerPhones.includes(phone.trim())) {
            deletedCustomerPhones.push(phone.trim());
          }

          showToast("Customer deleted!");
          await loadCustomers();
        }
        hideLoading();
      };

      window.fillPOSCustomerInfo = function() {}; // kept for legacy compatibility

      window.fillPOSCustomerInfoDynamic = function(val) {
        const c = uniqueCustomers.find(x => `${x.name} (${x.phone})` === val || x.phone === val || x.name === val);
        if (c) {
          document.getElementById("pos-cust-name").value = c.name;
          document.getElementById("pos-cust-phone").value = c.phone;
        }
      };

      window.toggleDashboardTab = function(tab) {
        document.querySelectorAll("#page-dashboard .tab-bar .tab-btn").forEach(btn => btn.classList.remove("active"));
        if (tab === 'orders') {
          document.getElementById("dash-tab-orders").classList.add("active");
          document.getElementById("dash-sec-orders").style.display = "block";
          document.getElementById("dash-sec-stock").style.display = "none";
        } else {
          document.getElementById("dash-tab-stock").classList.add("active");
          document.getElementById("dash-sec-orders").style.display = "none";
          document.getElementById("dash-sec-stock").style.display = "block";
        }
      };

      window.filterCustomerSelect = function(query, selectId, groupFilter = '') {
        const select = document.getElementById(selectId);
        if (!select) return;

        const q = query.toLowerCase().trim();
        let pool = uniqueCustomers;
        if (groupFilter) {
          pool = pool.filter(c => c.group === groupFilter);
        }

        const filtered = pool.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));

        select.innerHTML = '<option value="">-- Select Existing Customer --</option>' + filtered.map(c => {
          const originalIndex = uniqueCustomers.indexOf(c);
          return `<option value="${originalIndex}">${c.name} (${c.phone})</option>`;
        }).join("");
      };

      // filterPreorderProductSelect is now handled via resolvePreorderProductByName + datalist

      // Trigger automatic business portal data reload when page initializes
      setTimeout(refreshBusinessPortalData, 1000);

      /* ─── DATABASE BACKUP & RESTORE ─────────────────── */
      window.exportDatabaseBackup = async function() {
        const btn = document.getElementById("btn-backup-export");
        const statusEl = document.getElementById("backup-status");
        const progressBar = document.getElementById("backup-progress-bar");
        const progressWrap = document.getElementById("backup-progress-wrap");

        btn.disabled = true;
        btn.innerHTML = `<span class="backup-spinner"></span> Exporting…`;
        statusEl.style.display = "none";
        if (progressWrap) { progressWrap.style.display = "block"; progressBar.style.width = "0%"; }

        const tables = [
          { key: "categories",      query: sb.from("categories").select("*")       },
          { key: "sub_categories",  query: sb.from("sub_categories").select("*")   },
          { key: "products",        query: sb.from("products").select("*")         },
          { key: "customers",       query: sb.from("customers").select("*")        },
          { key: "orders",          query: sb.from("orders").select("*")           },
          { key: "pre_orders",      query: sb.from("pre_orders").select("*")       },
          { key: "pre_order_items", query: sb.from("pre_order_items").select("*")  },
          { key: "sales",           query: sb.from("sales").select("*")            },
          { key: "sale_items",      query: sb.from("sale_items").select("*")       },
          { key: "expenses",        query: sb.from("expenses").select("*")         },
        ];

        try {
          const result = {};
          for (let i = 0; i < tables.length; i++) {
            const { key, query } = tables[i];
            const { data, error } = await query;
            if (error) throw new Error(`Table '${key}': ${error.message}`);
            result[key] = data || [];
            if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / tables.length) * 100)}%`;
          }

          const backup = {
            exported_at: new Date().toISOString(),
            version: "1.0",
            tables: result
          };

          const json = JSON.stringify(backup, null, 2);
          const dateStr = new Date().toISOString().slice(0, 10);
          const fileName = `bybensweb-backup-${dateStr}.json`;

          // Use data-URI — works in all browser contexts including sandboxed iframes
          const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(json);
          const a = document.createElement("a");
          a.href = dataUri;
          a.setAttribute("download", fileName);
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 200);

          const totalRows = Object.values(result).reduce((s, t) => s + t.length, 0);
          statusEl.innerHTML = `
            <div class="backup-status-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <div>
                <div style="color:#4ade80;font-weight:700">Backup downloaded successfully</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:2px">${fileName} · ${totalRows} rows · ${tables.length} tables</div>
              </div>
            </div>`;
          statusEl.style.display = "block";
          showToast("✓ Backup exported!");
        } catch (err) {
          statusEl.innerHTML = `
            <div class="backup-status-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <div>
                <div style="color:#f87171;font-weight:700">Export failed</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:2px">${err.message}</div>
              </div>
            </div>`;
          statusEl.style.display = "block";
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Backup Data (JSON)`;
          if (progressWrap) progressWrap.style.display = "none";
        }
      };

      window.restoreDatabaseBackup = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById("backup-status");
        const btn = document.getElementById("btn-backup-import");
        const progressBar = document.getElementById("backup-progress-bar");
        const progressWrap = document.getElementById("backup-progress-wrap");

        if (!confirm("⚠️ Restoring will UPSERT all rows from the backup into the database. Existing rows with matching IDs will be overwritten.\n\nContinue?")) {
          event.target.value = "";
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="backup-spinner"></span> Restoring…`;
        statusEl.style.display = "none";
        if (progressWrap) { progressWrap.style.display = "block"; progressBar.style.width = "0%"; }

        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          if (!backup.tables) throw new Error("Invalid backup file — missing 'tables' key.");

          const tableOrder = ["categories", "sub_categories", "products", "customers", "orders", "pre_orders", "pre_order_items", "sales", "sale_items", "expenses"];
          let totalUpserted = 0;

          for (let i = 0; i < tableOrder.length; i++) {
            const tableName = tableOrder[i];
            const rows = backup.tables[tableName];
            if (!rows || rows.length === 0) { if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / tableOrder.length) * 100)}%`; continue; }
            const { error } = await sb.from(tableName).upsert(rows, { onConflict: "id" });
            if (error) throw new Error(`Table '${tableName}': ${error.message}`);
            totalUpserted += rows.length;
            if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / tableOrder.length) * 100)}%`;
          }

          const backedAt = backup.exported_at ? new Date(backup.exported_at).toLocaleString() : "unknown date";
          statusEl.innerHTML = `
            <div class="backup-status-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <div>
                <div style="color:#4ade80;font-weight:700">Restore complete</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:2px">${totalUpserted} rows upserted · backup from ${backedAt}</div>
              </div>
            </div>`;
          statusEl.style.display = "block";
          showToast("✓ Database restored!");
          setTimeout(() => refreshBusinessPortalData(), 1500);
        } catch (err) {
          statusEl.innerHTML = `
            <div class="backup-status-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <div>
                <div style="color:#f87171;font-weight:700">Restore failed</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:2px">${err.message}</div>
              </div>
            </div>`;
          statusEl.style.display = "block";
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Restore Data (JSON)`;
          if (progressWrap) progressWrap.style.display = "none";
          event.target.value = "";
        }
      };

      /* ─── INVENTORY SEGMENT & DYNAMIC STOCK SYNCHRONIZATION ─── */

      window.syncAllLinkedProductsStock = async function() {
        let changedAny = false;
        const updatePromises = [];
        
        for (const p of products) {
          if (p.bundleItems && p.bundleItems.length > 0) continue; // skip bundles
          let pChanged = false;
          
          if (Array.isArray(p.variants)) {
            for (const v of p.variants) {
              if (v.sku) {
                const inv = inventoryItems.find(x => x.id === v.sku);
                if (inv && Number(v.stock) !== Number(inv.stock)) {
                  v.stock = Number(inv.stock);
                  pChanged = true;
                  changedAny = true;
                }
              }
            }
          }
          
          if (pChanged) {
            p.stock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
            const updatePromise = sb.from("products").update({
              variants: p.variants,
              stock: p.stock
            }).eq("id", p.id).then(({ error }) => {
              if (error) console.warn("Failed to sync stock to database for product " + p.id, error.message);
            }).catch(e => {
              console.warn("Failed to sync stock to database for product " + p.id, e);
            });
            updatePromises.push(updatePromise);
          }
        }
        
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        
        if (changedAny) {
          renderProducts(document.getElementById("prod-search")?.value || "");
          updateDashboard();
        }
      };

      window.getInventorySkuDisplayLabel = function(sku) {
        if (!sku) return "";
        const item = inventoryItems.find(x => String(x.id).toLowerCase() === String(sku).toLowerCase());
        if (!item) return sku;
        const specLabel = [item.variant_spec, item.size].filter(Boolean).join(" - ");
        return `[${item.id}] ${item.brand ? item.brand + ' - ' : ''}${item.name}${specLabel ? ' (' + specLabel + ')' : ''}`.trim();
      };

      window.ensureInventorySkuDatalist = function() {
        let datalist = document.getElementById("inventory-skus-datalist");
        if (!datalist) {
          datalist = document.createElement("datalist");
          datalist.id = "inventory-skus-datalist";
          document.body.appendChild(datalist);
        }
        
        const optionsHtml = [];
        inventoryItems.forEach(item => {
          const specLabel = [item.variant_spec, item.size].filter(Boolean).join(" - ");
          const brandName = item.brand ? `${item.brand} - ` : '';
          const fullLabel = `[${item.id}] ${brandName}${item.name}${specLabel ? ' (' + specLabel + ')' : ''}`.trim();
          const pureName = `${brandName}${item.name}${specLabel ? ' (' + specLabel + ')' : ''}`.trim();

          optionsHtml.push(`<option value="${fullLabel}">Stock: ${item.stock}</option>`);
          if (pureName && pureName !== fullLabel) {
            optionsHtml.push(`<option value="${pureName}">[SKU: ${item.id}] · Stock: ${item.stock}</option>`);
          }
          optionsHtml.push(`<option value="${item.id}">[${item.id}] ${fullLabel} · Stock: ${item.stock}</option>`);
        });

        datalist.innerHTML = optionsHtml.join("");
      };

      window.onVariantSkuSearchInput = function(inputEl) {
        const row = inputEl.closest(".variant-row");
        if (!row) return;
        const hiddenInput = row.querySelector(".variant-sku-select");
        const rawVal = inputEl.value.trim();
        const val = rawVal.toLowerCase();

        let matchedItem = null;
        if (val) {
          // 1. Bracket extraction e.g. [1001] or [SUP-8801]
          const bracketMatch = val.match(/\[(.*?)\]/);
          if (bracketMatch && bracketMatch[1]) {
            const candidate = bracketMatch[1].trim().toLowerCase();
            matchedItem = inventoryItems.find(x => String(x.id).toLowerCase() === candidate);
          }

          // 2. Direct exact SKU ID match
          if (!matchedItem) {
            matchedItem = inventoryItems.find(x => String(x.id).toLowerCase() === val);
          }

          // 3. Exact Product Name match
          if (!matchedItem) {
            matchedItem = inventoryItems.find(x => (x.name || "").toLowerCase() === val || `${x.brand || ''} ${x.name || ''}`.toLowerCase().trim() === val);
          }

          // 4. Product Name or Brand fuzzy match
          if (!matchedItem) {
            matchedItem = inventoryItems.find(x => {
              const brandName = `${x.brand || ''} ${x.name}`.toLowerCase();
              const fullLabel = `[${x.id}] ${x.brand || ''} ${x.name} ${x.variant_spec || ''} ${x.size || ''}`.toLowerCase();
              return brandName.includes(val) || fullLabel.includes(val) || val.includes((x.name || '').toLowerCase());
            });
          }
        }

        const matchedSku = matchedItem ? matchedItem.id : "";
        if (hiddenInput) hiddenInput.value = matchedSku;

        if (matchedItem) {
          row.dataset.varStock = String(matchedItem.stock);
          
          const specLabel = [matchedItem.variant_spec, matchedItem.size].filter(Boolean).join(" - ");
          const formattedLabel = `[${matchedItem.id}] ${matchedItem.brand ? matchedItem.brand + ' - ' : ''}${matchedItem.name}${specLabel ? ' (' + specLabel + ')' : ''}`;
          
          if (document.activeElement !== inputEl || rawVal.includes("[")) {
            if (inputEl.value !== formattedLabel) {
              inputEl.value = formattedLabel;
            }
          }
        } else {
          delete row.dataset.varStock;
        }
        refreshStockMatrix();
      };

      window.getInventorySkuOptions = function(selectedSku = "") {
        return inventoryItems.map(item => {
          const specLabel = [item.variant_spec, item.size].filter(Boolean).join(" - ");
          const label = `[${item.id}] ${item.brand} - ${item.name} ${specLabel ? '(' + specLabel + ')' : ''} (Stock: ${item.stock})`;
          return `<option value="${item.id}" ${item.id === selectedSku ? "selected" : ""}>${label}</option>`;
        }).join("");
      };

      window.onVariantSkuChange = function(selectEl) {
        const row = selectEl.closest(".variant-row");
        if (!row) return;
        const sku = selectEl.value;
        if (sku) {
          const inv = inventoryItems.find(x => x.id === sku);
          if (inv) {
            row.dataset.varStock = String(inv.stock);
          }
        }
        refreshStockMatrix();
      };

      window.loadInventoryPage = function() {
        // Compute next SKU number
        const prefix = activeInventoryTab === "supplement" ? "SUP-" : "SNA-";
        const prefixLower = prefix.toLowerCase();
        
        let maxNum = 8800; // starting number is 8801
        inventoryItems.forEach(item => {
          if (item.id && item.id.toLowerCase().startsWith(prefixLower)) {
            const numPart = parseInt(item.id.slice(4));
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        });
        
        const nextSku = prefix + (maxNum + 1);
        const skuInp = document.getElementById("add-inv-sku");
        if (skuInp) skuInp.value = nextSku;
        
        // Reset inputs
        ["add-inv-brand", "add-inv-name", "add-inv-variant", "add-inv-size", "add-inv-delivery", "add-inv-retail", "add-inv-qty"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = (id === "add-inv-delivery" || id === "add-inv-qty") ? "0" : "";
        });
        const pInp = document.getElementById("add-inv-price");
        if (pInp) pInp.value = "0.00";
        const rInp = document.getElementById("add-inv-rate");
        if (rInp) rInp.value = "250";
        
        const landedEl = document.getElementById("add-inv-landed-label");
        if (landedEl) landedEl.textContent = "0 DZD";
        const marginEl = document.getElementById("add-inv-margin-label");
        if (marginEl) marginEl.textContent = "0 DZD";
        
        // Populate brand options
        const filteredTabItems = inventoryItems.filter(item => item.type === activeInventoryTab);
        const uniqueBrands = [...new Set(filteredTabItems.map(item => item.brand).filter(Boolean))].sort();
        const brandFilter = document.getElementById("inv-brand-filter");
        if (brandFilter) {
          const currentVal = brandFilter.value;
          brandFilter.innerHTML = `<option value="">All Brands</option>` + uniqueBrands.map(b => `<option value="${b}">${b}</option>`).join("");
          if (uniqueBrands.includes(currentVal)) {
            brandFilter.value = currentVal;
          }
        }
        
        renderInventoryList();
      };

      window.toggleInventoryTab = function(type) {
        activeInventoryTab = type;
        document.querySelectorAll("#page-inventory .cust-tab-btn").forEach(btn => {
          btn.classList.toggle("active", btn.id === `inv-tab-${type}`);
        });
        const searchInp = document.getElementById("inv-search");
        if (searchInp) {
          searchInp.placeholder = `Search ${type === 'supplement' ? 'supplements' : 'snacks'}...`;
        }
        loadInventoryPage();
      };

      window.recalcQuickAddLanded = function() {
        const eur = parseFloat(document.getElementById("add-inv-price")?.value) || 0;
        const rate = parseFloat(document.getElementById("add-inv-rate")?.value) || 0;
        const delDzd = parseFloat(document.getElementById("add-inv-delivery")?.value) || 0;
        const retail = parseFloat(document.getElementById("add-inv-retail")?.value) || 0;
        
        const landed = (eur * rate) + delDzd;
        const margin = retail - landed;
        
        const landedLabel = document.getElementById("add-inv-landed-label");
        if (landedLabel) landedLabel.textContent = `${Math.round(landed).toLocaleString()} DZD`;
        
        const marginLabel = document.getElementById("add-inv-margin-label");
        if (marginLabel) {
          marginLabel.textContent = `${Math.round(margin).toLocaleString()} DZD`;
          marginLabel.style.color = margin >= 0 ? "var(--green)" : "var(--red)";
        }
      };

      window.renderInventoryList = function() {
        const tbody = document.getElementById("inventory-table-body");
        if (!tbody) return;
        
        const search = (document.getElementById("inv-search")?.value || "").toLowerCase().trim();
        const brand = document.getElementById("inv-brand-filter")?.value || "";
        const stockFilter = document.getElementById("inv-stock-filter")?.value || "all";
        
        const filtered = inventoryItems.filter(item => {
          if (item.type !== activeInventoryTab) return false;
          
          if (search) {
            const matchesText = (item.id || "").toLowerCase().includes(search) ||
                                (item.name || "").toLowerCase().includes(search) ||
                                (item.brand || "").toLowerCase().includes(search) ||
                                (item.variant_spec || "").toLowerCase().includes(search);
            if (!matchesText) return false;
          }
          
          if (brand && item.brand !== brand) return false;
          
          if (stockFilter === "low") {
            if (Number(item.stock) <= 0 || Number(item.stock) > 2) return false;
          } else if (stockFilter === "out") {
            if (Number(item.stock) > 0) return false;
          }
          
          return true;
        });
        
        // Sort items dynamically
        filtered.sort((a, b) => {
          let valA = a[inventorySortColumn];
          let valB = b[inventorySortColumn];
          
          if (inventorySortColumn === "margin") {
            valA = (Number(a.retail_dzd) || 0) - ((Number(a.price_eur) || 0) * (Number(a.rate) || 0) + (Number(a.delivery_dzd) || 0));
            valB = (Number(b.retail_dzd) || 0) - ((Number(b.price_eur) || 0) * (Number(b.rate) || 0) + (Number(b.delivery_dzd) || 0));
          } else {
            if (["price_eur", "stock", "stock_eu", "rate", "delivery_dzd", "retail_dzd"].includes(inventorySortColumn)) {
              valA = Number(valA) || 0;
              valB = Number(valB) || 0;
            } else {
              valA = String(valA || "").toLowerCase();
              valB = String(valB || "").toLowerCase();
            }
          }
          
          if (valA < valB) return inventorySortDirection === "asc" ? -1 : 1;
          if (valA > valB) return inventorySortDirection === "asc" ? 1 : -1;
          return 0;
        });
        
        const pag = document.getElementById("inventory-pag");
        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="13"><div class="empty-state" style="padding:40px;"><p>No products found.</p></div></td></tr>`;
          if (pag) pag.innerHTML = "";
          return;
        }

        // Pagination
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / inventoryPageSize) || 1;
        inventoryPage = Math.max(1, Math.min(inventoryPage, totalPages));
        const pageItems = filtered.slice((inventoryPage - 1) * inventoryPageSize, inventoryPage * inventoryPageSize);
        
        if (pag) {
          pag.innerHTML = _pagCtrl(totalItems, inventoryPage, "setInventoryPage", inventoryPageSize);
        }
        
        tbody.innerHTML = pageItems.map(item => {
          const landed = (Number(item.price_eur) * Number(item.rate)) + Number(item.delivery_dzd);
          const margin = Number(item.retail_dzd) - landed;
          const marginPct = Number(item.retail_dzd) > 0 ? ((margin / Number(item.retail_dzd)) * 100).toFixed(1) : "0.0";
          const marginColor = margin >= 0 ? "var(--green)" : "var(--red)";
          
          if (inventorySpreadsheetMode) {
            return `
              <tr style="vertical-align: middle;">
                <td><strong style="color:var(--black); font-size:12px;">${item.id}</strong></td>
                <td><input type="text" value="${item.brand || ''}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'brand')" /></td>
                <td><input type="text" value="${item.name || ''}" class="spreadsheet-input" style="font-weight: 500;" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'name')" /></td>
                <td><input type="text" value="${item.variant_spec || ''}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'variant_spec')" /></td>
                <td><input type="text" value="${item.size || ''}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'size')" /></td>
                <td>
                  <div style="display:flex; align-items:center; gap:2px;">
                    <span>€</span>
                    <input type="number" step="0.01" value="${item.price_eur}" class="spreadsheet-input" style="padding: 2px;" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'price_eur')" />
                  </div>
                </td>
                <td><input type="number" value="${item.rate}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'rate')" /></td>
                <td><input type="number" value="${item.delivery_dzd}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'delivery_dzd')" /></td>
                <td><span style="font-weight:600; color:var(--g600); font-size:12px;">${Math.round(landed).toLocaleString()} DZD</span></td>
                <td><input type="number" value="${item.retail_dzd}" class="spreadsheet-input" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'retail_dzd')" /></td>
                <td>
                  <span style="font-weight:700; color:${marginColor}; font-size:12px;">${Math.round(margin).toLocaleString()} DA</span>
                  <div style="font-size:10.5px; color:${marginColor}; font-weight:600;">${marginPct}%</div>
                </td>
                <td><input type="number" value="${item.stock_eu || 0}" class="spreadsheet-input" style="font-weight: 600; color: #2563eb;" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'stock_eu')" title="Stock in Europe" /></td>
                <td><input type="number" value="${item.stock || 0}" class="spreadsheet-input" style="font-weight: 700; color: #16a34a;" onchange="updateInventorySpreadsheetItem(this, '${item.id}', 'stock')" title="Stock in Algeria (Sellable)" /></td>
                <td style="text-align:center;">
                  <div style="display:flex; gap:2px; justify-content:center;">
                    <button class="btn-secondary" onclick="openTransferStockModal('${item.id}')" style="padding:2px 5px; font-size:10px; color:#2563eb; border-color:#bfdbfe;" title="Move stock from Europe to Algeria">🚚 Move</button>
                    <button class="btn-danger" onclick="deleteInventoryItem('${item.id}')" style="padding:2px 5px; font-size:10px;">Del</button>
                  </div>
                </td>
              </tr>`;
          } else {
            return `
              <tr style="vertical-align: middle;">
                <td><strong style="color:var(--black); font-size:12px;">${item.id}</strong></td>
                <td style="white-space:normal; word-break:break-word;">${item.brand || '-'}</td>
                <td style="font-weight: 500; white-space:normal; word-break:break-word; line-height:1.35;">${item.name}</td>
                <td style="white-space:normal; word-break:break-word;">${item.variant_spec || '-'}</td>
                <td>${item.size || '-'}</td>
                <td>€ ${Number(item.price_eur).toFixed(2)}</td>
                <td>${item.rate}</td>
                <td>${Number(item.delivery_dzd).toLocaleString()} DA</td>
                <td><span style="font-weight:600; color:var(--g600); font-size:12px;">${Math.round(landed).toLocaleString()} DA</span></td>
                <td>${Number(item.retail_dzd).toLocaleString()} DA</td>
                <td>
                  <span style="font-weight:700; color:${marginColor}; font-size:12px;">${Math.round(margin).toLocaleString()} DA</span>
                  <div style="font-size:10.5px; color:${marginColor}; font-weight:600;">${marginPct}%</div>
                </td>
                <td style="text-align:center;"><span class="stock-badge" style="background:#eff6ff; color:#1d4ed8;">EU: ${item.stock_eu || 0}</span></td>
                <td style="text-align:center;"><span class="stock-badge" style="${Number(item.stock) > 0 ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">DZ: ${item.stock || 0}</span></td>
                <td style="text-align:center;">
                  <div style="display:flex; gap:3px; justify-content:center; align-items:center; flex-wrap:nowrap; white-space:nowrap;">
                    <button class="btn-secondary" onclick="openTransferStockModal('${item.id}')" style="padding:3px 6px; font-size:10.5px; height:auto; color:#2563eb; border-color:#bfdbfe; background:#eff6ff; flex-shrink:0;" title="Move stock from Europe to Algeria">🚚 Move</button>
                    <button class="btn-primary" onclick="openEditInventoryModal('${item.id}')" style="padding:3px 6px; font-size:10.5px; height:auto; flex-shrink:0;">Edit</button>
                    <button class="btn-danger" onclick="deleteInventoryItem('${item.id}')" style="padding:3px 6px; font-size:10.5px; height:auto; flex-shrink:0;">Del</button>
                  </div>
                </td>
              </tr>`;
          }
        }).join("");

        // Render mobile cards
        const cardsContainer = document.getElementById("inventory-mobile-cards");
        if (cardsContainer) {
          if (!filtered.length) {
            cardsContainer.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;"><p>No products found.</p></div>`;
          } else {
            cardsContainer.innerHTML = pageItems.map(item => {
              const landed = (Number(item.price_eur) * Number(item.rate)) + Number(item.delivery_dzd);
              const margin = Number(item.retail_dzd) - landed;
              const marginPct = Number(item.retail_dzd) > 0 ? ((margin / Number(item.retail_dzd)) * 100).toFixed(1) : "0.0";
              const marginColor = margin >= 0 ? "#16a34a" : "#dc2626";
              const euStockVal = Number(item.stock_eu) || 0;
              const dzStockVal = Number(item.stock) || 0;

              const specStr = [item.variant_spec, item.size].filter(Boolean).join(" - ");

              return `
                <div class="inv-mobile-card" style="background:#fff; border:1px solid var(--g200); border-radius:12px; padding:14px; box-shadow:var(--sh-sm); display:flex; flex-direction:column; gap:10px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:6px; align-items:center;">
                      <span class="badge" style="background:var(--g100); color:var(--g800); font-weight:700;">SKU: ${item.id}</span>
                      ${item.brand ? `<span class="badge" style="background:var(--red-light); color:var(--red); font-weight:600;">${item.brand}</span>` : ''}
                    </div>
                  </div>
                  <div>
                    <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--black); line-height:1.3;">${item.name}</h4>
                    ${specStr ? `<div style="font-size:12px; color:var(--g500); margin-top:2px;">${specStr}</div>` : ''}
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:700; text-align:center; padding:6px;">Europe Stock: ${euStockVal}</span>
                    <button class="btn-secondary" onclick="openTransferStockModal('${item.id}')" style="padding:4px 8px; font-size:11px; height:auto; color:#2563eb; border-color:#bfdbfe; background:#eff6ff; justify-content:center;">🚚 Move EU → DZ</button>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; background:var(--g50); padding:10px; border-radius:8px; border:1px solid var(--g100); text-align:center;">
                    <div>
                      <span style="font-size:10px; color:var(--g400); text-transform:uppercase; font-weight:700;">Retail</span><br>
                      <strong style="font-size:13px; color:var(--black);">${Number(item.retail_dzd).toLocaleString()} DA</strong>
                    </div>
                    <div>
                      <span style="font-size:10px; color:var(--g400); text-transform:uppercase; font-weight:700;">Landed</span><br>
                      <strong style="font-size:13px; color:var(--g600);">${Math.round(landed).toLocaleString()} DA</strong>
                    </div>
                    <div>
                      <span style="font-size:10px; color:var(--g400); text-transform:uppercase; font-weight:700;">Margin</span><br>
                      <strong style="font-size:13px; color:${marginColor};">${Math.round(margin).toLocaleString()} DA (${marginPct}%)</strong>
                    </div>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:2px;">
                    <button class="btn-primary" onclick="openEditInventoryModal('${item.id}')" style="width:100%; justify-content:center; min-height:40px; font-size:13px;">✏ Edit</button>
                    <button class="btn-danger" onclick="deleteInventoryItem('${item.id}')" style="width:100%; justify-content:center; min-height:40px; font-size:13px;">🗑 Delete</button>
                  </div>
                </div>
              `;
            }).join("");
          }
        }
      };

      window.openTransferStockModal = function(sku) {
        const item = inventoryItems.find(x => String(x.id).toLowerCase() === String(sku).toLowerCase());
        if (!item) return;
        const currentEu = Number(item.stock_eu) || 0;
        if (currentEu <= 0) {
          showToast(`No Europe stock available for [${sku}]! Add Europe stock first in Edit mode.`, "error");
          return;
        }
        const qtyStr = prompt(`Move stock for [${sku}] ${item.brand ? item.brand + ' - ' : ''}${item.name}:\n\nEnter number of units received in Algeria from Europe (Available in Europe: ${currentEu}):`, String(currentEu));
        if (qtyStr === null) return;
        const qtyToMove = parseInt(qtyStr);
        if (isNaN(qtyToMove) || qtyToMove <= 0) return;
        
        if (qtyToMove > currentEu) {
          showToast(`Cannot move ${qtyToMove} units. Only ${currentEu} units available in Europe stock.`, "error");
          return;
        }

        window.transferStockEuropeToAlgeria(sku, qtyToMove);
      };

      window.transferStockEuropeToAlgeria = async function(sku, qtyToMove) {
        const item = inventoryItems.find(x => String(x.id).toLowerCase() === String(sku).toLowerCase());
        if (!item) return;

        const currentEu = Number(item.stock_eu) || 0;
        const currentDz = Number(item.stock) || 0;

        const newEu = Math.max(0, currentEu - qtyToMove);
        const newDz = currentDz + qtyToMove;

        showLoading("Moving stock to Algeria...");
        try {
          const payload = { stock_eu: newEu, stock: newDz };
          try {
            await sb.from("inventory_items").update(payload).eq("id", sku);
          } catch(e) {}

          item.stock_eu = newEu;
          item.stock = newDz;
          localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));

          await syncAllLinkedProductsStock();
          renderInventoryList();
          showToast(`Successfully moved ${qtyToMove} unit(s) of [${sku}] to Algeria! Available for sale.`);
        } catch (e) {
          showToast("Failed to move stock: " + e.message, "error");
        }
        hideLoading();
      };

      window.addInventoryItem = async function() {
        const id = document.getElementById("add-inv-sku")?.value.trim();
        const brand = document.getElementById("add-inv-brand")?.value.trim();
        const name = document.getElementById("add-inv-name")?.value.trim();
        const variant = document.getElementById("add-inv-variant")?.value.trim();
        const size = document.getElementById("add-inv-size")?.value.trim();
        const eur = parseFloat(document.getElementById("add-inv-price")?.value) || 0;
        const rate = parseFloat(document.getElementById("add-inv-rate")?.value) || 0;
        const delDzd = parseFloat(document.getElementById("add-inv-delivery")?.value) || 0;
        const retail = parseFloat(document.getElementById("add-inv-retail")?.value) || 0;
        const stock_eu = parseInt(document.getElementById("add-inv-qty-eu")?.value) || 0;
        const stock = parseInt(document.getElementById("add-inv-qty-dz")?.value) || 0;
        
        if (!brand || !name) {
          showToast("Brand and Product Name required", "error");
          return;
        }
        
        const payload = {
          id,
          type: activeInventoryTab,
          brand,
          name,
          variant_spec: variant || null,
          size: size || null,
          price_eur: eur,
          rate,
          delivery_dzd: delDzd,
          retail_dzd: retail,
          stock_eu,
          stock
        };
        
        showLoading("Adding inventory item…");
        
        try {
          const { error } = await sb.from("inventory_items").insert(payload);
          if (error) throw error;
        } catch(e) {
          console.warn("Failed to insert to Supabase, fallback to localStorage:", e);
        }
        
        // Local Cache mutate
        const idx = inventoryItems.findIndex(x => x.id === id);
        if (idx >= 0) inventoryItems[idx] = payload;
        else inventoryItems.push(payload);
        localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
        
        showToast("Inventory item added successfully!");
        
        // Sync any product variants that are linked to this SKU
        await syncAllLinkedProductsStock();
        
        hideLoading();
        loadInventoryPage();
      };

      window.deleteInventoryItem = async function(id) {
        if (!confirm(`Are you sure you want to delete item [${id}]?`)) return;
        
        showLoading("Deleting item…");
        
        try {
          const { error } = await sb.from("inventory_items").delete().eq("id", id);
          if (error) throw error;
        } catch(e) {
          console.warn("Failed to delete from Supabase, fallback to localStorage:", e);
        }
        
        // Local Cache mutate
        inventoryItems = inventoryItems.filter(x => x.id !== id);
        localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
        
        showToast("Item deleted!");
        
        // Sync any product variants that are linked to this SKU
        await syncAllLinkedProductsStock();
        
        hideLoading();
        loadInventoryPage();
      };

      window.setInventoryPage = function(n) {
        inventoryPage = n;
        renderInventoryList();
      };

      window.toggleInventorySort = function(col) {
        if (inventorySortColumn === col) {
          inventorySortDirection = inventorySortDirection === "asc" ? "desc" : "asc";
        } else {
          inventorySortColumn = col;
          inventorySortDirection = "asc";
        }
        inventoryPage = 1;
        renderInventoryList();
      };

      window.openEditInventoryModal = function(sku) {
        const item = inventoryItems.find(x => x.id === sku);
        if (!item) {
          showToast("Item not found!", "error");
          return;
        }
        document.getElementById("edit-inv-sku").value = item.id;
        document.getElementById("edit-inv-brand").value = item.brand || "";
        document.getElementById("edit-inv-name").value = item.name || "";
        document.getElementById("edit-inv-variant").value = item.variant_spec || "";
        document.getElementById("edit-inv-size").value = item.size || "";
        document.getElementById("edit-inv-price").value = item.price_eur || 0;
        document.getElementById("edit-inv-rate").value = item.rate || 250;
        document.getElementById("edit-inv-delivery").value = item.delivery_dzd || 0;
        document.getElementById("edit-inv-retail").value = item.retail_dzd || 0;
        if (document.getElementById("edit-inv-qty-eu")) document.getElementById("edit-inv-qty-eu").value = item.stock_eu || 0;
        if (document.getElementById("edit-inv-qty-dz")) document.getElementById("edit-inv-qty-dz").value = item.stock || 0;
        
        recalcEditLanded();
        openModal("inv-edit-modal");
      };

      window.recalcEditLanded = function() {
        const eur = parseFloat(document.getElementById("edit-inv-price")?.value) || 0;
        const rate = parseFloat(document.getElementById("edit-inv-rate")?.value) || 0;
        const delDzd = parseFloat(document.getElementById("edit-inv-delivery")?.value) || 0;
        const retail = parseFloat(document.getElementById("edit-inv-retail")?.value) || 0;
        
        const landed = (eur * rate) + delDzd;
        const margin = retail - landed;
        
        const landedEl = document.getElementById("edit-inv-landed-label");
        if (landedEl) landedEl.textContent = Math.round(landed).toLocaleString() + " DZD";
        const marginEl = document.getElementById("edit-inv-margin-label");
        if (marginEl) {
          marginEl.textContent = Math.round(margin).toLocaleString() + " DZD";
          marginEl.style.color = margin >= 0 ? "var(--green)" : "var(--red)";
        }
      };

      window.saveInventoryItemEdit = async function() {
        const id = document.getElementById("edit-inv-sku").value;
        const brand = document.getElementById("edit-inv-brand").value.trim();
        const name = document.getElementById("edit-inv-name").value.trim();
        const variant = document.getElementById("edit-inv-variant").value.trim();
        const size = document.getElementById("edit-inv-size").value.trim();
        const price_eur = parseFloat(document.getElementById("edit-inv-price").value) || 0;
        const rate = parseFloat(document.getElementById("edit-inv-rate").value) || 0;
        const delivery_dzd = parseFloat(document.getElementById("edit-inv-delivery").value) || 0;
        const retail_dzd = parseFloat(document.getElementById("edit-inv-retail").value) || 0;
        const stock_eu = parseInt(document.getElementById("edit-inv-qty-eu")?.value) || 0;
        const stock = parseInt(document.getElementById("edit-inv-qty-dz")?.value) || 0;
        
        if (!name) {
          showToast("Product Name is required!", "error");
          return;
        }
        
        showLoading("Saving changes…");
        try {
          const payload = {
            brand,
            name,
            variant_spec: variant,
            size,
            price_eur,
            rate,
            delivery_dzd,
            retail_dzd,
            stock_eu,
            stock
          };
          
          try {
            await sb.from("inventory_items").update(payload).eq("id", id);
          } catch (err) {
            console.warn("Supabase update notice:", err);
          }
          
          // Update local cache
          const idx = inventoryItems.findIndex(x => x.id === id);
          if (idx !== -1) {
            inventoryItems[idx] = { ...inventoryItems[idx], ...payload };
          }
          localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
          
          closeModal("inv-edit-modal");
          showToast("Item updated successfully!");
          
          // Sync stock to storefront products
          await syncAllLinkedProductsStock();
          
          renderInventoryList();
        } catch (e) {
          showToast("Error updating item: " + e.message, "error");
        }
        hideLoading();
      };

      window.toggleInventorySpreadsheetMode = function() {
        inventorySpreadsheetMode = !inventorySpreadsheetMode;
        const btn = document.getElementById("btn-inv-spreadsheet");
        if (btn) {
          btn.classList.toggle("active", inventorySpreadsheetMode);
          btn.style.background = inventorySpreadsheetMode ? "var(--red-light)" : "";
          btn.style.borderColor = inventorySpreadsheetMode ? "var(--red)" : "";
          btn.style.color = inventorySpreadsheetMode ? "var(--red)" : "";
        }
        renderInventoryList();
      };

      window.updateInventorySpreadsheetItem = async function(el, itemId, field) {
        const item = inventoryItems.find(x => x.id === itemId);
        if (!item) return;
        
        let val = el.value;
        if (field === "price_eur" || field === "rate" || field === "delivery_dzd" || field === "retail_dzd") {
          val = parseFloat(val) || 0;
        } else if (field === "stock" || field === "stock_eu") {
          val = parseInt(val) || 0;
        }
        
        item[field] = val;
        
        try {
          await sb.from("inventory_items").upsert(item);
        } catch(e) {
          console.warn("Failed to upsert to Supabase in spreadsheet mode, fallback to localStorage:", e);
        }
        
        localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
        
        const row = el.closest("tr");
        if (row) {
          const landed = (Number(item.price_eur) * Number(item.rate)) + Number(item.delivery_dzd);
          const margin = Number(item.retail_dzd) - landed;
          const marginColor = margin >= 0 ? "var(--green)" : "var(--red)";
          
          const landedLabel = row.querySelector("td:nth-child(9) span");
          if (landedLabel) landedLabel.textContent = `${Math.round(landed).toLocaleString()} DA`;
          
          const marginLabel = row.querySelector("td:nth-child(11) span");
          if (marginLabel) {
            marginLabel.textContent = `${Math.round(margin).toLocaleString()} DA`;
            marginLabel.style.color = marginColor;
          }
        }
        
        if (field === "stock") {
          await syncAllLinkedProductsStock();
        }
      };

      window.importInventoryCSV = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) {
            showToast("CSV file is empty or invalid", "error");
            return;
          }
          
          showLoading("Importing CSV items…");
          
          const parseCSVLine = (line) => {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                if (inQuotes && line[i+1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
          };

          const rawHeaders = parseCSVLine(lines[0]);
          const normHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
          
          const getCol = (keys, fallbackIndex) => {
            for (const key of keys) {
              const idx = normHeaders.indexOf(key);
              if (idx !== -1) return idx;
            }
            return fallbackIndex;
          };

          const idxSku = getCol(["sku", "id"], 0);
          const idxBrand = getCol(["brand"], 1);
          const idxName = getCol(["productname", "name", "product"], 2);
          const idxVariant = getCol(["variantspec", "variant", "flavor", "spec"], 3);
          const idxSize = getCol(["size"], 4);
          const idxPriceEur = getCol(["priceeur", "price", "eur"], 5);
          const idxRate = getCol(["rate", "exchangerate"], 6);
          const idxDelivery = getCol(["deliverydzd", "delivery"], 7);
          const idxRetail = getCol(["retaildzd", "retail"], 9);
          const idxStockEu = getCol(["stockeu", "eu", "europestock"], 12);
          const idxStockDz = getCol(["stockdz", "stock", "dz", "algeriastock"], 13);
          const idxType = getCol(["type", "category"], 14);

          const upserts = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 2) continue;
            
            const id = cols[idxSku] || "";
            const name = cols[idxName] || "";
            if (!id || !name) continue;

            const brand = cols[idxBrand] || "";
            const variant_spec = cols[idxVariant] || null;
            const size = cols[idxSize] || null;
            const price_eur = parseFloat(cols[idxPriceEur]) || 0;
            const rate = parseFloat(cols[idxRate]) || 250;
            const delivery_dzd = parseFloat(cols[idxDelivery]) || 0;
            const retail_dzd = parseFloat(cols[idxRetail]) || 0;
            const stock_eu = parseInt(cols[idxStockEu]) || 0;
            const stock = parseInt(cols[idxStockDz]) || (parseInt(cols[9]) || 0);
            const type = cols[idxType] || activeInventoryTab;

            upserts.push({
              id,
              type,
              brand,
              name,
              variant_spec,
              size,
              price_eur,
              rate,
              delivery_dzd,
              retail_dzd,
              stock_eu,
              stock
            });
          }
          
          if (upserts.length === 0) {
            showToast("No valid rows found in CSV", "error");
            hideLoading();
            return;
          }
          
          try {
            const { error } = await sb.from("inventory_items").upsert(upserts, { onConflict: "id" });
            if (error) console.warn("Supabase upsert notice:", error.message);
          } catch(err) {
            console.warn("Failed to upsert CSV to Supabase, fallback to localStorage:", err);
          }
          
          upserts.forEach(item => {
            const idx = inventoryItems.findIndex(x => x.id === item.id);
            if (idx >= 0) inventoryItems[idx] = { ...inventoryItems[idx], ...item };
            else inventoryItems.push(item);
          });
          localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
          
          showToast(`✓ Successfully imported ${upserts.length} items with all fields!`);
          
          await syncAllLinkedProductsStock();
          
          hideLoading();
          renderInventoryList();
        };
        
        reader.readAsText(file);
        event.target.value = "";
      };

      window.exportInventoryCSV = function() {
        const items = inventoryItems.filter(item => item.type === activeInventoryTab);
        if (!items.length) {
          showToast("No data to export", "error");
          return;
        }
        
        const headers = [
          "SKU",
          "Brand",
          "Product Name",
          "Variant Spec",
          "Size",
          "Price EUR",
          "Rate",
          "Delivery DZD",
          "Landed Cost DZD",
          "Retail DZD",
          "Margin DZD",
          "Margin Pct",
          "Stock EU",
          "Stock DZ",
          "Type"
        ];
        
        let csvContent = "\uFEFF" + headers.join(",") + "\n";
        
        items.forEach(item => {
          const landed = (Number(item.price_eur || 0) * Number(item.rate || 250)) + Number(item.delivery_dzd || 0);
          const margin = Number(item.retail_dzd || 0) - landed;
          const marginPct = Number(item.retail_dzd || 0) > 0 ? ((margin / Number(item.retail_dzd || 0)) * 100).toFixed(1) : "0.0";

          const row = [
            `"${(item.id || "").replace(/"/g, '""')}"`,
            `"${(item.brand || "").replace(/"/g, '""')}"`,
            `"${(item.name || "").replace(/"/g, '""')}"`,
            `"${(item.variant_spec || "").replace(/"/g, '""')}"`,
            `"${(item.size || "").replace(/"/g, '""')}"`,
            item.price_eur || 0,
            item.rate || 250,
            item.delivery_dzd || 0,
            Math.round(landed),
            item.retail_dzd || 0,
            Math.round(margin),
            marginPct,
            item.stock_eu || 0,
            item.stock || 0,
            `"${(item.type || activeInventoryTab).replace(/"/g, '""')}"`
          ];
          csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0,10);
        a.href = encodedUri;
        a.download = `bybens-inventory-${activeInventoryTab}-${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("✓ CSV Exported!");
      };

      window.importInventoryCSV = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
          const text = e.target.result;
          const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) {
            showToast("CSV file is empty or invalid", "error");
            return;
          }
          
          showLoading("Importing CSV items…");
          const upserts = [];
          
          // Simple CSV line parser that respects quotes
          const parseCSVLine = (line) => {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };
          
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 3) continue;
            
            const id = cols[0];
            const brand = cols[1];
            const name = cols[2];
            const variant_spec = cols[3] || null;
            const size = cols[4] || null;
            const price_eur = parseFloat(cols[5]) || 0;
            const rate = parseFloat(cols[6]) || 250;
            const delivery_dzd = parseFloat(cols[7]) || 0;
            const retail_dzd = parseFloat(cols[8]) || 0;
            const stock = parseInt(cols[9]) || 0;
            
            if (!id || !name) continue;
            
            upserts.push({
              id,
              type: activeInventoryTab,
              brand,
              name,
              variant_spec,
              size,
              price_eur,
              rate,
              delivery_dzd,
              retail_dzd,
              stock
            });
          }
          
          if (upserts.length === 0) {
            showToast("No valid rows found in CSV", "error");
            hideLoading();
            return;
          }
          
          try {
            const { error } = await sb.from("inventory_items").upsert(upserts, { onConflict: "id" });
            if (error) throw error;
          } catch(err) {
            console.warn("Failed to upsert CSV to Supabase, fallback to localStorage:", err);
          }
          
          // Update local cache
          upserts.forEach(item => {
            const idx = inventoryItems.findIndex(x => x.id === item.id);
            if (idx >= 0) inventoryItems[idx] = item;
            else inventoryItems.push(item);
          });
          localStorage.setItem("bb_inventory_items", JSON.stringify(inventoryItems));
          
          showToast(`✓ Imported ${upserts.length} items successfully!`);
          
          // Sync any product variants linked to these items
          await syncAllLinkedProductsStock();
          
          hideLoading();
          loadInventoryPage();
        };
        
        reader.readAsText(file);
        event.target.value = "";
      };


      /* ─── PRE-ORDER DOWNLOADS & METADATA HELPERS ─── */

      window.recalcPreorderTotals = function() {
        const itemRows = document.querySelectorAll("#preorder-items-list .preorder-item-row");
        let subtotal = 0;
        let deliveryCost = 0;

        itemRows.forEach(row => {
          const prodId = row.querySelector(".pre-prod-id").value; // SKU
          const qty = parseInt(row.querySelector(".pre-qty-input").value) || 1;

          if (prodId) {
            const invItem = inventoryItems.find(x => x.id === prodId);
            let retailPrice = 0;
            let deliveryPrice = 0;

            if (invItem) {
              retailPrice = Number(invItem.retail_dzd) || 0;
              deliveryPrice = Number(invItem.delivery_dzd) || 0;
            }

            subtotal += retailPrice * qty;
            deliveryCost += deliveryPrice * qty;
          }
        });

        const grandTotal = subtotal; // Delivery price excluded from grand total as requested

        // Populate modal summary labels
        const lblSubtotal = document.getElementById("preorder-lbl-subtotal");
        if (lblSubtotal) lblSubtotal.textContent = `${subtotal.toLocaleString()} DA`;

        const lblDelivery = document.getElementById("preorder-lbl-delivery");
        if (lblDelivery) lblDelivery.textContent = `${deliveryCost.toLocaleString()} DA`;

        const lblGrandTotal = document.getElementById("preorder-lbl-grandtotal");
        if (lblGrandTotal) lblGrandTotal.textContent = `${grandTotal.toLocaleString()} DA`;

        // Update hidden/visible delivery price input
        const delInput = document.getElementById("preorder-delivery-price");
        if (delInput) {
          delInput.value = deliveryCost;
        }
      };

      window.parsePreorderNotes = function(rawNotes) {
        let notes = rawNotes || "";
        let deliveryPrice = 0;
        const match = notes.match(/__DELIVERY_PRICE__:(\d+)/);
        if (match) {
          deliveryPrice = parseInt(match[1]) || 0;
          notes = notes.replace(/[\r\n]*__DELIVERY_PRICE__:\d+/, "").trim();
        }
        return { notes, deliveryPrice };
      };

      window.serializePreorderNotes = function(notes, deliveryPrice) {
        if (!deliveryPrice) return notes;
        return `${notes}\n__DELIVERY_PRICE__:${deliveryPrice}`.trim();
      };

      window.togglePreorderDownloadDropdown = function(id, event) {
        event.stopPropagation();
        document.querySelectorAll(".inv-dropdown-content").forEach(el => {
          if (el.id !== `dl-drop-${id}`) el.style.display = "none";
        });
        const dropdown = document.getElementById(`dl-drop-${id}`);
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        }
      };

      document.addEventListener("click", () => {
        document.querySelectorAll(".inv-dropdown-content").forEach(el => {
          el.style.display = "none";
        });
      });

      window.printPreorder = function(id, type, event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        const p = allPreorders.find(x => x.id === id);
        if (!p) {
          showToast("Pre-order not found!", "error");
          return;
        }
        
        const items = allPreorderItems.filter(x => x.pre_order_id === id);
        const { notes, deliveryPrice } = parsePreorderNotes(p.notes);
        const totalQty = items.reduce((s, itm) => s + Number(itm.qty || 0), 0);
        
        let totalVal = 0;
        const customerTableRowsHtml = items.map((item, idx) => {
          const invItem = inventoryItems.find(x => x.id === item.product_id);
          const price = invItem ? (Number(invItem.retail_dzd) || 0) : 0;
          const itemTotal = price * item.qty;
          totalVal += itemTotal;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>
                <div style="font-weight: 600; color: #0f172a;">${item.product_name}</div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${[item.variant, item.flavor].filter(Boolean).join(" | ")}</div>
              </td>
              <td style="text-align: center; font-weight: 600;">${item.qty}</td>
              <td style="text-align: right;">${price.toLocaleString()} DA</td>
              <td style="text-align: right; font-weight: 600; color: #0f172a;">${itemTotal.toLocaleString()} DA</td>
            </tr>
          `;
        }).join("");

        const courierTableRowsHtml = items.map((item, idx) => {
          const invItem = inventoryItems.find(x => x.id === item.product_id);
          const deliveryUnit = invItem ? (Number(invItem.delivery_dzd) || 0) : 0;
          const deliveryItemTotal = deliveryUnit * item.qty;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>
                <div style="font-weight: 600; color: #0f172a;">${item.product_name}</div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${[item.variant, item.flavor].filter(Boolean).join(" | ")}</div>
              </td>
              <td style="text-align: center; font-weight: 700; color: #0f172a;">${item.qty}</td>
              <td style="text-align: right;">${deliveryUnit.toLocaleString()} DA</td>
              <td style="text-align: right; font-weight: 600; color: #0f172a;">${deliveryItemTotal.toLocaleString()} DA</td>
            </tr>
          `;
        }).join("");

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
          showToast("Pop-up blocked! Please allow pop-ups to print receipts.", "error");
          return;
        }

        let content = "";
        if (type === 'customer') {
          content = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Invoice - ${p.customer_name}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Outfit', sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px; }
                .logo { font-size: 26px; font-weight: 800; color: #ad0000; letter-spacing: -0.5px; }
                .logo span { color: #0f172a; font-weight: 400; }
                .title { font-size: 18px; font-weight: 700; text-align: right; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                .info-block h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; font-weight: 700; }
                .info-block p { margin: 0; font-size: 14px; font-weight: 500; color: #334155; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: left; letter-spacing: 0.5px; }
                td { border-bottom: 1px solid #f1f5f9; padding: 14px 10px; font-size: 13.5px; color: #334155; }
                .summary-table { width: 340px; margin-left: auto; margin-top: 20px; }
                .summary-table td { padding: 8px 10px; border: none; font-size: 14px; color: #475569; }
                .summary-table tr.total { font-size: 18px; font-weight: 700; color: #ad0000; border-top: 2px solid #f1f5f9; }
                .summary-table tr.total td { color: #ad0000; padding-top: 16px; }
                .footer { text-align: center; margin-top: 80px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 500; }
                .btn-print { padding: 10px 20px; background: #ad0000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; }
                .btn-print:hover { background: #880000; }
                @media print {
                  @page { margin: 0mm; }
                  body { padding: 15mm; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 30px; text-align: right;">
                <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
              </div>
              <div class="header">
                <div>
                  <div class="logo">ByBens <span>Supplements</span></div>
                  <div style="font-size:12px; color:#475569; margin-top:4px; font-weight:500; line-height:1.4;">
                    📞 +213 662 269 449 &nbsp;|&nbsp; ✉️ contact@bybens.com<br>
                    📸 Instagram: @BENS.SUPPLEMENTS &nbsp;|&nbsp; 🌐 www.bybens.com
                  </div>
                </div>
                <div class="title">Customer Invoice<br><span style="font-size:11.5px;font-weight:500;text-transform:none;color:#94a3b8;">Pre-order ID: ${p.id}</span></div>
              </div>
              <div class="info-grid">
                <div class="info-block">
                  <h3>Billed To</h3>
                  <p style="font-size: 17px; font-weight: 700; color:#0f172a; margin-bottom:4px;">${p.customer_name}</p>
                  <p style="font-weight: 500; color: #475569;">📞 ${p.customer_phone}</p>
                </div>
                <div class="info-block" style="text-align: right;">
                  <h3>Invoice Date</h3>
                  <p style="font-size: 15px; font-weight: 600; color: #0f172a;">${new Date(p.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 40px;">#</th>
                    <th>Product Details</th>
                    <th style="width: 80px; text-align: center;">Qty</th>
                    <th style="width: 130px; text-align: right;">Unit Price</th>
                    <th style="width: 130px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${customerTableRowsHtml}
                </tbody>
              </table>
              <table class="summary-table">
                <tr class="total">
                  <td>Grand Total (DZD):</td>
                  <td style="text-align: right;">${totalVal.toLocaleString()} DA</td>
                </tr>
              </table>
              <div class="footer">
                Thank you for shopping with ByBens!<br>
                <span style="font-weight:600; color:#475569;">📞 +213 662 269 449 &nbsp;•&nbsp; ✉️ contact@bybens.com &nbsp;•&nbsp; 📸 @BENS.SUPPLEMENTS &nbsp;•&nbsp; 🌐 www.bybens.com</span>
              </div>
            </body>
            </html>
          `;
        } else {
          content = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Delivery Slip - ${p.customer_name}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Outfit', sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px; }
                .logo { font-size: 26px; font-weight: 800; color: #ad0000; letter-spacing: -0.5px; }
                .logo span { color: #0f172a; font-weight: 400; }
                .title { font-size: 18px; font-weight: 700; text-align: right; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
                .info-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 40px; }
                .info-block h3 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; font-weight: 700; }
                .info-block p { margin: 0; font-size: 14px; font-weight: 500; color: #334155; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: left; letter-spacing: 0.5px; }
                td { border-bottom: 1px solid #f1f5f9; padding: 14px 10px; font-size: 13.5px; color: #334155; }
                .collect-box { padding: 22px; background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 8px; font-size: 18px; font-weight: 800; color: #b45309; display: flex; justify-content: space-between; align-items: center; margin-top: 30px; }
                .collect-box span.val { font-size: 24px; color: #ad0000; font-weight: 800; }
                .footer { margin-top: 80px; display: flex; justify-content: space-between; font-size: 13px; color: #64748b; }
                .signature-line { border-top: 1.5px solid #cbd5e1; width: 220px; text-align: center; padding-top: 8px; margin-top: 50px; font-weight: 500; color: #94a3b8; }
                .btn-print { padding: 10px 20px; background: #ad0000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; }
                .btn-print:hover { background: #880000; }
                @media print {
                  @page { margin: 0mm; }
                  body { padding: 15mm; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="margin-bottom: 30px; text-align: right;">
                <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
              </div>
              <div class="header">
                <div>
                  <div class="logo">ByBens <span>Supplements</span></div>
                  <div style="font-size:12px; color:#475569; margin-top:4px; font-weight:500; line-height:1.4;">
                    📞 +213 662 269 449 &nbsp;|&nbsp; ✉️ contact@bybens.com<br>
                    📸 Instagram: @BENS.SUPPLEMENTS &nbsp;|&nbsp; 🌐 www.bybens.com
                  </div>
                </div>
                <div class="title">Courier Delivery Slip<br><span style="font-size:11.5px;font-weight:500;text-transform:none;color:#94a3b8;">Pre-order ID: ${p.id}</span></div>
              </div>
              <div class="info-grid">
                ${notes ? `
                <div class="info-block" style="background:#f8fafc; padding: 16px; border-radius: 8px; border:1px solid #e2e8f0; margin-top: 10px;">
                  <h3>Delivery Notes / Instructions</h3>
                  <p style="font-size: 13.5px; font-weight: normal; color: #475569; white-space: pre-wrap; margin: 0;">${notes}</p>
                </div>` : ''}
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 40px;">#</th>
                    <th>Product Details</th>
                    <th style="width: 80px; text-align: center;">Qty</th>
                    <th style="width: 130px; text-align: right;">Delivery Price</th>
                    <th style="width: 130px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${courierTableRowsHtml}
                </tbody>
              </table>

              <div class="collect-box" style="margin-top: 30px;">
                <span>COURIER: COLLECT DELIVERY FEE</span>
                <span class="val">${deliveryPrice.toLocaleString()} DA</span>
              </div>
              <div class="footer" style="margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 15px; font-weight: 500;">
                ByBens Supplements &nbsp;•&nbsp; 📞 +213 662 269 449 &nbsp;•&nbsp; ✉️ contact@bybens.com &nbsp;•&nbsp; 📸 @BENS.SUPPLEMENTS &nbsp;•&nbsp; 🌐 www.bybens.com
              </div>
            </body>
            </html>
          `;
        }

        printWindow.document.write(content);
        printWindow.document.close();
      };

      // ─── BUDGETS & CURRENCY EXCHANGE MANAGEMENT ───
      window.openBudgetModal = function() {
        openModal("budget-modal");
        const budgetEur = parseFloat(settings.budget_eur) || 0;
        const budgetDzd = parseFloat(settings.budget_dzd) || 0;
        document.getElementById("adj-budget-eur").value = budgetEur;
        document.getElementById("adj-budget-dzd").value = Math.round(budgetDzd);
        document.getElementById("ex-amount-dzd").value = "";
        document.getElementById("ex-amount-eur").value = "";
      };

      window.recalcConversion = function() {
        const dzd = parseFloat(document.getElementById("ex-amount-dzd").value) || 0;
        const rate = parseFloat(document.getElementById("ex-rate").value) || 250;
        const eur = dzd > 0 && rate > 0 ? (dzd / rate) : 0;
        document.getElementById("ex-amount-eur").value = eur.toFixed(2);
      };

      window.saveDirectBudgets = async function() {
        const eur = parseFloat(document.getElementById("adj-budget-eur").value) || 0;
        const dzd = parseFloat(document.getElementById("adj-budget-dzd").value) || 0;
        
        showLoading("Saving budgets...");
        try {
          const { error } = await sb.from("settings").upsert([
            { key: "budget_eur", value: String(eur) },
            { key: "budget_dzd", value: String(dzd) }
          ], { onConflict: "key" });
          if (error) throw error;
          
          settings.budget_eur = String(eur);
          settings.budget_dzd = String(dzd);
          
          updateDashboard();
          closeModal("budget-modal");
          showToast("Budgets updated successfully!");
        } catch(e) {
          showToast("Failed to save budgets: " + e.message, "error");
        }
        hideLoading();
      };

      window.recordCurrencyConversion = async function() {
        const dzd = parseFloat(document.getElementById("ex-amount-dzd").value) || 0;
        const rate = parseFloat(document.getElementById("ex-rate").value) || 250;
        const eur = dzd > 0 && rate > 0 ? (dzd / rate) : 0;
        
        if (dzd <= 0 || rate <= 0) {
          showToast("Please enter valid amounts!", "error");
          return;
        }
        
        const curDzd = parseFloat(settings.budget_dzd) || 0;
        const curEur = parseFloat(settings.budget_eur) || 0;
        
        if (dzd > curDzd) {
          if (!confirm(`Warning: Deducting ${dzd.toLocaleString()} DA will put your DZD budget in negative. Proceed?`)) {
            return;
          }
        }
        
        const newDzd = curDzd - dzd;
        const newEur = curEur + eur;
        
        showLoading("Recording currency exchange...");
        try {
          const expenseId = String(Date.now());
          const desc = `Converted ${dzd.toLocaleString()} DA to ${eur.toFixed(2)} EUR at rate ${rate} DA/€`;
          
          let payload = {
            id: expenseId,
            date: new Date().toISOString(),
            amount: dzd,
            category: "Currency Exchange",
            description: desc
          };
          
          let dbPayload = { ...payload };
          
          try {
            dbPayload.currency = "DZD";
            const { error: expErr } = await sb.from("expenses").insert(dbPayload);
            if (expErr) throw expErr;
          } catch(dbErr) {
            console.warn("Currency column missing on conversion log fallback:", dbErr);
            const fallbackDesc = `[DZD] ${desc}`;
            const fallbackPayload = {
              ...payload,
              description: fallbackDesc
            };
            const { error: fbErr } = await sb.from("expenses").insert(fallbackPayload);
            if (fbErr) throw fbErr;
            payload.description = fallbackDesc;
          }
          
          allExpenses.unshift({ ...payload, currency: "DZD" });
          
          const { error: setErr } = await sb.from("settings").upsert([
            { key: "budget_dzd", value: String(newDzd) },
            { key: "budget_eur", value: String(newEur) }
          ], { onConflict: "key" });
          if (setErr) throw setErr;
          
          settings.budget_dzd = String(newDzd);
          settings.budget_eur = String(newEur);
          
          renderExpensesList();
          updateDashboard();
          closeModal("budget-modal");
          showToast("Currency exchange recorded and budgets synced!");
        } catch(e) {
          showToast("Error: " + e.message, "error");
        }
        hideLoading();
      };



