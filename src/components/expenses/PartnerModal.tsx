import React, { useState, useEffect } from 'react';
import { X, User, Phone, Percent, DollarSign, FileText } from 'lucide-react';
import { Partner } from '../../types';
import { useStore } from '../../store';
import toast from 'react-hot-toast';

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner?: Partner | null;
}

export function PartnerModal({ isOpen, onClose, partner }: PartnerModalProps) {
  const { addPartner, updatePartner } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sharePercentage, setSharePercentage] = useState<number>(50);
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (partner) {
      setName(partner.name || '');
      setPhone(partner.phone || '');
      setSharePercentage(partner.sharePercentage !== undefined ? partner.sharePercentage : 50);
      setInitialCapital(partner.initialCapital || 0);
      setNotes(partner.notes || '');
    } else {
      setName('');
      setPhone('');
      setSharePercentage(50);
      setInitialCapital(0);
      setNotes('');
    }
  }, [partner, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم الشريك');
      return;
    }

    setIsSubmitting(true);
    try {
      if (partner) {
        await updatePartner(partner.id, {
          name: name.trim(),
          phone: phone.trim(),
          sharePercentage: Number(sharePercentage) || 0,
          initialCapital: Number(initialCapital) || 0,
          notes: notes.trim()
        });
        toast.success('تم تحديث بيانات الشريك بنجاح');
      } else {
        const newPartner: Partner = {
          id: `partner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: name.trim(),
          phone: phone.trim(),
          sharePercentage: Number(sharePercentage) || 0,
          initialCapital: Number(initialCapital) || 0,
          notes: notes.trim(),
          createdAt: new Date().toISOString()
        };
        await addPartner(newPartner);
        toast.success('تمت إضافة الشريك بنجاح');
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ بيانات الشريك');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                {partner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}
              </h3>
              <p className="text-xs text-slate-500">تسجيل بيانات الشريك ونسبة المساهمة في التجارة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم الشريك <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد، عبد الرحمن..."
                required
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الهاتف
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06XX XX XX XX"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نسبة الشراكة (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={sharePercentage}
                  onChange={(e) => setSharePercentage(Number(e.target.value))}
                  placeholder="50"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
                <Percent className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رأس المال الافتتاحي (د.ج) <span className="text-slate-400 font-normal">(اختياري)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={initialCapital || ''}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                placeholder="0"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
              <DollarSign className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">المبلغ الذي بدأ به هذا الشريك المشروع عند التأسيس.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات إضافية
            </label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أية تفاصيل أو اتفاقيات خاصة..."
                rows={2}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
              <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : (partner ? 'حفظ التعديلات' : 'إضافة الشريك')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
