import { InventoryItem, Order, PreOrder, Product } from '../types';

export function calculateLandedCost(priceEur: number, rate: number, deliveryDzd: number): number {
  const eurRate = Number(rate) || 280;
  return (Number(priceEur || 0) * eurRate) + Number(deliveryDzd || 0);
}

export function calculateMargin(retailDzd: number, landedCost: number): number {
  return Number(retailDzd || 0) - landedCost;
}

export function calculateMarginPct(retailDzd: number, margin: number): number {
  const retail = Number(retailDzd || 0);
  if (retail <= 0) return 0;
  return (margin / retail) * 100;
}

export function calculateWeightedAverageEurPrice(
  currentTotalStockOverall: number,
  currentPriceEur: number,
  addedEuQty: number,
  newPriceEur: number
): number {
  const totalQty = currentTotalStockOverall + addedEuQty;
  if (totalQty <= 0) return newPriceEur;
  const weighted = ((currentTotalStockOverall * currentPriceEur) + (addedEuQty * newPriceEur)) / totalQty;
  return parseFloat(weighted.toFixed(2));
}

export function getProductPricingAndCost(
  productId: string,
  variantName: string | undefined,
  fallbackPrice: number,
  inventoryItems: InventoryItem[],
  products: Product[],
  defaultEurRate: number = 280
): { retailPrice: number; unitCost: number; productName: string } {
  const eurRate = defaultEurRate || 280;
  let retailPrice = Number(fallbackPrice) || 0;
  let unitCost = 0;
  let productName = "";
  let inv: InventoryItem | undefined;

  const pIdStr = String(productId || "").toLowerCase().trim();
  const vNameStr = String(variantName || "").toLowerCase().trim();

  // 1. Direct SKU ID / SKU code match
  inv = inventoryItems.find(x => 
    String(x.id || "").toLowerCase().trim() === pIdStr ||
    String(x.sku || "").toLowerCase().trim() === pIdStr
  );

  // 2. Look up in products catalog
  const prod = products.find(p => 
    String(p.id || "").toLowerCase().trim() === pIdStr || 
    String(p.name || "").toLowerCase().trim() === pIdStr
  );

  if (prod) {
    productName = `${prod.brand ? prod.brand + ' - ' : ''}${prod.name}`;
    if (prod.variants && prod.variants.length > 0) {
      const v = prod.variants.find(x => {
        const label = x.weight ? `${x.weight}${x.unit || ""}`.trim().toLowerCase() : String(x.label || x.name || "").trim().toLowerCase();
        return label === vNameStr || !vNameStr;
      }) || prod.variants[0];

      if (v) {
        if (Number(v.price)) retailPrice = Number(v.price);
        
        if (v.sku) {
          const targetSkuStr = String(v.sku).toLowerCase().trim();
          const linkedInv = inventoryItems.find(x => 
            String(x.id || "").toLowerCase().trim() === targetSkuStr ||
            String(x.sku || "").toLowerCase().trim() === targetSkuStr
          );
          if (linkedInv) inv = linkedInv;
        }

        if (!inv) {
          if (Number(v.cost)) unitCost = Number(v.cost);
          else if (Number(v.cost_eur)) unitCost = Number(v.cost_eur) * eurRate;
        }
      }
    }
  }

  // 3. Fallback search in inventoryItems by Name
  if (!inv && pIdStr) {
    inv = inventoryItems.find(x => String(x.name || "").toLowerCase().trim() === pIdStr);
  }

  // 4. Calculate landed unit cost & retail price from matched inventory item
  if (inv) {
    const rate = Number(inv.rate) || eurRate;
    const pEur = Number(inv.price_eur) || 0;
    const del = Number(inv.delivery_dzd) || 0;
    unitCost = (pEur * rate) + del;
    if (Number(inv.retail_dzd)) {
      retailPrice = Number(inv.retail_dzd);
    }
    productName = `${inv.brand ? inv.brand + ' - ' : ''}${inv.name}${inv.variant_spec ? ' (' + inv.variant_spec + ')' : ''}`;
  }

  if (!productName) productName = String(productId || "Unknown Item");
  if (!retailPrice && fallbackPrice) retailPrice = Number(fallbackPrice);

  return { retailPrice, unitCost, productName };
}

export function calculateOrderProfit(
  o: Order,
  inventoryItems: InventoryItem[],
  products: Product[],
  defaultEurRate: number = 280
): number {
  if (!o) return 0;
  const items = o.items || [];
  
  let itemRevenue = 0;
  let totalCogs = 0;

    items.forEach(it => {
      const qty = Number(it.qty) || 1;
      let unitP = Number(it.unitPrice || it.unit_price || it.price) || 0;
      const info = getProductPricingAndCost(
        it.productId || it.product_id || it.id || it.name || it.product_name || "", 
        it.variant, 
        unitP > 0 ? unitP : 0,
        inventoryItems,
        products,
        defaultEurRate
      );
      const actualUnitP = (unitP > 0 ? unitP : (info.retailPrice > 0 ? info.retailPrice : Math.abs(unitP))) || 0;
      itemRevenue += actualUnitP * qty;
      totalCogs += (info.unitCost || (actualUnitP * 0.7)) * qty;
    });

  const delCost = Number(o.delivery_cost || o.deliveryCost) || 0;
  const rawTotal = Number(o.total) || 0;
  const rawSubtotal = Number(o.subtotal) || 0;

  let netRev = 0;
  if (itemRevenue > 0) {
    netRev = itemRevenue;
  } else if (rawSubtotal > 0) {
    netRev = rawSubtotal;
  } else if (rawTotal > 0) {
    netRev = Math.max(0, rawTotal - delCost);
  }

  if (totalCogs <= 0 && netRev > 0) {
    totalCogs = netRev * 0.70;
  }

  return netRev - totalCogs;
}

export function calculatePreorderProfit(
  p: PreOrder,
  preorderItems: any[],
  inventoryItems: InventoryItem[],
  products: Product[],
  defaultEurRate: number = 280
): number {
  if (!p) return 0;
  const items = preorderItems.filter(x => x.pre_order_id === p.id);
  
  let itemRevenue = 0;
  let totalCogs = 0;

  if (items.length > 0) {
    items.forEach(itm => {
      const qty = Number(itm.qty) || 1;
      const fallbackPrice = Number(itm.unit_price || itm.price || itm.unitPrice) || 0;
      const info = getProductPricingAndCost(
        itm.product_id || itm.product_name, 
        itm.variant, 
        fallbackPrice,
        inventoryItems,
        products,
        defaultEurRate
      );
      const price = fallbackPrice || info.retailPrice || 0;
      itemRevenue += price * qty;
      totalCogs += (info.unitCost || (price * 0.7)) * qty;
    });
  }

  const netRev = itemRevenue > 0 ? itemRevenue : (Number(p.total_amount) || 0);
  if (totalCogs <= 0 && netRev > 0) {
    totalCogs = netRev * 0.70;
  }

  return netRev - totalCogs;
}
