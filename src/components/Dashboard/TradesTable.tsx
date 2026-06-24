import React, { useState } from 'react';
import { Trade, supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import toast from 'react-hot-toast';
import { Trash2, BarChart2 } from 'lucide-react';

interface TradesTableProps {
  trades: Trade[];
  onTradesChange: () => void;
}

export const TradesTable: React.FC<TradesTableProps> = ({ trades, onTradesChange }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL' | 'BALANCE'>('all');

  const filteredTrades = trades.filter((trade) => {
    if (filter === 'all') return true;
    return trade.type === filter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm(t.trades.confirmDelete)) return;
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) {
      toast.error(t.messages.deleteError);
    } else {
      toast.success(t.messages.deleteSuccess);
      onTradesChange();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const filterBtns = [
    { key: 'all', label: t.trades.filterAll },
    { key: 'BUY', label: t.trades.filterBuy },
    { key: 'SELL', label: t.trades.filterSell },
    { key: 'BALANCE', label: t.trades.filterBalance },
  ];

  return (
    <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div className="p-5 border-b border-[#1F2937]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t.trades.symbol}</h2>
          <div className="flex gap-1.5">
            {filterBtns.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                  filter === btn.key
                    ? 'bg-primary-blue text-white'
                    : 'bg-[#000000] text-[#9CA3AF] hover:text-white hover:bg-[#111111]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTrades.length === 0 ? (
        <div className="p-12 text-center">
          <BarChart2 className="w-12 h-12 text-[#1F2937] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">{t.trades.noTrades}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.symbol}</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.type}</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.entryTime}</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.volume}</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.profit}</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">{t.trades.pips}</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111111]">
              {filteredTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-[#161616] transition-fast">
                  <td className="px-5 py-3.5 text-sm text-white font-semibold tracking-tight">
                    {trade.symbol || '-'}
                  </td>
                  <td className="px-5 py-3.5">
                    {(() => {
                      const t2 = (trade.type || '').toUpperCase();
                      if (t2 === 'BUY' || t2 === 'SELL') {
                        return (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${
                              t2 === 'BUY'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-red-500/15 text-rose-400'
                            }`}
                          >
                            {t2 === 'BUY' ? 'B' : 'S'}
                          </span>
                        );
                      }
                      return <span className="text-xs text-[#6B7280]">—</span>;
                    })()}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#9CA3AF]">{formatDate(trade.open_time)}</td>
                  <td className="px-5 py-3.5 text-sm text-white">{trade.volume.toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        (trade.profit || 0) >= 0 ? 'text-blue-400' : 'text-rose-400'
                      }`}
                    >
                      ${(trade.profit || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-white tabular-nums">{(trade.pips || 0).toFixed(1)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(trade.id)}
                        className="p-1.5 text-[#374151] hover:text-rose-400 hover:bg-red-500/10 rounded-lg transition-fast"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
