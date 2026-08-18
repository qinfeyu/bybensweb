import React, { useState } from 'react';
import { AppSettings } from '../../types';
import { Coins, Euro, ArrowRightLeft, X } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  showToast
}) => {
  const [budgetDzd, setBudgetDzd] = useState(settings.budget_dzd || '0');
  const [budgetEur, setBudgetEur] = useState(settings.budget_eur || '0');
  const [budgetRate, setBudgetRate] = useState(settings.budget_rate || '280');

  React.useEffect(() => {
    setBudgetDzd(settings.budget_dzd || '0');
    setBudgetEur(settings.budget_eur || '0');
    setBudgetRate(settings.budget_rate || '280');
  }, [settings.budget_dzd, settings.budget_eur, settings.budget_rate, isOpen]);

  // Currency Exchange state
  const [exchangeEurAmount, setExchangeEurAmount] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(parseFloat(settings.budget_rate) || 280);

  if (!isOpen) return null;

  const handleSaveBalances = async () => {
    const nextSettings: AppSettings = {
      budget_dzd: budgetDzd,
      budget_eur: budgetEur,
      budget_rate: budgetRate
    };
    await onSaveSettings(nextSettings);
    onClose();
    showToast("✓ Budget balances & exchange rate updated!");
  };

  const handlePerformExchange = async () => {
    if (exchangeEurAmount <= 0) return;
    const curEur = parseFloat(budgetEur) || 0;
    const curDzd = parseFloat(budgetDzd) || 0;

    const dzdRequired = exchangeEurAmount * exchangeRate;
    if (curDzd < dzdRequired) {
      showToast(`Insufficient DZD balance! Need ${dzdRequired.toLocaleString()} DA but only have ${curDzd.toLocaleString()} DA`, "error");
      return;
    }

    const nextDzd = String(curDzd - dzdRequired);
    const nextEur = String(curEur + exchangeEurAmount);

    setBudgetDzd(nextDzd);
    setBudgetEur(nextEur);

    await onSaveSettings({
      budget_dzd: nextDzd,
      budget_eur: nextEur,
      budget_rate: String(exchangeRate)
    });

    setExchangeEurAmount(0);
    showToast(`✓ Exchanged ${dzdRequired.toLocaleString()} DA for ${exchangeEurAmount} € at ${exchangeRate} DA/€!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base">Manage Budgets & Exchanges</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Adjuster */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
          <h4 className="font-bold text-slate-900">Current Balances & Exchange Rate</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-slate-500 font-medium">DZD Balance</label>
              <input
                type="text"
                value={budgetDzd}
                onChange={(e) => setBudgetDzd(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 font-bold text-emerald-700"
              />
            </div>
            <div>
              <label className="text-slate-500 font-medium">EUR Balance (€)</label>
              <input
                type="text"
                value={budgetEur}
                onChange={(e) => setBudgetEur(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 font-bold text-blue-700"
              />
            </div>
            <div>
              <label className="text-slate-500 font-medium">Rate (DA/€)</label>
              <input
                type="text"
                value={budgetRate}
                onChange={(e) => setBudgetRate(e.target.value)}
                className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
              />
            </div>
          </div>

          <button
            onClick={handleSaveBalances}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition-colors"
          >
            Save Balances
          </button>
        </div>

        {/* Currency Exchange Tool */}
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3 text-xs">
          <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <span>Exchange DZD → EUR</span>
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-emerald-800 font-medium">Buy Euros (€)</label>
              <input
                type="number"
                min="0"
                value={exchangeEurAmount}
                onChange={(e) => setExchangeEurAmount(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 bg-white border border-emerald-300 rounded-lg p-2 font-bold text-emerald-900"
              />
            </div>
            <div>
              <label className="text-emerald-800 font-medium">Exchange Rate (DA)</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 280)}
                className="w-full mt-1 bg-white border border-emerald-300 rounded-lg p-2 font-bold text-emerald-900"
              />
            </div>
          </div>

          {exchangeEurAmount > 0 && (
            <div className="text-[11px] text-emerald-800 font-semibold">
              Cost: <strong className="text-emerald-950">{(exchangeEurAmount * exchangeRate).toLocaleString()} DA</strong>
            </div>
          )}

          <button
            disabled={exchangeEurAmount <= 0}
            onClick={handlePerformExchange}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors shadow-sm"
          >
            Execute Exchange
          </button>
        </div>
      </div>
    </div>
  );
};
