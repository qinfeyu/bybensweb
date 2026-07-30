import React, { useState } from 'react';
import type { AppSettings } from '../types';
import { Settings, Save, RefreshCw } from 'lucide-react';

interface SettingsPageProps {
  settings: AppSettings;
  onSaveSettings: (newSet: AppSettings) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings
}) => {
  const [budgetDzd, setBudgetDzd] = useState(settings.budget_dzd || '0');
  const [budgetEur, setBudgetEur] = useState(settings.budget_eur || '0');
  const [budgetRate, setBudgetRate] = useState(settings.budget_rate || '280');

  const handleSave = async () => {
    await onSaveSettings({
      budget_dzd: budgetDzd,
      budget_eur: budgetEur,
      budget_rate: budgetRate
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">App Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure default exchange rates and financial budgets.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 text-xs">
        <div>
          <label className="font-bold text-slate-700 block mb-1">Default EUR Exchange Rate (DZD / EUR)</label>
          <input
            type="number"
            value={budgetRate}
            onChange={(e) => setBudgetRate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
            placeholder="e.g. 280"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Budget (DZD)</label>
            <input
              type="number"
              value={budgetDzd}
              onChange={(e) => setBudgetDzd(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
              placeholder="0"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Budget (EUR)</label>
            <input
              type="number"
              value={budgetEur}
              onChange={(e) => setBudgetEur(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
              placeholder="0"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
