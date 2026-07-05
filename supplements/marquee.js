(function() {
  const marqueeHTML = `
    <div class="marquee-bar" role="marquee" aria-label="Promotions">
      <div class="marquee-track">
        <span class="marquee-item">🚚 Free delivery over 15 000 DA CODE: FREEDELIVERY</span>
      </div>
    </div>
  `;

  const placeholder = document.getElementById("marqueePlaceholder");
  if (placeholder) {
    placeholder.innerHTML = marqueeHTML;
  }
})();