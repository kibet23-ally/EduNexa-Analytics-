import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { Navigate } from 'react-router-dom';
import {
  ScrollText, Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, ShieldAlert, LogIn, UserCog, X, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isSuperAdmin as checkIsSuperAdmin } from '../lib/roles';

interface AuditLogRow {
  id: number;
  school_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  performed_by: string | null;
  actor_role: string | null;
  category: string | null;
  status: 'success' | 'failure' | 'denied';
  severity: 'info' | 'warning' | 'critical';
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-50 text-blue-600 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_STYLES: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  failure: 'bg-amber-50 text-amber-700',
  denied: 'bg-red-50 text-red-700',
};

const CATEGORIES = [
  'authentication', 'user_management', 'school_management', 'student_management',
  'teacher_management', 'timetable', 'subscription', 'payment', 'security', 'uncategorized',
];

type QuickFilter = 'none' | 'failed_logins' | 'unauthorized' | 'suspicious' | 'critical';

// System Logs — Super Admin only. This is the single source of platform-
// wide monitoring: every event here comes from database triggers or
// SECURITY DEFINER RPCs (see the audit-logging migrations), never from
// client-side-only state, so what's shown here reflects what actually
// happened, not what the UI merely rendered.
const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => checkIsSuperAdmin(user?.role), [user]);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none');
  const [showFilters, setShowFilters] = useState(false);

  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
  }, [isSuperAdmin]);

  const buildQuery = useCallback((forExport: boolean) => {
    let q = supabase.from('audit_logs').select('*', { count: forExport ? undefined : 'exact' });

    if (schoolFilter !== 'all') q = q.eq('school_id', Number(schoolFilter));
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (severityFilter !== 'all') q = q.eq('severity', severityFilter);
    if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    if (search.trim()) q = q.or(`action.ilike.%${search.trim()}%,entity_type.ilike.%${search.trim()}%`);

    if (quickFilter === 'failed_logins') q = q.eq('action', 'login_failed');
    if (quickFilter === 'unauthorized') q = q.eq('status', 'denied');
    if (quickFilter === 'suspicious') q = q.in('severity', ['warning', 'critical']);
    if (quickFilter === 'critical') q = q.eq('severity', 'critical');

    return q.order('created_at', { ascending: false });
  }, [schoolFilter, categoryFilter, statusFilter, severityFilter, dateFrom, dateTo, search, quickFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err, count } = await buildQuery(false).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (err) throw err;
      setRows(data || []);
      setTotalCount(count || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page]);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);
  useEffect(() => { setPage(0); }, [search, schoolFilter, categoryFilter, statusFilter, severityFilter, dateFrom, dateTo, quickFilter]);

  // Summary cards — scoped to the last 24 hours, independent of the
  // table's current filter/page, so they always read as a stable
  // at-a-glance snapshot.
  const [summary, setSummary] = useState({ total: 0, loginsOk: 0, loginsFailed: 0, alerts: 0, adminActions: 0 });
  useEffect(() => {
    if (!isSuperAdmin) return;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    (async () => {
      const [{ count: total }, { count: loginsOk }, { count: loginsFailed }, { count: alerts }, { count: adminActions }] = await Promise.all([
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('action', 'login_success'),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('action', 'login_failed'),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since).in('severity', ['warning', 'critical']),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since).in('category', ['user_management', 'school_management', 'security']),
      ]);
      setSummary({ total: total || 0, loginsOk: loginsOk || 0, loginsFailed: loginsFailed || 0, alerts: alerts || 0, adminActions: adminActions || 0 });
    })();
  }, [isSuperAdmin, rows]); // refresh the snapshot whenever the table reloads

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error: err } = await buildQuery(true).limit(5000);
      if (err) throw err;
      const list = data || [];
      const header = ['Timestamp (UTC)', 'Category', 'Action', 'Status', 'Severity', 'School ID', 'Actor', 'Role', 'Entity', 'Entity ID'];
      const csvRows = list.map(r => [
        r.created_at, r.category || '', r.action, r.status, r.severity,
        r.school_id ?? '', r.performed_by || '', r.actor_role || '', r.entity_type || '', r.entity_id || '',
      ]);
      const csv = [header, ...csvRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Every export of audit logs must itself generate an audit event.
      await supabase.rpc('log_audit_event', {
        p_action: 'audit_logs_exported', p_entity_type: 'audit_logs', p_category: 'security',
        p_status: 'success', p_severity: 'info',
        p_metadata: { row_count: list.length, filters: { schoolFilter, categoryFilter, statusFilter, severityFilter, dateFrom, dateTo, quickFilter } },
      });
    } catch (e: any) {
      setError(e?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/" />;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="text-slate-400" />
          <h1 className="text-xl font-black text-slate-900 dark:text-white">System Logs</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExport} disabled={exporting} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Events (24h)', value: summary.total, icon: ScrollText, color: 'text-slate-500' },
          { label: 'Successful Logins', value: summary.loginsOk, icon: LogIn, color: 'text-emerald-600' },
          { label: 'Failed Logins', value: summary.loginsFailed, icon: ShieldAlert, color: 'text-amber-600' },
          { label: 'Security Alerts', value: summary.alerts, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Admin Actions', value: summary.adminActions, icon: UserCog, color: 'text-blue-600' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
            <c.icon size={15} className={c.color} />
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{c.value}</div>
            <div className="text-[11px] text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['none', 'All Events'], ['failed_logins', 'Failed Logins'], ['unauthorized', 'Unauthorized'],
          ['suspicious', 'Suspicious'], ['critical', 'Critical Only'],
        ] as [QuickFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setQuickFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${quickFilter === val ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
            {label}
          </button>
        ))}
        <button onClick={() => setShowFilters(s => !s)} className="ml-auto px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center gap-1.5">
          <Filter size={12} /> More Filters
        </button>
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="all">All Schools</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="all">All Statuses</option>
            <option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option>
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="all">All Severities</option>
            <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
          <div className="relative col-span-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action or entity type…"
              className="w-full pl-8 pr-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No audit events match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-3">When (UTC)</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Actor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => setDetail(r)} className="border-b border-slate-50 dark:border-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                    <td className="px-4 py-3 text-slate-500">{r.category || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{r.action}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${SEVERITY_STYLES[r.severity] || ''}`}>{r.severity}</span></td>
                    <td className="px-4 py-3 text-slate-500">{schools.find(s => s.id === r.school_id)?.name || r.school_id || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.actor_role ? `${r.actor_role}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <span>{totalCount} total events</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span>Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">{detail.action}</h3>
              <button onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">Timestamp (UTC):</span> {new Date(detail.created_at).toISOString()}</div>
              <div><span className="text-slate-400">Category:</span> {detail.category || '—'}</div>
              <div><span className="text-slate-400">Status:</span> {detail.status}</div>
              <div><span className="text-slate-400">Severity:</span> {detail.severity}</div>
              <div><span className="text-slate-400">School ID:</span> {detail.school_id ?? '—'}</div>
              <div><span className="text-slate-400">Actor Role:</span> {detail.actor_role || '—'}</div>
              <div className="col-span-2"><span className="text-slate-400">Actor (user ID):</span> {detail.performed_by || '—'}</div>
              <div className="col-span-2"><span className="text-slate-400">Entity:</span> {detail.entity_type || '—'} {detail.entity_id ? `#${detail.entity_id}` : ''}</div>
              {detail.correlation_id && <div className="col-span-2"><span className="text-slate-400">Correlation ID:</span> {detail.correlation_id}</div>}
            </div>
            {detail.metadata && (
              <div>
                <div className="text-slate-400 text-xs mb-1">Details</div>
                <pre className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detail.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;