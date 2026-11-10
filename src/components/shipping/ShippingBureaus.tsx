import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { 
  Building, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Phone, 
  Truck, 
  Check, 
  Filter, 
  ExternalLink,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Sparkles,
  AlertCircle,
  Copy,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { ShippingBureau } from '../../types';
import { WILAYAS_MAP } from '../../utils/algeriaWilayas';
import ecotrackCommunes from '../../ecotrack-communes.json';
import toast from 'react-hot-toast';

const ALGERIA_WILAYAS = Object.entries(WILAYAS_MAP).map(([code, name]) => {
  const num = parseInt(code, 10);
  const cleanName = name.split(' - ')[1] || name;
  return {
    code,
    id: num,
    fullName: name,
    name: cleanName
  };
}).sort((a, b) => a.id - b.id);

export function ShippingBureaus() {
  const { 
    shippingBureaus, 
    addShippingBureau, 
    updateShippingBureau, 
    deleteShippingBureau, 
    bulkUpsertShippingBureaus,
    replaceAllShippingBureaus,
    settings,
    updateSettings
  } = useStore();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWilayaFilter, setSelectedWilayaFilter] = useState('all');
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'multi' | 'api' | 'manual' | 'stopdesk'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Multi-desk collapsible cards state (expanded wilaya codes)
  const [collapsedWilayas, setCollapsedWilayas] = useState<Record<string, boolean>>({});

  // API Sync & Query State
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [apiTokenInput, setApiTokenInput] = useState('');
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [apiSyncReport, setApiSyncReport] = useState<{
    success: boolean;
    totalFetched: number;
    wilayasCount: number;
    multiDeskWilayas: { wilaya: string; count: number }[];
  } | null>(null);

  // Add / Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBureau, setEditingBureau] = useState<ShippingBureau | null>(null);
  const [formData, setFormData] = useState({
    wilayaCode: '16',
    wilayaName: 'الجزائر (Alger)',
    communeName: '',
    deskName: '',
    companyName: 'DHD Expedia Go',
    hasStopDesk: true,
    address: '',
    phones: ''
  });
  const [customCommuneInput, setCustomCommuneInput] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<ShippingBureau | null>(null);

  // Active DHD / ExpediGo shipping integration
  const dhdIntegration = useMemo(() => {
    const integrations = settings?.shippingIntegrations || [];
    return integrations.find(i => 
      (i.name.toLowerCase().includes('dhd') || 
       i.name.toLowerCase().includes('expedi') || 
       i.domain?.includes('expedigo') ||
       i.domain?.includes('ecotrack')) && i.isActive
    ) || integrations.find(i => i.isActive) || null;
  }, [settings?.shippingIntegrations]);

  // Sync token input with settings
  useEffect(() => {
    if (dhdIntegration?.token) {
      setApiTokenInput(dhdIntegration.token);
    }
  }, [dhdIntegration]);



  // Communes for selected Wilaya in modal
  const modalWilayaCommunes = useMemo(() => {
    const wId = parseInt(formData.wilayaCode, 10);
    if (!wId || isNaN(wId)) return [];
    return (ecotrackCommunes as any[]).filter(c => c.wilaya_id === wId);
  }, [formData.wilayaCode]);

  // Grouped Bureaus by Wilaya
  const bureausByWilaya = useMemo(() => {
    const map = new Map<string, ShippingBureau[]>();
    
    // Sort bureaus by wilaya code numeric
    const sorted = [...shippingBureaus].sort((a, b) => {
      const codeA = parseInt(a.wilayaCode, 10) || 0;
      const codeB = parseInt(b.wilayaCode, 10) || 0;
      if (codeA !== codeB) return codeA - codeB;
      return (a.communeName || '').localeCompare(b.communeName || '');
    });

    sorted.forEach(b => {
      const code = b.wilayaCode || '00';
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code)!.push(b);
    });

    return map;
  }, [shippingBureaus]);

  // List of multi-desk wilayas
  const multiDeskWilayasList = useMemo(() => {
    const list: { code: string; name: string; count: number }[] = [];
    bureausByWilaya.forEach((bureaus, code) => {
      if (bureaus.length > 1) {
        const wName = bureaus[0]?.wilayaName || WILAYAS_MAP[code] || `ولاية ${code}`;
        list.push({ code, name: wName, count: bureaus.length });
      }
    });
    return list.sort((a, b) => b.count - a.count);
  }, [bureausByWilaya]);

  // Filtered Bureaus
  const filteredBureaus = useMemo(() => {
    return shippingBureaus.filter(b => {
      // Wilaya Dropdown filter
      if (selectedWilayaFilter !== 'all' && b.wilayaCode !== selectedWilayaFilter) {
        return false;
      }

      // Tab filter
      if (activeTabFilter === 'multi') {
        const count = bureausByWilaya.get(b.wilayaCode)?.length || 0;
        if (count <= 1) return false;
      } else if (activeTabFilter === 'api' && b.source !== 'api') {
        return false;
      } else if (activeTabFilter === 'manual' && b.source === 'api') {
        return false;
      } else if (activeTabFilter === 'stopdesk' && b.hasStopDesk === false) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesCode = (b.wilayaCode || '').includes(term);
        const matchesWilaya = (b.wilayaName || '').toLowerCase().includes(term);
        const matchesCommune = (b.communeName || '').toLowerCase().includes(term);
        const matchesDeskName = (b.deskName || '').toLowerCase().includes(term);
        const matchesAddress = (b.address || '').toLowerCase().includes(term);
        const matchesPhones = (b.phones || '').includes(term);
        const matchesCompany = (b.companyName || '').toLowerCase().includes(term);
        return matchesCode || matchesWilaya || matchesCommune || matchesDeskName || matchesAddress || matchesPhones || matchesCompany;
      }

      return true;
    });
  }, [shippingBureaus, selectedWilayaFilter, activeTabFilter, searchTerm, bureausByWilaya]);

  // Filtered Grouped Map for Grouped View
  const filteredGroupedMap = useMemo(() => {
    const map = new Map<string, ShippingBureau[]>();
    filteredBureaus.forEach(b => {
      const code = b.wilayaCode || '00';
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code)!.push(b);
    });
    return map;
  }, [filteredBureaus]);

  // Global Statistics
  const stats = useMemo(() => {
    const total = shippingBureaus.length;
    const coveredWilayas = new Set(shippingBureaus.map(b => b.wilayaCode)).size;
    const multiDeskCount = multiDeskWilayasList.length;
    const stopDeskCount = shippingBureaus.filter(b => b.hasStopDesk !== false).length;
    const apiCount = shippingBureaus.filter(b => b.source === 'api').length;
    const manualCount = total - apiCount;
    return { total, coveredWilayas, multiDeskCount, stopDeskCount, apiCount, manualCount };
  }, [shippingBureaus, multiDeskWilayasList]);

  // Handle Query API (DHD Expedia Go /api/v1/get/desks)
  const handleQueryApiDesks = async () => {
    const tokenToUse = apiTokenInput.trim() || dhdIntegration?.token || '';
    if (!tokenToUse) {
      toast.error('يرجى إدخال رمز API Token لشركة الشحن DHD Expedia Go أولاً.');
      return;
    }

    setIsSyncingApi(true);
    setApiSyncReport(null);
    const toastId = toast.loading('جاري الاستعلام عن المكاتب من API شركة الشحن DHD Expedia Go...');

    try {
      const domain = dhdIntegration?.domain || 'https://expedigo.ecotrack.dz';
      const cleanDomain = domain.replace(/\/+$/, '');
      const targetDomain = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;

      // Save token if user provided one and integration exists
      if (apiTokenInput.trim() && dhdIntegration && dhdIntegration.token !== apiTokenInput.trim()) {
        const updatedIntegrations = (settings?.shippingIntegrations || []).map(i => 
          i.id === dhdIntegration.id ? { ...i, token: apiTokenInput.trim() } : i
        );
        await updateSettings({ shippingIntegrations: updatedIntegrations });
      }

      const res = await fetch('/api/shipping/ecotrack/desks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: targetDomain, token: tokenToUse })
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || 'فشل الاتصال بواجهة برمجة شركة الشحن');
      }

      let rawDesks: any[] = [];
      if (json.data.my_desk) rawDesks.push(json.data.my_desk);
      if (json.data.other_desks && Array.isArray(json.data.other_desks)) {
        rawDesks = rawDesks.concat(json.data.other_desks);
      }
      if (json.data.desks && Array.isArray(json.data.desks)) {
        rawDesks = rawDesks.concat(json.data.desks);
      }
      if (Array.isArray(json.data)) {
        rawDesks = rawDesks.concat(json.data);
      }

      // Preserve EVERY desk uniquely (do not collapse multi-desk wilayas!)
      const deskMap = new Map<string, any>();
      rawDesks.forEach((d, idx) => {
        const idKey = String(d.id || d.desk_id || `${d.wilaya_id}-${d.commune_id || d.name || idx}`);
        deskMap.set(idKey, d);
      });
      const uniqueDesks = Array.from(deskMap.values());

      if (uniqueDesks.length === 0) {
        toast.error('لم ترجع شركة الشحن أي مكاتب مسجلة.', { id: toastId });
        setIsSyncingApi(false);
        return;
      }

      const normalizedBureaus: ShippingBureau[] = uniqueDesks.map((d: any) => {
        const rawWilayaId = parseInt(d.wilaya_id || d.wilaya || '0', 10);
        const codeStr = rawWilayaId > 0 ? (rawWilayaId < 10 ? `0${rawWilayaId}` : `${rawWilayaId}`) : '16';
        const wilayaFullName = WILAYAS_MAP[codeStr] || `ولاية ${codeStr}`;
        const wilayaCleanName = wilayaFullName.split(' - ')[1] || wilayaFullName;

        let commune = d.commune_name || d.commune || d.commune_nom || '';
        if (!commune && d.commune_id) {
          const matchC = (ecotrackCommunes as any[]).find(c => c.id === d.commune_id);
          if (matchC) commune = matchC.nom;
        }

        const phoneVal = [d.phone, d.phone2, d.telephone, d.phones].filter(Boolean).join('\n');
        const deskId = `dhd-api-${d.id || `${codeStr}-${d.commune_id || d.name || commune}`.replace(/\s+/g, '_')}`;

        return {
          id: deskId,
          wilayaCode: codeStr,
          wilayaName: wilayaCleanName,
          communeName: commune || undefined,
          deskName: d.name || d.hub_name || `مكتب ${commune || wilayaCleanName}`,
          companyName: dhdIntegration?.name || 'DHD Expedia Go',
          hasStopDesk: d.has_stop_desk !== 0,
          address: d.adresse || d.address || d.location?.adresse || '',
          phones: phoneVal,
          source: 'api',
          updatedAt: new Date().toISOString()
        };
      });

      // Strictly save ONLY what was returned by the API as requested
      await replaceAllShippingBureaus(normalizedBureaus);

      // Analyze multi-desk wilayas in response
      const wilayaCounts = new Map<string, number>();
      normalizedBureaus.forEach(b => {
        wilayaCounts.set(b.wilayaName, (wilayaCounts.get(b.wilayaName) || 0) + 1);
      });
      const multiDesks: { wilaya: string; count: number }[] = [];
      wilayaCounts.forEach((cnt, w) => {
        if (cnt > 1) multiDesks.push({ wilaya: w, count: cnt });
      });

      setApiSyncReport({
        success: true,
        totalFetched: normalizedBureaus.length,
        wilayasCount: wilayaCounts.size,
        multiDeskWilayas: multiDesks
      });

      toast.success(`تم استبدال وحفظ ${normalizedBureaus.length} مكتب بنجاح وفق ما ورد في الـ API الخاص بشركة الشحن فقط!`, { id: toastId, duration: 4000 });
    } catch (err: any) {
      console.error('API Sync Error:', err);
      toast.error(`حدث خطأ أثناء الاتصال بالـ API: ${err.message || err}`, { id: toastId, duration: 5000 });
    } finally {
      setIsSyncingApi(false);
    }
  };

  // Pure API refresh and wipe handler
  const handleWipeAndFetchApi = async () => {
    if (window.confirm('هل تريد مسح أي مكاتب قديمة وجلب المكاتب الحقيقية مباشرة من API شركة الشحن /api/v1/get/desks؟')) {
      handleQueryApiDesks();
    }
  };

  // Modal Open Handlers
  const handleOpenEditModal = (bureau?: ShippingBureau, preselectedWilayaCode?: string) => {
    if (bureau) {
      setEditingBureau(bureau);
      setFormData({
        wilayaCode: bureau.wilayaCode || '16',
        wilayaName: bureau.wilayaName || 'الجزائر (Alger)',
        communeName: bureau.communeName || '',
        deskName: bureau.deskName || '',
        companyName: bureau.companyName || dhdIntegration?.name || 'DHD Expedia Go',
        hasStopDesk: bureau.hasStopDesk ?? true,
        address: bureau.address || '',
        phones: bureau.phones || ''
      });
      setCustomCommuneInput(!bureau.communeName || !modalWilayaCommunes.some(c => c.nom.toLowerCase() === (bureau.communeName || '').toLowerCase()));
    } else {
      const code = preselectedWilayaCode || '16';
      const wObj = ALGERIA_WILAYAS.find(w => w.code === code);
      setEditingBureau(null);
      setFormData({
        wilayaCode: code,
        wilayaName: wObj ? wObj.name : 'الجزائر (Alger)',
        communeName: '',
        deskName: '',
        companyName: dhdIntegration?.name || 'DHD Expedia Go',
        hasStopDesk: true,
        address: '',
        phones: ''
      });
      setCustomCommuneInput(false);
    }
    setIsEditModalOpen(true);
  };

  const handleWilayaChangeInModal = (code: string) => {
    const wilayaObj = ALGERIA_WILAYAS.find(w => w.code === code);
    const newWilayaName = wilayaObj ? wilayaObj.name : `ولاية ${code}`;
    setFormData(prev => ({
      ...prev,
      wilayaCode: code,
      wilayaName: newWilayaName,
      communeName: ''
    }));
  };

  // Save Add / Edit
  const handleSaveBureau = async () => {
    try {
      if (!formData.wilayaCode || !formData.wilayaName) {
        toast.error('يرجى اختيار الولاية');
        return;
      }

      if (editingBureau) {
        await updateShippingBureau(editingBureau.id, {
          ...formData,
          source: editingBureau.source || 'manual',
          updatedAt: new Date().toISOString()
        });
        toast.success(`تم تحديث مكتب "${formData.deskName || formData.communeName || formData.wilayaName}" بنجاح!`);
      } else {
        const newId = `manual-desk-${formData.wilayaCode}-${Date.now()}`;
        await addShippingBureau({
          id: newId,
          ...formData,
          source: 'manual',
          updatedAt: new Date().toISOString()
        });
        toast.success(`تمت إضافة المكتب بنجاح إلى ولاية ${formData.wilayaName}!`);
      }
      setIsEditModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('حدث خطأ أثناء حفظ المكتب');
    }
  };

  // Delete Action
  const handleDeleteBureau = async () => {
    if (!deleteConfirmTarget) return;
    try {
      await deleteShippingBureau(deleteConfirmTarget.id);
      toast.success(`تم حذف مكتب "${deleteConfirmTarget.deskName || deleteConfirmTarget.communeName || deleteConfirmTarget.wilayaName}" بنجاح.`);
      setDeleteConfirmTarget(null);
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف المكتب.');
    }
  };

  const toggleWilayaCollapse = (code: string) => {
    setCollapsedWilayas(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Top Professional Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-sm">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-gray-900">
                  دليل مكاتب الشحن (DHD Expedia Go)
                </h2>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  مكاتب متعددة وتحديث مباشر
                </span>
              </div>
              <p className="text-gray-500 text-xs font-semibold mt-0.5">
                إدارة شاملة لجميع مكاتب الشحن ووكالات الاستلام (Stop Desk) مع تنظيم الولايات التي تحتوي على أكثر من مكتب ومزامنتها عبر الـ API
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Query API Button */}
          <button 
            onClick={() => setIsApiModalOpen(true)}
            className="flex-1 lg:flex-none bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="استعلام مباشر من API شركة الشحن وجلب المكاتب المتوفرة"
          >
            <RefreshCw className="w-4 h-4" />
            <span>استعلام ومزامنة API (/get/desks)</span>
          </button>

          {/* Add New Bureau */}
          <button 
            onClick={() => handleOpenEditModal()}
            className="flex-1 lg:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة مكتب جديد</span>
          </button>

          {/* API Strict Sync & Replace */}
          <button 
            onClick={handleWipeAndFetchApi}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="جلب المكاتب الحقيقية مباشرة من API شركة الشحن /api/v1/get/desks واعتمادها فقط"
          >
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">مزامنة مكاتب API فقط</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 block mb-1">إجمالي المكاتب والوكالات</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-900">{stats.total}</span>
            <span className="text-xs font-bold text-gray-400">مكتب مسجل</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 block mb-1">الولايات المغطاة</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-600">{stats.coveredWilayas}</span>
            <span className="text-xs font-bold text-gray-400">/ 58 ولاية</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs border-r-4 border-r-amber-500">
          <span className="text-[11px] font-bold text-amber-800 block mb-1">ولايات متعددة المكاتب 🔥</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{stats.multiDeskCount}</span>
            <span className="text-xs font-bold text-amber-700">ولاية بها مكتبان فأكثر</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 block mb-1">مكاتب Stop Desk معتمدة</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{stats.stopDeskCount}</span>
            <span className="text-xs font-bold text-emerald-700">مكتب مفعل</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs col-span-2 md:col-span-1">
          <span className="text-[11px] font-bold text-gray-500 block mb-1">المصدر (API / يدوي)</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-black px-2 py-0.5 rounded-md">
              API: {stats.apiCount}
            </span>
            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black px-2 py-0.5 rounded-md">
              يدوي: {stats.manualCount}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Desk Wilayas Quick Bar (Shows when multiple desks exist) */}
      {multiDeskWilayasList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/70 via-indigo-50/50 to-amber-50/70 p-4 rounded-3xl border border-amber-200 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-500 text-white rounded-lg text-xs font-black">🔥</span>
              <h4 className="text-xs font-black text-amber-950">
                الولايات التي تتوفر على أكثر من مكتب (مكاتب موزعة حسب البلديات):
              </h4>
            </div>
            <button
              onClick={() => setActiveTabFilter(activeTabFilter === 'multi' ? 'all' : 'multi')}
              className={`text-[11px] font-black px-3 py-1 rounded-xl transition-all cursor-pointer ${
                activeTabFilter === 'multi'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
              }`}
            >
              {activeTabFilter === 'multi' ? 'عرض كل الولايات' : 'تصفية الولايات متعددة المكاتب فقط'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {multiDeskWilayasList.map(item => (
              <button
                key={item.code}
                onClick={() => {
                  setSelectedWilayaFilter(item.code);
                  setActiveTabFilter('all');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedWilayaFilter === item.code
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-800 border border-amber-200 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              >
                <span className="font-mono font-black text-[10px] opacity-75">{item.code}</span>
                <span>{item.name.split(' (')[0]}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                  selectedWilayaFilter === item.code ? 'bg-indigo-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {item.count} مكاتب
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Card: Toolbar + Views */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-xs border border-gray-100 space-y-5">
        {/* Search, Wilaya Selector, and View Mode */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="ابحث برقم الولاية، اسم الولاية، البلدية، اسم المكتب، العنوان، أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-xs font-bold transition-all"
            />
          </div>

          {/* Wilaya Filter Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedWilayaFilter}
              onChange={(e) => setSelectedWilayaFilter(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl border border-gray-200 bg-gray-50 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
            >
              <option value="all">كل الولايات (58 ولاية)</option>
              {ALGERIA_WILAYAS.map(w => {
                const count = bureausByWilaya.get(w.code)?.length || 0;
                return (
                  <option key={w.code} value={w.code}>
                    {w.fullName} ({count} {count > 1 ? 'مكاتب' : 'مكتب'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-2xl shrink-0 self-center">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="عرض منظم حسب الولايات والمكاتب التابعة لها"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>تنظيم بالولايات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="عرض كجدول بيانات مفصل"
            >
              <List className="w-3.5 h-3.5" />
              <span>جدول المكاتب</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 pb-3">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTabFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            كل المكاتب ({stats.total})
          </button>
          <button
            onClick={() => setActiveTabFilter('multi')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTabFilter === 'multi'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            الولايات متعددة المكاتب فقط ({stats.multiDeskCount})
          </button>
          <button
            onClick={() => setActiveTabFilter('api')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTabFilter === 'api'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
            }`}
          >
            مزامنة API فقط ({stats.apiCount})
          </button>
          <button
            onClick={() => setActiveTabFilter('manual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTabFilter === 'manual'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            مضافة يدوياً ({stats.manualCount})
          </button>
          <button
            onClick={() => setActiveTabFilter('stopdesk')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTabFilter === 'stopdesk'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            مكاتب Stop Desk المتوفرة ({stats.stopDeskCount})
          </button>

          {(selectedWilayaFilter !== 'all' || searchTerm.trim() || activeTabFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedWilayaFilter('all');
                setSearchTerm('');
                setActiveTabFilter('all');
              }}
              className="mr-auto text-xs font-bold text-rose-600 hover:underline cursor-pointer"
            >
              إلغاء كل الفلاتر
            </button>
          )}
        </div>

        {/* VIEW 1: GROUPED BY WILAYA (Default Professional Layout) */}
        {viewMode === 'grouped' && (
          <div className="space-y-4">
            {filteredGroupedMap.size > 0 ? (
              Array.from(filteredGroupedMap.entries()).map(([wilayaCode, bureaus]) => {
                const isMulti = bureaus.length > 1;
                const isCollapsed = !!collapsedWilayas[wilayaCode];
                const wilayaName = bureaus[0]?.wilayaName || WILAYAS_MAP[wilayaCode] || `ولاية ${wilayaCode}`;

                return (
                  <div 
                    key={wilayaCode}
                    className={`rounded-3xl border transition-all ${
                      isMulti 
                        ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/30 via-white to-amber-50/20 shadow-2xs' 
                        : 'border-gray-200/80 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Wilaya Header Bar */}
                    <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100/80">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-mono font-black text-sm shadow-2xs ${
                          isMulti ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {wilayaCode}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-gray-900">
                              {wilayaName}
                            </h3>
                            {isMulti ? (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span>🔥</span>
                                <span>متعدد المكاتب ({bureaus.length} مكاتب متوفرة)</span>
                              </span>
                            ) : (
                              <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                مكتب واحد
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 font-medium">
                            {bureaus.map(b => b.communeName || b.deskName).filter(Boolean).slice(0, 4).join(' • ')}
                            {bureaus.length > 4 && ` • و${bureaus.length - 4} أخرى...`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleOpenEditModal(undefined, wilayaCode)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                          title={`إضافة مكتب آخر لولاية ${wilayaName}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ إضافة مكتب إضافي</span>
                        </button>

                        <button
                          onClick={() => toggleWilayaCollapse(wilayaCode)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                          title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
                        >
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Bureaus Cards Grid inside Wilaya */}
                    {!isCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bureaus.map(bureau => (
                          <div
                            key={bureau.id}
                            className="bg-white rounded-2xl p-3.5 border border-gray-100 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between group relative"
                          >
                            <div>
                              {/* Card Header: Desk Name & Badges */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <h4 className="font-black text-gray-900 text-xs flex items-center gap-1.5">
                                    <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span className="truncate">{bureau.deskName || `مكتب ${bureau.communeName || bureau.wilayaName}`}</span>
                                  </h4>
                                  {bureau.communeName && (
                                    <span className="inline-block mt-1 bg-gray-100 text-gray-700 font-bold text-[10px] px-2 py-0.5 rounded-md">
                                      البلدية: {bureau.communeName}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {bureau.hasStopDesk !== false ? (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                      <Check className="w-2.5 h-2.5" />
                                      Stop Desk
                                    </span>
                                  ) : (
                                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                                      غير متاح
                                    </span>
                                  )}

                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                                    bureau.source === 'api'
                                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}>
                                    {bureau.source === 'api' ? 'API' : 'يدوي'}
                                  </span>
                                </div>
                              </div>

                              {/* Address */}
                              {bureau.address && (
                                <div className="text-[11px] text-gray-600 mb-2 leading-relaxed flex items-start gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{bureau.address}</span>
                                </div>
                              )}

                              {/* Phones */}
                              {bureau.phones && (
                                <div className="space-y-0.5 mb-3" dir="ltr" style={{ textAlign: 'right' }}>
                                  {bureau.phones.split('\n').filter(Boolean).map((phone, i) => (
                                    <a
                                      key={i}
                                      href={`tel:${phone.trim().replace(/\s+/g, '')}`}
                                      className="text-indigo-600 hover:text-indigo-800 text-[11px] font-mono font-bold flex items-center gap-1 hover:underline"
                                    >
                                      <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span>{phone.trim()}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Card Footer: Action Buttons */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs mt-1">
                              <span className="text-[10px] text-gray-400 font-bold">
                                {bureau.companyName || 'DHD Expedia Go'}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(bureau)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل بيانات هذا المكتب"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmTarget(bureau)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف هذا المكتب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-gray-400 font-bold bg-gray-50/60 rounded-3xl">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-base text-gray-700 font-black mb-1">لا توجد مكاتب مطابقة لخيارات البحث</p>
                <p className="text-xs text-gray-400">جرب تعديل كلمة البحث أو إلغاء تفعيل الفلاتر الحالية</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FULL DATA TABLE */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto custom-scrollbar border border-gray-100 rounded-2xl">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold">
                  <th className="py-3 px-3 w-14 text-center">كود</th>
                  <th className="py-3 px-3 w-36">الولاية</th>
                  <th className="py-3 px-3 w-36">البلدية</th>
                  <th className="py-3 px-3 w-48">اسم المكتب & الشركة</th>
                  <th className="py-3 px-3 min-w-[220px]">العنوان بالتفصيل</th>
                  <th className="py-3 px-3 w-44">أرقام التواصل</th>
                  <th className="py-3 px-3 w-28 text-center">Stop Desk</th>
                  <th className="py-3 px-3 w-24 text-center">المصدر</th>
                  <th className="py-3 px-3 w-24 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBureaus.length > 0 ? (
                  filteredBureaus.map(bureau => (
                    <tr key={bureau.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">
                        {bureau.wilayaCode}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">
                        {bureau.wilayaName}
                      </td>
                      <td className="py-3 px-3">
                        {bureau.communeName ? (
                          <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                            {bureau.communeName}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">مكتب الولاية العام</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-gray-900">{bureau.deskName || 'مكتب شحن'}</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 w-max px-1.5 py-0.2 rounded">
                            {bureau.companyName || 'DHD Expedia Go'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600 text-[11px] leading-relaxed max-w-xs">
                        {bureau.address || '-'}
                      </td>
                      <td className="py-3 px-3">
                        {bureau.phones ? (
                          <div className="flex flex-col gap-0.5" dir="ltr" style={{ textAlign: 'right' }}>
                            {bureau.phones.split('\n').filter(Boolean).map((phone, i) => (
                              <a 
                                key={i} 
                                href={`tel:${phone.trim().replace(/\s+/g, '')}`} 
                                className="text-indigo-600 hover:text-indigo-800 font-mono text-[11px] font-bold block hover:underline"
                              >
                                {phone.trim()}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {bureau.hasStopDesk !== false ? (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                            <Check className="w-3 h-3" />
                            متوفر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                            <XCircle className="w-3 h-3" />
                            معطل
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {bureau.source === 'api' ? (
                          <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md text-[10px] font-black">
                            API
                          </span>
                        ) : (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-black">
                            يدوي
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleOpenEditModal(bureau)} 
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات المكتب"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmTarget(bureau)} 
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف هذا المكتب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 font-bold bg-gray-50/50">
                      <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      لا توجد مكاتب مطابقة لخيارات البحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: API QUERY & SYNC DIALOG */}
      {isApiModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    استعلام ومزامنة مكاتب API (DHD Expedia Go)
                  </h3>
                  <span className="text-gray-400 text-xs">/api/v1/get/desks</span>
                </div>
              </div>
              <button 
                onClick={() => setIsApiModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs custom-scrollbar">
              {/* Endpoint Information */}
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-bold">رابط النظام (EcoTrack Domain):</span>
                  <span className="font-mono font-bold text-gray-800" dir="ltr">
                    {dhdIntegration?.domain || 'https://expedigo.ecotrack.dz'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-bold">نقطة الاستعلام (Endpoint):</span>
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black" dir="ltr">
                    GET /api/v1/get/desks
                  </span>
                </div>
              </div>

              {/* API Token Input */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  رمز API Token الخاص بشركة الشحن (Bearer Token):
                </label>
                <input 
                  type="text"
                  dir="ltr"
                  value={apiTokenInput}
                  onChange={(e) => setApiTokenInput(e.target.value)}
                  placeholder="ضع رمز Token الخاص بـ DHD Expedia Go هنا..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  يمكنك الحصول على الرمز من لوحة تحكم شركة الشحن DHD Expedia Go (قسم المطورين / API).
                </p>
              </div>

              {/* Report Box if synced */}
              {apiSyncReport && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>تم الاستعلام بنجاح وإضافة المكاتب لقاعدة البيانات!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900 font-bold pt-1">
                    <div>إجمالي المكاتب المسترجعة: <span className="font-black text-emerald-700">{apiSyncReport.totalFetched}</span></div>
                    <div>عدد الولايات المغطاة: <span className="font-black text-emerald-700">{apiSyncReport.wilayasCount}</span></div>
                  </div>
                  {apiSyncReport.multiDeskWilayas.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200">
                      <span className="text-[11px] font-black text-emerald-950 block mb-1">
                        الولايات متعددة المكاتب المكتشفة ({apiSyncReport.multiDeskWilayas.length} ولاية):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {apiSyncReport.multiDeskWilayas.map((m, i) => (
                          <span key={i} className="bg-white/90 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                            {m.wilaya}: {m.count} مكاتب
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 shrink-0">
              <button 
                onClick={() => setIsApiModalOpen(false)} 
                className="flex-[0.35] px-4 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
              <button 
                onClick={handleQueryApiDesks}
                disabled={isSyncingApi}
                className="flex-[0.65] px-4 py-2.5 font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingApi ? 'animate-spin' : ''}`} />
                <span>{isSyncingApi ? 'جاري الاستعلام والمزامنة...' : 'بدء الاستعلام وإضافة المكاتب الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT BUREAU DIALOG */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                {editingBureau ? 'تعديل بيانات مكتب الشحن' : 'إضافة مكتب جديد لولاية / بلدية'}
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
              {/* Company & Desk Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">شركة الشحن المربوطة</label>
                  <input 
                    type="text" 
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all"
                    placeholder="DHD Expedia Go"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">اسم المكتب أو الوكالة</label>
                  <input 
                    type="text" 
                    value={formData.deskName}
                    onChange={(e) => setFormData({ ...formData, deskName: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all"
                    placeholder="مثال: مكتب الشراقة، وكالة باب الزوار..."
                  />
                </div>
              </div>

              {/* Wilaya & Commune Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">الولاية (مطلوب)</label>
                  <select
                    value={formData.wilayaCode}
                    onChange={(e) => handleWilayaChangeInModal(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all cursor-pointer"
                  >
                    {ALGERIA_WILAYAS.map(w => (
                      <option key={w.code} value={w.code}>{w.fullName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-gray-700">البلدية المحددة</label>
                    <button
                      type="button"
                      onClick={() => setCustomCommuneInput(!customCommuneInput)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {customCommuneInput ? '← اختيار من القائمة' : '+ كتابة بلدية مخصصة'}
                    </button>
                  </div>
                  {customCommuneInput ? (
                    <input 
                      type="text" 
                      value={formData.communeName}
                      onChange={(e) => setFormData({ ...formData, communeName: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all"
                      placeholder="اكتب اسم البلدية هنا..."
                    />
                  ) : (
                    <select
                      value={formData.communeName}
                      onChange={(e) => setFormData({ ...formData, communeName: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all cursor-pointer"
                    >
                      <option value="">-- مكتب عام للولاية أو اختر بلدية محددة --</option>
                      {modalWilayaCommunes.map((c: any, idx: number) => (
                        <option key={idx} value={c.nom}>{c.nom}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">العنوان التفصيلي وموقع المكتب</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium transition-all"
                  placeholder="الشارع، الحي، بجانب معلم معروف أو مركز بريد..."
                />
              </div>

              {/* Phones */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">أرقام هواتف المكتب (كل رقم في سطر مستقل)</label>
                <textarea 
                  value={formData.phones}
                  onChange={(e) => setFormData({ ...formData, phones: e.target.value })}
                  rows={2}
                  dir="ltr"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-mono font-bold transition-all text-left"
                  placeholder="07-70-01-14-56&#10;05-55-21-42-18"
                />
              </div>

              {/* Stop Desk Checkbox */}
              <div className="flex items-center gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <input
                  type="checkbox"
                  id="hasStopDesk"
                  checked={formData.hasStopDesk}
                  onChange={(e) => setFormData({ ...formData, hasStopDesk: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="hasStopDesk" className="font-black text-emerald-900 cursor-pointer select-none block">
                    مكتب معتمد للتسليم (Stop Desk / استلام الزبون من المكتب)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    سيظهر هذا المكتب تلقائياً للطلبيات التي تختار طريقة الشحن "توصيل للمكتب / Stop Desk"
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 shrink-0">
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="flex-[0.35] px-4 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                onClick={handleSaveBureau} 
                className="flex-[0.65] px-4 py-2.5 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
              >
                {editingBureau ? 'حفظ تعديلات المكتب' : 'إضافة المكتب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION DIALOG */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 text-right">
            <div className="p-3 bg-rose-50 text-rose-600 w-max rounded-2xl mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-gray-900 mb-1">
              تأكيد حذف مكتب الشحن
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              هل أنت متأكد من رغبتك في حذف مكتب <strong>"{deleteConfirmTarget.deskName || deleteConfirmTarget.communeName || deleteConfirmTarget.wilayaName}"</strong> التابع لولاية <strong>{deleteConfirmTarget.wilayaName}</strong>؟ لن تتمكن طلبيات Stop Desk من الربط بهذا المكتب بعد حذفه.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="flex-1 px-4 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                onClick={handleDeleteBureau}
                className="flex-1 px-4 py-2.5 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm shadow-rose-100 cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
