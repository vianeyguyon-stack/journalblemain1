import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Trade, JournalEntry, MTAccount } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  RefreshCw,
  Globe,
  Activity,
} from 'lucide-react';
import { TradingStats } from './TradingStats';
import { TradesTable } from './TradesTable';
import { JournalList } from './JournalList';
import { MTAccountsManager } from './MTAccountsManager';
import { TradeCalendar } from './TradeCalendar';
import { PerformanceFactors } from './PerformanceFactors';
import { BubbleDistribution } from './BubbleDistribution';
import { TradeDirectionChart } from './TradeDirectionChart';
import { InteractiveProfitLossChart } from './InteractiveProfitLossChart';
import { WinLossScatterChart } from './WinLossScatterChart';

interface DashboardProps {
  user: any;
}

type TabType = 'overview' | 'trades' | 'journal' | 'analytics' | 'accounts';

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<MTAccount[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
  const [openPositions, setOpenPositions] = useState<Trade[]>([]);
  const [userJournals, setUserJournals] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadUserJournals();
    }
  }, [user?.id]);

  useEffect(() => {
    if (userJournals.length > 0) {
      loadData();
    }
  }, [userJournals]);

  useEffect(() => {
    if (accounts.length > 0) {
      loadOpenPositions();
    }
  }, [accounts]);

  const loadUserJournals = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('journal_members')
      .select('journal_id')
      .eq('user_id', user.id);
    if (error) {
      console.error('Error loading user journals:', error);
    } else {
      setUserJournals((data || []).map(m => m.journal_id));
    }
  };

  const loadData = async () => {
    await Promise.all([loadTrades(), loadJournalEntries(), loadAccounts()]);
  };

  const loadTrades = async () => {
    if (userJournals.length === 0) return;
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .in('journal_id', userJournals)
      .order('open_time', { ascending: false });
    if (error) {
      toast.error(t.messages.syncError);
    } else {
      setTrades(data || []);
    }
  };

  const loadJournalEntries = async () => {
    if (userJournals.length === 0) return;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .in('journal_id', userJournals)
      .order('entry_date', { ascending: false });
    if (error) {
      toast.error(t.common.error);
    } else {
      setJournalEntries(data || []);
    }
  };

  const loadAccounts = async () => {
    if (userJournals.length === 0) return;
    const { data, error } = await supabase
      .from('mt_accounts')
      .select('*')
      .in('journal_id', userJournals)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(t.common.error);
    } else {
      setAccounts(data || []);
      await loadAccountBalances(data || []);
    }
  };

  const loadAccountBalances = async (_accountsList: MTAccount[]) => {
    setTotalBalance(0);
    setTotalEquity(0);
  };

  const loadOpenPositions = async () => {
    setOpenPositions([]);
  };

  const syncTradesFromMetaAPI = async () => {
    if (accounts.length === 0) return;
    setSyncing(true);
    const toastId = toast.loading(t.dashboard.syncing);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      for (const account of accounts) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enqueue-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accountId: account.id, operation: 'sync_trades' }),
        });
      }
      toast.dismiss(toastId);
      toast.success(t.messages.syncSuccess);
      await loadTrades();
    } catch (error: any) {
      toast.error(error.message || t.messages.syncError, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const tabs = [
    { id: 'overview', label: t.nav.overview, icon: LayoutDashboard },
    { id: 'trades', label: t.nav.trades, icon: Activity },
    { id: 'journal', label: t.nav.journal, icon: BookOpen },
    { id: 'analytics', label: t.nav.analytics, icon: BarChart3 },
    { id: 'accounts', label: t.nav.accounts, icon: Settings },
  ];

  const allTrades = [...trades, ...openPositions];

  return (
    <div className="min-h-screen bg-black bg-grid">
      <header className="bg-black/95 backdrop-blur-md border-b border-[#1F2937] fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-blue rounded-lg flex items-center justify-center shadow-glow-blue">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">{t.app.title}</h1>
                <p className="text-[10px] text-text-secondary hidden lg:block">{t.app.tagline}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {totalBalance > 0 && (
                <div className="hidden md:flex items-center gap-4 text-xs">
                  <div className="flex flex-col items-end">
                    <span className="text-text-muted uppercase text-[10px] tracking-wider">{t.dashboard.balance}</span>
                    <span className="text-sm font-semibold text-white">${totalBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-text-muted uppercase text-[10px] tracking-wider">{t.dashboard.equity}</span>
                    <span className="text-sm font-semibold text-white">${totalEquity.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={syncTradesFromMetaAPI}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue text-white rounded-lg text-xs font-semibold hover:bg-primary-blue-hover transition-smooth disabled:opacity-40 shadow-button-primary"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncing ? t.dashboard.syncing : t.dashboard.sync}</span>
              </button>

              <button
                onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                className="p-1.5 text-text-secondary hover:text-white transition-fast rounded-lg hover:bg-white/5"
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="p-1.5 text-text-secondary hover:text-[#EF4444] transition-fast rounded-lg hover:bg-[#EF4444]/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'analytics') {
                      navigate('/analytics');
                    } else {
                      setActiveTab(tab.id as TabType);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-smooth text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? 'border-primary-blue text-primary-blue'
                      : 'border-transparent text-text-secondary hover:text-white hover:border-white/20'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">
                {t.nav.overview}
              </h2>
              <p className="text-text-secondary text-sm mt-0.5">{t.app.tagline}</p>
            </div>
            <TradingStats trades={allTrades} />
            <InteractiveProfitLossChart trades={allTrades} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <TradeCalendar trades={allTrades} />
              <BubbleDistribution trades={allTrades} />
            </div>
            <WinLossScatterChart trades={allTrades} />
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">{t.nav.trades}</h2>
              <p className="text-text-secondary text-sm mt-0.5">Historique de vos transactions</p>
            </div>
            <TradesTable trades={allTrades} onTradesChange={loadTrades} />
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">{t.nav.journal}</h2>
              <p className="text-text-secondary text-sm mt-0.5">Vos notes et analyses de trading</p>
            </div>
            <JournalList entries={journalEntries} onEntriesChange={loadJournalEntries} />
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white">{t.nav.accounts}</h2>
              <p className="text-text-secondary text-sm mt-0.5">Gestion de vos comptes MetaTrader</p>
            </div>
            <MTAccountsManager accounts={accounts} onAccountsChange={loadAccounts} userJournals={userJournals} />
          </div>
        )}
      </main>
    </div>
  );
};
