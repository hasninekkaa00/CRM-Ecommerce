import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, ArrowRight, X, Info } from 'lucide-react';
import { IntegrityCheckResult } from '../../utils/dataIntegrity';

interface IntegrityProtectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: IntegrityCheckResult | null;
  checkResult?: IntegrityCheckResult | null;
  onConfirmSafeAction?: () => void;
  onSafeAction?: () => void;
  safeActionLabel?: string;
}

export function IntegrityProtectionModal({
  isOpen,
  onClose,
  result,
  checkResult,
  onConfirmSafeAction,
  onSafeAction,
  safeActionLabel
}: IntegrityProtectionModalProps) {
  const activeResult = result || checkResult;
  const handleSafeAction = onConfirmSafeAction || onSafeAction;

  if (!isOpen || !activeResult) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black mb-1">
                <AlertTriangle className="w-3 h-3" />
                حماية تماسك وهيكلة البيانات
              </div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {result.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-bold text-slate-700 leading-relaxed">
            {activeResult.reason}
          </p>

          {/* Details / Linked References */}
          {activeResult.details && activeResult.details.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                الارتباطات الحالية في النظام:
              </span>
              <ul className="space-y-1.5 pr-2">
                {activeResult.details.map((d, idx) => (
                  <li key={idx} className="text-xs font-bold text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safe Suggestions */}
          {activeResult.suggestions && activeResult.suggestions.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                الإجراءات البديلة المقترحة:
              </span>
              <ul className="space-y-1.5 pr-2">
                {activeResult.suggestions.map((s, idx) => (
                  <li key={idx} className="text-xs font-bold text-emerald-800 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {handleSafeAction && (
            <button
              onClick={() => {
                handleSafeAction();
                onClose();
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {safeActionLabel || 'تنفيذ الإجراء الآمن البديل'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
          >
            إغلاق والتراجع
          </button>
        </div>

      </div>
    </div>
  );
}
