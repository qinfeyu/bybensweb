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
  Receipt, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  adminEmail?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  adminEmail,
  onLogout
}) => {
  const menuItems: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory (SKUs)', icon: <Boxes className="w-4 h-4" /> },
    { id: 'products', label: 'Products Catalog', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'categories', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'preorders', label: 'Pre-Orders', icon: <Clock className="w-4 h-4" /> },
    { id: 'pos', label: 'POS Terminal', icon: <Calculator className="w-4 h-4" /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className={`bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-red-700 rounded-lg flex items-center justify-center font-black text-xs">B</span>
            <span className="font-extrabold text-sm tracking-wider uppercase">BYBENS Panel</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors mx-auto"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map(item => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer User & Auth Controls */}
      <div className="p-3 border-t border-slate-800 text-xs">
        {!isCollapsed ? (
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
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-rose-900/80 hover:text-white text-slate-400 py-1.5 px-3 rounded-xl font-bold text-[11px] transition-all"
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
    </aside>
  );
};
