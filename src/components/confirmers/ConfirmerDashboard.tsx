import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { AppUser, Order } from '../../types';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Clock, 
  TrendingUp, 
  Filter, 
  Calendar, 
  Search, 
  ArrowUpRight, 
  Award, 
  Wallet,
  Receipt,
  Eye,
  RefreshCw,
  Percent,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface ConfirmerDashboardProps {
  onOpenInvoiceModal: (confirmer: AppUser) => void;
  onViewBreakdown: (confirmer: AppUser) => void;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];

export const ConfirmerDashboard: React.FC<ConfirmerDashboardProps> = ({
  onOpenInvoiceModal,
  onViewBreakdown
}) => {
  const { orders, users, salesChannels } = useStore();

  // Filters
  const [dateRangeType, setDateRangeType] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedConfirmerId, setSelectedConfirmerId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedWilaya, setSelectedWilaya] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const confirmers = useMemo(() => {
    return users.filter(u => u.role === 'confirmer' || u.isActive);
  }, [users]);

  // Unique products & wilayas for filter dropdowns
  const productOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.productName) set.add(o.productName);
      else if (o.sku) set.add(o.sku);
    });
    return Array.from(set).sort();
  }, [orders]);

  const wilayaOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.region) set.add(o.region);
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered orders calculation
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return orders.filter(o => {
      // Date Filter
      if (o.orderDate) {
        const orderDateObj = new Date(o.orderDate);
        const orderDateStr = o.orderDate.split('T')[0];

        if (dateRangeType === 'today') {
          if (orderDateStr !== todayStr) return false;
        } else if (dateRangeType === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const yestStr = yesterday.toISOString().split('T')[0];
          if (orderDateStr !== yestStr) return false;
        } else if (dateRangeType === '7days') {
          const diffDays = (now.getTime() - orderDateObj.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (dateRangeType === '30days') {
          const diffDays = (now.getTime() - orderDateObj.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30 || diffDays < 0) return false;
        } else if (dateRangeType === 'this_month') {
          if (orderDateObj.getMonth() !== now.getMonth() || orderDateObj.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (dateRangeType === 'custom') {
          if (customStartDate && orderDateStr < customStartDate) return false;
          if (customEndDate && orderDateStr > customEndDate) return false;
        }
      }

      // Confirmer Filter
      if (selectedConfirmerId !== 'all') {
        const matchedConfirmer = confirmers.find(c => c.id === selectedConfirmerId);
        const matchesId = o.assignedTo === selectedConfirmerId;
        const matchesName = matchedConfirmer && (o.confirmedBy === matchedConfirmer.displayName || o.assignedToName === matchedConfirmer.displayName);
        if (!matchesId && !matchesName) return false;
      }

      // Product Filter
      if (selectedProduct !== 'all') {
        if (o.productName !== selectedProduct && o.sku !== selectedProduct) return false;
      }

      // Wilaya Filter
      if (selectedWilaya !== 'all') {
        if (o.region !== selectedWilaya) return false;
      }

      // Channel Filter
      if (selectedChannel !== 'all') {
        if (o.sourceChannel !== selectedChannel) return false;
      }

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = o.fullName?.toLowerCase().includes(q);
        const matchPhone = o.phone?.includes(q);
        const matchOrderId = o.orderId?.toLowerCase().includes(q);
        const matchConfirmer = o.assignedToName?.toLowerCase().includes(q) || o.confirmedBy?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchOrderId && !matchConfirmer) return false;
      }

      return true;
    });
  }, [orders, dateRangeType, customStartDate, customEndDate, selectedConfirmerId, selectedProduct, selectedWilaya, selectedChannel, searchQuery, confirmers]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    const total = filteredOrders.length;
    let confirmed = 0;
    let canceled = 0;
    let pending = 0;
    let delivered = 0;
    let returned = 0;
    let inTransit = 0;

    filteredOrders.forEach(o => {
      const s1 = o.status1 || '';
      const s2 = o.status2 || '';

      if (s1 === 'مؤكد' || s1.includes('مؤكد')) {
        confirmed++;
      } else if (s1 === 'ملغى' || s1.includes('ملغى') || s1 === 'لا يرد' || s1 === 'مرفوض') {
        canceled++;
      } else {
        pending++;
      }

      if (s2 === 'مستلم' || s2.includes('مستلم') || s2.includes('تم التوصيل')) {
        delivered++;
      } else if (s2 === 'مرتجع' || s2.includes('مرتجع')) {
        returned++;
      } else if (s2 === 'تم الشحن' || s2.includes('شحن') || s2.includes('طريق')) {
        inTransit++;
      }
    });

    const confirmationRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    const deliveryRate = confirmed > 0 ? Math.round((delivered / confirmed) * 100) : 0;
    const returnRate = confirmed > 0 ? Math.round((returned / confirmed) * 100) : 0;

    return {
      total,
      confirmed,
      canceled,
      pending,
      delivered,
      returned,
      inTransit,
      confirmationRate,
      deliveryRate,
      returnRate
    };
  }, [filteredOrders]);

  // Per-confirmer breakdown and ranking
  const confirmerStats = useMemo(() => {
    return confirmers.map(confirmer => {
      const userOrders = filteredOrders.filter(o => 
        o.assignedTo === confirmer.id || 
        o.confirmedBy === confirmer.displayName || 
        o.assignedToName === confirmer.displayName
      );

      const assignedCount = userOrders.length;
      let confirmedCount = 0;
      let canceledCount = 0;
      let pendingCount = 0;
      let deliveredCount = 0;
      let returnedCount = 0;

      userOrders.forEach(o => {
        const s1 = o.status1 || '';
        const s2 = o.status2 || '';

        if (s1 === 'مؤكد' || s1.includes('مؤكد')) {
          confirmedCount++;
        } else if (s1 === 'ملغى' || s1.includes('ملغى') || s1 === 'لا يرد' || s1 === 'مرفوض') {
          canceledCount++;
        } else {
          pendingCount++;
        }

        if (s2 === 'مستلم' || s2.includes('مستلم') || s2.includes('تم التوصيل')) {
          deliveredCount++;
        } else if (s2 === 'مرتجع' || s2.includes('مرتجع')) {
          returnedCount++;
        }
      });

      const confirmationRate = assignedCount > 0 ? Math.round((confirmedCount / assignedCount) * 100) : 0;
      const deliveryRate = confirmedCount > 0 ? Math.round((deliveredCount / confirmedCount) * 100) : 0;

      // Commission estimation
      const config = confirmer.commissionConfig;
      let estimatedEarnings = 0;
      if (config) {
        if (config.type === 'per_assigned') {
          estimatedEarnings = assignedCount * (config.ratePerAssigned || 0);
        } else if (config.type === 'per_confirmed') {
          estimatedEarnings = confirmedCount * (config.ratePerConfirmed || 0);
        } else if (config.type === 'per_delivered') {
          estimatedEarnings = deliveredCount * (config.ratePerDelivered || 0);
        } else if (config.type === 'hybrid') {
          estimatedEarnings = (assignedCount * (config.ratePerAssigned || 0)) +
                              (confirmedCount * (config.ratePerConfirmed || 0)) +
                              (deliveredCount * (config.ratePerDelivered || 0));
        } else if (config.type === 'fixed_monthly') {
          estimatedEarnings = config.fixedMonthlySalary || 0;
        }
      }

      return {
        confirmer,
        assignedCount,
        confirmedCount,
        canceledCount,
        pendingCount,
        deliveredCount,
        returnedCount,
        confirmationRate,
        deliveryRate,
        estimatedEarnings
      };
    }).sort((a, b) => b.confirmedCount - a.confirmedCount || b.assignedCount - a.assignedCount);
  }, [confirmers, filteredOrders]);

  // Chart data for comparing confirmers
  const chartData = useMemo(() => {
    return confirmerStats.slice(0, 8).map(stat => ({
      name: stat.confirmer.displayName.split(' ')[0],
      'المؤكدة': stat.confirmedCount,
      'الملغاة': stat.canceledCount,
      'المستلمة': stat.deliveredCount,
      'قيد الانتظار': stat.pendingCount,
    }));
  }, [confirmerStats]);

  // Cancellation reasons chart data
  const cancelReasonsData = useMemo(() => {
    const reasonsMap: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const s1 = o.status1 || '';
      if (s1.includes('ملغى') || s1 === 'لا يرد' || s1 === 'مرفوض') {
        const reason = o.notes && o.notes.length > 2 && o.notes.length < 25 ? o.notes : (s1 || 'إلغاء عام');
        reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
      }
    });

    return Object.entries(reasonsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders]);

  return (
    <div id="confirmer-dashboard-section" className="space-y-6">
      {/* Advanced Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">فلاتر البحث والمتابعة المتقدمة</h3>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setDateRangeType('today')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === 'today' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateRangeType('yesterday')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === 'yesterday' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              أمس
            </button>
            <button
              onClick={() => setDateRangeType('7days')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === '7days' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => setDateRangeType('this_month')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === 'this_month' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setDateRangeType('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setDateRangeType('custom')}
              className={`px-2.5 py-1 rounded-md transition-all ${dateRangeType === 'custom' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              مخصص
            </button>
          </div>
        </div>

        {/* Custom date range picker if selected */}
        {dateRangeType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm">
            <span className="text-xs font-bold text-indigo-900">نطاق تاريخ مخصص:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">من:</label>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">إلى:</label>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          {/* Confirmer */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">المؤكد</label>
            <select
              value={selectedConfirmerId}
              onChange={(e) => setSelectedConfirmerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">جميع المؤكدين</option>
              {confirmers.map(c => (
                <option key={c.id} value={c.id}>{c.displayName} ({c.role === 'admin' ? 'مدير' : 'مؤكد'})</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">المنتج</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">جميع المنتجات</option>
              {productOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Wilaya */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">الولاية</label>
            <select
              value={selectedWilaya}
              onChange={(e) => setSelectedWilaya(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">جميع الولايات</option>
              {wilayaOptions.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">قناة البيع / المتجر</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">جميع القنوات</option>
              {salesChannels.map(ch => (
                <option key={ch.id} value={ch.name}>{ch.name}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">بحث سريع</label>
            <div className="relative">
              <input
                type="text"
                placeholder="رقم طلبية، اسم، هاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Assigned */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">إجمالي المسند</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-800">{kpis.total}</div>
          <div className="text-xs text-slate-400 mt-1">طلبية في النطاق</div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold">المؤكدة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700">{kpis.confirmed}</div>
          <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <Percent className="w-3 h-3" />
            <span>نسبة التأكيد: {kpis.confirmationRate}%</span>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold">قيد المعالجة</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-700">{kpis.pending}</div>
          <div className="text-xs text-amber-600 mt-1 font-medium">في انتظار التأكيد</div>
        </div>

        {/* Canceled Orders */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold">الملغاة / لا يرد</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-700">{kpis.canceled}</div>
          <div className="text-xs text-rose-500 mt-1 font-medium">
            {kpis.total > 0 ? Math.round((kpis.canceled / kpis.total) * 100) : 0}% من الإجمالي
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold">المستلمة (Livré)</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-700">{kpis.delivered}</div>
          <div className="text-xs font-semibold text-blue-600 mt-1 flex items-center gap-1">
            <span>نسبة التسليم: {kpis.deliveryRate}%</span>
          </div>
        </div>

        {/* Returned Orders */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">المرتجعة (Retour)</span>
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-700">{kpis.returned}</div>
          <div className="text-xs text-slate-400 mt-1">
            نسبة الإرجاع: {kpis.returnRate}%
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Performance Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">مقارنة أداء المؤكدين (المؤكدة / الملغاة / المستلمة)</h3>
              <p className="text-xs text-slate-400 mt-0.5">مقارنة حجم الطلبيات المعالجة لكل عضو في الفريق</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>

          <div className="h-64 sm:h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', border: 'none' }}
                  />
                  <Legend />
                  <Bar dataKey="المؤكدة" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المستلمة" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الملغاة" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="قيد الانتظار" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                لا توجد بيانات كافية للرسم البياني في النطاق المحدد
              </div>
            )}
          </div>
        </div>

        {/* Cancellation Breakdown Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">أبرز أسباب الإلغاء</h3>
              <p className="text-xs text-slate-400 mt-0.5">تحليل أسباب رفض الطلبات وعدم الرد</p>
            </div>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {cancelReasonsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cancelReasonsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {cancelReasonsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-sm text-center">
                لا توجد طلبات ملغاة مسجلة في هذا النطاق
              </div>
            )}
          </div>

          {cancelReasonsData.length > 0 && (
            <div className="space-y-1.5 mt-2 text-xs">
              {cancelReasonsData.map((reason, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate max-w-[140px]">{reason.name}</span>
                  </div>
                  <span className="font-bold">{reason.value} طلبية</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmer Leaderboard & Detail Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-800">جدول ترتيب وأداء فريق التأكيد</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة دقيقة لمؤشرات كل مؤكد، نسب النجاح، والأرباح المقدرة
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
            {confirmerStats.length} عضو
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">المؤكد</th>
                <th className="py-3 px-3 text-center">المسندة</th>
                <th className="py-3 px-3 text-center">المؤكدة</th>
                <th className="py-3 px-3 text-center">نسبة التأكيد</th>
                <th className="py-3 px-3 text-center">الملغاة</th>
                <th className="py-3 px-3 text-center">المستلمة</th>
                <th className="py-3 px-3 text-center">نسبة التسليم</th>
                <th className="py-3 px-3 text-center">المرتجعة</th>
                <th className="py-3 px-4 text-center">المستحق المقدر</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {confirmerStats.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    لا يوجد مؤكدون مسجلون في النظام
                  </td>
                </tr>
              ) : (
                confirmerStats.map((stat, idx) => (
                  <tr key={stat.confirmer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx === 0 ? <span className="inline-block p-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black">🥇 1</span> :
                       idx === 1 ? <span className="inline-block p-1 bg-slate-200 text-slate-700 rounded-full text-xs font-black">🥈 2</span> :
                       idx === 2 ? <span className="inline-block p-1 bg-amber-50 text-amber-800 rounded-full text-xs font-black">🥉 3</span> : idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {stat.confirmer.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{stat.confirmer.displayName}</div>
                          <div className="text-xs text-slate-400 font-normal">{stat.confirmer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {stat.assignedCount}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600">
                      {stat.confirmedCount}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        stat.confirmationRate >= 70 ? 'bg-emerald-100 text-emerald-800' :
                        stat.confirmationRate >= 50 ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {stat.confirmationRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-rose-600">
                      {stat.canceledCount}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-600">
                      {stat.deliveredCount}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        stat.deliveryRate >= 70 ? 'bg-blue-100 text-blue-800' :
                        stat.deliveryRate >= 50 ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {stat.deliveryRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-500">
                      {stat.returnedCount}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-700">
                      {stat.estimatedEarnings.toLocaleString()} دج
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewBreakdown(stat.confirmer)}
                          title="عرض كشف الطلبيات المفصل"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenInvoiceModal(stat.confirmer)}
                          title="تحرير فاتورة مستحقات"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all font-semibold"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
