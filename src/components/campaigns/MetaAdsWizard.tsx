import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Facebook, Check, AlertCircle, RefreshCw, Link as LinkIcon, Key, CheckCircle2, Trash2, Edit3, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { fetchAndMapMetaMetrics } from '../../utils/metaSync';

interface MetaAdsWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MetaAdsWizard({ isOpen, onClose }: MetaAdsWizardProps) {
  const { settings, inventoryProducts, orders, addCampaign, addCampaignRecord, updateSettings, campaignFields, addCampaignField } = useStore();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [showRawToken, setShowRawToken] = useState(false);
  const [saveTokenPermanently, setSaveTokenPermanently] = useState(true);
  
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Record<string, string[]>>({}); // meta_campaign_id -> sku[]
  
  useEffect(() => {
    if (isOpen) {
      const savedToken = (settings?.metaAdsToken || localStorage.getItem('meta_ads_saved_token') || '').trim();
      setToken(savedToken);
      setIsEditingToken(!savedToken);
      setShowRawToken(false);
      setSaveTokenPermanently(true);
      setAdAccounts([]);
      setSelectedAccountId('');
      setCampaigns([]);
      setSelectedCampaigns({});
      
      // If token already saved, auto-advance dynamically directly to accounts selection step
      if (savedToken) {
        fetchAdAccounts(savedToken);
      } else {
        setStep(1);
      }
    }
  }, [isOpen, settings?.metaAdsToken]);

  const uniqueProductsData = React.useMemo(() => {
    const list = new Map<string, { key: string, label: string }>();
    const offerSkus = new Set<string>();

    inventoryProducts.forEach(inv => {
        if (!inv.name) return;
        const isOffer = inv.local_is_offers !== undefined ? inv.local_is_offers : (inv.variations && inv.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))));

        if (isOffer) {
            if (inv.sku) list.set(inv.sku, { key: inv.sku, label: inv.name });
            if (inv.variations) {
                inv.variations.forEach((v:any) => { if (v.sku) offerSkus.add(v.sku); });
            }
        } else if (inv.variations && inv.variations.length > 0) {
            if (inv.sku) list.set(inv.sku, { key: inv.sku, label: `${inv.name} (كل الأنواع)` });
            
            inv.variations.forEach((v:any) => {
                const variationName = v.name || v.attributes?.map((a:any)=>a.option).join(' ') || '';
                const key = v.sku;
                const label = `${inv.name} - ${variationName}`;
                if (key) list.set(key, { key, label });
            });
        } else {
            const key = inv.sku;
            if (key) list.set(key, { key, label: inv.name });
        }
    });

    orders.forEach(o => {
       if (o.sku && !list.has(o.sku) && !offerSkus.has(o.sku)) {
          list.set(o.sku, { key: o.sku, label: o.productName || o.sku });
       }
    });

    return Array.from(list.values()).sort((a,b) => a.label.localeCompare(b.label));
  }, [inventoryProducts, orders]);

  const fetchAdAccounts = async (overrideToken?: string) => {
    const activeToken = (overrideToken || token).trim();
    if (!activeToken) {
      toast.error('يرجى إدخال رمز وصول (Access Token) أولاً');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id&access_token=${activeToken}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Meta API returned invalid JSON: ${text.substring(0, 100)}`);
      }
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Meta API error: ${text.substring(0, 100)}`);
      }
      setAdAccounts(data.data || []);
      
      // Save the token to settings & local cache for future one-click dynamic use
      if (saveTokenPermanently) {
        await updateSettings({ metaAdsToken: activeToken });
        try {
          localStorage.setItem('meta_ads_saved_token', activeToken);
        } catch (e) {}
      }
      
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || 'فشل في جلب الحسابات الإعلانية. تأكد من صحة التوكن.');
      setStep(1);
      setIsEditingToken(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSavedToken = async () => {
    try {
      await updateSettings({ metaAdsToken: '' });
      try {
        localStorage.removeItem('meta_ads_saved_token');
      } catch (e) {}
      setToken('');
      setIsEditingToken(true);
      toast.success('تم مسح التوكن المحفوظ بنجاح');
    } catch (e) {
      toast.error('حدث خطأ أثناء مسح التوكن');
    }
  };

  const fetchCampaigns = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${selectedAccountId}/campaigns?fields=name,status,objective&effective_status=['ACTIVE']&access_token=${token.trim()}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Meta API returned invalid JSON: ${text.substring(0, 100)}`);
      }
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Meta API error: ${text.substring(0, 100)}`);
      }
      setCampaigns(data.data || []);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'فشل في جلب الحملات النشطة.');
    } finally {
      setLoading(false);
    }
  };

  const importCampaigns = async () => {
    const selectedMetaCampaigns = campaigns.filter(c => selectedCampaigns[c.id] && selectedCampaigns[c.id].length > 0);
    if (selectedMetaCampaigns.length === 0) {
      toast.error('الرجاء اختيار حملة واحدة على الأقل وتحديد المنتجات الخاصة بها');
      return;
    }
    
    setLoading(true);
    try {
      let currentFields = campaignFields;
      if (currentFields.length === 0) {
         const defaults = ["Impressions", "Reach", "CPM", "Link clicks", "CPC", "CTR", "Landing page views", "Purchases", "Cost per purchase"];
         for (let i = 0; i < defaults.length; i++) {
            const newField = { id: 'f_default_' + i + '_' + Date.now().toString(), name: defaults[i], type: 'number' as const };
            await addCampaignField(newField);
            currentFields = [...currentFields, newField];
         }
      }
      
      // For each selected campaign, add it to our store and fetch its lifetime spend
      for (const mc of selectedMetaCampaigns) {
        const skus = selectedCampaigns[mc.id];
        
        // Add Campaign
        const newCampaign: any = {
          id: `meta_${mc.id}`,
          name: mc.name,
          productName: skus[0] || '',
          platform: 'Meta',
          startDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          linkedProducts: skus,
          isArchived: false,
          metaCampaignId: mc.id, // custom field to track sync
          metaAccountId: selectedAccountId
        };
        addCampaign(newCampaign);
        
        // Try fetching lifetime spend per day
        try {
          const spendRes = await fetch(`https://graph.facebook.com/v19.0/${mc.id}/insights?date_preset=maximum&time_increment=1&fields=spend,date_start,impressions,reach,cpm,clicks,cpc,ctr,actions,cost_per_action_type&access_token=${token.trim()}`);
          const spendText = await spendRes.text();
          let spendData;
          try {
            spendData = JSON.parse(spendText);
          } catch (e) {
            throw new Error(`Meta API returned invalid JSON: ${spendText.substring(0, 100)}`);
          }
          if (!spendRes.ok) {
            throw new Error(spendData.error?.message || `Meta API error: ${spendText.substring(0, 100)}`);
          }
          if (spendData.data && spendData.data.length > 0) {
            const parsedMetrics = fetchAndMapMetaMetrics(spendData, currentFields);
            for (const record of parsedMetrics) {
               addCampaignRecord({
                  id: `meta_record_${mc.id}_${record.date}`,
                  campaignId: newCampaign.id,
                  date: record.date,
                  spend: record.spend,
                  dynamicFields: record.metrics
               });
            }
          }
        } catch (e) {
          console.error("Failed to fetch initial spend for campaign", mc.name);
        }
      }
      
      // Ensure the token is saved to settings for continuous auto-syncing across the app
      await updateSettings({ metaAdsToken: token.trim() });
      try {
        localStorage.setItem('meta_ads_saved_token', token.trim());
      } catch (e) {}
      
      toast.success('تم استيراد الحملات وسجلاتها بنجاح!');
      onClose();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ الحملات');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasSavedToken = Boolean((settings?.metaAdsToken || localStorage.getItem('meta_ads_saved_token') || '').trim());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <Facebook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">الربط مع ميتا (Facebook Ads)</h2>
                {hasSavedToken && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    التوكن محفوظ
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">استيراد الحملات تلقائياً وتتبع المصروفات والإحصائيات بدقة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
          {/* Progress Bar */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-100 -z-10" />
            {[
              { s: 1, label: 'رمز الوصول (Token)' },
              { s: 2, label: 'الحساب الإعلاني' },
              { s: 3, label: 'الحملات والمنتجات' }
            ].map(({ s, label }) => (
              <div key={s} className="flex flex-col items-center gap-1.5 bg-white px-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border-2 transition-all ${step >= s ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span className={`text-[11px] font-bold ${step >= s ? 'text-blue-900' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Option A: Token already saved and user is NOT editing */}
              {!isEditingToken && token ? (
                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-emerald-50 to-blue-50/50 border-2 border-emerald-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">تم التعرف على رمز وصول (Token) محفوظ</h4>
                          <p className="text-xs text-gray-500 mt-0.5">يمكنك المتابعة مباشرة بهذا التوكن دون الحاجة لإعادة جلبه أو نسخه في كل مرة.</p>
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-1 rounded-lg">جاهز للاتصال</span>
                    </div>

                    {/* Token display box */}
                    <div className="bg-white border border-emerald-100 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs font-mono text-xs">
                      <div className="flex items-center gap-2 overflow-hidden text-slate-700" dir="ltr">
                        <Key className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate font-semibold select-all">
                          {showRawToken 
                            ? token 
                            : `${token.slice(0, 12)}••••••••••••••••••••••••••••••••${token.slice(-8)}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRawToken(!showRawToken)}
                        className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                        title={showRawToken ? 'إخفاء التوكن' : 'إظهار التوكن'}
                      >
                        {showRawToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-emerald-100/70">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingToken(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-blue-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          تغيير / تحديث التوكن
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSavedToken}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50/60 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-rose-200"
                          title="مسح التوكن المحفوظ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          مسح
                        </button>
                      </div>

                      <button
                        onClick={() => fetchAdAccounts(token)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer text-sm"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                        <span>المتابعة بالتوكن المحفوظ</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Option B: New Token input or user clicked "تغيير / تحديث التوكن" */
                <div className="space-y-5">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl text-sm font-medium leading-relaxed border border-blue-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                    <div>
                      أدخل رمز الوصول (Meta Access Token) الخاص بك بصلاحية <code className="bg-white/80 px-1.5 py-0.5 rounded text-blue-900 font-mono text-xs font-bold">ads_read</code>.
                      <div className="text-xs text-blue-600 mt-1 font-normal">
                        يمكنك إنشاء رمز طويل الأجل من لوحة مطوري فيسبوك (Meta for Developers) أو من مستكشف Graph API.
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-gray-700">رمز الوصول (Meta Access Token)</label>
                      {hasSavedToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setToken(settings?.metaAdsToken || localStorage.getItem('meta_ads_saved_token') || '');
                            setIsEditingToken(false);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          إلغاء والعودة للتوكن المحفوظ
                        </button>
                      )}
                    </div>
                    <textarea
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none p-4 text-sm bg-gray-50/50 hover:bg-white focus:bg-white font-mono h-32 transition-all shadow-inner"
                      placeholder="EAAGm0PX4ZCpwBA..."
                      dir="ltr"
                    />
                  </div>

                  {/* Save Token permanently checkbox */}
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={saveTokenPermanently}
                        onChange={(e) => setSaveTokenPermanently(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span>حفظ هذا التوكن دائماً في النظام (لن يُطلب منك إدخاله مرة أخرى)</span>
                    </label>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded-md shrink-0">موصى به</span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => fetchAdAccounts(token)}
                      disabled={!token.trim() || loading}
                      className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer text-sm"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                      التالي: اختيار الحساب
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">اختر الحساب الإعلاني (Ad Account)</h3>
                  <p className="text-xs text-gray-500">تم العثور على {adAccounts.length} حسابات مرتبطة بتوكن ميتا الخاص بك.</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                  خطوة 2 من 3
                </span>
              </div>

              <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-1">
                {adAccounts.map(account => (
                  <label key={account.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAccountId === account.id ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="adAccount" 
                        value={account.id}
                        checked={selectedAccountId === account.id}
                        onChange={() => setSelectedAccountId(account.id)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{account.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5" dir="ltr">ID: {account.account_id || account.id}</div>
                      </div>
                    </div>
                    {selectedAccountId === account.id && (
                      <span className="text-blue-600 font-bold text-xs bg-blue-100 px-2 py-0.5 rounded-md">محدد</span>
                    )}
                  </label>
                ))}
                {adAccounts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 font-medium bg-gray-50 rounded-2xl border border-dashed">
                    لم يتم العثور على حسابات إعلانية مرتبطة بهذا التوكن. تأكد من أن حساب فيسبوك يملك صلاحية المدير على الحسابات الإعلانية.
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-700 font-bold px-4 py-2 flex items-center gap-2 cursor-pointer text-sm">
                  <ArrowRight className="w-4 h-4" /> رجوع لتعديل التوكن
                </button>
                <button
                  onClick={fetchCampaigns}
                  disabled={!selectedAccountId || loading}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer text-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                  التالي: اختيار الحملات
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-lg">اربط حملاتك بالمنتجات</h3>
                <p className="text-xs text-gray-500">اختر الحملات النشطة التي تريد استيرادها واربط كل حملة بالمنتج المناسب ليتم احتساب تكاليف الإعلانات تلقائياً في حسابات الأرباح ومحاكي الـ ROAS.</p>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 min-h-[280px] max-h-[400px] pr-1">
                {campaigns.map(camp => (
                  <div key={camp.id} className={`p-5 rounded-2xl border-2 transition-all shadow-2xs hover:shadow-xs ${selectedCampaigns[camp.id] ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-col gap-4">
                      {/* Campaign Info */}
                      <div className="w-full border-b pb-3 border-gray-100/80 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900 text-base leading-snug">{camp.name}</div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md font-mono text-[11px]" dir="ltr">ID: {camp.id}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-bold">نشطة</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Products Selection */}
                      <div className="w-full flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                              <LinkIcon className={`w-3.5 h-3.5 ${selectedCampaigns[camp.id]?.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                              المنتجات المرتبطة بهذه الحملة:
                           </div>
                           <span className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {selectedCampaigns[camp.id]?.length || 0} منتجات محددة
                           </span>
                        </div>
                        <div className={`border rounded-xl p-2.5 max-h-40 overflow-y-auto bg-gray-50/50 grid grid-cols-1 md:grid-cols-2 gap-2 shadow-inner transition-colors ${selectedCampaigns[camp.id]?.length > 0 ? 'border-blue-300 bg-blue-50/10' : 'border-gray-200'}`}>
                          {uniqueProductsData.map((p) => {
                             const isChecked = selectedCampaigns[camp.id]?.includes(p.key);
                             return (
                               <label key={p.key} className={`flex items-center gap-2.5 text-xs font-bold cursor-pointer p-2 rounded-lg transition-all border ${isChecked ? 'bg-white border-blue-200 shadow-2xs text-blue-900' : 'border-transparent hover:bg-white hover:border-gray-200 text-gray-700'}`}>
                                 <input 
                                   type="checkbox" 
                                   checked={isChecked || false}
                                   onChange={(e) => {
                                      const current = selectedCampaigns[camp.id] || [];
                                      if (e.target.checked) {
                                         setSelectedCampaigns(prev => ({...prev, [camp.id]: [...current, p.key]}));
                                      } else {
                                         const newArr = current.filter(k => k !== p.key);
                                         if (newArr.length > 0) {
                                            setSelectedCampaigns(prev => ({...prev, [camp.id]: newArr}));
                                         } else {
                                            setSelectedCampaigns(prev => {
                                               const newObj = {...prev};
                                               delete newObj[camp.id];
                                               return newObj;
                                            });
                                         }
                                      }
                                   }}
                                   className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 transition-all"
                                 />
                                 <span className="truncate flex-1" title={p.label}>{p.label}</span>
                               </label>
                             );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="text-center py-12 text-gray-500 font-medium border-2 border-dashed rounded-2xl bg-gray-50">
                    لا توجد حملات نشطة في هذا الحساب حالياً.
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button onClick={() => setStep(2)} className="text-gray-500 hover:text-gray-700 font-bold px-4 py-2 flex items-center gap-2 cursor-pointer text-sm">
                  <ArrowRight className="w-4 h-4" /> رجوع
                </button>
                <button
                  onClick={importCampaigns}
                  disabled={Object.keys(selectedCampaigns).length === 0 || loading}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer text-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  استيراد الحملات ({Object.keys(selectedCampaigns).length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
