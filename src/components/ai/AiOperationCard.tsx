import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Package, 
  Truck, 
  Tag, 
  Loader2 
} from 'lucide-react';
import { AiProposedOperation } from '../../types';

interface AiOperationCardProps {
  operation: AiProposedOperation;
  onExecute: (op: AiProposedOperation) => Promise<void>;
  onCancel: (op: AiProposedOperation) => void;
}

export function AiOperationCard({
  operation,
  onExecute,
  onCancel
}: AiOperationCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const status = operation.status || 'pending';
  const orderCount = operation.orderIds?.length || 0;
  const params = operation.params || {};

  const handleConfirm = async () => {
    try {
      setIsExecuting(true);
      await onExecute(operation);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={`mt-3 p-4 rounded-2xl border transition-all duration-200 ${
      status === 'executed' 
        ? 'bg-emerald-50/70 border-emerald-300' 
        : status === 'cancelled'
        ? 'bg-slate-50 border-slate-200 opacity-75'
        : 'bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border-indigo-200 shadow-md ring-1 ring-indigo-500/10'
    }`} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            status === 'executed' ? 'bg-emerald-600 text-white' :
            status === 'cancelled' ? 'bg-slate-400 text-white' :
            'bg-indigo-600 text-white shadow-xs'
          }`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              مقترح تنفيذ عملية
              {status === 'pending' && (
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                  بانتظار موافقتك
                </span>
              )}
            </h4>
            <span className="text-[11px] text-slate-500">
              نوع العملية: <span className="font-mono font-semibold">{operation.actionType}</span>
            </span>
          </div>
        </div>

        {status === 'executed' && (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم التنفيذ بنجاح
          </span>
        )}

        {status === 'cancelled' && (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            تم الإلغاء
          </span>
        )}
      </div>

      {/* Summary Description */}
      <div className="text-sm text-slate-800 font-medium mb-3 leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-100">
        {operation.summaryArabic}
      </div>

      {/* Changes Details Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3.5">
        {orderCount > 0 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
            <span className="text-slate-500">الطلبيات المستهدفة:</span>
            <span className="font-bold text-indigo-700 font-mono">
              {orderCount} {orderCount === 1 ? 'طلبية' : 'طلبيات'}
            </span>
          </div>
        )}

        {params.status1 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
            <span className="text-slate-500">حالة التأكيد الجديدة:</span>
            <span className="font-bold text-emerald-700">{params.status1}</span>
          </div>
        )}

        {params.deliveryCompany && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
            <span className="text-slate-500">شركة الشحن:</span>
            <span className="font-bold text-purple-700 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              {params.deliveryCompany}
            </span>
          </div>
        )}

        {params.tag && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
            <span className="text-slate-500">التاغ المضاف:</span>
            <span className="font-bold text-amber-700 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {params.tag}
            </span>
          </div>
        )}

        {params.status2 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
            <span className="text-slate-500">حالة التوصيل:</span>
            <span className="font-bold text-blue-700">{params.status2}</span>
          </div>
        )}
      </div>

      {/* Confirmation Actions */}
      {status === 'pending' && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onCancel(operation)}
            disabled={isExecuting}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isExecuting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                تأكيد وتنفيذ العملية
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
