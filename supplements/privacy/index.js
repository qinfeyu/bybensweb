      const i18n = {
        en: { "nav.home": "Home", "search.cancel": "Cancel" },
        fr: { "nav.home": "Accueil", "search.cancel": "Annuler" },
        ar: { "nav.home": "الرئيسية", "search.cancel": "إلغاء" }
      };
      let currentLang = "en";

      function switchLang(lang) {
        currentLang = lang;
        const t = i18n[lang] || i18n.en;
        const isAr = lang === "ar";
        document.documentElement.lang = lang;
        document.documentElement.dir = isAr ? "rtl" : "ltr";
        document.querySelectorAll("[data-i18n]").forEach(function(el) {
          const key = el.getAttribute("data-i18n");
          if (t[key] !== undefined) {
            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = t[key];
            else el.textContent = t[key];
          }
        });
        document.querySelectorAll(".lang-btn").forEach(function(btn) {
          btn.classList.toggle("active", btn.dataset.lang === lang);
        });
        localStorage.setItem("bybens_lang", lang);
      }

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
            const ids = Array.isArray(s.category_ids)
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

      document.addEventListener("click", function(e) {
        var ds = document.getElementById("desktopSearch");
        if (ds && !ds.contains(e.target)) {
          document.getElementById("searchDropdown").classList.remove("open");
        }
      });

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

      /* ── Scroll ── */
      window.addEventListener("scroll", function() {
        document.getElementById("site-header").classList.toggle("scrolled", window.scrollY > 12);
      }, { passive: true });

      /* ── Init ── */
      var _wlStart = Date.now();
      document.addEventListener("DOMContentLoaded", function() {
        if (window.BYBENS_CONTENT) {
          ["en", "fr", "ar"].forEach(function(lang) {
            if (window.BYBENS_CONTENT[lang]) Object.assign(i18n[lang], window.BYBENS_CONTENT[lang]);
          });
        }
        const savedLang = localStorage.getItem("bybens_lang") || "en";
        if (savedLang !== "en") switchLang(savedLang);
        updateCartBadge();

        const SB_URL = window.SUPABASE_URL || "https://dbezrrzmcosxdoorbrgx.supabase.co";
        const SB_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZXpycnptY29zeGRvb3Jicmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTgxMTksImV4cCI6MjA5NTI5NDExOX0.xTBBzmLVX6uuqs-oaPifj-DvpBWIEaPZgQIsMIqbRew";
        const h = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };
        fetch(SB_URL + "/rest/v1/products?select=id,name,brand,price,variants,flavors,imageUrl", { headers: h })
          .then(function(r) { return r.json(); })
          .then(function(rows) {
            if (!Array.isArray(rows)) return;
            products = rows.map(function(p) {
              try { p.variants = typeof p.variants === "string" ? JSON.parse(p.variants) : (p.variants || []); } catch(e) { p.variants = []; }
              try { p.flavors = typeof p.flavors === "string" ? JSON.parse(p.flavors) : (p.flavors || []); } catch(e) { p.flavors = []; }
              try { p.imageUrl = typeof p.imageUrl === "string" && p.imageUrl[0] === "[" ? JSON.parse(p.imageUrl) : p.imageUrl; } catch(e) {}
              return p;
            });
            var inp = document.getElementById("searchInput");
            if (inp && inp.value.trim()) handleSearch(inp.value);
            var minp = document.getElementById("mobileSearchInput");
            if (minp && minp.value.trim()) handleMobileSearch(minp.value);
          })
          .catch(function() {});

        Promise.all([
          fetch(SB_URL + "/rest/v1/categories?select=id,name", { headers: h }).then(function(r) { return r.json(); }),
          fetch(SB_URL + "/rest/v1/sub_categories?select=id,name,category_ids", { headers: h }).then(function(r) { return r.json(); })
        ]).then(function(results) {
          renderCatNav(results[0] || [], results[1] || []);
        }).catch(function() {}).finally(function() {
          var _s = document.getElementById('dataSpinner');
          if (_s) _s.style.display = 'none';
          var _l = document.getElementById('pageLoader');
          if (_l && !_l._exiting) {
            sessionStorage.setItem('bb_wl', '1');
            var _delay = Math.max(0, 1600 - (Date.now() - _wlStart));
            setTimeout(function() { _l._exiting = true; _l.classList.add('wl-exit'); setTimeout(function() { _l.classList.add('hidden'); }, 700); }, _delay);
          }
        });
      });
