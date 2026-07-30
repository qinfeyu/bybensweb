// ByBen's Inventory Management Helper Module

export function sanitizeDbInventoryPayload(item) {
  if (!item) return null;
  return {
    id: String(item.id || "").trim(),
    type: item.type || "supplement",
    brand: item.brand || "",
    name: item.name || "",
    variant_spec: item.variant_spec || item.variant || null,
    size: item.size || null,
    price_eur: Number(item.price_eur) || 0,
    rate: Number(item.rate) || 250,
    delivery_dzd: Number(item.delivery_dzd) || 0,
    retail_dzd: Number(item.retail_dzd) || 0,
    stock: Number(item.stock) || 0
  };
}

export function generateSuggestedNextSKU(inventoryItems, type = "supplement") {
  const prefix = type === "snack" ? "SNK-" : "SUP-";
  const existingNums = inventoryItems
    .filter(i => (i.id || "").startsWith(prefix))
    .map(i => parseInt(i.id.replace(prefix, ""), 10))
    .filter(n => !isNaN(n));

  const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 1000;
  return `${prefix}${maxNum + 1}`;
}
