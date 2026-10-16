import React, { useState } from 'react';
import { useStore } from '../../store';
import { 
  Plus, Trash2, Check, X, Building, Link2, Truck, Edit, Star, 
  RotateCcw, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Store
} from 'lucide-react';
import { ShippingIntegration } from '../../types';
import toast from 'react-hot-toast';

const DEFAULT_ALGERIA_COMPANIES = [
  'ياليدين',
  'مايسترو',
  'زد آر إكسبريس',
  'إيكوتراك',
  'أرامكس',
  'سمسا',
  'توصيل محلي'
];

export function ShippingManager() {
  const { settings, updateSettings, orders } = useStore();
  const Integrations = settings?.shippingIntegrations || [];
  const manualCompanies = Array.isArray(settings?.deliveryCompanies) ? settings.deliveryCompanies : DEFAULT_ALGERIA_COMPANIES;
  
  const [activeTab, setActiveTab] = useState<'delivery_companies' | 'api_integrations'>('delivery_companies');
  
  // API Integration form states
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    domain: ''
  });

  // Manual Company management states
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompanyName, setEditingCompanyName] = useState<string | null>(null);
  const [editCompanyValue, setEditCompanyValue] = useState('');

  // Confirmation modal states
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<ShippingIntegration | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Manual Company Handlers
  const handleAddManualCompany = async () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed) {
      toast.error('يرجى كتابة اسم شركة التوصيل');
      return;
    }
    const currentList = Array.isArray(settings?.deliveryCompanies)
      ? settings.deliveryCompanies
      : DEFAULT_ALGERIA_COMPANIES;
    if (currentList.includes(trimmed)) {
      toast.error('هذه الشركة مضافة مسبقاً');
      return;
    }

    const updated = [...currentList, trimmed];
    await updateSettings({ deliveryCompanies: updated });
    setNewCompanyName('');
    toast.success(`تمت إضافة شركة التوصيل "${trimmed}" بنجاح!`);
  };

  const handleStartEditCompany = (name: string) => {
    setEditingCompanyName(name);
    setEditCompanyValue(name);
  };

  const handleSaveEditCompany = async (oldName: string) => {
    const trimmed = editCompanyValue.trim();
    if (!trimmed) return;
    if (trimmed === oldName) {
      setEditingCompanyName(null);
      return;
    }

    const currentList = Array.isArray(settings?.deliveryCompanies)
      ? settings.deliveryCompanies
      : DEFAULT_ALGERIA_COMPANIES;
    const updated = currentList.map(c => c === oldName ? trimmed : c);
    await updateSettings({ deliveryCompanies: updated });
    setEditingCompanyName(null);
    toast.success(`تم تحديث اسم شركة التوصيل إلى "${trimmed}"`);
  };

  const handleInitiateDeleteCompany = (name: string) => {
    setCompanyToDelete(name);
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);
    try {
      const currentList = Array.isArray(settings?.deliveryCompanies)
        ? settings.deliveryCompanies
        : DEFAULT_ALGERIA_COMPANIES;
      const updated = currentList.filter(c => c !== companyToDelete);
      await updateSettings({ deliveryCompanies: updated });
      toast.success(`تم حذف شركة التوصيل "${companyToDelete}" نهائياً بنجاح`);
      setCompanyToDelete(null);
    } catch (err) {
      console.error('Error deleting company:', err);
      toast.error('حدث خطأ أثناء حذف شركة التوصيل');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsDeleting(true);
    try {
      await updateSettings({ deliveryCompanies: [] });
      toast.success('تم حذف جميع شركات التوصيل نهائياً بنجاح. يمكنك الآن إضافة شركاتك يدوياً.');
      setShowClearAllModal(false);
    } catch (err) {
      console.error('Error clearing companies:', err);
      toast.error('حدث خطأ أثناء حذف الشركات');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInitiateDeleteIntegration = (integ: ShippingIntegration) => {
    setIntegrationToDelete(integ);
  };

  const handleConfirmDeleteIntegration = async () => {
    if (!integrationToDelete) return;
    setIsDeleting(true);
    try {
      await updateSettings({
        shippingIntegrations: Integrations.filter(i => i.id !== integrationToDelete.id)
      });
      toast.success(`تم حذف ربط شركة "${integrationToDelete.name}" بنجاح`);
      setIntegrationToDelete(null);
    } catch (err) {
      console.error('Error deleting integration:', err);
      toast.error('حدث خطأ أثناء حذف الربط');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmRestoreDefaults = async () => {
    setIsDeleting(true);
    try {
      const currentList = Array.isArray(settings?.deliveryCompanies)
        ? settings.deliveryCompanies
        : [];
      const merged = Array.from(new Set([...currentList, ...DEFAULT_ALGERIA_COMPANIES]));
      await updateSettings({ deliveryCompanies: merged });
      toast.success('تمت استعادة شركات التوصيل الافتراضية بنجاح!');
      setShowRestoreModal(false);
    } catch (err) {
      console.error('Error restoring defaults:', err);
      toast.error('حدث خطأ أثناء استعادة الشركات الافتراضية');
    } finally {
      setIsDeleting(false);
    }
  };

  // 2. API Integrations Handlers
  const handleAddStart = () => {
    setFormMode('add');
    setEditingId(null);
    setSelectedVendor('');
    setFormData({ name: '', token: '', domain: '' });
  };

  const handleEditStart = (integ: ShippingIntegration) => {
    setFormMode('edit');
    setEditingId(integ.id);
    setSelectedVendor(integ.vendor || 'other');
    setFormData({
      name: integ.name || '',
      token: integ.token || '',
      domain: integ.domain || ''
    });
  };

  const handleSaveInfo = async () => {
    if (!selectedVendor || !formData.token || !formData.name) return;
    
    if (formMode === 'add') {
      const isFirst = Integrations.length === 0;
      const newIntegration: ShippingIntegration = {
        id: Date.now().toString(),
        name: formData.name,
        vendor: selectedVendor as any,
        token: formData.token,
        domain: formData.domain,
        isActive: true,
      };
      
      if (isFirst) {
        (newIntegration as any).isDefault = true;
      }
      
      await updateSettings({
        shippingIntegrations: [...Integrations, newIntegration]
      });
      toast.success(`تم حفظ ربط شركة "${formData.name}" بنجاح!`);
    } else if (formMode === 'edit' && editingId) {
      await updateSettings({
        shippingIntegrations: Integrations.map(i => 
          i.id === editingId 
            ? { ...i, name: formData.name, vendor: selectedVendor as any, token: formData.token, domain: formData.domain }
            : i
        )
      });
      toast.success('تم تحديث بيانات الربط بنجاح');
    }
    
    setFormMode(null);
  };
  
  const handleRemove = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الربط؟')) return;
    await updateSettings({
      shippingIntegrations: Integrations.filter(i => i.id !== id)
    });
    toast.success('تم حذف الربط');
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    await updateSettings({
      shippingIntegrations: Integrations.map(i => i.id === id ? { ...i, isActive: !currentlyActive } : i)
    });
    toast.success(!currentlyActive ? 'تم تفعيل شركة الشحن' : 'تم تعطيل شركة الشحن');
  };

  const handleMakeDefault = async (id: string) => {
    const integration = Integrations.find(i => i.id === id);
    await updateSettings({
      shippingIntegrations: Integrations.map(i => ({ ...i, isDefault: i.id === id })),
      defaultDeliveryCompany: integration ? integration.name : ''
    });
    toast.success(`تم تعيين "${integration?.name}" كشركة توصيل افتراضية`);
  };

  return (
    <div className="p-4 sm:p-6 text-right max-w-6xl mx-auto pb-24" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span>شركات التوصيل والشحن</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            إدارة شركات التوصيل اليدوية والمحلية بالإضافة إلى الربط البرمجي التلقائي (API) لتمرير الطرود وتتبعها.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('delivery_companies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'delivery_companies'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>شركات التوصيل المعتمدة ({manualCompanies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('api_integrations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'api_integrations'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>الربط التلقائي API ({Integrations.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Delivery Companies Management */}
      {activeTab === 'delivery_companies' && (
        <div className="space-y-6">
          {/* Quick Add Bar */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>إضافة شركة توصيل جديدة إلى خيارات الطلبيات</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الشركات المضافة هنا تظهر مباشرة في خيارات كل طلبية وفي فلاتر الإحصائيات وجداول التوصيل.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {manualCompanies.length > 0 && (
                  <button
                    onClick={() => setShowClearAllModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    title="حذف جميع الشركات المعتمدة للبدء من الصفر وإضافة شركاتك يدوياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف جميع الشركات</span>
                  </button>
                )}
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="استعادة الشركات الشائعة في الجزائر"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الشركات الافتراضية</span>
                </button>
              </div>
            </div>

            {/* Input and Add Button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="اكتب اسم شركة التوصيل (مثال: Yalidine، Maystro، ZR Express، توصيل سريع...)"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddManualCompany(); }}
                className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
              <button
                onClick={handleAddManualCompany}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة شركة</span>
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400">إضافة سريعة:</span>
              {DEFAULT_ALGERIA_COMPANIES.map(company => {
                const alreadyExists = manualCompanies.includes(company);
                if (alreadyExists) return null;
                return (
                  <button
                    key={company}
                    onClick={() => {
                      setNewCompanyName(company);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-slate-400" />
                    <span>{company}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Companies Cards Grid */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-sm">
                قائمة شركات التوصيل المعتمدة حالياً ({manualCompanies.length})
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                تتوفر في قوائم اختيار شركة الشحن عند تأكيد أو تعديل أي طلبية
              </span>
            </div>

            {manualCompanies.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-300 my-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Truck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-800 mb-1">لا توجد شركات توصيل معتمدة حالياً</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  تم إفراغ قائمة الشركات المعتمدة بنجاح ولن تعود تلقائياً. يمكنك الآن كتابة وإضافة شركات التوصيل التي تتعامل معها يدوياً من الخانة أعلاه، أو استعادة الشركات الافتراضية في أي وقت.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة الشركات الافتراضية</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manualCompanies.map((company) => {
                  const isEditing = editingCompanyName === company;
                  const linkedOrders = orders.filter(o => o.deliveryCompany === company);
                  const hasApi = Integrations.some(i => i.name === company && i.isActive);

                  return (
                    <div
                      key={company}
                      className="flex flex-col justify-between p-3.5 bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200 transition-all hover:shadow-xs group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-1 w-full">
                              <input
                                type="text"
                                value={editCompanyValue}
                                onChange={(e) => setEditCompanyValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditCompany(company);
                                  if (e.key === 'Escape') setEditingCompanyName(null);
                                }}
                                autoFocus
                                className="border border-indigo-400 rounded-lg px-2 py-1 text-xs font-black text-slate-800 w-full bg-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEditCompany(company)}
                                className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-md"
                                title="حفظ"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingCompanyName(null)}
                                className="text-slate-400 hover:bg-slate-100 p-1 rounded-md"
                                title="إلغاء"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="truncate">
                              <h4 className="font-black text-slate-900 text-sm truncate">{company}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {hasApi ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                                    ربط API نشط
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    توصيل يدوي / مباشر
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-500">
                                  • {linkedOrders.length} طلبية
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEditCompany(company)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                              title="تعديل الاسم"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleInitiateDeleteCompany(company)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف من القائمة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Automatic API Integrations */}
      {activeTab === 'api_integrations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800">
              حسابات الربط البرمجي التلقائي (API)
            </h3>
            {!formMode && (
              <button 
                onClick={handleAddStart}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة ربط API جديد</span>
              </button>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col gap-6">
            {formMode && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6 flex flex-col gap-4">
                <h4 className="font-bold text-indigo-900 border-b border-indigo-100 pb-2 text-lg">
                  {formMode === 'add' ? 'إضافة ربط جديد' : 'تعديل بيانات الربط'}
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">اختر شركة الشحن / المنصة</label>
                    <select 
                      value={selectedVendor ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedVendor(v);
                        let defaultDomain = '';
                        let defaultName = v;
                        if (v === 'expedigo') { defaultDomain = 'https://expedigo.ecotrack.dz'; defaultName = 'Ecotrack'; }
                        else if (v === 'yalidine') { defaultDomain = 'https://api.yalidine.com'; defaultName = 'Yalidine'; }
                        else if (v === 'maystro') { defaultDomain = 'https://api.maystro-delivery.com'; defaultName = 'Maystro'; }
                        setFormData({...formData, name: defaultName, domain: defaultDomain});
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">-- يرجى الاختيار --</option>
                      <option value="expedigo">Ecotrack (Expedigo)</option>
                      <option value="yalidine">Yalidine</option>
                      <option value="maystro">Maystro Delivery</option>
                      <option value="zr_express">ZR Express</option>
                      <option value="guex">Guex</option>
                      <option value="nord_et_ouest">Nord et Ouest</option>
                      <option value="procolis">Procolis</option>
                    </select>
                  </div>

                  {selectedVendor !== "" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">اسم الشركة (يظهر في الطلبيات)</label>
                        <input
                          type="text"
                          value={formData.name ?? ''}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="مثال: Yalidine"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Token API (التوكن)</label>
                        <input
                          type="text"
                          value={formData.token ?? ''}
                          onChange={(e) => setFormData({...formData, token: e.target.value})}
                          placeholder="ضع التوكن الخاص بك هنا"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">رابط المنصة / API URL</label>
                        <input
                          type="text"
                          value={formData.domain ?? ''}
                          onChange={(e) => setFormData({...formData, domain: e.target.value})}
                          placeholder="https://expedigo.ecotrack.dz"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 pt-4">
                    <button 
                      onClick={handleSaveInfo}
                      disabled={!selectedVendor || !formData.token || !formData.name}
                      className="bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      حفظ إعدادات الربط
                    </button>
                    <button 
                      onClick={() => setFormMode(null)}
                      className="bg-gray-100 text-gray-700 font-bold py-2.5 px-6 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}

            {Integrations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Integrations.map((integ: any) => (
                  <div key={integ.id} className={`border rounded-xl p-4 flex flex-col gap-4 relative ${integ.isActive ? 'border-indigo-200 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                    {integ.isDefault && (
                      <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[9px] font-black px-2 py-1 rounded-bl-lg rounded-tr-xl flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-900" />
                        افتراضي
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${integ.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                          <Building className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-gray-900">{integ.name}</h4>
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{(integ.vendor || '').toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded border border-gray-100 overflow-x-auto" dir="ltr">
                      <span className="font-mono text-xs select-all">{(integ.token || '').substring(0, 15)}••••••••••••••••••••</span>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 gap-2 flex-wrap">
                      <button 
                        onClick={() => handleToggleActive(integ.id, integ.isActive)}
                        className={`text-xs px-2 py-1.5 rounded font-bold transition flex items-center gap-1 flex-1 justify-center cursor-pointer ${integ.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                      >
                        {integ.isActive ? (
                          <><X className="w-3 h-3" /> تعطيل</>
                        ) : (
                          <><Check className="w-3 h-3" /> تفعيل</>
                        )}
                      </button>
                      
                      {!integ.isDefault && integ.isActive && (
                        <button 
                          onClick={() => handleMakeDefault(integ.id)}
                          className="text-xs px-2 py-1.5 rounded font-bold transition flex items-center gap-1 flex-1 justify-center text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                          تعيين كافتراضي
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleEditStart(integ)}
                        className="text-slate-600 hover:bg-slate-100 text-xs font-bold px-2 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit className="w-3 h-3" />
                      </button>

                      <button 
                        onClick={() => handleInitiateDeleteIntegration(integ)}
                        className="text-red-500 hover:bg-red-50 text-xs font-bold px-2 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
                        title="حذف هذا الربط"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !formMode && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3">
                <Link2 className="w-12 h-12 text-gray-300" />
                <p className="text-base font-bold text-gray-500">لم تقم بإضافة أي ربط API لشركة شحن بعد</p>
                <p className="text-sm">اضغط على "إضافة ربط API جديد" للبدء</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Manual Delivery Company */}
      {companyToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">تأكيد حذف شركة التوصيل</h3>
                  <p className="text-xs text-rose-700">حذف نهائي من القائمة المعتمدة</p>
                </div>
              </div>
              <button
                onClick={() => setCompanyToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">شركة التوصيل المراد حذفها:</span>
                  <span className="text-base font-black text-slate-900">{companyToDelete}</span>
                </div>
              </div>

              {(() => {
                const linkedCount = orders.filter(o => o.deliveryCompany === companyToDelete).length;
                return linkedCount > 0 ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-black">تنبيه: يوجد {linkedCount} طلبية مسجلة باسم هذه الشركة في سجلك.</p>
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        حذف الشركة سيزيلها نهائياً من قائمة خيارات التوصيل الجديدة ولن تعود تلقائياً. ستبقى الطلبيات السابقة محتفظة باسم الشركة في سجلاتها دون تغيير.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">لا توجد طلبيات مرتبطة بهذه الشركة حالياً. سيتم حذفها نهائياً ولن تعود تلقائياً.</span>
                  </div>
                );
              })()}

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                هل أنت متأكد من رغبتك في حذف <strong>"{companyToDelete}"</strong> نهائياً؟ يمكنك في أي وقت إضافة شركات أخرى يدوياً أو استعادة الشركات الافتراضية.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'جاري الحذف...' : 'نعم، احذف نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear All Companies */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">حذف جميع شركات التوصيل</h3>
                  <p className="text-xs text-rose-700">مسح القائمة للبدء من الصفر وإضافة شركاتك يدوياً</p>
                </div>
              </div>
              <button
                onClick={() => setShowClearAllModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                هل أنت متأكد من رغبتك في مسح كافة شركات التوصيل المعتمدة ({manualCompanies.length} شركة) دفعة واحدة؟
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  سيتم تفريغ القائمة نهائياً ولن تعود الشركات المعتمدة تلقائياً، لتتمكن من إضافة شركات التوصيل الخاصة بك يدوياً حسب رغبتك.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'جاري المسح...' : 'نعم، مسح الكل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete API Integration */}
      {integrationToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">تأكيد حذف ربط شركة الشحن</h3>
                  <p className="text-xs text-rose-700">حذف مفاتيح الربط البرمجي (API)</p>
                </div>
              </div>
              <button
                onClick={() => setIntegrationToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">الربط المكتشف:</span>
                <span className="text-sm font-black text-slate-900">{integrationToDelete.name} ({integrationToDelete.vendor})</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                هل أنت متأكد من حذف إعدادات ومفاتيح الربط التلقائي لشركة <strong>"{integrationToDelete.name}"</strong>؟ لن تتمكن من تمرير الطرود برمجياً إليها حتى تعيد إضافة التوكن.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIntegrationToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteIntegration}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'جاري الحذف...' : 'نعم، احذف الربط'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore Defaults */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">استعادة شركات التوصيل الافتراضية</h3>
                  <p className="text-xs text-indigo-700">إضافة الشركات الجزائرية الشائعة</p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                سيتم دمج شركات التوصيل الافتراضية الجزائرية (ياليدين، مايسترو، زد آر إكسبريس، إيكوتراك، أرامكس، سمسا، وتوصيل محلي) مع شركاتك الحالية دون حذف أي شركة مضافة لديك.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreDefaults}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isDeleting ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
