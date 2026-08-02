import React from 'react';
import type { TabType } from '../types';
import { 
  LayoutDashboard, 
  Boxes, 
  ShoppingBag, 
  Layers,
  ShoppingCart, 
  Clock, 
  Calculator,
  CreditCard,
  Receipt, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck,
  X,
  Globe,
  ExternalLink,
  Truck,
  Tag,
  Package
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  adminEmail?: string;
  onLogout?: () => void;
  unpaidCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  adminEmail,
  onLogout,
  unpaidCount = 0,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const menuItems: Array<{ id: TabType; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory (SKUs)', icon: <Boxes className="w-4 h-4" /> },
    { id: 'products', label: 'Products Catalog', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'categories', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
    { id: 'promos', label: 'Promo Codes', icon: <Tag className="w-4 h-4 text-red-400" /> },
    { id: 'bundle', label: 'Featured Bundle', icon: <Package className="w-4 h-4 text-amber-400" /> },
    { id: 'delivery', label: 'Wilaya Delivery', icon: <Truck className="w-4 h-4 text-emerald-400" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'preorders', label: 'Pre-Orders', icon: <Clock className="w-4 h-4" /> },
    { id: 'pos', label: 'POS Terminal', icon: <Calculator className="w-4 h-4" /> },
    { id: 'unpaid', label: 'Unpaid & Credit', icon: <CreditCard className="w-4 h-4 text-amber-400" />, badge: unpaidCount },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-900 text-white border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        {(!isCollapsed || isMobileOpen) && (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-red-700 rounded-lg flex items-center justify-center font-black text-xs">B</span>
            <span className="font-extrabold text-sm tracking-wider uppercase">BYBENS Panel</span>
          </div>
        )}

        {/* Mobile Close Button */}
        {isMobileOpen ? (
          <button
            onClick={onCloseMobile}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors mx-auto hidden md:flex"
            aria-label="Toggle sidebar collapse"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map(item => {
          const isActive = activeTab === item.id;
          const showCollapsed = isCollapsed && !isMobileOpen;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              } ${showCollapsed ? 'justify-center px-0' : ''}`}
              title={showCollapsed ? item.label : undefined}
            >
              <span className="shrink-0 relative">
                {item.icon}
                {showCollapsed && !!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </span>
              {!showCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!showCollapsed && !!item.badge && item.badge > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Link to Storefront */}
      <div className="px-3 py-2 border-t border-slate-800 shrink-0">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 py-2 px-3 rounded-xl font-bold text-[11px] transition-all shadow-2xs group"
          title="Open live customer storefront website"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
          {(!isCollapsed || isMobileOpen) && <span>Visit Storefront</span>}
          {(!isCollapsed || isMobileOpen) && <ExternalLink className="w-3 h-3 text-emerald-400/70 ml-auto" />}
        </a>
      </div>

      {/* Footer User & Auth Controls */}
      <div className="p-3 border-t border-slate-800 text-xs shrink-0">
        {(!isCollapsed || isMobileOpen) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-hidden text-slate-300 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-[11px] font-bold">{adminEmail || 'admin@bybens.com'}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>

            {onLogout && (
              <button
                onClick={() => { if (onLogout) onLogout(); if (onCloseMobile) onCloseMobile(); }}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-rose-900/80 hover:text-white text-slate-400 py-2 px-3 rounded-xl font-bold text-[11px] transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        ) : (
          onLogout && (
            <button
              onClick={onLogout}
              className="w-full p-2 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white rounded-xl flex justify-center transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Sliding Drawer */}
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
