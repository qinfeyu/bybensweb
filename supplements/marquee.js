(function() {
  const placeholder = document.getElementById("marqueePlaceholder");
  if (!placeholder) return;

  const defaultText = "🚚 Free delivery over 15 000 DA CODE: FREEDELIVERY";

  // Inject style tag for close button hover state
  if (!document.getElementById("marquee-close-style")) {
    const style = document.createElement("style");
    style.id = "marquee-close-style";
    style.textContent = `
      .marquee-close-btn:hover {
        opacity: 1 !important;
        transform: translateY(-50%) scale(1.15) !important;
      }
    `;
    document.head.appendChild(style);
  }

  window.dismissMarquee = function() {
    const bar = document.querySelector(".marquee-bar");
    if (bar) {
      bar.style.transition = "opacity 0.3s ease, height 0.3s ease";
      bar.style.opacity = "0";
      setTimeout(function() {
        bar.style.display = "none";
      }, 300);
    }
    sessionStorage.setItem("bb_marquee_dismissed", "1");
  };

  function renderMarquee(text, enabled) {
    if (enabled && sessionStorage.getItem("bb_marquee_dismissed") !== "1") {
      placeholder.innerHTML = `
        <div class="marquee-bar" role="marquee" aria-label="Promotions" style="position: relative;">
          <div class="marquee-track">
            <span class="marquee-item">${text}</span>
          </div>
          <button class="marquee-close-btn" onclick="dismissMarquee()" aria-label="Close banner" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; padding: 4px 8px; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.2s ease; z-index: 10;">&times;</button>
        </div>
      `;
    } else {
      placeholder.innerHTML = "";
    }
  }

  // Render default immediately so there's no layout shift on fresh loads
  renderMarquee(defaultText, true);

  // Once Supabase / API data loads, update the content dynamically
  if (window.getInitialData) {
    window.getInitialData().then(function(data) {
      if (data && Array.isArray(data.settings)) {
        const settingsMap = {};
        data.settings.forEach(function(s) {
          settingsMap[s.key] = s.value;
        });

        const enabled = settingsMap.marquee_enabled !== "false" && settingsMap.marquee_enabled !== false;
        const text = settingsMap.marquee_text || defaultText;
        renderMarquee(text, enabled);
      }
    }).catch(function() {
      // Keep default on error
    });
  }
})();