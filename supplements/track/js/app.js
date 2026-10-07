document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("trackForm");
  const trackBtn = document.getElementById("trackBtn");
  const errorMsg = document.getElementById("errorMsg");
  const loader = document.getElementById("trackLoader");
  const results = document.getElementById("trackResults");
  const statusSummary = document.getElementById("statusSummary");
  const timelineList = document.getElementById("timelineList");

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

  function getLang() {
    return localStorage.getItem('bybens_lang') || 'en';
  }

  function translateStatus(code) {
    const lang = getLang();
    if (STATUS_MAP[code] && STATUS_MAP[code][lang]) {
      return STATUS_MAP[code][lang];
    }
    // Fallback: capitalize the raw code
    return code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatDate(dateStr, timeStr) {
    try {
      const d = new Date(`${dateStr}T${timeStr}`);
      return d.toLocaleString(getLang() === 'fr' ? 'fr-FR' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch(e) {
      return `${dateStr} ${timeStr}`;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderId = document.getElementById("orderId").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!orderId || !phone) {
      errorMsg.textContent = "Please fill in both fields.";
      return;
    }

    errorMsg.textContent = "";
    results.classList.add("hidden");
    loader.classList.remove("hidden");
    trackBtn.disabled = true;

    try {
      const res = await fetch(`/api/ecotrack?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json();

      if (!data.success) {
        errorMsg.textContent = data.error || "Could not track order.";
      } else if (!data.trackingId) {
        // Order exists in DB but not yet dispatched to Ecotrack
        statusSummary.innerHTML = `
          <h2 style="color:var(--text)">Processing</h2>
          <p>${data.message || "Your order is being prepared."}</p>
        `;
        timelineList.innerHTML = `
          <li class="timeline-item active">
            <div class="timeline-dot"></div>
            <div class="timeline-date">Now</div>
            <div class="timeline-status">Order Confirmed</div>
            <div class="timeline-loc">ByBens Warehouse</div>
          </li>
        `;
        results.classList.remove("hidden");
      } else if (data.trackingData) {
        // We have full tracking data
        renderTrackingData(data.trackingData);
        results.classList.remove("hidden");
      } else {
        errorMsg.textContent = "Tracking data is currently unavailable.";
      }
    } catch (err) {
      errorMsg.textContent = "A network error occurred. Please try again.";
    } finally {
      loader.classList.add("hidden");
      trackBtn.disabled = false;
    }
  });

  function renderTrackingData(td) {
    const activities = td.activity || [];
    
    if (activities.length === 0) {
      statusSummary.innerHTML = `
        <h2>Information Received</h2>
        <p>Your package info has been transmitted to the delivery partner.</p>
      `;
      timelineList.innerHTML = `
        <li class="timeline-item active">
          <div class="timeline-dot"></div>
          <div class="timeline-date">Recent</div>
          <div class="timeline-status">Awaiting Pickup</div>
        </li>
      `;
      return;
    }

    // Sort descending (newest first) assuming Ecotrack returns them chronological or reverse.
    // We will parse date/time to be safe.
    activities.sort((a, b) => {
      return new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`);
    });

    const latest = activities[0];
    const isDelivered = latest.status === 'livred';

    statusSummary.innerHTML = `
      <h2 class="${isDelivered ? 'status-success' : ''}">${translateStatus(latest.status)}</h2>
      <p>Tracking ID: <strong>${td.recipientName ? 'Active' : ''}</strong></p>
    `;

    timelineList.innerHTML = activities.map((act, index) => {
      const isFirst = index === 0;
      const isOk = act.status === 'livred';
      return `
        <li class="timeline-item ${isFirst ? 'active' : ''} ${isOk ? 'success' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-date">${formatDate(act.date, act.time)}</div>
          <div class="timeline-status">${translateStatus(act.status)}</div>
          ${act.scanLocation ? `<div class="timeline-loc">${act.scanLocation}</div>` : ''}
        </li>
      `;
    }).join('');
  }
});
