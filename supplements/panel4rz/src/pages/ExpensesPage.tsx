import React, { useState } from 'react';
import { Expense } from '../types';
import { Receipt, Plus, Trash2, Search, X } from 'lucide-react';

interface ExpensesPageProps {
  expenses: Expense[];
  onAddExpense: (exp: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  eurRate: number;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  expenses,
  onAddExpense,
  onDeleteExpense,
  eurRate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState('Rent');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<'DZD' | 'EUR'>('DZD');

  const filteredExpenses = expenses.filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (e.description || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q);
  });

  const totalDzd = expenses.reduce((sum, e) => {
    const amt = Number(e.amount) || 0;
    return sum + (e.currency === 'EUR' ? amt * eurRate : amt);
  }, 0);

  const handleSave = async () => {
    if (amount <= 0) return;
    await onAddExpense({
      category,
      description,
      amount,
      currency,
      date: new Date().toISOString()
    });

    setIsModalOpen(false);
    setDescription('');
    setAmount(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Expenses & Operating Overhead</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track rent, utilities, salaries, and operational costs.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Metric & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Expenses (DZD)</div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {Math.round(totalDzd).toLocaleString()} DA
            </div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search expenses by category or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-xs">
          <table className="w-full text-xs text-left text-slate-700 min-w-[600px]">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Equiv (DZD)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(e => {
                const equivDzd = e.currency === 'EUR' ? Number(e.amount) * eurRate : Number(e.amount);

                return (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-500">{new Date(e.date || e.created_at || '').toLocaleDateString()}</td>
                    <td className="p-3 font-bold text-slate-900">{e.category}</td>
                    <td className="p-3 font-medium text-slate-700">{e.description || '—'}</td>
                    <td className="p-3 font-bold text-rose-600">{Number(e.amount).toLocaleString()} {e.currency}</td>
                    <td className="p-3 font-semibold text-slate-700">{Math.round(equivDzd).toLocaleString()} DA</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          if (confirm("Delete expense record?")) onDeleteExpense(e.id);
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD EXPENSE MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add New Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900"
                >
                  <option value="Rent">Rent</option>
                  <option value="Utilities">Utilities (Electricity, Water)</option>
                  <option value="Salaries">Salaries & Wages</option>
                  <option value="Marketing">Marketing & Ads</option>
                  <option value="Shipping">Shipping & Freight</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Description</label>
                <input
                  type="text"
                  placeholder="Expense details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                  >
                    <option value="DZD">DZD</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleSave} className="px-5 py-2 bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm">
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
