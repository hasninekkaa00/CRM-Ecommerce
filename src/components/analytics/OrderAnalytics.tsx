import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { parseISO, format, isValid, getDay, getHours, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from 'recharts';
import { Calendar, Clock, TrendingUp, Filter, BarChart3, Package, CheckCircle, Truck, MapPin, AlertCircle } from 'lucide-react';
import { formatWilaya } from '../../utils/algeriaWilayas';

export function OrderAnalytics() {
  const { orders } = useStore();
  const [dateFilter, setDateFilter] = useState<string>(() => {
    return localStorage.getItem('analytics_dateFilter') || 'all';
  });

  useEffect(() => {
    localStorage.setItem('analytics_dateFilter', dateFilter);
  }, [dateFilter]);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('all'); // 'all', '0' (Sunday)...'6' (Saturday)

  const { start, end } = useMemo(() => {
    let s = new Date(2000, 0, 1);
    let e = new Date();
    
    if (dateFilter === 'custom') {
      s = customStart ? startOfDay(parseISO(customStart)) : s;
      e = customEnd ? endOfDay(parseISO(customEnd)) : e;
    }
    
    return { start: s, end: e };
  }, [dateFilter, customStart, customEnd]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.orderDate) return false;
      const oDate = parseISO(o.orderDate);
      if (!isValid(oDate)) return false;
      
      if (dateFilter !== 'all') {
         if (!isWithinInterval(oDate, { start, end })) return false;
      }
      
      if (selectedDay !== 'all') {
         if (getDay(oDate).toString() !== selectedDay) return false;
      }
      
      return true;
    });
  }, [orders, start, end, dateFilter, selectedDay]);

  // Daily Chart (Orders by Date)
  const dailyChartData = useMemo(() => {
    const dataMap = new Map<string, number>();
    
    // Only compile date-based chart if not filtering to a specific day of week (or maybe keep it to see occurrences over time)
    filteredOrders.forEach(o => {
       const d = parseISO(o.orderDate);
       const dateStr = format(d, 'yyyy-MM-dd');
       dataMap.set(dateStr, (dataMap.get(dateStr) || 0) + 1);
    });
    
    return Array.from(dataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
         date,
         label: format(parseISO(date), 'dd MMM', { locale: ar }),
         count
      }));
  }, [filteredOrders]);

  // Day of Week Chart
  const daysOfWeek = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayOfWeekData = useMemo(() => {
     const counts = [0, 0, 0, 0, 0, 0, 0];
     orders.filter(o => { // Note: using orders (or date filtered orders) but without the selectedDay filter
        if (!o.orderDate) return false;
        const d = parseISO(o.orderDate);
        if (!isValid(d)) return false;
        if (dateFilter !== 'all' && !isWithinInterval(d, { start, end })) return false;
        return true;
     }).forEach(o => {
        counts[getDay(parseISO(o.orderDate))]++;
     });
     
     return daysOfWeek.map((name, index) => ({
        dayName: name,
        index: index.toString(),
        count: counts[index]
     }));
  }, [orders, start, end, dateFilter]);

  // Hourly Chart
  const hourlyData = useMemo(() => {
     const counts = new Array(24).fill(0);
     filteredOrders.forEach(o => {
        const d = parseISO(o.orderDate);
        counts[getHours(d)]++;
     });
     
     return counts.map((count, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count
     }));
  }, [filteredOrders]);
  
  // State/Wilaya Analysis
  const stateData = useMemo(() => {
    const dataMap = new Map<string, { total: number, confirmed: number, delivered: number, returned: number }>();
    
    filteredOrders.forEach(o => {
      // In this data model, region corresponds to Wilaya/State
      const rawRegion = o.region && o.region.trim() !== '' ? o.region.trim() : 'غير محدد';
      const stateNameStr = rawRegion !== 'غير محدد' ? formatWilaya(rawRegion) : 'غير محدد';
      if (!dataMap.has(stateNameStr)) {
        dataMap.set(stateNameStr, { total: 0, confirmed: 0, delivered: 0, returned: 0 });
      }
      const entry = dataMap.get(stateNameStr)!;
      entry.total++;
      if (o.status1 === 'مؤكد') entry.confirmed++;
      if (o.status2 === 'مستلم') entry.delivered++;
      if (o.status2 === 'مرتجع') entry.returned++;
    });
    
    return Array.from(dataMap.entries())
      .sort((a, b) => b[1].total - a[1].total) // Sort by total descending
      .map(([stateName, metrics]) => ({
         stateName,
         ...metrics,
         confirmedRate: metrics.total > 0 ? Math.round((metrics.confirmed / metrics.total) * 100) : 0,
         deliveryRate: metrics.total > 0 ? Math.round((metrics.delivered / metrics.total) * 100) : 0,
         returnRate: metrics.total > 0 ? Math.round((metrics.returned / metrics.total) * 100) : 0,
      }));
  }, [filteredOrders]);

  // Calculations for highest wilayas and top 10 lists
  const topWilayaOrders = useMemo(() => {
    const validStates = stateData.filter(s => s.stateName !== 'غير محدد');
    if (validStates.length === 0) return null;
    const sorted = [...validStates].sort((a, b) => b.total - a.total);
    const top = sorted[0];
    return top && top.total > 0 ? top : null;
  }, [stateData]);

  const topWilayaDelivered = useMemo(() => {
    const validStates = stateData.filter(s => s.stateName !== 'غير محدد');
    if (validStates.length === 0) return null;
    const sorted = [...validStates].sort((a, b) => b.delivered - a.delivered);
    const top = sorted[0];
    return top && top.delivered > 0 ? top : null;
  }, [stateData]);

  const topWilayaReturned = useMemo(() => {
    const validStates = stateData.filter(s => s.stateName !== 'غير محدد');
    if (validStates.length === 0) return null;
    const sorted = [...validStates].sort((a, b) => b.returned - a.returned);
    const top = sorted[0];
    return top && top.returned > 0 ? top : null;
  }, [stateData]);

  const top10Confirmed = useMemo(() => {
    return [...stateData]
      .filter(s => s.confirmed > 0 && s.stateName !== 'غير محدد')
      .sort((a, b) => b.confirmed - a.confirmed)
      .slice(0, 10);
  }, [stateData]);

  const top10Delivered = useMemo(() => {
    return [...stateData]
      .filter(s => s.delivered > 0 && s.stateName !== 'غير محدد')
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 10);
  }, [stateData]);

  const top10Returned = useMemo(() => {
    return [...stateData]
      .filter(s => s.returned > 0 && s.stateName !== 'غير محدد')
      .sort((a, b) => b.returned - a.returned)
      .slice(0, 10);
  }, [stateData]);

  // Best Day & Hour Metrics
  const bestDayName = useMemo(() => {
     if (dayOfWeekData.length === 0) return '-';
     const best = [...dayOfWeekData].sort((a, b) => b.count - a.count)[0];
     return best && best.count > 0 ? best.dayName : '-';
  }, [dayOfWeekData]);
  
  const bestHour = useMemo(() => {
     if (hourlyData.length === 0) return '-';
     const best = [...hourlyData].sort((a, b) => b.count - a.count)[0];
     return best && best.count > 0 ? best.hour : '-';
  }, [hourlyData]);

  const rates = useMemo(() => {
     let actualStart = start;
     let actualEnd = end;
     
     if (dateFilter === 'all') {
        const dates = filteredOrders.map(o => parseISO(o.orderDate)).filter(isValid);
        if (dates.length > 0) {
           actualStart = new Date(Math.min(...dates.map(d => d.getTime())));
           actualEnd = new Date(Math.max(...dates.map(d => d.getTime())));
        } else {
           actualStart = new Date();
           actualEnd = new Date();
        }
     }
     
     const msPerDay = 1000 * 60 * 60 * 24;
     let daysCount = Math.ceil((endOfDay(actualEnd).getTime() - startOfDay(actualStart).getTime()) / msPerDay);
     if (daysCount < 1) daysCount = 1;
     
     const totalReceived = filteredOrders.length;
     const totalConfirmed = filteredOrders.filter(o => o.status1 === 'مؤكد').length;
     const totalDelivered = filteredOrders.filter(o => o.status2 === 'مستلم').length;
     
     return {
        avgReceived: (totalReceived / daysCount).toFixed(1),
        avgConfirmed: (totalConfirmed / daysCount).toFixed(1),
        avgDelivered: (totalDelivered / daysCount).toFixed(1),
        daysCount,
     };
  }, [filteredOrders, start, end, dateFilter]);

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
              <BarChart3 className="w-6 h-6" />
            </span>
            الإحصائيات المتقدمة للطلبيات
          </h1>
          <p className="text-gray-500 mt-2 font-medium">تحليل أوقات الذروة وأفضل الأيام لاستقبال الطلبات</p>
        </div>
        
        {/* Date Filter */}
        <div className="flex flex-col md:flex-row items-end md:items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          <div className="flex items-center w-full md:w-auto">
             <Filter className="w-4 h-4 text-gray-400 mx-2" />
             <select
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
               className="bg-transparent border-none text-sm font-bold text-gray-700 py-2 pl-2 pr-8 focus:ring-0 cursor-pointer w-full md:w-auto outline-none"
             >
               <option value="all">كل الوقت</option>
               <option value="custom">تاريخ مخصص</option>
             </select>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 px-2 pb-2 md:pb-0 border-t md:border-t-0 md:border-r border-gray-100 pt-2 md:pt-0 w-full md:w-auto">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs outline-none focus:border-indigo-500 w-full"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs outline-none focus:border-indigo-500 w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
             <Calendar className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">أفضل يوم في الأسبوع</div>
             <div className="text-2xl font-black text-gray-900 mt-1">{bestDayName}</div>
           </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
             <Clock className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">أفضل وقت (ساعة الذروة)</div>
             <div className="text-2xl font-black text-gray-900 mt-1" dir="ltr">{bestHour}</div>
           </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
             <TrendingUp className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">عدد الطلبات المتوافقة</div>
             <div className="text-2xl font-black text-gray-900 mt-1">{filteredOrders.length}</div>
           </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
             <Package className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">معدل الطلبيات الواردة يومياً</div>
             <div className="text-2xl font-black text-gray-900 mt-1">{rates.avgReceived} <span className="text-sm text-gray-400 font-normal">/ يوم</span></div>
           </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-violet-50 text-violet-600 rounded-full">
             <CheckCircle className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">معدل الطلبيات المؤكدة يومياً</div>
             <div className="text-2xl font-black text-gray-900 mt-1">{rates.avgConfirmed} <span className="text-sm text-gray-400 font-normal">/ يوم</span></div>
           </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-teal-50 text-teal-600 rounded-full">
             <Truck className="w-6 h-6" />
           </div>
           <div>
             <div className="text-sm text-gray-500 font-medium">معدل الطلبيات المستلمة يومياً</div>
             <div className="text-2xl font-black text-gray-900 mt-1">{rates.avgDelivered} <span className="text-sm text-gray-400 font-normal">/ يوم</span></div>
           </div>
        </div>
      </div>

      {/* Wilaya Records / أرقام قياسية للولايات */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-600" />
          الولايات الأكثر تميزاً ونشاطاً
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Orders */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
              <Package className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-bold">أعلى ولاية في الطلبيات</div>
              {topWilayaOrders ? (
                <div>
                  <div className="text-lg font-black text-gray-900 mt-1">{topWilayaOrders.stateName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    إجمالي: <span className="font-extrabold text-indigo-600">{topWilayaOrders.total}</span> طلبية
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-xs mt-1">لا توجد بيانات</div>
              )}
            </div>
          </div>

          {/* Top Delivered */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <Truck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-bold">أعلى ولاية في الاستلام</div>
              {topWilayaDelivered ? (
                <div>
                  <div className="text-lg font-black text-emerald-700 mt-1">{topWilayaDelivered.stateName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    مستلم: <span className="font-extrabold text-emerald-600">{topWilayaDelivered.delivered}</span> طلبية ({topWilayaDelivered.deliveryRate}%)
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-xs mt-1">لا توجد بيانات</div>
              )}
            </div>
          </div>

          {/* Top Returned */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-bold">أعلى ولاية في الروتور (المرتجع)</div>
              {topWilayaReturned ? (
                <div>
                  <div className="text-xl font-black text-rose-700 mt-1">{topWilayaReturned.stateName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    مرتجع: <span className="font-extrabold text-rose-600">{topWilayaReturned.returned}</span> طلبية ({topWilayaReturned.returnRate}%)
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-xs mt-1">لا توجد بيانات</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day of Week Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800">توزيع الطلبيات حسب أيام الأسبوع</h3>
                <p className="text-xs text-gray-500 mt-1">يساعد في معرفة الأيام النشطة لاستهدافها إعلانياً</p>
             </div>
             <div className="p-4 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="dayName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                     <Tooltip 
                       cursor={{ fill: '#F3F4F6' }}
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                       formatter={(value) => [`${value} طلبية`, 'العدد']}
                     />
                     <Bar 
                        dataKey="count" 
                        radius={[4, 4, 4, 4]} 
                        barSize={30}
                        onClick={(data: any, index: number) => {
                          const val = data?.payload?.index || index.toString();
                          setSelectedDay(val === selectedDay ? 'all' : val);
                        }}
                     >
                       {dayOfWeekData.map((entry, index) => (
                         <Cell 
                           key={`cell-${index}`} 
                           fill={selectedDay === 'all' 
                               ? (entry.count > 0 && entry.count === Math.max(...dayOfWeekData.map(d => d.count)) ? '#4F46E5' : '#94A3B8') 
                               : (selectedDay === index.toString() ? '#4F46E5' : '#E2E8F0')} 
                           cursor="pointer"
                         />
                       ))}
                     </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="p-3 bg-gray-50 text-xs text-indigo-600 font-medium text-center border-t border-gray-100">
               اضغط على العمود لاختيار اليوم وعرض ساعات الذروة الخاصة به
             </div>
          </div>

          {/* Hourly Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">أوقات وساعات الذروة</h3>
                  <p className="text-xs text-gray-500 mt-1">توزيع الطلبات على مدار 24 ساعة {selectedDay !== 'all' ? `(يوم ${daysOfWeek[parseInt(selectedDay)]})` : ''}</p>
                </div>
                {selectedDay !== 'all' && (
                  <button 
                    onClick={() => setSelectedDay('all')}
                    className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors font-bold"
                  >
                    عرض كل الأيام
                  </button>
                )}
             </div>
             <div className="p-4 h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} interval="preserveStartEnd" minTickGap={20} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textAlign: 'right' }}
                       labelFormatter={(label) => `الساعة ${label}`}
                       formatter={(value) => [`${value} طلبية`, 'العدد']}
                     />
                     <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#F59E0B" 
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#F59E0B', strokeWidth: 2, stroke: '#FFF' }}
                        activeDot={{ r: 6, fill: '#F59E0B', stroke: '#FFF', strokeWidth: 2 }}
                     />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
          
          {/* Trend Chart (Orders over Time) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col lg:col-span-2 mt-2">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">حركة الطلبات عبر التاريخ المبين</h3>
                  <p className="text-xs text-gray-500 mt-1">يوضح ارتفاع أو انخفاض الطلبيات في التواريخ المحددة</p>
                </div>
             </div>
             <div className="p-4 h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} minTickGap={30} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                     <Tooltip 
                       cursor={{ fill: '#F3F4F6' }}
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textAlign: 'right' }}
                       formatter={(value) => [`${value} طلبية`, 'العدد']}
                     />
                     <Bar 
                        dataKey="count" 
                         fill="#10B981"
                         radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

          {/* Top 10 Wilayas Segment Analysis */}
          <div className="lg:col-span-2 space-y-4 mt-6">
             <div className="border-b border-gray-200 pb-2">
               <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  أكثر 10 ولايات نشاطاً (تأكيداً، استلاماً، وإرجاعاً)
               </h3>
               <p className="text-xs text-gray-500 mt-1">تساعدك هذه القائمة في معرفة الولايات الأكثر تفاعلاً وجودة للتوصيل والروتور</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Top 10 Confirmed */}
                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                   <div className="p-4 border-b border-gray-100 bg-blue-50/40 flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                     <div>
                       <h4 className="font-bold text-gray-800 text-sm">أكثر 10 ولايات تأكيداً</h4>
                       <p className="text-[10px] text-gray-500">المرتبة حسب عدد الطلبيات المؤكدة ونسبة تأكيدها</p>
                     </div>
                   </div>
                   <div className="p-4 divide-y divide-gray-100 flex-1">
                     {top10Confirmed.map((state, idx) => {
                       const maxConfirmed = Math.max(...top10Confirmed.map(s => s.confirmed), 1);
                       const percentage = Math.round((state.confirmed / maxConfirmed) * 100);
                       return (
                         <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                           <div className="flex items-center gap-2.5 min-w-0 flex-1">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 ${
                               idx === 0 ? 'bg-amber-100 text-amber-800' :
                               idx === 1 ? 'bg-slate-100 text-slate-800' :
                               idx === 2 ? 'bg-orange-100 text-orange-800' :
                               'bg-gray-50 text-gray-500'
                             }`}>
                               {idx + 1}
                             </span>
                             <div className="min-w-0 flex-1">
                               <div className="font-bold text-gray-700 text-xs truncate">{state.stateName}</div>
                               <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                 <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                               </div>
                             </div>
                           </div>
                           <div className="text-left shrink-0 flex flex-col items-end">
                             <span className="text-xs font-black text-blue-600">{state.confirmed} <span className="text-[10px] text-gray-400 font-normal">/ {state.total}</span></span>
                             <span className="text-[10px] text-blue-500 font-bold">{state.confirmedRate}% تأكيد</span>
                           </div>
                         </div>
                       );
                     })}
                     {top10Confirmed.length === 0 && (
                       <div className="py-8 text-center text-gray-400 text-xs">لا توجد بيانات كافية</div>
                     )}
                   </div>
                 </div>

                 {/* Top 10 Delivered */}
                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                   <div className="p-4 border-b border-gray-100 bg-emerald-50/40 flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                     <div>
                       <h4 className="font-bold text-gray-800 text-sm">أكثر 10 ولايات استلاماً</h4>
                       <p className="text-[10px] text-gray-500">المرتبة حسب عدد الطلبيات المستلمة ونسبة استلامها</p>
                     </div>
                   </div>
                   <div className="p-4 divide-y divide-gray-100 flex-1">
                     {top10Delivered.map((state, idx) => {
                       const maxDelivered = Math.max(...top10Delivered.map(s => s.delivered), 1);
                       const percentage = Math.round((state.delivered / maxDelivered) * 100);
                       return (
                         <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                           <div className="flex items-center gap-2.5 min-w-0 flex-1">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 ${
                               idx === 0 ? 'bg-amber-100 text-amber-800' :
                               idx === 1 ? 'bg-slate-100 text-slate-800' :
                               idx === 2 ? 'bg-orange-100 text-orange-800' :
                               'bg-gray-50 text-gray-500'
                             }`}>
                               {idx + 1}
                             </span>
                             <div className="min-w-0 flex-1">
                               <div className="font-bold text-gray-700 text-xs truncate">{state.stateName}</div>
                               <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                 <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                               </div>
                             </div>
                           </div>
                           <div className="text-left shrink-0 flex flex-col items-end">
                             <span className="text-xs font-black text-emerald-600">{state.delivered} <span className="text-[10px] text-gray-400 font-normal">/ {state.total}</span></span>
                             <span className="text-[10px] text-emerald-500 font-bold">{state.deliveryRate}% استلام</span>
                           </div>
                         </div>
                       );
                     })}
                     {top10Delivered.length === 0 && (
                       <div className="py-8 text-center text-gray-400 text-xs">لا توجد بيانات كافية</div>
                     )}
                   </div>
                 </div>

                 {/* Top 10 Returned */}
                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                   <div className="p-4 border-b border-gray-100 bg-rose-50/40 flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                     <div>
                       <h4 className="font-bold text-gray-800 text-sm">أكثر 10 ولايات روتور (مرتجع)</h4>
                       <p className="text-[10px] text-gray-500">المرتبة حسب عدد الطلبيات المرتجعة ونسبة روتورها</p>
                     </div>
                   </div>
                   <div className="p-4 divide-y divide-gray-100 flex-1">
                     {top10Returned.map((state, idx) => {
                       const maxReturned = Math.max(...top10Returned.map(s => s.returned), 1);
                       const percentage = Math.round((state.returned / maxReturned) * 100);
                       return (
                         <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                           <div className="flex items-center gap-2.5 min-w-0 flex-1">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 ${
                               idx === 0 ? 'bg-amber-100 text-amber-800' :
                               idx === 1 ? 'bg-slate-100 text-slate-800' :
                               idx === 2 ? 'bg-orange-100 text-orange-800' :
                               'bg-gray-50 text-gray-500'
                             }`}>
                               {idx + 1}
                             </span>
                             <div className="min-w-0 flex-1">
                               <div className="font-bold text-gray-700 text-xs truncate">{state.stateName}</div>
                               <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                 <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                               </div>
                             </div>
                           </div>
                           <div className="text-left shrink-0 flex flex-col items-end">
                             <span className="text-xs font-black text-rose-600">{state.returned} <span className="text-[10px] text-gray-400 font-normal">/ {state.total}</span></span>
                             <span className="text-[10px] text-rose-500 font-bold">{state.returnRate}% روتور</span>
                           </div>
                         </div>
                       );
                     })}
                     {top10Returned.length === 0 && (
                       <div className="py-8 text-center text-gray-400 text-xs">لا توجد بيانات كافية</div>
                     )}
                   </div>
                 </div>
              </div>
             </div>

          {/* State/Wilaya Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col lg:col-span-2 mt-2">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">إحصائيات الولايات والتوصيل</h3>
                  <p className="text-xs text-gray-500 mt-1">يعرض إجمالي الطلبيات، المؤكد، المستلم والمرتجع لكل ولاية</p>
                </div>
             </div>
             <div className="p-4 h-[400px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stateData} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis 
                       dataKey="stateName" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fill: '#6B7280' }} 
                       angle={-45}
                       textAnchor="end"
                       interval={0}
                     />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                     <Tooltip 
                       cursor={{ fill: '#F3F4F6' }}
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textAlign: 'right' }}
                       formatter={(value, name) => {
                          if (name === 'total') return [`${value} طلبية`, 'الإجمالي'];
                          if (name === 'confirmed') return [`${value} مؤكد`, 'مؤكد'];
                          if (name === 'delivered') return [`${value} مستلم`, 'مستلم'];
                          if (name === 'returned') return [`${value} مرتجع`, 'مرتجع'];
                          return [value, name];
                       }}
                     />
                     <Legend 
                        verticalAlign="top" 
                        height={36}
                        formatter={(value) => {
                           if (value === 'total') return <span className="mr-2 text-xs font-bold text-indigo-600">الإجمالي</span>;
                           if (value === 'confirmed') return <span className="mr-2 text-xs font-bold text-blue-600">مؤكد</span>;
                           if (value === 'delivered') return <span className="mr-2 text-xs font-bold text-emerald-600">مستلم</span>;
                           if (value === 'returned') return <span className="mr-2 text-xs font-bold text-rose-600">مرتجع</span>;
                           return value;
                        }}
                     />
                     <Bar dataKey="total" fill="#818CF8" radius={[4, 4, 0, 0]} barSize={12} />
                     <Bar dataKey="confirmed" fill="#60A5FA" radius={[4, 4, 0, 0]} barSize={12} />
                     <Bar dataKey="delivered" fill="#34D399" radius={[4, 4, 0, 0]} barSize={12} />
                     <Bar dataKey="returned" fill="#FB7185" radius={[4, 4, 0, 0]} barSize={12} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
             
             {/* Data Table for States */}
             <div className="border-t border-gray-100 overflow-x-auto">
               <table className="w-full text-sm text-right">
                 <thead className="bg-gray-50 text-gray-500 font-medium text-xs">
                   <tr>
                     <th className="px-4 py-3">الولاية</th>
                     <th className="px-4 py-3 text-center">الإجمالي</th>
                     <th className="px-4 py-3 text-center text-blue-600">مؤكد</th>
                     <th className="px-4 py-3 text-center text-emerald-600">مستلم</th>
                     <th className="px-4 py-3 text-center text-rose-600">مرتجع</th>
                     <th className="px-4 py-3 text-center">نسبة الاستلام</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {stateData.map((state, idx) => (
                     <tr key={idx} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-3 font-bold text-gray-700">{state.stateName}</td>
                       <td className="px-4 py-3 text-center font-medium bg-indigo-50/30">{state.total}</td>
                       <td className="px-4 py-3 text-center font-bold text-blue-600">{state.confirmed}</td>
                       <td className="px-4 py-3 text-center font-bold text-emerald-600">{state.delivered}</td>
                       <td className="px-4 py-3 text-center font-bold text-rose-600">{state.returned}</td>
                       <td className="px-4 py-3 text-center font-black" dir="ltr">
                         <span className={`px-2 py-1 rounded text-xs ${state.deliveryRate >= 60 ? 'bg-emerald-100 text-emerald-700' : state.deliveryRate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                           {state.deliveryRate}%
                         </span>
                       </td>
                     </tr>
                   ))}
                   {stateData.length === 0 && (
                     <tr>
                       <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                         لا توجد بيانات لهذه التواريخ
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
      </div>
    </div>
  );
}
