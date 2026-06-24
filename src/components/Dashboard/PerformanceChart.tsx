import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trade } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { ChartTooltip, getTooltipStyles } from './ChartTooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ViewMode = 'day' | 'week' | 'month';

interface PerformanceChartProps {
  trades: Trade[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameWeek(a: Date, b: Date): boolean {
  return isSameDay(startOfWeek(a), startOfWeek(b));
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const PAGE_SIZES: Record<ViewMode, number> = { day: 14, week: 12, month: 12 };

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ trades }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const today = startOfDay(new Date());
  const pageSize = PAGE_SIZES[viewMode];

  const tradePnLByDay = useMemo(() => {
    const map: Record<string, number> = {};
    trades
      .filter((t) => t.close_time !== null && (t.type || '').toUpperCase() !== 'BALANCE')
      .forEach((trade) => {
        const d = startOfDay(new Date(trade.open_time));
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        map[key] = (map[key] || 0) + (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      });
    return map;
  }, [trades]);

  const chartData = useMemo(() => {
    return Array.from({ length: pageSize }, (_, i) => {
      const offset = i - Math.floor(pageSize / 2);

      if (viewMode === 'day') {
        const d = addDays(anchor, offset);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const hasData = key in tradePnLByDay;
        const isFuture = d > today;
        return {
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: hasData && !isFuture ? tradePnLByDay[key] : 0,
          hasData: hasData && !isFuture,
          isFuture,
          isToday: isSameDay(d, today),
        };
      }

      if (viewMode === 'week') {
        const weekStart = addWeeks(startOfWeek(anchor), offset);
        const weekEnd = addDays(weekStart, 6);
        let total = 0;
        let hasData = false;
        const isFuture = weekStart > today;
        if (!isFuture) {
          for (let di = 0; di < 7; di++) {
            const d = addDays(weekStart, di);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (key in tradePnLByDay) {
              total += tradePnLByDay[key];
              hasData = true;
            }
          }
        }
        return {
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sublabel: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: hasData ? total : 0,
          hasData,
          isFuture,
          isToday: isSameWeek(weekStart, today),
        };
      }

      // month
      const d = addMonths(startOfMonth(anchor), offset);
      const isFuture = d > today;
      let total = 0;
      let hasData = false;
      if (!isFuture) {
        Object.entries(tradePnLByDay).forEach(([key, val]) => {
          const [yr, mo] = key.split('-').map(Number);
          if (yr === d.getFullYear() && mo === d.getMonth()) {
            total += val;
            hasData = true;
          }
        });
      }
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: hasData ? total : 0,
        hasData,
        isFuture,
        isToday: isSameMonth(d, today),
      };
    });
  }, [viewMode, anchor, tradePnLByDay, today, pageSize]);

  const totalPnL = chartData.filter((d) => !d.isFuture && d.hasData).reduce((sum, item) => sum + item.value, 0);

  const isAtPresent = useMemo(() => {
    if (viewMode === 'day') return isSameDay(anchor, today);
    if (viewMode === 'week') return isSameWeek(anchor, today);
    return isSameMonth(anchor, today);
  }, [viewMode, anchor, today]);

  const periodLabel = useMemo(() => {
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    if (!first || !last) return '';
    if (viewMode === 'week') {
      return `${first.label} – ${last.sublabel || last.label}`;
    }
    return `${first.label} – ${last.label}`;
  }, [chartData, viewMode]);

  const goBack = () => {
    if (viewMode === 'day') setAnchor(d => addDays(d, -1));
    else if (viewMode === 'week') setAnchor(d => addWeeks(d, -1));
    else setAnchor(d => addMonths(d, -1));
  };

  const goForward = () => {
    if (isAtPresent) return;
    if (viewMode === 'day') setAnchor(d => addDays(d, 1));
    else if (viewMode === 'week') setAnchor(d => addWeeks(d, 1));
    else setAnchor(d => addMonths(d, 1));
  };

  const goToToday = () => {
    if (viewMode === 'day') setAnchor(today);
    else if (viewMode === 'week') setAnchor(startOfWeek(today));
    else setAnchor(startOfMonth(today));
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'day') setAnchor(today);
    else if (mode === 'week') setAnchor(startOfWeek(today));
    else setAnchor(startOfMonth(today));
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      if (entry.isFuture) return null;
      const value = payload[0].value;
      const title = entry.sublabel ? `${entry.label} – ${entry.sublabel}` : entry.label;
      return (
        <ChartTooltip
          title={title}
          items={[
            {
              label: entry.hasData ? (value >= 0 ? 'Profit' : 'Loss') : 'No trades',
              value: entry.hasData ? `$${value.toFixed(2)}` : '–',
              color: value >= 0 ? '#1E40AF' : '#EF4444',
            },
          ]}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
          Performance
        </h3>
        <div className="text-right">
          <p className="text-xs text-[#6B7280]">Period Total</p>
          <p className={`text-base font-bold ${totalPnL >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden bg-[#000000] border border-[#1F2937]">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-fast capitalize ${
                  viewMode === mode
                    ? 'bg-primary-blue text-white'
                    : 'bg-transparent text-[#6B7280] hover:text-white'
                }`}
              >
                {mode === 'day' ? 'Day' : mode === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          {!isAtPresent && (
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs text-primary-blue border border-primary-blue/40 rounded-lg hover:bg-primary-blue/10 transition-fast"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280] hidden sm:block">{periodLabel}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#1F2937] transition-fast"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goForward}
              disabled={isAtPresent}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#1F2937] disabled:opacity-30 disabled:cursor-not-allowed transition-fast"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          <span className="text-xs text-[#6B7280]">Profit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
          <span className="text-xs text-[#6B7280]">Loss</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1F2937]"></div>
          <span className="text-xs text-[#6B7280]">No trades</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
          />
          <ReferenceLine y={0} stroke="#1F2937" strokeWidth={1} />
          <Tooltip
            cursor={false}
            content={<CustomTooltip />}
            wrapperStyle={getTooltipStyles()}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {chartData.map((entry, index) => {
              let fill: string;
              if (entry.isFuture) fill = 'transparent';
              else if (!entry.hasData) fill = '#1F2937';
              else if (entry.value >= 0) fill = '#3B82F6';
              else fill = '#F43F5E';
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <button
        onClick={() => navigate('/analytics')}
        className="w-full mt-4 text-label-small text-primary-blue hover:text-primary-blue-hover font-medium transition-fast"
      >
        View more →
      </button>
    </div>
  );
};
