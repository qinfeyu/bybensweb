/**
 * Formats phone numbers (e.g. 0550123456 -> 213550123456) for WhatsApp click-to-chat API
 */
export function formatPhoneForWhatsApp(phoneStr?: string): string {
  if (!phoneStr) return '';
  let clean = phoneStr.replace(/[^\d]/g, '');
  if (!clean) return '';

  // Algerian phone formatting: 05xx/06xx/07xx (10 digits) -> 2135xx/2136xx/2137xx
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '213' + clean.substring(1);
  }
  return clean;
}

/**
 * Generates WhatsApp click-to-chat URL with pre-filled encoded text
 */
export function getWhatsAppUrl(phoneStr?: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phoneStr);
  if (!formattedPhone) return '#';
  const encodedText = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${formattedPhone}${encodedText ? `?text=${encodedText}` : ''}`;
}

/**
 * WhatsApp Message Templates
 */
export const WhatsAppTemplates = {
  orderStatus: (customerName: string, orderId: string, status: string, total: number) => {
    const statusText =
      status === 'confirmed' ? 'confirmée' :
      status === 'delivered' ? 'livrée' :
      status === 'shipping' ? 'en cours de livraison' :
      status === 'canceled' ? 'annulée' : 'reçue et en attente';

    return `Bonjour ${customerName || ''},\nNous vous contactons de chez BYBENS concernant votre commande #${orderId} (${Number(total || 0).toLocaleString()} DA).\nVotre commande est actuellement : ${statusText}.\nN'hésitez pas à nous contacter pour toute question !`;
  },

  orderConfirmationRequest: (customerName: string, orderId: string, itemsSummary: string, total: number, wilaya: string) => {
    const name = customerName ? customerName.trim() : '';
    const summary = itemsSummary && itemsSummary !== '—' ? ` (${itemsSummary})` : '';
    const location = wilaya ? ` vers ${wilaya}` : '';

    return `Bonjour ${name},\n\nNous vous contactons de la part de BYBENS Sports Nutrition concernant votre commande #${orderId}${summary} d'un montant de ${Number(total || 0).toLocaleString()} DA${location}.\n\nMerci de nous confirmer si vous souhaitez que nous procédions à l'expédition de votre colis aujourd'hui ? 📦🚚\n\nDans l'attente de votre réponse !`;
  },

  preorderUpdate: (customerName: string, preorderId: string, itemsSummary: string) => {
    return `Bonjour ${customerName || ''},\nVotre précommande #${preorderId} (${itemsSummary}) chez BYBENS est disponible !\nMerci de nous contacter pour organiser la livraison.`;
  },

  unpaidReminder: (customerName: string, balance: number) => {
    return `Bonjour ${customerName || ''},\nPetit rappel amical concernant votre solde d'achat chez BYBENS (${Number(balance || 0).toLocaleString()} DA).\nMerci de nous indiquer la date souhaitée pour le règlement.`;
  },

  generalGreeting: (customerName: string) => {
    return `Bonjour ${customerName || ''},\nComment pouvons-nous vous aider aujourd'hui chez BYBENS Supplements ?`;
  }
};
