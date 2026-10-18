import React, { useState } from 'react';
import { X, Tag, Plus, Check, Sparkles, Database } from 'lucide-react';
import { useStore } from '../../store';
import { TAG_COLOR_PRESETS, addTagToOrder } from '../../utils/tagUtils';
import { Order, AbandonedOrder, OrderTag } from '../../types';
import toast from 'react-hot-toast';

interface QuickAddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetOrder?: Order | AbandonedOrder | null;
  onTagCreated?: (tag: OrderTag) => void;
  isAbandoned?: boolean;
}

export function QuickAddTagModal({
  isOpen,
  onClose,
  targetOrder,
  onTagCreated,
  isAbandoned = false,
}: QuickAddTagModalProps) {
  const { settings, addTag, updateOrder, updateAbandonedOrder } = useStore();
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLOR_PRESETS[0].color);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentTags = settings?.tags || [];

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tagName.trim();
    if (!trimmed) {
      toast.error('يرجى كتابة اسم التاغ أولاً');
      return;
    }

    setIsSaving(true);
    try {
      const newTag: OrderTag = {
        name: trimmed,
        color: selectedColor,
      };

      // 1. Persist tag directly into Firestore and state via store
      await addTag(newTag);

      // 2. If a target order is provided, apply this new tag to the order
      if (targetOrder) {
        const updatedTags = [...currentTags.filter(t => t.name !== trimmed), newTag];
        const res = addTagToOrder(targetOrder, trimmed, updatedTags);
        if (isAbandoned) {
          await updateAbandonedOrder(targetOrder.id, { tag: res.tag, tagsHistory: res.tagsHistory });
        } else {
          await updateOrder(targetOrder.id, { tag: res.tag, tagsHistory: res.tagsHistory });
        }
        toast.success(`تم إنشاء التاغ "${trimmed}" وحفظه في قاعدة البيانات وتطبيقه على الطلبية! ✨`);
      } else {
        toast.success(`تم حفظ التاغ الجديد "${trimmed}" في قاعدة البيانات بنجاح! 💾`);
      }

      if (onTagCreated) {
        onTagCreated(newTag);
      }

      setTagName('');
      onClose();
    } catch (err: any) {
      console.error('Error saving tag:', err);
      toast.error('حدث خطأ أثناء حفظ التاغ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-indigo-100 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">إنشاء تاغ مخصص جديد</h3>
              <p className="text-[11px] text-indigo-100 font-medium">
                حفظ فوري في قاعدة البيانات السحابية (Firestore)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Tag Name Input */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              اسم التاغ أو التصنيف
            </label>
            <input
              type="text"
              autoFocus
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="مثال: زبون مستعجل، مراجعة الإدارة، إلغاء متكرر..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">
              اختر لون التاغ
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-100 rounded-xl bg-gray-50/50">
              {TAG_COLOR_PRESETS.map((preset) => {
                const isSelected = selectedColor === preset.color;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setSelectedColor(preset.color)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-between gap-1 cursor-pointer ${preset.color} ${
                      isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.02] shadow-xs' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <span className="truncate">{preset.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">معاينة التاغ:</span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black border shadow-2xs ${selectedColor}`}>
              <Tag className="w-3 h-3 opacity-70" />
              <span>{tagName.trim() || 'اسم التاغ'}</span>
            </span>
          </div>

          {/* Target Order Info */}
          {targetOrder && (
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs font-medium text-indigo-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                سيتم تطبيق هذا التاغ فوراً على الطلبية: <strong className="font-bold">#{targetOrder.orderId || targetOrder.id}</strong> ({((targetOrder as any).customerName || (targetOrder as any).fullName || 'عميل')})
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving || !tagName.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ في قاعدة البيانات واستخدامه'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
