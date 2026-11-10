import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  FileEdit,
  FilePlus,
  Eye,
  Trash2,
  Share2,
  GitCommit,
  Users,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  Database,
  Activity,
  Clock,
  HardDrive,
  Laptop,
  Globe,
  Smartphone,
  ChevronRight,
  X,
  Filter,
  Sparkles,
  UserCheck,
  ArrowRightLeft,
  Lock,
  LogOut,
  KeyRound,
} from 'lucide-react';

const ACTION_META = {
  FILE_EDITED: {
    label: 'Edited / Saved',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: FileEdit,
  },
  FILE_CREATED: {
    label: 'Created / Uploaded',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: FilePlus,
  },
  FILE_VIEWED: {
    label: 'Opened / Viewed',
    color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Eye,
  },
  FILE_RENAMED: {
    label: 'Renamed / Moved',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: ArrowRightLeft,
  },
  FILE_DELETED: {
    label: 'Deleted',
    color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  FILE_RESTORED: {
    label: 'Restored',
    color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    icon: RefreshCw,
  },
  VERSION_RESTORED: {
    label: 'Version Restored',
    color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: GitCommit,
  },
  FILE_SHARED: {
    label: 'Shared (Internal)',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Share2,
  },
  FILE_SHARED_PUBLIC: {
    label: 'Shared (Public Link)',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: Globe,
  },
  USER_LOGIN: {
    label: 'User Login',
    color: 'bg-slate-700/60 text-slate-300 border-slate-600',
    icon: UserCheck,
  },
  USER_LOGIN_FAILED: {
    label: 'Failed Login',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: Lock,
  },
};

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const abs = Math.abs(bytes);
  if (abs === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(abs) / Math.log(k));
  const val = (abs / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
  return `${bytes < 0 ? '-' : ''}${val} ${sizes[i]}`;
}

function formatRelativeTime(iso) {
  if (!iso) return '—';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatUtcTimestamp(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return iso;
  }
}

function ActionBadge({ action, version }) {
  const meta = ACTION_META[action] || {
    label: action,
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: Activity,
  };
  const Icon = meta.icon;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {meta.label}
      </span>
      {version ? (
        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          v{version}
        </span>
      ) : null}
    </div>
  );
}

function ClientIcon({ source }) {
  const s = (source || '').toLowerCase();
  if (s.includes('collabora') || s.includes('office')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-md">
        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
        {source}
      </span>
    );
  }
  if (s.includes('desktop')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
        <Laptop className="w-3.5 h-3.5 text-emerald-400" />
        {source}
      </span>
    );
  }
  if (s.includes('mobile')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        {source}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
      <Globe className="w-3.5 h-3.5 text-slate-400" />
      {source || 'Web / API'}
    </span>
  );
}

export default function App() {
  // Authentication state
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('shehata_audit_token') || '');
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState('explorer');
  const [stats, setStats] = useState(null);
  const [eventsData, setEventsData] = useState({ total: 0, events: [] });
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);

  // Filters
  const [fileQuery, setFileQuery] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [excludeViews, setExcludeViews] = useState(false);

  // Selected File / User for Deep Forensics
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTimeline, setFileTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (res.status === 401) {
        setAuthUser(null);
        localStorage.removeItem('shehata_audit_token');
      }
      return res;
    },
    [authToken],
  );

  // Check current session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setAuthUser(data.username);
        } else {
          setAuthUser(null);
        }
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecking(false);
      }
    })();
  }, [apiFetch]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await fetch('api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.detail || 'Invalid username or password');
        return;
      }
      const data = await res.json();
      localStorage.setItem('shehata_audit_token', data.token);
      setAuthToken(data.token);
      setAuthUser(data.username);
      setLoginPassword('');
    } catch {
      setLoginError('Unable to reach authentication server');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await apiFetch('api/auth/logout', { method: 'POST' });
    localStorage.removeItem('shehata_audit_token');
    setAuthToken('');
    setAuthUser(null);
  };

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (fileQuery.trim()) params.set('file_query', fileQuery.trim());
    if (actorFilter.trim()) params.set('actor', actorFilter.trim());
    if (actionFilter) params.set('action_type', actionFilter);
    if (clientFilter) params.set('client_source', clientFilter);
    if (ipFilter.trim()) params.set('ip_address', ipFilter.trim());
    if (anomaliesOnly) params.set('anomalies_only', 'true');
    if (excludeViews) params.set('exclude_views', 'true');
    if (authToken) params.set('token', authToken);
    params.set('limit', '250');
    return params.toString();
  }, [fileQuery, actorFilter, actionFilter, clientFilter, ipFilter, anomaliesOnly, excludeViews, authToken]);

  const fetchAll = useCallback(async () => {
    if (!authUser) return;
    try {
      const qs = buildQueryParams();
      const [statsRes, eventsRes] = await Promise.all([
        apiFetch('api/stats'),
        apiFetch(`api/events?${qs}`),
      ]);
      if (statsRes.ok && eventsRes.ok) {
        const [statsJson, eventsJson] = await Promise.all([
          statsRes.json(),
          eventsRes.json(),
        ]);
        setStats(statsJson);
        setEventsData(eventsJson);
      }
    } catch (err) {
      console.error('Failed to fetch audit telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [authUser, apiFetch, buildQueryParams]);

  useEffect(() => {
    if (!authUser) return;
    fetchAll();
    const timer = setInterval(fetchAll, 5000);
    return () => clearInterval(timer);
  }, [authUser, fetchAll]);

  const openFileInspector = async (path) => {
    if (!path) return;
    setSelectedFile(path);
    setLoadingTimeline(true);
    try {
      const res = await apiFetch(`api/file-timeline?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileTimeline(data);
      }
    } catch (err) {
      console.error('Failed to load file timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const openUserInspector = async (actor) => {
    if (!actor) return;
    setSelectedUser(actor);
    setActiveTab('users');
    try {
      const res = await apiFetch(`api/user-profile?actor=${encodeURIComponent(actor)}`);
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const handleResync = async () => {
    setResyncing(true);
    try {
      await apiFetch('api/resync', { method: 'POST' });
      await fetchAll();
      if (selectedFile) {
        await openFileInspector(selectedFile);
      }
    } finally {
      setResyncing(false);
    }
  };

  const handleSeedDemo = async () => {
    await apiFetch('api/demo/seed', { method: 'POST' });
    await fetchAll();
  };

  const resetFilters = () => {
    setFileQuery('');
    setActorFilter('');
    setActionFilter('');
    setClientFilter('');
    setIpFilter('');
    setAnomaliesOnly(false);
    setExcludeViews(false);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Verifying security session...
      </div>
    );
  }

  // Render Login Screen if not authenticated
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Company Files Vault</h1>
            <p className="text-xs text-slate-400 mt-1">
              Enterprise File Edit Audit, Collabora Office Attribution & Version History Console
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Administrator Username
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter administrator password..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {loginSubmitting ? 'Signing In...' : 'Sign In to Audit Console'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
            Protected by HMAC-SHA256 Session Auth • Nextcloud 30 + PostgreSQL 16
          </div>
        </div>
      </div>
    );
  }

  const ov = stats?.overview || {};
  const hotFiles = stats?.hot_files || [];
  const usersList = stats?.users || [];
  const byAction = stats?.by_action || [];
  const byClient = stats?.by_client || [];
  const pgConnected = stats?.system?.postgres_connected;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Enterprise Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold tracking-tight text-white">
                Company Files Vault
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live WOPI + Audit Tail
              </span>
              {pgConnected && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  <Database className="w-3 h-3" />
                  PostgreSQL Attributed
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Real-Time File Edit Attribution, Collabora Office Session Resolver & Version Chain of Custody
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResync}
            disabled={resyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Re-parse audit.log and resolve all Collabora tokens via PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin text-blue-400' : ''}`} />
            {resyncing ? 'Syncing Log...' : 'Re-Sync Audit Log'}
          </button>

          <button
            onClick={handleSeedDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Add Sample Team Edits
          </button>

          <a
            href={`api/export/csv?${buildQueryParams()}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </a>

          <a
            href={`api/export/json?${buildQueryParams()}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </a>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out ({authUser})
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {/* KPI Telemetry Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>TOTAL AUDIT EVENTS</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{ov.total_events || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across {ov.tracked_files || 0} tracked files
            </div>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-blue-300 font-medium">
              <span>FILE EDITS & SAVES</span>
              <FileEdit className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400 mt-1.5">{ov.total_edits || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Collabora Office + WebDAV saves
            </div>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-medium">
              <span>FILES CREATED</span>
              <FilePlus className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1.5">{ov.total_created || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Initial v1 file uploads</div>
          </div>

          <div className="bg-slate-900/90 border border-cyan-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-medium">
              <span>OPENED / VIEWED</span>
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-300 mt-1.5">{ov.total_views || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Authenticated read access</div>
          </div>

          <div className="bg-slate-900/90 border border-amber-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
              <span>ACTIVE USERS</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1.5">{ov.active_users || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Attributed user accounts</div>
          </div>

          <div className="bg-slate-900/90 border border-rose-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-rose-300 font-medium">
              <span>SECURITY ALERTS</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1.5">{ov.total_anomalies || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Public shares / mass deletes
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'explorer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            Live Audit Explorer ({eventsData.total || 0})
          </button>

          <button
            onClick={() => {
              setActiveTab('files');
              if (!selectedFile && hotFiles.length > 0) {
                openFileInspector(hotFiles[0].file_path);
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'files'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <GitCommit className="w-4 h-4" />
            File Version & Edit Inspector ({hotFiles.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              if (!selectedUser && usersList.length > 0) {
                openUserInspector(usersList[0].actor);
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User Forensics Profiler ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            System Telemetry & Breakdown
          </button>
        </div>

        {/* TAB 1: LIVE AUDIT EXPLORER */}
        {activeTab === 'explorer' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-4">
              {/* Filter Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Search File / Path
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={fileQuery}
                        onChange={(e) => setFileQuery(e.target.value)}
                        placeholder="e.g. invoices (8).xlsx..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      User (Who)
                    </label>
                    <select
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">All Users</option>
                      {usersList.map((u) => (
                        <option key={u.actor} value={u.actor}>
                          👤 {u.actor} ({u.edits} edits, {u.event_count} events)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Action (Did What)
                    </label>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">All Actions</option>
                      <option value="FILE_EDITED">✏️ File Edited / Saved</option>
                      <option value="FILE_CREATED">➕ File Created / Uploaded</option>
                      <option value="FILE_VIEWED">👁️ File Opened / Viewed</option>
                      <option value="FILE_RENAMED">🔀 File Renamed / Moved</option>
                      <option value="FILE_DELETED">🗑️ File Deleted</option>
                      <option value="FILE_SHARED">🔗 Shared (User / Group)</option>
                      <option value="FILE_SHARED_PUBLIC">🌐 Shared (Public Link)</option>
                      <option value="USER_LOGIN">🔑 User Login</option>
                      <option value="USER_LOGIN_FAILED">🚨 Failed Login</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Editor / Client App
                    </label>
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">All Clients</option>
                      <option value="Collabora Office">Collabora Office (Live Edit)</option>
                      <option value="Web Browser">Web Browser</option>
                      <option value="Desktop Sync">Desktop Sync Client</option>
                      <option value="Mobile App">Mobile App</option>
                    </select>
                  </div>
                </div>

                {/* Quick Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setExcludeViews(!excludeViews)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                        excludeViews
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {excludeViews ? 'Showing Edits & Changes Only' : 'Hide Read/View Events'}
                    </button>

                    <button
                      onClick={() => setAnomaliesOnly(!anomaliesOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                        anomaliesOnly
                          ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {anomaliesOnly ? 'Showing Security Alerts Only' : 'Security Alerts Only'}
                    </button>
                  </div>

                  <button
                    onClick={resetFilters}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              {/* Events Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Chronological Audit Trail (Who Did What & When)
                  </h2>
                  <span className="text-xs text-slate-400">
                    Showing {eventsData.events?.length || 0} of {eventsData.total || 0} events
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase text-slate-400">
                        <th className="py-3 px-4">When (UTC)</th>
                        <th className="py-3 px-4">Who (User)</th>
                        <th className="py-3 px-4">Did What & Version</th>
                        <th className="py-3 px-4">File / Resource (Click to Inspect)</th>
                        <th className="py-3 px-4">Client / Editor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Loading real-time audit events...
                          </td>
                        </tr>
                      ) : !eventsData.events || eventsData.events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            No matching audit events found.
                          </td>
                        </tr>
                      ) : (
                        eventsData.events.map((ev) => (
                          <tr
                            key={ev.id}
                            className="hover:bg-slate-800/40 transition group"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono text-slate-200">
                                {formatUtcTimestamp(ev.timestamp)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {formatRelativeTime(ev.timestamp)}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                onClick={() => openUserInspector(ev.actor)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-blue-600/20 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40 font-semibold text-slate-200 transition"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                {ev.actor}
                              </button>
                              <div className="text-[10px] font-mono text-slate-400 mt-1 pl-1">
                                IP: {ev.ip_address}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <ActionBadge
                                action={ev.action_type}
                                version={ev.version_number}
                              />
                            </td>

                            <td className="py-3 px-4">
                              {ev.file_path ? (
                                <div>
                                  <button
                                    onClick={() => openFileInspector(ev.file_path)}
                                    className="text-left font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 break-all"
                                  >
                                    {ev.file_path.endsWith('.xlsx') ? (
                                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                    )}
                                    <span>{ev.file_path}</span>
                                  </button>
                                  {ev.previous_path && (
                                    <div className="text-[11px] text-purple-300 mt-1">
                                      ↳ Renamed from:{' '}
                                      <code className="bg-slate-950 px-1.5 py-0.5 rounded">
                                        {ev.previous_path}
                                      </code>
                                    </div>
                                  )}
                                  {ev.share_target && (
                                    <div className="text-[11px] text-amber-300 mt-1">
                                      ↳ Shared with: <strong>{ev.share_target}</strong>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">{ev.raw_message}</span>
                              )}
                              {ev.is_anomaly === 1 && (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  {ev.anomaly_reason}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <ClientIcon source={ev.client_source} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Hot Files & Active Users */}
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Edited Files & Version History
                  </h3>
                  <span className="text-[11px] text-slate-400">Click file to inspect</span>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {hotFiles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No file edits recorded yet.
                    </div>
                  ) : (
                    hotFiles.map((f) => (
                      <div
                        key={f.file_path}
                        onClick={() => openFileInspector(f.file_path)}
                        className="p-3.5 hover:bg-slate-800/50 cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-blue-400 truncate flex items-center gap-1.5">
                            {f.file_path.endsWith('.xlsx') ? (
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                            <span className="truncate">{f.file_path}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>
                              Editors: <strong className="text-slate-200">{f.collaborators || 'admin'}</strong>
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(f.last_modified)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            v{f.latest_version || 1}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-300">
                            {f.edit_count} {f.edit_count === 1 ? 'edit' : 'edits'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    User Attribution Summary
                  </h3>
                  <span className="text-[11px] text-slate-400">Click user for profile</span>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {usersList.map((u) => (
                    <div
                      key={u.actor}
                      onClick={() => openUserInspector(u.actor)}
                      className="p-3.5 hover:bg-slate-800/50 cursor-pointer transition flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {u.actor}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Last active: {formatRelativeTime(u.last_active)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-blue-400">{u.edits}</div>
                          <div className="text-[10px] text-slate-400">Edits</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-cyan-300">{u.views}</div>
                          <div className="text-[10px] text-slate-400">Views</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-amber-300">{u.shares}</div>
                          <div className="text-[10px] text-slate-400">Shares</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FILE VERSION & LINEAGE INSPECTOR */}
        {activeTab === 'files' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">Select File to Inspect</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {hotFiles.map((f) => (
                  <button
                    key={f.file_path}
                    onClick={() => openFileInspector(f.file_path)}
                    className={`w-full text-left p-3.5 transition flex items-center justify-between ${
                      selectedFile === f.file_path
                        ? 'bg-blue-600/15 border-l-4 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {f.file_path}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {f.edit_count} edits • Collaborators: {f.collaborators}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      v{f.latest_version || 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              {fileTimeline ? (
                <FileTimelinePanel data={fileTimeline} onSelectUser={openUserInspector} />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-sm text-slate-400">
                  Select a file from the left panel to inspect its complete edit history and Nextcloud disk snapshots.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: USER FORENSICS PROFILER */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">Tracked Users</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {usersList.map((u) => (
                  <button
                    key={u.actor}
                    onClick={() => openUserInspector(u.actor)}
                    className={`w-full text-left p-3.5 transition flex items-center justify-between ${
                      selectedUser === u.actor
                        ? 'bg-blue-600/15 border-l-4 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">👤 {u.actor}</div>
                      <div className="text-[11px] text-slate-400">
                        {u.edits} edits • {u.views} views • {u.event_count} total events
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              {userProfile ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        👤 User Forensic Dossier: <span className="text-blue-400">{userProfile.actor}</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        First Seen: {formatUtcTimestamp(userProfile.summary?.first_seen)} • Last Seen:{' '}
                        {formatUtcTimestamp(userProfile.summary?.last_seen)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActorFilter(userProfile.actor);
                        setActiveTab('explorer');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Filter All Audit Logs for {userProfile.actor}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">File Edits</div>
                      <div className="text-xl font-bold text-blue-400 mt-0.5">
                        {userProfile.summary?.edits || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">Files Created</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">
                        {userProfile.summary?.created || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">Files Viewed</div>
                      <div className="text-xl font-bold text-cyan-300 mt-0.5">
                        {userProfile.summary?.views || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">Known IPs</div>
                      <div className="text-xs font-mono text-slate-200 mt-1 truncate">
                        {(userProfile.ip_addresses || []).join(', ') || '—'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3">
                      Files Created, Edited or Accessed by {userProfile.actor}
                    </h4>
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                      {(userProfile.touched_files || []).map((tf) => (
                        <div
                          key={tf.file_path}
                          onClick={() => openFileInspector(tf.file_path)}
                          className="p-3 bg-slate-950/50 hover:bg-slate-800/50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-blue-400">{tf.file_path}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-300">{tf.edits} edits</span>
                            {tf.max_version && (
                              <span className="px-2 py-0.5 rounded font-mono bg-sky-500/15 text-sky-300">
                                v{tf.max_version}
                              </span>
                            )}
                            <span className="text-slate-400 font-mono">
                              {formatUtcTimestamp(tf.last_touched)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM TELEMETRY & BREAKDOWN */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">
                Events by Action Type
              </h3>
              <div className="space-y-3">
                {byAction.map((a) => {
                  const pct = ov.total_events
                    ? Math.round((a.count / ov.total_events) * 100)
                    : 0;
                  return (
                    <div key={a.action_type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200">{a.action_type}</span>
                        <span className="text-slate-400">
                          {a.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">
                Events by Client / Editor Application
              </h3>
              <div className="space-y-3">
                {byClient.map((c) => {
                  const pct = ov.total_events
                    ? Math.round((c.count / ov.total_events) * 100)
                    : 0;
                  return (
                    <div key={c.client_source} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200">{c.client_source}</span>
                        <span className="text-slate-400">
                          {c.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Modal when clicking a file from the Explorer tab */}
      {selectedFile && activeTab === 'explorer' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedFile(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  File Version & Chain-of-Custody Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {loadingTimeline ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Querying PostgreSQL oc_filecache & audit history...
                </div>
              ) : fileTimeline ? (
                <FileTimelinePanel
                  data={fileTimeline}
                  onSelectUser={(u) => {
                    setSelectedFile(null);
                    openUserInspector(u);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileTimelinePanel({ data, onSelectUser }) {
  const storageVersions = data.storage_versions || [];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 break-all">
            📄 {data.requested_path}
          </h3>
          {data.known_aliases && data.known_aliases.length > 1 && (
            <p className="text-xs text-purple-300 mt-1">
              Tracked across renames: {data.known_aliases.join(' ↔ ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            Total Versions: {Math.max(data.total_versions || 0, storageVersions.length)}
          </span>
        </div>
      </div>

      {/* Editors & Viewers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
            ✏️ Verified Editors (Who Modified This File)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(data.editors || []).length === 0 ? (
              <span className="text-xs text-slate-400">None</span>
            ) : (
              data.editors.map((u) => (
                <button
                  key={u}
                  onClick={() => onSelectUser && onSelectUser(u)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                >
                  👤 {u}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
            👁️ Verified Viewers / Readers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(data.viewers || []).length === 0 ? (
              <span className="text-xs text-slate-400">None</span>
            ) : (
              data.viewers.map((u) => (
                <button
                  key={u}
                  onClick={() => onSelectUser && onSelectUser(u)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
                >
                  👤 {u}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Physical Storage Versions from Nextcloud PostgreSQL oc_filecache */}
      {storageVersions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            Nextcloud Physical Disk Snapshots (oc_filecache & files_versions)
          </h4>
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Snapshot</th>
                  <th className="py-2 px-3">Timestamp (UTC)</th>
                  <th className="py-2 px-3">File Size</th>
                  <th className="py-2 px-3">Size Delta</th>
                  <th className="py-2 px-3">ETag Checksum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {storageVersions.map((sv) => (
                  <tr key={sv.fileid}>
                    <td className="py-2 px-3 font-mono font-bold text-sky-300">
                      v{sv.version_index}{' '}
                      {sv.is_current && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          LIVE
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-200">
                      {formatUtcTimestamp(sv.timestamp)}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-200">
                      {formatBytes(sv.size_bytes)}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      <span
                        className={
                          sv.size_delta_bytes >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {sv.size_delta_bytes >= 0 ? '+' : ''}
                        {formatBytes(sv.size_delta_bytes)}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                      {sv.etag?.substring(0, 14)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chronological Event Chain */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          Complete Audit Chain of Custody (Newest First)
        </h4>
        <div className="space-y-3 border-l-2 border-slate-800 ml-2 pl-4">
          {(data.timeline || []).map((ev) => (
            <div
              key={ev.id}
              className="bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 relative"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-4 ring-4 ring-slate-900" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={ev.action_type} version={ev.version_number} />
                  <span className="text-xs font-bold text-white">by {ev.actor}</span>
                  <ClientIcon source={ev.client_source} />
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {formatUtcTimestamp(ev.timestamp)} ({formatRelativeTime(ev.timestamp)})
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap gap-3">
                <span>Path: <code className="text-slate-300">{ev.file_path}</code></span>
                <span>IP: <code className="text-slate-300">{ev.ip_address}</code></span>
                {ev.previous_path && (
                  <span className="text-purple-300">
                    Renamed from: <code>{ev.previous_path}</code>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
