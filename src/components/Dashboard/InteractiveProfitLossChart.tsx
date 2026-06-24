import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import { ChartTooltip, getTooltipStyles } from './ChartTooltip';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface InteractiveProfitLossChartProps {
  trades: Trade[];
}

type ChartType = 'profit' | 'loss' | 'both';
type PeriodType = 'day' | 'month' | 'year';

const chartConfig = {
  profit: { label: 'Profit', color: '#1E40AF' },
  loss: { label: 'Loss', color: '#EF4444' },
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, 0, 1);
}

export const InteractiveProfitLossChart: React.FC<InteractiveProfitLossChartProps> = ({ trades }) => {
  const { t } = useI18n();
  const [activeChart, setActiveChart] = useState<ChartType>('profit');
  const [period, setPeriod] = useState<PeriodType>('month');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const today = startOfDay(new Date());

  const isAtPresent = useMemo(() => {
    if (period === 'day') return isSameDay(anchor, today);
    if (period === 'month') return isSameMonth(anchor, today);
    return anchor.getFullYear() === today.getFullYear();
  }, [period, anchor, today]);

  const goBack = () => {
    if (period === 'day') setAnchor(d => addDays(d, -1));
    else if (period === 'month') setAnchor(d => addDays(d, -1));
    else setAnchor(d => addMonths(d, -1));
  };

  const goForward = () => {
    if (period === 'day') setAnchor(d => addDays(d, 1));
    else if (period === 'month') setAnchor(d => addDays(d, 1));
    else setAnchor(d => addMonths(d, 1));
  };

  const goToToday = () => setAnchor(today);

  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p);
    setAnchor(today);
  };

  const anchorLabel = useMemo(() => {
    if (period === 'day') {
      return anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (period === 'month') {
      return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return anchor.getFullYear().toString();
  }, [period, anchor]);

  const chartData = useMemo(() => {
    const completedTrades = trades
      .filter((t) => t.close_time && (t.type || '').toUpperCase() !== 'BALANCE')
      .sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());

    if (period === 'day') {
      const hours: Record<number, { profit: number; loss: number; date: string }> = {};
      for (let h = 0; h < 24; h++) {
        hours[h] = { profit: 0, loss: 0, date: `${String(h).padStart(2, '0')}:00` };
      }
      completedTrades.forEach((trade) => {
        const exitDate = new Date(trade.close_time!);
        if (isSameDay(exitDate, anchor)) {
          const h = exitDate.getHours();
          const pnl = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
          if (pnl > 0) hours[h].profit += pnl;
          else hours[h].loss += Math.abs(pnl);
        }
      });
      return Object.values(hours);
    }

    if (period === 'month') {
      const startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const dailyData: Record<string, { profit: number; loss: number; date: string; fullDate: Date }> = {};
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyData[dateKey] = { profit: 0, loss: 0, date: dateKey, fullDate: new Date(d) };
      }
      completedTrades.forEach((trade) => {
        const exitDate = new Date(trade.close_time!);
        const dateKey = exitDate.toISOString().split('T')[0];
        if (dailyData[dateKey]) {
          const pnl = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
          if (pnl > 0) dailyData[dateKey].profit += pnl;
          else dailyData[dateKey].loss += Math.abs(pnl);
        }
      });
      return Object.values(dailyData).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    }

    // year — barres par mois
    const year = anchor.getFullYear();
    const monthlyData: Record<number, { profit: number; loss: number; date: string; fullDate: Date }> = {};
    for (let m = 0; m < 12; m++) {
      monthlyData[m] = {
        profit: 0,
        loss: 0,
        date: new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' }),
        fullDate: new Date(year, m, 1),
      };
    }
    completedTrades.forEach((trade) => {
      const exitDate = new Date(trade.close_time!);
      if (exitDate.getFullYear() === year) {
        const m = exitDate.getMonth();
        const pnl = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
        if (pnl > 0) monthlyData[m].profit += pnl;
        else monthlyData[m].loss += Math.abs(pnl);
      }
    });
    return Object.values(monthlyData);
  }, [trades, period, anchor]);

  const total = useMemo(() => {
    return chartData.reduce(
      (acc, curr) => ({ profit: acc.profit + curr.profit, loss: acc.loss + curr.loss }),
      { profit: 0, loss: 0 }
    );
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      let dateLabel = '';
      if (period === 'day') {
        dateLabel = payload[0].payload.date;
      } else if (period === 'year') {
        dateLabel = payload[0].payload.date;
      } else {
        dateLabel = new Date(payload[0].payload.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (activeChart === 'both') {
        const profitValue = payload.find((p: any) => p.dataKey === 'profit')?.value || 0;
        const lossValue = payload.find((p: any) => p.dataKey === 'loss')?.value || 0;
        return (
          <ChartTooltip
            title={dateLabel}
            items={[
              { label: 'Profit', value: `$${profitValue.toFixed(2)}`, color: chartConfig.profit.color },
              { label: 'Loss', value: `$${lossValue.toFixed(2)}`, color: chartConfig.loss.color },
            ]}
          />
        );
      }
      const value = payload[0].value || 0;
      return (
        <ChartTooltip
          title={dateLabel}
          items={[
            { label: chartConfig[activeChart].label, value: `$${value.toFixed(2)}`, color: chartConfig[activeChart].color },
          ]}
        />
      );
    }
    return null;
  };

  const xAxisTickFormatter = (value: string) => {
    if (period === 'day') {
      const hour = parseInt(value);
      if (hour % 6 === 0) return `${String(hour).padStart(2, '0')}h`;
      return '';
    }
    if (period === 'year') return value;
    const date = new Date(value);
    const day = date.getDate();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (day === 1 || day === 7 || day === 14 || day === 21 || day === 28 || day === lastDay) return day.toString();
    return '';
  };

  const periodLabels: Record<PeriodType, string> = { day: 'Day', month: 'Month', year: 'Year' };
  const navLabels: Record<PeriodType, string> = {
    day: 'day by day',
    month: 'day by day',
    year: 'month by month',
  };

  return (
    <div className="bg-[#111111] rounded-2xl border border-[#3B82F6]/50 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div className="flex flex-col border-b border-[#1F2937] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Performance Chart
            </h3>
          </div>
          <div className="flex gap-1 bg-[#000000] rounded-lg p-1 border border-[#1F2937]">
            {(['day', 'month', 'year'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                  period === p
                    ? 'bg-primary-blue text-white font-medium shadow-sm'
                    : 'text-[#6B7280] hover:text-white'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goBack}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#1F2937] transition-fast"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-tight">
              {anchorLabel}
            </span>
            {!isAtPresent && (
              <button
                onClick={goToToday}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-primary-blue border border-primary-blue/40 rounded-lg hover:bg-primary-blue/10 transition-fast font-medium"
              >
                <Calendar className="w-3 h-3" />
                Now
              </button>
            )}
          </div>

          <button
            onClick={goForward}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#1F2937] transition-fast"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex gap-2">
            {(['profit', 'loss', 'both'] as ChartType[]).map((chart) => (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="data-[active=true]:bg-[#000000] data-[active=true]:border-[#3B82F6]/50 flex flex-col justify-center gap-1 px-4 py-2 text-left border border-[#1F2937] rounded-lg transition-all hover:bg-[#000000] hover:border-[#374151]"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-xs text-[#6B7280] font-medium">
                  {chart === 'both' ? 'Both' : chartConfig[chart].label}
                </span>
                {chart !== 'both' && (
                  <span
                    className={`text-base leading-none font-bold tabular-nums ${
                      chart === 'profit' ? 'text-blue-400' : 'text-rose-400'
                    }`}
                  >
                    {chart === 'profit' ? '+' : ''}${total[chart].toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
                {chart === 'both' && (
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="text-blue-400">
                      +${total.profit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-rose-400">
                      ${total.loss.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-2 sm:p-6">
        <ResponsiveContainer width="100%" height={380} className="aspect-auto">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} stroke="#111111" opacity={1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={period === 'day' ? 0 : 'preserveStartEnd'}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              tickFormatter={xAxisTickFormatter}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              wrapperStyle={getTooltipStyles()}
            />
            {activeChart === 'both' ? (
              <>
                <Bar dataKey="profit" fill={chartConfig.profit.color} radius={[4, 4, 0, 0]} maxBarSize={period === 'year' ? 4 : 8} />
                <Bar dataKey="loss" fill={chartConfig.loss.color} radius={[4, 4, 0, 0]} maxBarSize={period === 'year' ? 4 : 8} />
              </>
            ) : (
              <Bar
                dataKey={activeChart}
                fill={chartConfig[activeChart].color}
                radius={[4, 4, 0, 0]}
                maxBarSize={period === 'year' ? 6 : period === 'day' ? 20 : 12}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
