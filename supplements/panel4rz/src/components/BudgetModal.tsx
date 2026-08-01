import React, { useState } from 'react';
import { AppSettings } from '../types';
import { 
  Wallet, RefreshCw, ArrowLeftRight, X, Check, 
  DollarSign, Calculator, AlertCircle, ArrowRight, PlusCircle, Plus
} from 'lucide-react';

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
  if (!isOpen) return null;

  // Direct manual budget editing state
  const [eurVal, setEurVal] = useState<string>(settings.budget_eur || '0');
  const [dzdVal, setDzdVal] = useState<string>(settings.budget_dzd || '0');
  const [rateVal, setRateVal] = useState<string>(settings.budget_rate || '245');

  // Conversion Tool State
  const [conversionDirection, setConversionDirection] = useState<'dzd_to_eur' | 'eur_to_dzd'>('dzd_to_eur');
  const [convertAmount, setConvertAmount] = useState<string>('');
  const [convertRate, setConvertRate] = useState<string>(settings.budget_rate || '245');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add / Deposit Funds State
  const [addCurrency, setAddCurrency] = useState<'eur' | 'dzd'>('eur');
  const [addAmountInput, setAddAmountInput] = useState<string>('');

  // Parse numeric values safely
  const currentEur = parseFloat(eurVal) || 0;
  const currentDzd = parseFloat(dzdVal) || 0;
  const numRate = parseFloat(convertRate) || parseFloat(rateVal) || 245;
  const numConvertAmount = parseFloat(convertAmount) || 0;
  const numAddAmount = parseFloat(addAmountInput) || 0;

  // Compute conversion result
  let convertedResult = 0;
  let newProjectedDzd = currentDzd;
  let newProjectedEur = currentEur;

  if (numConvertAmount > 0 && numRate > 0) {
    if (conversionDirection === 'dzd_to_eur') {
      convertedResult = numConvertAmount / numRate;
      newProjectedDzd = currentDzd - numConvertAmount;
      newProjectedEur = currentEur + convertedResult;
    } else {
      convertedResult = numConvertAmount * numRate;
      newProjectedEur = currentEur - numConvertAmount;
      newProjectedDzd = currentDzd + convertedResult;
    }
  }

  // Handle direct budget manual save
  const handleSaveDirect = async () => {
    setIsSubmitting(true);
    try {
      await onSaveSettings({
        ...settings,
        budget_eur: eurVal,
        budget_dzd: dzdVal,
        budget_rate: rateVal
      });
      onClose();
    } catch (e) {
      showToast("Failed to save budget settings", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add / Deposit Funds to Euro or DZD Budget
  const handleAddFunds = async () => {
    if (numAddAmount <= 0) {
      showToast("Please enter a valid positive amount to add", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalEurStr = eurVal;
      let finalDzdStr = dzdVal;

      if (addCurrency === 'eur') {
        const newEur = currentEur + numAddAmount;
        finalEurStr = newEur.toFixed(2);
        setEurVal(finalEurStr);
      } else {
        const newDzd = currentDzd + numAddAmount;
        finalDzdStr = Math.round(newDzd).toString();
        setDzdVal(finalDzdStr);
      }

      await onSaveSettings({
        ...settings,
        budget_eur: finalEurStr,
        budget_dzd: finalDzdStr,
        budget_rate: rateVal
      });

      const addedStr = addCurrency === 'eur' ? `€ ${numAddAmount.toLocaleString()}` : `${numAddAmount.toLocaleString()} DA`;
      const newBalStr = addCurrency === 'eur' ? `€ ${finalEurStr}` : `${Number(finalDzdStr).toLocaleString('fr-DZ')} DA`;

      showToast(`✓ Added ${addedStr} to ${addCurrency.toUpperCase()} Budget! New Balance: ${newBalStr}`);
      setAddAmountInput('');
      onClose();
    } catch (e) {
      showToast("Failed to add funds to budget", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle execute conversion action
  const handleExecuteConversion = async () => {
    if (numConvertAmount <= 0) {
      showToast("Please enter a valid conversion amount", "error");
      return;
    }
    if (numRate <= 0) {
      showToast("Please enter a valid exchange rate", "error");
      return;
    }

    if (conversionDirection === 'dzd_to_eur' && numConvertAmount > currentDzd) {
      if (!confirm(`Warning: Convert amount (${numConvertAmount.toLocaleString()} DA) exceeds current DZD balance (${currentDzd.toLocaleString()} DA). Proceed anyway?`)) {
        return;
      }
    } else if (conversionDirection === 'eur_to_dzd' && numConvertAmount > currentEur) {
      if (!confirm(`Warning: Convert amount (€ ${numConvertAmount.toLocaleString()}) exceeds current EUR balance (€ ${currentEur.toLocaleString()}). Proceed anyway?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalEurStr = newProjectedEur.toFixed(2);
      const finalDzdStr = Math.round(newProjectedDzd).toString();

      await onSaveSettings({
        ...settings,
        budget_eur: finalEurStr,
        budget_dzd: finalDzdStr,
        budget_rate: convertRate
      });

      // Update local state to match
      setEurVal(finalEurStr);
      setDzdVal(finalDzdStr);
      setRateVal(convertRate);
      setConvertAmount('');

      if (conversionDirection === 'dzd_to_eur') {
        showToast(`✓ Converted ${numConvertAmount.toLocaleString()} DA to € ${convertedResult.toFixed(2)} (Rate: ${numRate})`);
      } else {
        showToast(`✓ Converted € ${numConvertAmount.toLocaleString()} to ${Math.round(convertedResult).toLocaleString()} DA (Rate: ${numRate})`);
      }
      onClose();
    } catch (e) {
      showToast("Error executing currency conversion", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Budget & Currency Exchange</h3>
              <p className="text-[11px] text-slate-400">Track EUR & DZD business balances and execute live conversions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Section 1: Current Capital Balances Cards */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2.5 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Current Capital Budgets</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* EUR Budget Card */}
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl space-y-2 relative">
                <div className="flex items-center justify-between text-emerald-800 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>Euro Budget (€)</span>
                    <button
                      type="button"
                      onClick={() => setAddCurrency('eur')}
                      className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[10px] font-extrabold flex items-center gap-0.5 transition-colors shadow-2xs"
                      title="Quick Deposit to Euro Budget"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add €</span>
                    </button>
                  </div>
                  <span className="text-lg">💶</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-emerald-700 text-sm">€</span>
                  <input
                    type="number"
                    step="any"
                    value={eurVal}
                    onChange={(e) => setEurVal(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="0.00"
                  />
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold">
                  Equivalent in DZD: ~{Math.round(currentEur * numRate).toLocaleString('fr-DZ')} DA
                </div>
              </div>

              {/* DZD Budget Card */}
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl space-y-2 relative">
                <div className="flex items-center justify-between text-amber-900 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>DZD Budget (DA)</span>
                    <button
                      type="button"
                      onClick={() => setAddCurrency('dzd')}
                      className="px-2 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded-md text-[10px] font-extrabold flex items-center gap-0.5 transition-colors shadow-2xs"
                      title="Quick Deposit to DZD Budget"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add DA</span>
                    </button>
                  </div>
                  <span className="text-lg">🇩🇿</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-amber-700 text-xs">DA</span>
                  <input
                    type="number"
                    step="any"
                    value={dzdVal}
                    onChange={(e) => setDzdVal(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl pl-9 pr-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="0"
                  />
                </div>
                <div className="text-[10px] text-amber-700 font-semibold">
                  Equivalent in EUR: ~€ {(currentDzd / (numRate || 1)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section: Add / Deposit Funds to Budget */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
            addCurrency === 'eur'
              ? 'bg-emerald-50/60 border-emerald-200/80'
              : 'bg-amber-50/60 border-amber-200/80'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <PlusCircle className={`w-4 h-4 ${addCurrency === 'eur' ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>Add / Deposit Funds to Budget</span>
              </h4>

              {/* Target Currency Selector */}
              <div className="flex bg-white/80 p-1 rounded-xl gap-1 border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddCurrency('eur')}
                  className={`px-3 py-1 rounded-lg font-extrabold text-[10px] transition-all ${
                    addCurrency === 'eur'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💶 Euro (€)
                </button>
                <button
                  type="button"
                  onClick={() => setAddCurrency('dzd')}
                  className={`px-3 py-1 rounded-lg font-extrabold text-[10px] transition-all ${
                    addCurrency === 'dzd'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇩🇿 DZD (DA)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Amount to Add ({addCurrency === 'eur' ? '€ EUR' : 'DA DZD'})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-500 text-xs">
                    {addCurrency === 'eur' ? '€' : 'DA'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={addCurrency === 'eur' ? 'e.g. 500' : 'e.g. 50,000'}
                    value={addAmountInput}
                    onChange={(e) => setAddAmountInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Quick Add Amount
                </label>
                <div className="flex flex-wrap gap-1">
                  {addCurrency === 'eur' ? (
                    [100, 250, 500, 1000, 2500].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAddAmountInput(amt.toString())}
                        className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg font-bold text-[10px] text-emerald-900 transition-colors"
                      >
                        +€{amt.toLocaleString()}
                      </button>
                    ))
                  ) : (
                    [10000, 50000, 100000, 250000, 500000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAddAmountInput(amt.toString())}
                        className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg font-bold text-[10px] text-amber-900 transition-colors"
                      >
                        +{(amt / 1000).toLocaleString()}k DA
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {numAddAmount > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between animate-in fade-in">
                <span className="font-semibold text-slate-600">
                  Updated {addCurrency === 'eur' ? 'Euro (€)' : 'DZD (DA)'} Balance Preview:
                </span>
                <span className={`font-black text-sm ${addCurrency === 'eur' ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {addCurrency === 'eur'
                    ? `€ ${(currentEur + numAddAmount).toFixed(2)}`
                    : `${Math.round(currentDzd + numAddAmount).toLocaleString('fr-DZ')} DA`}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={isSubmitting || numAddAmount <= 0}
              onClick={handleAddFunds}
              className={`w-full font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 text-white disabled:opacity-50 ${
                addCurrency === 'eur'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-amber-700 hover:bg-amber-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Updating Capital Budget...'
                  : `Add ${numAddAmount > 0 ? (addCurrency === 'eur' ? `€${numAddAmount.toLocaleString()}` : `${numAddAmount.toLocaleString()} DA`) : ''} to ${addCurrency === 'eur' ? 'Euro' : 'DZD'} Budget`}
              </span>
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Currency Exchange Tool */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                <span>Convert Currency (Exchange DZD ↔ EUR)</span>
              </h4>

              {/* Conversion Toggle Direction */}
              <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setConversionDirection('dzd_to_eur')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
                    conversionDirection === 'dzd_to_eur'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DA → EUR €
                </button>
                <button
                  type="button"
                  onClick={() => setConversionDirection('eur_to_dzd')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
                    conversionDirection === 'eur_to_dzd'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EUR € → DA
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Amount to Convert */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Amount to Convert ({conversionDirection === 'dzd_to_eur' ? 'DA' : '€'})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={conversionDirection === 'dzd_to_eur' ? 'e.g. 500,000' : 'e.g. 2,000'}
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Exchange Rate */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Exchange Rate (DA per 1 €)
                </label>
                <input
                  type="number"
                  step="any"
                  value={convertRate}
                  onChange={(e) => setConvertRate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="245"
                />
              </div>
            </div>

            {/* Live Calculation Preview Box */}
            {numConvertAmount > 0 && (
              <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200/80 space-y-2 text-indigo-900">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>Conversion Result:</span>
                  <span className="text-sm font-black text-indigo-700">
                    {conversionDirection === 'dzd_to_eur'
                      ? `€ ${convertedResult.toFixed(2)} EUR`
                      : `${Math.round(convertedResult).toLocaleString('fr-DZ')} DA`}
                  </span>
                </div>

                <div className="text-[11px] text-indigo-700 border-t border-indigo-200/60 pt-2 flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>New DZD Budget:</span>
                    <span className="font-bold text-slate-900">{Math.round(newProjectedDzd).toLocaleString('fr-DZ')} DA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New EUR Budget:</span>
                    <span className="font-bold text-slate-900">€ {newProjectedEur.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Execute Conversion CTA */}
            <button
              type="button"
              disabled={isSubmitting || numConvertAmount <= 0}
              onClick={handleExecuteConversion}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Processing Conversion...' : 'Execute Conversion & Update Balances'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSaveDirect}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Balances Manually</span>
          </button>
        </div>
      </div>
    </div>
  );
};
