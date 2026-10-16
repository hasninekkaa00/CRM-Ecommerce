import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Trash2, 
  X, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Megaphone, 
  Clock, 
  Check, 
  AlertTriangle,
  History,
  ArchiveRestore
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  DeletedItemRecord, 
  getDeletedHistory, 
  removeDeletedRecord, 
  clearAllDeletedHistory 
} from '../../utils/undoManager';
import { useStore } from '../../store';

interface RecoveryCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecoveryCenterModal({ isOpen, onClose }: RecoveryCenterModalProps) {
  const [history, setHistory] = useState<DeletedItemRecord[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { restoreDeletedItem } = useStore();

  useEffect(() => {
    if (isOpen) {
      setHistory(getDeletedHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (item: DeletedItemRecord) => {
    setRestoringId(item.id);
    try {
      if (restoreDeletedItem) {
        await restoreDeletedItem(item.id);
      }
      setHistory(getDeletedHistory());
      toast.success(`تم استرجاع "${item.title}" بنجاح! ↩️`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء محاولة الاسترجاع');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = (id: string) => {
    removeDeletedRecord(id);
    setHistory(getDeletedHistory());
    toast.success('تم حذف العنصر من سجل الاسترجاع نهائياً');
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من تفريغ سجل المحذوفات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      clearAllDeletedHistory();
      setHistory([]);
      toast.success('تم تفريغ سجل المحذوفات');
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="w-4 h-4 text-blue-600" />;
      case 'inventory_product':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'expense':
        return <DollarSign className="w-4 h-4 text-rose-600" />;
      case 'campaign_record':
      case 'campaign':
        return <Megaphone className="w-4 h-4 text-amber-600" />;
      default:
        return <Trash2 className="w-4 h-4 text-slate-600" />;
    }
  };

  const getEntityLabel = (type: string) => {
    switch (type) {
      case 'order': return 'طلبية';
      case 'inventory_product': return 'منتج مخزون';
      case 'expense': return 'مصروف';
      case 'campaign_record': return 'سجل إعلاني';
      case 'campaign': return 'حملة إعلانية';
      default: return 'عنصر';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner">
              <ArchiveRestore className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                <span>مركز التراجع وسلة الاسترجاع</span>
                <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-bold border border-indigo-400/20">
                  {history.length} عناصر محذوفة
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                يمكنك التراجع عن عمليات الحذف الخاطئة واستعادة بياناتك بنقرة واحدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 mb-1">سجل المحذوفات فارغ تماماً</h3>
              <p className="text-xs text-slate-500">
                عند حذف أي طلبية، منتج مخزون، أو مصروف، ستظهر هنا تلقائياً لتمكينك من التراجع عنها فوراً.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                    {getEntityIcon(item.entityType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {getEntityLabel(item.entityType)}
                      </span>
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>تم الحذف: {new Date(item.deletedAt).toLocaleString('ar-EG')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                    <span>تراجع واسترجاع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(item.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="حذف من السجل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              تفريغ السجل بالكامل
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
