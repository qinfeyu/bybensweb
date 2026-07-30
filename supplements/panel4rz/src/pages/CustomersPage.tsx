import React, { useState } from 'react';
import type { Customer, Order } from '../types';
import { Users, Search, ShoppingBag, Phone, MapPin } from 'lucide-react';

interface CustomersPageProps {
  customers: Customer[];
  orders: Order[];
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  customers,
  orders
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique customers from orders if customers list is empty
  const customerList: Customer[] = customers.length > 0 ? customers : (() => {
    const map = new Map<string, Customer>();
    orders.forEach(o => {
      const phone = o.phone || '';
      if (phone && !map.has(phone)) {
        map.set(phone, {
          id: `cust_${phone}`,
          first_name: o.firstName || o.first_name || '',
          last_name: o.lastName || o.last_name || '',
          phone: phone,
          wilaya: o.wilaya || '',
          commune: o.commune || '',
          address: o.address || ''
        });
      }
    });
    return Array.from(map.values());
  })();

  const filteredCustomers = customerList.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.toLowerCase();
    return fullName.includes(q) || (c.phone || '').includes(q) || (c.wilaya || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customers Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer directory and purchase history.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, phone, wilaya..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(cust => {
          const custOrders = orders.filter(o => o.phone === cust.phone);
          const totalSpent = custOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

          return (
            <div key={cust.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {cust.first_name || cust.name || 'Customer'} {cust.last_name || ''}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{cust.phone || 'No Phone'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <div className="text-slate-500">
                  Orders: <strong className="text-slate-900">{custOrders.length}</strong>
                </div>
                <div className="font-extrabold text-emerald-600">
                  Total: {totalSpent.toLocaleString()} DA
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
