import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { RefreshCw, CheckCircle2, Clock, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';

interface SyncProgressBarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SyncProgressBar({ isCollapsed = false, onToggleCollapse }: SyncProgressBarProps) {
  const syncProgress = useStore(state => state.syncProgress);
  const nextSyncTime = useStore(state => state.nextSyncTime);
  const autoSyncIntervalSeconds = useStore(state => state.settings?.autoSyncIntervalSeconds);

  const [remainingSecs, setRemainingSecs] = useState<number>(() => {
    if (!nextSyncTime) return 0;
    return Math.max(0, Math.ceil((nextSyncTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!nextSyncTime) {
      setRemainingSecs(prev => (prev === 0 ? prev : 0));
      return;
    }

    const calcRemaining = () => Math.max(0, Math.ceil((nextSyncTime - Date.now()) / 1000));
    setRemainingSecs(prev => {
      const next = calcRemaining();
      return prev === next ? prev : next;
    });

    const timer = setInterval(() => {
      const rem = calcRemaining();
      setRemainingSecs(prev => (prev === rem ? prev : rem));
      if (rem <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextSyncTime]);

  const showWait = !!nextSyncTime;
  const isVisible = (syncProgress && syncProgress.isSyncing) || showWait;

  if (!isVisible) return null;

  const totalIntervalSecs = autoSyncIntervalSeconds || 60;
  const waitProgress = totalIntervalSecs > 0 ? Math.min(100, Math.max(0, ((totalIntervalSecs - remainingSecs) / totalIntervalSecs) * 100)) : 0;

  const currentPercent = syncProgress ? syncProgress.percent : waitProgress;
  const currentLabel = syncProgress ? (syncProgress.label || 'مزامنة') : 'المزامنة التلقائية القادمة';
  const currentMessage = syncProgress ? syncProgress.message : `تبدأ عملية جلب الطلبيات بعد ${remainingSecs} ثانية`;
  const isCompleted = syncProgress ? syncProgress.percent >= 100 : false;

  // Collapsed Micro Stripe View
  if (isCollapsed) {
    return (
      <div 
        onClick={onToggleCollapse}
        className="w-full h-1 bg-indigo-950/40 relative cursor-pointer group z-40 transition-all hover:h-2" 
        title={`${currentLabel}: ${currentMessage} (اضغط للتوسيع)`}
      >
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150 ease-linear shadow-[0_0_8px_rgba(99,102,241,0.6)]"
          style={{ width: `${currentPercent}%` }}
        />
      </div>
    );
  }

  return (
    <div 
      className={`relative z-40 transition-all duration-300 ease-in-out w-full border-b border-indigo-700/30 flex-shrink-0 ${
        isVisible ? 'h-[46px] opacity-100' : 'h-0 opacity-0 overflow-hidden border-transparent'
      }`}
    >
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 h-full text-white relative overflow-hidden flex items-center shadow-sm">
        {/* Progress Background */}
        <div 
          className="absolute inset-y-0 right-0 bg-indigo-500 transition-all duration-75 ease-linear shadow-[0_0_15px_rgba(99,102,241,0.5)]"
          style={{ width: `${currentPercent}%` }}
        />
        
        {/* Content */}
        <div className="relative px-5 flex items-center justify-between z-10 w-full" dir="rtl">
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            ) : syncProgress ? (
              <RefreshCw className="w-4 h-4 text-indigo-200 animate-spin flex-shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-indigo-200 flex-shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">{currentLabel}</span>
              <span className="text-[10px] text-indigo-200 font-medium truncate max-w-sm leading-tight mt-0.5">{currentMessage}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs font-black">
            {!syncProgress && remainingSecs > 0 && (
                <span className="text-indigo-200 font-mono text-[11px] bg-indigo-800/40 px-2 py-0.5 rounded shadow-sm">
                  {Math.floor(remainingSecs / 60)}:{(remainingSecs % 60).toString().padStart(2, '0')}
                </span>
            )}
            <span className="bg-indigo-800/40 px-2 py-0.5 rounded-md border border-indigo-500/30 min-w-[36px] text-center shadow-sm">
              {Math.round(currentPercent)}%
            </span>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-lg bg-indigo-800/60 hover:bg-indigo-800 text-indigo-200 hover:text-white transition-colors cursor-pointer"
                title="طي شريط المزامنة إلى شريط رفيع"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
