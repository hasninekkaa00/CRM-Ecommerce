import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Undo2, X } from 'lucide-react';

export const FloatingUndoButton = () => {
  const { undoHistory, popUndo, clearUndoHistory } = useStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (undoHistory.length > 0) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 8000); // hide after 8 seconds
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [undoHistory]);

  if (undoHistory.length === 0 || !isVisible) return null;

  const latestAction = undoHistory[0];

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 border border-slate-700">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-200">إجراء قابل للتراجع</span>
          <span className="text-[10px] text-slate-400">{latestAction.label}</span>
        </div>
        <div className="flex items-center gap-2 border-r border-slate-600 pr-4">
          <button
            onClick={async () => {
              await popUndo();
              setIsVisible(false);
            }}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            تراجع
          </button>
          <button
            onClick={() => {
              setIsVisible(false);
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="إخفاء"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
