import React from 'react';
import { InventoryItem, Order, PreOrder, Expense, Product } from '../types';
import { calculateOrderProfit, calculateLandedCost } from '../lib/calculations';
import { TrendingUp, ShoppingCart, DollarSign, Layers, Warehouse, ArrowUpRight } from 'lucide-react';

interface DashboardPageProps {
  orders: Order[];
  preorders: PreOrder[];
  preorderItems: any[];
  inventoryItems: InventoryItem[];
  products: Product[];
  expenses: Expense[];
  eurRate: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders,
  inventoryItems,
  products,
  expenses,
  eurRate
}) => {
  // 1. Total Completed Sales Revenue
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const totalSalesRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // 2. Total Net Profit from Sales
  const totalNetProfit = deliveredOrders.reduce((sum, o) => sum + calculateOrderProfit(o, inventoryItems, products, eurRate), 0);

  // 3. Warehouse Asset Valuation in DZD (Based on Retail Price as requested)
  const warehouseAssetValuationDzd = inventoryItems.reduce((sum, item) => {
    const totalQty = (Number(item.stock) || 0) + (Number(item.stock_eu) || 0);
    const retailP = Number(item.retail_dzd) || 0;
    return sum + (totalQty * retailP);
  }, 0);

  // 4. Warehouse Asset Valuation in EUR Landed Cost
  const warehouseAssetValuationEur = inventoryItems.reduce((sum, item) => {
    const totalQty = (Number(item.stock) || 0) + (Number(item.stock_eu) || 0);
    const costEur = Number(item.price_eur) || 0;
    return sum + (totalQty * costEur);
  }, 0);

  // 5. Total Expenses (converted to DZD)
  const totalExpensesDzd = expenses.reduce((sum, exp) => {
    const amt = Number(exp.amount) || 0;
    return sum + (exp.currency === 'EUR' ? amt * eurRate : amt);
  }, 0);

  const netIncomeAfterOpex = totalNetProfit - totalExpensesDzd;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-xs text-slate-500 mt-1">Live financial analytics, inventory valuation, and sales metrics.</p>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {totalSalesRevenue.toLocaleString('fr-DZ')} <span className="text-sm font-semibold text-slate-500">DA</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-emerald-600">{deliveredOrders.length}</span> delivered orders
            </div>
          </div>
        </div>

        {/* Card 2: Estimated Sales Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Gross Benefit</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">
              +{Math.round(totalNetProfit).toLocaleString('fr-DZ')} <span className="text-sm font-semibold text-slate-500">DA</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sales revenue minus landed COGS
            </div>
          </div>
        </div>

        {/* Card 3: Warehouse Valuation (Retail DZD) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Valuation (Retail)</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {warehouseAssetValuationDzd.toLocaleString('fr-DZ')} <span className="text-sm font-semibold text-slate-500">DA</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Based on inventory retail prices
            </div>
          </div>
        </div>

        {/* Card 4: Warehouse Valuation (EUR) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Cost (€)</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">
              {warehouseAssetValuationEur.toLocaleString('fr-DZ')} <span className="text-sm font-semibold text-slate-500">€</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Total purchase value in EU stock
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Financial & Inventory Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Summary */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-600" />
              <span>Inventory Asset Breakdown</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">{inventoryItems.length} active SKUs</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-xs font-medium text-slate-500">Supplements Inventory</div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {inventoryItems.filter(i => i.type === 'supplement').reduce((s, i) => s + (i.stock || 0) + (i.stock_eu || 0), 0)} units
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-xs font-medium text-slate-500">Snacks Inventory</div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {inventoryItems.filter(i => i.type === 'snack').reduce((s, i) => s + (i.stock || 0) + (i.stock_eu || 0), 0)} units
              </div>
            </div>
          </div>
        </div>

        {/* Operating Expenses & Net Income */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
            P&L Summary
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Gross Sales Benefit</span>
              <span className="font-bold text-emerald-600">+{Math.round(totalNetProfit).toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Operating Expenses</span>
              <span className="font-bold text-rose-600">-{Math.round(totalExpensesDzd).toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between items-center pt-2 font-bold text-sm">
              <span className="text-slate-900">Net Profit</span>
              <span className={netIncomeAfterOpex >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {netIncomeAfterOpex >= 0 ? '+' : ''}{Math.round(netIncomeAfterOpex).toLocaleString()} DA
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
