import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Plus, Trash2, Save, Edit2, Check, X, MessageSquare, Key, Phone, Tag, Home, LayoutGrid, LayoutDashboard, ShoppingCart, Truck, Navigation, Ghost, Package, Contact, Megaphone, DollarSign, Wallet, Target, Store, Users, Settings as SettingsIcon, BarChart3, Building, Headphones, Facebook, CheckCircle2, RefreshCw, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { SystemSettings, OrderTag, ViewState } from '../../types';
import toast from 'react-hot-toast';

export const LANDING_PAGE_OPTIONS: { id: ViewState; name: string; desc: string; category: string; icon: any }[] = [
  { id: 'sections', name: 'شبكة الأقسام والتطبيقات (App Sections Grid)', desc: 'يفتح التطبيق مباشرة على شبكة متكاملة لجميع الأقسام والأدوات للاختيار السريع', category: 'الواجهة العامة', icon: LayoutGrid },
  { id: 'dashboard', name: 'لوحة التحكم والمؤشرات (Dashboard)', desc: 'نظرة عامة على المبيعات، الرسوم البيانية ومؤشرات الأداء', category: 'المبيعات والطلبيات', icon: LayoutDashboard },
  { id: 'orders', name: 'إدارة وتأكيد الطلبيات (Orders Management)', desc: 'جدول معالجة، تأكيد وفرز الطلبيات الواردة', category: 'المبيعات والطلبيات', icon: ShoppingCart },
  { id: 'shipped_orders', name: 'الطلبيات المشحونة (Shipped Orders)', desc: 'متابعة الطرود المشحونة مع شركات التوصيل وحالات التسليم', category: 'الشحن والتوصيل', icon: Truck },
  { id: 'suivi', name: 'داشبورد سويفي (Suivi Dashboard)', desc: 'تتبع الشحنات العالقة وإدارتها بدقة مع شركات التوصيل', category: 'الشحن والتوصيل', icon: Navigation },
  { id: 'abandoned', name: 'السلات المتروكة (Abandoned Carts)', desc: 'إدارة السلات المتروكة وتتبع جهود استرجاع العملاء', category: 'المبيعات والطلبيات', icon: Ghost },
  { id: 'inventory', name: 'إدارة المخزن والمنتجات (Inventory)', desc: 'جرد وتتبع كميات المخزون وحركات الإدخال والإخراج', category: 'المخزون والمشتريات', icon: Package },
  { id: 'purchases', name: 'الموردين وفواتير المشتريات (Purchases)', desc: 'إدارة فواتير المشتريات، الموردين ومستحقات السلع', category: 'المخزون والمشتريات', icon: Contact },
  { id: 'campaigns', name: 'الحملات الإعلانية ومصاريف الـ Ads', desc: 'تتبع مصاريف إعلانات فيسبوك، تيك توك وحساب عائد الإعلانات ROAS', category: 'المالية والإعلانات', icon: Megaphone },
  { id: 'profits', name: 'المالية وصافي الأرباح (Profit Simulator)', desc: 'حساب صافي الأرباح بعد خصم تكاليف المنتجات، التوصيل والإعلانات', category: 'المالية والإعلانات', icon: DollarSign },
  { id: 'expenses', name: 'المصاريف وحسابات الشركاء (Expenses)', desc: 'تسجيل المصاريف التشغيلية ومتابعة حصص وتوزيعات الشركاء', category: 'المالية والإعلانات', icon: Wallet },
  { id: 'advanced_simulator', name: 'محاكي الأرباح المتقدم (Advanced Simulator)', desc: 'محاكاة السيناريوهات المالية ونسب الإرجاع والتوصيل المتوقعة', category: 'المالية والإعلانات', icon: Target },
  { id: 'shipping', name: 'شركات الشحن وبوابات الربط (Shipping)', desc: 'إدارة بوابات شركات التوصيل ومزامنة الطرود التلقائية', category: 'الشحن والتوصيل', icon: Store },
  { id: 'shipping_invoices', name: 'فواتير ومستحقات الشحن (Invoices)', desc: 'مطابقة مستحقات شركات التوصيل والتحصيلات المالية', category: 'الشحن والتوصيل', icon: DollarSign },
  { id: 'shipping_bureaus', name: 'مكاتب وفروع التوصيل (Bureaus)', desc: 'دليل مكاتب ومراكز الاستلام في كافة الولايات', category: 'الشحن والتوصيل', icon: Building },
  { id: 'confirmers', name: 'فريق التأكيد وتوزيع الطلبات (Confirmers Hub)', desc: 'إدارة موظفي التأكيد، قواعد التوزيع الآلية وحساب العمولات', category: 'المبيعات والطلبيات', icon: Headphones },
  { id: 'analytics', name: 'الإحصائيات والتحليلات المتقدمة (Analytics)', desc: 'تقارير أداء المنتجات، المحافظات ونسب التوصيل', category: 'المبيعات والطلبيات', icon: BarChart3 },
  { id: 'channels', name: 'قنوات البيع وربط المتاجر (Channels)', desc: 'إدارة الربط التلقائي مع WooCommerce ومصادر الطلبيات', category: 'النظام والإعدادات', icon: Store },
  { id: 'users', name: 'إدارة المستخدمين والصلاحيات (Users)', desc: 'إدارة حسابات الفريق وصلاحيات الأدوار', category: 'النظام والإعدادات', icon: Users },
  { id: 'settings', name: 'الإعدادات العامة وتخصيص النظام (Settings)', desc: 'تخصيص الخيارات، الحالات، الثيمات وإعدادات التطبيق', category: 'النظام والإعدادات', icon: SettingsIcon },
  { id: 'backup', name: 'النسخ الاحتياطي والأمان (Backup & Auto-Backup)', desc: 'تصدير واسترجاع قاعدة البيانات والتصميم، وإدارة النسخ التلقائي الدوري', category: 'النظام والإعدادات', icon: ShieldCheck },
];

const TAG_COLOR_PRESETS = [
  { name: 'أخضر', color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'كهرماني', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' },
  { name: 'رمادي', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: 'برتقالي', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'أحمر', color: 'bg-red-100 text-red-800 border-red-300 font-bold' },
  { name: 'بنفسجي', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { name: 'وردي', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: 'أزرق', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { name: 'نيلي', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold' },
  { name: 'فيروزي', color: 'bg-teal-100 text-teal-800 border-teal-300' }
];

export const DEFAULT_TAGS: OrderTag[] = [
  { name: 'متروكة ناجحة', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold' },
  { name: 'طلب جديد', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { name: 'طلبية مؤكدة', color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'زبون VIP', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' },
  { name: 'لا يرد - محاولة 1', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: 'لا يرد - محاولة 2', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'لا يرد - محاولة 3', color: 'bg-red-100 text-red-800 border-red-300 font-bold' },
  { name: 'توصيل سريع', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { name: 'مشكلة في العنوان', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: 'طلب خاص', color: 'bg-blue-100 text-blue-800 border-blue-300' }
];

interface TagsEditorProps {
  tags: OrderTag[];
  onAdd: (name: string, color: string) => void;
  onRemove: (name: string) => void;
  onEdit: (oldName: string, newName: string, newColor: string) => void;
}

function TagsEditor({ tags, onAdd, onRemove, onEdit }: TagsEditorProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLOR_PRESETS[0].color);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleAddClick = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      onAdd(trimmed, newColor);
      setNewName('');
    }
  };

  const handleStartEdit = (idx: number, name: string, color: string) => {
    setEditingIdx(idx);
    setEditName(name);
    setEditColor(color);
  };

  const handleSaveEdit = (idx: number, oldName: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      onEdit(oldName, trimmed, editColor);
    }
    setEditingIdx(null);
    setEditName('');
    setEditColor('');
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditName('');
    setEditColor('');
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 col-span-1 md:col-span-2 text-right mt-4" dir="rtl">
      <h3 className="font-extrabold text-gray-800 text-base mb-1 flex items-center gap-2">
        <Tag className="w-5 h-5 text-indigo-500" />
        إدارة تاغات الطلبيات المخصصة
      </h3>
      <p className="text-xs text-gray-500 mb-4">أضف، عدل أو احذف تاغات الطلبيات المخصصة، واختر ألوانها لتظهر في جداول وتفاصيل الطلبيات.</p>
      
      <div className="flex flex-col md:flex-row gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600">اسم التاغ الجديد</label>
          <input 
            type="text" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: مستعجل جداً"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 bg-white"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick(); }}
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600">لون التاغ</label>
          <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-gray-300 rounded-lg max-w-sm">
            {TAG_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setNewColor(preset.color)}
                className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${preset.color.split(' ')[0]} ${newColor === preset.color ? 'ring-2 ring-indigo-500 ring-offset-1 border-indigo-500 scale-105' : 'border-gray-200'}`}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        <div className="flex items-end">
          <button 
            onClick={handleAddClick}
            disabled={!newName.trim()}
            className="w-full md:w-auto bg-indigo-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة التاغ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1 text-right" dir="rtl">
        {tags.map((tag, idx) => {
          const isCurrentlyEditing = editingIdx === idx;

          return (
            <div key={`${tag.name}-${idx}`} className="flex flex-col gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 animate-fadeIn">
              {isCurrentlyEditing ? (
                <div className="flex flex-col gap-2 w-full">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(idx, tag.name);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1 p-1 bg-white border border-gray-200 rounded-lg">
                    {TAG_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setEditColor(preset.color)}
                        className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${preset.color.split(' ')[0]} ${editColor === preset.color ? 'ring-1 ring-indigo-500 scale-105' : 'border-gray-200'}`}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-1 border-t border-slate-200/50 pt-1.5">
                    <button
                      onClick={() => handleSaveEdit(idx, tag.name)}
                      className="text-green-600 hover:bg-green-50 px-2 py-0.5 rounded text-xs font-bold transition flex items-center gap-0.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      حفظ
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-500 hover:bg-gray-100 px-2 py-0.5 rounded text-xs transition flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-extrabold border shadow-sm ${tag.color}`}>
                    {tag.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleStartEdit(idx, tag.name, tag.color)}
                      className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition cursor-pointer"
                      title="تعديل هذا التاغ"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onRemove(tag.name)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded-md transition cursor-pointer"
                      title="حذف هذا التاغ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {tags.length === 0 && (
          <div className="col-span-full text-center text-gray-400 text-xs py-4 bg-white rounded-lg border border-slate-100">لا توجد تاغات مضافة بعد. يمكنك إضافة تاغات جديدة بالاستعانة بالنموذج أعلاه.</div>
        )}
      </div>
    </div>
  );
}

interface ArrayEditorProps {
  title: string;
  desc: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
  onEdit: (oldVal: string, newVal: string) => void;
  immutableItems?: string[];
}

function ArrayEditor({ title, desc, items, onAdd, onRemove, onEdit, immutableItems }: ArrayEditorProps) {
  const [newVal, setNewVal] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleAddClick = () => {
    const trimmed = newVal.trim();
    if (trimmed) {
      onAdd(trimmed);
      setNewVal('');
    }
  };

  const handleStartEdit = (idx: number, currentVal: string) => {
    setEditingIdx(idx);
    setEditVal(currentVal);
  };

  const handleSaveEdit = (idx: number, oldVal: string) => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== oldVal) {
      onEdit(oldVal, trimmed);
    }
    setEditingIdx(null);
    setEditVal('');
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditVal('');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{desc}</p>
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={newVal} 
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="أضف قيمة جديدة..."
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick(); }}
        />
        <button 
          onClick={handleAddClick}
          className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-right" dir="rtl">
        {items.map((item: string, idx: number) => {
          const isImmutable = immutableItems?.includes(item);
          const isCurrentlyEditing = editingIdx === idx;

          return (
            <div key={`${item}-${idx}`} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100 animate-fadeIn">
              {isCurrentlyEditing ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(idx, item);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveEdit(idx, item)}
                      className="text-green-600 hover:bg-green-50 p-1 rounded transition"
                      title="حفظ"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-400 hover:bg-gray-100 p-1 rounded transition"
                      title="إلغاء الإجراء"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-700 font-medium">
                    {item}
                    {isImmutable && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded-full mr-2">
                        أساسي للنظام
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {!isImmutable ? (
                      <>
                        <button 
                          onClick={() => handleStartEdit(idx, item)}
                          className="text-blue-500 hover:bg-blue-50 p-1 rounded transition"
                          title="تعديل هذا الخيار"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(item)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded transition cursor-pointer"
                          title="حذف هذا الخيار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold px-2 py-1 bg-gray-100 rounded cursor-not-allowed select-none">
                        غير قابل للتغيير
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-4">القائمة فارغة</div>
        )}
      </div>

      {/* Confirmation Modal for removing item */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 text-right animate-scaleUp">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد الحذف</h3>
                <p className="text-xs text-rose-600 font-bold">{title}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              هل أنت متأكد من حذف <strong>"{itemToDelete}"</strong>؟ لن تظهر هذه القيمة مجدداً في خيارات النظام.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(itemToDelete);
                  setItemToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsConfig() {
  const { settings, updateSettings, users } = useStore();
  
  const [status1, setStatus1] = useState<string[]>(settings?.status1Options || []);
  const [status2, setStatus2] = useState<string[]>(settings?.status2Options || []);
  const [delivery, setDelivery] = useState<string[]>(settings?.deliveryCompanies || []);
  const [confirmers, setConfirmers] = useState<string[]>(settings?.confirmers || []);
  const [tags, setTags] = useState<OrderTag[]>(settings?.tags || DEFAULT_TAGS);

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeForm, setThemeForm] = useState<any>({
    id: '', name: 'ثيم جديد', sidebarBg: '#1a1a1a', sidebarActiveBg: '#2563eb', primaryColor: '#2563eb', primaryHover: '#1d4ed8', primaryLight: '#eff6ff', primaryLightBorder: '#bfdbfe'
  });

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('رسالة تجريبية من تطبيق إدارة المبيعات!');
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message: string } | null>(null);

  const [metaTokenInput, setMetaTokenInput] = useState(settings?.metaAdsToken || '');
  const [metaTokenSaving, setMetaTokenSaving] = useState(false);
  const [metaTestLoading, setMetaTestLoading] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<{ success?: boolean; message: string; count?: number } | null>(null);

  const integrationDelivery = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name) || [];
  const combinedDelivery = Array.from(new Set([...delivery, ...integrationDelivery]));

  const IMMUTABLE_STATUS1 = ['جديد', 'قيد المراجعة', 'مؤكد', 'ملغى', 'مؤجل', 'لا يرد'];
  const IMMUTABLE_STATUS2 = ['قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'];

  useEffect(() => {
    if (settings) {
      // Always ensure the immutable states are present during initialization
      const s1 = settings.status1Options || [];
      const s2 = settings.status2Options || [];
      
      const mergedS1 = Array.from(new Set([...IMMUTABLE_STATUS1, ...s1]));
      const mergedS2 = Array.from(new Set([...IMMUTABLE_STATUS2, ...s2]));

      setStatus1(mergedS1);
      setStatus2(mergedS2);
      setDelivery(settings.deliveryCompanies || []);
      setConfirmers(settings.confirmers || []);
      setTags(settings.tags || DEFAULT_TAGS);
      setMetaTokenInput(settings.metaAdsToken || '');
    }
  }, [settings]);

  const handleSaveMetaToken = async () => {
    const trimmed = metaTokenInput.trim();
    setMetaTokenSaving(true);
    try {
      await updateSettings({ metaAdsToken: trimmed });
      try {
        if (trimmed) {
          localStorage.setItem('meta_ads_saved_token', trimmed);
        } else {
          localStorage.removeItem('meta_ads_saved_token');
        }
      } catch (e) {}
      toast.success(trimmed ? 'تم حفظ رمز وصول ميتا (Meta Token) بنجاح!' : 'تم مسح رمز وصول ميتا');
    } catch (e: any) {
      toast.error('حدث خطأ أثناء حفظ التوكن');
    } finally {
      setMetaTokenSaving(false);
    }
  };

  const handleTestMetaToken = async () => {
    const trimmed = metaTokenInput.trim();
    if (!trimmed) {
      setMetaTestResult({ success: false, message: 'يرجى إدخال رمز الوصول أولاً لاختباره' });
      return;
    }
    setMetaTestLoading(true);
    setMetaTestResult(null);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id&access_token=${trimmed}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('استجابة غير صالحة من خادم ميتا');
      }
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || 'رمز الوصول غير صالح أو منتهي الصلاحية');
      }
      const count = data.data?.length || 0;
      setMetaTestResult({
        success: true,
        message: `تم التحقق بنجاح! تم العثور على ${count} حسابات إعلانية مرتبطة بهذا الرمز.`,
        count
      });
      // Also auto-save if verified successfully
      await updateSettings({ metaAdsToken: trimmed });
      try {
        localStorage.setItem('meta_ads_saved_token', trimmed);
      } catch (e) {}
      toast.success('التوكن صالح وتم حفظه في النظام تلقائياً!');
    } catch (err: any) {
      setMetaTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بميتا. تأكد من صحة التوكن والاتصال بالإنترنت.'
      });
    } finally {
      setMetaTestLoading(false);
    }
  };

  const handleClearMetaToken = async () => {
    setMetaTokenInput('');
    setMetaTestResult(null);
    await updateSettings({ metaAdsToken: '' });
    try {
      localStorage.removeItem('meta_ads_saved_token');
    } catch (e) {}
    toast.success('تم مسح التوكن المحفوظ بنجاح');
  };

  const handleAddTag = (name: string, color: string) => {
    if (name && !tags.some(t => t.name === name)) {
      const updated = [...tags, { name, color }];
      setTags(updated);
      updateSettings({ tags: updated });
    }
  };

  const handleRemoveTag = (name: string) => {
    const updated = tags.filter(t => t.name !== name);
    setTags(updated);
    updateSettings({ tags: updated });
  };

  const handleEditTag = (oldName: string, newName: string, newColor: string) => {
    const updated = tags.map(t => t.name === oldName ? { name: newName, color: newColor } : t);
    setTags(updated);
    updateSettings({ tags: updated });
  };

  if (!settings) {
    return <div className="p-4 text-center">جاري التحميل...</div>;
  }

  const handleManualSave = () => {
    // Force merging of immutable values to protect system logic
    const finalStatus1 = Array.from(new Set([...IMMUTABLE_STATUS1, ...status1]));
    const finalStatus2 = Array.from(new Set([...IMMUTABLE_STATUS2, ...status2]));

    updateSettings({
      status1Options: finalStatus1,
      status2Options: finalStatus2,
      deliveryCompanies: delivery,
      confirmers: confirmers,
      tags: tags,
    });
    alert('تم حفظ الإعدادات بنجاح في قاعدة البيانات!');
  };

  const handleAddItem = (
    val: string, 
    items: string[], 
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    fieldKey: keyof SystemSettings
  ) => {
    if (val && !items.includes(val)) {
      const updated = [...items, val];
      setter(updated);
      
      // Auto-save instantly
      updateSettings({
        [fieldKey]: updated
      });
    }
  };

  const handleRemoveItem = (
    val: string, 
    items: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    fieldKey: keyof SystemSettings
  ) => {
    const updated = items.filter(i => i !== val);
    setter(updated);
    
    // Auto-save instantly
    updateSettings({
      [fieldKey]: updated
    });
  };

  const handleEditItem = (
    oldVal: string,
    newVal: string,
    items: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    fieldKey: keyof SystemSettings
  ) => {
    const updated = items.map(i => i === oldVal ? newVal : i);
    setter(updated);

    // Auto-save instantly
    updateSettings({
      [fieldKey]: updated
    });
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim() || !testMessage.trim()) {
      setTestStatus({ success: false, message: 'يرجى إدخال رقم هاتف ونص الرسالة' });
      return;
    }

    setTestLoading(true);
    setTestStatus(null);

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gateway: settings.smsGateway || 'sms_algerie',
          to: testPhone,
          message: testMessage,
          smsAlgerieToken: settings.smsAlgerieToken || '',
          smsAlgerieSender: settings.smsAlgerieSender || '',
          smsTwilioSid: settings.smsTwilioSid || '',
          smsTwilioToken: settings.smsTwilioToken || '',
          smsTwilioNumber: settings.smsTwilioNumber || ''
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestStatus({ success: true, message: `تم إرسال الرسالة بنجاح! معرف الرسالة: ${data.messageId}` });
      } else {
        setTestStatus({ success: false, message: data.message || 'فشل إرسال الرسالة. تحقق من الإعدادات.' });
      }
    } catch (err: any) {
      console.error(err);
      setTestStatus({ success: false, message: `خطأ اتصال: ${err.message || err}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto pb-20 text-right" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">تخصيص الخيارات</h2>
          <p className="text-sm text-gray-500 mt-1">تكوين قوائم التشغيل والخيارات المتاحة في النظام. يتم حفظ أي تعديل تلقائياً في قاعدة البيانات.</p>
        </div>
        <button 
          onClick={handleManualSave}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          حفظ التغييرات
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArrayEditor 
          title="شركات التوصيل"
          desc="تظهر هذه الشركات كخيارات توصيل في إدارة الطلبيات"
          items={combinedDelivery}
          onAdd={(val) => handleAddItem(val, delivery, setDelivery, 'deliveryCompanies')}
          onRemove={(val) => handleRemoveItem(val, delivery, setDelivery, 'deliveryCompanies')}
          onEdit={(oldVal, newVal) => handleEditItem(oldVal, newVal, delivery, setDelivery, 'deliveryCompanies')}
          immutableItems={integrationDelivery}
        />
        <ArrayEditor 
          title="مؤكدو الطلبيات (الموظفين)"
          desc="أسماء موظفي تأكيد الطلبيات لتسهيل الإختيار"
          items={confirmers}
          onAdd={(val) => handleAddItem(val, confirmers, setConfirmers, 'confirmers')}
          onRemove={(val) => handleRemoveItem(val, confirmers, setConfirmers, 'confirmers')}
          onEdit={(oldVal, newVal) => handleEditItem(oldVal, newVal, confirmers, setConfirmers, 'confirmers')}
        />
        <ArrayEditor 
          title="حالات الطلبية المُخصصة (1)"
          desc="تظهر كخيارات للحالة الأساسية (مثل: مؤكد، ملغى)"
          items={status1}
          onAdd={(val) => handleAddItem(val, status1, setStatus1, 'status1Options')}
          onRemove={(val) => handleRemoveItem(val, status1, setStatus1, 'status1Options')}
          onEdit={(oldVal, newVal) => handleEditItem(oldVal, newVal, status1, setStatus1, 'status1Options')}
          immutableItems={IMMUTABLE_STATUS1}
        />
        <ArrayEditor 
          title="حالات الطلبية المُخصصة (2)"
          desc="تظهر كخيارات لحالة الشحن والإرجاع (مثل: مستلم، مرتجع)"
          items={status2}
          onAdd={(val) => handleAddItem(val, status2, setStatus2, 'status2Options')}
          onRemove={(val) => handleRemoveItem(val, status2, setStatus2, 'status2Options')}
          onEdit={(oldVal, newVal) => handleEditItem(oldVal, newVal, status2, setStatus2, 'status2Options')}
          immutableItems={IMMUTABLE_STATUS2}
        />
        <TagsEditor
          tags={tags}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
          onEdit={handleEditTag}
        />
      </div>

      {/* 🚀 الصفحة الرئيسية الافتراضية عند فتح التطبيق */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn" id="default-landing-view-setting">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">
                الصفحة الرئيسية الافتراضية عند فتح التطبيق (Landing Screen)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                اختر القسم أو الشاشة التي يفتح عليها التطبيق مباشرة وبشكل افتراضي عند تشغيله أو إعادة تحميل المتصفح.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              الصفحة الحالية: {LANDING_PAGE_OPTIONS.find(o => o.id === (settings.defaultLandingView || 'dashboard'))?.name.split(' (')[0] || 'لوحة التحكم'}
            </span>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="mb-5 max-w-xl">
          <label className="block text-xs font-bold text-gray-700 mb-2">
            حدد الصفحة / القسم الافتراضي:
          </label>
          <select
            value={settings.defaultLandingView || 'dashboard'}
            onChange={(e) => {
              const val = e.target.value as ViewState;
              updateSettings({ defaultLandingView: val });
              localStorage.setItem('app_default_landing_view', val);
              const found = LANDING_PAGE_OPTIONS.find(o => o.id === val);
              toast.success(`تم حفظ "${found?.name.split(' (')[0]}" كصفحة رئيسية افتراضية`);
            }}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
          >
            {LANDING_PAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} — [{opt.category}]
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
            💡 نصيحة: يمكنك اختيار <span className="font-bold text-indigo-600">"شبكة الأقسام والتطبيقات (App Sections Grid)"</span> لتظهر لك كل الخدمات والأدوات فور تشغيل البرنامج.
          </p>
        </div>

        {/* Visual Quick Select Cards for Popular Choices */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2.5">
            أو اختر سريعاً بالنقر على القسم المفضل:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LANDING_PAGE_OPTIONS.slice(0, 8).map((opt) => {
              const Icon = opt.icon;
              const isCurrent = (settings.defaultLandingView || 'dashboard') === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updateSettings({ defaultLandingView: opt.id });
                    localStorage.setItem('app_default_landing_view', opt.id);
                    toast.success(`تم حفظ "${opt.name.split(' (')[0]}" كصفحة رئيسية افتراضية`);
                  }}
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                      : 'bg-gray-50/70 hover:bg-white hover:border-gray-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-gray-700 border border-gray-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-2xs">
                        <Check className="w-3 h-3" />
                        الافتراضية
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isCurrent ? 'text-indigo-950' : 'text-gray-800'}`}>
                      {opt.name.split(' (')[0]}
                    </h4>
                    <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* الخيارات الافتراضية للطلبيات الجديدة / المستوردة */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <h3 className="font-bold text-gray-800 text-lg mb-2 text-right">
          الخيارات الافتراضية للطلبيات الجديدة / المستوردة
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          اختر القيم الافتراضية التي سيتم تطبيقها تلقائياً على الطلبيات الجديدة (سواء المضافة يدوياً أو المستوردة عبر قنوات الربط مثل WooCommerce) في حال كانت هذه الحقول فارغة.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Default Confirmer */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">الموظف المؤكِّد الافتراضي</label>
            <select
              value={settings.defaultConfirmedBy || ''}
              onChange={(e) => updateSettings({ defaultConfirmedBy: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">-- بدون قيمة افتراضية --</option>
              {users?.filter(u => u.role === 'confirmer').map((u) => (
                <option key={u.id} value={u.displayName}>{u.displayName}</option>
              ))}
            </select>
          </div>

          {/* Default Delivery Company */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">شركة التوصيل الافتراضية</label>
            <select
              value={settings.defaultDeliveryCompany || ''}
              onChange={(e) => updateSettings({ defaultDeliveryCompany: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">-- بدون قيمة افتراضية --</option>
              {combinedDelivery.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Default Status 1 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">حالة الطلبية الأساسية (حالة 1)</label>
            <select
              value={settings.defaultStatus1 || ''}
              onChange={(e) => updateSettings({ defaultStatus1: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">جديد (الافتراضي العام)</option>
              {status1.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Default Status 2 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">حالة الشحن والتوصيل (حالة 2)</label>
            <select
              value={settings.defaultStatus2 || ''}
              onChange={(e) => updateSettings({ defaultStatus2: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">-- بدون قيمة افتراضية --</option>
              {status2.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* إعدادات سعر الصرف والعملة */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <h3 className="font-bold text-gray-800 text-lg mb-2 text-right">
          إعدادات سعر الصرف والعملة (Exchange Rate)
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          تعديل سعر صرف الدولار مقابل الدينار الجزائري (د.ج) المستخدم لحساب تكاليف الإعلانات ومصاريف الحملات في التقارير والتحليلات.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">سعر صرف الدولار (USD) مقابل الدينار الجزائري (DZD)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="any"
                value={settings?.exchangeRate !== undefined ? settings.exchangeRate : 245}
                onChange={(e) => updateSettings({ exchangeRate: parseFloat(e.target.value) || 245 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                placeholder="مثال: 245"
              />
              <span className="inline-flex items-center px-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-500 text-xs font-bold">
                د.ج / $
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">القيمة الافتراضية هي 245 د.ج لكل 1 دولار.</p>
          </div>
        </div>
      </div>

      {/* إعدادات طريقة احتساب المرتجع (اشتراك شهري أو دفع لكل طلبية) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn" id="return-cost-settings">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">
                طريقة احتساب مصاريف المرتجع لشركات الشحن (Return Cost Mode)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                تحديد كيفية احتساب ودفع تكاليف الطرود المرتجعة: هل يتم الدفع لكل طلبية مرتجعة أو كاشتراك شهري ثابت؟
              </p>
            </div>
          </div>

          <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${
            settings?.returnCostMode === 'monthly_subscription'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {settings?.returnCostMode === 'monthly_subscription' ? 'مفعل: اشتراك شهري ثابت' : 'مفعل: دفع لكل طلبية'}
          </span>
        </div>

        {/* Toggle Switcher */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-700 mb-2">
            اختر نظام احتساب تكلفة المرتجع:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <button
              type="button"
              onClick={() => {
                updateSettings({ returnCostMode: 'per_order' });
                toast.success('تم تفعيل نظام الدفع لكل طلبية مرتجعة');
              }}
              className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                settings?.returnCostMode !== 'monthly_subscription'
                  ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">📦</span>
              <div>
                <span className="block font-black text-sm text-gray-900">دفع لكل طلبية مرتجعة</span>
                <span className="block text-xs text-gray-500 mt-1">يتم خصم مبلغ محدد عن كل طرد مرتجع (افتراضياً {settings?.returnCost || 400} د.ج)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                updateSettings({ returnCostMode: 'monthly_subscription' });
                toast.success('تم تفعيل نظام الاشتراك الشهري الثابت للمرتجع');
              }}
              className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                settings?.returnCostMode === 'monthly_subscription'
                  ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">📅</span>
              <div>
                <span className="block font-black text-sm text-gray-900">اشتراك شهري ثابت</span>
                <span className="block text-xs text-gray-500 mt-1">مبلغ ثابت تدفعه لشركة التوصيل شهرياً ويُعاد الحساب لكافة الأشهر السابقة والحالية</span>
              </div>
            </button>
          </div>
        </div>

        {/* Inputs based on selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              قيمة الاشتراك الشهري الثابت للمرتجع (د.ج / شهر)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={settings?.returnMonthlySubscription !== undefined ? settings.returnMonthlySubscription : ''}
                onChange={(e) => updateSettings({ returnMonthlySubscription: Number(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                placeholder="مثال: 5000"
              />
              <span className="inline-flex items-center px-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-500 text-xs font-bold">
                د.ج / شهر
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">عند تفعيل وضع الاشتراك، يتم ضرب هذا المبلغ في عدد الشهور لكل فترة وتتوقف خصومات المرتجع الفردية.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              تكلفة المرتجع الافتراضية لكل طلبية (د.ج / طلبية)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={settings?.returnCost !== undefined ? settings.returnCost : 400}
                onChange={(e) => updateSettings({ returnCost: Number(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                placeholder="مثال: 400"
              />
              <span className="inline-flex items-center px-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-500 text-xs font-bold">
                د.ج / طلبية
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">تُطبق عند العمل بنظام الدفع لكل طلبية (الافتراضي 400 د.ج).</p>
          </div>
        </div>
      </div>

      {/* إعدادات التحديث التلقائي للمتاجر */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <h3 className="font-bold text-gray-800 text-lg mb-2 text-right">
          إعدادات جلب الطلبيات والمستودع التلقائي (Auto-Sync)
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          تفعيل هذه الميزة سيقوم بجلب الطلبيات الجديدة والسلات المتروكة تلقائياً من المتاجر الفعالة أثناء استخدامك للوحة التحكم.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.autoSyncEnabled || false}
                onChange={(e) => updateSettings({ autoSyncEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="mr-3 text-sm font-bold text-gray-700">تفعيل جلب الطلبات والسلات المتروكة تلقائيًا</span>
            </label>
          </div>
          
          <div className={`transition-opacity ${!settings.autoSyncEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
             <label className="block text-xs font-bold text-gray-700 mb-2">تحديث كل (بالثواني)</label>
             <input
                type="number"
                min="10"
                max="86400"
                value={settings.autoSyncIntervalSeconds || 900}
                onChange={(e) => updateSettings({ autoSyncIntervalSeconds: parseInt(e.target.value) || 900 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
             />
          </div>
        </div>
      </div>

      {/* إعدادات التنبيهات المخصصة */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <h3 className="font-bold text-gray-800 text-lg mb-2 text-right">
          إعدادات التنبيهات (Notifications)
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          تخصيص التنبيهات الصوتية والبصرية عند وصول طلبية أو تحديث الحالات وانخفاض المخزون.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-gray-700 border-b pb-2">تنبيهات حالات الطلبيات</h4>
            
            <label className="relative inline-flex items-center cursor-pointer mb-2">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.soundNotificationEnabled || false}
                onChange={(e) => updateSettings({ soundNotificationEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="mr-3 text-sm font-bold text-gray-700">تفعيل التنبيه الصوتي (صوت إشعار)</span>
            </label>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.visualNotificationEnabled || false}
                onChange={(e) => updateSettings({ visualNotificationEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="mr-3 text-sm font-bold text-gray-700">تفعيل التنبيه البصري (ظهور رسالة جانبية)</span>
            </label>

            <h4 className="font-bold text-sm text-gray-700 border-b pb-2 pt-4">إدارة وتنبيهات المخزون (Inventory)</h4>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-2">طريقة إدارة المخزون</label>
              <select
                value={settings.inventoryManagementMode || 'local'}
                onChange={(e) => updateSettings({ inventoryManagementMode: e.target.value as 'sync' | 'local' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="local">إدارة المخزون محلياً من التطبيق (الافتراضي)</option>
                <option value="sync">مزامنة المخزون مع المتاجر كليراً</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">تحديد ما إذا كان المخزون يدار يدوياً من هذه اللوحة أو يعتمد على ما يرسل من منصات البيع أثناء المزامنة.</p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.lowInventoryAlertEnabled || false}
                onChange={(e) => updateSettings({ lowInventoryAlertEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="mr-3 text-sm font-bold text-gray-700">تفعيل التنبيه عند انخفاض المخزون</span>
            </label>

            <div className={`transition-opacity ${!settings.lowInventoryAlertEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-xs font-bold text-gray-700 mb-2 mt-2">الحد الحرج للمخزون (الكمية)</label>
              <input
                type="number"
                min="0"
                value={settings?.lowInventoryThreshold !== undefined ? settings.lowInventoryThreshold : 5}
                onChange={(e) => updateSettings({ lowInventoryThreshold: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 border-b pb-2">تحديد الحالات التي تطلق تنبيهاً</label>
            <div className="flex flex-wrap gap-2 pt-2">
              {status1.map(status => {
                const isSelected = settings.notificationStatuses?.includes(status) || false;
                return (
                  <button
                    key={status}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    onClick={() => {
                      const current = settings.notificationStatuses || [];
                      const updated = isSelected 
                        ? current.filter(s => s !== status)
                        : [...current, status];
                      updateSettings({ notificationStatuses: updated });
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* الهوية البصرية */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setThemeForm({ id: `custom_${Date.now()}`, name: 'ثيم جديد', sidebarBg: '#1a1a1a', sidebarActiveBg: '#2563eb', primaryColor: '#2563eb', primaryHover: '#1d4ed8', primaryLight: '#eff6ff', primaryLightBorder: '#bfdbfe' });
                setShowThemeModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة باليت جديدة
            </button>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">الهوية البصرية والألوان (Theme)</h3>
            <p className="text-xs text-gray-500 mt-1">تغيير ألوان النظام والقائمة الجانبية والأزرار لتناسب علامتك التجارية.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'classic', name: 'الكلاسيكي الأزرق', color1: '#1a1a1a', color2: '#2563eb', isCustom: false },
            { id: 'emerald', name: 'الزمرد الأخضر', color1: '#064e3b', color2: '#10b981', isCustom: false },
            { id: 'ruby', name: 'الأحمر الياقوتي', color1: '#4c0519', color2: '#e11d48', isCustom: false },
            { id: 'midnight', name: 'النيلي المظلم', color1: '#0f172a', color2: '#6366f1', isCustom: false },
            { id: 'desert', name: 'البرتقالي الدافئ', color1: '#451a03', color2: '#f59e0b', isCustom: false },
            { id: 'ocean', name: 'أزرق المحيط', color1: '#083344', color2: '#0ea5e9', isCustom: false },
            ...(settings.customThemePalettes || []).map(t => ({ id: t.id, name: t.name, color1: t.sidebarBg, color2: t.primaryColor, isCustom: true, raw: t }))
          ].map(theme => {
            const isSelected = (settings.themePalette || 'classic') === theme.id;
            return (
              <div 
                key={theme.id}
                className={`relative cursor-pointer rounded-xl border-2 p-3 flex flex-col items-center gap-3 transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="w-full h-12 rounded-lg flex overflow-hidden shadow-sm" onClick={() => updateSettings({ themePalette: theme.id })}>
                  <div className="w-1/3 h-full" style={{ backgroundColor: theme.color1 }}></div>
                  <div className="w-2/3 h-full" style={{ backgroundColor: theme.color2 }}></div>
                </div>
                <div className="flex items-center justify-between w-full mt-1" onClick={() => updateSettings({ themePalette: theme.id })}>
                  {isSelected ? <div className="text-blue-500"><Check className="w-4 h-4" /></div> : <div></div>}
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{theme.name}</span>
                </div>
                {theme.isCustom && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const confirmDelete = window.confirm('هل تريد حذف هذه الباليت؟');
                      if (confirmDelete) {
                        const updated = (settings.customThemePalettes || []).filter(t => t.id !== theme.id);
                        const updates: any = { customThemePalettes: updated };
                        if (isSelected) updates.themePalette = 'classic';
                        updateSettings(updates);
                      }
                    }}
                    className="absolute -top-2 -right-2 bg-white text-red-500 border border-red-100 p-1.5 rounded-full shadow-sm hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 💬 تكامل الرسائل النصية القصيرة SMS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn">
        <div className="flex items-center gap-3 border-b pb-4 mb-6">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="font-bold text-gray-800 text-lg">تكامل الرسائل النصية (SMS Integration)</h3>
            <p className="text-sm text-gray-500 mt-1">اربط بوابات الرسائل النصية لإرسال إشعارات للزبائن حول حالات طلبياتهم أو لتذكيرهم بالسلات المتروكة يدوياً وتلقائياً.</p>
          </div>
        </div>

        <div className="mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.smsEnabled || false}
                onChange={(e) => updateSettings({ smsEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="mr-3 text-sm font-bold text-gray-700">تفعيل إرسال رسائل الـ SMS في التطبيق</span>
            </label>
          </div>
          <span className="text-[11px] text-blue-800 font-semibold bg-blue-100 px-2.5 py-1 rounded-full">
            {settings.smsEnabled ? "مُفَعّل" : "مُعطّل"}
          </span>
        </div>

        {settings.smsEnabled && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. اختيار البوابة */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">اختر بوابة إرسال الـ SMS</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`border p-4 rounded-xl cursor-pointer transition-all ${settings.smsGateway !== 'twilio' ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => updateSettings({ smsGateway: 'sms_algerie' })}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-800">SMS Algerie (موصى به للجزائر)</span>
                    <input type="radio" checked={settings.smsGateway !== 'twilio'} readOnly />
                  </div>
                  <p className="text-xs text-gray-500">موصى به لزبائن الجزائر لتوفير التكاليف (أرخص بـ 70%) مع سرعة وضمان وصول الرسائل لشبكات موبيليس، جيزي، وأوريدو، وإمكانية الدفع عبر BaridiMob.</p>
                </div>

                <div 
                  className={`border p-4 rounded-xl cursor-pointer transition-all ${(settings.smsGateway === 'twilio') ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => updateSettings({ smsGateway: 'twilio' })}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-800">Twilio (عالمي)</span>
                    <input type="radio" checked={settings.smsGateway === 'twilio'} readOnly />
                  </div>
                  <p className="text-xs text-gray-500">بوابة عالمية ممتازة تناسب جميع الدول، ولكن بتكاليف أعلى لرسائل الجزائر.</p>
                </div>
              </div>
            </div>

            {/* 2. إعدادات الاتصال بالبوابة */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              {settings.smsGateway !== 'twilio' ? (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-gray-400" />
                      مفتاح الـ API أو معلومات الدخول (SMS Algerie Token)
                    </label>
                    <input 
                      type="text"
                      placeholder="أدخل الـ Token أو username:password"
                      value={settings.smsAlgerieToken || ''}
                      onChange={(e) => updateSettings({ smsAlgerieToken: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">تنسيق: مفتاح الـ API مباشرة، أو اسم المستخدم وكلمة المرور مفصولين بـ : (مثال: `myuser:mypassword`)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم المرسل (Sender ID)</label>
                    <input 
                      type="text"
                      placeholder="مثال: MYSTORE"
                      value={settings.smsAlgerieSender || ''}
                      onChange={(e) => updateSettings({ smsAlgerieSender: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">اسم مرسل معتمد من شركة الاتصالات.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-gray-400" />
                      Account SID (Twilio)
                    </label>
                    <input 
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.smsTwilioSid || ''}
                      onChange={(e) => updateSettings({ smsTwilioSid: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Auth Token (Twilio)</label>
                    <input 
                      type="password"
                      placeholder="أدخل توكن Twilio"
                      value={settings.smsTwilioToken || ''}
                      onChange={(e) => updateSettings({ smsTwilioToken: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      رقم الهاتف الافتراضي (Twilio Number)
                    </label>
                    <input 
                      type="text"
                      placeholder="+1234567890"
                      value={settings.smsTwilioNumber || ''}
                      onChange={(e) => updateSettings({ smsTwilioNumber: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            {/* 3. الإرسال التلقائي حسب الحالة */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">الإرسال التلقائي عند تغيير الحالة</label>
              <p className="text-xs text-gray-400 mb-3">حدد الحالات التي تريد أن يقوم التطبيق بإرسال رسالة SMS تلقائية للزبون فور تفعيلها.</p>
              <div className="flex flex-wrap gap-2">
                {['مؤكد', 'تم الشحن', 'في الطريق', 'مرتجع'].map(status => {
                  const isSelected = settings.smsAutoSendOnStatus?.includes(status) || false;
                  return (
                    <button
                      key={status}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      onClick={() => {
                        const current = settings.smsAutoSendOnStatus || [];
                        const updated = isSelected 
                          ? current.filter(s => s !== status)
                          : [...current, status];
                        updateSettings({ smsAutoSendOnStatus: updated });
                      }}
                    >
                      عند تغيير الحالة إلى "{status}"
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. قوالب الرسائل النصية */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-gray-400">المتغيرات: `{"{customer_name}"}`، `{"{order_id}"}`، `{"{tracking_id}"}`، `{"{delivery_company}"}`، `{"{checkout_url}"}`</span>
                <label className="block text-xs font-bold text-gray-700">قوالب الرسائل الجاهزة</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'confirmation', label: 'قالب تأكيد الطلب (عند التغيير لـ "مؤكد")', default: 'مرحباً {customer_name}، تم تأكيد طلبيتك رقم {order_id} بنجاح. سنقوم بشحنها قريباً! شكراً لثقتك بنا.' },
                  { key: 'shipping', label: 'قالب الشحن (عند التغيير لـ "تم الشحن")', default: 'زبوننا الكريم {customer_name}، تم شحن طلبيتك رقم {order_id} عبر شركة {delivery_company}. رقم التتبع الخاص بك هو {tracking_id}.' },
                  { key: 'out_for_delivery', label: 'قالب قيد التوصيل (عند التغيير لـ "في الطريق")', default: 'مرحباً {customer_name}، طلبيتك رقم {order_id} قيد التوصيل الآن مع المندوب. يرجى إبقاء هاتفك متاحاً لتسهيل التسليم.' },
                  { key: 'return', label: 'قالب المرتجع (عند التغيير لـ "مرتجع")', default: 'زبوننا الكريم، نأسف لعدم استلام طلبيتك رقم {order_id}. تم تسجيلها كمرتجعة. يرجى التواصل معنا لإعادة المحاولة.' },
                  { key: 'abandoned', label: 'قالب تذكير بالسلة المتروكة', default: 'مرحباً {customer_name}، نلاحظ أنك لم تكمل طلبك في متجرنا. لقد احتفظنا بسلتك! أكمل طلبك الآن من هنا: {checkout_url}' },
                ].map(template => {
                  const currentValue = settings.smsTemplates?.[template.key] || template.default;
                  return (
                    <div key={template.key} className="border border-gray-100 p-3 rounded-xl bg-gray-50/50">
                      <label className="block text-xs font-bold text-gray-700 mb-1">{template.label}</label>
                      <textarea
                        rows={3}
                        value={currentValue}
                        onChange={(e) => {
                          const currentTemplates = settings.smsTemplates || {};
                          updateSettings({
                            smsTemplates: {
                              ...currentTemplates,
                              [template.key]: e.target.value
                            }
                          });
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white shadow-inner"
                        dir="auto"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. تجربة الإرسال */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-sm text-gray-800 mb-3">تجربة الإرسال (Test Sender)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف للتجربة</label>
                  <input 
                    type="text" 
                    placeholder="مثال: 0550123456" 
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">نص الرسالة</label>
                    <input 
                      type="text" 
                      value={testMessage}
                      onChange={e => setTestMessage(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testLoading}
                    onClick={handleSendTestSms}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 h-10 flex items-center justify-center gap-1 self-end"
                  >
                    {testLoading ? 'جاري الإرسال...' : 'إرسال تجريبي'}
                  </button>
                </div>
              </div>
              {testStatus && (
                <div className={`mt-3 p-3 rounded-lg text-xs font-medium border ${testStatus.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {testStatus.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔷 إعدادات الربط مع إعلانات ميتا (Meta / Facebook Ads API) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6 text-right animate-fadeIn" id="meta-ads-settings">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <Facebook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-lg">
                  إعدادات الربط مع إعلانات ميتا (Meta Ads API Token)
                </h3>
                {settings.metaAdsToken ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    متصل ومحفوظ
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    غير متصل
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                احفظ رمز وصول ميتا (Access Token) مرة واحدة هنا ليتم استخدامه تلقائياً في استيراد الحملات، مزامنة المصروفات، ومحاكي الأرباح دون الحاجة لإدخاله في كل مرة.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 max-w-3xl">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700">
                رمز الوصول (Meta User / System User Access Token):
              </label>
              <span className="text-[11px] text-gray-400 font-mono">
                صلاحية مطلوبة: ads_read, read_insights
              </span>
            </div>
            <div className="relative">
              <input
                type={showMetaToken ? "text" : "password"}
                value={metaTokenInput}
                onChange={(e) => setMetaTokenInput(e.target.value)}
                placeholder="EAAGm0PX4ZCpwBA..."
                dir="ltr"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-mono bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowMetaToken(!showMetaToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                title={showMetaToken ? "إخفاء" : "إظهار"}
              >
                {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              💡 يمكنك الحصول على هذا الرمز من <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">مستكشف Graph API</a> أو بإنشاء مستخدم نظام (System User) في مدير أعمال ميتا برمز دائم لا تنتهي صلاحيته.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveMetaToken}
              disabled={metaTokenSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {metaTokenSaving ? 'جاري الحفظ...' : 'حفظ التوكن في النظام'}
            </button>

            <button
              type="button"
              onClick={handleTestMetaToken}
              disabled={metaTestLoading || !metaTokenInput.trim()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors border border-gray-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {metaTestLoading ? <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
              <span>اختبار الاتصال وجلب الحسابات</span>
            </button>

            {settings.metaAdsToken && (
              <button
                type="button"
                onClick={handleClearMetaToken}
                className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer mr-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                مسح التوكن
              </button>
            )}
          </div>

          {metaTestResult && (
            <div className={`p-4 rounded-xl text-xs font-medium border animate-fadeIn flex items-start gap-2.5 ${metaTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {metaTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              <div>
                <div className="font-bold">{metaTestResult.success ? 'تم الاتصال بنجاح!' : 'فشل الاتصال:'}</div>
                <div className="mt-0.5">{metaTestResult.message}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">إضافة باليت ألوان جديدة</h3>
              <button onClick={() => setShowThemeModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">اسم الباليت</label>
                <input 
                  type="text" 
                  value={themeForm.name || ''} 
                  onChange={e => setThemeForm({...themeForm, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  placeholder="مثال: باليت متجري"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">لون القائمة الجانبية</label>
                  <div className="flex gap-2">
                    <input type="color" value={themeForm.sidebarBg || ''} onChange={e => setThemeForm({...themeForm, sidebarBg: e.target.value})} className="h-9 w-12 cursor-pointer border-0 rounded-md p-1" />
                    <input type="text" value={themeForm.sidebarBg || ''} onChange={e => setThemeForm({...themeForm, sidebarBg: e.target.value})} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 text-xs outline-none focus:border-blue-500" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">اللون الأساسي للزر</label>
                  <div className="flex gap-2">
                    <input type="color" value={themeForm.primaryColor || ''} onChange={e => setThemeForm({...themeForm, primaryColor: e.target.value, sidebarActiveBg: e.target.value})} className="h-9 w-12 cursor-pointer border-0 rounded-md p-1" />
                    <input type="text" value={themeForm.primaryColor || ''} onChange={e => setThemeForm({...themeForm, primaryColor: e.target.value, sidebarActiveBg: e.target.value})} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 text-xs outline-none focus:border-blue-500" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">لون التحويم (Hover)</label>
                  <div className="flex gap-2">
                    <input type="color" value={themeForm.primaryHover || ''} onChange={e => setThemeForm({...themeForm, primaryHover: e.target.value})} className="h-9 w-12 cursor-pointer border-0 rounded-md p-1" />
                    <input type="text" value={themeForm.primaryHover || ''} onChange={e => setThemeForm({...themeForm, primaryHover: e.target.value})} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 text-xs outline-none focus:border-blue-500" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">اللون الخفيف (للخلفيات)</label>
                  <div className="flex gap-2">
                    <input type="color" value={themeForm.primaryLight || ''} onChange={e => setThemeForm({...themeForm, primaryLight: e.target.value})} className="h-9 w-12 cursor-pointer border-0 rounded-md p-1" />
                    <input type="text" value={themeForm.primaryLight || ''} onChange={e => setThemeForm({...themeForm, primaryLight: e.target.value})} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 text-xs outline-none focus:border-blue-500" dir="ltr" />
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  if(!themeForm.name) return;
                  const newPalettes = [...(settings.customThemePalettes || []), themeForm as any];
                  updateSettings({ customThemePalettes: newPalettes });
                  setShowThemeModal(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg mt-2 transition-colors shadow-sm"
              >
                حفظ الباليت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
