import React from 'react';
import { TabType, AppSettings } from '../../types';
import { 
  LayoutDashboard, 
  PackageSearch, 
  Boxes, 
  ShoppingBag, 
  Clock, 
  Store, 
  Receipt, 
  LogOut,
  Euro,
  Coins
} from 'lucide-react';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  settings: AppSettings;
  onOpenBudgetModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenBudgetModal,
  onLogout
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <PackageSearch className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Boxes className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'preorders', label: 'Pre-Orders', icon: <Clock className="w-4 h-4" /> },
    { id: 'pos', label: 'POS Terminal', icon: <Store className="w-4 h-4" /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 text-white font-extrabold text-lg tracking-wider px-3 py-1 rounded-lg shadow-sm">
              BYBENS
            </div>
            <div className="hidden sm:block text-xs font-semibold text-slate-400 border-l border-slate-800 pl-3">
              Management Portal 2.0
            </div>
          </div>

          {/* Budget Badges & Quick Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenBudgetModal}
              className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl px-3 py-1.5 transition-all text-xs font-medium text-slate-200"
              title="Click to manage budget balances and currency exchanges"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Coins className="w-3.5 h-3.5" />
                <span>{Number(settings.budget_dzd || 0).toLocaleString('fr-DZ')} DA</span>
              </div>
              <div className="w-px h-3.5 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <Euro className="w-3.5 h-3.5" />
                <span>{Number(settings.budget_eur || 0).toLocaleString('fr-DZ')} €</span>
              </div>
              <div className="w-px h-3.5 bg-slate-700" />
              <span className="text-[11px] text-slate-400">Rate: {settings.budget_rate || 280} DA</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/50 rounded-xl px-3 py-1.5 transition-colors font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-red-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
