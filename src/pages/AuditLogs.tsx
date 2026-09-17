import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Navigate } from 'react-router-dom';
import { ScrollText, Search } from 'lucide-react';
import { useData } from '../hooks/useData';
import { isSuperAdmin as checkIsSuperAdmin } from '../lib/roles';
import { Skeleton } from '../components/ui/Skeleton';

interface AuditLogRow {
  id: number;
  school_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Platform-level record of every sensitive Super Admin action (item 13):
// school approvals/suspensions, subscription/license changes, and role
// changes are logged automatically by database triggers (see the RLS
// migrations) — this page just reads that trail. Writes to audit_logs
// are restricted to `performed_by = auth.uid()` (or the log_audit_event()
// RPC, which stamps auth.uid() server-side), so an entry here cannot be
// forged to look like it came from someone else.
const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const isSuperAdmin = useMemo(() => checkIsSuperAdmin(user?.role), [user]);

  const { data, isLoading } = useData<AuditLogRow>(
    'audit-logs', 'audit_logs',
    { select: '*', orderBy: { column: 'created_at', ascending: false }, limit: 200 },
    isSuperAdmin,
  );

  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/" />;

  const rows = (data || []).filter(r =>
    !search ||
    r.action.toLowerCase().includes(search.toLowerCase()) ||
    (r.entity_type || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ScrollText size={18} className="text-slate-400" />
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Audit Logs</h1>
      </div>
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter by action or entity…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        />
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {isLoading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">School</th>
                <th className="px-5 py-3">Performed By</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No audit events yet.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{r.action}</td>
                  <td className="px-5 py-3 text-slate-500">{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                  <td className="px-5 py-3 text-slate-500">{r.school_id ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{r.performed_by ? r.performed_by.slice(0, 8) : '—'}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">{r.metadata ? JSON.stringify(r.metadata) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

