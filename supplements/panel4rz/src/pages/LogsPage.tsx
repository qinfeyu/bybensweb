import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Trash2, RefreshCw, ScrollText, ShieldCheck, User, Table2, Calendar } from 'lucide-react';

type LogRow = {
  id: number;
  created_at: string;
  action: string;
  actor_email: string | null;
  target_table: string | null;
  target_id: string | null;
  detail: string | null;
};

type LogsPageProps = {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
};

const ACTIONS = ['auth.login', 'auth.login_failed', 'order.update', 'order.delete', 'order.upsert', 'product.upsert', 'preorder.upsert', 'expense.delete', 'expense.insert', 'customer.upsert', 'inventory.upsert', 'promo.upsert', 'delivery.upsert', 'settings.upsert'];

export default function LogsPage({ showToast }: LogsPageProps) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterDays, setFilterDays] = useState('');
  const [limit, setLimit] = useState(100);
  const [selected, setSelected] = useState<number[]>([]);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
  };

  const titleFor = (a: string) =>
    ({ 'auth.login': 'Admin Login', 'auth.login_failed': 'Login Failed', 'order.delete': 'Order Deleted', 'order.update': 'Order Updated', 'order.upsert': 'Order Upserted', 'product.upsert': 'Product Saved', 'preorder.upsert': 'Pre-Order Saved', 'expense.delete': 'Expense Deleted', 'expense.insert': 'Expense Added', 'customer.upsert': 'Customer Saved', 'inventory.upsert': 'Inventory Saved', 'promo.upsert': 'Promo Code Saved', 'delivery.upsert': 'Delivery Price Saved', 'settings.upsert': 'Settings Saved' } as Record<string, string>)[a] || a;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (filterAction) qp.set('action', filterAction);
      if (filterActor) qp.set('actor', filterActor);
      if (filterDays) qp.set('days', filterDays);
      if (limit && !isNaN(Number(limit))) qp.set('limit', String(limit));
      const res = await fetch(`/api/admin-logs?${qp.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to load logs', 'error');
        return;
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (e) {
      showToast('Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterActor, filterDays, limit, showToast]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/admin-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Delete failed', 'error');
        return;
      }
      setLogs(prev => prev.filter(l => !ids.includes(l.id)));
      setSelected([]);
      showToast(`${ids.length} log${ids.length > 1 ? 's' : ''} deleted`, 'success');
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  const handleClearOlderThan = async (days: number) => {
    try {
      const res = await fetch('/api/admin-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: days }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to clear', 'error');
        return;
      }
      showToast(`Logs older than ${days} days cleared`, 'success');
      fetchLogs();
    } catch (e) {
      showToast('Failed to clear', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL audit logs? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to clear', 'error');
        return;
      }
      setLogs([]);
      showToast('All audit logs cleared', 'success');
    } catch (e) {
      showToast('Failed to clear', 'error');
    }
  };

  const toggleSelected = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-red-500" /> Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Every admin action, captured server-side. Auto-pruned after 30 days (row-capped).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLogs()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors" >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => handleClearOlderThan(30)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
            <Filter className="w-3.5 h-3.5" /> Prune {'>'}30d
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
        <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input value={filterActor} onChange={e => setFilterActor(e.target.value)} placeholder="Filter by admin email" className="w-full text-xs font-semibold bg-transparent outline-none placeholder:text-slate-400" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-600 outline-none">
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{titleFor(a)}</option>)}
        </select>
        <select value={filterDays} onChange={e => setFilterDays(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-600 outline-none">
          <option value="">Any age</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button onClick={() => { setFilterActor(''); setFilterAction(''); setFilterDays(''); }}>
          <span className="text-[11px] font-bold text-red-500 px-1">Clear</span>
        </button>
      </div>

      {/* Toolbar (bulk) */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-slate-900 text-white rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-red-400" />
            {selected.length} selected
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleDelete(selected)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg text-[11px] font-bold transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 animate-pulse">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <div className="text-3xl">🛡️</div>
            <div className="text-sm font-bold text-slate-600">No audit logs</div>
            <div className="text-[11px] text-slate-400">Admin actions will appear here automatically.</div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5 w-8">
                      <input type="checkbox" checked={selected.length === logs.length} onChange={e => setSelected(e.target.checked ? logs.map(l => l.id) : [])} className="accent-red-600" />
                    </th>
                    <th className="px-3 py-2.5 font-extrabold">Time</th>
                    <th className="px-3 py-2.5 font-extrabold">Action</th>
                    <th className="px-3 py-2.5 font-extrabold">Admin</th>
                    <th className="px-3 py-2.5 font-extrabold">Target</th>
                    <th className="px-3 py-2.5 font-extrabold">Detail</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelected(l.id)} className="accent-red-600" />
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${l.action.startsWith('auth') ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {titleFor(l.action)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{l.actor_email || <span className="text-slate-400">system</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {l.target_table ? <span className="inline-flex items-center gap-1"><Table2 className="w-3 h-3 text-slate-400" />{l.target_table}{(l.target_id ? ` #${l.target_id}` : '')}</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500 max-w-[280px] truncate">{l.detail || '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleDelete([l.id])} title="Delete this log" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map(l => (
                <div key={l.id} className="p-3.5 flex items-start gap-3">
                  <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelected(l.id)} className="accent-red-600 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${l.action.startsWith('auth') ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {titleFor(l.action)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{fmtDate(l.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <User className="w-3 h-3 text-slate-400" /> {l.actor_email || 'system'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {l.target_table ? <span className="inline-flex items-center gap-1"><Table2 className="w-3 h-3 text-slate-400" />{l.target_table}{l.target_id ? ` #${l.target_id}` : ''}</span> : <span className="text-slate-400">No target</span>}
                    </div>
                    {l.detail && <div className="text-[11px] text-slate-500 truncate">{l.detail}</div>}
                  </div>
                  <button onClick={() => handleDelete([l.id])} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-3 py-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Showing {logs.length} log{logs.length !== 1 ? 's' : ''}</span>
              <button onClick={() => { if (window.confirm('Delete ALL audit logs?')) handleClearAll(); }} className="font-bold text-rose-500 hover:text-rose-700 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
