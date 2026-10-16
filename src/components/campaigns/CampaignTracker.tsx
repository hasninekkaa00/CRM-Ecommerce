import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { Settings2, Plus, Edit2, Check, DollarSign, Trash2, Package, Megaphone, CalendarPlus, RefreshCw, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { fetchAndMapMetaMetrics } from '../../utils/metaSync';
import { CampaignDashboard } from './CampaignDashboard';

import { MetaAdsWizard } from './MetaAdsWizard';

export function CampaignTracker() {
  const { campaigns, campaignRecords, campaignFields, addCampaign, updateCampaign, deleteCampaign, updateCampaignRecord, addCampaignField, removeCampaignField, addCampaignRecord, updateCampaignField, deleteCampaignRecord, orders, inventoryProducts, settings, updateSettings } = useStore();
  
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newLinkedProducts, setNewLinkedProducts] = useState<string[]>([]);
  const [newBaseDailyBudget, setNewBaseDailyBudget] = useState<number | ''>('');
  const [editCampaignProductsId, setEditCampaignProductsId] = useState<string | null>(null);
  const [editLinkedProducts, setEditLinkedProducts] = useState<string[]>([]);
  const [editBaseDailyBudget, setEditBaseDailyBudget] = useState<number | ''>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  
  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

  const [showQuickAddRecordModal, setShowQuickAddRecordModal] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ campaignId: '', date: format(new Date(), 'yyyy-MM-dd'), spend: '' });

  const [showBulkAddSpendModal, setShowBulkAddSpendModal] = useState(false);
  const [showMetaWizard, setShowMetaWizard] = useState(false);
  const [bulkAddDate, setBulkAddDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bulkSpendData, setBulkSpendData] = useState<Record<string, string>>({});
  
  const [isSyncingMeta, setIsSyncingMeta] = useState<string | null>(null);

  const handleSyncMetaCampaign = async (campaign: any) => {
     if (!settings?.metaAdsToken) {
        toast.error('لا يوجد توكن ميتا محفوظ. يرجى فتح "استيراد من ميتا" ولصق التوكن الخاص بك ثم الضغط على "متابعة" ليتم حفظه.');
        return;
     }
     
     let actualMetaCampaignId = campaign.metaCampaignId;
     if (!actualMetaCampaignId && campaign.id.startsWith('meta_')) {
        actualMetaCampaignId = campaign.id.replace('meta_', '');
     }

     if (!actualMetaCampaignId) {
        toast.error('هذه الحملة غير مرتبطة بـ ميتا (لا يوجد معرف حملة). يرجى استيرادها من جديد.');
        return;
     }
     
     setIsSyncingMeta(campaign.id);
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

        const token = settings.metaAdsToken;
        const res = await fetch(`https://graph.facebook.com/v19.0/${actualMetaCampaignId}/insights?date_preset=maximum&time_increment=1&fields=spend,date_start,impressions,reach,cpm,clicks,cpc,ctr,actions,cost_per_action_type&access_token=${token}`);
        
        const responseText = await res.text();
        let data;
        try {
           data = JSON.parse(responseText);
        } catch (parseError) {
           throw new Error(`Meta API returned invalid JSON (possibly blocked by adblocker/proxy): ${responseText.substring(0, 100)}`);
        }
        
        if (!res.ok) {
           throw new Error(`Meta API error: ${data.error?.message || responseText.substring(0, 100)}`);
        }
        
        if (data.data && data.data.length > 0) {
           let syncedCount = 0;
           const parsedMetrics = fetchAndMapMetaMetrics(data, currentFields);
           
           for (const record of parsedMetrics) {
               const recordId = `meta_record_${actualMetaCampaignId}_${record.date}`;
               const existingRecord = campaignRecords.find(r => r.id === recordId);
               
               const isDiff = !existingRecord || existingRecord.spend !== record.spend || JSON.stringify(existingRecord.dynamicFields) !== JSON.stringify({...existingRecord.dynamicFields, ...record.metrics});
               
               if (isDiff) {
                  await addCampaignRecord({
                     id: recordId,
                     campaignId: campaign.id,
                     date: record.date,
                     spend: record.spend,
                     dynamicFields: existingRecord ? { ...existingRecord.dynamicFields, ...record.metrics } : record.metrics
                  });
                  syncedCount++;
               }
           }
           if (syncedCount > 0) {
              toast.success(`تم استيراد/تحديث ${syncedCount} سجل من ميتا بنجاح.`);
           } else {
              toast.success('سجلات الحملة محدثة بالفعل.');
           }
        } else {
           toast.success('لا توجد سجلات انفاق لهذه الحملة في ميتا.');
        }
     } catch (e) {
        console.error("Failed to sync Meta campaign", campaign.name, e);
        toast.error('حدث خطأ أثناء الاتصال مع ميتا.');
     } finally {
        setIsSyncingMeta(null);
     }
  };

  const handleBulkAddSpend = () => {
    if (!bulkAddDate) return;
    Object.entries(bulkSpendData).forEach(([campaignId, spend]) => {
      const spendNum = Number(spend);
      if (spendNum > 0) {
        addCampaignRecord({
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
          campaignId,
          date: bulkAddDate,
          spend: spendNum,
          dynamicFields: {}
        });
      }
    });
    setShowBulkAddSpendModal(false);
    setBulkSpendData({});
  };

  const handleQuickAddRecord = () => {
    if (!quickAddData.campaignId || !quickAddData.spend) return;
    addCampaignRecord({
      id: Date.now().toString(),
      campaignId: quickAddData.campaignId,
      date: quickAddData.date,
      spend: Number(quickAddData.spend),
      dynamicFields: {}
    });
    setShowQuickAddRecordModal(false);
    setQuickAddData({ campaignId: '', date: format(new Date(), 'yyyy-MM-dd'), spend: '' });
  };

  const uniqueProductsData = useMemo(() => {
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

  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) return;
    const newId = Date.now().toString();
    addCampaign({
      id: newId,
      name: newCampaignName.trim(),
      productName: newLinkedProducts[0] || '', // primary for backward compat
      linkedProducts: newLinkedProducts,
      baseDailyBudget: newBaseDailyBudget === '' ? 0 : Number(newBaseDailyBudget),
      createdAt: new Date().toISOString()
    });
    setNewCampaignName('');
    setNewLinkedProducts([]);
    setNewBaseDailyBudget('');
    setShowAddCampaignModal(false);
    setActiveCampaignId(newId);
  };

  const openFieldModal = (fieldId?: string, currentName?: string) => {
    if (fieldId && currentName) {
      setEditingFieldId(fieldId);
      setNewFieldName(currentName);
    } else {
      setEditingFieldId(null);
      setNewFieldName('');
    }
    setShowFieldModal(true);
  };
  
  const handleAddRecord = () => {
    if (!activeCampaignId) return;
    const newRecordId = Date.now().toString();
    addCampaignRecord({
      id: newRecordId,
      campaignId: activeCampaignId,
      date: format(new Date(), 'yyyy-MM-dd'),
      spend: 0,
      dynamicFields: {}
    });
    setEditingId(newRecordId);
  };

  const handleSaveField = () => {
    if (newFieldName.trim()) {
      if (editingFieldId) {
        updateCampaignField(editingFieldId, { name: newFieldName.trim() });
      } else {
        addCampaignField({
          id: 'f_' + Date.now().toString(),
          name: newFieldName.trim(),
          type: 'number'
        });
      }
      setNewFieldName('');
      setShowFieldModal(false);
      setEditingFieldId(null);
    }
  };

  const confirmDeleteField = (id: string) => {
    setConfirmAction({
      title: 'حذف العمود',
      message: 'هل أنت متأكد من حذف هذا العمود؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح بياناته من كل السجلات.',
      onConfirm: () => removeCampaignField(id)
    });
  };

  const toggleSelectRecord = (id: string) => {
    const newSelection = new Set(selectedRecords);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecords(newSelection);
  };

  const handleDeleteSelected = () => {
    if (selectedRecords.size === 0) return;
    setConfirmAction({
      title: 'حذف السجلات المحددة',
      message: `هل أنت متأكد من حذف ${selectedRecords.size} سجلات؟ لا يمكن التراجع.`,
      onConfirm: () => {
        selectedRecords.forEach(id => deleteCampaignRecord(id));
        setSelectedRecords(new Set());
      }
    });
  };

  const seedDefaultFields = () => {
    const defaults = ["Impressions", "Reach", "CPM", "Link clicks", "CPC", "CTR", "Landing page views", "Purchases", "Cost per purchase"];
    defaults.forEach((name, i) => {
      addCampaignField({
        id: 'f_default_' + i + '_' + Date.now().toString(),
        name,
        type: 'number'
      });
    });
  };

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  
  const [showArchived, setShowArchived] = useState<boolean>(() => localStorage.getItem('campaigns_showArchived') === 'true');

  useEffect(() => {
    localStorage.setItem('campaigns_showArchived', showArchived.toString());
  }, [showArchived]);
  const activeCampaignList = useMemo(() => campaigns.filter(c => showArchived ? c.isArchived : !c.isArchived), [campaigns, showArchived]);

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId);
  const currentRecords = campaignRecords.filter(r => r.campaignId === activeCampaignId);

  const [showDeleteCampaignModal, setShowDeleteCampaignModal] = useState(false);

  const handleArchiveCampaign = () => {
    if (!activeCampaignId) return;
    const isArchived = activeCampaign?.isArchived;
    setConfirmAction({
      title: isArchived ? 'استعادة الحملة' : 'أرشفة الحملة',
      message: isArchived ? 'هل أنت متأكد من استعادة هذه الحملة؟' : 'هل أنت متأكد من أرشفة هذه الحملة؟ لن تظهر في القائمة الرئيسية.',
      onConfirm: () => {
        updateCampaign(activeCampaignId, { 
          isArchived: !isArchived,
          archivedAt: !isArchived ? new Date().toISOString() : undefined 
        });
        if (!isArchived) setActiveCampaignId(null);
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedRecords.size === currentRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(currentRecords.map(r => r.id)));
    }
  };

  const calculateTotalCampaignSpend = (campaign: any, records: any[]) => {
    let totalSpend = 0;
    try {
      const campStart = startOfDay(parseISO(campaign.createdAt));
      // Cap at today for running total
      const campEnd = campaign.archivedAt ? endOfDay(parseISO(campaign.archivedAt)) : endOfDay(new Date());
      const periodDays = eachDayOfInterval({ start: campStart, end: campEnd });
      
      periodDays.forEach(day => {
        const manualRecordsForDay = records.filter(r => r.date && isSameDay(parseISO(r.date), day));
        if (manualRecordsForDay.length > 0) {
            totalSpend += manualRecordsForDay.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
        } else if (campaign.baseDailyBudget) {
            totalSpend += campaign.baseDailyBudget;
        }
      });
      // Add any manual records that are OUTSIDE the period just in case
      records.forEach(r => {
         if (r.date) {
            const rDate = startOfDay(parseISO(r.date));
            if (rDate < campStart || rDate > campEnd) {
                 totalSpend += (Number(r.spend) || 0);
            }
         }
      });
    } catch (e) {
      // Fallback
      totalSpend = records.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
    }
    return totalSpend;
  };

  const currentTotalSpend = activeCampaign ? calculateTotalCampaignSpend(activeCampaign, currentRecords) : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 flex flex-col h-full bg-gray-50/50 min-h-screen" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
             <Megaphone className="w-7 h-7 text-indigo-600" />
             متابعة الحملات الإعلانية
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">إدارة ميزانيات الإعلانات وتتبع الأداء لكل حملة</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600 font-bold whitespace-nowrap px-3 py-2 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition shadow-sm">
             <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
             إظهار الأرشيف
          </label>
          
          {activeCampaignId && (
            <select 
              value={activeCampaignId || ''} 
              onChange={(e) => {
                setActiveCampaignId(e.target.value);
                setSelectedRecords(new Set());
                setEditingId(null);
              }}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
            >
              <option value="" disabled>اختر الحملة...</option>
              {activeCampaignList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.productName ? `(${c.productName})` : ''} {c.isArchived ? '(مؤرشف)' : ''}
                </option>
              ))}
            </select>
          )}

          <button 
            onClick={() => {
               setBulkAddDate(format(new Date(), 'yyyy-MM-dd'));
               setBulkSpendData({});
               setShowBulkAddSpendModal(true);
            }}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-emerald-700 flex items-center gap-2 transition"
          >
            <DollarSign className="w-4 h-4" />
            إضافة مصروف حملات جملة
          </button>
          <button 
            onClick={() => {
               setQuickAddData({ campaignId: '', date: format(new Date(), 'yyyy-MM-dd'), spend: '' });
               setShowQuickAddRecordModal(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 flex items-center gap-2 transition"
          >
            <CalendarPlus className="w-4 h-4" />
            إضافة سجل
          </button>
          
          <button 
            onClick={() => setShowMetaWizard(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-blue-700 flex items-center gap-2 transition cursor-pointer"
            title={settings?.metaAdsToken ? 'التوكن محفوظ - جاهز للاستيراد بضغطة واحدة' : 'استيراد حملات جديدة من ميتا'}
          >
            <Facebook className="w-4 h-4" />
            <span>استيراد من ميتا</span>
            {Boolean(settings?.metaAdsToken) && (
              <span className="inline-flex items-center gap-1 bg-blue-700/80 text-[10px] text-white px-1.5 py-0.5 rounded-full border border-blue-400/50 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                التوكن محفوظ
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setShowAddCampaignModal(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-gray-800 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            حملة جديدة
          </button>
        </div>
      </div>

      {!activeCampaignId ? (
        <div className="flex-1 flex flex-col space-y-6">
          <CampaignDashboard />
          <div className="flex-1 space-y-6">
          {activeCampaignList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-200/80 border-dashed shadow-sm p-12 h-full min-h-[400px]">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <Megaphone className="w-12 h-12 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">الخطوة الأولى: أنشئ حملتك الأولى</h3>
              <p className="text-gray-500 mb-8 text-center max-w-md font-medium leading-relaxed">
                للبدء في تتبع المؤشرات، قم بإضافة حملة جديدة وربطها بأحد المنتجات المتاحة لديك لجمع إحصائياته وتتبع مصاريفه.
              </p>
              <button 
                onClick={() => setShowAddCampaignModal(true)}
                className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-md hover:bg-indigo-700 flex items-center gap-2 transition-transform hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                إنشاء حملة جديدة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaignList.map(campaign => {
                const records = campaignRecords.filter(r => r.campaignId === campaign.id);
                const spend = calculateTotalCampaignSpend(campaign, records);
                
                return (
                  <div 
                    key={campaign.id}
                    onClick={() => setActiveCampaignId(campaign.id)}
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-5">
                      <div className="w-12 h-12 bg-indigo-50/80 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div className="text-left bg-amber-50/50 px-3 py-1.5 rounded-xl border border-amber-100">
                        <p className="text-[10px] font-black text-amber-500 mb-0.5 uppercase tracking-wider">الإنفاق الكلي</p>
                        <p className="text-base font-black text-amber-700">${spend.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-gray-900 mb-3 group-hover:text-indigo-700 transition-colors">{campaign.name}</h3>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-6 mt-auto">
                      {campaign.linkedProducts && campaign.linkedProducts.length > 0 ? (
                        campaign.linkedProducts.map(p => {
                          const label = uniqueProductsData.find(item => item.key === p)?.label || p;
                          return (
                            <span key={p} className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-gray-200" title={p}>
                              <Package className="w-3.5 h-3.5" />
                              {label}
                            </span>
                          );
                        })
                      ) : campaign.productName ? (
                         <span className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-gray-200" title={campaign.productName}>
                            <Package className="w-3.5 h-3.5" />
                            {uniqueProductsData.find(item => item.key === campaign.productName)?.label || campaign.productName}
                         </span>
                      ) : (
                         <span className="text-gray-400 text-[11px] font-bold bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100 border-dashed">بدون منتج مرتبط</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 font-medium text-sm">
                        <CalendarPlus className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-gray-700">{records.length}</span> سجلات إعلانية
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {(campaign.metaCampaignId || campaign.id.startsWith('meta_')) && (
                           <button
                             onClick={(e) => { e.stopPropagation(); handleSyncMetaCampaign(campaign); }}
                             disabled={isSyncingMeta === campaign.id}
                             title="سحب السجلات من ميتا"
                             className={`p-1.5 rounded-lg border transition-colors ${isSyncingMeta === campaign.id ? 'bg-blue-50 border-blue-200 text-blue-400' : 'bg-white border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200'}`}
                           >
                             <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMeta === campaign.id ? 'animate-spin' : ''}`} />
                           </button>
                        )}
                        {campaign.isArchived && (
                          <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200">
                            مؤرشفة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-indigo-500 to-purple-500"></div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-6 h-6" />
              </div>
              <div className="flex-shrink-0 flex flex-col justify-center">
                <h3 className="text-xl font-black text-gray-900 leading-tight">{activeCampaign?.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {activeCampaign?.linkedProducts && activeCampaign.linkedProducts.length > 0 ? (
                    activeCampaign.linkedProducts.map(p => (
                      <span key={p} className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-gray-200">
                        <Package className="w-3 h-3" />
                        {p}
                      </span>
                    ))
                  ) : activeCampaign?.productName ? (
                     <span className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-gray-200">
                        <Package className="w-3 h-3" />
                        {activeCampaign.productName}
                     </span>
                  ) : (
                     <span className="text-gray-400 text-[10px] font-bold bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 border-dashed">بدون منتج مرتبط</span>
                  )}
                  
                  <button 
                    onClick={() => {
                       setEditCampaignProductsId(activeCampaign?.id || null);
                       setEditLinkedProducts(activeCampaign?.linkedProducts || (activeCampaign?.productName ? [activeCampaign.productName] : []));
                       setEditBaseDailyBudget(activeCampaign?.baseDailyBudget ?? '');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    تعديل
                  </button>
                </div>
              </div>
              
              <div className="h-8 w-px bg-gray-100 mx-1 hidden lg:block"></div>
              
              <div className="bg-amber-50/50 px-4 py-2 rounded-xl border border-amber-100">
                <p className="text-[10px] font-black text-amber-500 mb-0 uppercase tracking-widest hidden md:block">الإنفاق الكلي</p>
                <h4 className="text-xl font-black text-amber-700">${currentTotalSpend.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</h4>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               {(activeCampaign?.metaCampaignId || activeCampaign?.id.startsWith('meta_')) && (
                 <button 
                   onClick={() => handleSyncMetaCampaign(activeCampaign)}
                   disabled={isSyncingMeta === activeCampaign.id}
                   className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-100 flex items-center gap-1.5 transition border border-blue-100 disabled:opacity-50"
                 >
                   <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMeta === activeCampaign.id ? 'animate-spin' : ''}`} />
                   {isSyncingMeta === activeCampaign.id ? 'جاري السحب...' : 'سحب من ميتا'}
                 </button>
               )}
               <button 
                  onClick={handleArchiveCampaign}
                  className="bg-white text-gray-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 flex items-center gap-1.5 transition border border-gray-200"
               >
                  {activeCampaign?.isArchived ? 'استعادة' : 'أرشفة'}
               </button>
               <button 
                  onClick={() => setShowDeleteCampaignModal(true)}
                  className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-red-100 flex items-center gap-1.5 transition border border-red-100"
               >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف نهائي
               </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex gap-2 w-full sm:w-auto">
              {selectedRecords.size > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-100 flex items-center gap-1.5 transition border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف المحدد ({selectedRecords.size})
                </button>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {campaignFields.length === 0 && (
                <button 
                  onClick={seedDefaultFields}
                  className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  إضافة أعمدة فيسبوك
                </button>
              )}
              <button 
                onClick={() => openFieldModal()}
                className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <Settings2 className="w-4 h-4" />
                إضافة مؤشر
              </button>
              <button 
                onClick={handleAddRecord}
                className="bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-bold shadow hover:bg-gray-800 flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                إضافة سجل
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 shrink-0 overflow-x-auto">
            <div className="min-w-full inline-block align-middle">
              <table className="w-full text-left border-collapse text-sm bg-white text-right whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 sticky top-0 text-xs uppercase text-gray-500 border-b border-gray-100 z-10 font-bold tracking-wider">
                    <th className="p-4 w-12 text-center border-l border-gray-100">
                      <input 
                        type="checkbox" 
                        checked={currentRecords.length > 0 && selectedRecords.size === currentRecords.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="p-4 border-l border-gray-100 min-w-[120px]">التاريخ</th>
                    <th className="p-4 border-l border-gray-100 text-amber-700 bg-amber-50/10">المصروف (USD)</th>
                    
                    {campaignFields.map(field => (
                      <th key={field.id} className="p-4 border-l border-gray-100 text-indigo-700 bg-indigo-50/20 group relative font-semibold">
                        <div className="flex items-center justify-between gap-2">
                           <span>{field.name}</span>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50/80 px-1 rounded absolute left-2">
                             <button onClick={() => openFieldModal(field.id, field.name)} className="text-gray-400 hover:text-indigo-600 p-0.5" title="تعديل اسم العمود">
                               <Edit2 className="w-3 h-3" />
                             </button>
                             <button onClick={() => confirmDeleteField(field.id)} className="text-gray-400 hover:text-red-500 p-0.5" title="حذف العمود">
                               <Trash2 className="w-3 h-3" />
                             </button>
                           </div>
                        </div>
                      </th>
                    ))}
                    
                    <th className="p-4 text-center w-20">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {currentRecords.map((record) => {
                    const isEditing = editingId === record.id;
                    const isSelected = selectedRecords.has(record.id);
                    return (
                      <tr key={record.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`}>
                        
                        <td className="p-4 text-center border-l border-gray-50">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleSelectRecord(record.id)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>

                        <td className="p-4 border-l border-gray-50" onDoubleClick={() => setEditingId(record.id)}>
                          {isEditing ? (
                            <input type="date" value={record.date || ''} onChange={(e) => updateCampaignRecord(record.id, { date: e.target.value })} className="w-full border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none px-2 py-1.5 text-sm bg-white border" />
                          ) : (
                             <span className="font-semibold">{record.date ? format(parseISO(record.date), 'dd MMM yyyy') : '-'}</span>
                          )}
                        </td>
                        
                        <td className="p-4 border-l border-gray-50 bg-amber-50/5" onDoubleClick={() => setEditingId(record.id)}>
                          {isEditing ? (
                            <input type="number" step="0.01" value={record.spend ?? 0} onChange={(e) => updateCampaignRecord(record.id, { spend: Number(e.target.value) })} className="w-24 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none px-2 py-1.5 text-sm bg-white border font-bold text-amber-600 ltr text-left" dir="ltr" />
                          ) : (
                            <span className="font-black text-amber-600 tracking-tight">{record.spend?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) ?? 0} $</span>
                          )}
                        </td>
                        
                        {campaignFields.map(field => (
                          <td key={field.id} className="p-4 border-l border-gray-50 bg-indigo-50/5 font-mono text-[13px] font-semibold text-gray-600" onDoubleClick={() => setEditingId(record.id)}>
                            {isEditing ? (
                              <input 
                                type="number" 
                                step="0.01"
                                value={record.dynamicFields?.[field.id] !== undefined ? record.dynamicFields[field.id] : ''} 
                                onChange={(e) => updateCampaignRecord(record.id, { 
                                  dynamicFields: { ...(record.dynamicFields || {}), [field.id]: e.target.value === '' ? undefined : Number(e.target.value) } 
                                })} 
                                className="w-20 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none px-2 py-1.5 text-sm bg-white border font-medium text-left"
                                dir="ltr" 
                              />
                            ) : (record.dynamicFields?.[field.id] !== undefined ? record.dynamicFields[field.id] : '-')}
                          </td>
                        ))}

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <button onClick={() => setEditingId(null)} className="p-1.5 text-white bg-green-500 hover:bg-green-600 rounded-lg shadow-sm transition-colors" title="حفظ">
                                <Check className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setEditingId(record.id)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="تعديل السجل">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setConfirmAction({
                                      title: 'حذف السجل',
                                      message: 'هل أنت متأكد من حذف هذا السجل؟',
                                      onConfirm: () => deleteCampaignRecord(record.id)
                                    });
                                  }} 
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                                  title="حذف السجل"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {currentRecords.length === 0 && (
                     <tr>
                        <td colSpan={4 + campaignFields.length} className="p-16 text-center text-gray-400 font-medium bg-gray-50/30">
                           <CalendarPlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                           لا توجد سجلات تتبع في هذه الحملة حتى الآن.<br/>انقر على الزر بالأعلى لإضافة سجل جديد وتتبع الأداء.
                        </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal for adding campaign */}
      {showAddCampaignModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-900">إضافة حملة جديدة</h3>
            <p className="text-sm font-medium text-gray-500 mb-6">أدخل اسم الحملة واختر المنتج المرتبط بها لإنشاء جدول التتبع.</p>
            
            <div className="space-y-4 mb-6">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم الحملة <span className="text-red-500">*</span></label>
                  <input 
                     type="text" 
                     value={newCampaignName}
                     onChange={(e) => setNewCampaignName(e.target.value)}
                     placeholder="مثال: C01 - حمالة التصحيح"
                     className="w-full border-gray-200 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-sm text-sm font-bold"
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المنتجات المرتبطة بالحملة (اختر واحد أو أكثر)</label>
                  <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-gray-50/50 p-2 space-y-1 custom-scrollbar">
                     {uniqueProductsData.length === 0 ? (
                        <p className="text-sm text-gray-500 p-2 font-medium">لا توجد منتجات مسجلة في المخزن أو الطلبيات بعد.</p>
                     ) : (
                        uniqueProductsData.map(p => (
                           <label key={p.key} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                              <input 
                                 type="checkbox"
                                 checked={newLinkedProducts.includes(p.key)}
                                 onChange={(e) => {
                                    if (e.target.checked) {
                                       setNewLinkedProducts([...newLinkedProducts, p.key]);
                                    } else {
                                       setNewLinkedProducts(newLinkedProducts.filter(item => item !== p.key));
                                    }
                                 }}
                                 className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm font-bold text-gray-700">{p.label} <span className="text-[10px] text-gray-400 font-normal ml-2">{p.key}</span></span>
                           </label>
                        ))
                     )}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الميزانية اليومية (اختياري) <span className="text-xs text-gray-400 font-normal ml-2">بالدولار</span></label>
                  <input 
                     type="number" 
                     value={newBaseDailyBudget}
                     onChange={(e) => setNewBaseDailyBudget(e.target.value ? Number(e.target.value) : '')}
                     placeholder="مثال: 50"
                     className="w-full border-gray-200 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-sm text-sm font-bold"
                  />
                  <p className="text-xs text-gray-500 mt-2 font-medium">ستتم إضافة هذه الميزانية يومياً لتكاليف الحملة بشكل آلي. يمكنك تركها فارغة.</p>
               </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddCampaignModal(false)} className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
              <button 
                 onClick={handleCreateCampaign} 
                 disabled={!newCampaignName.trim()} 
                 className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 إنشاء الحملة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding/editing dynamic fields */}
      {showFieldModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-900">{editingFieldId ? 'تعديل اسم العمود' : 'إضافة مؤشر تتبع جديد'}</h3>
            <p className="text-sm font-medium text-gray-500 mb-6">مثال: تكلفة الرسالة، عدد النقرات، مشتريات الويب، الخ...</p>
            <input 
              type="text" 
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder="اسم العمود (مثال: ROAS)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-sm text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveField()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowFieldModal(false)} className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
              <button onClick={handleSaveField} disabled={!newFieldName.trim()} className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50">{editingFieldId ? 'حفظ' : 'إضافة المؤشر'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for editing linked products */}
      {editCampaignProductsId && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-900">تعديل المنتجات المرتبطة</h3>
            <p className="text-sm font-medium text-gray-500 mb-6">اختر المنتجات المرتبطة بهذه الحملة ليتم تتبع مؤشراتها معاً.</p>
            
            <div className="space-y-4 mb-6">
               <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-gray-50/50 p-2 space-y-1 custom-scrollbar">
                  {uniqueProductsData.length === 0 ? (
                     <p className="text-sm text-gray-500 p-2 font-medium">لا توجد منتجات مسجلة في المخزن أو الطلبيات بعد.</p>
                  ) : (
                     uniqueProductsData.map(p => (
                        <label key={p.key} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 shadow-sm hover:shadow">
                           <input 
                              type="checkbox"
                              checked={editLinkedProducts.includes(p.key)}
                              onChange={(e) => {
                                 if (e.target.checked) {
                                    setEditLinkedProducts([...editLinkedProducts, p.key]);
                                 } else {
                                    setEditLinkedProducts(editLinkedProducts.filter(item => item !== p.key));
                                 }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                           />
                           <span className="text-sm font-bold text-gray-700">{p.label} <span className="text-[10px] text-gray-400 font-normal ml-2">{p.key}</span></span>
                        </label>
                     ))
                  )}
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الميزانية اليومية (اختياري) <span className="text-xs text-gray-400 font-normal ml-2">بالدولار</span></label>
                  <input 
                     type="number" 
                     value={editBaseDailyBudget}
                     onChange={(e) => setEditBaseDailyBudget(e.target.value ? Number(e.target.value) : '')}
                     placeholder="مثال: 50"
                     className="w-full border-gray-200 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none shadow-sm text-sm font-bold"
                  />
                  <p className="text-xs text-gray-500 mt-2 font-medium">ستتم إضافة هذه الميزانية يومياً لتكاليف الحملة بشكل آلي.</p>
               </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditCampaignProductsId(null)} className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
              <button 
                 onClick={() => {
                    updateCampaign(editCampaignProductsId, {
                       productName: editLinkedProducts[0] || '',
                       linkedProducts: editLinkedProducts,
                       baseDailyBudget: editBaseDailyBudget === '' ? 0 : Number(editBaseDailyBudget)
                    });
                    setEditCampaignProductsId(null);
                 }} 
                 className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
              >
                 حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
            <h3 className="text-xl font-black mb-2 text-gray-900 text-center">{confirmAction.title}</h3>
            <p className="text-sm font-medium text-gray-500 mb-6 text-center leading-relaxed">
              {confirmAction.message}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmAction(null)} 
                className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }} 
                className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      {showDeleteCampaignModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black mb-2 text-gray-900 text-center">حذف الحملة نهائياً</h3>
            <p className="text-sm font-medium text-gray-500 mb-6 text-center leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذه الحملة وكل السجلات التابعة لها؟<br />
              <strong className="text-red-500">لا يمكن التراجع عن هذا الإجراء!</strong>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteCampaignModal(false)} 
                className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={() => {
                  if (activeCampaignId) {
                    currentRecords.forEach(r => deleteCampaignRecord(r.id));
                    deleteCampaign(activeCampaignId);
                    setActiveCampaignId(null);
                  }
                  setShowDeleteCampaignModal(false);
                }} 
                className="flex-1 px-4 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Record Modal */}
      {showQuickAddRecordModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <CalendarPlus className="w-6 h-6 text-indigo-600" />
                إضافة سجل جديد
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الحملة الإعلانية *</label>
                <select 
                  className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-medium transition-all"
                  value={quickAddData.campaignId}
                  onChange={(e) => setQuickAddData({...quickAddData, campaignId: e.target.value})}
                >
                  <option value="" disabled>اختر الحملة...</option>
                  {campaigns.filter(c => !c.isArchived).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ *</label>
                <input 
                  type="date" 
                  className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-medium transition-all"
                  value={quickAddData.date}
                  onChange={(e) => setQuickAddData({...quickAddData, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المصروف * ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="مثال: 50"
                  className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-medium transition-all"
                  value={quickAddData.spend}
                  onChange={(e) => setQuickAddData({...quickAddData, spend: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowQuickAddRecordModal(false)} className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
              <button 
                onClick={handleQuickAddRecord} 
                disabled={!quickAddData.campaignId || !quickAddData.spend || !quickAddData.date}
                className="flex-1 px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-indigo-200"
              >
                إضافة سجل
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Add Spend Modal */}
      {showBulkAddSpendModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 transform transition-all max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                إضافة مصروف للحملات جملة
              </h3>
            </div>
            
            <div className="mb-6 shrink-0">
              <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ *</label>
              <input 
                type="date" 
                className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-medium transition-all"
                value={bulkAddDate}
                onChange={(e) => setBulkAddDate(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[50px]">
              <table className="w-full text-sm text-right border-collapse">
                 <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                       <th className="py-2 px-3 text-gray-500 font-bold border-b border-gray-200">الحملة</th>
                       <th className="py-2 px-3 text-gray-500 font-bold border-b border-gray-200 w-48">مصروف اليوم ($)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {campaigns.filter(c => !c.isArchived).map(c => (
                       <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-3 font-bold text-gray-900">
                             {c.name}
                             {c.productName ? <span className="text-xs text-gray-500 block font-normal">{c.productName}</span> : null}
                          </td>
                          <td className="py-3 px-3">
                             <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={bulkSpendData[c.id] || ''}
                                onChange={(e) => setBulkSpendData({...bulkSpendData, [c.id]: e.target.value})}
                                className="w-full border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-bold text-gray-900 outline-none transition-all"
                             />
                          </td>
                       </tr>
                    ))}
                    {campaigns.filter(c => !c.isArchived).length === 0 && (
                       <tr>
                          <td colSpan={2} className="py-4 text-center text-gray-500 font-medium">لا توجد حملات نشطة</td>
                       </tr>
                    )}
                 </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-6 shrink-0 pt-4 border-t border-gray-100">
              <button onClick={() => setShowBulkAddSpendModal(false)} className="flex-[0.3] px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
              <button 
                onClick={handleBulkAddSpend} 
                disabled={!bulkAddDate || Object.values(bulkSpendData).every(v => !Number(v))}
                className="flex-[0.7] px-4 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-emerald-200"
              >
                حفظ وإضافة السجلات
              </button>
            </div>
          </div>
        </div>
      )}
      
      <MetaAdsWizard isOpen={showMetaWizard} onClose={() => setShowMetaWizard(false)} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
}
