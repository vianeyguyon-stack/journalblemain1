import React from 'react';

interface TooltipContentProps {
  title: string;
  items: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;
}

export const ChartTooltip: React.FC<TooltipContentProps> = ({ title, items }) => {
  return (
    <div className="bg-dark-primary dark:bg-gray-900 px-4 py-3 rounded-xl shadow-2xl border border-gray-700">
      <p className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-300 font-medium">{item.label}</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: item.color || '#FFFFFF' }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const getTooltipStyles = () => ({
  backgroundColor: 'transparent',
  border: 'none',
  padding: 0,
});
