import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Trade, MTAccount } from '../../lib/supabase';
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
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { ChartTooltip, getTooltipStyles } from '../Dashboard/ChartTooltip';

interface AnalyticsProps {
  user: any;
}

export const Analytics: React.FC<AnalyticsProps> = ({ user }) => {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<MTAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
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

  const loadUserJournals = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('journal_members')
      .select('journal_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading user journals:', error);
    } else {
      const journalIds = (data || []).map(m => m.journal_id);
      setUserJournals(journalIds);
    }
  };

  const loadData = async () => {
    await Promise.all([loadTrades(), loadAccounts()]);
  };

  const loadTrades = async () => {
    try {
      if (userJournals.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .in('journal_id', userJournals)
        .order('open_time', { ascending: true });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
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
    }
  };

  const syncTradesFromMetaAPI = async () => {
    if (accounts.length === 0) return;

    setSyncing(true);
    const toastId = toast.loading(t.dashboard.syncing);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      for (const account of accounts) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enqueue-sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              accountId: account.id,
              operation: 'sync_trades'
            }),
          }
        );
      }

      toast.dismiss(toastId);
      toast.success(t.messages.syncSuccess);
      await loadTrades();
    } catch (error) {
      toast.error(t.messages.syncError);
      toast.dismiss(toastId);
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

  const analytics = useMemo(() => {
    const completedTrades = trades.filter((t) => t.close_time && (t.type || '').toUpperCase() !== 'BALANCE');

    if (completedTrades.length === 0) {
      return null;
    }

    const totalPnL = completedTrades.reduce(
      (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
      0
    );

    const winningTrades = completedTrades.filter(
      (t) => (t.profit || 0) + (t.commission || 0) + (t.swap || 0) > 0
    );
    const losingTrades = completedTrades.filter(
      (t) => (t.profit || 0) + (t.commission || 0) + (t.swap || 0) < 0
    );

    const winRate = (winningTrades.length / completedTrades.length) * 100;

    const avgWin =
      winningTrades.reduce((sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0), 0) /
      (winningTrades.length || 1);

    const avgLoss =
      Math.abs(
        losingTrades.reduce((sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0), 0)
      ) / (losingTrades.length || 1);

    const profitFactor =
      losingTrades.length > 0
        ? Math.abs(
            winningTrades.reduce(
              (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
              0
            ) /
              losingTrades.reduce(
                (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
                0
              )
          )
        : 0;

    let cumulativePnL = 0;
    let maxPnL = 0;
    let maxDrawdown = 0;

    const cumulativeData = completedTrades.map((trade) => {
      const pnl = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      cumulativePnL += pnl;

      if (cumulativePnL > maxPnL) {
        maxPnL = cumulativePnL;
      }

      const drawdown = maxPnL - cumulativePnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      return {
        date: new Date(trade.close_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: cumulativePnL,
        pnl: pnl,
      };
    });

    const symbolStats: Record<string, { profit: number; trades: number }> = {};
    completedTrades.forEach((trade) => {
      if (!symbolStats[trade.symbol]) {
        symbolStats[trade.symbol] = { profit: 0, trades: 0 };
      }
      symbolStats[trade.symbol].profit +=
        (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      symbolStats[trade.symbol].trades += 1;
    });

    const topSymbols = Object.entries(symbolStats)
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 10)
      .map(([symbol, stats]) => ({
        symbol,
        profit: stats.profit,
        trades: stats.trades,
      }));

    const dayOfWeekStats: Record<string, { profit: number; trades: number }> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    completedTrades.forEach((trade) => {
      const day = days[new Date(trade.open_time).getDay()];
      if (!dayOfWeekStats[day]) {
        dayOfWeekStats[day] = { profit: 0, trades: 0 };
      }
      dayOfWeekStats[day].profit +=
        (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      dayOfWeekStats[day].trades += 1;
    });

    const weekdayData = days
      .filter((day) => dayOfWeekStats[day])
      .map((day) => ({
        day: day.slice(0, 3),
        profit: dayOfWeekStats[day].profit,
        trades: dayOfWeekStats[day].trades,
      }));

    const longTrades = completedTrades.filter((t) => (t.type || '').toUpperCase() === 'BUY');
    const shortTrades = completedTrades.filter((t) => (t.type || '').toUpperCase() === 'SELL');

    const longPnL = longTrades.reduce(
      (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
      0
    );
    const shortPnL = shortTrades.reduce(
      (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
      0
    );

    const tradeTypeData = [
      { name: 'Long', value: longTrades.length, pnl: longPnL },
      { name: 'Short', value: shortTrades.length, pnl: shortPnL },
    ];

    return {
      totalTrades: completedTrades.length,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      cumulativeData,
      topSymbols,
      weekdayData,
      tradeTypeData,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }, [trades]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-light dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#1E40AF'];

  const CumulativeTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const pnl = payload[0].payload.pnl;
      return (
        <ChartTooltip
          title={payload[0].payload.date}
          items={[
            {
              label: 'Trade P&L',
              value: `$${pnl.toFixed(2)}`,
              color: pnl >= 0 ? '#1E40AF' : '#EF4444'
            },
            {
              label: 'Cumulatif',
              value: `$${value.toFixed(2)}`,
              color: value >= 0 ? '#1E40AF' : '#EF4444'
            }
          ]}
        />
      );
    }
    return null;
  };

  const SymbolTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <ChartTooltip
          title={data.symbol}
          items={[
            {
              label: 'Profit',
              value: `$${data.profit.toFixed(2)}`,
              color: data.profit >= 0 ? '#1E40AF' : '#EF4444'
            },
            {
              label: 'Trades',
              value: data.trades,
              color: '#FFFFFF'
            }
          ]}
        />
      );
    }
    return null;
  };

  const WeekdayTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <ChartTooltip
          title={data.day}
          items={[
            {
              label: 'P&L',
              value: `$${data.profit.toFixed(2)}`,
              color: data.profit >= 0 ? '#1E40AF' : '#EF4444'
            },
            {
              label: 'Trades',
              value: data.trades,
              color: '#FFFFFF'
            }
          ]}
        />
      );
    }
    return null;
  };

  const TradeDirectionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <ChartTooltip
          title={data.name}
          items={[
            {
              label: 'Trades',
              value: data.value,
              color: '#FFFFFF'
            },
            {
              label: 'P&L',
              value: `$${data.pnl.toFixed(2)}`,
              color: data.pnl >= 0 ? '#1E40AF' : '#EF4444'
            }
          ]}
        />
      );
    }
    return null;
  };

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
                <p className="text-[10px] text-[#6B7280] hidden lg:block">{t.app.tagline}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
                className="p-1.5 text-[#9CA3AF] hover:text-white transition-fast rounded-lg hover:bg-white/5"
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                onClick={handleLogout}
                className="p-1.5 text-[#9CA3AF] hover:text-[#EF4444] transition-fast rounded-lg hover:bg-[#EF4444]/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'overview') {
                      navigate('/dashboard');
                    } else if (tab.id === 'analytics') {
                      return;
                    } else {
                      navigate('/dashboard');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-smooth text-xs font-medium whitespace-nowrap ${
                    tab.id === 'analytics'
                      ? 'border-primary-blue text-primary-blue'
                      : 'border-transparent text-[#6B7280] hover:text-white hover:border-white/20'
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
        {!analytics ? (
          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-12 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <div className="w-16 h-16 bg-[#1F2937] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-[#374151]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
            <p className="text-sm text-[#6B7280]">
              Start trading or import your trades to see analytics
            </p>
          </div>
        ) : (
          <div className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                Total P&L
              </span>
              <div className={`p-2 rounded-lg ${analytics.totalPnL >= 0 ? 'bg-[#3B82F6] bg-opacity-10' : 'bg-[#EF4444] bg-opacity-10'}`}>
                <TrendingUp className={`w-5 h-5 ${analytics.totalPnL >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`} />
              </div>
            </div>
            <p
              className={`text-2xl font-bold mb-2${
                analytics.totalPnL >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'
              }`}
            >
              ${analytics.totalPnL.toFixed(2)}
            </p>
            <p className="text-xs text-[#6B7280]">
              {analytics.totalTrades} total trades
            </p>
          </div>

          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                Win Rate
              </span>
              <div className="p-2 rounded-lg bg-primary-blue bg-opacity-10">
                <Activity className="w-5 h-5 text-primary-blue" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {analytics.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-[#6B7280]">
              {analytics.winningTrades}W / {analytics.losingTrades}L
            </p>
          </div>

          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                Profit Factor
              </span>
              <div className="p-2 rounded-lg bg-primary-blue bg-opacity-10">
                <BarChart3 className="w-5 h-5 text-primary-blue" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {analytics.profitFactor.toFixed(2)}
            </p>
            <p className="text-xs text-[#6B7280]">
              Avg Win: ${analytics.avgWin.toFixed(2)}
            </p>
          </div>

          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                Max Drawdown
              </span>
              <div className="p-2 rounded-lg bg-[#EF4444] bg-opacity-10">
                <TrendingDown className="w-5 h-5 text-[#EF4444]" />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#EF4444] mb-2">
              ${analytics.maxDrawdown.toFixed(2)}
            </p>
            <p className="text-xs text-[#6B7280]">
              Avg Loss: ${analytics.avgLoss.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
          <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
            Cumulative Performance
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={analytics.cumulativeData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#111111" opacity={1} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 11 }}
                stroke="#1F2937"
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 11 }}
                stroke="#1F2937"
              />
              <Tooltip
                content={<CumulativeTooltip />}
                wrapperStyle={getTooltipStyles()}
                cursor={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
              Top Performing Symbols
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topSymbols} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#111111" opacity={1} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} stroke="#1F2937" />
                <YAxis
                  dataKey="symbol"
                  type="category"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  stroke="#1F2937"
                  width={80}
                />
                <Tooltip
                  content={<SymbolTooltip />}
                  wrapperStyle={getTooltipStyles()}
                  cursor={false}
                />
                <Bar dataKey="profit" radius={[0, 8, 8, 0]}>
                  {analytics.topSymbols.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? '#1E40AF' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
              Performance by Day
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111111" opacity={1} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  stroke="#1F2937"
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  stroke="#1F2937"
                />
                <Tooltip
                  content={<WeekdayTooltip />}
                  wrapperStyle={getTooltipStyles()}
                  cursor={false}
                />
                <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                  {analytics.weekdayData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? '#3B82F6' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
              Trade Direction Distribution
            </h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie
                    data={analytics.tradeTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {analytics.tradeTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<TradeDirectionTooltip />}
                    wrapperStyle={getTooltipStyles()}
                    cursor={false}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              {analytics.tradeTypeData.map((entry, index) => (
                <div
                  key={entry.name}
                  className="bg-[#000000] rounded-lg p-4 border border-[#1F2937]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index] }}
                    ></div>
                    <span className="text-xs text-[#6B7280] uppercase tracking-wider">
                      {entry.name}
                    </span>
                  </div>
                  <p className="text-stat-small text-white font-bold mb-1">
                    {entry.value} <span className="text-label-small font-normal">trades</span>
                  </p>
                  <p
                    className={`text-label-regular font-semibold ${
                      entry.pnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'
                    }`}
                  >
                    ${entry.pnl.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
              Win/Loss Distribution
            </h3>
            <div className="space-y-6">
              <div className="bg-[#000000] rounded-lg p-4 border border-[#1F2937]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label-regular text-white font-semibold">
                    Winning Trades
                  </span>
                  <span className="text-label-regular text-[#3B82F6] font-bold">
                    {analytics.winningTrades} ({analytics.winRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-[#1F2937] rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-[#3B82F6] h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${analytics.winRate}%` }}
                  >
                    {analytics.winRate > 15 && (
                      <span className="text-xs font-bold text-white">{analytics.winRate.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#000000] rounded-lg p-4 border border-[#1F2937]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label-regular text-white font-semibold">
                    Losing Trades
                  </span>
                  <span className="text-label-regular text-[#EF4444] font-bold">
                    {analytics.losingTrades} ({(100 - analytics.winRate).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-[#1F2937] rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-rose-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${100 - analytics.winRate}%` }}
                  >
                    {(100 - analytics.winRate) > 15 && (
                      <span className="text-xs font-bold text-white">{(100 - analytics.winRate).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1F2937]">
                <div className="bg-[#3B82F6]/10 rounded-lg p-3 border border-blue-500/20">
                  <p className="text-xs text-[#6B7280] mb-1">
                    Average Win
                  </p>
                  <p className="text-stat-small text-[#3B82F6] font-bold">
                    ${analytics.avgWin.toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <p className="text-xs text-[#6B7280] mb-1">
                    Average Loss
                  </p>
                  <p className="text-stat-small text-[#EF4444] font-bold">
                    ${analytics.avgLoss.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-label-regular text-white font-semibold">
                    Risk/Reward Ratio
                  </span>
                  <span className="text-stat-small text-primary-blue font-bold">
                    {(analytics.avgWin / analytics.avgLoss).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
          </div>
        )}
      </main>
    </div>
  );
};
