(function () {
  'use strict';

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    var raw = String(url == null ? '' : url).trim();
    if (!raw) return '';
    if (raw.charAt(0) === '/' && raw.charAt(1) !== '/') return raw;
    try {
      var parsed = new URL(raw, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (e) {}
    return '';
  }

  function getCurrentPage() {
    var path = String(window.location.pathname || '').toLowerCase();
    if (path.indexOf('product-detail') !== -1) return 'product-detail';
    if (path.indexOf('checkout') !== -1) return 'checkout';
    if (path.indexOf('products') !== -1) return 'products';
    if (path.indexOf('privacy') !== -1) return 'privacy';
    if (path.indexOf('track') !== -1) return 'track';
    if (path.indexOf('home') !== -1) return 'home';
    return 'home';
  }

  function getLang() {
    var lang = String(localStorage.getItem('bybens_lang') || 'en').toLowerCase();
    if (lang === 'fr' || lang === 'ar' || lang === 'en') return lang;
    return 'en';
  }

  function pickLocalized(popup, fieldBase, lang) {
    var en = popup[fieldBase + 'En'] || '';
    var fr = popup[fieldBase + 'Fr'] || '';
    var ar = popup[fieldBase + 'Ar'] || '';
    if (lang === 'fr') return fr || en || ar || '';
    if (lang === 'ar') return ar || en || fr || '';
    return en || fr || ar || '';
  }

  function isWithinSchedule(popup, now) {
    var start = popup.startAt ? Date.parse(popup.startAt) : NaN;
    var end = popup.endAt ? Date.parse(popup.endAt) : NaN;
    if (!Number.isNaN(start) && now < start) return false;
    if (!Number.isNaN(end) && now > end) return false;
    return true;
  }

  function matchesPage(popup, page) {
    var raw = String(popup.displayPages || 'all').trim().toLowerCase();
    if (!raw || raw === 'all') return true;
    var pages = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return pages.indexOf(page) !== -1;
  }

  function dismissKey(popup) {
    var version = popup.updatedAt || popup.createdAt || 'v1';
    return 'bb_popup_dismiss_' + String(popup.id || 'popup') + '_' + String(version);
  }

  function isDismissed(popup) {
    var key = dismissKey(popup);
    var mode = String(popup.dismissMode || 'session').toLowerCase();
    if (mode === 'session') {
      return sessionStorage.getItem(key) === '1';
    }
    if (mode === '7_days') {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return false;
        var exp = Number(raw);
        if (!Number.isNaN(exp) && exp > Date.now()) return true;
        localStorage.removeItem(key);
      } catch (e) {}
      return false;
    }
    if (mode === 'until_closed') {
      return localStorage.getItem(key) === '1';
    }
    return sessionStorage.getItem(key) === '1';
  }

  function setDismissed(popup) {
    var key = dismissKey(popup);
    var mode = String(popup.dismissMode || 'session').toLowerCase();
    try {
      if (mode === 'session') {
        sessionStorage.setItem(key, '1');
      } else if (mode === '7_days') {
        localStorage.setItem(key, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      } else if (mode === 'until_closed') {
        localStorage.setItem(key, '1');
      } else {
        sessionStorage.setItem(key, '1');
      }
    } catch (e) {}
  }

  function pickPopup(popups, page) {
    var now = Date.now();
    var eligible = (Array.isArray(popups) ? popups : []).filter(function (p) {
      if (!p || !p.enabled) return false;
      if (!isWithinSchedule(p, now)) return false;
      if (!matchesPage(p, page)) return false;
      if (isDismissed(p)) return false;
      return true;
    });

    eligible.sort(function (a, b) {
      var pa = Number(a.priority) || 0;
      var pb = Number(b.priority) || 0;
      if (pb !== pa) return pb - pa;
      var da = Date.parse(a.createdAt || 0) || 0;
      var db = Date.parse(b.createdAt || 0) || 0;
      return db - da;
    });

    return eligible[0] || null;
  }

  function renderPopup(popup) {
    var lang = getLang();
    var title = pickLocalized(popup, 'title', lang);
    var body = pickLocalized(popup, 'body', lang);
    var ctaText = pickLocalized(popup, 'ctaText', lang);
    var ctaUrl = safeUrl(popup.ctaUrl);
    var imageUrl = safeUrl(popup.imageUrl);

    if (!title && !body && !imageUrl) return;

    var overlay = document.createElement('div');
    overlay.className = 'bb-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title || 'Announcement');

    var closeLabel = lang === 'ar' ? 'إغلاق' : lang === 'fr' ? 'Fermer' : 'Close';
    var ctaFallback = lang === 'ar' ? 'عرض' : lang === 'fr' ? 'Voir' : 'View';
    var dir = lang === 'ar' ? 'rtl' : 'ltr';

    var actionsHtml = '';
    if (ctaUrl) {
      actionsHtml += '<a class="bb-popup-btn bb-popup-btn-primary" href="' + escapeHtml(ctaUrl) + '" data-bb-popup-cta="1">' + escapeHtml(ctaText || ctaFallback) + '</a>';
    }
    actionsHtml += '<button type="button" class="bb-popup-btn bb-popup-btn-secondary" data-bb-popup-close="1">' + escapeHtml(closeLabel) + '</button>';

    overlay.innerHTML =
      '<div class="bb-popup-modal" dir="' + dir + '">' +
        '<button type="button" class="bb-popup-close" aria-label="' + escapeHtml(closeLabel) + '" data-bb-popup-close="1">&times;</button>' +
        (imageUrl ? '<img class="bb-popup-image" src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy">' : '') +
        '<div class="bb-popup-body">' +
          '<div class="bb-popup-eyebrow">ByBens</div>' +
          (title ? '<h2 class="bb-popup-title">' + escapeHtml(title) + '</h2>' : '') +
          (body ? '<p class="bb-popup-text">' + escapeHtml(body) + '</p>' : '') +
          '<div class="bb-popup-actions">' + actionsHtml + '</div>' +
        '</div>' +
      '</div>';

    var previousOverflow = document.body.style.overflow;
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      setDismissed(popup);
      overlay.classList.remove('open');
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      setTimeout(function () {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 260);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'Esc') close();
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        close();
        return;
      }
      var closeBtn = e.target.closest('[data-bb-popup-close="1"]');
      if (closeBtn) {
        e.preventDefault();
        close();
        return;
      }
      var ctaBtn = e.target.closest('[data-bb-popup-cta="1"]');
      if (ctaBtn) {
        setDismissed(popup);
      }
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function () {
      overlay.classList.add('open');
      var focusTarget = overlay.querySelector('.bb-popup-btn-primary') || overlay.querySelector('[data-bb-popup-close="1"]');
      if (focusTarget && focusTarget.focus) focusTarget.focus();
    });
  }

  function init() {
    if (!window.getInitialData) {
      setTimeout(init, 50);
      return;
    }

    window.getInitialData().then(function (data) {
      var popup = pickPopup(data && data.popups, getCurrentPage());
      if (popup) renderPopup(popup);
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
