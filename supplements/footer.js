/**
 * ByBen's E-Commerce - Modular Footer Component
 * This script injects the footer HTML, styles, and handles modal logic.
 */

(function() {

  // Force light mode and clean up any legacy dark mode settings
  document.documentElement.removeAttribute('data-theme');
  localStorage.removeItem('bybens_theme');

  const footerHTML = `
    <footer class="site-footer" role="contentinfo">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="/supplements" class="footer-logo" style="margin-bottom: 16px; display: inline-flex">
              <img src="/images/logo.png" alt="ByBens Logo" width="140" height="70" style="height: 70px; width: auto; object-fit: contain; position: static !important; transform: none !important;" class="footer-brand-logo" />
            </a>
            <p data-i18n="footer.brand.desc">Algeria's premier destination for authentic sports nutrition. We bring world-class supplements directly to your door.</p>
            <div class="social-links">
              <a href="https://www.facebook.com/bens.supplements" class="social-link" aria-label="Facebook" target="_blank" rel="noopener">f</a>
              <a href="https://www.instagram.com/bens.supplements" class="social-link" aria-label="Instagram" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="https://wa.me/213662269449" class="social-link" aria-label="WhatsApp" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </a>
            </div>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.links">Quick Links</h4>
            <ul>
              <li><a href="/supplements" data-i18n="nav.home">Home</a></li>
              <li><a href="/supplements/products" data-i18n="nav.products">Products</a></li>
              <li><a href="#" data-i18n="footer.shipping" onclick="openShippingModal();return false;">Shipping Policy</a></li>
              <li><a href="#" data-i18n="footer.returns" onclick="openReturnsModal();return false;">Returns</a></li>
              <li><a href="/supplements/privacy" data-i18n="footer.privacy">Privacy Policy</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.categories">Categories</h4>
            <ul id="footerCategoryList"></ul>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.contact">Send a Message</h4>
            <form class="contact-form" onsubmit="handleContactForm(event)">
              <div class="form-group">
                <input class="form-input" type="text" id="contactName" placeholder="Your Name" data-i18n="form.name" required />
              </div>
              <div class="form-group">
                <input class="form-input" type="text" id="contactEmail" placeholder="Email / Phone" data-i18n="form.email" required />
              </div>
              <div class="form-group">
                <textarea class="form-input form-textarea" id="contactMsg" placeholder="Message" data-i18n="form.message" required></textarea>
              </div>
              <button type="submit" class="btn-send">
                <span data-i18n="form.send">Send Message</span>
              </button>
            </form>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© <span id="footerYear"></span> ByBen's Algeria. <span data-i18n="footer.rights">All rights reserved.</span></p>
        </div>
      </div>
    </footer>

    <!-- Modals -->
    <div class="about-overlay" id="shippingOverlay" onclick="if(event.target===this)closeShippingModal()">
      <div class="about-modal" role="dialog" aria-modal="true">
        <button class="about-close" onclick="closeShippingModal()" aria-label="Close">&#x2715;</button>
        <div class="about-header">
          <div class="about-brand" data-i18n="shipping.title">Shipping Policy</div>
          <div class="about-sub">ByBen's Supplements</div>
        </div>
        <div class="about-body">
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="shipping.item1.title">Nationwide Delivery</h4>
              <p data-i18n="shipping.item1.text">Delivery to all 58 wilayas via Imir Logistics.</p>
            </div>
          </div>
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-8 8M8 8l8 8"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="shipping.item2.title">Free Delivery</h4>
              <p data-i18n="shipping.item2.text">Orders over 15,000 DA enjoy free delivery!</p>
            </div>
          </div>
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="shipping.item3.title">Standard Timing</h4>
              <p data-i18n="shipping.item3.text">Orders are processed within 24 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="about-overlay" id="returnsOverlay" onclick="if(event.target===this)closeReturnsModal()">
      <div class="about-modal" role="dialog" aria-modal="true">
        <button class="about-close" onclick="closeReturnsModal()" aria-label="Close">&#x2715;</button>
        <div class="about-header">
          <div class="about-brand" data-i18n="returns.title">Returns & Refunds</div>
          <div class="about-sub">ByBen's Supplements</div>
        </div>
        <div class="about-body">
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="returns.item1.title">Return Policy</h4>
              <p data-i18n="returns.item1.text">7 days to return unopened products.</p>
            </div>
          </div>
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="returns.item2.title">Easy Process</h4>
              <p data-i18n="returns.item2.text">Contact us via WhatsApp or Instagram.</p>
            </div>
          </div>
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="returns.item3.title">Refund Method</h4>
              <p data-i18n="returns.item3.text">Store credit or exchanges available.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="about-overlay" id="aboutOverlay" onclick="if(event.target===this)closeAboutModal()">
      <div class="about-modal" role="dialog" aria-modal="true">
        <button class="about-close" onclick="closeAboutModal()" aria-label="Close">&#x2715;</button>
        <div class="about-header">
          <div class="about-brand">BY<span>BEN'S</span></div>
          <div class="about-sub">Supplements</div>
        </div>
        <div class="about-body">
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="about.who.title">Who We Are</h4>
              <p data-i18n="about.who.text">Trusted supplements store in Algeria.</p>
            </div>
          </div>
          <div class="about-card">
            <div class="about-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div class="about-card-text">
              <h4 data-i18n="about.order.title">How to Order</h4>
              <p data-i18n="about.order.text">Simple process, cash on delivery.</p>
            </div>
          </div>
        </div>
        <div class="about-cta-wrap">
          <a href="/supplements/products" class="about-cta" data-i18n="about.cta">Shop Now</a>
        </div>
      </div>
    </div>
  `;

  // Modal Functions
  window.openShippingModal = function() { document.getElementById("shippingOverlay").classList.add("open"); document.body.style.overflow = "hidden"; };
  window.closeShippingModal = function() { document.getElementById("shippingOverlay").classList.remove("open"); document.body.style.overflow = ""; };
  window.openReturnsModal = function() { document.getElementById("returnsOverlay").classList.add("open"); document.body.style.overflow = "hidden"; };
  window.closeReturnsModal = function() { document.getElementById("returnsOverlay").classList.remove("open"); document.body.style.overflow = ""; };
  window.openAboutModal = function() { document.getElementById("aboutOverlay").classList.add("open"); document.body.style.overflow = "hidden"; };
  window.closeAboutModal = function() { document.getElementById("aboutOverlay").classList.remove("open"); document.body.style.overflow = ""; };

  // Inject HTML
  const placeholder = document.getElementById("footerPlaceholder");
  if (placeholder) placeholder.innerHTML = footerHTML;
  else document.body.insertAdjacentHTML('beforeend', footerHTML);

  // Sync footer logo immediately after injection
  updateLogos(document.documentElement.getAttribute('data-theme') === 'dark');

  // Set Year
  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Contact form — shared across all pages
  window.handleContactForm = async function(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type=submit]');
    const name = (document.getElementById('contactName') || {}).value || '';
    const contact = (document.getElementById('contactEmail') || {}).value || '';
    const message = (document.getElementById('contactMsg') || {}).value || '';
    if (!name.trim() || !contact.trim() || !message.trim()) return;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:.7">Sending…</span>';
    try {
      const sbUrl = window.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";
      const sbKey = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";
      await fetch(sbUrl + '/functions/v1/submit-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + sbKey,
        },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), message: message.trim() }),
      });
    } catch (_) {}
    btn.disabled = false;
    btn.innerHTML = orig;
    form.reset();
    const lang = (window.currentLang) || 'en';
    const msg = (window.i18n && window.i18n[lang] && window.i18n[lang]['toast.sent']) || 'Message sent!';
    if (window.showToast) window.showToast(msg);
  };

})();