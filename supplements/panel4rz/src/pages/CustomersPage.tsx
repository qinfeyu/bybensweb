import React, { useState } from 'react';
import type { Customer, Order } from '../types';
import { PhoneContactAction } from '../components/PhoneContactAction';
import { WhatsAppTemplates } from '../lib/whatsapp';
import { 
  Users, 
  Search, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  Globe, 
  Lock, 
  Plus, 
  X, 
  Check, 
  History, 
  ArrowRightLeft,
  Trash2
} from 'lucide-react';

interface CustomersPageProps {
  customers: Customer[];
  orders: Order[];
  onSaveCustomer?: (cust: Customer) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  customers,
  orders,
  onSaveCustomer,
  onDeleteCustomer
}) => {
  const [activeGroupTab, setActiveGroupTab] = useState<'public' | 'private'>('public');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [historyModalCust, setHistoryModalCust] = useState<Customer | null>(null);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustWilaya, setNewCustWilaya] = useState('');
  const [newCustCommune, setNewCustCommune] = useState('');
  const [newCustGroup, setNewCustGroup] = useState<'public' | 'private'>('public');

  // Local managed customers state fallback
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(() => {
    let stored: Customer[] = [];
    try {
      stored = JSON.parse(localStorage.getItem('bb_customers_cache') || '[]');
    } catch(e) {}

    const map = new Map<string, Customer>();
    stored.forEach(c => { if (c.phone || c.id) map.set(c.phone || c.id, c); });
    customers.forEach(c => { if (c.phone || c.id) map.set(c.phone || c.id, c); });

    // Seed customers from orders if empty
    orders.forEach(o => {
      const phone = (o.phone || '').trim();
      if (phone && !map.has(phone)) {
        map.set(phone, {
          id: `cust_${phone}`,
          first_name: o.firstName || o.first_name || '',
          last_name: o.lastName || o.last_name || '',
          name: `${o.firstName || o.first_name || ''} ${o.lastName || o.last_name || ''}`.trim() || 'Customer',
          phone: phone,
          wilaya: o.wilaya || '',
          commune: o.commune || '',
          address: o.address || '',
          group: 'public'
        });
      }
    });

    const initialList = Array.from(map.values());
    if (initialList.length === 0) {
      return [
        {
          id: 'cust_0550123456',
          name: 'Mohamed Karim',
          phone: '0550123456',
          wilaya: 'Alger',
          commune: 'Bab Ezzouar',
          group: 'public'
        },
        {
          id: 'cust_0661987654',
          name: 'Sofiane Amrani',
          phone: '0661987654',
          wilaya: 'Oran',
          commune: 'Es Senia',
          group: 'public'
        },
        {
          id: 'cust_0770112233',
          name: 'Yacine Brahimi',
          phone: '0770112233',
          wilaya: 'Constantine',
          commune: 'Zighoud Youcef',
          group: 'private'
        },
        {
          id: 'cust_0555443322',
          name: 'Fitness Club Alger (Gym VIP)',
          phone: '0555443322',
          wilaya: 'Alger',
          commune: 'Hydra',
          group: 'private'
        }
      ];
    }

    return initialList;
  });

  const saveLocalCustomers = (nextCusts: Customer[]) => {
    setLocalCustomers(nextCusts);
    localStorage.setItem('bb_customers_cache', JSON.stringify(nextCusts));
  };

  const handleSeedSampleCustomers = async () => {
    const sampleCusts: Customer[] = [
      {
        id: 'cust_0550123456',
        name: 'Mohamed Karim',
        phone: '0550123456',
        wilaya: 'Alger',
        commune: 'Bab Ezzouar',
        group: 'public'
      },
      {
        id: 'cust_0661987654',
        name: 'Sofiane Amrani',
        phone: '0661987654',
        wilaya: 'Oran',
        commune: 'Es Senia',
        group: 'public'
      },
      {
        id: 'cust_0770112233',
        name: 'Yacine Brahimi',
        phone: '0770112233',
        wilaya: 'Constantine',
        commune: 'Zighoud Youcef',
        group: 'private'
      },
      {
        id: 'cust_0555443322',
        name: 'Fitness Club Alger (Gym VIP)',
        phone: '0555443322',
        wilaya: 'Alger',
        commune: 'Hydra',
        group: 'private'
      }
    ];

    saveLocalCustomers(sampleCusts);
    if (onSaveCustomer) {
      for (const c of sampleCusts) {
        await onSaveCustomer(c);
      }
    }
  };

  // Filter customers by group tab & search query
  const filteredCustomers = localCustomers.filter(c => {
    const custGroup = (c.group || 'public').toLowerCase();
    if (custGroup !== activeGroupTab) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.toLowerCase();
    return fullName.includes(q) || (c.phone || '').includes(q) || (c.wilaya || '').toLowerCase().includes(q);
  });

  // Count metrics
  const publicCount = localCustomers.filter(c => (c.group || 'public').toLowerCase() === 'public').length;
  const privateCount = localCustomers.filter(c => (c.group || 'public').toLowerCase() === 'private').length;

  // Add Customer Handler
  const handleCreateCustomer = async () => {
    if (!newCustPhone.trim()) return;

    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim() || 'Customer',
      phone: newCustPhone.trim(),
      wilaya: newCustWilaya.trim(),
      commune: newCustCommune.trim(),
      group: newCustGroup
    };

    const nextCusts = [newCust, ...localCustomers.filter(c => c.phone !== newCust.phone)];
    saveLocalCustomers(nextCusts);

    if (onSaveCustomer) {
      await onSaveCustomer(newCust);
    }

    setIsAddModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustWilaya('');
    setNewCustCommune('');
  };

  // Toggle Group Handler (Public <-> Private)
  const handleToggleCustomerGroup = async (cust: Customer) => {
    const nextGroup: 'public' | 'private' = (cust.group || 'public').toLowerCase() === 'public' ? 'private' : 'public';
    const updated: Customer = { ...cust, group: nextGroup };

    const nextCusts = localCustomers.map(c => c.phone === cust.phone ? updated : c);
    saveLocalCustomers(nextCusts);

    if (onSaveCustomer) {
      await onSaveCustomer(updated);
    }
  };

  // Delete Customer Handler
  const handleDeleteCustomer = async (cust: Customer) => {
    if (!confirm(`Delete customer profile for ${cust.name || cust.phone}?`)) return;

    const nextCusts = localCustomers.filter(c => c.phone !== cust.phone && c.id !== cust.id);
    saveLocalCustomers(nextCusts);

    if (onDeleteCustomer && cust.id) {
      await onDeleteCustomer(cust.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customers Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">Organize clients into Public & Private groups with purchase histories.</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Public vs Private Group Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveGroupTab('public')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeGroupTab === 'public'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Group ({publicCount})</span>
          </button>

          <button
            onClick={() => setActiveGroupTab('private')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeGroupTab === 'private'
                ? 'bg-amber-50 text-amber-900 border border-amber-300/60 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Private Group ({privateCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, phone, or wilaya..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(cust => {
          const custOrders = orders.filter(o => o.phone === cust.phone);
          const totalSpent = custOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          const isPrivate = (cust.group || 'public').toLowerCase() === 'private';

          return (
            <div key={cust.id || cust.phone} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isPrivate ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {isPrivate ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {cust.first_name || cust.name || 'Customer'} {cust.last_name || ''}
                    </h3>
                    <div className="mt-1">
                      <PhoneContactAction
                        phone={cust.phone}
                        customerName={`${cust.first_name || cust.name || 'Customer'} ${cust.last_name || ''}`}
                        message={WhatsAppTemplates.generalGreeting(`${cust.first_name || cust.name || ''}`)}
                      />
                    </div>
                  </div>
                </div>

                {/* Group Badge */}
                <button
                  onClick={() => handleToggleCustomerGroup(cust)}
                  title="Click to switch group"
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1 ${
                    isPrivate
                      ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                      : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>{isPrivate ? '🔒 Private' : '🌐 Public'}</span>
                </button>
              </div>

              {(cust.wilaya || cust.commune) && (
                <div className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 p-2 rounded-xl">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{[cust.commune, cust.wilaya].filter(Boolean).join(', ')}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                <div className="text-slate-500">
                  Orders: <strong className="text-slate-900">{custOrders.length}</strong>
                </div>
                <div className="font-extrabold text-emerald-600">
                  {totalSpent.toLocaleString()} DA
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setHistoryModalCust(cust)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Purchase Logs</span>
                </button>

                <button
                  onClick={() => handleDeleteCustomer(cust)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  title="Delete Customer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 space-y-3">
            <Users className="w-8 h-8 mx-auto opacity-40" />
            <div className="text-sm font-medium">No customers found in {activeGroupTab} group.</div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl"
            >
              + Add New Customer Profile
            </button>
          </div>
        )}
      </div>

      {/* ── NEW CUSTOMER MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Add New Customer Profile</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Group *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCustGroup('public')}
                    className={`py-2 px-3 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      newCustGroup === 'public'
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>🌐 Public Group</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCustGroup('private')}
                    className={`py-2 px-3 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      newCustGroup === 'private'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>🔒 Private Group</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mohamed Karim"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 0550123456"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Wilaya</label>
                  <input
                    type="text"
                    placeholder="e.g. Alger"
                    value={newCustWilaya}
                    onChange={(e) => setNewCustWilaya(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Commune</label>
                  <input
                    type="text"
                    placeholder="e.g. Bab Ezzouar"
                    value={newCustCommune}
                    onChange={(e) => setNewCustCommune(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PURCHASE LOGS HISTORY MODAL ── */}
      {historyModalCust && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Purchase History — {historyModalCust.name || historyModalCust.phone}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Phone: {historyModalCust.phone}</p>
              </div>
              <button onClick={() => setHistoryModalCust(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {orders.filter(o => o.phone === historyModalCust.phone).map(order => (
                <div key={order.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Order #{order.id}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'} • {order.items?.length || 0} items
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-emerald-600">{(order.total || 0).toLocaleString()} DA</div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}

              {orders.filter(o => o.phone === historyModalCust.phone).length === 0 && (
                <div className="text-center p-8 text-slate-400">No purchase records found for this customer.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setHistoryModalCust(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
