import React, { useMemo, useState } from 'react';
import { Trade } from '../../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TradeCalendarProps {
  trades: Trade[];
}

interface DayData {
  date: Date;
  pnl: number;
  tradeCount: number;
  trades: Trade[];
}

export const TradeCalendar: React.FC<TradeCalendarProps> = ({ trades }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  const closedTrades = useMemo(() =>
    trades.filter(t => t.close_time && (t.type || '').toUpperCase() !== 'BALANCE'),
    [trades]
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; trades: Trade[] }>();
    for (const trade of closedTrades) {
      const d = new Date(trade.close_time!);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = map.get(key) || { pnl: 0, count: 0, trades: [] };
      existing.pnl += (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      existing.count += 1;
      existing.trades.push(trade);
      map.set(key, existing);
    }
    return map;
  }, [closedTrades]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDow = firstDay.getDay();
    const days: (DayData | null)[] = [];

    for (let i = 0; i < startDow; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const key = `${year}-${month}-${d}`;
      const data = dayMap.get(key);
      days.push({
        date,
        pnl: data?.pnl ?? 0,
        tradeCount: data?.count ?? 0,
        trades: data?.trades ?? [],
      });
    }

    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth, dayMap]);

  const monthLabel = currentMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const today = new Date();

  const goBack = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goForward = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const monthStats = useMemo(() => {
    const monthDays = calendarDays.filter((d): d is DayData => d !== null && d.tradeCount > 0);
    const totalPnl = monthDays.reduce((sum, d) => sum + d.pnl, 0);
    const winDays = monthDays.filter(d => d.pnl > 0).length;
    const lossDays = monthDays.filter(d => d.pnl < 0).length;
    return { totalPnl, winDays, lossDays, tradingDays: monthDays.length };
  }, [calendarDays]);

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">Calendrier</h3>
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="p-1 text-[#6B7280] hover:text-white hover:bg-[#1F2937] rounded-lg transition-fast">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-white capitalize min-w-[110px] text-center">{monthLabel}</span>
          <button onClick={goForward} className="p-1 text-[#6B7280] hover:text-white hover:bg-[#1F2937] rounded-lg transition-fast">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-[#000000] rounded-lg p-2.5 border border-[#1F2937]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">P&L du mois</p>
          <p className="text-sm font-bold" style={{ color: monthStats.totalPnl >= 0 ? '#3B82F6' : '#EF4444' }}>
            {monthStats.totalPnl >= 0 ? '+' : ''}${monthStats.totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="flex-1 bg-[#000000] rounded-lg p-2.5 border border-[#1F2937]">
          <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">Jours +/-</p>
          <p className="text-sm font-bold">
            <span className="text-[#3B82F6]">{monthStats.winDays}W</span>
            <span className="text-[#6B7280] mx-1">/</span>
            <span className="text-[#EF4444]">{monthStats.lossDays}L</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-[#6B7280] uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[#1F2937] rounded-lg overflow-hidden">
        {calendarDays.map((day, i) => {
          if (!day) {
            return <div key={i} className="bg-[#000000] aspect-square" />;
          }

          const hasTrades = day.tradeCount > 0;
          const isPos = day.pnl > 0;
          const isNeg = day.pnl < 0;
          const isSelected = selectedDay?.date.toDateString() === day.date.toDateString();

          let bgColor = '#000000';
          if (hasTrades && isPos) bgColor = 'rgba(0,120,255,0.45)';
          if (hasTrades && isNeg) bgColor = 'rgba(255,20,20,0.45)';
          if (isSelected) bgColor = hasTrades && isPos ? 'rgba(0,120,255,0.7)' : hasTrades && isNeg ? 'rgba(255,20,20,0.7)' : '#1F2937';

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="relative aspect-square flex flex-col items-center justify-center transition-fast hover:opacity-80"
              style={{ backgroundColor: bgColor }}
            >
              <span
                className="text-[10px] font-medium leading-none"
                style={{
                  color: isToday(day.date)
                    ? '#FFFFFF'
                    : hasTrades && isPos
                    ? '#FFFFFF'
                    : hasTrades && isNeg
                    ? '#FFFFFF'
                    : '#4B5563',
                  fontWeight: hasTrades || isToday(day.date) ? '700' : '500',
                  textShadow: hasTrades ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                }}
              >
                {day.date.getDate()}
              </span>
              {hasTrades && (
                <div
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: '#FFFFFF', opacity: 0.8 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && selectedDay.tradeCount > 0 && (
        <div className="mt-3 bg-[#000000] rounded-lg border border-[#1F2937] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">
              {selectedDay.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p
              className="text-xs font-bold"
              style={{ color: selectedDay.pnl >= 0 ? '#3B82F6' : '#EF4444' }}
            >
              {selectedDay.pnl >= 0 ? '+' : ''}${selectedDay.pnl.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {selectedDay.trades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px]"
                    style={{
                      backgroundColor: (trade.type || '').toUpperCase() === 'BUY' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)',
                      color: (trade.type || '').toUpperCase() === 'BUY' ? '#93C5FD' : '#FCA5A5',
                    }}
                  >
                    {(trade.type || '').toUpperCase() === 'BUY' ? 'B' : 'S'}
                  </span>
                  <span className="text-[#9CA3AF]">{trade.symbol}</span>
                  <span className="text-[#6B7280]">{trade.volume.toFixed(2)} lot</span>
                </div>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: (trade.profit || 0) >= 0 ? '#3B82F6' : '#EF4444' }}
                >
                  {(trade.profit || 0) >= 0 ? '+' : ''}${(trade.profit || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
