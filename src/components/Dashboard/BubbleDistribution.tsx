import React, { useMemo, useState } from 'react';
import { Trade } from '../../lib/supabase';

interface BubbleDistributionProps {
  trades: Trade[];
}

interface SymbolBubble {
  symbol: string;
  profit: number;
  tradesCount: number;
  size: number;
  x: number;
  y: number;
  isPositive: boolean;
}

const generateCirclePackPosition = (
  index: number,
  size: number,
  containerWidth: number,
  containerHeight: number,
  existingBubbles: Array<{ x: number; y: number; size: number }>
) => {
  const radius = size / 2;
  const minGap = 35;

  if (existingBubbles.length === 0) {
    return { x: containerWidth / 2, y: containerHeight / 2 };
  }

  const maxAttempts = 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = (attempt * 137.508) * (Math.PI / 180);
    const distance = Math.sqrt(attempt + 1) * (size * 0.6 + minGap);

    const x = containerWidth / 2 + distance * Math.cos(angle);
    const y = containerHeight / 2 + distance * Math.sin(angle);

    if (
      x - radius < minGap ||
      x + radius > containerWidth - minGap ||
      y - radius < minGap ||
      y + radius > containerHeight - minGap
    ) {
      continue;
    }

    let hasCollision = false;
    for (const bubble of existingBubbles) {
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = radius + bubble.size / 2 + minGap;
      if (dist < minDist) { hasCollision = true; break; }
    }

    if (!hasCollision) return { x, y };
  }

  return { x: containerWidth / 2, y: containerHeight / 2 };
};


export const BubbleDistribution: React.FC<BubbleDistributionProps> = ({ trades }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');

  const uniqueSymbols = useMemo(() => {
    return Array.from(
      new Set(trades.filter(t => t.symbol && (t.type || '').toUpperCase() !== 'BALANCE' && t.close_time !== null).map(t => t.symbol))
    ).sort();
  }, [trades]);

  const bubbleData = useMemo(() => {
    const closedTrades = trades.filter(
      (t) => t.close_time !== null && (t.type || '').toUpperCase() !== 'BALANCE' && t.symbol
    );

    const filteredTrades = selectedSymbol === 'all'
      ? closedTrades
      : closedTrades.filter(t => t.symbol === selectedSymbol);

    const profitBySymbol: Record<string, { profit: number; count: number }> = {};

    filteredTrades.forEach((trade) => {
      const symbol = trade.symbol!;
      const profit = (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
      if (!profitBySymbol[symbol]) profitBySymbol[symbol] = { profit: 0, count: 0 };
      profitBySymbol[symbol].profit += profit;
      profitBySymbol[symbol].count += 1;
    });

    const sortedSymbols = Object.entries(profitBySymbol).sort((a, b) => Math.abs(b[1].profit) - Math.abs(a[1].profit));

    const containerWidth = 1000;
    const containerHeight = 500;
    const bubbles: SymbolBubble[] = [];
    const existingBubbles: Array<{ x: number; y: number; size: number }> = [];

    sortedSymbols.forEach(([symbol, data], index) => {
      const absProfit = Math.abs(data.profit);
      const size = Math.max(50, Math.min(140, absProfit * 1.2 + 50));
      const position = generateCirclePackPosition(index, size, containerWidth, containerHeight, existingBubbles);

      bubbles.push({
        symbol,
        profit: data.profit,
        tradesCount: data.count,
        size,
        x: position.x,
        y: position.y,
        isPositive: data.profit >= 0,
      });
      existingBubbles.push({ x: position.x, y: position.y, size });
    });

    return bubbles;
  }, [trades, selectedSymbol]);

  if (bubbleData.length === 0) return null;

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
          Profits par Devise
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6B7280] font-medium">Paire:</label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-1.5 bg-[#000000] border border-[#1F2937] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#0078FF]"
          >
            <option value="all">Toutes</option>
            {uniqueSymbols.map((symbol) => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative h-[500px] bg-[#000000] rounded-xl border border-[#1F2937] overflow-hidden">
        {bubbleData.map((bubble) => {
          const symbolSize = bubble.size < 80 ? 'text-xs' : bubble.size < 120 ? 'text-sm' : 'text-base';
          const profitSize = bubble.size < 80 ? 'text-[10px]' : bubble.size < 120 ? 'text-xs' : 'text-sm';
          const spacing = bubble.size < 80 ? 'mb-0' : 'mb-1';
          const padding = bubble.size < 80 ? 'px-2' : 'px-3';

          const bgColor = bubble.isPositive
            ? 'rgba(0,120,255,0.55)'
            : 'rgba(255,20,20,0.55)';

          return (
            <div
              key={bubble.symbol}
              className="group absolute cursor-pointer"
              style={{
                left: `${(bubble.x / 1000) * 100}%`,
                top: `${(bubble.y / 500) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`rounded-full flex flex-col items-center justify-center ${padding}`}
                style={{
                  width: `${bubble.size}px`,
                  height: `${bubble.size}px`,
                  backgroundColor: bgColor,
                  border: `2px solid ${bubble.isPositive ? 'rgba(0,120,255,0.8)' : 'rgba(255,20,20,0.8)'}`,
                }}
              >
                <span className={`text-white font-bold ${symbolSize} ${spacing} drop-shadow`}>
                  {bubble.symbol}
                </span>
                <span className={`text-white ${profitSize} font-medium opacity-90 drop-shadow`}>
                  {bubble.profit >= 0 ? '+' : ''}${bubble.profit.toFixed(0)}
                </span>
              </div>

              <div className="absolute hidden group-hover:flex bottom-full left-1/2 -translate-x-1/2 mb-3 bg-[#111111] px-4 py-3 rounded-xl shadow-2xl border border-[#1F2937] whitespace-nowrap z-20 flex-col">
                <p className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">
                  {bubble.symbol}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[#6B7280] font-medium">P&L</span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: bubble.profit >= 0 ? '#0078FF' : '#FF1414' }}
                    >
                      {bubble.profit >= 0 ? '+' : ''}${bubble.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[#6B7280] font-medium">Trades</span>
                    <span className="text-sm font-bold text-white tabular-nums">{bubble.tradesCount}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-8 mt-6 pt-6 border-t border-[#1F2937]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: 'rgba(0,120,255,0.55)', border: '2px solid rgba(0,120,255,0.8)' }} />
          <span className="text-xs text-[#6B7280] font-medium">Bleu - Profit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: 'rgba(255,20,20,0.55)', border: '2px solid rgba(255,20,20,0.8)' }} />
          <span className="text-xs text-[#6B7280] font-medium">Rouge - Perte</span>
        </div>
      </div>
    </div>
  );
};
