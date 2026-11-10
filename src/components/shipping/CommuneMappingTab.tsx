import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, X, Search, RefreshCw, Sparkles, Building2, MapPin, 
  AlertTriangle, Save, CheckCircle2, SlidersHorizontal, ArrowRight,
  Filter, Download, Database, HelpCircle, Layers, Globe, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import defaultEcoCommunes from '../../ecotrack-communes.json';
import { 
  ALGERIA_WILAYAS, 
  getAllWooCommerceCommunes, 
  findBestEcoTrackMatch, 
  EcoCommune, 
  WpCommuneEntry,
  resolveEcoTrackCommune
} from '../../utils/communeMatchingUtils';

export function CommuneMappingTab() {
  const { settings, updateSettings, fetchShippingCommunes, applyOfficialCommuneNamesToExistingOrders } = useStore();
  const integrations = settings?.shippingIntegrations || [];

  // Selected company integration ID or 'default'
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('default');

  // Selected Wilaya (0 for all, or 1 to 58)
  const [selectedWilaya, setSelectedWilaya] = useState<number>(16); // Default Alger (16)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'unmatched' | 'manual'>('all');

  // Live EcoTrack communes per company/wilaya
  const [liveEcoCommunes, setLiveEcoCommunes] = useState<EcoCommune[]>(defaultEcoCommunes as EcoCommune[]);
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApplyingToOrders, setIsApplyingToOrders] = useState<boolean>(false);

  // Local draft mappings for current selected company: { [wpNom]: ecotrackNom }
  const [mappingsDraft, setMappingsDraft] = useState<Record<string, string>>({});

  // Pagination for fast rendering when "all wilayas" is selected
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Sandbox Tester State
  const [testInputCity, setTestInputCity] = useState<string>('Hamma Anassers');
  const [testWilaya, setTestWilaya] = useState<number>(16);

  // Initialize draft mappings from settings
  useEffect(() => {
    const existing = settings?.communeMappings?.[selectedCompanyId] || 
                     settings?.communeMappings?.['default'] || 
                     {};
    setMappingsDraft({ ...existing });
  }, [selectedCompanyId, settings?.communeMappings]);

  // Selected company object
  const currentCompany = useMemo(() => {
    return integrations.find(i => i.id === selectedCompanyId || i.name === selectedCompanyId);
  }, [integrations, selectedCompanyId]);

  // All WordPress communes (1541 entries)
  const allWpCommunes = useMemo(() => {
    return getAllWooCommerceCommunes();
  }, []);

  // Filtered WordPress communes based on selected Wilaya and search
  const filteredWpCommunes = useMemo(() => {
    let list = allWpCommunes;

    if (selectedWilaya > 0) {
      list = list.filter(c => c.wilaya_id === selectedWilaya);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => 
        c.wpNom.toLowerCase().includes(q) ||
        c.wilayaNameAr.includes(q) ||
        c.wilayaNameFr.toLowerCase().includes(q) ||
        String(c.wilaya_id) === q ||
        (mappingsDraft[c.wpNom] && mappingsDraft[c.wpNom].toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter(c => {
        const isManual = Boolean(mappingsDraft[c.wpNom]);
        const matchRes = findBestEcoTrackMatch(c.wpNom, c.wilaya_id, liveEcoCommunes, mappingsDraft);
        const hasValidMatch = Boolean(matchRes.match && matchRes.confidence !== 'none');

        if (statusFilter === 'manual') return isManual;
        if (statusFilter === 'matched') return hasValidMatch || isManual;
        if (statusFilter === 'unmatched') return !hasValidMatch && !isManual;
        return true;
      });
    }

    return list;
  }, [allWpCommunes, selectedWilaya, searchQuery, statusFilter, mappingsDraft, liveEcoCommunes]);

  // Total pages
  const totalPages = Math.ceil(filteredWpCommunes.length / pageSize) || 1;
  const paginatedCommunes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWpCommunes.slice(start, start + pageSize);
  }, [filteredWpCommunes, currentPage, pageSize]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWilaya, searchQuery, statusFilter]);

  // Overall Statistics across all 1541 WordPress communes
  const stats = useMemo(() => {
    let exactCount = 0;
    let highCount = 0;
    let manualCount = 0;
    let unmatchedCount = 0;

    for (const c of allWpCommunes) {
      if (mappingsDraft[c.wpNom]) {
        manualCount++;
      } else {
        const res = findBestEcoTrackMatch(c.wpNom, c.wilaya_id, liveEcoCommunes, {});
        if (res.confidence === 'exact') exactCount++;
        else if (res.confidence === 'high' || res.confidence === 'medium') highCount++;
        else unmatchedCount++;
      }
    }

    const total = allWpCommunes.length;
    const totalMatched = exactCount + highCount + manualCount;
    const matchPercent = total > 0 ? Math.round((totalMatched / total) * 100) : 0;

    return {
      total,
      exactCount,
      highCount,
      manualCount,
      unmatchedCount,
      totalMatched,
      matchPercent
    };
  }, [allWpCommunes, liveEcoCommunes, mappingsDraft]);

  // Fetch live communes from EcoTrack API for the current company & wilaya
  const handleFetchLiveFromApi = async () => {
    if (!currentCompany) {
      toast.error('يرجى اختيار شركة شحن مربوطة بحساب EcoTrack أولاً، أو استخدام القائمة المحلية المدمجة.');
      return;
    }

    setIsFetchingLive(true);
    const loadingToast = toast.loading(`جاري الاتصال بـ API شركة "${currentCompany.name}" وجلب البلديات...`);

    try {
      const data = await fetchShippingCommunes(currentCompany.name, selectedWilaya > 0 ? selectedWilaya : 0);
      if (data && data.length > 0) {
        setLiveEcoCommunes(data as EcoCommune[]);
        toast.success(`تم جلب ${data.length} بلدية حية بنجاح من نظام شركة الشحن!`, { id: loadingToast });
      } else {
        toast.error('لم يتم استرجاع بلديات من الـ API، تم الإبقاء على قاعدة بيانات البلديات المحلية.', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(`تعذر جلب البلديات من الـ API: ${err.message || 'خطأ في الاتصال'}`, { id: loadingToast });
    } finally {
      setIsFetchingLive(false);
    }
  };

  // Run Smart Auto-Match for all communes in view or all 1541 communes
  const handleAutoMatchAll = () => {
    let newlyMatched = 0;
    const nextDraft = { ...mappingsDraft };

    const targetList = selectedWilaya > 0 
      ? allWpCommunes.filter(c => c.wilaya_id === selectedWilaya)
      : allWpCommunes;

    for (const c of targetList) {
      // Do not overwrite manual mappings unless explicitly requested
      if (!nextDraft[c.wpNom]) {
        const res = findBestEcoTrackMatch(c.wpNom, c.wilaya_id, liveEcoCommunes, {});
        if (res.match && res.confidence !== 'none') {
          nextDraft[c.wpNom] = res.match.nom;
          newlyMatched++;
        }
      }
    }

    setMappingsDraft(nextDraft);
    toast.success(`تمت المطابقة الذكية بنجاح! تم اعتماد وتحديث ${newlyMatched} مطابقة لبلديات الووردبريس.`);
  };

  // Update a single mapping for a commune
  const handleSelectMapping = (wpNom: string, ecoNom: string) => {
    setMappingsDraft(prev => {
      const updated = { ...prev };
      if (!ecoNom) {
        delete updated[wpNom];
      } else {
        updated[wpNom] = ecoNom;
      }
      return updated;
    });
  };

  // Apply and permanently save official commune names in all existing store orders
  const handleApplyToOrders = async () => {
    setIsApplyingToOrders(true);
    const toastId = toast.loading('جاري فحص وتحديث أسماء البلديات في جميع طلبيات المتجر وتثبيتها في قاعدة البيانات...');
    try {
      const res = await applyOfficialCommuneNamesToExistingOrders(selectedCompanyId !== 'default' ? selectedCompanyId : undefined);
      if (res.updatedCount > 0) {
        toast.success(`تم بنجاح تحديث وتثبيت الاسم الرسمي لشركة الشحن في ${res.updatedCount} طلبية مسجلة! لن تحتاج لإعادة مطابقتها مرة ثانية.`, { id: toastId, duration: 6000 });
      } else {
        toast.success('جميع طلبيات المتجر الحالية مسجلة ومطابقة بالفعل بالأسماء الرسمية المعتمدة!', { id: toastId });
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحديث الطلبيات: ' + (err.message || ''), { id: toastId });
    } finally {
      setIsApplyingToOrders(false);
    }
  };

  // Save mappings to Firestore & Store and auto-update orders
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    try {
      const existingMappings = settings?.communeMappings || {};
      const updatedCompanyMappings = {
        ...existingMappings,
        [selectedCompanyId]: { ...mappingsDraft }
      };

      // Also sync into cityCorrections so older components benefit seamlessly
      const existingCorrections = settings?.cityCorrections || {};
      const mergedCorrections = { ...existingCorrections, ...mappingsDraft };

      await updateSettings({
        communeMappings: updatedCompanyMappings,
        cityCorrections: mergedCorrections
      });

      // Update existing orders with the official names
      let orderExtraMsg = '';
      try {
        const orderRes = await applyOfficialCommuneNamesToExistingOrders(selectedCompanyId !== 'default' ? selectedCompanyId : undefined);
        if (orderRes.updatedCount > 0) {
          orderExtraMsg = ` وتم تثبيت الاسم الرسمي في ${orderRes.updatedCount} طلبية بقاعدة البيانات.`;
        }
      } catch (e) {
        console.warn('Auto order update skipped:', e);
      }

      toast.success('تم حفظ جدول مطابقة بلديات الشحن بنجاح في السحابة!' + orderExtraMsg);
    } catch (err: any) {
      console.error('Error saving commune mappings:', err);
      toast.error('حدث خطأ أثناء حفظ المطابقات: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset current draft back to saved state
  const handleResetDraft = () => {
    const existing = settings?.communeMappings?.[selectedCompanyId] || 
                     settings?.communeMappings?.['default'] || 
                     {};
    setMappingsDraft({ ...existing });
    toast('تمت استعادة الإعدادات المحفوظة مسبقاً.');
  };

  // Live tester result
  const testResult = useMemo(() => {
    return resolveEcoTrackCommune(
      testInputCity,
      testWilaya,
      mappingsDraft,
      settings?.cityCorrections || {},
      liveEcoCommunes
    );
  }, [testInputCity, testWilaya, mappingsDraft, settings?.cityCorrections, liveEcoCommunes]);

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* 1. Header & Description Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs px-3 py-1 rounded-full font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>نظام المطابقة الذكي للبلديات الجزائريـة (1,541 بلدية)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-indigo-300" />
              <span>مطابقة بلديات الووردبريس مع شركات الشحن (EcoTrack)</span>
            </h2>
            <p className="text-indigo-100/90 text-sm max-w-3xl mt-1.5 leading-relaxed">
              يقوم هذا القسم بمطابقة أسماء البلديات كما يرسلها الووردبريس (من إضافة <code className="bg-white/15 px-1 py-0.5 rounded font-mono text-xs">DZ.php</code>)
              مع الأسماء الرسمية المعتمدة في منصة EcoTrack لكل شركة شحن. يضمن إرسال الطلبية بدون أخطاء "بلدية غير متوفرة".
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleAutoMatchAll}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs md:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02] cursor-pointer"
              title="تطبيق خوارزمية الذكاء الاصطناعي للمطابقة الصوتية والتلقائية لجميع البلديات"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              <span>مطابقة ذكية شاملة</span>
            </button>

            <button
              onClick={handleApplyToOrders}
              disabled={isApplyingToOrders}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02] cursor-pointer"
              title="تحديث وتثبيت الاسم الرسمي لشركة الشحن في جميع الطلبيات المسجلة حالياً بقاعدة البيانات"
            >
              <Database className="w-4 h-4" />
              <span>{isApplyingToOrders ? 'جاري التحديث...' : 'تثبيت بالطلبيات الحالية'}</span>
            </button>

            <button
              onClick={handleSaveToCloud}
              disabled={isSaving}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ في السحابة'}</span>
            </button>
          </div>
        </div>

        {/* 2. Top Stats Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-700/50">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] text-indigo-200 block font-semibold">إجمالي بلديات الووردبريس</span>
            <span className="text-xl md:text-2xl font-black text-white mt-0.5 block">1,541</span>
            <span className="text-[10px] text-indigo-300">مأخوذة من DZ.php الرسمية</span>
          </div>

          <div className="bg-emerald-500/20 backdrop-blur-xs rounded-xl p-3 border border-emerald-400/30">
            <span className="text-[11px] text-emerald-200 block font-semibold">متطابقة تلقائياً بنجاح</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl md:text-2xl font-black text-emerald-300">
                {stats.exactCount + stats.highCount}
              </span>
              <span className="text-xs text-emerald-200 font-bold">({stats.matchPercent}%)</span>
            </div>
            <span className="text-[10px] text-emerald-200">مطابقة دقيقة بالخوارزمية</span>
          </div>

          <div className="bg-purple-500/20 backdrop-blur-xs rounded-xl p-3 border border-purple-400/30">
            <span className="text-[11px] text-purple-200 block font-semibold">تخصيص يدوي مخصص</span>
            <span className="text-xl md:text-2xl font-black text-purple-300 mt-0.5 block">{stats.manualCount}</span>
            <span className="text-[10px] text-purple-200">تم تعديلها وتثبيتها من قبلك</span>
          </div>

          <div className="bg-amber-500/20 backdrop-blur-xs rounded-xl p-3 border border-amber-400/30">
            <span className="text-[11px] text-amber-200 block font-semibold">تحتاج مراجعة أو غير مطابقة</span>
            <span className="text-xl md:text-2xl font-black text-amber-300 mt-0.5 block">{stats.unmatchedCount}</span>
            <span className="text-[10px] text-amber-200">تسميات استثنائية أو قديمة</span>
          </div>
        </div>
      </div>

      {/* 3. Controls & Configuration Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Select Shipping Company */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>شركة الشحن المعتمدة:</span>
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-indigo-400 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value="default">🌐 افتراضي (لجميع شركات الشحن وطلبيات المتجر)</option>
              {integrations.map(integ => (
                <option key={integ.id} value={integ.name || integ.id}>
                  🚚 {integ.name} ({integ.domain || 'EcoTrack'}) {integ.isActive ? '• متصل' : '• غير نشط'}
                </option>
              ))}
            </select>
          </div>

          {/* Select Wilaya */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>الولاية المراد عرض بلدياتها:</span>
            </label>
            <select
              value={selectedWilaya}
              onChange={(e) => setSelectedWilaya(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 hover:border-indigo-400 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value={0}>🌍 جميع الولايات (1,541 بلدية)</option>
              {Object.entries(ALGERIA_WILAYAS).map(([idStr, val]) => (
                <option key={idStr} value={idStr}>
                  {String(idStr).padStart(2, '0')} - {val.ar} ({val.fr})
                </option>
              ))}
            </select>
          </div>

          {/* Connect Live API Button */}
          <div className="flex flex-col justify-end">
            <button
              onClick={handleFetchLiveFromApi}
              disabled={isFetchingLive || !currentCompany}
              className={`w-full py-2 px-3.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-xs ${
                currentCompany 
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title={currentCompany ? `الاتصال بـ ${currentCompany.domain}/api/v1/get/communes` : 'يرجى ربط شركة شحن في قسم الربط البرمجي لتفعيل الجلب الحي'}
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingLive ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isFetchingLive ? 'جاري الجلب من الـ API...' : 'جلب بلديات شركة الشحن من الـ API'}</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن بلدية (بالعربية أو اللاتينية)..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pr-9 pl-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 left-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-xs font-bold text-slate-500 ml-1">تصفية:</span>
            {[
              { id: 'all', label: `الكل (${stats.total})` },
              { id: 'unmatched', label: `⚠️ متعثرة وتحتاج تحديد يدوي (${stats.unmatchedCount})`, alert: true },
              { id: 'matched', label: `المتطابقة بنجاح (${stats.exactCount + stats.highCount})` },
              { id: 'manual', label: `مخصصة يدوياً (${stats.manualCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? tab.alert
                      ? 'bg-rose-600 text-white shadow-xs font-black ring-2 ring-rose-300'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : tab.alert
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}

            {Object.keys(mappingsDraft).length > 0 && (
              <button
                onClick={handleResetDraft}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer mr-2"
                title="إلغاء التعديلات غير المحفوظة"
              >
                تراجع
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Interactive Live Sandbox Tester */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-blue-950">مختبر فحص ومحاكاة مطابقة البلديات (Live Tester)</h3>
              <p className="text-[11px] text-blue-750">جرّب كتابة أي اسم بلدية كما يصل في طلبية الووردبريس لتتأكد من الاسم النهائي الذي سيُرسل لشركة الشحن</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-white p-3 rounded-xl border border-blue-200">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم البلدية كما يرسلها المتجر (WordPress/Woo):</label>
            <input
              type="text"
              value={testInputCity}
              onChange={(e) => setTestInputCity(e.target.value)}
              placeholder="مثال: Hamma Anassers, Ainmlila, O Ahmed Timmi..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الولاية:</label>
            <select
              value={testWilaya}
              onChange={(e) => setTestWilaya(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
            >
              {Object.entries(ALGERIA_WILAYAS).map(([idStr, val]) => (
                <option key={`test-w-${idStr}`} value={idStr}>
                  {String(idStr).padStart(2, '0')} - {val.ar}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5 flex items-center gap-2 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
            <ArrowRight className="w-4 h-4 text-blue-600 shrink-0 rotate-180" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-blue-600 font-bold block">الاسم المعتمد المرسل لـ EcoTrack:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-black text-sm text-blue-950 truncate">
                  {testResult.finalNom || 'غير محدد'}
                </span>
                {testResult.isResolved ? (
                  <span className="shrink-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>مطابقة معتمدة</span>
                  </span>
                ) : (
                  <span className="shrink-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>تحتاج تخصيص</span>
                  </span>
                )}
                {testResult.hasStopDesk && (
                  <span className="shrink-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded" title="مكتب شحن متوفر">
                    🏢 Stop Desk
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Main Communes Matching Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm text-slate-800">
              جدول مطابقة البلديات ({filteredWpCommunes.length} بلدية معروضة)
            </h3>
            {selectedWilaya > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">
                ولاية: {ALGERIA_WILAYAS[selectedWilaya]?.ar} ({ALGERIA_WILAYAS[selectedWilaya]?.fr})
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            الصفحة {currentPage} من {totalPages}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-bold">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-28">الولاية</th>
                <th className="p-3">اسم البلدية في الووردبريس (DZ.php)</th>
                <th className="p-3 w-36 text-center">حالة المطابقة</th>
                <th className="p-3">البلدية المقابلة في شركة الشحن (EcoTrack)</th>
                <th className="p-3 w-24 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedCommunes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <span>لا توجد بلديات تطابق خيارات البحث الحالية</span>
                  </td>
                </tr>
              ) : (
                paginatedCommunes.map((c, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isManual = Boolean(mappingsDraft[c.wpNom]);
                  const matchRes = findBestEcoTrackMatch(c.wpNom, c.wilaya_id, liveEcoCommunes, mappingsDraft);
                  const matchedName = matchRes.match?.nom || mappingsDraft[c.wpNom] || '';
                  const hasStopDesk = Boolean(matchRes.match?.has_stop_desk);
                  const isUnmatched = !isManual && (!matchedName || matchRes.confidence === 'none');

                  // EcoTrack communes available for this wilaya
                  const wilayaEcoOptions = liveEcoCommunes.filter(
                    e => e.wilaya_id === c.wilaya_id || 
                         (e.wilaya_id >= 49 && e.wilaya_id <= 58)
                  );

                  return (
                    <tr 
                      key={`${c.wilaya_id}-${c.wpNom}`} 
                      className={`transition-colors border-r-4 ${
                        isUnmatched 
                          ? 'bg-rose-50/90 border-r-rose-600 hover:bg-rose-100/90' 
                          : isManual 
                            ? 'bg-purple-50/30 border-r-purple-500 hover:bg-purple-50/60' 
                            : 'hover:bg-slate-50/80 border-r-transparent'
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isUnmatched ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <span className="font-mono text-indigo-700 font-black">{String(c.wilaya_id).padStart(2, '0')}</span>
                          <span>{c.wilayaNameAr}</span>
                        </span>
                      </td>

                      <td className="p-3 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${isUnmatched ? 'text-rose-950 font-black text-sm' : 'text-slate-900'}`}>{c.wpNom}</span>
                          {isUnmatched && (
                            <span className="bg-rose-200 text-rose-900 border border-rose-300 text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-700 shrink-0" />
                              <span>تعثرت المطابقة</span>
                            </span>
                          )}
                          {isManual && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-1.5 py-0.2 rounded">
                              مخصص يدوياً
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        {isManual ? (
                          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                            <Check className="w-3 h-3 text-purple-600" />
                            <span>تثبيت يدوي</span>
                          </span>
                        ) : isUnmatched ? (
                          <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-900 text-[11px] font-black px-2.5 py-1 rounded-full border border-rose-300 shadow-2xs animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>تعثرت (حدد يدوياً)</span>
                          </span>
                        ) : matchRes.confidence === 'exact' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>تطابق تام (100%)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200" title="تمت المطابقة عبر الذكاء الاصطناعي والصوتيات الجزائرية">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>تطابق ذكي</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2 w-full max-w-sm">
                          <select
                            value={matchedName}
                            onChange={(e) => handleSelectMapping(c.wpNom, e.target.value)}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none transition-colors ${
                              isUnmatched 
                                ? 'bg-white border-2 border-rose-500 text-rose-950 font-black shadow-xs focus:ring-2 focus:ring-rose-400'
                                : isManual 
                                  ? 'bg-purple-50 border-purple-300 text-purple-900 focus:border-purple-500' 
                                  : matchedName 
                                    ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500' 
                                    : 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500'
                            }`}
                          >
                            <option value="">{isUnmatched ? '⚠️ اضغط لاختيار البلدية يدوياً من القائمة...' : '-- اختر البلدية المقابلة في EcoTrack --'}</option>
                            {matchedName && !wilayaEcoOptions.some(e => e.nom.toLowerCase() === matchedName.toLowerCase()) && (
                              <option value={matchedName}>{matchedName} (مخصصة)</option>
                            )}
                            {wilayaEcoOptions.map((opt, oIdx) => (
                              <option key={`${opt.nom}-${oIdx}`} value={opt.nom}>
                                {opt.nom} {opt.has_stop_desk ? '🏢 (Stop Desk)' : ''}
                              </option>
                            ))}
                          </select>

                          {hasStopDesk && (
                            <span className="shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-1 rounded" title="مكتب شحن متوفر للتوصيل للمكتب">
                              🏢 مكتب
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        {isManual ? (
                          <button
                            onClick={() => handleSelectMapping(c.wpNom, '')}
                            className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded transition-colors text-[11px] font-bold"
                            title="إلغاء التخصيص اليدوي والعودة للمطابقة التلقائية"
                          >
                            إلغاء
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-mono">تلقائي</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
            <span className="text-xs text-slate-600 font-semibold">
              عرض {(currentPage - 1) * pageSize + 1} إلى {Math.min(currentPage * pageSize, filteredWpCommunes.length)} من أصل {filteredWpCommunes.length} بلدية
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                السابق
              </button>

              <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs rounded-lg">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
