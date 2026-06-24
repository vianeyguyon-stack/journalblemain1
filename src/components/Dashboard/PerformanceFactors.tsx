import React, { useMemo } from 'react';
import { Trade } from '../../lib/supabase';

interface PerformanceFactorsProps {
  trades: Trade[];
}

export const PerformanceFactors: React.FC<PerformanceFactorsProps> = ({ trades }) => {
  const stats = useMemo(() => {
    const closedTrades = trades.filter(
      (t) => t.close_time !== null && (t.type || '').toUpperCase() !== 'BALANCE'
    );
    const winningTrades = closedTrades.filter((t) => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.profit || 0) < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 5.0 : 0;
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 3.0 : 0;
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    return {
      profitFactor: Math.min(profitFactor, 5.0),
      riskReward: Math.min(riskReward, 5.0),
      winRate,
    };
  }, [trades]);

  const pfColor = stats.profitFactor >= 1 ? '#3B82F6' : '#F43F5E';
  const rrColor = stats.riskReward >= 1 ? '#3B82F6' : '#F43F5E';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-3">Profit Factor</p>
        <p className="text-5xl leading-none font-bold tracking-tight mb-2" style={{ color: pfColor }}>
          {stats.profitFactor.toFixed(1)}
        </p>
        <p className="text-xs text-[#6B7280]">Profit / Loss Ratio</p>
      </div>

      <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-3">Risk / Reward</p>
        <p className="text-5xl leading-none font-bold tracking-tight mb-2" style={{ color: rrColor }}>
          {stats.riskReward.toFixed(1)}
        </p>
        <p className="text-xs text-[#6B7280]">Average Win vs Loss</p>
      </div>
    </div>
  );
};
