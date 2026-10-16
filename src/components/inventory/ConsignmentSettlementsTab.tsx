import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, PurchaseInvoice, Order, InventoryProduct, SystemSettings } from '../../types';
import { Search, Calculator, Eye, CheckCircle2, Package, TrendingUp, AlertTriangle, ArrowLeftRight, FileText, ChevronDown, ChevronUp, DollarSign, Wallet, Calendar , Link2 , History, Download, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ViewOrderModal } from '../orders/ViewOrderModal';
import { getOrderUnitAndTotalCost } from '../../utils/productCostUtils';
import { TablePagination } from '../common/TablePagination';

interface Props {
  suppliers: Supplier[];
  orders: Order[];
  createConsignmentSettlement: (supplierId: string, invoice: any, orderIds: string[]) => Promise<void>;
  purchaseInvoices: PurchaseInvoice[];
  inventoryProducts?: InventoryProduct[];
  settings?: SystemSettings | null;
  shippingInvoices?: any[];
  supplierPayments?: any[];
  addSupplierPayment?: (payment: any) => Promise<void>;
  onSwitchToInvoices?: () => void;
}

export function ConsignmentSettlementsTab({ suppliers, orders, createConsignmentSettlement, purchaseInvoices, inventoryProducts = [], settings, shippingInvoices = [], supplierPayments = [], addSupplierPayment, onSwitchToInvoices }: Props) {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [versement, setVersement] = useState<number | ''>('');
  const [versementType, setVersementType] = useState<'invoice' | 'general'>('invoice');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<any>(null);

  // Pagination state
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);

  // --- Supplier Account Stats & History ---
  const supplierInvoices = useMemo(() => purchaseInvoices.filter(inv => String(inv.supplierId) === String(selectedSupplierId)), [purchaseInvoices, selectedSupplierId]);
  
  const supplierPaymentsHistory = useMemo(() => supplierPayments.filter(p => String(p.supplierId) === String(selectedSupplierId)), [supplierPayments, selectedSupplierId]);
  
  const linkedShippingPayments = useMemo(() => shippingInvoices.filter(si => String(si.linkedSupplierId) === String(selectedSupplierId)), [shippingInvoices, selectedSupplierId]);

  const totalInvoicesAmount = supplierInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  
  const totalFarsemon = supplierPaymentsHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                        linkedShippingPayments.reduce((sum, si) => sum + (Number(si.linkedSupplierAmount) || 0), 0);
  
  const currentDebt = totalInvoicesAmount - totalFarsemon;

  // --- Linked Products ---
  const linkedProductIdentifiers = useMemo(() => {
    const identifiers = new Set<string>();
    supplierInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.sku) identifiers.add(item.sku.toLowerCase());
        if (item.productName) identifiers.add(item.productName.toLowerCase());
      });
    });
    return identifiers;
  }, [supplierInvoices]);

  const linkedProducts = useMemo(() => {
    if (!selectedSupplierId) return [];
    return inventoryProducts.filter(p => 
      p.supplierId === selectedSupplierId ||
      (p.sku && linkedProductIdentifiers.has(p.sku.toLowerCase())) || 
      (p.name && linkedProductIdentifiers.has(p.name.toLowerCase()))
    );
  }, [inventoryProducts, linkedProductIdentifiers, selectedSupplierId]);

  
  const [dateFilterType, setDateFilterType] = useState<'all' | 'this_month' | 'custom'>(() => {
    return (localStorage.getItem('consignment_dateFilter') as any) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('consignment_dateFilter', dateFilterType);
  }, [dateFilterType]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter orders that are "مستلم" (we no longer filter out settled ones, per user request)
  const deliveredUnsettledOrders = useMemo(() => {
    return orders.filter(o => 
      o.status2 === 'مستلم' && 
      !o.trashed
    );
  }, [orders]);

  // Pre-calculate costs for all unsettled orders
  const analyzedOrders = useMemo(() => {
    return deliveredUnsettledOrders.map(o => {
      const costInfo = getOrderUnitAndTotalCost(o, inventoryProducts, settings);
      return { order: o, costInfo };
    });
  }, [deliveredUnsettledOrders, inventoryProducts, settings]);

  const selectedProduct = useMemo(() => inventoryProducts.find(p => p.id === selectedProductId), [inventoryProducts, selectedProductId]);

  // Filter matched orders based on selected product and date
  const matchedOrders = useMemo(() => {
    if (!selectedProductId || !selectedProduct) return [];
    
    const prodNameClean = (selectedProduct.name || '').toLowerCase().trim();
    const prodAliasClean = (selectedProduct.shippingAliasName || '').toLowerCase().trim();
    
    let filtered = analyzedOrders.filter(ao => {
      // 1. Strict match by our utility or breakdown items
      if (ao.costInfo.recognizedProduct?.id === selectedProductId) return true;
      if (ao.costInfo.breakdown?.some(b => b.product?.id === selectedProductId || (b.productName && prodNameClean && b.productName.toLowerCase().includes(prodNameClean)))) return true;
      
      // 2. Fallback matching by name (if utility missed it because of weird formatting)
      const orderNameClean = (ao.order.productName || '').toLowerCase();
      if (prodNameClean && orderNameClean.includes(prodNameClean)) return true;
      if (prodAliasClean && orderNameClean.includes(prodAliasClean)) return true;
      
      // Fallback check variation shipping alias or SKU
      if (selectedProduct.variations && selectedProduct.variations.some(v => {
        const vAlias = (v.shippingAliasName || '').toLowerCase().trim();
        const vSku = (v.sku || '').toLowerCase().trim();
        const orderVarClean = (ao.order.variation || '').toLowerCase();
        return (vAlias && (orderNameClean.includes(vAlias) || orderVarClean.includes(vAlias))) ||
               (vSku && (orderNameClean.includes(vSku) || (ao.order.sku && ao.order.sku.toLowerCase().includes(vSku))));
      })) return true;

      // 3. Fallback check SKU in order name
      if (selectedProduct.sku && orderNameClean.includes(selectedProduct.sku.toLowerCase())) return true;
      
      return false;
    });
    
    // Apply date filters
    if (dateFilterType === 'this_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filtered = filtered.filter(ao => new Date(ao.order.orderDate).getTime() >= firstDay);
    } else if (dateFilterType === 'custom') {
      if (startDate) {
        const start = new Date(startDate).getTime();
        filtered = filtered.filter(ao => new Date(ao.order.orderDate).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999Z').getTime();
        filtered = filtered.filter(ao => new Date(ao.order.orderDate).getTime() <= end);
      }
    }
    
    // For fallback matches, if totalCogs is 0, try to inject a default cost from settings or product base price
    return filtered.map(ao => {
      if (ao.costInfo.totalCogs === 0 && ao.costInfo.calculatedQuantity > 0) {
        let fallbackUnitCost = 0;
        // Check settings dictionary
        if (settings?.productCosts) {
          if (settings.productCosts[selectedProduct.name]) {
            fallbackUnitCost = Number(settings.productCosts[selectedProduct.name]);
          } else if (selectedProduct.sku && settings.productCosts[selectedProduct.sku]) {
            fallbackUnitCost = Number(settings.productCosts[selectedProduct.sku]);
          }
        }
        
        // Check local stock cost or regular price if needed (assuming price might mean cost in some setups)
        // But if we can't find anything, we leave it at 0 to show warning.
        
        if (fallbackUnitCost > 0) {
           return {
             ...ao,
             costInfo: {
               ...ao.costInfo,
               unitCost: fallbackUnitCost,
               totalCogs: fallbackUnitCost * ao.costInfo.calculatedQuantity,
               recognizedVariation: ao.costInfo.recognizedVariation || { name: 'نوع غير محدد (تم استنتاجه)' }
             }
           };
        }
      }
      return ao;
    });
  }, [analyzedOrders, selectedProductId, selectedProduct, dateFilterType, startDate, endDate, settings]);

  const getOrderRelevantCost = (ao: any) => {
    if (ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1 && selectedProduct) {
      const prodNameClean = (selectedProduct.name || '').toLowerCase().trim();
      const relevant = ao.costInfo.breakdown.filter((b: any) => 
        b.product?.id === selectedProductId || 
        (b.productName && prodNameClean && b.productName.toLowerCase().includes(prodNameClean))
      );
      if (relevant.length > 0) {
        return relevant.reduce((s: number, b: any) => s + b.totalCost, 0);
      }
    }
    return ao.costInfo.totalCogs;
  };

  const getOrderRelevantQty = (ao: any) => {
    if (ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1 && selectedProduct) {
      const prodNameClean = (selectedProduct.name || '').toLowerCase().trim();
      const relevant = ao.costInfo.breakdown.filter((b: any) => 
        b.product?.id === selectedProductId || 
        (b.productName && prodNameClean && b.productName.toLowerCase().includes(prodNameClean))
      );
      if (relevant.length > 0) {
        return relevant.reduce((s: number, b: any) => s + b.quantity, 0);
      }
    }
    return ao.costInfo.calculatedQuantity;
  };

  const totalQuantity = matchedOrders.reduce((sum, ao) => sum + getOrderRelevantQty(ao), 0);
  const totalSalesRevenue = matchedOrders.reduce((sum, ao) => sum + (Number(ao.order.totalCharge) || 0), 0);
  const totalDeliveryFees = matchedOrders.reduce((sum, ao) => sum + (Number(ao.order.realDeliveryPrice) || Number(ao.order.deliveryPrice) || 0), 0);
  const totalCost = matchedOrders.reduce((sum, ao) => sum + getOrderRelevantCost(ao), 0);
  const netProfit = totalSalesRevenue - totalDeliveryFees - totalCost;
  const advancePayment = Number(versement) || 0;
  
  const supplierLinkedPayments = selectedSupplierId 
    ? shippingInvoices.filter(si => si.linkedSupplierId === selectedSupplierId).reduce((sum, si) => sum + Number(si.linkedSupplierAmount || 0), 0)
    : 0;

  const remainingDebt = Math.max(0, totalCost - advancePayment);

  const handleExportExcel = () => {
    if (!matchedOrders || matchedOrders.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData: any[] = [];
    matchedOrders.forEach(ao => {
       const dateStr = ao.order.orderDate ? ao.order.orderDate.split('T')[0] : '';
       const orderNum = ao.order.orderId || ao.order.id.slice(0, 8);
       const tracking = ao.order.shippingTrackingId || ao.order.trackingNumber || '-';

       if (ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1) {
         // Multi-variation order: list each variation with its exact individual cost
         ao.costInfo.breakdown.forEach((item, itemIdx) => {
           exportData.push({
             'المنتج': item.productName || selectedProduct?.name || 'غير محدد',
             'النوع (Variation)': item.variationName || `نوع ${itemIdx + 1}`,
             'رمز التتبع': tracking,
             'رقم الطلبية': orderNum,
             'اسم الزبون': ao.order.fullName || '-',
             'رقم الهاتف': ao.order.phone || '-',
             'الولاية': ao.order.region || '-',
             'تاريخ الطلبية': dateStr,
             'الكمية': item.quantity,
             'تكلفة الوحدة (د.ج)': item.unitCost,
             'الإجمالي (د.ج)': item.totalCost
           });
         });
       } else {
         const qty = ao.costInfo.calculatedQuantity || Number(ao.order.qnts) || 1;
         const uCost = ao.costInfo.unitCost || 0;
         exportData.push({
           'المنتج': ao.order.productName || selectedProduct?.name || 'غير محدد',
           'النوع (Variation)': ao.costInfo.recognizedVariation?.name || ao.order.variation || '-',
           'رمز التتبع': tracking,
           'رقم الطلبية': orderNum,
           'اسم الزبون': ao.order.fullName || '-',
           'رقم الهاتف': ao.order.phone || '-',
           'الولاية': ao.order.region || '-',
           'تاريخ الطلبية': dateStr,
           'الكمية': qty,
           'تكلفة الوحدة (د.ج)': uCost,
           'الإجمالي (د.ج)': ao.costInfo.totalCogs || (qty * uCost)
         });
       }
    });
    
    // Calculate sums
    const totalQty = exportData.reduce((sum, row) => sum + (Number(row['الكمية']) || 0), 0);
    const totalCostAmount = exportData.reduce((sum, row) => sum + (Number(row['الإجمالي (د.ج)']) || 0), 0);
    
    // Add total row
    exportData.push({
      'المنتج': 'المجموع الكلي',
      'النوع (Variation)': '',
      'رمز التتبع': '',
      'رقم الطلبية': '',
      'اسم الزبون': '',
      'رقم الهاتف': '',
      'الولاية': '',
      'تاريخ الطلبية': '',
      'الكمية': totalQty,
      'تكلفة الوحدة (د.ج)': '',
      'الإجمالي (د.ج)': totalCostAmount
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `Supplier_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCreateSettlement = async () => {
    if (!selectedSupplierId) {
      toast.error('الرجاء اختيار المورد أولاً');
      return;
    }
    if (!selectedProductId || !selectedProduct) {
      toast.error('الرجاء تحديد المنتج');
      return;
    }
    if (matchedOrders.length === 0) {
      toast.error('لا توجد طلبيات مستلمة لهذا المنتج في هذه الفترة');
      return;
    }
    if (totalCost <= 0) {
      if (!window.confirm('إجمالي التكلفة المحسوبة هو 0. هل تريد الاستمرار؟ يرجى التحقق من أسعار التكلفة في المخزون.')) {
        return;
      }
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return;

    if (!window.confirm(`هل أنت متأكد من إنشاء فاتورة تسوية لـ ${matchedOrders.length} طلبية بقيمة ${totalCost.toLocaleString()} د.ج؟\nالمبلغ المدفوع (فارسمون): ${advancePayment.toLocaleString()} د.ج\nالباقي للدفع: ${remainingDebt.toLocaleString()} د.ج`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceId = `INV-CS-${Date.now()}`;
      
      let periodNote = '';
      if (dateFilterType === 'this_month') periodNote = ' (فترة هذا الشهر)';
      else if (dateFilterType === 'custom') periodNote = ` (من ${startDate || 'البداية'} إلى ${endDate || 'النهاية'})`;
      
            let invoicePaymentStatus: 'paid' | 'unpaid' | 'partial' = 'unpaid';
      let invoicePaymentNotes = '';

      if (advancePayment > 0 && versementType === 'invoice') {
        if (advancePayment >= totalCost) {
          invoicePaymentStatus = 'paid';
        } else {
          invoicePaymentStatus = 'partial';
        }
        invoicePaymentNotes = `تم دفع ${advancePayment.toLocaleString()} د.ج (فارسمون) عند إنشاء الفاتورة`;
      }

      const invoice: PurchaseInvoice = {
        id: invoiceId,
        invoiceNumber: `SET-${Math.floor(Date.now() / 1000)}`,
        supplierId: supplier.id,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        items: matchedOrders.flatMap((ao, index) => {
           const dateStr = ao.order.orderDate ? ao.order.orderDate.split('T')[0] : '';
           const orderNum = ao.order.orderId || ao.order.id.slice(0, 8);
           const tracking = ao.order.shippingTrackingId || ao.order.trackingNumber || orderNum;

           if (ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1) {
             return ao.costInfo.breakdown.map((item, itemIdx) => ({
                id: `ITEM-${Date.now()}-${index}-${itemIdx}`,
                sku: item.sku || tracking,
                productName: `${item.productName || selectedProduct.name} - ${item.variationName || `نوع ${itemIdx + 1}`} (طلبية #${orderNum}) | تاريخ: ${dateStr}`.trim(),
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.totalCost
             }));
           }

           const qty = ao.costInfo.calculatedQuantity || Number(ao.order.qnts) || 1;
           const uCost = ao.costInfo.unitCost || 0;
           return [{
              id: `ITEM-${Date.now()}-${index}`,
              sku: tracking,
              productName: `${ao.order.productName || selectedProduct.name} ${ao.order.variation ? `- ${ao.order.variation}` : ''} (طلبية #${orderNum}) | تاريخ: ${dateStr}`.trim(),
              quantity: qty,
              unitCost: uCost,
              totalCost: ao.costInfo.totalCogs || (qty * uCost)
           }];
        }),
        subInvoices: [],
        totalAmount: totalCost,
        paymentStatus: invoicePaymentStatus,
        paymentNotes: invoicePaymentNotes,
        notes: `فاتورة تسوية للطلبيات المستلمة لمنتج "${selectedProduct.name}". تشمل ${matchedOrders.length} طلبية لأنواع مختلفة.${periodNote}`
      };

      const orderIds = matchedOrders.map(ao => ao.order.id);
      await createConsignmentSettlement(supplier.id, invoice, orderIds);
      
      // Save advance payment if it exists
      if (advancePayment > 0 && addSupplierPayment) {
        await addSupplierPayment({
          id: `PAY-${Date.now()}`,
          supplierId: supplier.id,
          amount: advancePayment,
          date: new Date().toISOString(),
          notes: versementType === 'invoice' ? `دفعة مقدمة (فارسمون) مرتبطة بتسوية الدين ${invoice.invoiceNumber}` : `دفعة مقدمة (فارسمون) للحساب العام للمورد مسجلة أثناء التسوية ${invoice.invoiceNumber}`
        });
      }
      
      toast.success('تم إنشاء الفاتورة وتسوية الطلبيات بنجاح');
      setLastCreatedInvoice(invoice);
      setSelectedProductId('');
      setVersement('');
      setSelectedSupplierId('');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إنشاء التسوية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {lastCreatedInvoice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
          <div>
            <h3 className="text-emerald-900 font-bold mb-1 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              تم إنشاء فاتورة التسوية بنجاح
            </h3>
            <p className="text-sm text-emerald-700">
              تمت تسوية الطلبيات وإنشاء فاتورة رقم {lastCreatedInvoice.invoiceNumber}. يمكنك طباعتها أو عرضها في قسم فواتير الشراء.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <button onClick={() => { if(onSwitchToInvoices) onSwitchToInvoices(); }} className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-colors text-sm">
                الذهاب لطباعة الفاتورة
             </button>
             <button onClick={() => setLastCreatedInvoice(null)} className="px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl transition-colors">
                <X className="w-5 h-5" />
             </button>
          </div>
        </div>
      )}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
          نظام تسوية الكريدي المتقدم (بضاعة الأمانة)
        </h3>
        <p className="text-sm text-indigo-700/80 leading-relaxed">
          يتيح لك هذا النظام تسوية الطلبيات المستلمة لمنتج معين. سيتم التعرف على <strong>الأنواع (Variations)</strong> المرتبطة بالمنتج تلقائياً وحساب تكلفة كل نوع بدقة بناءً على أسعار التكلفة المدخلة في المخزون. كما يمكنك إضافة "فارسمون" (دفعة مقدمة) ليتم خصمها من إجمالي الفاتورة.
        </p>
      </div>

      
      {selectedSupplierId && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8 animate-in fade-in duration-300">
          {/* Account Summary */}
          <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                حالة حساب المورد
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-bold text-slate-600">إجمالي السلع (الديون):</span>
                  <span className="font-black text-slate-800">{totalInvoicesAmount.toLocaleString()} د.ج</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-sm font-bold text-emerald-700">إجمالي المدفوعات (فارسمون):</span>
                  <span className="font-black text-emerald-600">{totalFarsemon.toLocaleString()} د.ج</span>
                </div>
              </div>
            </div>
            <div className={`mt-6 p-4 rounded-xl border ${currentDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <p className={`text-xs font-bold uppercase mb-1 ${currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {currentDebt > 0 ? 'الدين المتبقي' : 'رصيد إيجابي / مسوى'}
              </p>
              <p className={`text-3xl font-black ${currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {Math.abs(currentDebt).toLocaleString()} <span className="text-sm">د.ج</span>
              </p>
            </div>
          </div>

          {/* Payments History */}
          <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              سجل الدفعات (الفارسمون)
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[220px]">
              {supplierPaymentsHistory.length === 0 && linkedShippingPayments.length === 0 ? (
                <div className="text-center text-slate-400 font-medium py-8 text-sm">
                  لا يوجد سجل دفعات لهذا المورد.
                </div>
              ) : (
                <>
                  {supplierPaymentsHistory.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{Number(p.amount).toLocaleString()} د.ج</p>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(p.date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      {p.notes && <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 truncate max-w-[100px]">{p.notes}</span>}
                    </div>
                  ))}
                  {linkedShippingPayments.map((p, i) => (
                    <div key={'link'+i} className="flex justify-between items-center p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div>
                        <p className="font-bold text-indigo-700 text-sm">{Number(p.linkedSupplierAmount).toLocaleString()} د.ج</p>
                        <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> من شركة شحن
                        </p>
                      </div>
                      <span className="text-xs text-indigo-500 bg-white px-2 py-1 rounded-md border border-indigo-100 truncate max-w-[100px]">{p.companyName}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Linked Products */}
          <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              المنتجات المرتبطة بالمورد
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[220px]">
              {linkedProducts.length === 0 ? (
                <div className="text-center text-slate-400 font-medium py-8 text-sm">
                  لم يتم تسجيل منتجات سابقة لهذا المورد.
                </div>
              ) : (
                linkedProducts.map((prod, i) => {
                  // Let's quickly see how many pending orders this product has
                  // We do this by checking deliveredUnsettledOrders
                  const pendingCount = deliveredUnsettledOrders.filter(o => 
                    (o.productName || '').toLowerCase().includes((prod.name || '').toLowerCase()) ||
                    (prod.shippingAliasName && (o.productName || '').toLowerCase().includes(prod.shippingAliasName.toLowerCase())) ||
                    (prod.sku && (o.productName || '').toLowerCase().includes(prod.sku.toLowerCase())) ||
                    (prod.variations && prod.variations.some(v => 
                      (v.shippingAliasName && ((o.productName || '').toLowerCase().includes(v.shippingAliasName.toLowerCase()) || (o.variation || '').toLowerCase().includes(v.shippingAliasName.toLowerCase()))) ||
                      (v.sku && ((o.productName || '').toLowerCase().includes(v.sku.toLowerCase()) || (o.sku && o.sku.toLowerCase().includes(v.sku.toLowerCase()))))
                    ))
                  ).length;

                  return (
                    <button 
                      key={i} 
                      onClick={() => setSelectedProductId(prod.id)}
                      className={`w-full text-right flex justify-between items-center p-3 rounded-xl border transition-all ${selectedProductId === prod.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                    >
                      <div className="truncate pl-2">
                        <p className={`font-bold text-sm truncate ${selectedProductId === prod.id ? 'text-indigo-800' : 'text-slate-700'}`}>{prod.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{prod.sku || 'بدون SKU'}</p>
                      </div>
                      <div className="shrink-0 text-center">
                        <span className={`text-xs font-black px-2 py-1 rounded-md ${pendingCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>
                          {pendingCount} طلبية
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm self-start">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">1. اختر المورد</label>
            <select
              value={selectedSupplierId || ''}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700"
            >
              <option value="">-- اختر المورد --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">2. حدد المنتج الرئيسي</label>
            <select
              value={selectedProductId || ''}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700"
            >
              <option value="">-- اختر المنتج من المخزون --</option>
              {inventoryProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">3. تحديد الفترة الزمنية</label>
            <select
              value={dateFilterType || 'all'}
              onChange={e => setDateFilterType(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-bold text-slate-700 mb-3"
            >
              <option value="all">كل الفترات (الافتراضي)</option>
              <option value="this_month">هذا الشهر</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
            
            {dateFilterType === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">من تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={startDate || ''}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pr-8 pl-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">إلى تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={endDate || ''}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pr-8 pl-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between items-center">
              <span>4. الدفعة المقدمة (فارسمون)</span>
              <span className="text-xs font-normal text-slate-400">اختياري</span>
            </label>
            <div className="relative">
              <Wallet className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                value={versement ?? ''}
                onChange={e => setVersement(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0 د.ج"
                min="0"
                className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 bg-slate-50"
              />
            </div>
            
            {Number(versement) > 0 && (
              <div className="mt-3 bg-white p-3 border border-slate-100 rounded-xl">
                <label className="block text-xs font-bold text-slate-600 mb-2">أين يتم تطبيق هذا الدفع؟</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="versementType"
                      checked={versementType === 'invoice'}
                      onChange={() => setVersementType('invoice')}
                      className="text-indigo-500 focus:ring-indigo-500 w-4 h-4" 
                    />
                    <span className="font-medium">مع فاتورة تسوية الدين (الفاتورة الحالية)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="versementType"
                      checked={versementType === 'general'}
                      onChange={() => setVersementType('general')}
                      className="text-indigo-500 focus:ring-indigo-500 w-4 h-4" 
                    />
                    <span className="font-medium">مع الفواتير العامة للمورد (الحساب العام)</span>
                  </label>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2 font-medium">سيتم تسجيل هذا المبلغ في سجل مدفوعات المورد وتخفيض دينه الإجمالي.</p>
          </div>
            {supplierLinkedPayments > 0 && (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-2">
                <Link2 className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-indigo-900">رصيد دفعات مربوطة بهذا المورد:</p>
                  <p className="text-lg font-black text-indigo-700">{supplierLinkedPayments.toLocaleString()} د.ج</p>
                  <p className="text-[10px] text-indigo-600 mt-0.5 leading-relaxed">
                    تم ربط هذه الدفعات من فواتير شركات التوصيل. لقد تم خصمها مسبقاً من إجمالي ديون المورد. 
                    (لا تقم بإدخالها كفارسمون هنا مجدداً لتجنب الحساب المزدوج).
                  </p>
                </div>
              </div>
            )}

        </div>

        <div className="lg:col-span-2 space-y-5">
          {selectedProductId && matchedOrders.length > 0 ? (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 px-5 py-4 border-b border-emerald-100 flex items-center justify-between">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  تم العثور على {matchedOrders.length} طلبية مستلمة (تشمل جميع الأنواع)
                </h4>
              </div>
              
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold mb-1">الكمية الإجمالية للمنتجات</p>
                  <p className="text-xl font-black text-slate-800">{totalQuantity} <span className="text-sm font-medium">قطعة</span></p>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <p className="text-xs text-amber-700 font-bold mb-1">إجمالي المبيعات (المحصل)</p>
                  <p className="text-xl font-black text-amber-900">{totalSalesRevenue.toLocaleString()} <span className="text-sm font-medium">د.ج</span></p>
                </div>

                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <p className="text-xs text-rose-700 font-bold mb-1">تكلفة سلع المورد (الدين)</p>
                  <p className="text-xl font-black text-rose-900">{totalCost.toLocaleString()} <span className="text-sm font-medium">د.ج</span></p>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-700 font-bold mb-1">الفائدة الصافية المحققة</p>
                  <p className="text-xl font-black text-indigo-900">{netProfit.toLocaleString()} <span className="text-sm font-medium">د.ج</span></p>
                </div>
              </div>

              {advancePayment > 0 && (
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between bg-sky-50 p-4 rounded-xl border border-sky-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-sky-700" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sky-900">الدفعة المقدمة (فارسمون)</p>
                        <p className="text-xs text-sky-700">سيتم خصمها من تكلفة سلع المورد (الدين)</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black text-sky-900">{advancePayment.toLocaleString()} د.ج</p>
                      <p className="text-xs font-bold text-rose-600 mt-1">
                        الباقي للدفع للمورد: {remainingDebt.toLocaleString()} د.ج
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* التفاصيل الدقيقة */}
              <div className="px-5 pb-2">
                <button 
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors font-bold text-slate-700 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500" />
                    عرض التفاصيل الدقيقة للأنواع والطلبيات المكتشفة
                  </span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showDetails && (
                <div className="px-5 pb-5 mt-2">
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-3 px-4">التاريخ</th>
                          <th className="py-3 px-4">الطلبية</th>
                          
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-4">النوع (Variation)</th>
                          <th className="py-3 px-4">الكمية</th>
                          <th className="py-3 px-4">التكلفة</th>
                          <th className="py-3 px-4">الإجمالي</th>
                          <th className="py-3 px-4 text-center">تفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                        {matchedOrders.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize).map((ao, idx) => {
                          const hasMultiVariants = ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1;
                          return (
                            <tr key={ao.order.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-4 text-xs whitespace-nowrap">{new Date(ao.order.orderDate).toLocaleDateString('en-GB')}</td>
                              <td className="py-2.5 px-4 font-bold truncate max-w-[100px]" dir="ltr">#{ao.order.orderId || ao.order.id}</td>
                              
                              <td className="py-2.5 px-4">
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap">
                                  {ao.order.status2 || ao.order.status1}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-indigo-600 text-xs">
                                {hasMultiVariants ? (
                                  <div className="space-y-1">
                                    {ao.costInfo.breakdown!.map((b, bIdx) => (
                                      <div key={bIdx} className="flex items-center gap-1.5 font-bold text-slate-800">
                                        <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded border border-indigo-100">{b.quantity}x</span>
                                        <span>{b.variationName || b.productName}</span>
                                        <span className="text-[10px] text-slate-400 font-normal">({b.unitCost.toLocaleString()} د.ج)</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  ao.costInfo.recognizedVariation?.name || ao.order.variation || ao.order.productName
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-bold text-xs">{ao.costInfo.calculatedQuantity}</span>
                              </td>
                              <td className="py-2.5 px-4 text-rose-600">
                                {hasMultiVariants ? (
                                  <div>
                                    <div className="font-bold text-xs text-slate-700" title="مجموع تكلفة الأنواع">
                                      {ao.costInfo.breakdown!.map(b => `${b.unitCost.toLocaleString()} د.ج`).join(' + ')}
                                    </div>
                                    <div className="text-[10px] text-emerald-600 font-bold">
                                      {ao.costInfo.breakdown!.length === 2 ? 'مجموع النوعين (بدون ضرب)' : 'مجموع تكلفة الأنواع بدقة'}
                                    </div>
                                  </div>
                                ) : ao.costInfo.calculatedQuantity > 1 ? (
                                  <div>
                                    <div className="font-bold text-xs text-slate-700">
                                      {ao.costInfo.unitCost.toLocaleString()} د.ج <span className="text-[10px] text-slate-400 font-normal">/ للقطعة</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      {ao.costInfo.calculatedQuantity} قطع متطابقة
                                    </div>
                                  </div>
                                ) : (
                                  <span>{ao.costInfo.unitCost.toLocaleString()} د.ج</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 font-black text-rose-700">{ao.costInfo.totalCogs.toLocaleString()} د.ج</td>
                              <td className="py-2.5 px-4 text-center">
                                <button 
                                  onClick={() => setViewOrder(ao.order)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                                  title="عرض تفاصيل الطلبية"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {matchedOrders.length > 0 && (
                    <TablePagination
                      currentPage={tablePage}
                      totalPages={Math.ceil(matchedOrders.length / tablePageSize) || 1}
                      pageSize={tablePageSize}
                      totalItems={matchedOrders.length}
                      onPageChange={setTablePage}
                      onPageSizeChange={setTablePageSize}
                      itemLabel="طلبية مستلمة"
                      pageSizeOptions={[10, 25, 50, 100]}
                      className="rounded-b-xl"
                    />
                  )}
                </div>
              )}

              <div className="px-5 pb-5 pt-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSettlement}
                    disabled={isSubmitting || !selectedSupplierId}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء فاتورة المورد وتسوية الطلبيات'}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={matchedOrders.length === 0}
                    className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    title="تصدير كملف إكسل"
                  >
                    <Download className="w-5 h-5" />
                    تصدير
                  </button>
                </div>
                {totalCost <= 0 && (
                  <p className="text-center text-xs text-rose-500 mt-2 font-bold flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    تحذير: إجمالي تكلفة بعض/كل هذه الطلبيات 0 د.ج. تأكد من إدخال أسعار التكلفة في المخزون.
                  </p>
                )}
                {!selectedSupplierId && (
                  <p className="text-center text-xs text-rose-500 mt-2 font-bold">
                    * يرجى اختيار المورد أولاً لإنشاء الفاتورة
                  </p>
                )}
              </div>
            </div>
          ) : selectedProductId ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-bold text-lg">لا توجد طلبيات مستلمة لهذا المنتج</p>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">تأكد من اختيار المنتج الصحيح وتاريخ الفترة.</p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center">
              <Package className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-bold text-lg">اختر منتجاً لعرض طلبياته المستلمة</p>
              <p className="text-sm text-slate-400 mt-2 max-w-md">سيقوم النظام تلقائياً باستخراج جميع الطلبيات المستلمة للمنتج وأنواعه، وحساب التكلفة الدقيقة لكل طلبية، وإظهار الفائدة الصافية المحققة.</p>
            </div>
          )}
              </div>
      </div>
      {viewOrder && (
        <ViewOrderModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
        />
      )}
    </div>
  );
}
