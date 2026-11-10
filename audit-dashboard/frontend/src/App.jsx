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
  ChevronLeft,
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
    label: 'تم التعديل / الحفظ',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: FileEdit,
  },
  FILE_CREATED: {
    label: 'تم الإنشاء / الرفع',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: FilePlus,
  },
  FILE_VIEWED: {
    label: 'تم الفتح / العرض',
    color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Eye,
  },
  FILE_RENAMED: {
    label: 'إعادة تسمية / نقل',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: ArrowRightLeft,
  },
  FILE_DELETED: {
    label: 'تم الحذف',
    color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  FILE_RESTORED: {
    label: 'تمت الاستعادة',
    color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    icon: RefreshCw,
  },
  VERSION_RESTORED: {
    label: 'استعادة إصدار سابق',
    color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: GitCommit,
  },
  FILE_SHARED: {
    label: 'مشاركة داخلية',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Share2,
  },
  FILE_SHARED_PUBLIC: {
    label: 'مشاركة عبر رابط عام',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: Globe,
  },
  PERMISSION_CHANGED: {
    label: 'تغيير الصلاحيات',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: Lock,
  },
  USER_LOGIN: {
    label: 'تسجيل دخول ناجح',
    color: 'bg-slate-700/60 text-slate-300 border-slate-600',
    icon: UserCheck,
  },
  USER_LOGIN_FAILED: {
    label: 'محاولة دخول فاشلة',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: Lock,
  },
};

function translateClientSource(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('collabora') || s.includes('office')) {
    return 'محرر المستندات المباشر (Collabora Office)';
  }
  if (s.includes('desktop')) {
    return 'تطبيق مزامنة سطح المكتب';
  }
  if (s.includes('mobile')) {
    return 'تطبيق الهاتف المحمول';
  }
  if (s.includes('text')) {
    return 'المحرر النصي السحابي';
  }
  if (s.includes('web browser')) {
    return 'متصفح الويب';
  }
  if (s.includes('webdav')) {
    return 'عميل WebDAV';
  }
  return source || 'النظام / واجهة برمجية';
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const abs = Math.abs(bytes);
  if (abs === 0) return '0 بايت';
  const k = 1024;
  const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
  const i = Math.floor(Math.log(abs) / Math.log(k));
  const val = (abs / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
  return `${bytes < 0 ? '-' : ''}${val} ${sizes[i]}`;
}

function formatRelativeTime(iso) {
  if (!iso) return '—';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return 'الآن';
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
  if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
  return `منذ ${Math.floor(diffSec / 86400)} يوم`;
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
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {meta.label}
      </span>
      {version ? (
        <span
          dir="ltr"
          className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30"
        >
          الإصدار v{version}
        </span>
      ) : null}
    </div>
  );
}

function ClientIcon({ source }) {
  const s = (source || '').toLowerCase();
  const label = translateClientSource(source);
  if (s.includes('collabora') || s.includes('office')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-md font-medium">
        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
        {label}
      </span>
    );
  }
  if (s.includes('desktop')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-md font-medium">
        <Laptop className="w-3.5 h-3.5 text-emerald-400" />
        {label}
      </span>
    );
  }
  if (s.includes('mobile')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-md font-medium">
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 rounded-md font-medium">
      <Globe className="w-3.5 h-3.5 text-slate-400" />
      {label}
    </span>
  );
}

export default function App() {
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

  // Selected File / User
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
        setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }
      const data = await res.json();
      localStorage.setItem('shehata_audit_token', data.token);
      setAuthToken(data.token);
      setAuthUser(data.username);
      setLoginPassword('');
    } catch {
      setLoginError('تعذر الاتصال بخادم المصادقة');
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
      <div dir="rtl" className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        جارٍ التحقق من جلسة الأمان...
      </div>
    );
  }

  // شاشة تسجيل الدخول باللغة العربية
  if (!authUser) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">خزنة ملفات الشركة</h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              لوحة التدقيق الأمني، تتبع تعديلات الملفات، وسجل الإصدارات الكامل (من قام بماذا ومتى)
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
                اسم مستخدم المسؤول
              </label>
              <input
                type="text"
                dir="ltr"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                dir="ltr"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="أدخل كلمة مرور المسؤول..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-left"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {loginSubmitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول إلى لوحة التدقيق'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
            محمي بمصادقة الجلسات المشفرة HMAC-SHA256 • مربوط بقاعدة بيانات PostgreSQL 16
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
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base font-bold tracking-tight text-white">
                خزنة ملفات الشركة — مركز التدقيق وتتبع التعديلات
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                مراقبة فورية مباشرة
              </span>
              {pgConnected && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  <Database className="w-3 h-3" />
                  متصل بقاعدة بيانات PostgreSQL
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تتبع دقيق لكل عملية إنشاء أو تعديل أو عرض أو حذف أو مشاركة مع ربط جلسات Collabora Office وسجل الإصدارات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResync}
            disabled={resyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="إعادة فهرسة سجل التدقيق وربط جلسات Collabora من قاعدة البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin text-blue-400' : ''}`} />
            {resyncing ? 'جارٍ المزامنة...' : 'إعادة مزامنة السجل'}
          </button>

          <button
            onClick={handleSeedDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            إضافة أنشطة تجريبية
          </button>

          <a
            href={`api/export/csv?${buildQueryParams()}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير CSV
          </a>

          <a
            href={`api/export/json?${buildQueryParams()}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير JSON
          </a>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            خروج ({authUser})
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {/* بطاقات الإحصائيات السريعة */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>إجمالي أحداث السجل</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{ov.total_events || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              عبر {ov.tracked_files || 0} ملف متتبع
            </div>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
              <span>تعديلات وحفظ الملفات</span>
              <FileEdit className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400 mt-1.5">{ov.total_edits || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Collabora Office + المزامنة والويب
            </div>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
              <span>ملفات تم إنشاؤها</span>
              <FilePlus className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1.5">{ov.total_created || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">عمليات الرفع والإنشاء الأولية</div>
          </div>

          <div className="bg-slate-900/90 border border-cyan-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
              <span>عمليات الفتح والعرض</span>
              <Eye className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-300 mt-1.5">{ov.total_views || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">سجل قراءة واستعراض الملفات</div>
          </div>

          <div className="bg-slate-900/90 border border-amber-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
              <span>المستخدمون النشطون</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1.5">{ov.active_users || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">حسابات المستخدمين الموثقة</div>
          </div>

          <div className="bg-slate-900/90 border border-rose-500/25 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-rose-300 font-semibold">
              <span>التنبيهات الأمنية</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1.5">{ov.total_anomalies || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              روابط عامة أو حذف جماعي
            </div>
          </div>
        </div>

        {/* التبويبات الرئيسية */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'explorer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            سجل التدقيق المباشر ({eventsData.total || 0})
          </button>

          <button
            onClick={() => {
              setActiveTab('files');
              if (!selectedFile && hotFiles.length > 0) {
                openFileInspector(hotFiles[0].file_path);
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'files'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <GitCommit className="w-4 h-4" />
            فاحص إصدارات وتعديلات الملفات ({hotFiles.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              if (!selectedUser && usersList.length > 0) {
                openUserInspector(usersList[0].actor);
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            سجل نشاط المستخدمين ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            إحصائيات وتحليلات النظام
          </button>
        </div>

        {/* التبويب الأول: مستكشف سجل التدقيق المباشر */}
        {activeTab === 'explorer' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-4">
              {/* شريط الفلترة والبحث */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      البحث باسم الملف أو المسار
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={fileQuery}
                        onChange={(e) => setFileQuery(e.target.value)}
                        placeholder="مثال: invoices (8).xlsx..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      المستخدم (من قام بالعملية)
                    </label>
                    <select
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">جميع المستخدمين</option>
                      {usersList.map((u) => (
                        <option key={u.actor} value={u.actor}>
                          👤 {u.actor} ({u.edits} تعديل، {u.event_count} حدث)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      نوع العملية (ماذا فعل)
                    </label>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">جميع العمليات</option>
                      <option value="FILE_EDITED">✏️ تعديل / حفظ ملف</option>
                      <option value="FILE_CREATED">➕ إنشاء / رفع ملف</option>
                      <option value="FILE_VIEWED">👁️ فتح / عرض ملف</option>
                      <option value="FILE_RENAMED">🔀 إعادة تسمية / نقل ملف</option>
                      <option value="FILE_DELETED">🗑️ حذف ملف</option>
                      <option value="FILE_SHARED">🔗 مشاركة داخلية (مستخدم/مجموعة)</option>
                      <option value="FILE_SHARED_PUBLIC">🌐 مشاركة عبر رابط عام</option>
                      <option value="USER_LOGIN">🔑 تسجيل دخول ناجح</option>
                      <option value="USER_LOGIN_FAILED">🚨 محاولة دخول فاشلة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      البرنامج / أداة التعديل
                    </label>
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
                    >
                      <option value="">جميع البرامج والأجهزة</option>
                      <option value="Collabora Office">محرر المستندات المباشر (Collabora Office)</option>
                      <option value="Web Browser">متصفح الويب</option>
                      <option value="Desktop Sync">تطبيق مزامنة سطح المكتب</option>
                      <option value="Mobile App">تطبيق الهاتف المحمول</option>
                    </select>
                  </div>
                </div>

                {/* أزرار الفلترة السريعة */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setExcludeViews(!excludeViews)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                        excludeViews
                          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {excludeViews ? 'يتم عرض التعديلات والتغييرات فقط' : 'إخفاء أحداث القراءة والعرض فقط'}
                    </button>

                    <button
                      onClick={() => setAnomaliesOnly(!anomaliesOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                        anomaliesOnly
                          ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {anomaliesOnly ? 'يتم عرض التنبيهات الأمنية فقط' : 'عرض التنبيهات الأمنية فقط'}
                    </button>
                  </div>

                  <button
                    onClick={resetFilters}
                    className="text-xs text-slate-400 hover:text-white underline font-medium"
                  >
                    إعادة تعيين الفلاتر
                  </button>
                </div>
              </div>

              {/* جدول الأحداث */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">
                    السجل الزمني الكامل للتدقيق (من قام بماذا ومتى)
                  </h2>
                  <span className="text-xs text-slate-400">
                    عرض {eventsData.events?.length || 0} من أصل {eventsData.total || 0} حدث
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400">
                        <th className="py-3 px-4">التاريخ والوقت (UTC)</th>
                        <th className="py-3 px-4">المستخدم (مَن)</th>
                        <th className="py-3 px-4">العملية ورقم الإصدار</th>
                        <th className="py-3 px-4">الملف / المجلد (اضغط لعرض سجل الإصدارات)</th>
                        <th className="py-3 px-4">أداة التعديل / الجهاز</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            جارٍ تحميل سجل التدقيق المباشر...
                          </td>
                        </tr>
                      ) : !eventsData.events || eventsData.events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            لا توجد أحداث مطابقة لمعايير البحث الحالية.
                          </td>
                        </tr>
                      ) : (
                        eventsData.events.map((ev) => (
                          <tr
                            key={ev.id}
                            className="hover:bg-slate-800/40 transition group"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div dir="ltr" className="font-mono text-slate-200 inline-block">
                                {formatUtcTimestamp(ev.timestamp)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {formatRelativeTime(ev.timestamp)}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                onClick={() => openUserInspector(ev.actor)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-blue-600/20 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40 font-bold text-slate-200 transition"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span dir="ltr">{ev.actor}</span>
                              </button>
                              <div dir="ltr" className="text-[10px] font-mono text-slate-400 mt-1">
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
                                    className="text-right font-semibold text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1.5 break-all"
                                  >
                                    {ev.file_path.endsWith('.xlsx') ? (
                                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                    )}
                                    <span dir="ltr">{ev.file_path}</span>
                                  </button>
                                  {ev.previous_path && (
                                    <div className="text-[11px] text-purple-300 mt-1">
                                      ↳ تمت إعادة تسميته من:{' '}
                                      <code dir="ltr" className="bg-slate-950 px-1.5 py-0.5 rounded">
                                        {ev.previous_path}
                                      </code>
                                    </div>
                                  )}
                                  {ev.share_target && (
                                    <div className="text-[11px] text-amber-300 mt-1">
                                      ↳ تمت مشاركته مع: <strong dir="ltr">{ev.share_target}</strong>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">{ev.raw_message}</span>
                              )}
                              {ev.is_anomaly === 1 && (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-semibold">
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

            {/* العمود الجانبي الأيسر: أكثر الملفات تعديلاً ونشاط المستخدمين */}
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    الملفات المعدلة وسجل الإصدارات
                  </h3>
                  <span className="text-[11px] text-slate-400">اضغط على الملف للفحص</span>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {hotFiles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      لا توجد ملفات معدلة مسجلة حتى الآن.
                    </div>
                  ) : (
                    hotFiles.map((f) => (
                      <div
                        key={f.file_path}
                        onClick={() => openFileInspector(f.file_path)}
                        className="p-3.5 hover:bg-slate-800/50 cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-blue-400 truncate flex items-center gap-1.5">
                            {f.file_path.endsWith('.xlsx') ? (
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                            <span dir="ltr" className="truncate">{f.file_path}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>
                              المحررون: <strong dir="ltr" className="text-slate-200">{f.collaborators || 'admin'}</strong>
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(f.last_modified)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span dir="ltr" className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            v{f.latest_version || 1}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/15 text-blue-300">
                            {f.edit_count} تعديل
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    ملخص نشاط المستخدمين
                  </h3>
                  <span className="text-[11px] text-slate-400">اضغط لعرض ملف المستخدم</span>
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
                          <span dir="ltr">{u.actor}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          آخر نشاط: {formatRelativeTime(u.last_active)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-blue-400">{u.edits}</div>
                          <div className="text-[10px] text-slate-400">تعديلات</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-cyan-300">{u.views}</div>
                          <div className="text-[10px] text-slate-400">مشاهدات</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-amber-300">{u.shares}</div>
                          <div className="text-[10px] text-slate-400">مشاركات</div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* التبويب الثاني: فاحص إصدارات وتعديلات الملفات */}
        {activeTab === 'files' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">اختر ملفاً لفحص سجل تعديلاته</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {hotFiles.map((f) => (
                  <button
                    key={f.file_path}
                    onClick={() => openFileInspector(f.file_path)}
                    className={`w-full text-right p-3.5 transition flex items-center justify-between ${
                      selectedFile === f.file_path
                        ? 'bg-blue-600/15 border-r-4 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 pl-2">
                      <div dir="ltr" className="text-xs font-bold text-slate-100 truncate text-right">
                        {f.file_path}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {f.edit_count} تعديل • المحررون: <span dir="ltr">{f.collaborators}</span>
                      </div>
                    </div>
                    <span dir="ltr" className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
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
                  اختر ملفاً من القائمة اليمنى لاستعراض سجل تعديلاته الكامل ونسخ الإصدارات المحفوظة على القرص.
                </div>
              )}
            </div>
          </div>
        )}

        {/* التبويب الثالث: سجل نشاط المستخدمين */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">المستخدمون المسجلون</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {usersList.map((u) => (
                  <button
                    key={u.actor}
                    onClick={() => openUserInspector(u.actor)}
                    className={`w-full text-right p-3.5 transition flex items-center justify-between ${
                      selectedUser === u.actor
                        ? 'bg-blue-600/15 border-r-4 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">
                        👤 <span dir="ltr">{u.actor}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {u.edits} تعديل • {u.views} مشاهدة • {u.event_count} إجمالي الأحداث
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
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
                        👤 التقرير التفصيلي للمستخدم: <span dir="ltr" className="text-blue-400">{userProfile.actor}</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        أول ظهور: <span dir="ltr">{formatUtcTimestamp(userProfile.summary?.first_seen)}</span> • آخر نشاط:{' '}
                        <span dir="ltr">{formatUtcTimestamp(userProfile.summary?.last_seen)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActorFilter(userProfile.actor);
                        setActiveTab('explorer');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      عرض جميع سجلات {userProfile.actor}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">تعديلات الملفات</div>
                      <div className="text-xl font-bold text-blue-400 mt-0.5">
                        {userProfile.summary?.edits || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">ملفات تم إنشاؤها</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">
                        {userProfile.summary?.created || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">ملفات تم عرضها</div>
                      <div className="text-xl font-bold text-cyan-300 mt-0.5">
                        {userProfile.summary?.views || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <div className="text-[11px] text-slate-400">عناوين IP المستخدمة</div>
                      <div dir="ltr" className="text-xs font-mono text-slate-200 mt-1 truncate text-right">
                        {(userProfile.ip_addresses || []).join(', ') || '—'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-3">
                      الملفات التي قام المستخدم {userProfile.actor} بإنشائها أو تعديلها أو استعراضها
                    </h4>
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                      {(userProfile.touched_files || []).map((tf) => (
                        <div
                          key={tf.file_path}
                          onClick={() => openFileInspector(tf.file_path)}
                          className="p-3 bg-slate-950/50 hover:bg-slate-800/50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <span dir="ltr" className="font-bold text-blue-400">{tf.file_path}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-300">{tf.edits} تعديل</span>
                            {tf.max_version && (
                              <span dir="ltr" className="px-2 py-0.5 rounded font-mono bg-sky-500/15 text-sky-300">
                                v{tf.max_version}
                              </span>
                            )}
                            <span dir="ltr" className="text-slate-400 font-mono">
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

        {/* التبويب الرابع: إحصائيات وتحليلات النظام */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">
                توزيع الأحداث حسب نوع العملية
              </h3>
              <div className="space-y-3">
                {byAction.map((a) => {
                  const pct = ov.total_events
                    ? Math.round((a.count / ov.total_events) * 100)
                    : 0;
                  const label = ACTION_META[a.action_type]?.label || a.action_type;
                  return (
                    <div key={a.action_type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200">{label}</span>
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
              <h3 className="text-sm font-bold text-white mb-4">
                توزيع الأحداث حسب البرنامج / أداة التعديل
              </h3>
              <div className="space-y-3">
                {byClient.map((c) => {
                  const pct = ov.total_events
                    ? Math.round((c.count / ov.total_events) * 100)
                    : 0;
                  return (
                    <div key={c.client_source} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          {translateClientSource(c.client_source)}
                        </span>
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

      {/* نافذة منبثقة لفحص تاريخ الملف وإصداراته */}
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
                  فاحص سجل تعديلات الملف وسلسلة الإصدارات الكاملة
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
                  جارٍ استرجاع سجل الإصدارات من قاعدة بيانات PostgreSQL...
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
    <div dir="rtl" className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 break-all">
            📄 <span dir="ltr">{data.requested_path}</span>
          </h3>
          {data.known_aliases && data.known_aliases.length > 1 && (
            <p className="text-xs text-purple-300 mt-1">
              تم تتبعه عبر تغييرات الأسماء: <span dir="ltr">{data.known_aliases.join(' ↔ ')}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            إجمالي الإصدارات المحفوظة: {Math.max(data.total_versions || 0, storageVersions.length)}
          </span>
        </div>
      </div>

      {/* المحررون والمشاهدون */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-bold text-slate-400 mb-2">
            ✏️ المحررون الموثقون (من قام بإنشاء أو تعديل هذا الملف)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(data.editors || []).length === 0 ? (
              <span className="text-xs text-slate-400">لا يوجد</span>
            ) : (
              data.editors.map((u) => (
                <button
                  key={u}
                  onClick={() => onSelectUser && onSelectUser(u)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                >
                  👤 <span dir="ltr">{u}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-bold text-slate-400 mb-2">
            👁️ المشاهدون / المستعرضون للملف
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(data.viewers || []).length === 0 ? (
              <span className="text-xs text-slate-400">لا يوجد</span>
            ) : (
              data.viewers.map((u) => (
                <button
                  key={u}
                  onClick={() => onSelectUser && onSelectUser(u)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
                >
                  👤 <span dir="ltr">{u}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* النسخ الفعلية المخزنة على القرص من قاعدة بيانات Nextcloud */}
      {storageVersions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-300 mb-2.5 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            نسخ وإصدارات الملف الفعلية المحفوظة على الخادم (oc_filecache & files_versions)
          </h4>
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">رقم الإصدار</th>
                  <th className="py-2.5 px-3">التاريخ والوقت (UTC)</th>
                  <th className="py-2.5 px-3">حجم الملف</th>
                  <th className="py-2.5 px-3">مقدار التغير في الحجم</th>
                  <th className="py-2.5 px-3">بصمة الملف (ETag)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {storageVersions.map((sv) => (
                  <tr key={sv.fileid}>
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-300">
                      <span dir="ltr">v{sv.version_index}</span>{' '}
                      {sv.is_current && (
                        <span className="mr-1.5 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          النسخة الحالية
                        </span>
                      )}
                    </td>
                    <td dir="ltr" className="py-2.5 px-3 font-mono text-slate-200 text-right">
                      {formatUtcTimestamp(sv.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {formatBytes(sv.size_bytes)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      <span
                        className={
                          sv.size_delta_bytes >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {sv.size_delta_bytes >= 0 ? '+' : ''}
                        {formatBytes(sv.size_delta_bytes)}
                      </span>
                    </td>
                    <td dir="ltr" className="py-2.5 px-3 font-mono text-[11px] text-slate-400 text-right">
                      {sv.etag?.substring(0, 14)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* السجل الزمني التفصيلي */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          السجل الزمني الكامل لتعديلات وعمليات الملف (من الأحدث إلى الأقدم)
        </h4>
        <div className="space-y-3 border-r-2 border-slate-800 mr-2 pr-4">
          {(data.timeline || []).map((ev) => (
            <div
              key={ev.id}
              className="bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 relative"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -right-[21px] top-4 ring-4 ring-slate-900" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={ev.action_type} version={ev.version_number} />
                  <span className="text-xs font-bold text-white">
                    بواسطة: <span dir="ltr" className="text-blue-300">{ev.actor}</span>
                  </span>
                  <ClientIcon source={ev.client_source} />
                </div>
                <span className="text-xs text-slate-400">
                  <span dir="ltr" className="font-mono">{formatUtcTimestamp(ev.timestamp)}</span> ({formatRelativeTime(ev.timestamp)})
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5 flex flex-wrap gap-3">
                <span>المسار: <code dir="ltr" className="text-slate-300">{ev.file_path}</code></span>
                <span>عنوان IP: <code dir="ltr" className="text-slate-300">{ev.ip_address}</code></span>
                {ev.previous_path && (
                  <span className="text-purple-300">
                    الاسم السابق: <code dir="ltr">{ev.previous_path}</code>
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
