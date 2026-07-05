      /* ══════════════════════════════════════════════════════
         CONFIG
      ══════════════════════════════════════════════════════ */
      const SUPABASE_URL = window.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";
      const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";
      const PAGE_LOAD_TIME = Date.now(); // used for bot timing check
      // getInitialData is provided by supabase-client.js

      var _wlStart = Date.now();
      function hideLoader() {
        var s = document.getElementById('dataSpinner');
        if (s) s.style.display = 'none';
        var l = document.getElementById('pageLoader');
        if (!l || l._exiting) return;
        sessionStorage.setItem('bb_wl', '1');
        var delay = Math.max(0, 1600 - (Date.now() - _wlStart));
        setTimeout(function() {
          l._exiting = true;
          l.classList.add('wl-exit');
          setTimeout(function() { l.classList.add('hidden'); }, 700);
        }, delay);
      }

      let _allCategories = [];
      let _allSubCategories = [];
      let _allProducts = [];
      let _deliveryPrices = [];
      let _bundleId = null;
      let _topSoldIds = [];
      let selectedProduct = null;

      function computeTopSoldIds(orders, prods) {
        const qty = {};
        orders.forEach((o) =>
          (o.items || []).forEach((it) => {
            const name = (it.name || "").split(" (")[0].trim().toLowerCase();
            if (name) qty[name] = (qty[name] || 0) + (Number(it.qty) || 1);
          }),
        );
        const top3 = Object.entries(qty)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([n]) => n);
        const ids = [];
        top3.forEach((name) => {
          const p = prods.find((x) => x.name.toLowerCase().trim() === name);
          if (p && !ids.includes(p.id)) ids.push(p.id);
        });
        return ids;
      }

      function computeBadge(p, bundleId, topSoldIds) {
        if (Number(p.stock) <= 0) return { type: "oos", label: "OUT OF STOCK" };
        if (topSoldIds && topSoldIds.includes(p.id))
          return { type: "hot", label: "HOT" };
        if (bundleId && p.id === bundleId)
          return { type: "bundle", label: "BUNDLE" };
        if (p.createdAt) {
          const c = new Date(p.createdAt),
            n = new Date();
          if (c.toDateString() === n.toDateString())
            return { type: "new", label: "NEW" };
        }
        const disc = p.discount || 0;
        if (disc > 0) return { type: "promo", label: "PROMO" };
        return null;
      }
      let selectedVariantIndex = 0;
      let selectedFlavor = "";
      let _productFlavorObjs = [];
      let selectedDelivery = "home";
      let selectedQty = 1;

      function getDeliveryCost() {
        if (selectedWilayaCode && _deliveryPrices.length) {
          const wilayaName = WILAYAS[selectedWilayaCode]
            ? WILAYAS[selectedWilayaCode].name.trim().toLowerCase()
            : "";
          const code = selectedWilayaCode.replace(/^0+/, ""); // "01" → "1"
          const row = _deliveryPrices.find((d) => {
            const stored = d.wilaya.trim().toLowerCase();
            return (
              stored === wilayaName ||
              stored === code ||
              stored === selectedWilayaCode ||
              stored.includes(wilayaName) ||
              wilayaName.includes(stored)
            );
          });
          if (row) return { home: row.homePrice, office: row.officePrice };
        }
        return { home: 0, office: 0 };
      }
      let _allPromos = [];
      let appliedPromos = []; // all validated promo objects (stacked)

      /* ── HELPERS ── */
      /**
       * Safely parse a value that might be:
       *   - already an Array
       *   - a JSON string like '[{"weight":"1kg","price":3500}]'
       *   - a comma-separated plain string (old format)
       *   - empty / null
       */
      function parseField(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        const s = String(val).trim();
        if (s === "" || s === "[]") return [];
        // Try JSON first
        if (s.startsWith("[")) {
          try {
            return JSON.parse(s);
          } catch (e) {}
        }
        // Fallback: treat as comma-separated plain strings
        return s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }

      function getProductPrice(p, variantIndex) {
        const idx = variantIndex != null ? variantIndex : 0;
        const variants = parseField(p.variants);
        const base =
          variants.length > idx ? Number(variants[idx].price) || 0 : 0;
        const disc = Number(p.discount) || 0;
        return disc > 0 ? Math.round(base * (1 - disc / 100)) : base;
      }

      /* ── CATEGORY NAV — FIX: always wrap in .cat-item div ── */
      function renderCatNav(cats, subs) {
        const inner = document.getElementById("catNavInner");
        const mobile = document.getElementById("mobileCatItems");
        if (!inner || !mobile) return;

        let dHTML = "",
          mHTML = "";
        cats.forEach((cat) => {
          const catSubs = subs.filter(
            (s) =>
              Array.isArray(s.categoryIds) && s.categoryIds.includes(cat.id),
          );

          if (catSubs.length > 0) {
            // With dropdown — wrapped in .cat-item for hover to work
            dHTML += `<div class="cat-item">
              <a href="/supplements/products" class="cat-link">
                ${cat.name}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </a>
              <div class="dropdown">
                ${catSubs.map((s) => `<a href="/supplements/products?sub=${encodeURIComponent(s.name)}">${s.name}</a>`).join("")}
              </div>
            </div>`;
            mHTML += `<div class="m-cat-item">
              <button class="m-cat-toggle" onclick="toggleMobileCat(this)">
                ${cat.name} <span class="m-arrow">›</span>
              </button>
              <div class="m-sub">
                ${catSubs.map((s) => `<a href="/supplements/products?sub=${encodeURIComponent(s.name)}" class="m-sub-link">${s.name}</a>`).join("")}
              </div>
            </div>`;
          } else {
            // No sub-categories — still wrap in .cat-item for consistent hover underline
            dHTML += `<div class="cat-item"><a href="/supplements/products" class="cat-link">${cat.name}</a></div>`;
            mHTML += `<a href="/supplements/products" class="mobile-nav-link">${cat.name}</a>`;
          }
        });

        inner.innerHTML = dHTML;
        mobile.innerHTML = mHTML;
      }

      /* ── LOAD PRODUCT DATA ── */
      async function loadProductData() {
        try {
          const params = new URLSearchParams(window.location.search);
          const productId = params.get("id");

          const res = await getInitialData();
          if (!res || !res.success) throw new Error("getInitialData failed");

          _allCategories = res.categories || [];
          _allSubCategories = res.subCategories || [];
          _deliveryPrices = res.deliveryPrices || [];
          _allPromos = res.promos || [];
          const bundle = res.bundle || {};
          if (bundle.bundleId) _bundleId = bundle.bundleId;

          renderCatNav(_allCategories, _allSubCategories);

          if (res.products && res.products.length) {
            const products = res.products;
            _allProducts = products;
            if (Array.isArray(res.orders))
              _topSoldIds = computeTopSoldIds(res.orders, products);
            const p =
              (productId ? products.find((x) => x.id === productId) : null) ||
              products[0];
            if (p) {
              // Fetch heavy text fields (description, benefits, nutritional_facts) for this product only
              try {
                const detailRes = await fetch(
                  `${SUPABASE_URL}/rest/v1/products?select=description,benefits,nutritional_facts&id=eq.${p.id}`,
                  { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
                );
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  if (detail && detail[0]) {
                    p.description = detail[0].description || "";
                    p.benefits = detail[0].benefits || "";
                    p.nutritionalFacts = detail[0].nutritional_facts || "";
                  }
                }
              } catch (e) { /* non-critical, page still works */ }
              selectedProduct = p;
              renderProduct();
              // FIX: updateSummary AFTER renderProduct sets selectedVariantIndex & selectedFlavor
              updateSummary();

              // ── Footer categories (max 6) ──
              const footerList = document.getElementById("footerCategoryList");
              if (footerList) {
                footerList.innerHTML = _allCategories
                  .slice(0, 6)
                  .map((cat) => `<li><a href="/supplements/products?cat=${encodeURIComponent(cat.id)}">${cat.name}</a></li>`)
                  .join("");
              }
            }
            renderAlsoLike();
          }
        } catch (err) {
          console.error("Failed to load product data:", err);
          hideLoader();
          var section = document.querySelector(".product-detail-section");
          if (section) {
            section.innerHTML = [
              '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;',
              'min-height:40vh;gap:16px;padding:40px 20px;text-align:center;">',
              '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ad0000" stroke-width="1.5">',
              '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>',
              '<line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
              '<p style="font-family:var(--font-body);font-size:1rem;color:var(--gray-600);margin:0;">',
              'Unable to load product. Please check your connection and try again.</p>',
              '<button onclick="location.reload()" style="margin-top:8px;padding:12px 28px;',
              'background:var(--red);color:#fff;border:none;border-radius:8px;',
              'font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;">',
              'Try Again</button></div>'
            ].join('');
          }
          return;
        }
        hideLoader();
      }

      function renderAlsoLike() {
        const grid = document.getElementById("alsoLikeGrid");
        if (!grid || !_allProducts.length) return;
        const others = _allProducts.filter(
          (p) =>
            p.status !== "inactive" &&
            (!selectedProduct || p.id !== selectedProduct.id),
        );
        // shuffle and take 4
        const picked = others
          .map((p) => ({ p, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .slice(0, 4)
          .map((x) => x.p);

        grid.innerHTML = picked
          .map((p) => {
            const price =
              p.variants && p.variants.length
                ? typeof p.variants[0] === "object"
                  ? p.variants[0].price
                  : 0
                : 0;
            const _alsoImgs = Array.isArray(p.imageUrl)
              ? p.imageUrl
              : p.imageUrl
                ? [p.imageUrl]
                : [];
            const img = _alsoImgs[0]
              ? `<img src="${_alsoImgs[0]}" alt="${p.name}" class="img-primary" />${_alsoImgs[1] ? `<img src="${_alsoImgs[1]}" alt="${p.name}" class="img-hover" />` : ""}`
              : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-200)" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`;
            const badge = computeBadge(p, _bundleId, _topSoldIds);
            return `
            <div class="also-card" onclick="window.location.href='/supplements/product-detail?id=${p.id}'" style="cursor:pointer">
              <div class="also-card-img">${img}${badge ? `<span class="product-badge badge-${badge.type}">${badge.label}</span>` : ""}</div>
              <div class="also-card-body">
                <div class="also-card-name">${p.name}</div>
                <div class="also-card-price">${price ? price.toLocaleString("fr-DZ") + " DA" : ""}</div>
                <div class="also-card-actions">
                  ${
                    Number(p.stock) <= 0
                      ? `<button class="also-btn-cart" disabled style="opacity:0.45;cursor:not-allowed">Out of Stock</button>`
                      : `<button class="also-btn-cart" onclick="event.stopPropagation();openAddToCartModal('${p.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Add to Cart
                  </button>`
                  }
                  <button class="also-btn-buy" onclick="event.stopPropagation();window.location.href='/supplements/product-detail?id=${p.id}'">
                    Buy Now
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>`;
          })
          .join("");
      }

      /* ── RENDER PRODUCT ──
         FIX: Normalise variants/flavors with parseField() BEFORE reading them,
         then set selectedVariantIndex=0 and selectedFlavor before updateSummary()
      ── */
      function switchProductImg(url, thumbEl) {
        document.getElementById("productMainImg").src = url;
        document
          .querySelectorAll(".gallery-thumb")
          .forEach((t) => t.classList.remove("active"));
        thumbEl.classList.add("active");
      }

      function renderProduct() {
        const p = selectedProduct;

        // Normalise all array fields
        p.variants = parseField(p.variants);
        p.flavors = parseField(p.flavors);
        p.categoryIds = parseField(p.categoryIds);
        p.subCategoryIds = parseField(p.subCategoryIds);

        document.title = `${p.name} – ByBens`;
        document.getElementById("breadcrumbName").textContent = p.name;
        document.getElementById("productBrand").textContent = p.brand || "";
        document.getElementById("productName").textContent = p.name;

        // Image
        const imgWrap = document.getElementById("productImgWrap");
        imgWrap.onclick = openImagePopup;
        const thumbsEl = document.getElementById("galleryThumbs");
        const _imgs = Array.isArray(p.imageUrl)
          ? p.imageUrl
          : p.imageUrl
            ? [p.imageUrl]
            : [];
        imgWrap.querySelector(".placeholder-img-wrap")?.remove();
        imgWrap.querySelectorAll("img").forEach((el) => el.remove());
        if (_imgs.length > 0) {
          const mainImg = document.createElement("img");
          mainImg.src = _imgs[0];
          mainImg.alt = p.name;
          mainImg.id = "productMainImg";
          mainImg.style.cssText = "width:100%;height:100%;object-fit:cover;";
          imgWrap.appendChild(mainImg);
          if (_imgs.length > 1) {
            thumbsEl.innerHTML = _imgs
              .map(
                (url, i) =>
                  `<div class="gallery-thumb${i === 0 ? " active" : ""}" onclick="switchProductImg('${url.replace(/'/g, "\\'")}',this)"><img src="${url}" alt="" /></div>`,
              )
              .join("");
            thumbsEl.style.display = "flex";
          } else {
            thumbsEl.style.display = "none";
          }
        }

        // Category tags
        const catEl = document.getElementById("productCategories");
        const tags = [];
        if (p.categoryIds.length) {
          p.categoryIds.forEach((cid) => {
            const cat = _allCategories.find((c) => c.id === cid);
            if (cat)
              tags.push(`<span class="cat-tag primary">${cat.name}</span>`);
          });
        }
        if (p.subCategoryIds.length) {
          p.subCategoryIds.forEach((sid) => {
            const sub = _allSubCategories.find((s) => s.id === sid);
            if (sub) tags.push(`<span class="cat-tag">${sub.name}</span>`);
          });
        }
        catEl.innerHTML = tags.join("");
        catEl.style.display = tags.length ? "flex" : "none";

        // Description
        document.getElementById("productDescription").innerHTML =
          p.description ||
          `${p.name} by ${p.brand} — a premium sports nutrition product.`;

        // Nutritional Facts (optional)
        const nutBox = document.getElementById("productNutritionalFactsBox");
        const nutEl = document.getElementById("productNutritionalFacts");
        if (p.nutritionalFacts && p.nutritionalFacts.trim()) {
          nutEl.innerHTML = p.nutritionalFacts;
          nutBox.style.display = "";
        } else {
          nutBox.style.display = "none";
        }

        // Benefits (optional)
        const benBox = document.getElementById("productBenefitsBox");
        const benEl = document.getElementById("productBenefits");
        if (p.benefits && p.benefits.trim()) {
          benEl.innerHTML = p.benefits;
          benBox.style.display = "";
        } else {
          benBox.style.display = "none";
        }

        // ── VARIANTS (weight/size) pills ──
        const weightGroup = document.getElementById("weightGroup");
        const weightPills = document.getElementById("weightPills");
        selectedVariantIndex = 0;

        // Normalise flavors globally (used by renderFlavorPills)
        _productFlavorObjs = (p.flavors || [])
          .map((f) =>
            typeof f === "object" && f !== null
              ? { name: f.name || f.label || "", qty: f.qty || 0 }
              : { name: String(f), qty: 0 },
          )
          .filter((fo) => fo.name);

        if (p.variants && p.variants.length > 0) {
          weightGroup.style.display = "";
          const hasNewStock = p.variants.some(
            (v) => typeof v === "object" && v.stock !== undefined,
          );
          weightPills.innerHTML = p.variants
            .map((v, i) => {
              let label;
              if (typeof v === "object" && v !== null) {
                label = v.weight
                  ? `${v.weight}${v.unit || ""}`
                  : v.label || v.name || `Option ${i + 1}`;
              } else {
                label = String(v);
              }
              const oos =
                hasNewStock &&
                typeof v === "object" &&
                v.stock !== undefined &&
                v.stock <= 0;
              return `<div class="variant-pill${i === 0 && !oos ? " active" : ""}${oos ? " variant-pill-oos" : ""}" ${oos ? "" : `onclick="selectVariant(this,${i})"`}>${label}</div>`;
            })
            .join("");
          // If first variant is OOS, auto-select first available
          if (p.variants[0] && p.variants[0].stock <= 0 && hasNewStock) {
            const firstAvailIdx = p.variants.findIndex(
              (v) => typeof v === "object" && v.stock > 0,
            );
            if (firstAvailIdx > 0) {
              selectedVariantIndex = firstAvailIdx;
              weightPills
                .querySelectorAll(".variant-pill")
                [firstAvailIdx]?.classList.add("active");
            }
          }
        } else {
          weightGroup.style.display = "none";
        }

        // ── FLAVORS ──
        renderFlavorPills();

        // ── PRICE ──
        updatePriceDisplay();

        // ── BADGE ──
        const badgeEl = document.getElementById("productBadge");
        const discount = Number(p.discount) || 0;
        const outOfStock = Number(p.stock) <= 0;
        let badge = null;
        if (outOfStock) badge = "oos";
        else if (discount > 0) badge = "sale";
        else if (
          p.createdAt &&
          Date.now() - new Date(p.createdAt).getTime() < 30 * 24 * 3600 * 1000
        )
          badge = "new";
        else if (Number(p.stock) <= 5) badge = "hot";

        if (badge) {
          badgeEl.textContent =
            badge === "oos" ? "OUT OF STOCK" : badge.toUpperCase();
          badgeEl.className = `product-badge badge-${badge}`;
          badgeEl.style.display = "";
        } else {
          badgeEl.style.display = "none";
        }

        // ── OUT OF STOCK: disable order buttons ──
        const btnCart = document.querySelector(".btn-add-to-cart-detail");
        const btnOrder = document.querySelector(".btn-order");
        let oosNotice = document.getElementById("oosNotice");
        if (outOfStock) {
          if (btnCart) btnCart.disabled = true;
          if (btnOrder) btnOrder.disabled = true;
          if (!oosNotice) {
            oosNotice = document.createElement("div");
            oosNotice.id = "oosNotice";
            oosNotice.className = "oos-notice";
            oosNotice.textContent = "This product is currently out of stock";
            btnCart && btnCart.parentNode.insertBefore(oosNotice, btnCart);
          }
          oosNotice.style.display = "";
        } else {
          if (btnCart) btnCart.disabled = false;
          if (btnOrder) btnOrder.disabled = false;
          if (oosNotice) oosNotice.style.display = "none";
        }

        // ── PROMO CODE field: show only if allowPromo is truthy ──
        const allowPromo =
          p.allowPromo === true ||
          String(p.allowPromo).toUpperCase() === "TRUE";
        document.getElementById("promoSection").style.display = allowPromo
          ? ""
          : "none";

        syncVariantImage();
      }

      /* ── Update just the price display (not summary) ── */
      function updatePriceDisplay() {
        const p = selectedProduct;
        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        const basePrice = v ? Number(v.price) || 0 : 0;
        const discount = Number(p.discount) || 0;
        const currentPrice =
          discount > 0
            ? Math.round(basePrice * (1 - discount / 100))
            : basePrice;

        document.getElementById("productPrice").textContent =
          currentPrice.toLocaleString("fr-DZ") + " DA";

        const oldPriceEl = document.getElementById("productOldPrice");
        const saveEl = document.getElementById("productSave");
        if (discount > 0 && basePrice > 0) {
          oldPriceEl.textContent = basePrice.toLocaleString("fr-DZ") + " DA";
          oldPriceEl.style.display = "";
          saveEl.textContent = `-${discount}%`;
          saveEl.style.display = "";
        } else {
          oldPriceEl.style.display = "none";
          saveEl.style.display = "none";
        }
      }

      /* ── Stock helpers ── */
      function getCurrentStock() {
        const p = selectedProduct;
        if (!p) return 0;
        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        if (v && typeof v === "object") {
          // New system: variant has flavorStock per flavor
          if (v.flavorStock && selectedFlavor) {
            return Number(v.flavorStock[selectedFlavor]) || 0;
          }
          // New system: variant has stock (no flavors)
          if (v.stock !== undefined && !selectedFlavor) {
            return Number(v.stock) || 0;
          }
        }
        // Old system: flavor.qty or global stock
        if (selectedFlavor && _productFlavorObjs.length > 0) {
          const fo = _productFlavorObjs.find((f) => f.name === selectedFlavor);
          if (fo && fo.qty > 0) return fo.qty;
        }
        return Number(p.stock) || 0;
      }

      function renderFlavorPills() {
        const p = selectedProduct;
        const flavorGroup = document.getElementById("flavorGroup");
        const flavorPills = document.getElementById("flavorPills");

        if (!_productFlavorObjs.length) {
          flavorGroup.style.display = "none";
          selectedFlavor = "";
          document.getElementById("productFlavor").textContent = "";
          return;
        }

        flavorGroup.style.display = "";
        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        const hasFlavorStock =
          v && typeof v === "object" && v.flavorStock !== undefined;
        const hasOldQty =
          !hasFlavorStock && _productFlavorObjs.some((fo) => fo.qty > 0);

        const isOOS = (fo) => {
          if (hasFlavorStock)
            return (
              v.flavorStock[fo.name] !== undefined &&
              v.flavorStock[fo.name] <= 0
            );
          if (hasOldQty) return fo.qty <= 0;
          return false;
        };

        // Pick first available flavor
        const firstAvail =
          _productFlavorObjs.find((fo) => !isOOS(fo)) || _productFlavorObjs[0];
        if (!selectedFlavor || isOOS({ name: selectedFlavor })) {
          selectedFlavor = firstAvail.name;
          document.getElementById("productFlavor").textContent =
            firstAvail.name;
        }

        flavorPills.innerHTML = _productFlavorObjs
          .map((fo) => {
            const oos = isOOS(fo);
            const active = fo.name === selectedFlavor;
            return `<div class="variant-pill${active ? " active" : ""}${oos ? " variant-pill-oos" : ""}" ${oos ? "" : `onclick="selectFlavor(this,'${fo.name.replace(/'/g, "\\'")}')"`}>${fo.name}</div>`;
          })
          .join("");
      }

      function syncVariantImage() {
        const p = selectedProduct;
        if (!p || !p.variants || p.variants.length === 0) return;
        const v = p.variants[selectedVariantIndex];
        if (!v) return;
        const imgs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : []);
        let targetImgIdx = 0; // Default to first image
        if (v.imageIndex !== undefined && v.imageIndex !== null && v.imageIndex !== "") {
          const parsedIdx = parseInt(v.imageIndex);
          if (!isNaN(parsedIdx) && imgs[parsedIdx]) {
            targetImgIdx = parsedIdx;
          }
        }
        if (imgs[targetImgIdx]) {
          const thumbs = document.querySelectorAll(".gallery-thumb");
          if (thumbs.length > targetImgIdx) {
            switchProductImg(imgs[targetImgIdx], thumbs[targetImgIdx]);
          } else {
            const mainImg = document.getElementById("productMainImg");
            if (mainImg) mainImg.src = imgs[targetImgIdx];
          }
        }
      }

      function selectVariant(el, idx) {
        selectedVariantIndex = idx;
        document
          .querySelectorAll("#weightPills .variant-pill")
          .forEach((p) => p.classList.remove("active"));
        el.classList.add("active");
        renderFlavorPills(); // re-evaluate OOS flavors for this variant
        syncVariantImage();
        // Clamp quantity to new variant stock
        const max = Math.min(5, getCurrentStock());
        let adjusted = false;
        if (selectedQty > max) {
          selectedQty = Math.max(1, max);
          adjusted = true;
        }
        const valEl = document.getElementById("qtyValue");
        valEl.textContent = selectedQty;
        if (adjusted) {
          valEl.classList.remove("qty-adjusted");
          void valEl.offsetWidth; // trigger reflow
          valEl.classList.add("qty-adjusted");
        }

        updatePriceDisplay();
        updateSummary();
      }

      let currentPopupImgIdx = 0;
      function openImagePopup() {
        const p = selectedProduct;
        if (!p) return;
        const mainImg = document.getElementById("productMainImg");
        if (!mainImg) return;
        
        const imgs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : []);
        // Identify index of current main image
        currentPopupImgIdx = imgs.indexOf(mainImg.getAttribute('src'));
        if (currentPopupImgIdx === -1) {
          currentPopupImgIdx = imgs.findIndex(url => mainImg.src.endsWith(url));
          if (currentPopupImgIdx === -1) currentPopupImgIdx = 0;
        }

        const overlay = document.getElementById("imgPopupOverlay");
        const content = document.getElementById("imgPopupContent");
        content.src = imgs[currentPopupImgIdx];
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
        updatePopupNav();
      }

      function navigatePopupImage(delta, e) {
        if (e) e.stopPropagation();
        const p = selectedProduct;
        const imgs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : []);
        currentPopupImgIdx = (currentPopupImgIdx + delta + imgs.length) % imgs.length;
        document.getElementById("imgPopupContent").src = imgs[currentPopupImgIdx];
      }

      function updatePopupNav() {
        const p = selectedProduct;
        const imgs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : []);
        const show = imgs.length > 1;
        document.getElementById("popupPrev").style.display = show ? "flex" : "none";
        document.getElementById("popupNext").style.display = show ? "flex" : "none";
      }

      function closeImagePopup() {
        document.getElementById("imgPopupOverlay").classList.remove("open");
        document.body.style.overflow = "";
      }

      function selectFlavor(el, f) {
        selectedFlavor = f;
        document
          .querySelectorAll("#flavorPills .variant-pill")
          .forEach((p) => p.classList.remove("active"));
        el.classList.add("active");
        document.getElementById("productFlavor").textContent = f;
        selectedQty = 1;
        document.getElementById("qtyValue").textContent = 1;
        // Clamp quantity to new flavor stock
        const stock = getCurrentStock();
        const max = Math.min(5, stock);
        let adjusted = false;
        if (selectedQty > max) {
          selectedQty = Math.max(1, max);
          adjusted = true;
        }
        const valEl = document.getElementById("qtyValue");
        valEl.textContent = selectedQty;
        if (adjusted) {
          valEl.classList.remove("qty-adjusted");
          void valEl.offsetWidth; // trigger reflow
          valEl.classList.add("qty-adjusted");
        }

        // Update bulk notice based on the new selectedQty
        const notice = document.getElementById("bulkNotice");
        if (notice) notice.style.display = "none";

        updateSummary();
      }

      function changeQty(delta) {
        const maxQty = Math.min(5, getCurrentStock() || 5);
        selectedQty = Math.min(maxQty, Math.max(1, selectedQty + delta));
        document.getElementById("qtyValue").textContent = selectedQty;

        // Show/hide bulk notice when qty reaches 3
        const notice = document.getElementById("bulkNotice");
        if (notice) notice.style.display = selectedQty >= 5 ? "flex" : "none";

        revalidateAppliedPromos();
        updateSummary();
      }

      function revalidateAppliedPromos() {
        if (!appliedPromos.length) return;
        const p = selectedProduct;
        if (!p) return;
        const variantPrice = getProductPrice(p, selectedVariantIndex);
        const subtotal = variantPrice * selectedQty;
        const removed = [];
        appliedPromos = appliedPromos.filter((pr) => {
          if (pr.minOrder && subtotal < pr.minOrder) {
            removed.push(pr.code);
            return false;
          }
          return true;
        });
        if (removed.length) {
          renderPromoTagsPD();
          const msgEl = document.getElementById("promoMsg");
          if (msgEl) {
            msgEl.style.color = "var(--red)";
            msgEl.textContent = `✗ ${removed.join(", ")} removed — order total is below the minimum.`;
          }
        }
      }

      /* ── DELIVERY ── */
      function selectDelivery(type) {
        selectedDelivery = type;
        document
          .getElementById("deliveryHome")
          .classList.toggle("active", type === "home");
        document
          .getElementById("deliveryOffice")
          .classList.toggle("active", type === "office");
        updateSummary();
      }

      /* ── ORDER SUMMARY — FIX: guard against no product, read variants via parseField ── */
      function updateSummary() {
        const p = selectedProduct;
        if (!p) return;

        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        const variantPrice = getProductPrice(p, selectedVariantIndex);

        // Build readable label
        let variantLabel = "";
        if (v) {
          if (typeof v === "object") {
            variantLabel = v.weight ? ` (${v.weight}${v.unit || ""})` : "";
          }
        }

        let name = p.name + variantLabel;
        if (selectedFlavor) name += ` — ${selectedFlavor}`;

        document.getElementById("summaryProduct").textContent = name;
        document.getElementById("summaryPrice").textContent =
          `${variantPrice.toLocaleString("fr-DZ")} DA × ${selectedQty}`;

        const deliveryCosts = getDeliveryCost();
        const cost = deliveryCosts[selectedDelivery];
        document.getElementById("summaryDelivery").textContent =
          selectedWilayaCode
            ? `+${cost.toLocaleString("fr-DZ")} DA (${selectedDelivery === "home" ? "Home" : "Office"})`
            : "Select wilaya";

        const subtotal = variantPrice * selectedQty;
        const { discount, freeDelivery } = getPromoDiscount(subtotal, cost);
        const deliveryCharge = selectedWilayaCode
          ? freeDelivery
            ? 0
            : cost
          : 0;
        const total = subtotal + deliveryCharge - discount;

        if (freeDelivery) {
          document.getElementById("summaryDelivery").textContent = "FREE 🎉";
        }

        let promoLabel = "";
        if (appliedPromos.length && discount > 0) {
          promoLabel = `(−${discount.toLocaleString("fr-DZ")} DA) `;
        }
        document.getElementById("summaryTotal").textContent =
          promoLabel + total.toLocaleString("fr-DZ") + " DA";
      }

      /* ── PROMO CODE ── */
      function renderPromoTagsPD() {
        const container = document.getElementById("promoTagsPD");
        if (!container) return;
        container.innerHTML = appliedPromos
          .map((pr) => {
            let label = pr.code;
            if (pr.type === "percent") label += ` (${pr.value}% off)`;
            else if (pr.type === "fixed")
              label += ` (−${pr.value.toLocaleString("fr-DZ")} DA)`;
            else if (pr.type === "free_delivery") label += " (Free delivery)";
            return `<span style="display:inline-flex;align-items:center;gap:5px;background:#e6f4ec;color:#0a7c3e;border:1px solid #b2dfcc;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;">
            ${label}
            <button onclick="removePromoPD('${pr.id}')" style="background:none;border:none;cursor:pointer;color:#0a7c3e;font-size:14px;line-height:1;padding:0;margin-left:2px;">×</button>
          </span>`;
          })
          .join("");
      }

      function removePromoPD(id) {
        appliedPromos = appliedPromos.filter((pr) => pr.id !== id);
        renderPromoTagsPD();
        const msgEl = document.getElementById("promoMsg");
        if (msgEl) msgEl.textContent = "";
        updateSummary();
      }

      function applyPromo() {
        const input = document.getElementById("promoCode");
        const code = input.value.trim().toUpperCase();
        const msgEl = document.getElementById("promoMsg");
        if (!code) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = "Please enter a promo code.";
          return;
        }

        // Already applied?
        if (appliedPromos.some((pr) => pr.code.toUpperCase() === code)) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = "✗ This code is already applied.";
          return;
        }

        const promo = _allPromos.find((pr) => pr.code.toUpperCase() === code);
        if (!promo) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = "✗ Invalid promo code.";
          return;
        }
        if (promo.status !== "active") {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = "✗ This promo code is no longer active.";
          return;
        }
        if (promo.expiry) {
          const expiry = new Date(promo.expiry);
          expiry.setHours(23, 59, 59, 999);
          if (expiry < new Date()) {
            msgEl.style.color = "var(--red)";
            msgEl.textContent = "✗ This promo code has expired.";
            return;
          }
        }
        if (promo.maxUses && promo.uses >= promo.maxUses) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = "✗ This promo code has reached its usage limit.";
          return;
        }

        // Product link check
        const p = selectedProduct;
        const isGlobalPromo = promo.applyToAll === true || String(promo.applyToAll).toUpperCase() === "TRUE";
        if (!isGlobalPromo && p && p.promoCodeIds && p.promoCodeIds.length > 0) {
          if (!p.promoCodeIds.includes(promo.id)) {
            msgEl.style.color = "var(--red)";
            msgEl.textContent = "✗ This code is not valid for this product.";
            return;
          }
        }

        // Min order check
        const variantPrice = getProductPrice(p, selectedVariantIndex);
        const subtotal = variantPrice * selectedQty;
        if (promo.minOrder && subtotal < promo.minOrder) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = `✗ Minimum order of ${promo.minOrder.toLocaleString("fr-DZ")} DA required.`;
          return;
        }

        // All checks passed — add to stack
        appliedPromos.push(promo);
        input.value = "";
        msgEl.style.color = "#0a7c3e";
        if (promo.type === "percent")
          msgEl.textContent = `✓ Code applied! ${promo.value}% off`;
        else if (promo.type === "fixed")
          msgEl.textContent = `✓ Code applied! −${promo.value.toLocaleString("fr-DZ")} DA`;
        else if (promo.type === "free_delivery")
          msgEl.textContent = "✓ Code applied! Free delivery";
        renderPromoTagsPD();
        updateSummary();
      }

      function getPromoDiscount(subtotal, deliveryCost) {
        if (!appliedPromos.length) return { discount: 0, freeDelivery: false };
        let discount = 0;
        let freeDelivery = false;
        for (const pr of appliedPromos) {
          if (pr.type === "percent")
            discount += Math.round(subtotal * (pr.value / 100));
          else if (pr.type === "fixed")
            discount += Math.min(pr.value, subtotal);
          else if (pr.type === "free_delivery") freeDelivery = true;
        }
        // Cap discount at subtotal so total never goes negative
        discount = Math.min(discount, subtotal);
        return { discount, freeDelivery };
      }

      /* ══════════════════════════════════════════════════════
         ALGERIA WILAYA / COMMUNE DATA
      ══════════════════════════════════════════════════════ */
            const WILAYAS = {
        "01": {
          name: "Adrar",
          communes: [
            "Adrar",
            "Akabli",
            "Aoulef",
            "Bouda",
            "Fenoughil",
            "In Zghmir",
            "Ouled Ahmed Timmi",
            "Reggane",
            "Sali",
            "Sebaa",
            "Tamantit",
            "Tamest",
            "Timekten",
            "Tit",
            "Tsabit",
            "Zaouiet Kounta",
          ],
        },
        "02": {
          name: "Chlef",
          communes: [
            "Abou El Hassane",
            "Ain Merane",
            "Benairia",
            "Beni  Bouattab",
            "Beni Haoua",
            "Beni Rached",
            "Boukadir",
            "Bouzeghaia",
            "Breira",
            "Chettia",
            "Chlef",
            "Dahra",
            "El Hadjadj",
            "El Karimia",
            "El Marsa",
            "Harchoun",
            "Herenfa",
            "Labiod Medjadja",
            "Moussadek",
            "Oued Fodda",
            "Oued Goussine",
            "Oued Sly",
            "Ouled Abbes",
            "Ouled Ben Abdelkader",
            "Ouled Fares",
            "Oum Drou",
            "Sendjas",
            "Sidi Abderrahmane",
            "Sidi Akkacha",
            "Sobha",
            "Tadjena",
            "Talassa",
            "Taougrit",
            "Tenes",
            "Zeboudja",
          ],
        },
        "03": {
          name: "Laghouat",
          communes: [
            "Ain Madhi",
            "Benacer Benchohra",
            "El Assafia",
            "El Haouaita",
            "Hassi Delaa",
            "Hassi R'mel",
            "Kheneg",
            "Ksar El Hirane",
            "Laghouat",
            "Sidi Makhlouf",
            "Tadjemout",
            "Tadjrouna",
          ],
        },
        "04": {
          name: "Oum El Bouaghi",
          communes: [
            "Ain Babouche",
            "Ain Beida",
            "Ain Diss",
            "Ain Fekroun",
            "Ain Kercha",
            "Ain M'lila",
            "Ain Zitoun",
            "Behir Chergui",
            "Berriche",
            "Bir Chouhada",
            "Dhalaa",
            "El Amiria",
            "El Belala",
            "El Djazia",
            "El Fedjoudj Boughrara Sa",
            "El Harmilia",
            "Fkirina",
            "Hanchir Toumghani",
            "Ksar Sbahi",
            "Meskiana",
            "Oued Nini",
            "Ouled Gacem",
            "Ouled Hamla",
            "Ouled Zouai",
            "Oum El Bouaghi",
            "Rahia",
            "Sigus",
            "Souk Naamane",
            "Zorg",
          ],
        },
        "05": {
          name: "Batna",
          communes: [
            "Ain Djasser",
            "Ain Touta",
            "Ain Yagout",
            "Arris",
            "Batna",
            "Beni Foudhala El Hakania",
            "Boulhilat",
            "Boumagueur",
            "Boumia",
            "Bouzina",
            "Chemora",
            "Chir",
            "Djerma",
            "El Hassi",
            "El Madher",
            "Fesdis",
            "Foum Toub",
            "Ghassira",
            "Gosbat",
            "Guigba",
            "Hidoussa",
            "Ichemoul",
            "Inoughissen",
            "Kimmel",
            "Ksar Bellezma",
            "Larbaa",
            "Lazrou",
            "Lemcene",
            "Maafa",
            "Menaa",
            "Merouana",
            "N Gaous",
            "Oued Chaaba",
            "Oued El Ma",
            "Oued Taga",
            "Ouled Aouf",
            "Ouled Fadel",
            "Ouled Sellem",
            "Ouled Si Slimane",
            "Ouyoun El Assafir",
            "Rahbat",
            "Ras El Aioun",
            "Sefiane",
            "Seriana",
            "T Kout",
            "Talkhamt",
            "Taxlent",
            "Tazoult",
            "Teniet El Abed",
            "Tighanimine",
            "Tigharghar",
            "Timgad",
            "Zanet El Beida",
          ],
        },
        "06": {
          name: "Bejaia",
          communes: [
            "Adekar",
            "Ait R'zine",
            "Ait-Smail",
            "Akbou",
            "Akfadou",
            "Amalou",
            "Amizour",
            "Aokas",
            "Barbacha",
            "Bejaia",
            "Beni Djellil",
            "Beni K'sila",
            "Beni-Mallikeche",
            "Benimaouche",
            "Boudjellil",
            "Bouhamza",
            "Boukhelifa",
            "Chellata",
            "Chemini",
            "Darguina",
            "Dra El Caid",
            "El Kseur",
            "Fenaia Il Maten",
            "Feraoun",
            "Ighil-Ali",
            "Ighram",
            "Kendira",
            "Kherrata",
            "Leflaye",
            "M'cisna",
            "Melbou",
            "Oued Ghir",
            "Ouzellaguen",
            "Seddouk",
            "Sidi Ayad",
            "Sidi-Aich",
            "Smaoun",
            "Souk El Tenine",
            "Souk Oufella",
            "Tala Hamza",
            "Tamokra",
            "Tamridjet",
            "Taourit Ighil",
            "Taskriout",
            "Tazmalt",
            "Tibane",
            "Tichy",
            "Tifra",
            "Timezrit",
            "Tinebdar",
            "Tizi-N'berber",
            "Toudja",
          ],
        },
        "07": {
          name: "Biskra",
          communes: [
            "Ain Naga",
            "Biskra",
            "Bordj Ben Azzouz",
            "Bouchakroun",
            "Chetma",
            "El Feidh",
            "El Ghrous",
            "El Hadjab",
            "El Haouch",
            "Foughala",
            "Khenguet Sidi Nadji",
            "Lichana",
            "Lioua",
            "M'chouneche",
            "Mekhadma",
            "Meziraa",
            "M'lili",
            "Oumache",
            "Ourlal",
            "Sidi Okba",
            "Tolga",
            "Zeribet El Oued",
          ],
        },
        "08": {
          name: "Bechar",
          communes: [
            "Abadla",
            "Bechar",
            "Beni-Ounif",
            "Boukais",
            "Erg-Ferradj",
            "Kenadsa",
            "Lahmar",
            "Machraa-Houari-Boumediene",
            "Meridja",
            "Mogheul",
            "Tabelbala",
            "Taghit",
          ],
        },
        "09": {
          name: "Blida",
          communes: [
            "Ain Romana",
            "Beni Mered",
            "Beni-Tamou",
            "Benkhelil",
            "Blida",
            "Bouarfa",
            "Boufarik",
            "Bougara",
            "Bouinan",
            "Chebli",
            "Chiffa",
            "Chrea",
            "Djebabra",
            "El-Affroun",
            "Guerrouaou",
            "Hammam Elouane",
            "Larbaa",
            "Meftah",
            "Mouzaia",
            "Oued  Djer",
            "Oued El Alleug",
            "Ouled Slama",
            "Ouled Yaich",
            "Souhane",
            "Soumaa",
          ],
        },
        "10": {
          name: "Bouira",
          communes: [
            "Aghbalou",
            "Ahl El Ksar",
            "Ain El Hadjar",
            "Ain Laloui",
            "Ain Turk",
            "Ain-Bessem",
            "Ait Laaziz",
            "Aomar",
            "Ath Mansour",
            "Bechloul",
            "Bir Ghbalou",
            "Bordj Okhriss",
            "Bouderbala",
            "Bouira",
            "Boukram",
            "Chorfa",
            "Dechmia",
            "Dirah",
            "Djebahia",
            "El Adjiba",
            "El Asnam",
            "El Hachimia",
            "El Khabouzia",
            "El-Hakimia",
            "El-Mokrani",
            "Guerrouma",
            "Hadjera Zerga",
            "Haizer",
            "Hanif",
            "Kadiria",
            "Lakhdaria",
            "M Chedallah",
            "Maala",
            "Maamora",
            "Mezdour",
            "Oued El Berdi",
            "Ouled Rached",
            "Raouraoua",
            "Ridane",
            "Saharidj",
            "Souk El Khemis",
            "Sour El Ghozlane",
            "Taghzout",
            "Taguedite",
            "Z'barbar (El Isseri )",
          ],
        },
        "11": {
          name: "Tamanrasset",
          communes: [
            "Abelsa",
            "Ain Amguel",
            "Idles",
            "Tamanrasset",
            "Tazrouk",
          ],
        },
        "12": {
          name: "Tebessa",
          communes: [
            "Ain Zerga",
            "Bedjene",
            "Bekkaria",
            "Bir Dheheb",
            "Bir Mokkadem",
            "Boukhadra",
            "Boulhaf Dyr",
            "Cheria",
            "El Kouif",
            "El Malabiod",
            "El Meridj",
            "El Mezeraa",
            "El Ogla",
            "El-Aouinet",
            "El-Houidjbet",
            "Guorriguer",
            "Hammamet",
            "Morsott",
            "Ouenza",
            "Oum Ali",
            "Saf Saf El Ouesra",
            "Stah Guentis",
            "Tebessa",
            "Telidjen",
          ],
        },
        "13": {
          name: "Tlemcen",
          communes: [
            "Ain Fetah",
            "Ain Fezza",
            "Ain Ghoraba",
            "Ain Kebira",
            "Ain Nehala",
            "Ain Tellout",
            "Ain Youcef",
            "Amieur",
            "Azail",
            "Bab El Assa",
            "Beni Bahdel",
            "Beni Boussaid",
            "Beni Khellad",
            "Beni Mester",
            "Beni Ouarsous",
            "Beni Smiel",
            "Beni Snous",
            "Bensekrane",
            "Bouhlou",
            "Chetouane",
            "Dar Yaghmoracen",
            "Djebala",
            "El Fehoul",
            "Fellaoucene",
            "Ghazaouet",
            "Hammam Boughrara",
            "Hennaya",
            "Honnaine",
            "Maghnia",
            "Mansourah",
            "Marsa Ben M'hidi",
            "M'sirda Fouaga",
            "Nedroma",
            "Oued Lakhdar",
            "Ouled Mimoun",
            "Ouled Riyah",
            "Remchi",
            "Sabra",
            "Sebbaa Chioukh",
            "Sebdou",
            "Sidi Abdelli",
            "Sidi Medjahed",
            "Souahlia",
            "Souani",
            "Souk Tleta",
            "Terny Beni Hediel",
            "Tianet",
            "Tlemcen",
            "Zenata",
          ],
        },
        "14": {
          name: "Tiaret",
          communes: [
            "Ain Bouchekif",
            "Ain Deheb",
            "Ain Dzarit",
            "Ain El Hadid",
            "Ain Kermes",
            "Chehaima",
            "Dahmouni",
            "Djebilet Rosfa",
            "Djillali Ben Amar",
            "Faidja",
            "Frenda",
            "Guertoufa",
            "Madna",
            "Mahdia",
            "Mechraa Safa",
            "Medrissa",
            "Medroussa",
            "Meghila",
            "Mellakou",
            "Nadorah",
            "Naima",
            "Oued Lilli",
            "Rahouia",
            "Sebaine",
            "Sebt",
            "Si Abdelghani",
            "Sidi Abderrahmane",
            "Sidi Ali Mellal",
            "Sidi Bakhti",
            "Sidi Hosni",
            "Sougueur",
            "Tagdempt",
            "Takhemaret",
            "Tiaret",
            "Tidda",
            "Tousnina",
          ],
        },
        "15": {
          name: "Tizi Ouzou",
          communes: [
            "Abi-Youcef",
            "Aghribs",
            "Agouni-Gueghrane",
            "Ain-El-Hammam",
            "Ain-Zaouia",
            "Ait Aggouacha",
            "Ait Bouaddou",
            "Ait Boumahdi",
            "Ait Khellili",
            "Ait Yahia Moussa",
            "Ait-Aissa-Mimoun",
            "Ait-Chafaa",
            "Ait-Mahmoud",
            "Ait-Oumalou",
            "Ait-Toudert",
            "Ait-Yahia",
            "Akbil",
            "Akerrou",
            "Assi-Youcef",
            "Azazga",
            "Azeffoun",
            "Beni Zmenzer",
            "Beni-Aissi",
            "Beni-Douala",
            "Beni-Yenni",
            "Beni-Zikki",
            "Boghni",
            "Boudjima",
            "Bounouh",
            "Bouzeguene",
            "Draa-Ben-Khedda",
            "Draa-El-Mizan",
            "Freha",
            "Frikat",
            "Iboudrarene",
            "Idjeur",
            "Iferhounene",
            "Ifigha",
            "Iflissen",
            "Illilten",
            "Illoula Oumalou",
            "Imsouhal",
            "Irdjen",
            "Larbaa Nath Irathen",
            "Maatkas",
            "Makouda",
            "Mechtras",
            "Mekla",
            "Mizrana",
            "M'kira",
            "Ouacif",
            "Ouadhias",
            "Ouaguenoun",
            "Sidi Namane",
            "Souama",
            "Souk-El-Tenine",
            "Tadmait",
            "Tigzirt",
            "Timizart",
            "Tirmitine",
            "Tizi N'tleta",
            "Tizi-Gheniff",
            "Tizi-Ouzou",
            "Tizi-Rached",
            "Yakourene",
            "Yatafene",
            "Zekri",
          ],
        },
        "16": {
          name: "Alger",
          communes: [
            "Ain Benian",
            "Ain Taya",
            "Alger Centre",
            "Bab El Oued",
            "Bab Ezzouar",
            "Baba Hassen",
            "Bachedjerah",
            "Baraki",
            "Ben Aknoun",
            "Beni Messous",
            "Bir Mourad Rais",
            "Bir Touta",
            "Birkhadem",
            "Bologhine Ibnou Ziri",
            "Bordj El Bahri",
            "Bordj El Kiffan",
            "Bourouba",
            "Bouzareah",
            "Casbah",
            "Cheraga",
            "Dar El Beida",
            "Dely Ibrahim",
            "Djasr Kasentina",
            "Douira",
            "Draria",
            "El Achour",
            "El Biar",
            "El Harrach",
            "El Madania",
            "El Magharia",
            "El Marsa",
            "El Mouradia",
            "Hammamet",
            "Herraoua",
            "Hussein Dey",
            "Hydra",
            "Khraissia",
            "Kouba",
            "Les Eucalyptus",
            "Maalma",
            "Mohamed Belouzdad",
            "Mohammadia",
            "Oued Koriche",
            "Oued Smar",
            "Ouled Chebel",
            "Ouled Fayet",
            "Rahmania",
            "Rais Hamidou",
            "Reghaia",
            "Rouiba",
            "Sehaoula",
            "Sidi M'hamed",
            "Sidi Moussa",
            "Souidania",
            "Staoueli",
            "Tessala El Merdja",
            "Zeralda",
          ],
        },
        "17": {
          name: "Djelfa",
          communes: [
            "Ain Chouhada",
            "Ain El Ibel",
            "Ain Maabed",
            "Benyagoub",
            "Charef",
            "Dar Chioukh",
            "Djelfa",
            "Douis",
            "El Guedid",
            "El Idrissia",
            "Hassi Bahbah",
            "Hassi El Euch",
            "M'liliha",
            "Moudjebara",
            "Sidi Baizid",
            "Taadmit",
            "Zaafrane",
            "Zaccar",
          ],
        },
        "18": {
          name: "Jijel",
          communes: [
            "Bordj T'har",
            "Boudria Beniyadjis",
            "Bouraoui Belhadef",
            "Boussif Ouled Askeur",
            "Chahna",
            "Chekfa",
            "Djemaa Beni Habibi",
            "Djimla",
            "El Ancer",
            "El Aouana",
            "El Kennar Nouchfi",
            "El Milia",
            "Emir Abdelkader",
            "Erraguene Souissi",
            "Ghebala",
            "Jijel",
            "Kaous",
            "Khiri Oued Adjoul",
            "Oudjana",
            "Ouled Rabah",
            "Ouled Yahia Khadrouch",
            "Selma Benziada",
            "Settara",
            "Sidi Abdelaziz",
            "Sidi Marouf",
            "Taher",
            "Texenna",
            "Ziama Mansouriah",
          ],
        },
        "19": {
          name: "Setif",
          communes: [
            "Ain Abessa",
            "Ain Arnat",
            "Ain Azel",
            "Ain El Kebira",
            "Ain Lahdjar",
            "Ain Oulmene",
            "Ain-Legradj",
            "Ain-Roua",
            "Ain-Sebt",
            "Ait Naoual Mezada",
            "Ait-Tizi",
            "Amoucha",
            "Babor",
            "Bazer-Sakra",
            "Beidha Bordj",
            "Bellaa",
            "Beni Chebana",
            "Beni Fouda",
            "Beni Ourtilane",
            "Beni Oussine",
            "Beni-Aziz",
            "Beni-Mouhli",
            "Bir Haddada",
            "Bir-El-Arch",
            "Bouandas",
            "Bougaa",
            "Bousselam",
            "Boutaleb",
            "Dehamcha",
            "Djemila",
            "Draa-Kebila",
            "El Eulma",
            "El Ouricia",
            "El-Ouldja",
            "Guellal",
            "Guelta Zerka",
            "Guenzet",
            "Guidjel",
            "Hamam Soukhna",
            "Hamma",
            "Hammam Guergour",
            "Harbil",
            "Kasr El Abtal",
            "Maaouia",
            "Maouaklane",
            "Mezloug",
            "Oued El Bared",
            "Ouled Addouane",
            "Ouled Sabor",
            "Ouled Si Ahmed",
            "Ouled Tebben",
            "Rosfa",
            "Salah Bey",
            "Serdj-El-Ghoul",
            "Setif",
            "Tachouda",
            "Tala-Ifacene",
            "Taya",
            "Tella",
            "Tizi N'bechar",
          ],
        },
        "20": {
          name: "Saida",
          communes: [
            "Ain El Hadjar",
            "Ain Sekhouna",
            "Ain Soltane",
            "Doui Thabet",
            "El Hassasna",
            "Hounet",
            "Maamora",
            "Moulay Larbi",
            "Ouled Brahim",
            "Ouled Khaled",
            "Saida",
            "Sidi Ahmed",
            "Sidi Amar",
            "Sidi Boubekeur",
            "Tircine",
            "Youb",
          ],
        },
        "21": {
          name: "Skikda",
          communes: [
            "Ain Bouziane",
            "Ain Charchar",
            "Ain Kechra",
            "Ain Zouit",
            "Azzaba",
            "Bekkouche Lakhdar",
            "Ben Azzouz",
            "Beni Bechir",
            "Beni Oulbane",
            "Beni Zid",
            "Bin El Ouiden",
            "Bouchetata",
            "Cheraia",
            "Collo",
            "Djendel Saadi Mohamed",
            "El Arrouch",
            "El Ghedir",
            "El Hadaiek",
            "El Marsa",
            "Emjez Edchich",
            "Es Sebt",
            "Filfila",
            "Hammadi Krouma",
            "Kanoua",
            "Kerkara",
            "Khenag Maoune",
            "Oued Zhour",
            "Ouldja Boulbalout",
            "Ouled Attia",
            "Ouled Habbaba",
            "Oum Toub",
            "Ramdane Djamel",
            "Salah Bouchaour",
            "Sidi Mezghiche",
            "Skikda",
            "Tamalous",
            "Zerdezas",
            "Zitouna",
          ],
        },
        "22": {
          name: "Sidi Bel Abbes",
          communes: [
            "Ain- Adden",
            "Ain El Berd",
            "Ain Kada",
            "Ain Thrid",
            "Ain Tindamine",
            "Amarnas",
            "Bedrabine El Mokrani",
            "Belarbi",
            "Ben Badis",
            "Benachiba Chelia",
            "Bir El Hammam",
            "Boudjebaa El Bordj",
            "Boukhanefis",
            "Chetouane Belaila",
            "Dhaya",
            "El Hacaiba",
            "Hassi Dahou",
            "Hassi Zahana",
            "Lamtar",
            "Makedra",
            "Marhoum",
            "M'cid",
            "Merine",
            "Mezaourou",
            "Mostefa  Ben Brahim",
            "Moulay Slissen",
            "Oued Sebaa",
            "Oued Sefioun",
            "Oued Taourira",
            "Ras El Ma",
            "Redjem Demouche",
            "Sehala Thaoura",
            "Sfisef",
            "Sidi Ali Benyoub",
            "Sidi Ali Boussidi",
            "Sidi Bel-Abbes",
            "Sidi Brahim",
            "Sidi Chaib",
            "Sidi Dahou Zairs",
            "Sidi Hamadouche",
            "Sidi Khaled",
            "Sidi Lahcene",
            "Sidi Yacoub",
            "Tabia",
            "Taoudmout",
            "Tefessour",
            "Teghalimet",
            "Telagh",
            "Tenira",
            "Tessala",
            "Tilmouni",
            "Zerouala",
          ],
        },
        "23": {
          name: "Annaba",
          communes: [
            "Ain El Berda",
            "Annaba",
            "Berrahal",
            "Chetaibi",
            "Cheurfa",
            "El Bouni",
            "El Eulma",
            "El Hadjar",
            "Oued El Aneb",
            "Seraidi",
            "Sidi Amar",
            "Treat",
          ],
        },
        "24": {
          name: "Guelma",
          communes: [
            "Ain Ben Beida",
            "Ain Larbi",
            "Ain Makhlouf",
            "Ain Regada",
            "Ain Sandel",
            "Belkheir",
            "Bendjarah",
            "Beni Mezline",
            "Bordj Sabath",
            "Bou Hachana",
            "Bou Hamdane",
            "Bouati Mahmoud",
            "Bouchegouf",
            "Boumahra Ahmed",
            "Dahouara",
            "Djeballah Khemissi",
            "El Fedjoudj",
            "Guelaat Bou Sbaa",
            "Guelma",
            "Hammam Debagh",
            "Hammam N'bail",
            "Heliopolis",
            "Houari Boumedienne",
            "Khezaras",
            "Medjez Amar",
            "Medjez Sfa",
            "Nechmaya",
            "Oued Cheham",
            "Oued Ferragha",
            "Oued Zenati",
            "Ras El Agba",
            "Roknia",
            "Sellaoua Announa",
            "Tamlouka",
          ],
        },
        "25": {
          name: "Constantine",
          communes: [
            "Ain Abid",
            "Ain Smara",
            "Ben Badis",
            "Beni Hamidane",
            "Constantine",
            "Didouche Mourad",
            "El Khroub",
            "Hamma Bouziane",
            "Ibn Ziad",
            "Messaoud Boudjeriou",
            "Ouled Rahmoun",
            "Zighoud Youcef",
          ],
        },
        "26": {
          name: "Medea",
          communes: [
            "Aissaouia",
            "Baata",
            "Ben Chicao",
            "Beni Slimane",
            "Berrouaghia",
            "Bir Ben Laabed",
            "Bouaichoune",
            "Bouchrahil",
            "Bouskene",
            "Djouab",
            "Draa Esmar",
            "El Azizia",
            "El Guelbelkebir",
            "El Hamdania",
            "El Haoudane",
            "El Omaria",
            "Hannacha",
            "Khams Djouamaa",
            "Maghraoua",
            "Medea",
            "Medjebar",
            "Mezerana",
            "Mihoub",
            "Ouamri",
            "Oued Harbil",
            "Ouled Bouachra",
            "Ouled Brahim",
            "Ouled Deid",
            "Ouzera",
            "Rebaia",
            "Sedraya",
            "Seghouane",
            "Si Mahdjoub",
            "Sidi Naamane",
            "Sidi Rabie",
            "Sidi Zahar",
            "Sidi Ziane",
            "Souagui",
            "Tablat",
            "Tamesguida",
            "Tizi Mahdi",
            "Tletat Ed Douair",
            "Zoubiria",
          ],
        },
        "27": {
          name: "Mostaganem",
          communes: [
            "Achaacha",
            "Ain-Boudinar",
            "Ain-Nouissy",
            "Ain-Sidi Cherif",
            "Ain-Tedles",
            "Benabdelmalek Ramdane",
            "Bouguirat",
            "Fornaka",
            "Hadjadj",
            "Hassi Mameche",
            "Hassiane",
            "Khadra",
            "Kheir-Eddine",
            "Mansourah",
            "Mazagran",
            "Mesra",
            "Mostaganem",
            "Nekmaria",
            "Oued El Kheir",
            "Ouled Boughalem",
            "Ouled-Maalah",
            "Safsaf",
            "Sayada",
            "Sidi Ali",
            "Sidi Belaattar",
            "Sidi-Lakhdar",
            "Sirat",
            "Souaflia",
            "Sour",
            "Stidia",
            "Tazgait",
            "Touahria",
          ],
        },
        "28": {
          name: "M'Sila",
          communes: [
            "Ain El Hadjel",
            "Ain Khadra",
            "Belaiba",
            "Beni Ilmane",
            "Berhoum",
            "Bouti Sayeh",
            "Chellal",
            "Dehahna",
            "Djebel Messaad",
            "El Houamed",
            "Hammam Dalaa",
            "Khettouti Sed-El-Jir",
            "Khoubana",
            "Magra",
            "M'cif",
            "M'sila",
            "Ouanougha",
            "Ouled Addi Guebala",
            "Ouled Derradj",
            "Ouled Madhi",
            "Ouled Mansour",
            "Sidi Aissa",
            "Souamaa",
            "Tarmount",
          ],
        },
        "29": {
          name: "Mascara",
          communes: [
            "Ain Fares",
            "Ain Fekan",
            "Ain Ferah",
            "Ain Frass",
            "Alaimia",
            "Aouf",
            "Benian",
            "Bou Henni",
            "Bouhanifia",
            "Chorfa",
            "El Bordj",
            "El Gaada",
            "El Ghomri",
            "El Gueitena",
            "El Hachem",
            "El Keurt",
            "El Mamounia",
            "El Menaouer",
            "Ferraguig",
            "Froha",
            "Gharrous",
            "Ghriss",
            "Guerdjoum",
            "Hacine",
            "Khalouia",
            "Makhda",
            "Maoussa",
            "Mascara",
            "Matemore",
            "Mocta-Douz",
            "Mohammadia",
            "Nesmot",
            "Oggaz",
            "Oued El Abtal",
            "Oued Taria",
            "Ras El Ain Amirouche",
            "Sedjerara",
            "Sehailia",
            "Sidi Abdeldjebar",
            "Sidi Abdelmoumene",
            "Sidi Boussaid",
            "Sidi Kada",
            "Sig",
            "Tighennif",
            "Tizi",
            "Zahana",
            "Zelamta",
          ],
        },
        "30": {
          name: "Ouargla",
          communes: [
            "Ain Beida",
            "El Borma",
            "Hassi Ben Abdellah",
            "Hassi Messaoud",
            "N'goussa",
            "Ouargla",
            "Rouissat",
            "Sidi Khouiled",
          ],
        },
        "31": {
          name: "Oran",
          communes: [
            "Ain Biya",
            "Ain Kerma",
            "Ain Turk",
            "Arzew",
            "Ben Freha",
            "Bethioua",
            "Bir El Djir",
            "Boufatis",
            "Bousfer",
            "Boutlelis",
            "El Ancor",
            "El Braya",
            "El Kerma",
            "Es Senia",
            "Gdyel",
            "Hassi Ben Okba",
            "Hassi Bounif",
            "Hassi Mefsoukh",
            "Marsat El Hadjadj",
            "Mers El Kebir",
            "Messerghin",
            "Oran",
            "Oued Tlelat",
            "Sidi Ben Yebka",
            "Sidi Chami",
            "Tafraoui",
          ],
        },
        "32": {
          name: "El Bayadh",
          communes: [
            "Ain El Orak",
            "Boualem",
            "Bougtoub",
            "El Bayadh",
            "El Bnoud",
            "El Kheiter",
            "El Mehara",
            "Kef El Ahmar",
            "Krakda",
            "Rogassa",
            "Sidi Ameur",
            "Sidi Slimane",
            "Sidi Tiffour",
            "Stitten",
            "Tousmouline",
          ],
        },
        "33": {
          name: "Illizi",
          communes: [
            "Bordj Omar Driss",
            "Debdeb",
            "Illizi",
            "In Amenas",
          ],
        },
        "34": {
          name: "Bordj Bou Arreridj",
          communes: [
            "Ain Taghrout",
            "Ain Tesra",
            "B. B. Arreridj",
            "Belimour",
            "Ben Daoud",
            "Bir Kasdali",
            "Bordj Ghedir",
            "Bordj Zemmoura",
            "Colla",
            "Djaafra",
            "El Achir",
            "El Annasseur",
            "El Euch",
            "El Main",
            "El M'hir",
            "Elhammadia",
            "Ghailasa",
            "Haraza",
            "Hasnaoua",
            "Khelil",
            "Ksour",
            "Mansoura",
            "Medjana",
            "Ouled Brahem",
            "Ouled Dahmane",
            "Ouled Sidi-Brahim",
            "Rabta",
            "Ras El Oued",
            "Sidi-Embarek",
            "Taglait",
            "Tassamert",
            "Tefreg",
            "Teniet En Nasr",
            "Tixter",
          ],
        },
        "35": {
          name: "Boumerdes",
          communes: [
            "Afir",
            "Ammal",
            "Baghlia",
            "Ben Choud",
            "Beni Amrane",
            "Bordj Menaiel",
            "Boudouaou",
            "Boudouaou El Bahri",
            "Boumerdes",
            "Bouzegza Keddara",
            "Chabet El Ameur",
            "Corso",
            "Dellys",
            "Djinet",
            "El Kharrouba",
            "Hammedi",
            "Isser",
            "Khemis El Khechna",
            "Larbatache",
            "Leghata",
            "Naciria",
            "Ouled Aissa",
            "Ouled Hedadj",
            "Ouled Moussa",
            "Si Mustapha",
            "Sidi Daoud",
            "Souk El Had",
            "Taourga",
            "Thenia",
            "Tidjelabine",
            "Timezrit",
            "Zemmouri",
          ],
        },
        "36": {
          name: "El Tarf",
          communes: [
            "Ain El Assel",
            "Ain Kerma",
            "Asfour",
            "Ben M Hidi",
            "Berrihane",
            "Besbes",
            "Bougous",
            "Bouhadjar",
            "Bouteldja",
            "Chebaita Mokhtar",
            "Chefia",
            "Chihani",
            "Drean",
            "Echatt",
            "El Aioun",
            "El Kala",
            "El Tarf",
            "Hammam Beni Salah",
            "Lac Des Oiseaux",
            "Oued Zitoun",
            "Raml Souk",
            "Souarekh",
            "Zerizer",
            "Zitouna",
          ],
        },
        "37": {
          name: "Tindouf",
          communes: [
            "Oum El Assel",
            "Tindouf",
          ],
        },
        "38": {
          name: "Tissemsilt",
          communes: [
            "Ammari",
            "Beni Chaib",
            "Beni Lahcene",
            "Bordj Bounaama",
            "Bordj El Emir Abdelkader",
            "Boucaid",
            "Khemisti",
            "Larbaa",
            "Lardjem",
            "Layoune",
            "Lazharia",
            "Maacem",
            "Melaab",
            "Ouled Bessam",
            "Sidi Abed",
            "Sidi Boutouchent",
            "Sidi Lantri",
            "Sidi Slimane",
            "Tamellahet",
            "Theniet El Had",
            "Tissemsilt",
            "Youssoufia",
          ],
        },
        "39": {
          name: "El Oued",
          communes: [
            "Bayadha",
            "Ben Guecha",
            "Debila",
            "Douar El Maa",
            "El Ogla",
            "El-Oued",
            "Guemar",
            "Hamraia",
            "Hassani Abdelkrim",
            "Hassi Khalifa",
            "Kouinine",
            "Magrane",
            "Mih Ouansa",
            "Nakhla",
            "Oued El Alenda",
            "Ourmes",
            "Reguiba",
            "Robbah",
            "Sidi Aoun",
            "Taghzout",
            "Taleb Larbi",
            "Trifaoui",
          ],
        },
        "40": {
          name: "Khenchela",
          communes: [
            "Ain Touila",
            "Babar",
            "Baghai",
            "Bouhmama",
            "Chechar",
            "Chelia",
            "Djellal",
            "El Hamma",
            "El Mahmal",
            "El Oueldja",
            "Ensigha",
            "Kais",
            "Khenchela",
            "Khirane",
            "M'sara",
            "M'toussa",
            "Ouled Rechache",
            "Remila",
            "Tamza",
            "Taouzianat",
            "Yabous",
          ],
        },
        "41": {
          name: "Souk Ahras",
          communes: [
            "Ain Soltane",
            "Ain Zana",
            "Bir Bouhouche",
            "Drea",
            "Haddada",
            "Hanencha",
            "Khedara",
            "Khemissa",
            "Machroha",
            "M'daourouche",
            "Merahna",
            "Oued Kebrit",
            "Ouillen",
            "Ouled Driss",
            "Ouled Moumen",
            "Oum El Adhaim",
            "Ragouba",
            "Safel El Ouiden",
            "Sedrata",
            "Sidi Fredj",
            "Souk Ahras",
            "Taoura",
            "Terraguelt",
            "Tiffech",
            "Zaarouria",
            "Zouabi",
          ],
        },
        "42": {
          name: "Tipaza",
          communes: [
            "Aghbal",
            "Ahmer El Ain",
            "Ain Tagourait",
            "Attatba",
            "Beni Mileuk",
            "Bou Haroun",
            "Bou Ismail",
            "Bourkika",
            "Chaiba",
            "Cherchell",
            "Damous",
            "Douaouda",
            "Fouka",
            "Gouraya",
            "Hadjout",
            "Hadjret Ennous",
            "Khemisti",
            "Kolea",
            "Larhat",
            "Menaceur",
            "Merad",
            "Messelmoun",
            "Nador",
            "Sidi Ghiles",
            "Sidi Rached",
            "Sidi Semiane",
            "Sidi-Amar",
            "Tipaza",
          ],
        },
        "43": {
          name: "Mila",
          communes: [
            "Ahmed Rachedi",
            "Ain Beida Harriche",
            "Ain Mellouk",
            "Ain Tine",
            "Amira Arres",
            "Benyahia Abderrahmane",
            "Bouhatem",
            "Chelghoum Laid",
            "Chigara",
            "Derrahi Bousselah",
            "El Ayadi Barbes",
            "El Mechira",
            "Ferdjioua",
            "Grarem Gouga",
            "Hamala",
            "Mila",
            "Minar Zarza",
            "Oued Athmenia",
            "Oued Endja",
            "Oued Seguen",
            "Ouled Khalouf",
            "Rouached",
            "Sidi Khelifa",
            "Sidi Merouane",
            "Tadjenanet",
            "Tassadane Haddada",
            "Tassala Lematai",
            "Teleghma",
            "Terrai Bainen",
            "Tiberguent",
            "Yahia Beniguecha",
            "Zeghaia",
          ],
        },
        "44": {
          name: "Ain Defla",
          communes: [
            "Ain-Benian",
            "Ain-Bouyahia",
            "Ain-Defla",
            "Ain-Lechiakh",
            "Ain-Soltane",
            "Ain-Torki",
            "Arib",
            "Bathia",
            "Belaas",
            "Ben Allal",
            "Birbouche",
            "Bir-Ould-Khelifa",
            "Bordj-Emir-Khaled",
            "Boumedfaa",
            "Bourached",
            "Djelida",
            "Djemaa Ouled Cheikh",
            "Djendel",
            "El-Abadia",
            "El-Amra",
            "El-Attaf",
            "El-Maine",
            "Hammam-Righa",
            "Hassania",
            "Hoceinia",
            "Khemis-Miliana",
            "Mekhatria",
            "Miliana",
            "Oued Chorfa",
            "Oued Djemaa",
            "Rouina",
            "Sidi-Lakhdar",
            "Tacheta Zegagha",
            "Tarik-Ibn-Ziad",
            "Tiberkanine",
            "Zeddine",
          ],
        },
        "45": {
          name: "Naama",
          communes: [
            "Ain Ben Khelil",
            "Ain Sefra",
            "Asla",
            "Djenienne Bourezg",
            "El Biodh",
            "Kasdir",
            "Makmen Ben Amar",
            "Mecheria",
            "Moghrar",
            "Naama",
            "Sfissifa",
            "Tiout",
          ],
        },
        "46": {
          name: "Ain Temouchent",
          communes: [
            "Aghlal",
            "Ain El Arbaa",
            "Ain Kihal",
            "Ain Temouchent",
            "Ain Tolba",
            "Aoubellil",
            "Beni Saf",
            "Bouzedjar",
            "Chaabat El Ham",
            "Chentouf",
            "El Amria",
            "El Maleh",
            "El Messaid",
            "Emir Abdelkader",
            "Hammam Bou Hadjar",
            "Hassasna",
            "Hassi El Ghella",
            "Oued Berkeche",
            "Oued Sebbah",
            "Ouled Boudjemaa",
            "Ouled Kihal",
            "Oulhaca El Gheraba",
            "Sidi Ben Adda",
            "Sidi Boumediene",
            "Sidi Ouriache",
            "Sidi Safi",
            "Tamzoura",
            "Terga",
          ],
        },
        "47": {
          name: "Ghardaia",
          communes: [
            "Berriane",
            "Bounoura",
            "Dhayet Bendhahoua",
            "El Atteuf",
            "El Guerrara",
            "Ghardaia",
            "Mansoura",
            "Metlili",
            "Sebseb",
            "Zelfana",
          ],
        },
        "48": {
          name: "Relizane",
          communes: [
            "Ain Rahma",
            "Ain-Tarek",
            "Ammi Moussa",
            "Belaassel Bouzagza",
            "Bendaoud",
            "Beni Dergoun",
            "Beni Zentis",
            "Dar Ben Abdelah",
            "Djidiouia",
            "El Hassi",
            "El H'madna",
            "El Ouldja",
            "El-Guettar",
            "El-Matmar",
            "Had Echkalla",
            "Hamri",
            "Kalaa",
            "Lahlef",
            "Mazouna",
            "Mediouna",
            "Mendes",
            "Merdja Sidi Abed",
            "Ouarizane",
            "Oued El Djemaa",
            "Oued Essalem",
            "Oued-Rhiou",
            "Ouled Aiche",
            "Ouled Sidi Mihoub",
            "Ramka",
            "Relizane",
            "Sidi Khettab",
            "Sidi Lazreg",
            "Sidi M'hamed Benali",
            "Sidi M'hamed Benaouda",
            "Sidi Saada",
            "Souk El Had",
            "Yellel",
            "Zemmoura",
          ],
        },
        "49": {
          name: "Timimoun",
          communes: [
            "Aougrout",
            "Charouine",
            "Deldoul",
            "Ksar Kaddour",
            "Metarfa",
            "Ouled Aissa",
            "Ouled Said",
            "Talmine",
            "Timimoun",
            "Tinerkouk",
          ],
        },
        "50": {
          name: "Bordj Badji Mokhtar",
          communes: [
            "Bordj Badji Mokhtar",
            "Timiaouine",
          ],
        },
        "51": {
          name: "Ouled Djellal",
          communes: [
            "Besbes",
            "Chaiba",
            "Doucen",
            "Ouled Djellal",
            "Ras El Miad",
            "Sidi Khaled",
          ],
        },
        "52": {
          name: "Beni Abbes",
          communes: [
            "Beni-Abbes",
            "Beni-Ikhlef",
            "El Ouata",
            "Igli",
            "Kerzaz",
            "Ksabi",
            "Ouled-Khodeir",
            "Tamtert",
            "Timoudi",
          ],
        },
        "53": {
          name: "In Salah",
          communes: [
            "Ain Salah",
            "Foggaret Ezzoua",
            "Inghar",
          ],
        },
        "54": {
          name: "In Guezzam",
          communes: [
            "Ain Guezzam",
            "Tin Zouatine",
          ],
        },
        "55": {
          name: "Touggourt",
          communes: [
            "Benaceur",
            "Blidet Amor",
            "El Alia",
            "El-Hadjira",
            "Megarine",
            "M'naguer",
            "Nezla",
            "Sidi Slimane",
            "Taibet",
            "Tebesbest",
            "Temacine",
            "Touggourt",
            "Zaouia El Abidia",
          ],
        },
        "56": {
          name: "Djanet",
          communes: [
            "Bordj El Haouass",
            "Djanet",
          ],
        },
        "57": {
          name: "El M'Ghair",
          communes: [
            "Djamaa",
            "El-M'ghaier",
            "M'rara",
            "Oum Touyour",
            "Sidi Amrane",
            "Sidi Khelil",
            "Still",
            "Tenedla",
          ],
        },
        "58": {
          name: "El Meniaa",
          communes: [
            "El Meniaa",
            "Hassi Fehal",
            "Hassi Gara",
          ],
        },
        "59": {
          name: "Aflou",
          communes: [
            "Aflou",
            "Ain Sidi Ali",
            "Brida",
            "El Beidha",
            "El Ghicha",
            "Gueltat Sidi Saad",
            "Hadj Mechri",
            "Oued Morra",
            "Oued M'zi",
            "Sebgag",
            "Sidi Bouzid",
            "Taouiala",
          ],
        },
        "60": {
          name: "El Abiodh Sidi Cheikh",
          communes: [
            "Arbaouat",
            "Boussemghoun",
            "Brezina",
            "Cheguig",
            "Chellala",
            "Ghassoul",
            "Labiodh Sidi Cheikh",
          ],
        },
        "61": {
          name: "El Aricha",
          communes: [
            "Bouihi",
            "El Aricha",
            "El Gor",
            "Sidi Djillali",
          ],
        },
        "62": {
          name: "El Kantara",
          communes: [
            "Ain Zaatout",
            "Branis",
            "Djemorah",
            "El Kantara",
            "El Outaya",
          ],
        },
        "63": {
          name: "Barika",
          communes: [
            "Azil Abedelkader",
            "Barika",
            "Bitam",
            "Djezzar",
            "M Doukal",
            "Ouled Ammar",
            "Seggana",
            "Tilatou",
          ],
        },
        "64": {
          name: "Bou Saada",
          communes: [
            "Ain El Melh",
            "Ain Fares",
            "Ain Rich",
            "Ben Srour",
            "Benzouh",
            "Bir Foda",
            "Bou Saada",
            "El Hamel",
            "Maadid",
            "Maarif",
            "Medjedel",
            "Menaa",
            "Mohamed Boudiaf",
            "M'tarfa",
            "Ouled Sidi Brahim",
            "Ouled Slimane",
            "Oulteme",
            "Sidi Ameur",
            "Sidi Hadjeres",
            "Sidi M'hamed",
            "Slim",
            "Tamsa",
            "Zarzour",
          ],
        },
        "65": {
          name: "Bir El Ater",
          communes: [
            "Bir-El-Ater",
            "El Ogla El Malha",
            "Ferkane",
            "Negrine",
          ],
        },
        "66": {
          name: "Ksar El Boukhari",
          communes: [
            "Ain Boucif",
            "Ain Ouksir",
            "Aziz",
            "Boghar",
            "Bouaiche",
            "Boughzoul",
            "Chabounia",
            "Chelalet El Adhaoura",
            "Cheniguel",
            "Derrag",
            "El Ouinet",
            "Kef Lakhdar",
            "Ksar El Boukhari",
            "M'fatha",
            "Ouled Antar",
            "Ouled Emaaraf",
            "Ouled Hellal",
            "Oum El Djellil",
            "Saneg",
            "Sidi Demed",
            "Tafraout",
          ],
        },
        "67": {
          name: "Ksar Chellala",
          communes: [
            "Bougara",
            "Hamadia",
            "Ksar Chellala",
            "Rechaiga",
            "Serghine",
            "Zmalet El Emir Abdelkade",
          ],
        },
        "68": {
          name: "Ain Oussara",
          communes: [
            "Ain Fekka",
            "Ain Oussera",
            "Benhar",
            "Birine",
            "Bouira Lahdab",
            "El Khemis",
            "Guernini",
            "Had Sahary",
            "Hassi Fedoul",
            "Sidi Laadjel",
          ],
        },
        "69": {
          name: "Messaad",
          communes: [
            "Amourah",
            "Deldoul",
            "Faidh El Botma",
            "Guettara",
            "Messaad",
            "Oum Laadham",
            "Sed Rahal",
            "Selmana",
          ],
        },
      };

      /* ══════════════════════════════════════════════════════
         CUSTOM DROPDOWN (Wilaya / Commune)
      ══════════════════════════════════════════════════════ */
      let selectedWilayaCode = "";
      let selectedCommuneName = "";
      const dropdownState = { wilaya: false, commune: false };

      function toggleCustomSelect(name) {
        const trigger = document.getElementById(name + "Trigger");
        const list = document.getElementById(name + "Dropdown");
        if (trigger.getAttribute("aria-disabled") === "true") return;
        const isOpen = !dropdownState[name];
        closeAllDropdowns();
        if (isOpen) {
          dropdownState[name] = true;
          trigger.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
          list.classList.add("open");
          const searchInput = list.querySelector("input");
          if (searchInput) {
            searchInput.value = "";
            filterDropdown(name, "");
            setTimeout(() => searchInput.focus(), 50);
          }
        }
      }

      function closeAllDropdowns() {
        ["wilaya", "commune"].forEach((name) => {
          dropdownState[name] = false;
          const trigger = document.getElementById(name + "Trigger");
          const list = document.getElementById(name + "Dropdown");
          if (trigger) {
            trigger.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
          }
          if (list) list.classList.remove("open");
        });
      }

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select-wrap")) closeAllDropdowns();
        if (!e.target.closest("#desktopSearch")) {
          const dd = document.getElementById("searchDropdown");
          if (dd) dd.classList.remove("open");
        }
      });

      function handleDropdownKey(e, name) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCustomSelect(name);
        }
        if (e.key === "Escape") closeAllDropdowns();
      }

      function filterDropdown(name, query) {
        const optionsEl = document.getElementById(name + "Options");
        const allOpts = optionsEl.querySelectorAll(".dropdown-option");
        let visibleCount = 0;
        allOpts.forEach((opt) => {
          const match = opt.dataset.label
            .toLowerCase()
            .includes(query.toLowerCase());
          opt.style.display = match ? "" : "none";
          if (match) visibleCount++;
        });
        let emptyEl = optionsEl.querySelector(".dropdown-empty");
        if (!visibleCount) {
          if (!emptyEl) {
            emptyEl = document.createElement("div");
            emptyEl.className = "dropdown-empty";
            optionsEl.appendChild(emptyEl);
          }
          emptyEl.textContent = "No results found";
          emptyEl.style.display = "";
        } else if (emptyEl) emptyEl.style.display = "none";
      }

      function selectWilayaOption(code, label) {
        selectedWilayaCode = code;
        document.getElementById("wilayaLabel").textContent = label;
        const trigger = document.getElementById("wilayaTrigger");
        trigger.classList.remove("placeholder", "error-field");
        document.getElementById("wilayaErr").textContent = "";
        document
          .querySelectorAll("#wilayaOptions .dropdown-option")
          .forEach((o) => {
            const sel = o.dataset.value === code;
            o.classList.toggle("selected", sel);
            o.querySelector(".check-icon").style.display = sel
              ? "block"
              : "none";
          });
        closeAllDropdowns();
        populateCommune(code);
        updateDeliveryPriceDisplay();
        updateSummary();
      }

      function updateDeliveryPriceDisplay() {
        const costs = getDeliveryCost();
        const homePriceEl = document.querySelector(
          "#deliveryHome .delivery-option-price",
        );
        const officePriceEl = document.querySelector(
          "#deliveryOffice .delivery-option-price",
        );
        if (homePriceEl)
          homePriceEl.textContent = selectedWilayaCode
            ? `+${costs.home.toLocaleString("fr-DZ")} DA`
            : "—";
        if (officePriceEl)
          officePriceEl.textContent = selectedWilayaCode
            ? `+${costs.office.toLocaleString("fr-DZ")} DA`
            : "—";
      }

      function selectCommuneOption(name) {
        selectedCommuneName = name;
        document.getElementById("communeLabel").textContent = name;
        const trigger = document.getElementById("communeTrigger");
        trigger.classList.remove("placeholder", "error-field");
        document.getElementById("communeErr").textContent = "";
        document
          .querySelectorAll("#communeOptions .dropdown-option")
          .forEach((o) => {
            const sel = o.dataset.value === name;
            o.classList.toggle("selected", sel);
            o.querySelector(".check-icon").style.display = sel
              ? "block"
              : "none";
          });
        closeAllDropdowns();
      }

      function populateWilayas() {
        const optionsEl = document.getElementById("wilayaOptions");
        optionsEl.innerHTML = "";
        Object.entries(WILAYAS)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .forEach(([code, data]) => {
            const label = `${code} - ${data.name}`;
            const div = document.createElement("div");
            div.className = "dropdown-option";
            div.dataset.value = code;
            div.dataset.label = label;
            div.innerHTML = `<span>${label}</span><svg class="check-icon" style="display:none;flex-shrink:0;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
            div.onclick = () => selectWilayaOption(code, label);
            optionsEl.appendChild(div);
          });
      }

      function populateCommune(wilayaCode) {
        const trigger = document.getElementById("communeTrigger");
        const optionsEl = document.getElementById("communeOptions");
        optionsEl.innerHTML = "";
        selectedCommuneName = "";
        document.getElementById("communeLabel").textContent = "Select commune…";
        trigger.classList.add("placeholder");
        trigger.removeAttribute("aria-disabled");

        (WILAYAS[wilayaCode]?.communes || []).forEach((name) => {
          const div = document.createElement("div");
          div.className = "dropdown-option";
          div.dataset.value = name;
          div.dataset.label = name;
          div.innerHTML = `<span>${name}</span><svg class="check-icon" style="display:none;flex-shrink:0;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
          div.onclick = () => selectCommuneOption(name);
          optionsEl.appendChild(div);
        });
      }

      /* ══════════════════════════════════════════════════════
         FORM VALIDATION & SUBMIT
      ══════════════════════════════════════════════════════ */
      function validateField(id, errId, msg) {
        const el = document.getElementById(id);
        const err = document.getElementById(errId);
        const val = el ? el.value.trim() : "";
        if (!val) {
          if (el) el.classList.add("error");
          err.textContent = msg;
          return false;
        }
        if (el) el.classList.remove("error");
        err.textContent = "";
        return true;
      }

      function validateCustomField(value, errId, msg) {
        const err = document.getElementById(errId);
        const trigger = document.getElementById(
          errId.replace("Err", "Trigger"),
        );
        if (!value) {
          if (trigger) trigger.classList.add("error-field");
          err.textContent = msg;
          return false;
        }
        if (trigger) trigger.classList.remove("error-field");
        err.textContent = "";
        return true;
      }

      function submitOrder() {
        if (!selectedProduct || getCurrentStock() <= 0) return;
        // Bot checks
        if (document.getElementById("hp_website").value !== "") return;
        if (Date.now() - PAGE_LOAD_TIME < 4000) {
          showToast("Please review your order before submitting.");
          return;
        }

        let valid = true;
        valid =
          validateField(
            "firstName",
            "firstNameErr",
            "First name is required",
          ) && valid;
        valid =
          validateField("lastName", "lastNameErr", "Last name is required") &&
          valid;
        valid =
          validateField("phone", "phoneErr", "Phone number is required") &&
          valid;
        valid =
          validateCustomField(
            selectedWilayaCode,
            "wilayaErr",
            "Please select a wilaya",
          ) && valid;
        valid =
          validateCustomField(
            selectedCommuneName,
            "communeErr",
            "Please select a commune",
          ) && valid;

        const phoneEl = document.getElementById("phone");
        if (
          phoneEl.value &&
          !/^(05|06|07)[0-9]{8}$/.test(phoneEl.value.trim().replace(/\s/g, ""))
        ) {
          phoneEl.classList.add("error");
          document.getElementById("phoneErr").textContent =
            "Enter a valid Algerian phone number (05x, 06x or 07x)";
          valid = false;
        }

        if (!valid) {
          showToast("Please fill all required fields");
          return;
        }

        const p = selectedProduct;
        const cost = getDeliveryCost()[selectedDelivery];
        const variantPrice = getProductPrice(p, selectedVariantIndex);
        const subtotal = variantPrice * selectedQty;
        const { discount, freeDelivery } = getPromoDiscount(subtotal, cost);
        const deliveryCharge = freeDelivery ? 0 : cost;
        const totalNum = subtotal + deliveryCharge - discount;
        const total = totalNum.toLocaleString("fr-DZ");
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const address = document.getElementById("address").value.trim();
        const wilayaData = WILAYAS[selectedWilayaCode];
        const wilayaName = wilayaData ? wilayaData.name : selectedWilayaCode;
        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        const variantStr = v
          ? v.weight
            ? `${v.weight}${v.unit || ""}`
            : v.label || v.name || ""
          : "";

        fetch(SUPABASE_URL + "/functions/v1/submit-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + SUPABASE_ANON_KEY },
          body: JSON.stringify({
            action: "submitProductOrder",
            firstName,
            lastName,
            phone,
            address,
            wilaya: selectedWilayaCode
              ? `${selectedWilayaCode} - ${wilayaName}`
              : "",
            commune: selectedCommuneName,
            deliveryType: selectedDelivery,
            deliveryCost: deliveryCharge,
            promoCode: appliedPromos.map((pr) => pr.code).join(","),
            promoDiscount: discount,
            items: [
              {
                productId: p.id,
                name: p.name,
                flavor: selectedFlavor || "",
                variant: variantStr,
                qty: selectedQty,
                unitPrice: variantPrice,
                lineTotal: variantPrice * selectedQty,
              },
            ],
            subtotal,
            total: totalNum,
          }),
        }).catch(() => {});

        document.getElementById("successMsg").textContent =
          `Thank you ${firstName}! Your order for ${p.name} × ${selectedQty} — Total: ${total} DA. We'll call you shortly to confirm.`;
        document.getElementById("successOverlay").classList.add("show");
      }

      function closeSuccess() {
        document.getElementById("successOverlay").classList.remove("show");
        window.location.href = "/supplements/products";
      }

      /* ══════════════════════════════════════════════════════
         I18N
      ══════════════════════════════════════════════════════ */
      const i18n = {
        en: {
          "nav.home": "Home",
          "nav.products": "Products",
          "nav.contact": "Contact",
          "detail.weight": "SIZE",
          "detail.flavor": "Flavor",
          "detail.about": "About this product",
          "form.firstName": "First Name",
          "form.lastName": "Last Name",
          "form.phone": "Phone Number",
          "form.wilaya": "Wilaya",
          "form.commune": "Commune",
          "form.deliveryType": "Delivery Type",
          "form.address": "Address (Optional)",
          "form.homeDelivery": "🏠 Home Delivery",
          "form.officePick": "📦 Office Pickup",
          "form.deliveredDoor": "Delivered to your door",
          "form.pickupOffice": "Pickup at nearest office",
          "form.selectWilaya": "Select wilaya…",
          "form.selectWilayaFirst": "Select wilaya first",
          "form.orderNow": "Order Now",
          "form.orderSummary": "Order Summary",
          "form.product": "Product",
          "form.price": "Price",
          "form.delivery": "Delivery",
          "form.total": "Total",
          "form.addToCart": "ADD TO CART",
          "form.confirmOrder": "CONFIRM ORDER",
          "section.alsoLike": "You May Also Like",
          "footer.brand.desc":
            "Algeria's premier destination for authentic sports nutrition. We bring world-class supplements directly to your door.",
          "footer.links": "Quick Links",
          "footer.shipping": "Shipping Policy",
          "footer.returns": "Returns",
          "footer.categories": "Categories",
          "footer.contact": "Send a Message",
          "footer.rights": "All rights reserved.",
          "form.name": "Your Name",
          "form.email": "Email / Phone",
          "form.message": "Message",
          "form.send": "Send Message",
          "shipping.title": "Shipping Policy",
          "shipping.item1.title": "Nationwide Delivery",
          "shipping.item1.text": "We deliver to all 58 wilayas across Algeria via Imir Logistics.",
          "shipping.item2.title": "Free Delivery",
          "shipping.item2.text": "Orders over 15,000 DA enjoy free delivery!",
          "shipping.item3.title": "Standard Timing",
          "shipping.item3.text": "Orders are processed within 24 hours.",
          "returns.title": "Returns & Refunds",
          "returns.item1.title": "Return Policy",
          "returns.item1.text": "You have 1 day to return a product. Items must be unopened.",
          "returns.item2.title": "Easy Process",
          "returns.item2.text": "Contact us via WhatsApp or Instagram to initiate a return.",
          "returns.item3.title": "Refund Method",
          "returns.item3.text": "We offer exchanges for other products or store credit.",
          "toast.sent": "Message sent! We'll reply soon.",
          "footer.shop": "Shop",
          "footer.allProducts": "All Products",
          "footer.protein": "Protein",
          "footer.preworkout": "Pre-Workout",
          "footer.creatine": "Creatine",
          "footer.vitamins": "Vitamins",
          "footer.info": "Information",
          "footer.shipping": "Shipping Policy",
          "footer.returns": "Returns",
          "footer.faq": "FAQ",
          "footer.contact": "Contact Us",
          "footer.location": "Algiers, Algeria",
          "footer.rights": "All rights reserved.",
          "search.cancel": "Cancel",
          "breadcrumb.home": "Home",
          "breadcrumb.products": "Products",
          "success.title": "Order Placed!",
          "detail.bulkLabel": "Wholesale Pricing",
          "detail.bulkNotice": "Ordering 5 or more? Contact us on WhatsApp for a special wholesale discount!",
          "success.back": "Back to Products",
        },
        fr: {
          "nav.home": "Accueil",
          "nav.products": "Produits",
          "nav.contact": "Contact",
          "detail.weight": "Taille",
          "detail.flavor": "Saveur",
          "detail.about": "À propos du produit",
          "form.firstName": "Prénom",
          "form.lastName": "Nom",
          "form.phone": "Numéro de téléphone",
          "form.wilaya": "Wilaya",
          "form.address": "Adresse (Facultatif)",
          "form.commune": "Commune",
          "form.deliveryType": "Type de livraison",
          "form.homeDelivery": "🏠 Livraison à domicile",
          "form.officePick": "📦 Retrait en bureau",
          "form.deliveredDoor": "Livré chez vous",
          "form.pickupOffice": "Retrait au bureau le plus proche",
          "form.selectWilaya": "Choisir la wilaya…",
          "form.selectWilayaFirst": "Choisir une wilaya d'abord",
          "form.orderNow": "Commander Maintenant",
          "form.orderSummary": "Récapitulatif",
          "form.product": "Produit",
          "form.price": "Prix",
          "form.delivery": "Livraison",
          "form.total": "Total",
          "form.addToCart": "AJOUTER AU PANIER",
          "form.confirmOrder": "CONFIRMER LA COMMANDE",
          "section.alsoLike": "Vous Aimerez Aussi",
          "footer.brand.desc":
            "La première destination algérienne pour la nutrition sportive authentique.",
          "footer.links": "Liens Rapides",
          "footer.shipping": "Politique de livraison",
          "footer.returns": "Retours",
          "footer.categories": "Catégories",
          "footer.contact": "Envoyer un Message",
          "footer.rights": "Tous droits réservés.",
          "form.name": "Votre Nom",
          "form.email": "Email / Téléphone",
          "form.message": "Message",
          "form.send": "Envoyer",
          "shipping.title": "Politique de livraison",
          "shipping.item1.title": "Livraison Nationale",
          "shipping.item1.text": "Nous livrons dans les 58 wilayas d'Algérie via Imir Logistics.",
          "shipping.item2.title": "Livraison Gratuite",
          "shipping.item2.text": "Les commandes de plus de 15 000 DA bénéficient de la livraison gratuite !",
          "shipping.item3.title": "Délais Standards",
          "shipping.item3.text": "Les commandes sont traitées sous 24h.",
          "returns.title": "Retours & Remboursements",
          "returns.item1.title": "Politique de Retour",
          "returns.item1.text": "Vous avez 1 jour pour retourner un produit.",
          "returns.item2.title": "Processus Facile",
          "returns.item2.text": "Contactez-nous via WhatsApp or Instagram.",
          "returns.item3.title": "Mode de Remboursement",
          "returns.item3.text": "Nous proposons des échanges ou un avoir.",
          "toast.sent": "Message envoyé!",
          "footer.shop": "Boutique",
          "footer.allProducts": "Tous les Produits",
          "footer.protein": "Protéine",
          "footer.preworkout": "Pré-Entraînement",
          "footer.creatine": "Créatine",
          "footer.vitamins": "Vitamines",
          "footer.info": "Informations",
          "footer.shipping": "Politique de livraison",
          "footer.returns": "Retours",
          "footer.faq": "FAQ",
          "footer.contact": "Contactez-nous",
          "footer.location": "Alger, Algérie",
          "footer.rights": "Tous droits réservés.",
          "search.cancel": "Annuler",
          "breadcrumb.home": "Accueil",
          "breadcrumb.products": "Produits",
          "detail.bulkLabel": "Prix de Gros",
          "detail.bulkNotice": "Vous en commandez 3 ou plus ? Contactez-nous sur WhatsApp pour une remise spéciale !",
          "success.title": "Commande Passée !",
          "success.back": "Retour aux Produits",
        },
        ar: {
          "nav.home": "الرئيسية",
          "nav.products": "المنتجات",
          "nav.contact": "اتصل بنا",
          "detail.weight": "الحجم",
          "detail.flavor": "النكهة",
          "detail.about": "عن هذا المنتج",
          "form.firstName": "الاسم الأول",
          "form.lastName": "اللقب",
          "form.phone": "رقم الهاتف",
          "form.wilaya": "الولاية",
          "form.address": "العنوان (اختياري)",
          "form.commune": "البلدية",
          "form.deliveryType": "نوع التوصيل",
          "form.homeDelivery": "🏠 توصيل للمنزل",
          "form.officePick": "📦 استلام من المكتب",
          "form.deliveredDoor": "يُسلَّم إلى بابك",
          "form.pickupOffice": "الاستلام من أقرب مكتب",
          "form.selectWilaya": "اختر الولاية…",
          "form.selectWilayaFirst": "اختر الولاية أولاً",
          "form.orderNow": "اطلب الآن",
          "form.orderSummary": "ملخص الطلب",
          "form.product": "المنتج",
          "form.price": "السعر",
          "form.delivery": "التوصيل",
          "form.total": "المجموع",
          "form.addToCart": "أضف إلى السلة",
          "form.confirmOrder": "تأكيد الطلب",
          "section.alsoLike": "قد يعجبك أيضاً",
          "footer.brand.desc":
            "وجهتك الأولى في الجزائر للمكملات الرياضية الأصيلة.",
          "footer.links": "روابط سريعة",
          "footer.shipping": "سياسة الشحن",
          "footer.returns": "الإرجاع",
          "footer.categories": "الفئات",
          "footer.contact": "أرسل رسالة",
          "footer.rights": "جميع الحقوق محفوظة.",
          "form.name": "اسمك",
          "form.email": "البريد / الهاتف",
          "form.message": "رسالتك",
          "form.send": "إرسال",
          "shipping.title": "سياسة الشحن",
          "shipping.item1.title": "توصيل وطني",
          "shipping.item1.text": "نوصّل إلى جميع الولايات الـ 58 في الجزائر عبر إيمير للوجستيك.",
          "shipping.item2.title": "توصيل مجاني",
          "shipping.item2.text": "الطلبات التي تتجاوز 15,000 دج تستفيد من توصيل مجاني!",
          "shipping.item3.title": "التوقيت القياسي",
          "shipping.item3.text": "يتم معالجة الطلبات خلال 24 ساعة.",
          "returns.title": "الإرجاع والاسترداد",
          "returns.item1.title": "سياسة الإرجاع",
          "returns.item1.text": "لديك 1 أيام لإرجاع المنتج. يجب أن تكون المنتجات غير مفتوحة.",
          "returns.item2.title": "عملية سهلة",
          "returns.item2.text": "اتصل بنا عبر واتساب أو إنستغرام لبدء عملية الإرجاع.",
          "returns.item3.title": "طريقة الاسترداد",
          "returns.item3.text": "نقدم خيارات الاستبدال بمنتجات أخرى أو رصيد متجر.",
          "toast.sent": "تم إرسال رسالتك!",
          "footer.shop": "المتجر",
          "footer.allProducts": "جميع المنتجات",
          "footer.protein": "البروتين",
          "footer.preworkout": "ما قبل التمرين",
          "footer.creatine": "الكرياتين",
          "footer.vitamins": "الفيتامينات",
          "footer.info": "معلومات",
          "footer.shipping": "سياسة الشحن",
          "footer.returns": "الإرجاع",
          "footer.faq": "الأسئلة الشائعة",
          "footer.contact": "اتصل بنا",
          "footer.location": "الجزائر العاصمة، الجزائر",
          "footer.rights": "جميع الحقوق محفوظة.",
          "search.cancel": "إلغاء",
          "breadcrumb.home": "الرئيسية",
          "breadcrumb.products": "المنتجات",
          "detail.bulkLabel": "سعر الجملة",
          "detail.bulkNotice": "هل تطلب 3 قطع أو أكثر؟ اتصل بنا عبر واتساب للحصول على خصم خاص للجملة!",
          "success.title": "تم تقديم الطلب!",
          "success.back": "العودة إلى المنتجات",
        },
      };

      let currentLang = "en";
      function switchLang(lang) {
        localStorage.setItem("bybens_lang", lang);
        currentLang = lang;
        const t = i18n[lang];
        const isAr = lang === "ar";
        document.documentElement.lang = lang;
        document.documentElement.dir = isAr ? "rtl" : "ltr";
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          const key = el.getAttribute("data-i18n");
          if (t[key] !== undefined) {
            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
              el.placeholder = t[key];
            } else el.textContent = t[key];
          }
        });
        document.querySelectorAll(".lang-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.lang === lang);
        });
        const wt = document.getElementById("wilayaTrigger");
        if (wt && wt.classList.contains("placeholder"))
          document.getElementById("wilayaLabel").textContent =
            t["form.selectWilaya"] || "Select wilaya…";
        const ct = document.getElementById("communeTrigger");
        if (ct && ct.classList.contains("placeholder")) {
          const dis = ct.getAttribute("aria-disabled") === "true";
          document.getElementById("communeLabel").textContent = dis
            ? t["form.selectWilayaFirst"] || "Select wilaya first"
            : t["form.selectWilaya"] || "Select commune…";
        }
      }

      /* ══════════════════════════════════════════════════════
         UI HELPERS
      ══════════════════════════════════════════════════════ */
      /* ══ CART — localStorage persistence ══ */
      const CART_KEY = "bybens_cart";
      function cartGet() {
        try {
          return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch {
          return [];
        }
      }
      function cartSave(items) {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
      }
      function cartCount() {
        return cartGet().reduce((s, i) => s + i.qty, 0);
      }
      function cartUpdateBadge() {
        const n = cartCount();
        const b = document.getElementById("cartBadge");
        if (!b) return;
        b.textContent = n;
        b.style.display = n === 0 ? "none" : "";
      }
      let _cartOpen = false;
      function toggleCart() {
        _cartOpen = !_cartOpen;
        document
          .getElementById("cartDrawer")
          .classList.toggle("open", _cartOpen);
        document
          .getElementById("cartOverlay")
          .classList.toggle("open", _cartOpen);
        document.body.style.overflow = _cartOpen ? "hidden" : "";
        if (_cartOpen) _renderCartDrawer();
      }
      function _renderCartDrawer() {
        const items = cartGet();
        const count = items.reduce((s, i) => s + i.qty, 0);
        const total = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
        document.getElementById("cartDrawerCount").textContent =
          `${count} item${count !== 1 ? "s" : ""}`;
        document.getElementById("cartDrawerTotal").textContent =
          total.toLocaleString();
        const body = document.getElementById("cartDrawerBody");
        if (!items.length) {
          body.innerHTML = `<div class="cart-empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><p>Your cart is empty</p></div>`;
          return;
        }
        body.innerHTML = items
          .map(
            (item, idx) => `
          <div class="cart-row">
            <div class="cart-row-img">${item.imageUrl ? `<img src="${Array.isArray(item.imageUrl) ? item.imageUrl[0] : item.imageUrl}" alt="${item.name}">` : ""}</div>
            <div class="cart-row-info">
              <div class="cart-row-name">${item.name}</div>
              <div class="cart-row-meta">${[item.flavor, item.variant].filter(Boolean).join(" · ")}</div>
              <div class="cart-row-bot">
                <div class="ciq">
                  <button class="ciq-btn" onclick="cartQty(${idx},-1)">&#8722;</button>
                  <span class="ciq-val">${item.qty}</span>
                  <button class="ciq-btn" onclick="cartQty(${idx},1)">+</button>
                </div>
                <span class="cart-row-price">${(item.unitPrice * item.qty).toLocaleString()} DA</span>
              </div>
            </div>
            <button class="cart-row-del" onclick="cartRemove(${idx})" aria-label="Remove">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>`,
          )
          .join("");
      }
      function _itemMaxQty(item) {
        const pid = item.productId || item.id;
        const product = _allProducts.find(
          (p) => p.id === pid || p.productId === pid,
        );
        if (!product) return 5;
        const variants = parseField(product.variants);
        const variantLabels = variants.map((v) =>
          typeof v === "object"
            ? v.weight
              ? `${v.weight}${v.unit || ""}`
              : v.label || v.name || ""
            : String(v),
        );
        const vIdx = Math.max(0, variantLabels.indexOf(item.variant));
        const v = variants[vIdx];
        if (v && typeof v === "object" && v.flavorStock && item.flavor) {
          const s = Number(v.flavorStock[item.flavor]);
          return Math.min(5, isNaN(s) ? 5 : Math.max(1, s));
        }
        const flavorObjs = parseField(product.flavors).map((f) =>
          typeof f === "object"
            ? { name: f.name || "", qty: f.qty || 0 }
            : { name: String(f), qty: 0 },
        );
        if (flavorObjs.some((fo) => fo.qty > 0) && item.flavor) {
          const fo = flavorObjs.find((f) => f.name === item.flavor);
          if (fo) return Math.min(5, Math.max(1, fo.qty));
        }
        const stock = Number(product.stock);
        return Math.min(5, isNaN(stock) || stock <= 0 ? 5 : Math.max(1, stock));
      }

      function cartQty(idx, d) {
        const items = cartGet();
        if (!items[idx]) return;
        items[idx].qty = Math.min(
          _itemMaxQty(items[idx]),
          Math.max(1, items[idx].qty + d),
        );
        cartSave(items);
        cartUpdateBadge();
        _renderCartDrawer();
      }
      function cartRemove(idx) {
        const items = cartGet();
        items.splice(idx, 1);
        cartSave(items);
        cartUpdateBadge();
        _renderCartDrawer();
      }
      function cartCheckout() {
        window.location.href = "/supplements/checkout";
      }
      function addToCartFromDetail() {
        if (!selectedProduct) return;
        const p = selectedProduct;
        if (getCurrentStock() <= 0) return;
        const variants = parseField(p.variants);
        const v = variants[selectedVariantIndex];
        const unitPrice = getProductPrice(p, selectedVariantIndex);
        let variantLabel = "";
        if (v && typeof v === "object")
          variantLabel = v.weight ? `${v.weight}${v.unit || ""}` : "";
        const items = cartGet();
        const key = `${p.id}__${selectedVariantIndex}__${selectedFlavor}`;
        const existing = items.find((i) => i.key === key);
        if (existing) {
          existing.qty = Math.min(
            _itemMaxQty(existing),
            existing.qty + selectedQty,
          );
        } else {
          items.push({
            key,
            id: p.id,
            name: p.name,
            variant: variantLabel,
            flavor: selectedFlavor || "",
            unitPrice,
            qty: selectedQty,
            imageUrl:
              (Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl) || "",
          });
        }
        cartSave(items);
        cartUpdateBadge();
        // Open cart drawer to confirm
        if (!_cartOpen) toggleCart();
        else _renderCartDrawer();
      }

      /* ── ADD-TO-CART MODAL (also-like) ── */
      let _atcProduct = null,
        _atcQty = 1,
        _atcFlavor = "",
        _atcFlavorObjs = [],
        _atcVariantIdx = 0;
      function openAddToCartModal(productId) {
        const p = _allProducts.find((x) => x.id === productId);
        if (!p) return;
        _atcProduct = p;
        _atcQty = 1;
        _atcFlavor = "";
        _atcVariantIdx = 0;
        const _atcImg0 = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
        document.getElementById("atcImg").innerHTML = _atcImg0
          ? `<img src="${_atcImg0}" alt="${p.name}">`
          : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`;
        document.getElementById("atcName").textContent = p.name;
        _atcRefreshPrice();
        _atcFlavorObjs = parseField(p.flavors)
          .map((f) =>
            typeof f === "object"
              ? { name: f.name || f.label || "", qty: f.qty || 0 }
              : { name: String(f), qty: 0 },
          )
          .filter((fo) => fo.name);
        document.getElementById("atcFlavorSection").style.display =
          _atcFlavorObjs.length ? "" : "none";
        _atcRenderFlavorOptions();
        const variants = parseField(p.variants);
        const weightSec = document.getElementById("atcWeightSection");
        if (variants.length) {
          document.getElementById("atcWeightOptions").innerHTML = variants
            .map((v, i) => {
              const lbl =
                typeof v === "object"
                  ? v.weight
                    ? `${v.weight}${v.unit || ""}`
                    : v.label || v.name || `Option ${i + 1}`
                  : String(v);
              return `<button class="atc-option${i === 0 ? " active" : ""}" onclick="atcPickVariant(this,${i})">${lbl}</button>`;
            })
            .join("");
          weightSec.style.display = "";
        } else {
          weightSec.style.display = "none";
        }
        document.getElementById("atcQtyVal").textContent = 1;
        document.getElementById("atcOverlay").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function _atcRenderFlavorOptions() {
        const p = _atcProduct;
        if (!p || !_atcFlavorObjs.length) return;
        const variants = parseField(p.variants);
        const v = variants[_atcVariantIdx];
        const hasFlavorStock =
          v && typeof v === "object" && v.flavorStock !== undefined;
        const hasOldQty =
          !hasFlavorStock && _atcFlavorObjs.some((fo) => fo.qty > 0);
        const isOOS = (fo) => {
          if (hasFlavorStock)
            return (
              v.flavorStock[fo.name] !== undefined &&
              v.flavorStock[fo.name] <= 0
            );
          if (hasOldQty) return fo.qty <= 0;
          return false;
        };
        const firstAvail =
          _atcFlavorObjs.find((fo) => !isOOS(fo)) || _atcFlavorObjs[0];
        if (!_atcFlavor || isOOS({ name: _atcFlavor }))
          _atcFlavor = firstAvail.name;
        document.getElementById("atcFlavorOptions").innerHTML = _atcFlavorObjs
          .map((fo) => {
            const oos = isOOS(fo);
            const active = fo.name === _atcFlavor;
            return `<button class="atc-option${active ? " active" : ""}" ${oos ? 'disabled style="opacity:.4;cursor:not-allowed;text-decoration:line-through;"' : `onclick="atcPickFlavor(this,'${fo.name.replace(/'/g, "\\'")}')"`}>${fo.name}${oos ? " (OOS)" : ""}</button>`;
          })
          .join("");
      }
      function _atcRefreshPrice() {
        const p = _atcProduct;
        if (!p) return;
        const v = parseField(p.variants)[_atcVariantIdx];
        const base = v && typeof v === "object" ? v.price || 0 : 0;
        const disc = p.discount || 0;
        const final = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;
        document.getElementById("atcPrice").textContent =
          final > 0 ? `${final.toLocaleString()} DA` : "";
      }
      function atcPickFlavor(btn, f) {
        document
          .querySelectorAll("#atcFlavorOptions .atc-option")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        _atcFlavor = f;
        _atcQty = 1;
        document.getElementById("atcQtyVal").textContent = 1;
      }
      function atcPickVariant(btn, idx) {
        document
          .querySelectorAll("#atcWeightOptions .atc-option")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        _atcVariantIdx = idx;
        _atcRefreshPrice();
        _atcRenderFlavorOptions();
      }
      function _atcCurrentFlavorQty() {
        const p = _atcProduct;
        if (!p) return 5;
        const variants = parseField(p.variants);
        const v = variants[_atcVariantIdx];
        if (v && typeof v === "object" && v.flavorStock && _atcFlavor)
          return Number(v.flavorStock[_atcFlavor]) || 0;
        if (!_atcFlavorObjs.length || !_atcFlavorObjs.some((fo) => fo.qty > 0))
          return Number(p.stock) || 5;
        const fo = _atcFlavorObjs.find((f) => f.name === _atcFlavor);
        return fo ? fo.qty : 1;
      }
      function atcChangeQty(d) {
        const maxQty = Math.min(5, _atcCurrentFlavorQty());
        _atcQty = Math.min(maxQty, Math.max(1, _atcQty + d));
        document.getElementById("atcQtyVal").textContent = _atcQty;
      }
      function closeAddToCartModal() {
        document.getElementById("atcOverlay").classList.remove("open");
        document.body.style.overflow = "";
      }
      function confirmAddToCart() {
        const p = _atcProduct;
        if (!p) return;
        const variants = parseField(p.variants);
        const v = variants[_atcVariantIdx];
        const base = v && typeof v === "object" ? v.price || 0 : 0;
        const disc = p.discount || 0;
        const unitPrice = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;
        const variantLabel = v
          ? typeof v === "object"
            ? v.weight
              ? `${v.weight}${v.unit || ""}`
              : v.label || v.name || ""
            : String(v)
          : "";
        const items = cartGet();
        const existing = items.find(
          (i) =>
            i.productId === p.id &&
            i.flavor === _atcFlavor &&
            i.variant === variantLabel,
        );
        if (existing) {
          existing.qty = Math.min(
            _itemMaxQty(existing),
            existing.qty + _atcQty,
          );
        } else {
          items.push({
            productId: p.id,
            name: p.name,
            imageUrl:
              (Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl) || "",
            unitPrice,
            qty: _atcQty,
            flavor: _atcFlavor,
            variant: variantLabel,
          });
        }
        cartSave(items);
        cartUpdateBadge();
        closeAddToCartModal();
        if (!_cartOpen) toggleCart();
        else _renderCartDrawer();
      }

      function toggleMobileMenu() {
        const btn = document.getElementById("hamburgerBtn");
        const menu = document.getElementById("mobileMenu");
        const overlay = document.getElementById("mobileOverlay");
        const isOpen = menu.classList.toggle("open");
        if (overlay) overlay.classList.toggle("open", isOpen);
        btn.classList.toggle("open", isOpen);
        btn.setAttribute("aria-expanded", isOpen);
        document.body.style.overflow = isOpen ? "hidden" : "";
      }

      function toggleMobileCat(btn) {
        const item = btn.closest(".m-cat-item");
        const isOpen = item.classList.contains("open");
        document
          .querySelectorAll(".m-cat-item.open")
          .forEach((el) => el.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      }

      function handleSearch(query) {
        const dropdown = document.getElementById("searchDropdown");
        const q = (query || "").trim().toLowerCase();
        if (!q) {
          dropdown.classList.remove("open");
          dropdown.innerHTML = "";
          return;
        }

        const matches = _allProducts
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.brand || "").toLowerCase().includes(q) ||
              parseField(p.flavors).some((f) =>
                (typeof f === "object" ? f.name || "" : String(f))
                  .toLowerCase()
                  .includes(q),
              ),
          );

        if (!matches.length) {
          dropdown.innerHTML = `<div class="search-drop-empty">No results for "${query}"</div>`;
          dropdown.classList.add("open");
          return;
        }

        dropdown.innerHTML = matches
          .map((p) => {
            const price = getProductPrice(p, 0).toLocaleString("fr-DZ");
            const _t0 = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
            const thumb = _t0
              ? `<img src="${_t0}" alt="${p.name}" />`
              : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`;
            return `
            <div class="search-drop-item" onclick="closeSearchDropdown(); window.location.href='/supplements/product-detail?id=${encodeURIComponent(p.id)}'">
              <div class="search-drop-thumb">${thumb}</div>
              <div class="search-drop-info">
                <p class="search-drop-brand">${p.brand || ""}</p>
                <p class="search-drop-name">${p.name}</p>
              </div>
              <span class="search-drop-price">${price} DA</span>
            </div>`;
          })
          .join("");
        dropdown.classList.add("open");
      }

      function closeSearchDropdown() {
        const dropdown = document.getElementById("searchDropdown");
        if (dropdown) {
          dropdown.classList.remove("open");
          dropdown.innerHTML = "";
        }
        const input = document.getElementById("searchInput");
        if (input) input.value = "";
      }

      document
        .getElementById("searchInput")
        .addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeSearchDropdown();
          if (e.key === "Enter") {
            const q = e.target.value.trim();
            if (q) {
              closeSearchDropdown();
              window.location.href = `/supplements/products?q=${encodeURIComponent(q)}`;
            }
          }
        });

      function openMobileSearch() {
        document.getElementById("mobileSearchOverlay").style.display = "flex";
        document.body.style.overflow = "hidden";
        setTimeout(
          () => document.getElementById("mobileSearchInput").focus(),
          50,
        );
      }
      function closeMobileSearch() {
        document.getElementById("mobileSearchOverlay").style.display = "none";
        document.body.style.overflow = "";
        const inp = document.getElementById("mobileSearchInput");
        if (inp) inp.value = "";
        const res = document.getElementById("mobileSearchResults");
        if (res) res.innerHTML = `<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">Start typing to search products…</p>`;
      }

      function handleMobileSearch(query) {
        const results = document.getElementById("mobileSearchResults");
        const q = (query || "").trim().toLowerCase();
        if (!q) {
          results.innerHTML = `<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">Start typing to search products…</p>`;
          return;
        }
        const matches = _allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.brand || "").toLowerCase().includes(q) ||
            parseField(p.flavors).some((f) =>
              (typeof f === "object" ? f.name || "" : String(f)).toLowerCase().includes(q)
            )
        );
        if (!matches.length) {
          results.innerHTML = `<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">No results for "${query}"</p>`;
          return;
        }
        results.innerHTML = matches.map((p) => {
          const price = getProductPrice(p, 0).toLocaleString("fr-DZ");
          const _t0 = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
          const thumb = _t0
            ? `<img src="${_t0}" alt="${p.name}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;" />`
            : `<div style="width:48px;height:48px;border-radius:8px;background:var(--gray-100);flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg></div>`;
          return `<div onclick="closeMobileSearch(); window.location.href='/supplements/product-detail?id=${encodeURIComponent(p.id)}'"
            style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);cursor:pointer;">
            ${thumb}
            <div style="flex:1;min-width:0;">
              <p style="font-size:12px;color:var(--gray-400);margin:0 0 2px;">${p.brand || ""}</p>
              <p style="font-size:14px;font-weight:600;color:var(--gray-800);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</p>
            </div>
            <span style="font-size:13px;font-weight:700;color:var(--red);flex-shrink:0;">${price} DA</span>
          </div>`;
        }).join("");

        const mobileInput = document.getElementById("mobileSearchInput");
        if (mobileInput && !mobileInput._keydownBound) {
          mobileInput._keydownBound = true;
          mobileInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              const v = e.target.value.trim();
              if (v) { closeMobileSearch(); window.location.href = `/supplements/products?q=${encodeURIComponent(v)}`; }
            }
            if (e.key === "Escape") closeMobileSearch();
          });
        }
      }

      /* ── TOAST ── */
      let toastTimer;
      function showToast(msg) {
        const toast = document.getElementById("toast");
        document.getElementById("toastMsg").textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
      }

      /* ── SCROLL ── */
      window.addEventListener(
        "scroll",
        () => {
          document
            .getElementById("site-header")
            .classList.toggle("scrolled", window.scrollY > 12);
          document
            .getElementById("scrollTop")
            .classList.toggle("visible", window.scrollY > 400);
        },
        { passive: true },
      );

      /* ══════════════════════════════════════════════════════
         INIT
      ══════════════════════════════════════════════════════ */
      document.addEventListener("DOMContentLoaded", () => {
        cartUpdateBadge();
        populateWilayas();
        loadProductData();
        
        // Auto-fill from user account
        const user = JSON.parse(localStorage.getItem('bybens_user'));
        if (user) {
          document.getElementById('firstName').value = user.firstName || '';
          document.getElementById('lastName').value = user.lastName || '';
          document.getElementById('phone').value = user.phone || '';
          document.getElementById('address').value = user.address || '';
        }

        const savedLang = localStorage.getItem("bybens_lang") || "en";
        if (savedLang !== "en") switchLang(savedLang);
      });
