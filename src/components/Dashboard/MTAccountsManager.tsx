import React, { useState, useEffect } from 'react';
import { MTAccount, supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Download,
} from 'lucide-react';

interface Journal {
  id: string;
  name: string;
  description: string;
}

interface MTAccountsManagerProps {
  accounts: MTAccount[];
  onAccountsChange: () => void;
  userJournals: string[];
}

export const MTAccountsManager: React.FC<MTAccountsManagerProps> = ({
  accounts,
  onAccountsChange,
  userJournals,
}) => {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    broker: '',
    platform: 'MT5' as 'MT4' | 'MT5',
    accountType: 'demo' as 'demo' | 'live',
  });

  const [journals, setJournals] = useState<Journal[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const [showJournalSelect, setShowJournalSelect] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MTAccount | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<string>('');
  const [syncDays, setSyncDays] = useState(90);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (userJournals.length > 0) {
      loadJournals();
      checkAccountsStatus();
    }
  }, [userJournals]);

  const loadJournals = async () => {
    try {
      const { data, error } = await supabase
        .from('journals')
        .select('id, name, description')
        .in('id', userJournals)
        .order('name');

      if (error) throw error;
      setJournals(data || []);

      if (data && data.length > 0 && !selectedJournal) {
        setSelectedJournal(data[0].id);
      }
    } catch (error) {
      console.error('Error loading journals:', error);
    }
  };

  const checkAccountsStatus = async () => {
    if (accounts.length === 0) return;

    const accountsToCheck = accounts.filter(
      (acc) =>
        acc.status === 'pending_configuration' ||
        acc.status === 'deploying' ||
        acc.status === 'disconnected'
    );

    if (accountsToCheck.length === 0) return;

    setCheckingStatus(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      for (const account of accountsToCheck) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enqueue-sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              account_id: account.id,
              operation: 'check_status',
            }),
          }
        );
      }

      toast.success('Status check queued');
    } catch (error) {
      console.error('Error checking account status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRegenerateLink = async (account: MTAccount) => {
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-config-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            account_id: account.id,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Configuration link regenerated');
      onAccountsChange();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate link');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mt-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            journal_id: selectedJournal,
            name: formData.accountName,
            broker: formData.broker,
            platform: formData.platform,
            account_type: formData.accountType,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(t.messages.accountAdded);
      setShowForm(false);
      setFormData({ accountName: '', broker: '', platform: 'MT5', accountType: 'demo' });
      onAccountsChange();
    } catch (error: any) {
      toast.error(error.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (account: MTAccount) => {
    if (!confirm(t.accounts.confirmDelete)) return;

    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-mt-account`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            account_id: account.id,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(t.messages.accountDeleted);
      onAccountsChange();
    } catch (error: any) {
      toast.error(error.message || t.messages.deleteError);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success(t.messages.linkCopied);
  };

  const handleSyncTrades = async (account: MTAccount) => {
    if (account.status !== 'connected') {
      toast.error('Account must be connected before syncing');
      return;
    }

    setSelectedAccount(account);
    setShowJournalSelect(true);
  };

  const executeSync = async () => {
    if (!selectedAccount || !selectedJournal) {
      toast.error('Please select a journal');
      return;
    }

    setSyncing(true);
    setSyncingAccount(selectedAccount.id);
    setShowJournalSelect(false);

    const toastId = toast.loading('Adding sync to queue...');

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enqueue-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            account_id: selectedAccount.id,
            operation: 'sync_trades',
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(
          'Sync queued! The worker will process it within 2 minutes.',
          { id: toastId, duration: 5000 }
        );
        onAccountsChange();
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Failed to queue sync', { id: toastId });
    } finally {
      setSyncing(false);
      setSyncingAccount(null);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'connected') return <CheckCircle className="w-4 h-4 text-[#3B82F6]" />;
    if (status === 'pending_configuration') return <Clock className="w-4 h-4 text-warning-yellow" />;
    return <XCircle className="w-4 h-4 text-[#EF4444]" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'connected') return 'bg-[#3B82F6]-light text-[#3B82F6]';
    if (status === 'pending_configuration') return 'bg-warning-yellow/20 text-warning-yellow';
    return 'bg-[#EF4444]-light text-[#EF4444]';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-stat-small text-white">{t.accounts.title}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-blue text-white rounded-lg text-button hover:bg-primary-blue-hover hover:shadow-button-primary transition-smooth"
        >
          <Plus className="w-4 h-4" />
          {t.accounts.addAccount}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
          <h3 className="text-label-regular font-semibold text-white mb-4">
            {t.accounts.addAccount}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-regular text-[#9CA3AF] mb-2">
                Journal
              </label>
              <select
                value={selectedJournal}
                onChange={(e) => setSelectedJournal(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                required
              >
                {journals.map((journal) => (
                  <option key={journal.id} value={journal.id}>
                    {journal.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-label-regular text-[#9CA3AF] mb-2">
                {t.accounts.accountName}
              </label>
              <input
                type="text"
                required
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                placeholder="My Trading Account"
              />
            </div>

            <div>
              <label className="block text-label-regular text-[#9CA3AF] mb-2">
                {t.accounts.broker}
              </label>
              <input
                type="text"
                required
                value={formData.broker}
                onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                placeholder="ICMarkets-Live"
              />
            </div>

            <div>
              <label className="block text-label-regular text-[#9CA3AF] mb-2">
                {t.accounts.platform}
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
              >
                <option value="MT4">MetaTrader 4</option>
                <option value="MT5">MetaTrader 5</option>
              </select>
            </div>

            <div>
              <label className="block text-label-regular text-[#9CA3AF] mb-2">
                Account Type
              </label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
                className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
              >
                <option value="demo">Demo</option>
                <option value="live">Live</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-blue text-white px-6 py-3 rounded-lg text-button hover:bg-primary-blue-hover hover:shadow-button-primary transition-smooth disabled:opacity-50"
              >
                {loading ? t.common.loading : t.common.save}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 border border-gray-light dark:border-gray-600 text-white rounded-lg text-button hover:bg-gray-ultralight dark:hover:bg-gray-700 transition-smooth"
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-12 text-center">
          <RefreshCw className="w-16 h-16 text-gray-light dark:text-gray-600 mx-auto mb-4" />
          <p className="text-label-regular text-[#6B7280]">{t.accounts.noAccounts}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-label-regular font-semibold text-white mb-1">
                    {account.name}
                  </h3>
                  <p className="text-label-small text-[#6B7280]">
                    {account.broker} • {account.platform}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(account)}
                  disabled={loading}
                  className="p-2 text-gray-medium hover:text-[#EF4444] hover:bg-[#EF4444]-light dark:hover:bg-red-900/30 rounded-lg transition-fast disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-badge ${getStatusColor(account.status)}`}>
                  {getStatusIcon(account.status)}
                  {account.status === 'connected' && t.accounts.connected}
                  {account.status === 'pending_configuration' && t.accounts.pendingConfiguration}
                  {account.status !== 'connected' && account.status !== 'pending_configuration' && t.accounts.disconnected}
                </span>

                {account.status === 'connected' && (
                  <button
                    onClick={() => handleSyncTrades(account)}
                    disabled={syncing && syncingAccount === account.id}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#3B82F6]-light text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white rounded-lg text-badge transition-smooth disabled:opacity-50"
                  >
                    {syncing && syncingAccount === account.id ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        Sync Trades
                      </>
                    )}
                  </button>
                )}

                {account.config_link && (
                  <>
                    <button
                      onClick={() => copyLink(account.config_link!)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-ultralight dark:bg-gray-700 text-gray-medium dark:text-gray-300 hover:bg-gray-light dark:hover:bg-gray-600 rounded-lg text-badge transition-fast"
                    >
                      <Copy className="w-3 h-3" />
                      {t.accounts.copyLink}
                    </button>
                    <a
                      href={account.config_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary-blue-light text-primary-blue hover:bg-primary-blue hover:text-white rounded-lg text-badge transition-smooth"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t.accounts.openLink}
                    </a>
                  </>
                )}

                {account.status === 'pending_configuration' && (
                  <button
                    onClick={() => handleRegenerateLink(account)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-warning-yellow/20 text-warning-yellow hover:bg-warning-yellow hover:text-white rounded-lg text-badge transition-smooth disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate Link
                  </button>
                )}
              </div>

              {account.config_expires_at && (
                <p className="text-label-small text-[#6B7280] mt-3">
                  {t.accounts.expiresAt}: {new Date(account.config_expires_at).toLocaleString()}
                </p>
              )}
              {account.error_message && (
                <p className="text-label-small text-[#EF4444] mt-2">
                  Error: {account.error_message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showJournalSelect && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6 max-w-md w-full mx-4">
            <h3 className="text-label-regular font-semibold text-white mb-4">
              Sync Trades to Journal
            </h3>
            <p className="text-label-small text-[#6B7280] mb-4">
              Select a journal and time period to sync trades from {selectedAccount.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-label-regular text-[#9CA3AF] mb-2">
                  Journal
                </label>
                <select
                  value={selectedJournal}
                  onChange={(e) => setSelectedJournal(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                >
                  {journals.map((journal) => (
                    <option key={journal.id} value={journal.id}>
                      {journal.name}
                    </option>
                  ))}
                </select>
                {journals.length === 0 && (
                  <p className="text-label-small text-[#EF4444] mt-1">
                    No journals found. Please create a journal first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-label-regular text-[#9CA3AF] mb-2">
                  Time Period (days)
                </label>
                <select
                  value={syncDays}
                  onChange={(e) => setSyncDays(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-[#1F2937] bg-[#000000] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                  <option value={365}>Last year</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={executeSync}
                disabled={syncing || journals.length === 0}
                className="flex-1 bg-primary-blue text-white px-6 py-3 rounded-lg text-button hover:bg-primary-blue-hover hover:shadow-button-primary transition-smooth disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Start Sync'}
              </button>
              <button
                onClick={() => setShowJournalSelect(false)}
                disabled={syncing}
                className="px-6 py-3 border border-gray-light dark:border-gray-600 text-white rounded-lg text-button hover:bg-gray-ultralight dark:hover:bg-gray-700 transition-smooth disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
