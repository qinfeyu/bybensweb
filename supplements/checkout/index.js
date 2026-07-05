      /* ══════════════════════════════════════════════════════
         CONFIG
      ══════════════════════════════════════════════════════ */
      const SUPABASE_URL = window.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";
      const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";
      const PAGE_LOAD_TIME = Date.now(); // used for bot timing check
      // getInitialData is provided by supabase-client.js
      const CART_KEY = "bybens_cart";
      let _deliveryPrices = [];
      let _allPromos = [];
      let appliedPromos = []; // all validated promo objects (stacked)

      function getDeliveryCost() {
        if (selectedWilayaCode && _deliveryPrices.length) {
          const wilayaName = WILAYAS[selectedWilayaCode]
            ? WILAYAS[selectedWilayaCode].name.trim().toLowerCase()
            : "";
          const code = selectedWilayaCode.replace(/^0+/, "");
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

      let selectedDelivery = "home";
      let selectedWilayaCode = "";
      let selectedCommuneName = "";
      let _allProducts = [];
      let _allCategories = [];
      let _allSubCategories = [];
      let _bundleId = null;
      let _topSoldIds = [];
      const dropdownState = { wilaya: false, commune: false };

      function computeTopSoldIds(orders, prods) {
        const qty = {};
        orders.forEach(o => (o.items || []).forEach(it => {
          const name = (it.name || '').split(' (')[0].trim().toLowerCase();
          if (name) qty[name] = (qty[name] || 0) + (Number(it.qty) || 1);
        }));
        const top3 = Object.entries(qty).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n);
        const ids = [];
        top3.forEach(name => { const p = prods.find(x=>x.name.toLowerCase().trim()===name); if(p&&!ids.includes(p.id))ids.push(p.id); });
        return ids;
      }

      function computeBadge(p, bundleId, topSoldIds) {
        if (Number(p.stock) <= 0) return { type:'oos', label:'OUT OF STOCK' };
        if (topSoldIds && topSoldIds.includes(p.id)) return { type:'hot', label:'HOT' };
        if (bundleId && p.id === bundleId) return { type:'bundle', label:'BUNDLE' };
        if (p.createdAt) { const c=new Date(p.createdAt),n=new Date(); if(c.toDateString()===n.toDateString()) return { type:'new', label:'NEW' }; }
        const disc = p.discount || 0;
        if (disc > 0) return { type:'promo', label:'PROMO' };
        return null;
      }

      /* ══════════════════════════════════════════════════════
         CART HELPERS
      ══════════════════════════════════════════════════════ */
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

      /* ══════════════════════════════════════════════════════
         CHECKOUT ITEMS RENDERING
      ══════════════════════════════════════════════════════ */
      function renderCheckoutItems() {
        const items = cartGet();
        const list = document.getElementById("checkoutItemsList");
        if (!list) return;

        if (!items.length) {
          list.innerHTML = `
            <div class="checkout-empty-state">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <p data-i18n="checkout.empty">Your cart is empty</p>
              <a href="/supplements/products" data-i18n="checkout.goShop">Continue Shopping</a>
            </div>`;
          // apply current lang translations
          const t = i18n[currentLang] || i18n.en;
          list.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (t[key]) el.textContent = t[key];
          });
          updateOrderSummary();
          return;
        }

        const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

        list.innerHTML =
          items
            .map(
              (item, idx) => `
          <div class="checkout-item">
            <div class="checkout-item-img">
              ${item.imageUrl ? `<img src="${Array.isArray(item.imageUrl) ? item.imageUrl[0] : item.imageUrl}" alt="${item.name}">` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`}
            </div>
            <div class="checkout-item-info">
              <div class="checkout-item-name">${item.name}</div>
              ${(()=>{
                const product = _allProducts.find(p => p.id === (item.productId || item.id));
                const flavors = product ? parseField(product.flavors) : [];
                const variants = product ? parseField(product.variants) : [];
                const flavorObjs = flavors.map(f => typeof f === 'object' ? { name: f.name || '', qty: f.qty || 0 } : { name: String(f), qty: 0 }).filter(fo => fo.name);
                // Find currently selected variant index
                const variantLabels = variants.map(v => typeof v === 'object' ? (v.weight ? `${v.weight}${v.unit||''}` : v.label || v.name || '') : String(v));
                const selectedVariantIdx = Math.max(0, variantLabels.indexOf(item.variant));
                const selectedVariant = variants[selectedVariantIdx];
                // Determine if variant has flavorStock
                const hasFlavorStock = selectedVariant && typeof selectedVariant === 'object' && selectedVariant.flavorStock !== undefined;
                const hasOldQty = !hasFlavorStock && flavorObjs.some(fo => fo.qty > 0);
                const isFlavorOOS = (fo) => {
                  if (hasFlavorStock) return selectedVariant.flavorStock[fo.name] !== undefined && selectedVariant.flavorStock[fo.name] <= 0;
                  if (hasOldQty) return fo.qty <= 0;
                  return false;
                };
                // Filter variants with any stock
                const isVariantOOS = (v, i) => {
                  if (typeof v !== 'object') return false;
                  if (v.flavorStock) return Object.values(v.flavorStock).every(qty => Number(qty) <= 0);
                  if (v.stock !== undefined) return Number(v.stock) <= 0; // Check variant's own stock
                  return false;
                };

                let html = '';
                // Show flavor dropdown if there's more than one flavor, even if some are OOS
                if (flavorObjs.length > 1) {
                  html += '<div class="checkout-item-selects">';
                  html += `<select class="checkout-item-select" onchange="checkoutChangeFlavor(${idx}, this.value)" ${flavorObjs.filter(fo => !isFlavorOOS(fo)).length === 0 ? 'disabled' : ''}>`;
                  flavorObjs.forEach(fo => {
                    const oos = isFlavorOOS(fo);
                    html += `<option value="${fo.name}" ${item.flavor===fo.name?'selected':''} ${oos ? 'disabled' : ''}>${fo.name}${oos ? ' (OOS)' : ''}</option>`;
                  });
                  html += '</select>';
                }
                // Show variant dropdown if there's more than one variant, even if some are OOS
                if (variants.length > 1) {
                  if (html === '') html += '<div class="checkout-item-selects">'; // Start div if not already started by flavors
                  html += `<select class="checkout-item-select" onchange="checkoutChangeVariant(${idx}, this.options[this.selectedIndex].dataset.origIdx)" ${variants.filter((v,i) => !isVariantOOS(v,i)).length === 0 ? 'disabled' : ''}>`;
                  variants.forEach((v, i) => {
                    const label = typeof v === 'object' ? (v.weight ? `${v.weight}${v.unit||''}` : v.label || v.name || '') : String(v);
                    const oos = isVariantOOS(v, i);
                    html += `<option value="${i}" data-orig-idx="${i}" ${item.variant===label?'selected':''} ${oos ? 'disabled' : ''}>${label}${oos ? ' (OOS)' : ''}</option>`;
                  });
                    html += '</select>';
                  }
                if (html !== '') html += '</div>'; // Close div if it was opened
                else { // If no dropdowns, fallback to meta parts
                  const metaParts = [item.flavor, item.variant].filter(Boolean);
                  if (metaParts.length) html = `<div class="checkout-item-meta">${metaParts.join(' · ')}</div>`;
                }
                return html;
              })()}
              <div class="checkout-item-bot">
                <div class="qty-stepper">
                  <button class="qty-btn" onclick="checkoutChangeQty(${idx}, -1)">&#8722;</button>
                  <span class="qty-value">${item.qty}</span>
                  <button class="qty-btn" onclick="checkoutChangeQty(${idx}, 1)">+</button>
                </div>
                <span class="checkout-item-price">${(item.unitPrice * item.qty).toLocaleString("fr-DZ")} DA</span>
                <button class="checkout-item-del" onclick="checkoutRemove(${idx})" aria-label="Remove item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>`,
            )
            .join("") + // Append bulk notice HTML here
          getBulkNoticeHTML() +
          `<div class="checkout-subtotal">
            <span data-i18n="checkout.subtotal">Subtotal</span>
            <span>${subtotal.toLocaleString("fr-DZ")} DA</span>
          </div>`;

        // apply lang
        const t = i18n[currentLang] || i18n.en;
        list.querySelectorAll("[data-i18n]").forEach((el) => {
          const key = el.getAttribute("data-i18n");
          if (t[key]) el.textContent = t[key];
        });

        updateOrderSummary();
      }

      function _itemMaxQty(item) {
        const pid = item.productId || item.id;
        const product = _allProducts.find(p => p.id === pid || p.productId === pid);
        if (!product) return 5;
        const variants = parseField(product.variants);
        const variantLabels = variants.map(v => typeof v === 'object' ? (v.weight ? `${v.weight}${v.unit||''}` : v.label || v.name || '') : String(v));
        const vIdx = Math.max(0, variantLabels.indexOf(item.variant));
        const v = variants[vIdx];
        if (v && typeof v === 'object' && v.flavorStock && item.flavor) {
          const s = Number(v.flavorStock[item.flavor]);
          return Math.min(5, isNaN(s) ? 5 : Math.max(1, s));
        }
        const flavorObjs = parseField(product.flavors).map(f => typeof f === 'object' ? { name: f.name || '', qty: f.qty || 0 } : { name: String(f), qty: 0 });
        if (flavorObjs.some(fo => fo.qty > 0) && item.flavor) {
          const fo = flavorObjs.find(f => f.name === item.flavor);
          if (fo) return Math.min(5, Math.max(1, fo.qty));
        }
        const stock = Number(product.stock);
        // Max quantity is 5 for individual items, regardless of stock
        return Math.min(5, isNaN(stock) || stock <= 0 ? 5 : Math.max(1, stock));
      }

      function checkoutChangeQty(idx, delta) {
        const items = cartGet();
        if (!items[idx]) return;
        items[idx].qty = Math.min(_itemMaxQty(items[idx]), Math.max(1, items[idx].qty + delta));
        cartSave(items);
        cartUpdateBadge();
        renderCheckoutItems();
        updateBulkNoticeVisibility();
      }

      function checkoutRemove(idx) {
        const items = cartGet();
        items.splice(idx, 1);
        cartSave(items);
        cartUpdateBadge();
        renderCheckoutItems();
        updateBulkNoticeVisibility();
      }

      function checkoutChangeFlavor(idx, flavorName) {
        const items = cartGet();
        if (!items[idx]) return;
        items[idx].flavor = flavorName;
        // Clamp qty to new flavor stock
        const max = _itemMaxQty(items[idx]);
        let adjusted = false;
        if (items[idx].qty > max) {
          items[idx].qty = Math.max(1, max);
          adjusted = true;
        }
        cartSave(items);
        renderCheckoutItems();
        if (adjusted) {
          const qtyEls = document.querySelectorAll('#checkoutItemsList .qty-value');
          if (qtyEls[idx]) qtyEls[idx].classList.add('qty-adjusted');
        }
        updateBulkNoticeVisibility();
      }

      function checkoutChangeVariant(idx, variantIndex) {
        const items = cartGet();
        if (!items[idx]) return;
        const product = _allProducts.find(p => p.id === (items[idx].productId || items[idx].id));
        if (!product) return;
        const variants = parseField(product.variants);
        const v = variants[variantIndex];
        if (!v) return;
        const base = typeof v === 'object' ? (Number(v.price) || 0) : 0;
        const disc = Number(product.discount) || 0;
        items[idx].unitPrice = disc > 0 ? Math.round(base * (1 - disc / 100)) : base;
        items[idx].variant = typeof v === 'object' ? (v.weight ? `${v.weight}${v.unit||''}` : v.label || v.name || '') : String(v);
        // Clamp qty to new variant stock
        const max = _itemMaxQty(items[idx]);
        let adjusted = false;
        if (items[idx].qty > max) {
          items[idx].qty = Math.max(1, max);
          adjusted = true;
        }
        cartSave(items);
        renderCheckoutItems();
        if (adjusted) {
          const qtyEls = document.querySelectorAll('#checkoutItemsList .qty-value');
          if (qtyEls[idx]) qtyEls[idx].classList.add('qty-adjusted');
        }
        updateBulkNoticeVisibility();
      }

      function updateOrderSummary() {
        const items = cartGet();
        const summaryList = document.getElementById("summaryItemsList");
        const subtotalEl = document.getElementById("summarySubtotal");
        const deliveryEl = document.getElementById("summaryDelivery");
        const totalEl = document.getElementById("summaryTotal");

        const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
        const deliveryCost = getDeliveryCost()[selectedDelivery];
        const { discount, freeDelivery } = getPromoDiscount(
          items,
          deliveryCost,
        );
        const deliveryCharge = selectedWilayaCode
          ? freeDelivery
            ? 0
            : deliveryCost
          : 0;
        const total = subtotal + deliveryCharge - discount;

        if (summaryList) {
          if (!items.length) {
            summaryList.innerHTML = "";
          } else {
            summaryList.innerHTML = items
              .map(
                (item) => `
              <div class="order-summary-row">
                <span class="order-summary-label">${item.name} × ${item.qty}</span>
                <span class="order-summary-val">${(item.unitPrice * item.qty).toLocaleString("fr-DZ")} DA</span>
              </div>`,
              )
              .join("");
          }
        }

        if (subtotalEl)
          subtotalEl.textContent = subtotal.toLocaleString("fr-DZ") + " DA";

        if (deliveryEl) {
          if (freeDelivery) deliveryEl.textContent = "FREE 🎉";
          else
            deliveryEl.textContent = selectedWilayaCode
              ? `+${deliveryCost.toLocaleString("fr-DZ")} DA (${selectedDelivery === "home" ? "Home" : "Office"})`
              : "Select wilaya";
        }

        const discountRow = document.getElementById("summaryDiscountRow");
        const discountVal = document.getElementById("summaryDiscountVal");
        const discountLabel = document.getElementById("summaryDiscountLabel");
        if (discountRow) {
          if (appliedPromos.length) {
            discountRow.style.display = "";
            discountLabel.textContent = `Promo (${appliedPromos.map(p => p.code).join(", ")})`;
            const parts = [];
            if (discount > 0) parts.push(`−${discount.toLocaleString("fr-DZ")} DA`);
            if (freeDelivery) parts.push("Free delivery");
            discountVal.textContent = parts.join(" + ") || "Applied";
          } else {
            discountRow.style.display = "none";
          }
        }

        if (totalEl)
          totalEl.textContent = total.toLocaleString("fr-DZ") + " DA";
      }

      function updateBulkNoticeVisibility() {
        const items = cartGet();
        const hasBulkItem = items.some(item => item.qty >= 5);
        const bulkNoticeEl = document.getElementById("bulkNoticeInCart");
        if (bulkNoticeEl) {
          bulkNoticeEl.style.display = hasBulkItem ? "flex" : "none";
        }
      }

      // Helper to get bulk notice HTML (for dynamic injection)
      function getBulkNoticeHTML() {
        const t = i18n[currentLang] || i18n.en;
        return `
          <div id="bulkNoticeInCart">
            <a href="https://wa.me/213662269449" target="_blank" class="bulk-notice-content">
              <div class="bulk-notice-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></div>
              <div>
                <span class="bulk-notice-tag" data-i18n="detail.bulkLabel">${t["detail.bulkLabel"]}</span>
                <p class="bulk-notice-msg" data-i18n="detail.bulkNotice">${t["detail.bulkNotice"]}</p>
              </div>
            </a>
          </div>
        `;
      }

      /* ══════════════════════════════════════════════════════
         PROMO CODE
      ══════════════════════════════════════════════════════ */
      function renderPromoTagsCO() {
        const container = document.getElementById("promoTagsCO");
        if (!container) return;
        container.innerHTML = appliedPromos.map((pr) => {
          let label = pr.code;
          if (pr.type === "percent") label += ` (${pr.value}% off)`;
          else if (pr.type === "fixed") label += ` (−${pr.value.toLocaleString("fr-DZ")} DA)`;
          else if (pr.type === "free_delivery") label += " (Free delivery)";
          return `<span style="display:inline-flex;align-items:center;gap:5px;background:#e6f4ec;color:#0a7c3e;border:1px solid #b2dfcc;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600;">
            ${label}
            <button onclick="removePromoCO('${pr.id}')" style="background:none;border:none;cursor:pointer;color:#0a7c3e;font-size:14px;line-height:1;padding:0;margin-left:2px;">×</button>
          </span>`;
        }).join("");
      }

      function removePromoCO(id) {
        appliedPromos = appliedPromos.filter((pr) => pr.id !== id);
        renderPromoTagsCO();
        const msgEl = document.getElementById("promoMsg");
        if (msgEl) msgEl.textContent = "";
        updateOrderSummary();
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
          const exp = new Date(promo.expiry);
          exp.setHours(23, 59, 59, 999);
          if (exp < new Date()) {
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

        const items = cartGet();
        const eligibleSubtotal = getEligibleSubtotal(items, promo);
        if (eligibleSubtotal === 0) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = promo.type === "free_delivery"
            ? "✗ This code is not valid for your cart."
            : "✗ No products in your cart are linked to this promo code.";
          return;
        }

        const fullSubtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
        if (promo.minOrder && fullSubtotal < promo.minOrder) {
          msgEl.style.color = "var(--red)";
          msgEl.textContent = `✗ Minimum order of ${promo.minOrder.toLocaleString("fr-DZ")} DA required.`;
          return;
        }

        // All checks passed — add to stack
        appliedPromos.push(promo);
        input.value = "";
        msgEl.style.color = "#0a7c3e";
        if (promo.type === "percent")
          msgEl.textContent = `✓ Code applied! ${promo.value}% off eligible items`;
        else if (promo.type === "fixed")
          msgEl.textContent = `✓ Code applied! −${promo.value.toLocaleString("fr-DZ")} DA`;
        else if (promo.type === "free_delivery")
          msgEl.textContent = "✓ Code applied! Free delivery";
        renderPromoTagsCO();
        updateOrderSummary();
      }

      // Returns whether a product accepts a given promo.
      // Consistent with product-detail: allowPromo=true + empty promoCodeIds = accepts all promos.
      function _productAcceptsPromo(product, promo) {
        if (!product) return false;
        const allowPromo = product.allowPromo === true || String(product.allowPromo).toUpperCase() === "TRUE";
        if (!allowPromo) return false;
        
        // If promo is global, it applies to all products that allow promos
        if (promo.applyToAll === true || String(promo.applyToAll).toUpperCase() === "TRUE") return true;

        // If the product has explicit promo code restrictions, this promo must be one of them
        if (product.promoCodeIds && product.promoCodeIds.length > 0) {
          return product.promoCodeIds.includes(promo.id);
        }
        // allowPromo=true with no specific codes linked → accepts all promos
        return true;
      }

      // Returns the subtotal of cart items eligible for this promo.
      function getEligibleSubtotal(items, promo) {
        const fullSubtotal = items.reduce((s, item) => s + item.unitPrice * item.qty, 0);

        if (!_allProducts.length) return fullSubtotal;

        if (promo.type === "free_delivery") {
          // Find products that explicitly restrict this promo via promoCodeIds
          const linkedProductIds = new Set(
            _allProducts
              .filter((p) => {
                const allowPromo = p.allowPromo === true || String(p.allowPromo).toUpperCase() === "TRUE";
                return allowPromo && p.promoCodeIds && p.promoCodeIds.length > 0 && p.promoCodeIds.includes(promo.id);
              })
              .map((p) => p.id)
          );
          // No products explicitly linked → global free-delivery code, applies to any cart
          if (linkedProductIds.size === 0) return fullSubtotal;
          // Otherwise at least one linked product must be in the cart
          const hasEligible = items.some((item) => linkedProductIds.has(item.productId));
          return hasEligible ? fullSubtotal : 0;
        }

        // percent / fixed: sum of eligible items only
        return items.reduce((s, item) => {
          const product = _allProducts.find((p) => p.id === item.productId);
          if (!_productAcceptsPromo(product, promo)) return s;
          return s + item.unitPrice * item.qty;
        }, 0);
      }

      function getPromoDiscount(items, deliveryCost) {
        if (!appliedPromos.length) return { discount: 0, freeDelivery: false };
        let discount = 0;
        let freeDelivery = false;
        const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
        for (const pr of appliedPromos) {
          if (pr.type === "free_delivery") { freeDelivery = true; continue; }
          const eligible = getEligibleSubtotal(items, pr);
          if (pr.type === "percent") discount += Math.round(eligible * (pr.value / 100));
          else if (pr.type === "fixed") discount += Math.min(pr.value, eligible);
        }
        discount = Math.min(discount, subtotal);
        return { discount, freeDelivery };
      }

      /* ══════════════════════════════════════════════════════
         DELIVERY
      ══════════════════════════════════════════════════════ */
      function selectDelivery(type) {
        selectedDelivery = type;
        document
          .getElementById("deliveryHome")
          .classList.toggle("active", type === "home");
        document
          .getElementById("deliveryOffice")
          .classList.toggle("active", type === "office");
        updateOrderSummary();
      }

      /* ══════════════════════════════════════════════════════
         CART DRAWER
      ══════════════════════════════════════════════════════ */
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
      function cartQty(idx, d) {
        const items = cartGet();
        if (!items[idx]) return;
        items[idx].qty = Math.min(_itemMaxQty(items[idx]), Math.max(1, items[idx].qty + d));
        cartSave(items);
        cartUpdateBadge();
        _renderCartDrawer();
        renderCheckoutItems();
      }
      function cartRemove(idx) {
        const items = cartGet();
        items.splice(idx, 1);
        cartSave(items);
        cartUpdateBadge();
        _renderCartDrawer();
        renderCheckoutItems();
      }
      function cartCheckout() {
        // Already on checkout — just close the drawer
        if (_cartOpen) toggleCart();
      }

      /* ══════════════════════════════════════════════════════
         CATEGORY NAV
      ══════════════════════════════════════════════════════ */
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
            dHTML += `<div class="cat-item"><a href="/supplements/products" class="cat-link">${cat.name}</a></div>`;
            mHTML += `<a href="/supplements/products" class="mobile-nav-link">${cat.name}</a>`;
          }
        });
        inner.innerHTML = dHTML;
        // inject before the language section in mobile menu
        const mobileCatItems = document.getElementById("mobileCatItems");
        if (mobileCatItems) mobileCatItems.innerHTML = mHTML;
      }

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

      /* ══════════════════════════════════════════════════════
         DATA LOADING
      ══════════════════════════════════════════════════════ */
      async function loadData() {
        try {
          const res = await getInitialData();
          if (!res || !res.success) throw new Error("getInitialData failed");
          _allCategories = res.categories || [];
          _allSubCategories = res.subCategories || [];
          _deliveryPrices = res.deliveryPrices || [];
          _allProducts = res.products || [];
          _allPromos = res.promos || [];
          const bundle = res.bundle || {};
          // Max quantity is 5 for individual items, regardless of stock
          if (bundle.bundleId) _bundleId = bundle.bundleId;
          if (Array.isArray(res.orders)) _topSoldIds = computeTopSoldIds(res.orders, _allProducts);
          renderCatNav(_allCategories, _allSubCategories);
          renderCheckoutItems();
          renderAlsoLike();

          // ── Footer categories (max 6) ──
          const footerList = document.getElementById("footerCategoryList");
          if (footerList) {
            footerList.innerHTML = _allCategories
              .slice(0, 6)
              .map((cat) => `<li><a href="/supplements/products?cat=${encodeURIComponent(cat.id)}">${cat.name}</a></li>`)
              .join("");
          }
        } catch (err) {
                    // Max quantity is 5 for individual items, regardless of stock

          console.error("Failed to load data:", err);
        }
        hideLoader();
        populateWilayas();
      }

      function renderAlsoLike() {
        const grid = document.getElementById("alsoLikeGrid");
        if (!grid || !_allProducts.length) return;
        const cartIds = cartGet().map((i) => i.id);
        const others = _allProducts.filter((p) => p.status !== "inactive" && Number(p.stock) > 0);
        const picked = others
          .map((p) => ({ p, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .slice(0, 4)
          .map((x) => x.p);

        grid.innerHTML = picked
          .map((p) => {
            const variants = parseField(p.variants);
            const basePrice = variants.length > 0 ? Number(variants[0].price) || 0 : 0;
            const discount = Number(p.discount) || 0;
            const currentPrice = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;
            const oldPrice = discount > 0 ? basePrice : null;
            const saveLabel = discount > 0 ? `-${discount}%` : null;

            const _alsoImgs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : []);
            const img = _alsoImgs[0]
              ? `<img src="${_alsoImgs[0]}" alt="${p.name}" class="img-primary" />${_alsoImgs[1] ? `<img src="${_alsoImgs[1]}" alt="${p.name}" class="img-hover" />` : ""}`
              : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-200)" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`;
            const badge = computeBadge(p, _bundleId, _topSoldIds);
            return `
            <div class="also-card" onclick="window.location.href='/supplements/product-detail?id=${p.id}'" style="cursor:pointer">
              <div class="also-card-img">${img}${badge ? `<span class="product-badge badge-${badge.type}">${badge.label}</span>` : ''}${saveLabel ? `<span class="product-badge badge-promo" style="top:auto;bottom:10px;left:10px;">${saveLabel}</span>` : ''}</div>
              <div class="also-card-body">
                <div class="also-card-name">${p.name}</div>
                <div style="display:flex; align-items:baseline; gap:8px; direction:ltr;">
                  <div class="also-card-price">${currentPrice.toLocaleString("fr-DZ")} DA</div>
                  ${oldPrice ? `<span style="font-size:12px; color:var(--gray-400); text-decoration:line-through;">${oldPrice.toLocaleString("fr-DZ")} DA</span>` : ""}
                </div>
                <div class="also-card-actions">
                  ${Number(p.stock) <= 0
                    ? `<button class="also-btn-cart" disabled style="opacity:0.45;cursor:not-allowed">Out of Stock</button>`
                    : `<button class="also-btn-cart" onclick="event.stopPropagation();openAddToCartModal('${p.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Add to Cart
                  </button>`}
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

      /* ── ADD-TO-CART MODAL (also-like) ── */
      let _atcProduct = null, _atcQty = 1, _atcFlavor = "", _atcVariantIdx = 0, _atcFlavorObjs = [];
      function _atcRenderFlavorOptions() {
        const p = _atcProduct;
        if (!p || !_atcFlavorObjs.length) return;
        const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []);
        const v = variants[_atcVariantIdx];
        const hasFlavorStock = v && typeof v === "object" && v.flavorStock !== undefined;
        const hasOldQty = !hasFlavorStock && _atcFlavorObjs.some(fo => fo.qty > 0);
        const isOOS = (fo) => {
          if (hasFlavorStock) return v.flavorStock[fo.name] !== undefined && v.flavorStock[fo.name] <= 0;
          if (hasOldQty) return fo.qty <= 0;
          return false;
        };
        const firstAvail = _atcFlavorObjs.find(fo => !isOOS(fo)) || _atcFlavorObjs[0];
        if (!_atcFlavor || isOOS({ name: _atcFlavor })) _atcFlavor = firstAvail.name;
        document.getElementById("atcFlavorOptions").innerHTML = _atcFlavorObjs.map(fo => {
          const oos = isOOS(fo);
          const active = fo.name === _atcFlavor;
          return `<button class="atc-option${active ? " active" : ""}" ${oos ? 'disabled style="opacity:.4;cursor:not-allowed;text-decoration:line-through;"' : `onclick="atcPickFlavor(this,'${fo.name.replace(/'/g, "\\'")}')"`}>${fo.name}${oos ? " (OOS)" : ""}</button>`;
        }).join("");
      }
      function openAddToCartModal(productId) {
        const p = _allProducts.find(x => x.id === productId); if (!p) return;
        if (Number(p.stock) <= 0) return;
        _atcProduct = p; _atcQty = 1; _atcFlavor = ""; _atcVariantIdx = 0;
        const _atcImg0 = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
        document.getElementById("atcImg").innerHTML = _atcImg0
          ? `<img src="${_atcImg0}" alt="${p.name}">`
          : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`;
        document.getElementById("atcName").textContent = p.name;
        _atcRefreshPrice();
        _atcFlavorObjs = (typeof p.flavors === "string" ? JSON.parse(p.flavors) : (p.flavors || []))
          .map(f => typeof f === "object" ? { name: f.name || f.label || "", qty: f.qty || 0 } : { name: String(f), qty: 0 })
          .filter(fo => fo.name);
        document.getElementById("atcFlavorSection").style.display = _atcFlavorObjs.length ? "" : "none";
        _atcRenderFlavorOptions();
        const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []);
        const weightSec = document.getElementById("atcWeightSection");
        if (variants.length) {
          document.getElementById("atcWeightOptions").innerHTML = variants.map((v, i) => {
            const lbl = typeof v === "object" ? (v.weight ? `${v.weight}${v.unit||""}` : v.label || v.name || `Option ${i+1}`) : String(v);
            return `<button class="atc-option${i===0?" active":""}" onclick="atcPickVariant(this,${i})">${lbl}</button>`;
          }).join("");
          weightSec.style.display = "";
        } else { weightSec.style.display = "none"; }
        document.getElementById("atcQtyVal").textContent = 1;
        document.getElementById("atcOverlay").classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function _atcRefreshPrice() {
        const p = _atcProduct; if (!p) return;
        const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []);
        const v = variants[_atcVariantIdx];
        const base = v && typeof v === "object" ? (v.price || 0) : 0;
        const disc = p.discount || 0;
        const final = disc > 0 ? Math.round(base * (1 - disc/100)) : base;
        document.getElementById("atcPrice").textContent = final > 0 ? `${final.toLocaleString()} DA` : "";
      }
      function atcPickFlavor(btn, f) {
        document.querySelectorAll("#atcFlavorOptions .atc-option").forEach(b => b.classList.remove("active"));
        btn.classList.add("active"); _atcFlavor = f;
      }
      function atcPickVariant(btn, idx) {
        document.querySelectorAll("#atcWeightOptions .atc-option").forEach(b => b.classList.remove("active"));
        btn.classList.add("active"); _atcVariantIdx = idx; _atcRefreshPrice();
        _atcRenderFlavorOptions();
      }
      function _atcCurrentFlavorQty() {
        const p = _atcProduct;
        if (!p) return 5;
        const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []);
        const v = variants[_atcVariantIdx];
        if (v && typeof v === "object" && v.flavorStock && _atcFlavor) return Number(v.flavorStock[_atcFlavor]) || 0;
        if (!_atcFlavorObjs.length || !_atcFlavorObjs.some(fo => fo.qty > 0)) return Number(p.stock) || 5;
        const fo = _atcFlavorObjs.find(f => f.name === _atcFlavor);
        return fo ? fo.qty : 1;
      }
      function atcChangeQty(d) { const maxQty = Math.min(5, _atcCurrentFlavorQty()); _atcQty = Math.min(maxQty, Math.max(1, _atcQty + d)); document.getElementById("atcQtyVal").textContent = _atcQty; }
      function closeAddToCartModal() { document.getElementById("atcOverlay").classList.remove("open"); document.body.style.overflow = ""; }
      function confirmAddToCart() {
        const p = _atcProduct; if (!p) return;
        const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []);
        const v = variants[_atcVariantIdx];
        const base = v && typeof v === "object" ? (v.price || 0) : 0;
        const disc = p.discount || 0;
        const unitPrice = disc > 0 ? Math.round(base * (1 - disc/100)) : base;
        const variantLabel = v ? (typeof v === "object" ? (v.weight ? `${v.weight}${v.unit||""}` : v.label || v.name || "") : String(v)) : "";
        const items = cartGet();
        const existing = items.find(i => i.productId === p.id && i.flavor === _atcFlavor && i.variant === variantLabel);
        if (existing) { existing.qty = Math.min(_itemMaxQty(existing), existing.qty + _atcQty); }
        else { items.push({ productId: p.id, name: p.name, imageUrl: (Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl) || "", unitPrice, qty: _atcQty, flavor: _atcFlavor, variant: variantLabel }); }
        cartSave(items); cartUpdateBadge(); renderCheckoutItems(); closeAddToCartModal();
        if (!_cartOpen) toggleCart(); else _renderCartDrawer();
      }

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
        updateOrderSummary();
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

      async function submitOrder() {
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
        if (phoneEl.value && !/^(05|06|07)[0-9]{8}$/.test(phoneEl.value.trim().replace(/\s/g, ""))) {
          phoneEl.classList.add("error");
          document.getElementById("phoneErr").textContent =
            "Enter a valid Algerian phone number (05x, 06x or 07x)";
          valid = false;
        }

        const items = cartGet();
        if (!items.length) {
          showToast("Your cart is empty");
          return;
        }

        if (!valid) {
          showToast("Please fill all required fields");
          return;
        }

        // Re-validate applied promos before submitting
        const now = new Date();
        for (const pr of [...appliedPromos]) {
          const fresh = _allPromos.find(p => p.id === pr.id);
          if (!fresh || fresh.status !== "active") {
            showToast(`Promo code "${pr.code}" is no longer active and was removed.`);
            appliedPromos = appliedPromos.filter(p => p.id !== pr.id);
            renderPromoTagsCO(); updateOrderSummary(); return;
          }
          if (fresh.expiry) {
            const exp = new Date(fresh.expiry); exp.setHours(23, 59, 59, 999);
            if (exp < now) {
              showToast(`Promo code "${pr.code}" has expired and was removed.`);
              appliedPromos = appliedPromos.filter(p => p.id !== pr.id);
              renderPromoTagsCO(); updateOrderSummary(); return;
            }
          }
          if (fresh.maxUses && fresh.uses >= fresh.maxUses) {
            showToast(`Promo code "${pr.code}" has reached its limit and was removed.`);
            appliedPromos = appliedPromos.filter(p => p.id !== pr.id);
            renderPromoTagsCO(); updateOrderSummary(); return;
          }
        }

        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const address = document.getElementById("address").value.trim();
        const wilayaData = WILAYAS[selectedWilayaCode];
        const wilayaName = wilayaData ? wilayaData.name : selectedWilayaCode;
        const deliveryCost = getDeliveryCost()[selectedDelivery];
        const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
        const { discount, freeDelivery } = getPromoDiscount(
          items,
          deliveryCost,
        );
        const total = subtotal + (freeDelivery ? 0 : deliveryCost) - discount;

        const payload = {
          action: "submitCartOrder",
          firstName,
          lastName,
          phone,
          address,
          wilaya: `${selectedWilayaCode} - ${wilayaName}`,
          commune: selectedCommuneName,
          deliveryType: selectedDelivery,
          deliveryCost: freeDelivery ? 0 : deliveryCost,
          promoCode: appliedPromos.map((pr) => pr.code).join(","),
          promoDiscount: discount,
          items: items.map((i) => ({
            productId: i.productId || i.id || "",
            name: i.name,
            flavor: i.flavor || "",
            variant: i.variant || "",
            qty: i.qty,
            unitPrice: i.unitPrice,
            lineTotal: i.unitPrice * i.qty,
          })),
          subtotal,
          total,
        };

        const submitBtn = document.getElementById("submitOrderBtn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.6"; }
        try {
          const res = await fetch(SUPABASE_URL + "/functions/v1/submit-order", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SUPABASE_ANON_KEY }, body: JSON.stringify(payload) });
          const data = await res.json().catch(() => ({ success: true }));
          if (!data || data.success === false) {
            showToast((data && data.error) || "Order failed. Please try again.");
            return;
          }
          document.getElementById("successMsg").textContent =
            `Thank you ${firstName}! Your order of ${items.length} item${items.length !== 1 ? "s" : ""} — Total: ${total.toLocaleString("fr-DZ")} DA. We'll call you shortly to confirm.`;
          document.getElementById("successOverlay").classList.add("show");
        } catch (e) {
          // Network error — still show success since order may have gone through
          document.getElementById("successMsg").textContent =
            `Thank you ${firstName}! Your order of ${items.length} item${items.length !== 1 ? "s" : ""} — Total: ${total.toLocaleString("fr-DZ")} DA. We'll call you shortly to confirm.`;
          document.getElementById("successOverlay").classList.add("show");
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ""; }
        }
      }

      function closeSuccess() {
        localStorage.removeItem(CART_KEY);
        document.getElementById("successOverlay").classList.remove("show");
        window.location.href = "/supplements/products";
      }

      /* ══════════════════════════════════════════════════════
         SEARCH
      ══════════════════════════════════════════════════════ */
      function parseField(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        const s = String(val).trim();
        if (s === "" || s === "[]") return [];
        if (s.startsWith("[")) {
          try {
            return JSON.parse(s);
          } catch (e) {}
        }
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
            <div class="search-drop-item" onclick="window.location.href='/supplements/products?search=${encodeURIComponent(p.name)}'">
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

      document.addEventListener("DOMContentLoaded", () => {
        const si = document.getElementById("searchInput");
        if (si) {
          si.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              const dd = document.getElementById("searchDropdown");
              if (dd) dd.classList.remove("open");
            }
            if (e.key === "Enter") {
              const q = e.target.value.trim();
              if (q)
                window.location.href = `/supplements/products?q=${encodeURIComponent(q)}`;
            }
          });
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
      }

      /* ══════════════════════════════════════════════════════
         MOBILE MENU
      ══════════════════════════════════════════════════════ */
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

      /* ══════════════════════════════════════════════════════
         TOAST
      ══════════════════════════════════════════════════════ */
      let toastTimer;
      function showToast(msg) {
        const toast = document.getElementById("toast");
        document.getElementById("toastMsg").textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
      }

      /* ══════════════════════════════════════════════════════
         I18N
      ══════════════════════════════════════════════════════ */
      const i18n = {
        en: {
          "nav.home": "Home",
          "nav.products": "Products",
          "nav.contact": "Contact",
          "form.firstName": "First Name",
          "form.lastName": "Last Name",
          "form.phone": "Phone Number",
          "form.wilaya": "Wilaya",
          "form.address": "Address (Optional)",
          "form.commune": "Commune",
          "form.deliveryType": "Delivery Type",
          "form.homeDelivery": "🏠 Home Delivery",
          "form.officePick": "📦 Office Pickup",
          "form.deliveredDoor": "Delivered to your door",
          "form.pickupOffice": "Pickup at nearest office",
          "form.selectWilaya": "Select wilaya…",
          "form.selectWilayaFirst": "Select wilaya first",
          "form.orderSummary": "Order Summary",
          "form.delivery": "Delivery",
          "form.total": "Total",
          "form.confirmOrder": "CONFIRM ORDER",
          "form.deliveryDetails": "Delivery Details",
          "checkout.title": "Checkout",
          "checkout.yourOrder": "Your Order",
          "checkout.empty": "Your cart is empty",
          "checkout.goShop": "Continue Shopping",
          "checkout.subtotal": "Subtotal",
          "breadcrumb.home": "Home",
          "breadcrumb.cart": "Cart",
          "breadcrumb.checkout": "Checkout",
          "detail.bulkLabel": "Wholesale Pricing",
          "detail.bulkNotice": "Ordering 5 or more? Contact us on WhatsApp for a special wholesale discount!",
          "section.alsoLike": "You May Also Like",
          "footer.tagline":
            "Algeria's premier sports nutrition store. Authentic products, fast delivery, and expert support to fuel your performance.",
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
          "success.title": "Order Placed!",
          "success.back": "Back to Products",
        },
        fr: {
          "nav.home": "Accueil",
          "nav.products": "Produits",
          "nav.contact": "Contact",
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
          "form.orderSummary": "Récapitulatif",
          "form.delivery": "Livraison",
          "form.total": "Total",
          "form.confirmOrder": "CONFIRMER LA COMMANDE",
          "form.deliveryDetails": "Détails de livraison",
          "checkout.title": "Passer la commande",
          "checkout.yourOrder": "Votre Commande",
          "checkout.empty": "Votre panier est vide",
          "checkout.goShop": "Continuer vos achats",
          "checkout.subtotal": "Sous-total",
          "breadcrumb.home": "Accueil",
          "breadcrumb.cart": "Panier",
          "breadcrumb.checkout": "Commande",
          "detail.bulkLabel": "Prix de Gros",
          "detail.bulkNotice": "Vous en commandez 5 ou plus ? Contactez-nous sur WhatsApp pour une remise spéciale !",
          "section.alsoLike": "Vous Aimerez Aussi",
          "footer.brand.desc":
            "La première destination algérienne pour la nutrition sportive authentique.",
          "footer.links": "Liens Rapides",
          "footer.shipping": "Politique de livraison",
          "footer.returns": "Retours",
          "footer.categories": "Catégories",
          "footer.contact": "Envoyer un Message",
          "form.name": "Votre Nom",
          "form.email": "Email / Téléphone",
          "form.message": "Message",
          "form.send": "Envoyer",
          "shipping.title": "Politique de livraison",
          "shipping.item1.title": "Livraison Nationale",
          "shipping.item1.text": "Nous livrons dans les 58 wilayas d'Algérie via Imir Logistics. Une nutrition sportive de qualité livrée à votre porte.",
          "shipping.item2.title": "Livraison Gratuite",
          "shipping.item2.text": "Les commandes de plus de 15 000 DA bénéficient de la livraison gratuite ! Pour les autres, des tarifs standards s'appliquent.",
          "shipping.item3.title": "Délais Standards",
          "shipping.item3.text": "Les commandes sont traitées sous 24h. La livraison prend généralement 2-3 jours ouvrables pour les grandes villes.",
          "returns.title": "Retours & Remboursements",
          "returns.item1.title": "Politique de Retour",
          "returns.item1.text": "Vous avez 1 jour pour retourner un produit. Les articles doivent être non ouverts, dans leur emballage d'origine.",
          "returns.item2.title": "Processus Facile",
          "returns.item2.text": "Contactez-nous via WhatsApp or Instagram pour initier un retour. Nous vous guiderons étape par étape.",
          "returns.item3.title": "Mode de Remboursement",
          "returns.item3.text": "Une fois l'article inspecté, nous proposons des échanges ou un avoir. Les remboursements en espèces sont soumis à évaluation.",
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
          "success.title": "Commande Passée !",
          "success.back": "Retour aux Produits",
        },
        ar: {
          "nav.home": "الرئيسية",
          "nav.products": "المنتجات",
          "nav.contact": "اتصل بنا",
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
          "form.orderSummary": "ملخص الطلب",
          "form.delivery": "التوصيل",
          "form.total": "المجموع",
          "form.confirmOrder": "تأكيد الطلب",
          "form.deliveryDetails": "تفاصيل التوصيل",
          "checkout.title": "إتمام الشراء",
          "checkout.yourOrder": "طلبك",
          "checkout.empty": "سلتك فارغة",
          "checkout.goShop": "متابعة التسوق",
          "checkout.subtotal": "المجموع الفرعي",
          "breadcrumb.home": "الرئيسية",
          "breadcrumb.cart": "السلة",
          "breadcrumb.checkout": "الدفع",
          "detail.bulkLabel": "سعر الجملة",
          "detail.bulkNotice": "هل تطلب 5 قطع أو أكثر؟ اتصل بنا عبر واتساب للحصول على خصم خاص للجملة!",
          "section.alsoLike": "قد يعجبك أيضاً",
          "footer.brand.desc":
            "وجهتك الأولى في الجزائر للمكملات الرياضية الأصيلة.",
          "footer.links": "روابط سريعة",
          "footer.shipping": "سياسة الشحن",
          "footer.returns": "الإرجاع",
          "footer.categories": "الفئات",
          "footer.contact": "أرسل رسالة",
          "form.name": "اسمك",
          "form.email": "البريد / الهاتف",
          "form.message": "رسالتك",
          "form.send": "إرسال",
          "shipping.title": "سياسة الشحن",
          "shipping.item1.title": "توصيل وطني",
          "shipping.item1.text": "نوصّل إلى جميع الولايات الـ 58 في الجزائر عبر إيمير للوجستيك. مكملات رياضية عالية الجودة تصل إلى باب منزلك.",
          "shipping.item2.title": "توصيل مجاني",
          "shipping.item2.text": "الطلبات التي تتجاوز 15,000 دج تستفيد من توصيل مجاني! للطلبات الأخرى، تطبق أسعار الشحن القياسية.",
          "shipping.item3.title": "التوقيت القياسي",
          "shipping.item3.text": "يتم معالجة الطلبات خلال 24 ساعة. يستغرق التوصيل عادةً من يومين إلى 3 أيام عمل للمدن الكبرى.",
          "returns.title": "الإرجاع والاسترداد",
          "returns.item1.title": "سياسة الإرجاع",
          "returns.item1.text": "لديك 1 أيام لإرجاع المنتج. يجب أن تكون المنتجات غير مفتوحة وفي غلافها الأصلي مع الختم الأصلي.",
          "returns.item2.title": "عملية سهلة",
          "returns.item2.text": "اتصل بنا عبر واتساب أو إنستغرام لبدء عملية الإرجاع. سنوجهك خلال خطوات الاستبدال أو الاسترداد.",
          "returns.item3.title": "طريقة الاسترداد",
          "returns.item3.text": "بمجرد فحص المنتج المرتجع، نقدم خيارات الاستبدال بمنتجات أخرى أو رصيد متجر. المبالغ النقدية تخضع للتقييم.",
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
        // Re-render checkout items to update translated empty state if needed
        renderCheckoutItems();
      }

      /* ══════════════════════════════════════════════════════
         SCROLL
      ══════════════════════════════════════════════════════ */
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
        renderCheckoutItems();
        loadData();
        updateBulkNoticeVisibility(); // Initial check for bulk notice

        // Auto-fill from user account
        const user = JSON.parse(localStorage.getItem('bybens_user'));
        if (user) {
          document.getElementById('firstName').value = user.firstName || '';
          document.getElementById('lastName').value = user.lastName || '';
          document.getElementById('phone').value = user.phone || '';
          document.getElementById('address').value = user.address || '';
        }

        const savedLang = localStorage.getItem("bybens_lang") || "en";
        // Merge content.js into i18n
        if (window.BYBENS_CONTENT) {
          ["en", "fr", "ar"].forEach(function(lang) {
            if (window.BYBENS_CONTENT[lang]) Object.assign(i18n[lang], window.BYBENS_CONTENT[lang]);
          });
        }
        if (savedLang !== "en") switchLang(savedLang);
      });
