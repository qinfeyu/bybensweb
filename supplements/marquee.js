(function() {
  const placeholder = document.getElementById("marqueePlaceholder");
  if (!placeholder) return;

  const defaultText = "🚚 Free delivery over 15 000 DA CODE: FREEDELIVERY";

  function renderMarquee(text, enabled) {
    if (enabled) {
      placeholder.innerHTML = `
        <div class="marquee-bar" role="marquee" aria-label="Promotions">
          <div class="marquee-track">
            <span class="marquee-item">${text}</span>
          </div>
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