import React, { useState, useMemo } from 'react';
import { X, Search, FileSpreadsheet, Printer, AlertTriangle, CheckCircle2, Package, ArrowUpRight, ArrowDownRight, Layers, RefreshCw, Calculator, Filter } from 'lucide-react';
import { useStore } from '../../store';
import { calculateDynamicStock, calculateReturnedStock } from '../../utils/inventoryCalc';
import toast from 'react-hot-toast';

interface InventoryAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InventoryAuditModal: React.FC<InventoryAuditModalProps> = ({ isOpen, onClose }) => {
  const { inventoryProducts, purchaseInvoices, orders, bulkUpsertInventory, settings } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'discrepancy' | 'deficit' | 'matched'>('all');
  const [isFixing, setIsFixing] = useState(false);

  const isLocalMode = settings?.inventoryManagementMode === 'local';

  // Build complete list of items (flatten parent products & variations)
  const auditItems = useMemo(() => {
    const list: any[] = [];

    (inventoryProducts || []).forEach((product: any) => {
      const parentName = product.name || 'منتج بدون اسم';
      const parentSku = product.sku || '';
      const hasVariations = product.variations && product.variations.length > 0;
      const isOffer = product.local_is_offers || false;

      // Handle variations if available
      if (hasVariations && !isOffer) {
        product.variations.forEach((v: any) => {
          const varOpt = v.name || v.attributes?.map((a: any) => a.option).join(' ') || 'نوع غير محدد';
          const sku = v.sku || parentSku || `VAR-${v.id}`;
          const initialQty = Number(isLocalMode ? (v.local_stock_quantity ?? v.stock_quantity ?? 0) : (v.stock_quantity ?? v.quantity ?? 0));
          
          // Compute dynamic stock & component breakdown
          const calculatedStock = calculateDynamicStock(v, false, product, purchaseInvoices, orders);
          const retData = calculateReturnedStock(v, false, product, orders);

          // Calculate purchased quantity specifically for this variation
          let purchasedQty = 0;
          if (purchaseInvoices) {
            purchaseInvoices.forEach((inv: any) => {
              inv.items?.forEach((item: any) => {
                const iSku = (item.sku || '').trim().toLowerCase();
                const iName = (item.productName || '').trim().toLowerCase();
                const targetSku = (sku || '').trim().toLowerCase();
                const combName = `${parentName} - ${varOpt}`.trim().toLowerCase();

                let isMatch = false;
                if (targetSku && iSku && iSku === targetSku) isMatch = true;
                else if (iName && combName && (iName === combName || iName.includes(combName))) isMatch = true;
                else if (iName && parentName && varOpt && iName.includes(parentName.toLowerCase()) && iName.includes(varOpt.toLowerCase())) isMatch = true;

                if (isMatch) purchasedQty += Number(item.quantity || 0);
              });
            });
          }

          // Shipped / deducted quantity
          const shippedQty = (initialQty + purchasedQty + retData.restockedQty) - calculatedStock;
          const variance = calculatedStock - initialQty;

          list.push({
            id: `${product.id}_var_${v.id}`,
            parentId: product.id,
            product,
            variation: v,
            isVariation: true,
            fullName: `${parentName} (${varOpt})`,
            parentName,
            variationOption: varOpt,
            sku,
            initialQty,
            purchasedQty,
            shippedQty: Math.max(0, shippedQty),
            returnedQty: retData.pendingQty + retData.restockedQty,
            calculatedStock,
            variance,
            hasDiscrepancy: Math.abs(variance) > 0,
            hasDeficit: calculatedStock < 0,
            image: v.image?.src || product.images?.[0]?.src || ''
          });
        });
      }

      // Handle simple product or offers
      if (!hasVariations || isOffer || isLocalMode) {
        if (!hasVariations || isOffer) {
          const sku = parentSku || `PROD-${product.id}`;
          const initialQty = Number(isLocalMode ? (product.local_stock_quantity ?? product.stock_quantity ?? 0) : (product.stock_quantity ?? product.quantity ?? 0));
          
          const calculatedStock = calculateDynamicStock(product, true, product, purchaseInvoices, orders);
          const retData = calculateReturnedStock(product, true, product, orders);

          let purchasedQty = 0;
          if (purchaseInvoices) {
            purchaseInvoices.forEach((inv: any) => {
              inv.items?.forEach((item: any) => {
                const iSku = (item.sku || '').trim().toLowerCase();
                const iName = (item.productName || '').trim().toLowerCase();
                const targetSku = (sku || '').trim().toLowerCase();
                const pNameLower = parentName.trim().toLowerCase();

                let isMatch = false;
                if (targetSku && iSku && iSku === targetSku) isMatch = true;
                else if (iName && pNameLower && (iName === pNameLower || iName.includes(pNameLower))) isMatch = true;

                if (isMatch) purchasedQty += Number(item.quantity || 0);
              });
            });
          }

          const shippedQty = (initialQty + purchasedQty + retData.restockedQty) - calculatedStock;
          const variance = calculatedStock - initialQty;

          list.push({
            id: product.id,
            parentId: product.id,
            product,
            variation: null,
            isVariation: false,
            fullName: parentName,
            parentName,
            variationOption: '',
            sku,
            initialQty,
            purchasedQty,
            shippedQty: Math.max(0, shippedQty),
            returnedQty: retData.pendingQty + retData.restockedQty,
            calculatedStock,
            variance,
            hasDiscrepancy: Math.abs(variance) > 0,
            hasDeficit: calculatedStock < 0,
            image: product.images?.[0]?.src || ''
          });
        }
      }
    });

    return list;
  }, [inventoryProducts, purchaseInvoices, orders, isLocalMode]);

  // Filter audit items
  const filteredItems = useMemo(() => {
    return auditItems.filter(item => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch = !query || 
        item.fullName.toLowerCase().includes(query) || 
        item.sku.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (filterType === 'discrepancy') return item.hasDiscrepancy;
      if (filterType === 'deficit') return item.hasDeficit;
      if (filterType === 'matched') return !item.hasDiscrepancy && !item.hasDeficit;

      return true;
    });
  }, [auditItems, searchTerm, filterType]);

  // KPIs
  const kpis = useMemo(() => {
    const totalItems = auditItems.length;
    const totalPurchased = auditItems.reduce((acc, curr) => acc + curr.purchasedQty, 0);
    const totalShipped = auditItems.reduce((acc, curr) => acc + curr.shippedQty, 0);
    const totalDeficits = auditItems.filter(i => i.hasDeficit).length;
    const totalDiscrepancies = auditItems.filter(i => i.hasDiscrepancy).length;
    const totalMatched = auditItems.filter(i => !i.hasDiscrepancy && !i.hasDeficit).length;

    return { totalItems, totalPurchased, totalShipped, totalDeficits, totalDiscrepancies, totalMatched };
  }, [auditItems]);

  // Sync / Fix Base Stock with Calculated Stock
  const handleFixAllBaseStocks = async () => {
    if (!confirm('هل تريد تعديل مخزون الأساس لجميع المنتجات ليتطابق تماماً مع الكمية المحسوبة المحققة بناءً على الفواتير والطلبيات المشحونة؟')) {
      return;
    }

    setIsFixing(true);
    try {
      const updatedProductsMap = new Map<string, any>();

      auditItems.forEach(item => {
        if (item.hasDiscrepancy) {
          const product = updatedProductsMap.get(item.parentId) || JSON.parse(JSON.stringify(item.product));

          if (item.isVariation && product.variations) {
            product.variations = product.variations.map((v: any) => {
              if (String(v.id) === String(item.variation.id)) {
                return {
                  ...v,
                  local_stock_quantity: item.calculatedStock,
                  stock_quantity: item.calculatedStock
                };
              }
              return v;
            });
          } else {
            product.local_stock_quantity = item.calculatedStock;
            product.stock_quantity = item.calculatedStock;
          }

          updatedProductsMap.set(item.parentId, product);
        }
      });

      const updatedList = Array.from(updatedProductsMap.values());
      if (updatedList.length > 0) {
        await bulkUpsertInventory(updatedList);
        toast.success(`تم تحديث ومطابقة المخزون الأساسي لـ ${updatedList.length} منتج بنجاح`);
      } else {
        toast.success('جميع المنتجات متطابقة بالفعل!');
      }
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء المزامنة والتحديث');
    } finally {
      setIsFixing(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['اسم المنتج والنوع', 'رمز SKU', 'المخزون الخام الأصلي', 'إجمالي المشتريات (فواتير)', 'إجمالي المشحونات (طلبيات)', 'المرتجعات', 'مخزون النظام المحسوب', 'الفرق/الفائض'];
    const rows = filteredItems.map(item => [
      `"${item.fullName.replace(/"/g, '""')}"`,
      `"${item.sku}"`,
      item.initialQty,
      item.purchasedQty,
      item.shippedQty,
      item.returnedQty,
      item.calculatedStock,
      item.variance
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تدقيق_المخزون_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] sm:max-h-[88vh] my-auto flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg sm:text-xl flex items-center gap-2">
                أداة تدقيق ومطابقة كميات المخزون
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {isLocalMode ? 'مخزن محلي' : 'متزامن مع المتجر'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                مقارنة بين المخزون الأولي، كميات الفواتير المشتراة، والكميات المشحونة لحساب دقيق 100%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200 bg-white"
              title="طباعة التقرير"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2.5 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-200 bg-emerald-50/60 font-bold text-xs flex items-center gap-1.5"
              title="تصدير Excel/CSV"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span className="hidden sm:inline">تصدير CSV</span>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors border border-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Only Title */}
        <div className="hidden print:block p-6 text-center border-b border-slate-300">
          <h1 className="text-2xl font-black text-slate-900">تقرير تدقيق ومطابقة كميات المخزون</h1>
          <p className="text-sm text-slate-600 mt-1">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} - الإجمالي: {auditItems.length} صنف</p>
        </div>

        {/* KPI Summary Strip */}
        <div className="p-4 bg-slate-100/60 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-bold text-slate-400">إجمالي الأصناف</div>
            <div className="text-xl font-black text-slate-800">{kpis.totalItems}</div>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-sm">
            <div className="text-[11px] font-bold text-emerald-700">إجمالي المشتريات (فواتير)</div>
            <div className="text-xl font-black text-emerald-800">+{kpis.totalPurchased}</div>
          </div>
          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-sm">
            <div className="text-[11px] font-bold text-rose-700">إجمالي المشحونات (طلبيات)</div>
            <div className="text-xl font-black text-rose-800">-{kpis.totalShipped}</div>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 shadow-sm">
            <div className="text-[11px] font-bold text-amber-700">أصناف بها اختلافات</div>
            <div className="text-xl font-black text-amber-800">{kpis.totalDiscrepancies}</div>
          </div>
          <div className="bg-red-50/60 p-3 rounded-xl border border-red-200 shadow-sm">
            <div className="text-[11px] font-bold text-red-700">أصناف بها عجز (سالب)</div>
            <div className="text-xl font-black text-red-800">{kpis.totalDeficits}</div>
          </div>
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 shadow-sm">
            <div className="text-[11px] font-bold text-indigo-700">أصناف متطابقة</div>
            <div className="text-xl font-black text-indigo-800">{kpis.totalMatched}</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="البحث باسم المنتج أو رمز SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> تصفية:
            </span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${filterType === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              الكل ({auditItems.length})
            </button>
            <button
              onClick={() => setFilterType('discrepancy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${filterType === 'discrepancy' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
            >
              به اختلاف ({kpis.totalDiscrepancies})
            </button>
            <button
              onClick={() => setFilterType('deficit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${filterType === 'deficit' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}
            >
              عجز مخزون ({kpis.totalDeficits})
            </button>
            <button
              onClick={() => setFilterType('matched')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${filterType === 'matched' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
            >
              متطابق ({kpis.totalMatched})
            </button>
          </div>

          {kpis.totalDiscrepancies > 0 && (
            <button
              onClick={handleFixAllBaseStocks}
              disabled={isFixing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0 w-full sm:w-auto justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFixing ? 'animate-spin' : ''}`} />
              {isFixing ? 'جاري التعديل...' : 'مطابقة المخزون الأساسي تلقائياً'}
            </button>
          )}
        </div>

        {/* Audit Data Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-black">
                <tr>
                  <th className="px-3 py-3">المنتج / النوع</th>
                  <th className="px-3 py-3">رمز SKU</th>
                  <th className="px-3 py-3 text-center bg-slate-200/50">المخزون الأساسي</th>
                  <th className="px-3 py-3 text-center text-emerald-700 bg-emerald-50/50">+ المشتريات (فواتير)</th>
                  <th className="px-3 py-3 text-center text-rose-700 bg-rose-50/50">- المشحونات (طلبيات)</th>
                  <th className="px-3 py-3 text-center text-indigo-700 bg-indigo-50/50">+ المرتجعات</th>
                  <th className="px-3 py-3 text-center font-black bg-slate-200 text-slate-900">المخزون المحسوب (ديناميكي)</th>
                  <th className="px-3 py-3 text-center">الفرق / الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {item.image ? (
                            <img src={item.image} alt={item.fullName} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-black text-slate-800 leading-tight">{item.parentName}</div>
                            {item.isVariation && (
                              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                {item.variationOption}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-600">
                        {item.sku || '-'}
                      </td>

                      {/* Initial Base Stock */}
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700 bg-slate-50/50">
                        {item.initialQty}
                      </td>

                      {/* Purchased */}
                      <td className="px-3 py-2.5 text-center font-black text-emerald-600 bg-emerald-50/30">
                        {item.purchasedQty > 0 ? `+${item.purchasedQty}` : '0'}
                      </td>

                      {/* Shipped */}
                      <td className="px-3 py-2.5 text-center font-black text-rose-600 bg-rose-50/30">
                        {item.shippedQty > 0 ? `-${item.shippedQty}` : '0'}
                      </td>

                      {/* Returned */}
                      <td className="px-3 py-2.5 text-center font-bold text-indigo-600 bg-indigo-50/30">
                        {item.returnedQty > 0 ? `+${item.returnedQty}` : '0'}
                      </td>

                      {/* Calculated Dynamic Stock */}
                      <td className={`px-3 py-2.5 text-center font-black text-base ${item.calculatedStock < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-900'}`}>
                        {item.calculatedStock}
                      </td>

                      {/* Variance & Status */}
                      <td className="px-3 py-2.5 text-center">
                        {item.hasDeficit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> عجز ({item.calculatedStock})
                          </span>
                        ) : item.variance !== 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <RefreshCw className="w-3.5 h-3.5" /> فرق ({item.variance > 0 ? `+${item.variance}` : item.variance})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> متطابق
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold bg-white">
                      لا توجد أصناف مطابقة لنتائج البحث والتصفية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Printable Footer / Signature */}
        <div className="hidden print:block p-8 mt-6 border-t border-slate-300">
          <div className="grid grid-cols-3 gap-8 text-center text-xs font-bold text-slate-700">
            <div>
              <p className="mb-8">توقيع مسؤول المخزن</p>
              <p>.......................................</p>
            </div>
            <div>
              <p className="mb-8">توقيع المحاسب</p>
              <p>.......................................</p>
            </div>
            <div>
              <p className="mb-8">اعتماد المدير العام</p>
              <p>.......................................</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
