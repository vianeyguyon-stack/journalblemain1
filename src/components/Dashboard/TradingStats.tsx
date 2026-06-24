import React, { useMemo } from 'react';
import { Trade } from '../../lib/supabase';
import { TrendingUp, TrendingDown, BarChart2, Target, AlertTriangle } from 'lucide-react';

interface TradingStatsProps {
  trades: Trade[];
}

export const TradingStats: React.FC<TradingStatsProps> = ({ trades }) => {
  const stats = useMemo(() => {
    const closedTrades = trades.filter(
      (t) => t.close_time !== null && (t.type || '').toUpperCase() !== 'BALANCE'
    );
    const winningTrades = closedTrades.filter((t) => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.profit || 0) < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0));
    const netPnL = trades.reduce(
      (sum, t) => sum + (t.profit || 0) + (t.commission || 0) + (t.swap || 0),
      0
    );

    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;

    let maxDrawdown = 0;
    let peak = 0;
    let running = 0;
    const sorted = [...closedTrades].sort(
      (a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime()
    );
    for (const trade of sorted) {
      running += (trade.profit || 0);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      totalTrades: closedTrades.length,
      winRate,
      netPnL,
      profitFactor,
      avgWin,
      maxDrawdown,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }, [trades]);

  const BLUE = '#3B82F6';
  const RED = '#EF4444';

  const cards = [
    {
      label: 'Total P&L',
      value: `$${stats.netPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${stats.totalTrades} trades fermes`,
      icon: stats.netPnL >= 0 ? TrendingUp : TrendingDown,
      color: stats.netPnL >= 0 ? BLUE : RED,
      iconBg: stats.netPnL >= 0 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      sub: `${stats.winningTrades}W / ${stats.losingTrades}L`,
      icon: Target,
      color: stats.winRate >= 50 ? BLUE : RED,
      iconBg: 'rgba(59,130,246,0.12)',
    },
    {
      label: 'Profit Factor',
      value: stats.profitFactor > 99 ? '∞' : stats.profitFactor.toFixed(2),
      sub: `Avg Win: $${stats.avgWin.toFixed(2)}`,
      icon: BarChart2,
      color: stats.profitFactor >= 1 ? BLUE : RED,
      iconBg: 'rgba(59,130,246,0.12)',
    },
    {
      label: 'Max Drawdown',
      value: `$${stats.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Peak to trough',
      icon: AlertTriangle,
      color: RED,
      iconBg: 'rgba(239,68,68,0.12)',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-[#111111] rounded-card border border-[#1F2937] hover:border-[#3B82F6]/40 transition-smooth p-5"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                {card.label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.iconBg }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight leading-none mb-2" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="text-xs text-[#6B7280]">{card.sub}</p>
          </div>
        );
      })}
    </div>
  );
};
