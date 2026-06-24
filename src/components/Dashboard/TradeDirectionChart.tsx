import React, { useMemo } from 'react';
import { Trade } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip, getTooltipStyles } from './ChartTooltip';

interface TradeDirectionChartProps {
  trades: Trade[];
}

export const TradeDirectionChart: React.FC<TradeDirectionChartProps> = ({ trades }) => {
  const { t } = useI18n();

  const tradeTypeData = useMemo(() => {
    const completedTrades = trades.filter((t) => t.close_time && (t.type || '').toUpperCase() !== 'BALANCE');

    const longTrades = completedTrades.filter((t) => (t.type || '').toUpperCase() === 'BUY');
    const shortTrades = completedTrades.filter((t) => (t.type || '').toUpperCase() === 'SELL');

    const longPnl = longTrades.reduce((sum, t) => sum + t.profit, 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + t.profit, 0);

    return [
      { name: 'Long', value: longTrades.length, pnl: longPnl },
      { name: 'Short', value: shortTrades.length, pnl: shortPnl },
    ];
  }, [trades]);

  const COLORS = ['#3B82F6', '#1E40AF'];

  const CustomTooltip = ({ active, payload }: any) => {
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

  if (tradeTypeData[0].value === 0 && tradeTypeData[1].value === 0) {
    return (
      <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
        <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
          {t.analytics?.tradeDirection || 'Trade Direction'}
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-medium dark:text-gray-400">
          No completed trades yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6">
      <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">
        {t.analytics?.tradeDirection || 'Trade Direction'}
      </h3>
      <div className="flex items-center justify-center">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={tradeTypeData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={false}
            >
              {tradeTypeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={<CustomTooltip />}
              wrapperStyle={getTooltipStyles()}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-6">
        {tradeTypeData.map((entry, index) => (
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
            <p className="text-lg font-bold text-white mb-1">
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
  );
};
