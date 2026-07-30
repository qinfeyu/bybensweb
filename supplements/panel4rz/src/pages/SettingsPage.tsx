import React, { useState } from 'react';
import type { AppSettings, Product, InventoryItem, Category, Customer, Order, PreOrder, Expense } from '../types';
import { supabase } from '../lib/supabase';
import { 
  Settings, 
  Save, 
  User, 
  Lock, 
  Megaphone, 
  Database, 
  Download, 
  Upload, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Coins
} from 'lucide-react';

interface SettingsPageProps {
  settings: AppSettings;
  products: Product[];
  inventoryItems: InventoryItem[];
  categories: Category[];
  subCategories: any[];
  customers: Customer[];
  orders: Order[];
  preorders: PreOrder[];
  preorderItems: any[];
  expenses: Expense[];
  onSaveSettings: (newSet: AppSettings) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  products,
  inventoryItems,
  categories,
  subCategories,
  customers,
  orders,
  preorders,
  preorderItems,
  expenses,
  onSaveSettings,
  showToast
}) => {
  // Financial Rates State
  const [budgetDzd, setBudgetDzd] = useState(settings.budget_dzd || '0');
  const [budgetEur, setBudgetEur] = useState(settings.budget_eur || '0');
  const [budgetRate, setBudgetRate] = useState(settings.budget_rate || '280');

  // Account State
  const [username, setUsername] = useState(settings.admin_username || 'Admin');
  const [displayName, setDisplayName] = useState(settings.admin_displayname || 'ByBens Manager');

  // Password State
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Marquee State
  const [marqueeEnabled, setMarqueeEnabled] = useState(settings.marquee_enabled !== 'false' && settings.marquee_enabled !== false);
  const [marqueeText, setMarqueeText] = useState(settings.marquee_text || '🚚 Free delivery on orders over 15 000 DA — Use code: FREEDELIVERY');

  // User Management State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  // Save Financial & Rate Settings
  const handleSaveFinancials = async () => {
    await onSaveSettings({
      ...settings,
      budget_dzd: budgetDzd,
      budget_eur: budgetEur,
      budget_rate: budgetRate
    });
    showToast("✓ Financial budgets & exchange rate saved!");
  };

  // Save Profile Account Info
  const handleSaveAccountInfo = async () => {
    await onSaveSettings({
      ...settings,
      admin_username: username,
      admin_displayname: displayName
    });
    showToast("✓ Account profile updated!");
  };

  // Save Password Change via Supabase Auth
  const handleUpdatePassword = async () => {
    if (!newPass || newPass !== confirmPass) {
      showToast("Passwords do not match!", "error");
      return;
    }
    if (newPass.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      showToast("✓ Password updated successfully!");
      setCurPass('');
      setNewPass('');
      setConfirmPass('');
    } catch(e: any) {
      showToast(`Error updating password: ${e.message}`, "error");
    }
  };

  // Save Marquee Settings
  const handleSaveMarquee = async () => {
    await onSaveSettings({
      ...settings,
      marquee_enabled: String(marqueeEnabled),
      marquee_text: marqueeText
    });
    showToast("✓ Promotional banner settings saved!");
  };

  // Quick Disable Banner
  const handleDisableBanner = async () => {
    setMarqueeEnabled(false);
    await onSaveSettings({
      ...settings,
      marquee_enabled: 'false'
    });
    showToast("✓ Banner disabled");
  };

  // Create New Admin User
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPass) {
      showToast("Please provide both email and password!", "error");
      return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPass
      });
      if (error) throw error;
      showToast(`✓ Admin user created for ${newUserEmail}!`);
      setNewUserEmail('');
      setNewUserPass('');
    } catch(e: any) {
      showToast(`Failed to create user: ${e.message}`, "error");
    }
  };

  // Export Complete JSON Backup
  const handleExportBackup = () => {
    const backupObj = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      data: {
        products,
        inventoryItems,
        categories,
        subCategories,
        customers,
        orders,
        preorders,
        preorderItems,
        expenses,
        settings
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bybens_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast("✓ System JSON backup exported successfully!");
  };

  // Restore Database from JSON Snapshot
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const data = parsed.data || parsed;

        if (data.products && Array.isArray(data.products)) {
          localStorage.setItem('bb_products_cache', JSON.stringify(data.products));
        }
        if (data.inventoryItems && Array.isArray(data.inventoryItems)) {
          localStorage.setItem('bb_inventory_items', JSON.stringify(data.inventoryItems));
        }
        if (data.customers && Array.isArray(data.customers)) {
          localStorage.setItem('bb_customers_cache', JSON.stringify(data.customers));
        }

        showToast("✓ Database restored from JSON backup! Refreshing portal...");
        setTimeout(() => window.location.reload(), 1500);
      } catch(err) {
        showToast("Invalid JSON backup file format!", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings & Configurations</h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage financial rates, account info, promotional banners, database backups, and admin security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* 1. Financial Rates & Budgets Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3 text-sm">
            <Coins className="w-4 h-4 text-red-700" />
            <span>Financial Rates & Capital Budgets</span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">EUR Exchange Rate (DZD / EUR)</label>
            <input
              type="number"
              value={budgetRate}
              onChange={(e) => setBudgetRate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
              placeholder="280"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Target Budget (DZD)</label>
              <input
                type="number"
                value={budgetDzd}
                onChange={(e) => setBudgetDzd(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Target Budget (EUR)</label>
              <input
                type="number"
                value={budgetEur}
                onChange={(e) => setBudgetEur(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
              />
            </div>
          </div>

          <button
            onClick={handleSaveFinancials}
            className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Financial Settings</span>
          </button>
        </div>

        {/* 2. Account Profile Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3 text-sm">
            <User className="w-4 h-4 text-blue-600" />
            <span>Account Profile Info</span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
            />
          </div>

          <button
            onClick={handleSaveAccountInfo}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Update Account Profile</span>
          </button>
        </div>

        {/* 3. Security & Password Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3 text-sm">
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Security & Password</span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Confirm New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
            />
          </div>

          <button
            onClick={handleUpdatePassword}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            <span>Update Password</span>
          </button>
        </div>

        {/* 4. Promotional Banner (Marquee) Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3 text-sm">
            <Megaphone className="w-4 h-4 text-purple-600" />
            <span>Promotional Banner (Marquee)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="marquee-enable-check"
              checked={marqueeEnabled}
              onChange={(e) => setMarqueeEnabled(e.target.checked)}
              className="w-4 h-4 accent-purple-600 cursor-pointer"
            />
            <label htmlFor="marquee-enable-check" className="font-bold text-slate-800 cursor-pointer">
              Show Banner on Website Storefront
            </label>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Banner Announcement Text</label>
            <input
              type="text"
              value={marqueeText}
              onChange={(e) => setMarqueeText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveMarquee}
              className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Banner</span>
            </button>
            <button
              onClick={handleDisableBanner}
              className="px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold py-2.5 rounded-xl border border-slate-200"
            >
              Disable
            </button>
          </div>
        </div>

        {/* 5. Database JSON Backups Card (Full Width) */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-base">
              <Database className="w-5 h-5 text-red-500" />
              <span>Full Database Backups & JSON Snapshots</span>
            </div>
            <span className="bg-red-950/80 text-red-400 border border-red-800/80 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Backup Sync
            </span>
          </div>

          <p className="text-slate-400 text-xs">
            Export a full JSON snapshot of all system tables or restore system data from an existing JSON backup file.
          </p>

          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">🏷️ Categories</span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">📦 Products ({products.length})</span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">👤 Customers ({customers.length})</span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">🛒 Orders ({orders.length})</span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">📋 Pre-Orders ({preorders.length})</span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">💰 Expenses ({expenses.length})</span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportBackup}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Backup System Data (JSON)</span>
            </button>
            <label className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Restore Data (JSON)</span>
              <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* 6. Admin Users Management Card (Full Width) */}
        <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3 text-sm">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Manage Portal Users</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="font-bold text-slate-700 block mb-1">User Email</label>
              <input
                type="email"
                placeholder="admin@bybens.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Password</label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-xs"
              />
            </div>
            <button
              onClick={handleCreateUser}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Admin User</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
