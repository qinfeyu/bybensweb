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
      if (sessionStorage.getItem("bb_admin_auth") !== "1") {
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
      let _prodFilter = "", _delFilter = "";
      function _pagCtrl(total, cur, setFn) {
        const totalPages = Math.ceil(total / _PAGE);
        if (totalPages <= 1) return "";
        const from = (cur - 1) * _PAGE + 1;
        const to = Math.min(cur * _PAGE, total);
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
          .select("id,status,total,created_at,items,first_name,last_name,phone,wilaya")
          .order("created_at", { ascending: false });
        _dashOrders = (data || []).map(o => ({
          id: o.id, status: o.status, total: o.total,
          createdAt: o.created_at, items: o.items || [],
          firstName: o.first_name || "", lastName: o.last_name || "",
          phone: o.phone || "", wilaya: o.wilaya || ""
        }));
      }

      // ════════════════════════════════════════════
      // ROW MAPPERS (snake_case → camelCase)
      // ════════════════════════════════════════════
      function _remapProductRow(r) {
        return { id: r.id, name: r.name, brand: r.brand, categoryIds: (r.category_ids || "").split(",").filter(Boolean), subCategoryIds: (r.sub_category_ids || "").split(",").filter(Boolean), description: r.description, imageUrl: r.image_url || [], variants: r.variants || [], flavors: r.flavors || [], stock: r.stock, discount: r.discount, allowPromo: r.allow_promo, promoCodeIds: (r.promo_code_ids || "").split(",").filter(Boolean), status: r.status, hidden: r.hidden || false, nutritionalFacts: r.nutritional_facts, benefits: r.benefits, createdAt: r.created_at };
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
        return { name: p.name, brand: p.brand || "", category_ids: (p.categoryIds || []).join(","), sub_category_ids: (p.subCategoryIds || []).join(","), description: p.description || "", image_url: p.imageUrl || [], variants: p.variants || [], flavors: p.flavors || [], stock: p.stock || 0, discount: p.discount || 0, allow_promo: p.allowPromo || false, promo_code_ids: (p.promoCodeIds || []).join(","), status: p.status || "active", hidden: p.hidden || false, nutritional_facts: p.nutritionalFacts || "", benefits: p.benefits || "" };
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
      document.addEventListener("DOMContentLoaded", async () => {
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
      });

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
        document.getElementById("stat-products").textContent = productsTotal || products.length;
        document.getElementById("stat-orders").textContent = _dashOrders.length;
        document.getElementById("stat-promos") &&
          (document.getElementById("stat-promos").textContent = promos.filter(
            (p) => p.status === "active",
          ).length);

        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const weekOrders = _dashOrders.filter((o) => {
          if (!o.createdAt) return false;
          try { return new Date(o.createdAt) >= weekAgo; } catch (e) { return false; }
        });

        document.getElementById("stat-week-orders").textContent = weekOrders.length;
        document.getElementById("stat-pending").textContent = _dashOrders.filter((o) => o.status === "waiting").length;

        const totalRev = _dashOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const weekRev = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        document.getElementById("stat-revenue-total").textContent = fmtRevenue(totalRev);
        document.getElementById("stat-revenue-week").textContent = fmtRevenue(weekRev);

        const trendEl = document.getElementById("stat-week-trend");
        if (trendEl) {
          const prevWeekOrders = _dashOrders.filter((o) => {
            if (!o.createdAt) return false;
            try {
              const d = new Date(o.createdAt);
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
                const name = `${o.firstName} ${o.lastName}`.trim() || "—";
                const badge = `<span class="badge ${getOrderBadgeClass(o.status)}" style="font-size:10px;padding:2px 8px">${cap(o.status)}</span>`;
                let date = "—";
                if (o.createdAt) try { date = new Date(o.createdAt).toLocaleDateString("en-GB"); } catch (e) {}
                return `<div class="recent-order-row" onclick="showPage('orders',document.querySelector('.sb-link[onclick*=orders]'));setTimeout(()=>openOrderDetail('${o.id}'),100)">
                  <div class="recent-order-name">${name}<div class="recent-order-meta">${date} · ${(o.items||[]).length} item${(o.items||[]).length!==1?'s':''}</div></div>
                  ${badge}
                  <div class="recent-order-total">${Number(o.total||0).toLocaleString("fr-DZ")} DA</div>
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
        if (window.innerWidth < 768) closeSidebar();
      }
      function doLogout() {
        sb.auth.signOut();
        sessionStorage.removeItem("bb_admin_auth");
        sessionStorage.removeItem("bb_admin_name");
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
      }

      function removeImage(idx) {
        currentImageUrls.splice(idx, 1);
        renderImageGrid();
      }

      async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";
        document.getElementById("upload-spinner").style.display = "block";
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("upload_preset", CLOUDINARY_PRESET);
          fd.append("folder", "bybens-products");
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
            { method: "POST", body: fd },
          );
          const data = await res.json();
          if (data.secure_url) {
            currentImageUrls.push(data.secure_url);
            renderImageGrid();
            showToast("Image uploaded!");
          } else
            showToast(
              "Upload failed: " + (data.error?.message || "Unknown"),
              "error",
            );
        } catch (err) {
          showToast("Upload error: " + err.message, "error");
        }
        document.getElementById("upload-spinner").style.display = "none";
      }

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

      function renderProducts(filter = "") {
        _selReset("product");
        const tbody = document.getElementById("products-tbody");
        const pag = document.getElementById("products-pag");
        const filtered = products.filter(
          (p) =>
            !filter ||
            p.name.toLowerCase().includes(filter) ||
            (p.brand || "").toLowerCase().includes(filter),
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
            (p.variants || []).forEach((v) => addVariant(v));
            (p.flavors || []).forEach((f) => addFlavor(f));
            refreshStockMatrix();
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

      function editProduct(id) {
        openProductModal(id);
      }

      function addVariant(v = null) {
        const list = document.getElementById("variants-list");
        const div = document.createElement("div");
        div.className = "variant-row";
        if (v && v.flavorStock) div.dataset.flavorStock = JSON.stringify(v.flavorStock);
        if (v && v.stock !== undefined) div.dataset.varStock = String(v.stock);
        div.innerHTML = `<div class="form-group"><label>Weight</label><input type="number" class="form-control" placeholder="e.g. 908" value="${v ? v.weight : ""}" oninput="refreshStockMatrix()" /></div><div class="form-group"><label>Unit</label><select class="form-control form-select" onchange="refreshStockMatrix()"><option ${v && v.unit === "g" ? "selected" : ""}>g</option><option ${v && v.unit === "kg" ? "selected" : ""}>kg</option><option ${v && v.unit === "caps" ? "selected" : ""}>caps</option><option ${v && v.unit === "ml" ? "selected" : ""}>ml</option><option ${v && v.unit === "L" ? "selected" : ""}>L</option><option ${v && v.unit === "pcs" ? "selected" : ""}>pcs</option></select></div><div class="form-group"><label>Price (DA)</label><input type="number" class="form-control" placeholder="0" value="${v ? v.price : ""}" /></div><button class="btn-remove-variant" onclick="this.closest('.variant-row').remove();refreshStockMatrix()">×</button>`;
        list.appendChild(div);
        refreshStockMatrix();
      }

      function addFlavor(f = null) {
        const list = document.getElementById("flavors-list");
        const div = document.createElement("div");
        div.className = "flavor-row";
        div.innerHTML = `<div class="form-group"><label>Flavor Name</label><input type="text" class="form-control flavor-name-input" placeholder="e.g. Chocolate" value="${f ? f.name : ""}" oninput="refreshStockMatrix()" /></div><div class="form-group flavor-qty-cell"><label>Qty (no variants)</label><input type="number" class="form-control flavor-qty-input" placeholder="0" value="${f && f.qty ? f.qty : ""}" min="0" oninput="refreshStockMatrix()" /></div><button class="btn-remove-variant" onclick="this.closest('.flavor-row').remove();refreshStockMatrix()">×</button>`;
        list.appendChild(div);
        refreshStockMatrix();
      }

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
            body += `<tr><td>${label}</td>`;
            let rowTotal = 0;
            flavors.forEach(fn => {
              const key = `${vi}_${fn}`;
              const val = matrixVals[key] !== undefined ? matrixVals[key] : (fs[fn] !== undefined ? Number(fs[fn]) : 0);
              rowTotal += val;
              body += `<td><input type="number" class="form-control matrix-cell" min="0" value="${val}" data-vi="${vi}" data-fn="${fn}" oninput="updateMatrixTotals()"></td>`;
            });
            body += `<td class="matrix-total" id="mrt-${vi}">${rowTotal}</td></tr>`;
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
            const stock = vstockVals[String(vi)] !== undefined ? vstockVals[String(vi)] : (parseInt(row.dataset.varStock) || 0);
            return `<div class="vstock-row"><span class="vstock-label">${label}</span><input type="number" class="form-control vstock-input" data-vi="${vi}" value="${stock}" min="0" placeholder="0" oninput="refreshStockTotal()"></div>`;
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
        document.querySelectorAll("#stock-matrix-body tr").forEach((row, vi) => {
          const sum = Array.from(row.querySelectorAll("input")).reduce((s, i) => s + (parseInt(i.value) || 0), 0);
          const cell = document.getElementById(`mrt-${vi}`);
          if (cell) cell.textContent = sum;
          grand += sum;
        });
        document.getElementById("pm-stock").value = grand;
      }

      function refreshStockTotal() {
        const total = Array.from(document.querySelectorAll("#variant-stock-list .vstock-input"))
          .reduce((s, i) => s + (parseInt(i.value) || 0), 0);
        document.getElementById("pm-stock").value = total;
      }

      async function saveProduct() {
        const name = document.getElementById("pm-name").value.trim();
        if (!name) {
          showToast("Product name required", "error");
          return;
        }
        const categoryIds = getCheckedValues("pm-categories");
        const subCategoryIds = getCheckedValues("pm-subcategories");
        const promoCodeIds = document.getElementById("pm-promo-toggle").checked
          ? getCheckedValues("pm-promo-codes")
          : [];
        const showMatrix = document.getElementById("stock-matrix-section").style.display !== "none";
        const showVStock = document.getElementById("variant-stock-section").style.display !== "none";

        const variants = Array.from(document.querySelectorAll("#variants-list .variant-row"))
          .map((r, vi) => {
            const ins = r.querySelectorAll("input,select");
            const v = { weight: ins[0].value, unit: ins[1].value, price: parseFloat(ins[2].value) || 0 };
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

        const flavors = Array.from(document.querySelectorAll("#flavors-list .flavor-row"))
          .map((r) => {
            const name = r.querySelector(".flavor-name-input")?.value.trim() || "";
            const qty  = parseInt(r.querySelector(".flavor-qty-input")?.value) || 0;
            return { name, qty };
          })
          .filter((f) => f.name);

        // Compute global stock
        let globalStock;
        if (variants.length > 0) {
          globalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
        } else if (flavors.length > 0) {
          globalStock = flavors.reduce((s, f) => s + f.qty, 0);
        } else {
          globalStock = parseInt(document.getElementById("pm-stock").value) || 0;
        }

        const payload = {
          name,
          brand: document.getElementById("pm-brand").value.trim(),
          categoryIds,
          subCategoryIds,
          description: document.getElementById("pm-desc").innerHTML.trim(),
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
          for (const id of ids) {
            try {
              const r = await apiPost({ action, id });
              if (r.success) deletedIds.push(id);
              else failed++;
            } catch(e) { failed++; }
          }
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

      function searchOrders(val) {
        ordersSearch = val.trim().toLowerCase();
        orderPage = 1;
        _fetchOrdersPage().then(renderOrders).catch(() => renderOrders());
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
