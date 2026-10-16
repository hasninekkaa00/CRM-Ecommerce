import React from 'react';
import { getOrderChannelName, getChannelInfo, CHANNEL_PRESETS } from '../../utils/channelUtils';
import { Order } from '../../types';
import { useStore } from '../../store';
import { Layers, Eye, EyeOff, X, Filter, Sparkles, Check, Store } from 'lucide-react';

interface SourceChannelFilterBarProps {
  orders: Order[];
  selectedChannel: string; // 'all' or specific channel name
  hiddenChannels: string[];
  onSelectChannel: (channel: string) => void;
  onToggleHideChannel: (channel: string) => void;
  onResetChannelFilter: () => void;
}

export const SourceChannelFilterBar: React.FC<SourceChannelFilterBarProps> = ({
  orders,
  selectedChannel,
  hiddenChannels,
  onSelectChannel,
  onToggleHideChannel,
  onResetChannelFilter
}) => {
  const { salesChannels } = useStore();

  // Calculate counts for each channel present in orders
  const channelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      // Ignore trashed/archived if needed
      if (!o.trashed && !o.archived) {
        const ch = getOrderChannelName(o, salesChannels);
        counts[ch] = (counts[ch] || 0) + 1;
      }
    });
    return counts;
  }, [orders, salesChannels]);

  // Combine channels from orders and configured salesChannels
  const activeChannels = React.useMemo(() => {
    const namesSet = new Set<string>();

    // 1. Add configured sales channels from store
    if (salesChannels && salesChannels.length > 0) {
      salesChannels.forEach(sc => {
        if (sc.name) namesSet.add(sc.name);
      });
    }

    // 2. Add channels present in current orders
    Object.keys(channelCounts).forEach(n => namesSet.add(n));
    
    // Convert to channel info objects
    const list = Array.from(namesSet).map(name => {
      const info = getChannelInfo(name, salesChannels);
      return {
        name,
        info,
        count: channelCounts[name] || 0
      };
    });

    // Sort by order count descending, but keep configured channels with >0 or active high
    return list.sort((a, b) => b.count - a.count);
  }, [channelCounts, salesChannels]);

  const totalFilteredCount = React.useMemo(() => {
    return Object.entries(channelCounts).reduce((acc: number, [ch, cnt]) => {
      if (hiddenChannels.includes(ch)) return acc;
      if (selectedChannel !== 'all' && selectedChannel !== ch) return acc;
      return acc + (Number(cnt) || 0);
    }, 0);
  }, [channelCounts, selectedChannel, hiddenChannels]);

  if (activeChannels.length === 0) return null;

  const isFiltered = selectedChannel !== 'all' || hiddenChannels.length > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs transition-all mb-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-[11px] text-slate-800 dark:text-slate-100">
            تصفية حسب اسم القناة
          </span>
          {isFiltered && (
            <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
              مفلترة: {totalFilteredCount}
            </span>
          )}
        </div>

        {isFiltered && (
          <button
            onClick={onResetChannelFilter}
            className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>عرض كل القنوات</span>
          </button>
        )}
      </div>

      {/* Channels Pill Selector & Hide Toggles */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        {/* All Channels Pill */}
        <button
          onClick={() => onSelectChannel('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all whitespace-nowrap cursor-pointer border ${
            selectedChannel === 'all' && hiddenChannels.length === 0
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <span>كل القنوات</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded font-extrabold ${
            selectedChannel === 'all' && hiddenChannels.length === 0
              ? 'bg-slate-800 text-white'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          }`}>
            {orders.filter(o => !o.trashed && !o.archived).length}
          </span>
        </button>

        {/* Channel Preset Pills */}
        {activeChannels.map(({ name, info, count }) => {
          const isSelected = selectedChannel === name;
          const isHidden = hiddenChannels.includes(name);

          return (
            <div
              key={name}
              className={`group flex items-center rounded-lg border text-[11px] font-bold transition-all whitespace-nowrap overflow-hidden ${
                isHidden
                  ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 dark:bg-slate-850 dark:border-slate-800'
                  : isSelected
                  ? `${info.bgClass} ${info.textClass} border-2 ${info.borderClass} shadow-xs`
                  : `${info.bgClass} ${info.textClass} ${info.borderClass} hover:shadow-2xs`
              }`}
            >
              <button
                onClick={() => onSelectChannel(isSelected ? 'all' : name)}
                className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:opacity-90"
                title={`فلترة حسب ${name}`}
              >
                <span className="shrink-0 scale-90">{info.icon}</span>
                <span>{info.name}</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded font-extrabold ${
                  isSelected ? 'bg-white/80 dark:bg-slate-900/80' : 'bg-black/5 dark:bg-white/10'
                }`}>
                  {count}
                </span>
              </button>

              {/* Hide / Show Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHideChannel(name);
                }}
                className={`px-1 py-0.5 transition-colors border-r ${info.borderClass} ${
                  isHidden 
                    ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-400' 
                    : 'opacity-40 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isHidden ? `إلغاء إخفاء ${name}` : `إخفاء طلبيات ${name}`}
              >
                {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

