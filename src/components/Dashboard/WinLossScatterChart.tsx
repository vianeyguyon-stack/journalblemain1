import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Trade } from '../../lib/supabase';

interface WinLossScatterChartProps {
  trades: Trade[];
}

interface ScatterPoint {
  x: number;
  y: number;
  symbol: string;
  profit: number;
  duration: number;
  label: string;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}j`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload as ScatterPoint;
  if (!d) return null;
  return (
    <div className="bg-[#111111] border border-[#1F2937] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">{d.symbol}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-[#6B7280]">P&L</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: d.profit >= 0 ? '#0078FF' : '#FF1414' }}>
            {d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-[#6B7280]">Duree</span>
          <span className="text-xs font-semibold text-white">{formatDuration(d.duration)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-[#6B7280]">Volume</span>
          <span className="text-xs font-semibold text-white">{d.x.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export const WinLossScatterChart: React.FC<WinLossScatterChartProps> = ({ trades }) => {
  const [view, setView] = useState<'volume' | 'duration'>('volume');

  const { winners, losers } = useMemo(() => {
    const closed = trades.filter(
      t => t.close_time && t.open_time && (t.type || '').toUpperCase() !== 'BALANCE'
    );

    const winners: ScatterPoint[] = [];
    const losers: ScatterPoint[] = [];

    closed.forEach((t) => {
      const profit = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
      const openMs = new Date(t.open_time!).getTime();
      const closeMs = new Date(t.close_time!).getTime();
      const duration = (closeMs - openMs) / 60000;
      const volume = t.volume || 0;

      const point: ScatterPoint = {
        x: view === 'volume' ? volume : duration,
        y: profit,
        symbol: t.symbol || '',
        profit,
        duration,
        label: t.symbol || '',
      };

      if (profit >= 0) winners.push(point);
      else losers.push(point);
    });

    return { winners, losers };
  }, [trades, view]);

  const allPoints = [...winners, ...losers];
  if (allPoints.length === 0) return null;

  const xMax = Math.max(...allPoints.map(p => p.x)) * 1.1;
  const yMin = Math.min(...allPoints.map(p => p.y)) * 1.15;
  const yMax = Math.max(...allPoints.map(p => p.y)) * 1.15;

  const xLabel = view === 'volume' ? 'Volume (lots)' : 'Duree (minutes)';

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
            Trades Gagnants vs Perdants
          </h3>
          <p className="text-xs text-[#4B5563] mt-0.5">
            {winners.length} gagnants &bull; {losers.length} perdants
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#000000] border border-[#1F2937] rounded-lg p-1">
          <button
            onClick={() => setView('volume')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'volume'
                ? 'bg-[#0078FF] text-white'
                : 'text-[#6B7280] hover:text-white'
            }`}
          >
            Volume
          </button>
          <button
            onClick={() => setView('duration')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'duration'
                ? 'bg-[#0078FF] text-white'
                : 'text-[#6B7280] hover:text-white'
            }`}
          >
            Duree
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, xMax]}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1F2937' }}
            label={{
              value: xLabel,
              position: 'insideBottom',
              offset: -20,
              fill: '#4B5563',
              fontSize: 11,
            }}
            tickFormatter={(v) => view === 'duration' ? formatDuration(v) : v.toFixed(2)}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[yMin, yMax]}
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1F2937' }}
            label={{
              value: 'P&L ($)',
              angle: -90,
              position: 'insideLeft',
              offset: -40,
              fill: '#4B5563',
              fontSize: 11,
            }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 4" strokeWidth={1.5} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#374151' }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#6B7280', paddingBottom: '8px' }}
          />
          <Scatter
            name="Gagnants"
            data={winners}
            fill="#0078FF"
            fillOpacity={0.75}
            stroke="#0078FF"
            strokeWidth={1}
            r={5}
          />
          <Scatter
            name="Perdants"
            data={losers}
            fill="#FF1414"
            fillOpacity={0.75}
            stroke="#FF1414"
            strokeWidth={1}
            r={5}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-[#1F2937] grid grid-cols-2 gap-4">
        <div className="bg-[#000000] rounded-lg p-3 border border-[#1F2937]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Gain moyen</p>
          <p className="text-sm font-bold" style={{ color: '#0078FF' }}>
            {winners.length > 0
              ? `+$${(winners.reduce((s, p) => s + p.profit, 0) / winners.length).toFixed(2)}`
              : '-'}
          </p>
        </div>
        <div className="bg-[#000000] rounded-lg p-3 border border-[#1F2937]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Perte moyenne</p>
          <p className="text-sm font-bold" style={{ color: '#FF1414' }}>
            {losers.length > 0
              ? `$${(losers.reduce((s, p) => s + p.profit, 0) / losers.length).toFixed(2)}`
              : '-'}
          </p>
        </div>
      </div>
    </div>
  );
};
