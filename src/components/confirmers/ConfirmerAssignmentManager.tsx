import React, { useState } from 'react';
import { useStore } from '../../store';
import { AppUser, AutoAssignmentStrategy, AssignmentSettings } from '../../types';
import { 
  Zap, 
  Settings, 
  RotateCcw, 
  ShoppingBag, 
  MapPin, 
  Store, 
  Scale, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Save, 
  HelpCircle,
  Users
} from 'lucide-react';

export const ConfirmerAssignmentManager: React.FC = () => {
  const { users, orders, settings, setSettings, updateUser, autoAssignPendingOrders } = useStore();

  const confirmers = users.filter(u => u.role === 'confirmer' || u.isActive);
  const unassignedOrders = orders.filter(o => !o.assignedTo && (!o.status1 || o.status1 === 'جديد' || o.status1 === 'قيد المراجعة'));

  const currentSettings: AssignmentSettings = settings?.assignmentSettings || {
    enabled: true,
    defaultStrategy: 'round_robin',
    autoAssignOnImport: false,
    allowSelfClaim: true,
    rules: [],
    defaultCommission: {
      type: 'per_confirmed',
      ratePerAssigned: 10,
      ratePerConfirmed: 50,
      ratePerDelivered: 100
    }
  };

  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedStrategyForRun, setSelectedStrategyForRun] = useState<AutoAssignmentStrategy>(currentSettings.defaultStrategy);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ count: number; summary: Record<string, number> } | null>(null);
  const [editingConfirmer, setEditingConfirmer] = useState<AppUser | null>(null);

  // Helper to save settings
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const updatedSettings = {
        ...(settings || {
          status1Options: [],
          status2Options: [],
          deliveryCompanies: [],
          confirmers: []
        }),
        assignmentSettings: assignmentConfig
      };
      await setSettings(updatedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate dispatch run
  const handleExecuteDispatch = async () => {
    try {
      setIsExecuting(true);
      setExecutionResult(null);
      const res = await autoAssignPendingOrders(undefined, selectedStrategyForRun);
      setExecutionResult({ count: res.assignedCount, summary: res.summary });
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء توزيع الطلبيات');
    } finally {
      setIsExecuting(false);
    }
  };

  // Update specific user assignment criteria
  const handleSaveConfirmerCriteria = async (user: AppUser) => {
    try {
      await updateUser(user.id, {
        assignedProducts: user.assignedProducts,
        assignedWilayas: user.assignedWilayas,
        assignedChannels: user.assignedChannels,
        assignmentWeight: user.assignmentWeight
      });
      setEditingConfirmer(null);
      alert('تم تحديث معايير المؤكد بنجاح');
    } catch (e) {
      console.error(e);
      alert('فشل تحديث بيانات المؤكد');
    }
  };

  return (
    <div id="confirmer-assignment-manager" className="space-y-6">
      {/* Top Banner & Quick Dispatch Card */}
      <div className="bg-gradient-to-l from-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <Zap className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold">محرك الإسناد والتوزيع الذكي للطلبيات</h2>
            </div>
            <p className="text-slate-300 text-sm max-w-2xl">
              يمكنك توزيع الطلبيات تلقائياً على أعضاء فريق التأكيد بعدة استراتيجيات (التناوب المتساوي، التخصص بالمنتج، المناطق والولايات، قنوات البيع، أو موازنة عبء العمل).
            </p>
          </div>

          {/* Quick Dispatch Control Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl w-full lg:w-auto min-w-[320px] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-200">الطلبيات الجديدة المعلقة:</span>
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                {unassignedOrders.length} طلبية
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">استراتيجية التوزيع للتنفيذ الفوري:</label>
              <select
                value={selectedStrategyForRun}
                onChange={(e) => setSelectedStrategyForRun(e.target.value as AutoAssignmentStrategy)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-indigo-400"
              >
                <option value="round_robin">🔄 التناوب بالتساوي (Round Robin)</option>
                <option value="by_product">📦 حسب تخصص المنتج (By Product/SKU)</option>
                <option value="by_wilaya">📍 حسب الولايات والمناطق (By Wilaya)</option>
                <option value="by_channel">🏪 حسب قنوات البيع والمتاجر (By Channel)</option>
                <option value="ratio">⚖️ حسب الأوزان والنسب (Weighted Ratio)</option>
                <option value="least_busy">⚡ الأقل عبئاً والأسرع (Least Busy)</option>
              </select>
            </div>

            <button
              onClick={handleExecuteDispatch}
              disabled={isExecuting || unassignedOrders.length === 0}
              className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {isExecuting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>تشغيل التوزيع الآن ({unassignedOrders.length} طلبية)</span>
            </button>
          </div>
        </div>

        {/* Execution Summary Alert */}
        {executionResult && (
          <div className="mt-4 p-3.5 bg-emerald-500/20 border border-emerald-400/40 rounded-lg text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">تم توزيع {executionResult.count} طلبية بنجاح: </span>
              <span>
                {Object.entries(executionResult.summary).map(([name, count]) => `${name} (${count})`).join(' ، ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Assignment Strategies & Rules */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strategy Selection Cards */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">طريقة الإسناد الافتراضية</h3>
              </div>
              <span className="text-xs text-slate-400">حدد الاستراتيجية الرئيسية للنظام</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Strategy 1: Round Robin */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'round_robin' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'round_robin'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <RotateCcw className="w-4 h-4 text-indigo-600" />
                    <span>التناوب بالتساوي (Round Robin)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'round_robin'} 
                    onChange={() => {}} 
                    className="text-indigo-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  توزيع الطلبيات الواردة دورياً على المؤكدين النشطين بالتساوي طلباً بطلب (المؤكد 1 ثم 2 ثم 3 ثم 1...).
                </p>
              </div>

              {/* Strategy 2: By Product */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'by_product' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'by_product'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>حسب تخصص المنتج (By Product)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'by_product'} 
                    onChange={() => {}} 
                    className="text-emerald-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  إسناد طلبات كل منتج أو SKU للمؤكد المتخصص فيه تلقائياً، مع التناوب في حالة عدم وجود تطابق.
                </p>
              </div>

              {/* Strategy 3: By Wilaya */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'by_wilaya' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'by_wilaya'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>حسب الولايات والمناطق (By Wilaya)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'by_wilaya'} 
                    onChange={() => {}} 
                    className="text-blue-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  إسناد طلبيات ولايات محددة (مثل الشرق، الغرب، الجنوب) للمؤكد المعين لتلك المنطقة.
                </p>
              </div>

              {/* Strategy 4: By Channel */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'by_channel' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'by_channel'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Store className="w-4 h-4 text-purple-600" />
                    <span>حسب المتجر / قناة البيع (By Channel)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'by_channel'} 
                    onChange={() => {}} 
                    className="text-purple-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  توجيه طلبيات المتاجر أو الحملات الإعلانية لمؤكدين محددين حسب قناة الطلب.
                </p>
              </div>

              {/* Strategy 5: Weighted Ratio */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'ratio' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'ratio'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Scale className="w-4 h-4 text-amber-600" />
                    <span>حسب النسب والأوزان (Weighted Ratio)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'ratio'} 
                    onChange={() => {}} 
                    className="text-amber-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  توزيع بنسب متفاوتة (مثلاً مؤكد متفرغ يأخذ حصة 3 أضعاف مؤكد يعمل بنصف دوام).
                </p>
              </div>

              {/* Strategy 6: Least Busy */}
              <div 
                onClick={() => setAssignmentConfig(prev => ({ ...prev, defaultStrategy: 'least_busy' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  assignmentConfig.defaultStrategy === 'least_busy'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Zap className="w-4 h-4 text-rose-600" />
                    <span>موازنة العبء والأقل ضغطاً (Least Busy)</span>
                  </div>
                  <input 
                    type="radio" 
                    checked={assignmentConfig.defaultStrategy === 'least_busy'} 
                    onChange={() => {}} 
                    className="text-rose-600"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  إسناد الطلبية الجديدة فوراً للمؤكد الذي لديه أقل عدد من الطلبيات المعلقة حالياً لتسريع الاتصال.
                </p>
              </div>
            </div>
          </div>

          {/* Confirmer Assignment Profiles & Weights */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">تخصيص معايير وأوزان كل مؤكد</h3>
              </div>
              <span className="text-xs text-slate-400">تحديد المنتجات، الولايات، والوزن النسبي</span>
            </div>

            <div className="divide-y divide-slate-100">
              {confirmers.map(confirmer => {
                const isEditing = editingConfirmer?.id === confirmer.id;
                const activeUserObj = isEditing ? editingConfirmer : confirmer;

                return (
                  <div key={confirmer.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {confirmer.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span>{confirmer.displayName}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              الوزن: {confirmer.assignmentWeight || 1}x
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap gap-2 mt-0.5">
                            {confirmer.assignedProducts && confirmer.assignedProducts.length > 0 ? (
                              <span className="text-emerald-600 font-medium">
                                📦 {confirmer.assignedProducts.join(', ')}
                              </span>
                            ) : (
                              <span>📦 كل المنتجات</span>
                            )}
                            {confirmer.assignedWilayas && confirmer.assignedWilayas.length > 0 ? (
                              <span className="text-blue-600 font-medium">
                                📍 {confirmer.assignedWilayas.length} ولاية
                              </span>
                            ) : (
                              <span>📍 كل الولايات</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingConfirmer(isEditing ? null : { ...confirmer })}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all self-end sm:self-auto"
                      >
                        {isEditing ? 'إغلاق التعديل' : 'تعديل المعايير'}
                      </button>
                    </div>

                    {/* Inline criteria editor form */}
                    {isEditing && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Weight */}
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">الوزن النسبي للتوزيع (1 - 10)</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={activeUserObj.assignmentWeight || 1}
                              onChange={(e) => setEditingConfirmer(prev => prev ? ({ ...prev, assignmentWeight: Number(e.target.value) }) : null)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">كلما زاد الرقم زادت حصته من الطلبات</p>
                          </div>

                          {/* Assigned Products (Comma separated) */}
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">المنتجات المسندة (SKU أو اسم)</label>
                            <input
                              type="text"
                              placeholder="مثلاً: ساعة، عطر، SKU123"
                              value={(activeUserObj.assignedProducts || []).join(', ')}
                              onChange={(e) => {
                                const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                setEditingConfirmer(prev => prev ? ({ ...prev, assignedProducts: val }) : null);
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">افصل بينها بفواصل</p>
                          </div>

                          {/* Assigned Wilayas (Comma separated) */}
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">الولايات المسندة</label>
                            <input
                              type="text"
                              placeholder="مثلاً: الجزائر، وهران، سطيف"
                              value={(activeUserObj.assignedWilayas || []).join(', ')}
                              onChange={(e) => {
                                const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                setEditingConfirmer(prev => prev ? ({ ...prev, assignedWilayas: val }) : null);
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">اتركها فارغة لجميع الولايات</p>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => handleSaveConfirmerCriteria(activeUserObj)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition-all"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>حفظ التعديلات</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: System Toggles & Save Button */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-800">إعدادات الأتمتة والسلوك</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Enable Auto-Assignment Toggle */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">تفعيل نظام الإسناد التلقائي</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">تشغيل محرك التوزيع وتعيين المسؤولين</div>
                </div>
                <input
                  type="checkbox"
                  checked={assignmentConfig.enabled}
                  onChange={(e) => setAssignmentConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                />
              </div>

              {/* Auto Assign on Import */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">إسناد فوري عند استيراد الطلبيات</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">توزيع الطلبيات الجديدة مباشرة لحظة دخولها النظام</div>
                </div>
                <input
                  type="checkbox"
                  checked={assignmentConfig.autoAssignOnImport}
                  onChange={(e) => setAssignmentConfig(prev => ({ ...prev, autoAssignOnImport: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                />
              </div>

              {/* Allow Self-Claim */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">السماح للمؤكد بسحب طلبية ذاتياً</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">تمكين المؤكد من النقر على "سحب طلبية جديدة" من الحوض</div>
                </div>
                <input
                  type="checkbox"
                  checked={assignmentConfig.allowSelfClaim}
                  onChange={(e) => setAssignmentConfig(prev => ({ ...prev, allowSelfClaim: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ إعدادات الإسناد</span>
              </button>

              {saveSuccess && (
                <div className="mt-2 text-center text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم حفظ الإعدادات بنجاح</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
