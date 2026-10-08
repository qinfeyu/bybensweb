/* ── Track page: site chrome + Ecotrack order tracking ── */
(function() {
  "use strict";

  const i18n = {
    en: { "nav.home": "Home", "search.cancel": "Cancel" },
    fr: { "nav.home": "Accueil", "search.cancel": "Annuler" },
    ar: { "nav.home": "الرئيسية", "search.cancel": "إلغاء" }
  };
  let currentLang = "en";

  function getLang() { return localStorage.getItem("bybens_lang") || "en"; }

  function T(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.en && i18n.en[key]) || key;
  }

  function switchLang(lang) {
    currentLang = lang;
    window.currentLang = lang;
    window.i18n = i18n;
    const isAr = lang === "ar";
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function(el) {
      const key = el.getAttribute("data-i18n");
      if (i18n[lang] && i18n[lang][key] !== undefined) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = i18n[lang][key];
        else el.textContent = i18n[lang][key];
      }
    });
    document.querySelectorAll(".lang-btn").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
    localStorage.setItem("bybens_lang", lang);
    renderTrackIfNeeded();
  }

  /* ── Ecotrack status labels ── */
  const STATUS_MAP = {
    'order_information_received_by_carrier': {
      en: 'Order Received by Carrier',
      fr: 'Commande reçue par le transporteur',
      ar: 'تم استلام الطلب من قبل شركة التوصيل'
    },
    'picked': {
      en: 'Package Picked Up',
      fr: 'Colis récupéré',
      ar: 'تم استلام الطرد'
    },
    'accepted_by_carrier': {
      en: 'In Transit (At Sorting Center)',
      fr: 'En transit (Centre de tri)',
      ar: 'في العبور (مركز الفرز)'
    },
    'dispatched_to_driver': {
      en: 'Out for Delivery',
      fr: 'En cours de livraison',
      ar: 'في طريقها للتوصيل'
    },
    'attempt_delivery': {
      en: 'Delivery Attempted',
      fr: 'Tentative de livraison',
      ar: 'محاولة توصيل'
    },
    'return_asked': {
      en: 'Return Initiated',
      fr: 'Retour initié',
      ar: 'تم بدء الإرجاع'
    },
    'return_in_transit': {
      en: 'Return in Transit',
      fr: 'Retour en transit',
      ar: 'الإرجاع في مرحلة العبور'
    },
    'Return_received': {
      en: 'Return Received by Sender',
      fr: 'Retour réceptionné par l\'expéditeur',
      ar: 'تم استلام الإرجاع من قبل المرسل'
    },
    'livred': {
      en: 'Delivered',
      fr: 'Livré',
      ar: 'تم التوصيل بنجاح'
    },
    'encaissed': {
      en: 'Payment Collected',
      fr: 'Paiement encaissé',
      ar: 'تم تحصيل الدفع'
    },
    'payed': {
      en: 'Payment Remitted',
      fr: 'Paiement transféré',
      ar: 'تم تحويل الدفعة'
    },
    'notification_on_order': {
      en: 'System Update',
      fr: 'Mise à jour système',
      ar: 'تحديث في النظام'
    }
  };

  function translateStatus(code) {
    if (STATUS_MAP[code] && STATUS_MAP[code][currentLang]) return STATUS_MAP[code][currentLang];
    if (STATUS_MAP[code] && STATUS_MAP[code].en) return STATUS_MAP[code].en;
    return code.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
  }

  const LOCALES = { en: 'en-US', fr: 'fr-FR', ar: 'ar-DZ' };
  function formatDate(dateStr, timeStr) {
    try {
      const d = new Date(dateStr + 'T' + timeStr);
      return d.toLocaleString(LOCALES[currentLang] || 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch(e) {
      return dateStr + ' ' + timeStr;
    }
  }

  /* ── Tracking render state (re-rendered on language switch) ── */
  let lastTracking = null;
  let lastLookup = null;

  function renderTrackIfNeeded() {
    if (!lastTracking) return;
    if (lastTracking.kind === 'processing') renderProcessing(lastTracking.data);
    else if (lastTracking.kind === 'full') renderFull(lastTracking.td, lastTracking.trackingId);
  }

  function showResults() {
    document.getElementById("trackResults").classList.remove("hidden");
  }

  function renderProcessing(data) {
    const statusSummary = document.getElementById("statusSummary");
    const timelineList = document.getElementById("timelineList");
    const timelineIdEl = document.getElementById("timelineTrackingId");
    if (timelineIdEl) timelineIdEl.textContent = "";
    statusSummary.innerHTML =
      '<h2>' + T('track.processing') + '</h2>' +
      '<p>' + (T('track.processingMsg')) + '</p>';
    const confirmed = T('track.confirmed');
    const warehouse = T('track.warehouse');
    timelineList.innerHTML =
      '<li class="timeline-item active">' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-date">' + T('track.now') + '</div>' +
        '<div class="timeline-status">' + confirmed + '</div>' +
        '<div class="timeline-loc">' + warehouse + '</div>' +
      '</li>';
    showResults();
  }

  function renderInfoReceived() {
    const statusSummary = document.getElementById("statusSummary");
    const timelineList = document.getElementById("timelineList");
    const timelineIdEl = document.getElementById("timelineTrackingId");
    if (timelineIdEl) timelineIdEl.textContent = "";
    statusSummary.innerHTML =
      '<h2>' + T('track.infoReceived') + '</h2>' +
      '<p>' + T('track.infoMsg') + '</p>';
    timelineList.innerHTML =
      '<li class="timeline-item active">' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-date">' + T('track.recent') + '</div>' +
        '<div class="timeline-status">' + T('track.awaitingPickup') + '</div>' +
      '</li>';
    showResults();
  }

  function renderFull(td, trackingId) {
    const statusSummary = document.getElementById("statusSummary");
    const timelineList = document.getElementById("timelineList");
    const timelineIdEl = document.getElementById("timelineTrackingId");
    const activities = (td && Array.isArray(td.activity)) ? td.activity : [];

    if (timelineIdEl) timelineIdEl.textContent = '#' + (trackingId || '');
    statusSummary.innerHTML = '';

    if (activities.length === 0) {
      renderInfoReceived();
      return;
    }

    activities.sort(function(a, b) {
      return new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time);
    });

    const latest = activities[0];
    const isDelivered = latest.status === 'livred';

    statusSummary.innerHTML =
      '<h2 class="' + (isDelivered ? 'status-success' : '') + '">' + translateStatus(latest.status) + '</h2>' +
      '<p>' + T('track.trackingId') + ': <strong>' + (trackingId || '') + '</strong></p>';

    timelineList.innerHTML = activities.map(function(act, index) {
      const isFirst = index === 0;
      const isOk = act.status === 'livred';
      return (
        '<li class="timeline-item ' + (isFirst ? 'active' : '') + ' ' + (isOk ? 'success' : '') + '">' +
          '<div class="timeline-dot"></div>' +
          '<div class="timeline-date">' + formatDate(act.date, act.time) + '</div>' +
          '<div class="timeline-status">' + translateStatus(act.status) + '</div>' +
          (act.scanLocation ? '<div class="timeline-loc">' + act.scanLocation + '</div>' : '') +
        '</li>'
      );
    }).join('');

    showResults();
  }

  function friendlyError(err) {
    const e = (err || '').toLowerCase();
    if (e.indexOf('phone') !== -1) return T('track.error.phoneMismatch');
    if (e.indexOf('required') !== -1) return T('track.error.fillBoth');
    return T('track.error.notFound');
  }

  /* ── Form submit ── */
  const form = document.getElementById("trackForm");
  const trackBtn = document.getElementById("trackBtn");
  const errorMsg = document.getElementById("errorMsg");
  const loader = document.getElementById("trackLoader");
  const results = document.getElementById("trackResults");

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    const orderId = document.getElementById("orderId").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!orderId || !phone) {
      errorMsg.textContent = T('track.error.fillBoth');
      return;
    }

    errorMsg.textContent = "";
    results.classList.add("hidden");
    loader.classList.remove("hidden");
    trackBtn.disabled = true;

    try {
      const res = await fetch('/api/ecotrack?orderId=' + encodeURIComponent(orderId) + '&phone=' + encodeURIComponent(phone));
      const data = await res.json();

      if (data.success !== true) {
        errorMsg.textContent = friendlyError(data.error);
      } else {
        lastLookup = { orderId: orderId, phone: phone };
        var receiptBtn = document.getElementById("downloadReceiptBtn");
        if (receiptBtn) receiptBtn.style.display = "inline-flex";
        if (!data.trackingId) {
          lastTracking = { kind: 'processing', data: data };
          renderProcessing(data);
        } else if (data.trackingData) {
          lastTracking = { kind: 'full', td: data.trackingData, trackingId: data.trackingId };
          renderFull(data.trackingData, data.trackingId);
        } else {
          errorMsg.textContent = T('track.error.unavailable');
        }
      }
    } catch (err) {
      errorMsg.textContent = T('track.error.network');
    } finally {
      loader.classList.add("hidden");
      trackBtn.disabled = false;
    }
  });

  /* ── Cart badge ── */
  function updateCartBadge() {
    try {
      const cart = JSON.parse(localStorage.getItem("bybens_cart")) || [];
      const count = cart.reduce(function(s, i) { return s + (i.qty || 0); }, 0);
      const badge = document.getElementById("cartBadge");
      if (!badge) return;
      badge.textContent = count;
      badge.style.display = count === 0 ? "none" : "flex";
    } catch(e) {}
  }

  /* ── Category nav ── */
  function renderCatNav(cats, subs) {
    const inner = document.getElementById("catNavInner");
    const mobile = document.getElementById("mobileCatItems");
    if (!inner) return;
    let dHTML = "", mHTML = "";
    cats.forEach(function(cat) {
      const catSubs = subs.filter(function(s) {
        const ids = Array.isArray(s.categoryIds)
          ? s.categoryIds
          : Array.isArray(s.category_ids)
            ? s.category_ids
            : (s.category_ids || "").split(",").filter(Boolean);
        return ids.includes(cat.id);
      });
      if (catSubs.length > 0) {
        dHTML += '<div class="cat-item"><a href="/supplements/products" class="cat-link">' + cat.name +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg></a>' +
          '<div class="dropdown">' + catSubs.map(function(s) {
            return '<a href="/supplements/products?sub=' + encodeURIComponent(s.name) + '">' + s.name + '</a>';
          }).join("") + '</div></div>';
        mHTML += '<div class="m-cat-item"><button class="m-cat-toggle" onclick="toggleMobileCat(this)">' +
          cat.name + ' <span class="m-arrow">›</span></button><div class="m-sub">' +
          catSubs.map(function(s) {
            return '<a href="/supplements/products?sub=' + encodeURIComponent(s.name) + '" class="m-sub-link">' + s.name + '</a>';
          }).join("") + '</div></div>';
      } else {
        dHTML += '<div class="cat-item"><a href="/supplements/products" class="cat-link">' + cat.name + '</a></div>';
        mHTML += '<a href="/supplements/products" class="mobile-nav-link">' + cat.name + '</a>';
      }
    });
    inner.innerHTML = dHTML;
    if (mobile) mobile.innerHTML = mHTML;
    const footerList = document.getElementById("footerCategoryList");
    if (footerList) {
      footerList.innerHTML = cats.slice(0, 6).map(function(cat) {
        return '<li><a href="/supplements/products?cat=' + encodeURIComponent(cat.id) + '">' + cat.name + '</a></li>';
      }).join("");
    }
  }

  function toggleMobileCat(btn) {
    const item = btn.closest(".m-cat-item");
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".m-cat-item.open").forEach(function(el) { el.classList.remove("open"); });
    if (!isOpen) item.classList.add("open");
  }

  /* ── Search (inline results) ── */
  var products = [];

  function _getProductPrice(p) {
    if (p.variants && p.variants.length) {
      var prices = p.variants.map(function(v) { return Number(v.price) || 0; }).filter(function(x) { return x > 0; });
      if (prices.length) return Math.min.apply(null, prices);
    }
    return Number(p.price) || 0;
  }

  function goSearch() {
    var inp = document.getElementById("searchInput");
    var q = (inp && inp.value || "").trim();
    if (q) window.location.href = "/supplements/products?q=" + encodeURIComponent(q);
    else if (inp) inp.focus();
  }

  function handleSearch(query) {
    var dropdown = document.getElementById("searchDropdown");
    var q = (query || "").trim().toLowerCase();
    if (!q) { dropdown.classList.remove("open"); dropdown.innerHTML = ""; return; }
    if (!products.length) {
      dropdown.innerHTML = '<div class="search-drop-empty">Loading…</div>';
      dropdown.classList.add("open");
      return;
    }
    var matches = products.filter(function(p) {
      return p.name.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (Array.isArray(p.flavors) ? p.flavors : []).some(function(f) { return (f.name || "").toLowerCase().includes(q); });
    });
    if (!matches.length) {
      dropdown.innerHTML = '<div class="search-drop-empty">No results for "' + query + '"</div>';
      dropdown.classList.add("open");
      return;
    }
    dropdown.innerHTML = matches.map(function(p) {
      var price = _getProductPrice(p);
      var _t = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
      var thumb = _t ? '<img src="' + _t + '" alt="' + p.name + '" />' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>';
      var flavorLabel = Array.isArray(p.flavors) && p.flavors.length ? p.flavors[0].name : "";
      return '<div class="search-drop-item" onclick="closeSearchDropdown();window.location.href=\'/supplements/product-detail?id=' + p.id + '\'">' +
        '<div class="search-drop-thumb">' + thumb + '</div>' +
        '<div class="search-drop-info">' +
          '<p class="search-drop-brand">' + (p.brand || "") + '</p>' +
          '<p class="search-drop-name">' + p.name + '</p>' +
          (flavorLabel ? '<p style="font-size:11px;color:var(--gray-400);margin:0;">' + flavorLabel + '</p>' : '') +
        '</div>' +
        '<span class="search-drop-price">' + price + ' DA</span>' +
        '</div>';
    }).join("");
    dropdown.classList.add("open");
  }

  function closeSearchDropdown() {
    var dropdown = document.getElementById("searchDropdown");
    dropdown.classList.remove("open");
    dropdown.innerHTML = "";
    document.getElementById("searchInput").value = "";
  }

  function handleSearchKey(e) {
    if (e.key === "Escape") closeSearchDropdown();
  }

  /* ── Mobile search ── */
  function openMobileSearch() {
    document.getElementById("mobileSearchOverlay").style.display = "flex";
    document.body.style.overflow = "hidden";
    setTimeout(function() { document.getElementById("mobileSearchInput").focus(); }, 50);
  }
  function closeMobileSearch() {
    document.getElementById("mobileSearchOverlay").style.display = "none";
    document.body.style.overflow = "";
    document.getElementById("mobileSearchInput").value = "";
    document.getElementById("mobileSearchResults").innerHTML = '<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">Start typing to search products…</p>';
  }
  function handleMobileSearch(query) {
    var resultsEl = document.getElementById("mobileSearchResults");
    if (!query.trim()) {
      resultsEl.innerHTML = '<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">Start typing to search products…</p>';
      return;
    }
    var q = query.toLowerCase();
    var matches = products.filter(function(p) {
      return p.name.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (Array.isArray(p.flavors) ? p.flavors : []).some(function(f) { return (f.name || "").toLowerCase().includes(q); });
    });
    if (!matches.length) {
      resultsEl.innerHTML = '<p style="font-size:13px;color:var(--gray-400);text-align:center;margin-top:40px;">No results for "' + query + '"</p>';
      return;
    }
    resultsEl.innerHTML = matches.map(function(p) {
      var price = _getProductPrice(p);
      var _i = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
      var imgEl = _i ? '<img src="' + _i + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />' : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gray-200)" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>';
      var flavorLabel = Array.isArray(p.flavors) && p.flavors.length ? p.flavors[0].name : "";
      return '<div onclick="closeMobileSearch();window.location.href=\'/supplements/product-detail?id=' + p.id + '\'" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--gray-100);cursor:pointer;">' +
        '<div style="width:48px;height:48px;background:var(--gray-50);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--gray-100);overflow:hidden;">' + imgEl + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<p style="font-size:13px;color:var(--gray-400);font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 2px;">' + (p.brand || "") + '</p>' +
          '<p style="font-size:15px;font-weight:600;color:var(--black);margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</p>' +
          '<p style="font-size:12px;color:var(--gray-400);margin:0;">' + flavorLabel + '</p>' +
        '</div>' +
        '<span style="font-family:var(--font-display);font-size:18px;color:var(--black);flex-shrink:0;direction:ltr;">' + price + ' DA</span>' +
        '</div>';
    }).join("");
  }

  /* ── Mobile menu ── */
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

  /* ── Theme toggle (kept for parity with site header) ── */
  function toggleTheme() {}

  /* ── Download receipt ── */
  function escapeHtmlTrack(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function trackFmt(n) { return (Number(n) || 0).toLocaleString("fr-FR"); }

  function printReceipt(rc) {
    const cust = rc.customer || {};
    const firstName = rc.firstName || cust.firstName || "";
    const lastName = rc.lastName || cust.lastName || "";
    const phone = rc.phone || cust.phone || "";
    const wilaya = rc.wilaya || cust.wilaya || "";
    const commune = rc.commune || cust.commune || "";
    const address = rc.address || cust.address || "";
    const deliveryType = rc.deliveryType || cust.deliveryType || "home";
    const createdAt = rc.createdAt || rc.created_at || null;
    const dateStr = createdAt ? new Date(createdAt).toLocaleString("fr-DZ") : new Date().toLocaleString("fr-DZ");
    const esc = escapeHtmlTrack;
    const custName = [firstName, lastName].filter(Boolean).join(" ") || "—";
    const isHome = String(deliveryType).toLowerCase() === "home";
    const deliveryLabel = isHome ? "🏠 Home Delivery" : "📦 Office Pickup";
    const wilayaCommune = wilaya + (commune ? " (" + commune + ")" : "");

    const itemsHtml = (rc.items || []).map(function(it) {
      const giftTag = it.isGift ? " 🎁" : "";
      const detail = [it.variant, it.flavor].filter(Boolean).join(" | ");
      return (
        "<tr style='border-bottom:1px dashed #e2e8f0;'>" +
        "<td style='padding:6px 0;'>" +
        "<div style='font-weight:700; color:#0f172a; font-size:12px;'><span dir='auto'>" + esc(it.name) + "</span>" + giftTag + "</div>" +
        (detail ? "<div style='font-size:10px; color:#64748b;' dir='auto'>" + esc(detail) + "</div>" : "") +
        "<div style='font-size:11px; color:#475569;'>" + (Number(it.qty) || 1) + " × " + trackFmt(it.unitPrice) + " DA</div>" +
        "</td>" +
        "<td style='text-align:right; font-weight:700; vertical-align:top; padding-top:6px;'>" + trackFmt(it.lineTotal) + " DA</td>" +
        "</tr>"
      );
    }).join("");

    const deliveryInfo =
      "<div style='font-size:10px; color:#64748b; margin:12px 0 8px; padding:8px 10px; border:1px dashed #e2e8f0; border-radius:6px;'>" +
      "<div><span style='opacity:.85;'>Wilaya/Commune:</span> <span dir='auto' style='color:#0f172a; font-weight:600;'>" + esc(wilayaCommune || "—") + "</span></div>" +
      (address
        ? "<div style='margin-top:3px;'><span style='opacity:.85;'>Address:</span> <span dir='auto' style='color:#0f172a; font-weight:600;'>" + esc(address) + "</span></div>"
        : "") +
      "<div style='margin-top:3px;'>" + deliveryLabel + "</div>" +
      "</div>";

    const totalsHtml =
      "<div class='totals'>" +
      "<div><span>Subtotal:</span><strong>" + trackFmt(rc.subtotal) + " DA</strong></div>" +
      (Number(rc.deliveryCost || rc.delivery_cost) > 0
        ? "<div><span>Delivery Fee:</span><strong>" + trackFmt(rc.deliveryCost || rc.delivery_cost) + " DA</strong></div>"
        : "") +
      (Number(rc.promoDiscount || rc.promo_discount) > 0
        ? "<div><span>Discount (" + esc(rc.promoCode || rc.promo_code || "PROMO") + "):</span><strong style='color:#b91c1c;'>-" + trackFmt(rc.promoDiscount || rc.promo_discount) + " DA</strong></div>"
        : "") +
      "<div class='grand-total'><span>TOTAL:</span><span>" + trackFmt(rc.total) + " DA</span></div>" +
      "</div>";

    const htmlContent =
      "<!DOCTYPE html><html><head><title>Ticket - " + esc(rc.orderId || "") + "</title>" +
      "<style>" +
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');" +
      "body { font-family:'Inter',sans-serif; padding:20px; margin:0; background:#fff; font-size:12px; color:#0f172a; }" +
      ".receipt { max-width:320px; margin:0 auto; border:1px solid #e2e8f0; padding:16px; border-radius:12px; }" +
      ".header { text-align:center; border-bottom:1.5px dashed #cbd5e1; padding-bottom:12px; margin-bottom:12px; }" +
      ".brand { font-size:18px; font-weight:900; color:#b91c1c; }" +
      ".info { font-size:10px; color:#64748b; margin-top:2px; }" +
      "table { width:100%; border-collapse:collapse; margin-bottom:12px; }" +
      ".totals { border-top:1.5px dashed #cbd5e1; padding-top:8px; font-size:11px; }" +
      ".totals div { display:flex; justify-content:space-between; margin-bottom:4px; }" +
      ".grand-total { font-size:15px; font-weight:900; color:#b91c1c; border-top:1px solid #0f172a; padding-top:6px; margin-top:4px; }" +
      ".footer { text-align:center; font-size:10px; color:#94a3b8; margin-top:16px; border-top:1px dashed #cbd5e1; padding-top:10px; }" +
      ".btn-print { width:100%; padding:10px; background:#0f172a; color:#fff; border:none; border-radius:8px; font-weight:700; margin-bottom:12px; cursor:pointer; }" +
      "@media print { .no-print { display:none !important; } }" +
      "</style></head><body>" +
      "<div class='no-print'><button class='btn-print' onclick='window.print()'>🖨️ Print / Save PDF</button></div>" +
      "<div class='receipt'>" +
      "<div class='header'>" +
      "<div class='brand'>BYBENS NUTRITION</div>" +
      "<div class='info'>Sports Nutrition &amp; Supplements</div>" +
      "<div class='info' style='margin-top:4px;'>Ticket: #" + esc(rc.orderId || "—") + "</div>" +
      "<div class='info'>Date: " + esc(dateStr) + "</div>" +
      "<div class='info'>Customer: <span dir='auto'>" + esc(custName) + "</span> (<span dir='auto'>" + esc(phone || "—") + "</span>)</div>" +
      "</div>" +
      deliveryInfo +
      "<table><tbody>" + itemsHtml + "</tbody></table>" +
      totalsHtml +
      "<div class='footer'>Thank you for shopping with ByBens!<br>www.bybens.com</div>" +
      "</div>" +
      "</body></html>";

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return null;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    return printWindow;
  }

  async function downloadTrackReceipt() {
    if (!lastLookup) return;
    try {
      const res = await fetch('/api/ecotrack?orderId=' + encodeURIComponent(lastLookup.orderId) + '&phone=' + encodeURIComponent(lastLookup.phone) + '&receipt=1');
      const data = await res.json();
      if (!data || data.success !== true || !data.receipt) {
        alert((data && data.error) || 'Receipt unavailable.');
        return;
      }
      if (!printReceipt(data.receipt)) {
        alert('Please allow popups to print your receipt.');
      }
    } catch (err) {
      alert('A network error occurred. Please try again.');
    }
  }

  /* ── Expose handlers to inline onclick/oninput attributes ── */
  window.switchLang = switchLang;
  window.goSearch = goSearch;
  window.handleSearch = handleSearch;
  window.closeSearchDropdown = closeSearchDropdown;
  window.handleSearchKey = handleSearchKey;
  window.openMobileSearch = openMobileSearch;
  window.closeMobileSearch = closeMobileSearch;
  window.handleMobileSearch = handleMobileSearch;
  window.toggleMobileMenu = toggleMobileMenu;
  window.toggleMobileCat = toggleMobileCat;
  window.toggleTheme = toggleTheme;
  window.downloadTrackReceipt = downloadTrackReceipt;

  /* ── Scroll ── */
  window.addEventListener("scroll", function() {
    document.getElementById("site-header").classList.toggle("scrolled", window.scrollY > 12);
  }, { passive: true });

  /* ── Outside click (desktop search) ── */
  document.addEventListener("click", function(e) {
    const ds = document.getElementById("desktopSearch");
    if (ds && !ds.contains(e.target)) {
      document.getElementById("searchDropdown").classList.remove("open");
    }
  });

  /* ── Init ── */
  var _wlStart = Date.now();
  document.addEventListener("DOMContentLoaded", function() {
    if (window.BYBENS_CONTENT) {
      ["en", "fr", "ar"].forEach(function(lang) {
        if (window.BYBENS_CONTENT[lang]) Object.assign(i18n[lang], window.BYBENS_CONTENT[lang]);
      });
    }
    currentLang = getLang();
    window.currentLang = currentLang;
    window.i18n = i18n;
    switchLang(currentLang);
    updateCartBadge();

    window.getInitialData().then(function(data) {
      if (!data || !data.success) return;
      var rows = Array.isArray(data.products) ? data.products : [];
      if (rows.length) {
        products = rows.map(function(p) {
          try { p.variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (Array.isArray(p.variants) ? p.variants : []); } catch(e) { p.variants = []; }
          try { p.flavors = typeof p.flavors === "string" ? JSON.parse(p.flavors) : (Array.isArray(p.flavors) ? p.flavors : []); } catch(e) { p.flavors = []; }
          return p;
        });
      }
      renderCatNav(
        Array.isArray(data.categories) ? data.categories : [],
        Array.isArray(data.subCategories) ? data.subCategories : []
      );
      var inp = document.getElementById("searchInput");
      if (inp && inp.value.trim()) handleSearch(inp.value);
      var minp = document.getElementById("mobileSearchInput");
      if (minp && minp.value.trim()) handleMobileSearch(minp.value);
    }).catch(function() {}).finally(function() {
      var _s = document.getElementById('dataSpinner');
      if (_s) _s.style.display = 'none';
      var _l = document.getElementById('pageLoader');
      if (_l && !_l._exiting) {
        sessionStorage.setItem('bb_wl', '1');
        var _delay = Math.max(0, 1400 - (Date.now() - _wlStart));
        setTimeout(function() { _l._exiting = true; _l.classList.add('wl-exit'); setTimeout(function() { _l.classList.add('hidden'); }, 700); }, _delay);
      }
    });
  });
})();