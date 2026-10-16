import React from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, X, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { DeletedItemRecord } from './undoManager';

export function showUndoToast({
  record,
  customMessage,
  onUndo
}: {
  record: DeletedItemRecord;
  customMessage?: string;
  onUndo?: () => void;
}) {
  toast.custom((t) => (
    <div
      dir="rtl"
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-slate-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex items-center justify-between p-3.5 border border-slate-700/80 ring-1 ring-black/10`}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
          <Trash2 className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-100">
            {customMessage || `تم حذف ${record.title}`}
          </p>
          <p className="text-[10px] text-slate-400">
            يمكنك التراجع واستعادة العنصر الآن
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            toast.dismiss(t.id);
            try {
              if (onUndo) {
                onUndo();
              } else {
                const store = useStore.getState();
                if (store.restoreDeletedItem) {
                  await store.restoreDeletedItem(record.id);
                }
              }
              toast.success(`تم استرجاع "${record.title}" بنجاح ↩️`);
            } catch (err) {
              console.error(err);
              toast.error('حدث خطأ أثناء التراجع');
            }
          }}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>تراجع</span>
        </button>

        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ), {
    duration: 8000,
    position: 'bottom-center'
  });
}
