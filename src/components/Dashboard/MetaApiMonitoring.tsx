import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';

interface RequestLog {
  id: string;
  account_id: string;
  request_type: string;
  status: string;
  attempt_count: number;
  error_code?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

interface RateLimit {
  account_id: string;
  last_request_at: string;
  consecutive_errors: number;
  total_429_errors: number;
  is_throttled: boolean;
  throttle_until?: string;
  active_requests: number;
}

interface MonitoringStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  pendingRequests: number;
  retryingRequests: number;
  total429Errors: number;
  successRate: number;
}

export function MetaApiMonitoring({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [stats, setStats] = useState<MonitoringStats>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    pendingRequests: 0,
    retryingRequests: 0,
    total429Errors: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMonitoringData = async () => {
    try {
      const { data: accounts } = await supabase
        .from('mt_accounts')
        .select('id, metaapi_account_id, name')
        .eq('user_id', userId);

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      const accountIds = accounts.map(acc => acc.id);

      const { data: requestLogs } = await supabase
        .from('metaapi_request_logs')
        .select('*')
        .in('account_id', accountIds)
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: rateLimitData } = await supabase
        .from('metaapi_rate_limits')
        .select('*')
        .in('account_id', accountIds);

      if (requestLogs) {
        setLogs(requestLogs);

        const total = requestLogs.length;
        const successful = requestLogs.filter(log => log.status === 'success').length;
        const failed = requestLogs.filter(log => log.status === 'failed').length;
        const pending = requestLogs.filter(log => log.status === 'pending').length;
        const retrying = requestLogs.filter(log => log.status === 'retrying').length;
        const total429 = rateLimitData?.reduce((sum, rl) => sum + rl.total_429_errors, 0) || 0;

        setStats({
          totalRequests: total,
          successfulRequests: successful,
          failedRequests: failed,
          pendingRequests: pending,
          retryingRequests: retrying,
          total429Errors: total429,
          successRate: total > 0 ? (successful / total) * 100 : 0,
        });
      }

      if (rateLimitData) {
        setRateLimits(rateLimitData);
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();

    const interval = setInterval(fetchMonitoringData, 10000);

    return () => clearInterval(interval);
  }, [userId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'retrying':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'processing':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'retrying':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `Il y a ${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="bg-surface-white dark:bg-gray-800 rounded-card shadow-card p-6 border-2 border-blue-500 dark:border-gray-600">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-white dark:bg-gray-800 rounded-card shadow-card p-6 border-2 border-blue-500 dark:border-gray-600">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-dark-primary dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Monitoring MetaApi
          </h2>
          <button
            onClick={fetchMonitoringData}
            className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-secondary dark:text-gray-400">Total Requêtes</p>
                <p className="text-2xl font-bold text-dark-primary dark:text-white">{stats.totalRequests}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-secondary dark:text-gray-400">Succès</p>
                <p className="text-2xl font-bold text-dark-primary dark:text-white">{stats.successfulRequests}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{stats.successRate.toFixed(1)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-secondary dark:text-gray-400">Échecs</p>
                <p className="text-2xl font-bold text-dark-primary dark:text-white">{stats.failedRequests}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-secondary dark:text-gray-400">Erreurs 429</p>
                <p className="text-2xl font-bold text-dark-primary dark:text-white">{stats.total429Errors}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        {rateLimits.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark-primary dark:text-white mb-3">Rate Limits par Compte</h3>
            <div className="space-y-2">
              {rateLimits.map((rl) => (
                <div
                  key={rl.account_id}
                  className={`p-4 rounded-lg border ${
                    rl.is_throttled
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {rl.is_throttled && <AlertTriangle className="w-5 h-5 text-red-500" />}
                        <div>
                          <p className="font-medium text-dark-primary dark:text-white">
                            Compte: {rl.account_id.substring(0, 8)}...
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-dark-secondary dark:text-gray-400">
                            <span>Requêtes actives: {rl.active_requests}</span>
                            <span>Erreurs consécutives: {rl.consecutive_errors}</span>
                            <span>Total 429: {rl.total_429_errors}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {rl.is_throttled && rl.throttle_until && (
                      <div className="text-right">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Bloqué jusqu'à</p>
                        <p className="text-xs text-red-500 dark:text-red-500">
                          {new Date(rl.throttle_until).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-dark-primary dark:text-white mb-3">Dernières Requêtes</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dark-secondary dark:text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dark-secondary dark:text-gray-400">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dark-secondary dark:text-gray-400">Tentatives</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dark-secondary dark:text-gray-400">Erreur</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dark-secondary dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-dark-secondary dark:text-gray-400">
                      Aucune requête pour le moment
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-dark-primary dark:text-white">
                        {log.request_type}
                      </td>
                      <td className="py-3 px-4 text-sm text-dark-primary dark:text-white">
                        {log.attempt_count}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {log.error_code ? (
                          <span className="text-red-600 dark:text-red-400">{log.error_code}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-dark-secondary dark:text-gray-400">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
