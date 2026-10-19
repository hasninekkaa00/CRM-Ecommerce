import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Download, CheckSquare, Square, FileSpreadsheet, 
  Settings, Sliders, Package, Truck, DollarSign, Search, 
  Calendar, Sparkles, Filter, Layers, Check, RefreshCw, User, Phone, MapPin, Hash, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Supplier, InventoryProduct, SystemSettings } from '../../types';
import { getEffectiveShippingCost } from '../../utils/shippingFees';

export interface ConsignmentExportColumn {
  id: string;
  label: string;
  category: 'costs' | 'shipping' | 'order' | 'finance' | 'admin';
  defaultSelected: boolean;
  isNumeric?: boolean;
  description?: string;
}

export const ALL_CONSIGNMENT_COLUMNS: ConsignmentExportColumn[] = [
  // 1. تكلفة السلع والمورد
  { id: 'productName', label: 'المنتج', category: 'costs', defaultSelected: true, description: 'اسم المنتج الرئيسي' },
  { id: 'variation', label: 'النوع (Variation)', category: 'costs', defaultSelected: true, description: 'الموديل أو المقاس أو اللون' },
  { id: 'sku', label: 'رمز المنتج (SKU)', category: 'costs', defaultSelected: false, description: 'الرمز التخزيني للمنتج أو النوع' },
  { id: 'quantity', label: 'الكمية (قطعة)', category: 'costs', defaultSelected: true, isNumeric: true, description: 'عدد القطع المحسوبة في الطلبية' },
  { id: 'unitCost', label: 'تكلفة الوحدة (د.ج)', category: 'costs', defaultSelected: true, isNumeric: true, description: 'سعر شراء القطعة الواحدة من المورد' },
  { id: 'totalCost', label: 'إجمالي تكلفة السلعة (د.ج)', category: 'costs', defaultSelected: true, isNumeric: true, description: 'إجمالي مستحقات المورد عن السلعة (الكمية × تكلفة الوحدة)' },
  { id: 'supplierName', label: 'اسم المورد', category: 'costs', defaultSelected: true, description: 'المورد المربوط بهذه البضاعة أو التسوية' },

  // 2. الشحن والتوصيل (بما فيها سعر الشحن الحقيقي)
  { id: 'realShipping', label: 'سعر الشحن الحقيقي (د.ج)', category: 'shipping', defaultSelected: true, isNumeric: true, description: 'تكلفة الشحن الحقيقية المدفوعة لشركة التوصيل' },
  { id: 'customerShipping', label: 'سعر شحن الزبون (د.ج)', category: 'shipping', defaultSelected: false, isNumeric: true, description: 'سعر الشحن المحسوب على الزبون في الفاتورة' },
  { id: 'shippingDifference', label: 'فرق الشحن (الزبون - الحقيقي)', category: 'shipping', defaultSelected: false, isNumeric: true, description: 'الفارق بين سعر شحن الزبون وتكلفة الشحن الحقيقية' },
  { id: 'shippingMethod', label: 'نوع التوصيل (مكتب / منزل)', category: 'shipping', defaultSelected: false, description: 'طريقة التوصيل (منزل أو مكتب استلام Stopdesk)' },
  { id: 'deliveryCompany', label: 'شركة التوصيل', category: 'shipping', defaultSelected: true, description: 'شركة الشحن المسؤولة عن تسليم الطرد' },
  { id: 'tracking', label: 'رمز التتبع (Tracking)', category: 'shipping', defaultSelected: true, description: 'رقم تتبع الطرد لدى شركة الشحن' },
  { id: 'status2', label: 'حالة التوصيل', category: 'shipping', defaultSelected: false, description: 'حالة الطرد (مستلم / تم التوصيل)' },
  { id: 'deliveryDate', label: 'تاريخ التسليم الفعلي', category: 'shipping', defaultSelected: false, description: 'تاريخ استلام الزبون للطلبية' },

  // 3. بيانات الطلبية والزبون
  { id: 'orderId', label: 'رقم الطلبية', category: 'order', defaultSelected: true, description: 'رقم الطلب في المتجر' },
  { id: 'customerName', label: 'اسم الزبون', category: 'order', defaultSelected: true, description: 'الاسم الكامل للعميل' },
  { id: 'phone', label: 'رقم الهاتف', category: 'order', defaultSelected: true, description: 'رقم هاتف العميل' },
  { id: 'region', label: 'الولاية', category: 'order', defaultSelected: true, description: 'ولاية التوصيل' },
  { id: 'city', label: 'البلدية / المكتب', category: 'order', defaultSelected: false, description: 'بلدية العميل أو مكتب الاستلام' },
  { id: 'address', label: 'العنوان الكامل', category: 'order', defaultSelected: false, description: 'عنوان التوصيل المسجل' },
  { id: 'orderDate', label: 'تاريخ الطلبية', category: 'order', defaultSelected: true, description: 'تاريخ تسجيل أو إدخال الطلبية' },
  { id: 'status1', label: 'حالة التأكيد', category: 'order', defaultSelected: false, description: 'حالة تأكيد الطلبية (مؤكد)' },

  // 4. المالية والأرباح
  { id: 'priceWithoutDelivery', label: 'سعر السلعة بدون شحن (د.ج)', category: 'finance', defaultSelected: false, isNumeric: true, description: 'ثمن السلعة المحسوب على الزبون دون الشحن' },
  { id: 'totalCharge', label: 'إجمالي المبلغ المحصل (د.ج)', category: 'finance', defaultSelected: false, isNumeric: true, description: 'المبلغ الإجمالي المدفوع عند الاستلام' },
  { id: 'netProfit', label: 'صافي الربح التقديري (د.ج)', category: 'finance', defaultSelected: false, isNumeric: true, description: 'صافي الفائدة بعد خصم تكلفة السلعة والشحن الحقيقي' },

  // 5. بيانات إدارية
  { id: 'sourceChannel', label: 'قناة البيع', category: 'admin', defaultSelected: false, description: 'مصدر الطلبية (المتجر، فيسبوك، تيك توك...)' },
  { id: 'confirmedBy', label: 'المؤكد / المسؤول', category: 'admin', defaultSelected: false, description: 'اسم الموظف أو المؤكد' },
  { id: 'tags', label: 'التاغات (Tags)', category: 'admin', defaultSelected: false, description: 'الوسوم والتاغات المسجلة على الطلبية' },
  { id: 'notes', label: 'ملاحظات الطلبية', category: 'admin', defaultSelected: false, description: 'أي ملاحظات مسجلة على الطلبية' },
];

const STORAGE_KEY = 'consignment_settlement_export_columns';

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  costs: { label: 'بيانات السلعة وتكلفة المورد', icon: Package, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  shipping: { label: 'بيانات الشحن والتوصيل (سعر الشحن الحقيقي)', icon: Truck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  order: { label: 'بيانات الطلبية والزبون', icon: User, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  finance: { label: 'المالية والتحصيل والأرباح', icon: DollarSign, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  admin: { label: 'بيانات إدارية وقنوات البيع', icon: Settings, color: 'text-slate-700 bg-slate-50 border-slate-200' },
};

interface ConsignmentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchedOrders: any[];
  selectedProduct?: InventoryProduct | null;
  selectedSupplier?: Supplier | null;
  settings?: SystemSettings | null;
  getOrderRelevantCost: (ao: any) => number;
  getOrderRelevantQty: (ao: any) => number;
  totalCost: number;
  totalQuantity: number;
  totalSalesRevenue: number;
}

export function ConsignmentExportModal({
  isOpen,
  onClose,
  matchedOrders,
  selectedProduct,
  selectedSupplier,
  settings,
  getOrderRelevantCost,
  getOrderRelevantQty,
  totalCost,
  totalQuantity,
  totalSalesRevenue,
}: ConsignmentExportModalProps) {
  // Load saved columns or fall back to defaultSelected
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate that all saved ids exist
          const validIds = parsed.filter(id => ALL_CONSIGNMENT_COLUMNS.some(c => c.id === id));
          if (validIds.length > 0) return validIds;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved consignment export columns:', e);
    }
    return ALL_CONSIGNMENT_COLUMNS.filter(c => c.defaultSelected).map(c => c.id);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'costs' | 'shipping' | 'order' | 'finance' | 'admin'>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Persist selections
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumnIds));
    } catch (e) {}
  }, [selectedColumnIds]);

  if (!isOpen) return null;

  // Toggle single column
  const toggleColumn = (id: string) => {
    setSelectedColumnIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast.error('يجب الإبقاء على عمود واحد على الأقل في ملف الإكسل');
          return prev;
        }
        return prev.filter(cId => cId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Toggle all columns in a category
  const toggleCategory = (catKey: string) => {
    const catCols = ALL_CONSIGNMENT_COLUMNS.filter(c => c.category === catKey).map(c => c.id);
    const allSelected = catCols.every(id => selectedColumnIds.includes(id));
    
    if (allSelected) {
      setSelectedColumnIds(prev => {
        const next = prev.filter(id => !catCols.includes(id));
        return next.length > 0 ? next : prev;
      });
    } else {
      setSelectedColumnIds(prev => Array.from(new Set([...prev, ...catCols])));
    }
  };

  // Preset Selection Handlers
  const handleApplyPreset = (type: 'all' | 'none' | 'default' | 'shipping' | 'supplier' | 'full_finance') => {
    switch (type) {
      case 'all':
        setSelectedColumnIds(ALL_CONSIGNMENT_COLUMNS.map(c => c.id));
        toast.success('تم تحديد جميع الأعمدة (25 عمود)');
        break;
      case 'none':
        // Keep at least productName
        setSelectedColumnIds(['productName']);
        toast.success('تم تفريغ الأعمدة');
        break;
      case 'default':
        setSelectedColumnIds(ALL_CONSIGNMENT_COLUMNS.filter(c => c.defaultSelected).map(c => c.id));
        toast.success('تمت استعادة الأعمدة الافتراضية');
        break;
      case 'shipping':
        setSelectedColumnIds(['productName', 'variation', 'orderId', 'tracking', 'deliveryCompany', 'realShipping', 'customerShipping', 'status2', 'deliveryDate', 'region', 'phone']);
        toast.success('تم تفعيل قالب الشحن والتوصيل وسعر الشحن الحقيقي');
        break;
      case 'supplier':
        setSelectedColumnIds(['supplierName', 'productName', 'variation', 'sku', 'quantity', 'unitCost', 'totalCost', 'orderId', 'orderDate']);
        toast.success('تم تفعيل قالب تكاليف المورد والسلع');
        break;
      case 'full_finance':
        setSelectedColumnIds(['productName', 'variation', 'quantity', 'unitCost', 'totalCost', 'realShipping', 'totalCharge', 'netProfit', 'orderId', 'tracking', 'deliveryCompany', 'region']);
        toast.success('تم تفعيل قالب التدقيق المالي والأرباح');
        break;
    }
  };

  // Filter columns by search query and category
  const filteredColumns = useMemo(() => {
    return ALL_CONSIGNMENT_COLUMNS.filter(col => {
      const matchSearch = !searchQuery || 
        col.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (col.description && col.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = activeCategoryFilter === 'all' || col.category === activeCategoryFilter;
      return matchSearch && matchCategory;
    });
  }, [searchQuery, activeCategoryFilter]);

  // Group columns by category for display
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ConsignmentExportColumn[]> = {};
    Object.keys(CATEGORY_MAP).forEach(k => {
      groups[k] = [];
    });
    filteredColumns.forEach(col => {
      if (!groups[col.category]) groups[col.category] = [];
      groups[col.category].push(col);
    });
    return groups;
  }, [filteredColumns]);

  // Total Real Shipping calculation for preview
  const totalRealShippingAmount = useMemo(() => {
    return matchedOrders.reduce((sum, ao) => {
      const o = ao.order;
      let ship = 0;
      if (o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null && !isNaN(Number(o.realDeliveryPrice)) && Number(o.realDeliveryPrice) > 0) {
        ship = Number(o.realDeliveryPrice);
      } else {
        ship = getEffectiveShippingCost(o, settings);
      }
      return sum + ship;
    }, 0);
  }, [matchedOrders, settings]);

  // The Master Export Execution Function
  const handleGenerateExcel = () => {
    if (!matchedOrders || matchedOrders.length === 0) {
      toast.error('لا توجد بيانات متاحة للتصدير');
      return;
    }

    if (selectedColumnIds.length === 0) {
      toast.error('يرجى تحديد عمود واحد على الأقل للتصدير');
      return;
    }

    setIsExporting(true);

    try {
      // Get ordered list of selected column definitions
      const activeColumns = ALL_CONSIGNMENT_COLUMNS.filter(c => selectedColumnIds.includes(c.id));
      const exportRows: any[] = [];

      matchedOrders.forEach(ao => {
        const o = ao.order;
        const dateStr = o.orderDate ? o.orderDate.split('T')[0] : '';
        const orderNum = o.orderId || o.id.slice(0, 8);
        const tracking = o.shippingTrackingId || o.trackingNumber || '-';
        
        // Calculate Real Shipping accurately
        let realShip = 0;
        if (o.realDeliveryPrice !== undefined && o.realDeliveryPrice !== null && !isNaN(Number(o.realDeliveryPrice)) && Number(o.realDeliveryPrice) > 0) {
          realShip = Number(o.realDeliveryPrice);
        } else {
          realShip = getEffectiveShippingCost(o, settings);
        }

        const customerShip = Number(o.deliveryPrice) || 0;
        const totalCharge = Number(o.totalCharge) || 0;
        const priceWithoutDelivery = Number(o.priceWithoutDelivery) || Math.max(0, totalCharge - customerShip);

        // Delivery date from history or fallback
        const delivDate = o.trackingHistory?.find((t: any) => t.status === 'مستلم')?.date?.split('T')[0] || 
          (o.status2 === 'مستلم' ? dateStr : '-');

        // Check if multi-variation order breakdown exists
        if (ao.costInfo.breakdown && ao.costInfo.breakdown.length > 1) {
          ao.costInfo.breakdown.forEach((item: any, itemIdx: number) => {
            const rowObj: Record<string, any> = {};
            const isFirstItem = itemIdx === 0;

            activeColumns.forEach(col => {
              switch (col.id) {
                // Costs
                case 'productName':
                  rowObj[col.label] = item.productName || selectedProduct?.name || 'غير محدد';
                  break;
                case 'variation':
                  rowObj[col.label] = item.variationName || `نوع ${itemIdx + 1}`;
                  break;
                case 'sku':
                  rowObj[col.label] = item.sku || selectedProduct?.sku || '-';
                  break;
                case 'quantity':
                  rowObj[col.label] = Number(item.quantity) || 1;
                  break;
                case 'unitCost':
                  rowObj[col.label] = Number(item.unitCost) || 0;
                  break;
                case 'totalCost':
                  rowObj[col.label] = Number(item.totalCost) || 0;
                  break;
                case 'supplierName':
                  rowObj[col.label] = selectedSupplier?.name || '-';
                  break;

                // Shipping
                case 'realShipping':
                  // Place order real shipping on the first line so sum matches actual total shipping
                  rowObj[col.label] = isFirstItem ? realShip : 0;
                  break;
                case 'customerShipping':
                  rowObj[col.label] = isFirstItem ? customerShip : 0;
                  break;
                case 'shippingDifference':
                  rowObj[col.label] = isFirstItem ? (customerShip - realShip) : 0;
                  break;
                case 'shippingMethod':
                  rowObj[col.label] = o.shippingMethod || '-';
                  break;
                case 'deliveryCompany':
                  rowObj[col.label] = o.deliveryCompany || '-';
                  break;
                case 'tracking':
                  rowObj[col.label] = tracking;
                  break;
                case 'status2':
                  rowObj[col.label] = o.status2 || 'مستلم';
                  break;
                case 'deliveryDate':
                  rowObj[col.label] = delivDate;
                  break;

                // Order
                case 'orderId':
                  rowObj[col.label] = orderNum;
                  break;
                case 'customerName':
                  rowObj[col.label] = o.fullName || '-';
                  break;
                case 'phone':
                  rowObj[col.label] = o.phone || '-';
                  break;
                case 'region':
                  rowObj[col.label] = o.region || '-';
                  break;
                case 'city':
                  rowObj[col.label] = o.city || o.stopdeskCommune || '-';
                  break;
                case 'address':
                  rowObj[col.label] = o.address || '-';
                  break;
                case 'orderDate':
                  rowObj[col.label] = dateStr;
                  break;
                case 'status1':
                  rowObj[col.label] = o.status1 || 'مؤكد';
                  break;

                // Finance
                case 'priceWithoutDelivery':
                  rowObj[col.label] = isFirstItem ? priceWithoutDelivery : 0;
                  break;
                case 'totalCharge':
                  rowObj[col.label] = isFirstItem ? totalCharge : 0;
                  break;
                case 'netProfit':
                  rowObj[col.label] = isFirstItem ? (totalCharge - (ao.costInfo.totalCogs || 0) - realShip) : 0;
                  break;

                // Admin
                case 'sourceChannel':
                  rowObj[col.label] = o.sourceChannel || '-';
                  break;
                case 'confirmedBy':
                  rowObj[col.label] = o.confirmedBy || '-';
                  break;
                case 'tags':
                  rowObj[col.label] = Array.isArray(o.tags) ? o.tags.map((t: any) => typeof t === 'string' ? t : t.name).join(', ') : (o.tag || '-');
                  break;
                case 'notes':
                  rowObj[col.label] = o.notes || '-';
                  break;

                default:
                  rowObj[col.label] = '-';
              }
            });

            exportRows.push(rowObj);
          });
        } else {
          // Single variation item
          const qty = ao.costInfo.calculatedQuantity || Number(o.qnts) || 1;
          const uCost = ao.costInfo.unitCost || 0;
          const lineTotalCost = ao.costInfo.totalCogs || (qty * uCost);
          const profit = totalCharge - lineTotalCost - realShip;

          const rowObj: Record<string, any> = {};

          activeColumns.forEach(col => {
            switch (col.id) {
              // Costs
              case 'productName':
                rowObj[col.label] = o.productName || selectedProduct?.name || 'غير محدد';
                break;
              case 'variation':
                rowObj[col.label] = ao.costInfo.recognizedVariation?.name || o.variation || '-';
                break;
              case 'sku':
                rowObj[col.label] = ao.costInfo.recognizedVariation?.sku || o.sku || selectedProduct?.sku || '-';
                break;
              case 'quantity':
                rowObj[col.label] = qty;
                break;
              case 'unitCost':
                rowObj[col.label] = uCost;
                break;
              case 'totalCost':
                rowObj[col.label] = lineTotalCost;
                break;
              case 'supplierName':
                rowObj[col.label] = selectedSupplier?.name || '-';
                break;

              // Shipping
              case 'realShipping':
                rowObj[col.label] = realShip;
                break;
              case 'customerShipping':
                rowObj[col.label] = customerShip;
                break;
              case 'shippingDifference':
                rowObj[col.label] = customerShip - realShip;
                break;
              case 'shippingMethod':
                rowObj[col.label] = o.shippingMethod || '-';
                break;
              case 'deliveryCompany':
                rowObj[col.label] = o.deliveryCompany || '-';
                break;
              case 'tracking':
                rowObj[col.label] = tracking;
                break;
              case 'status2':
                rowObj[col.label] = o.status2 || 'مستلم';
                break;
              case 'deliveryDate':
                rowObj[col.label] = delivDate;
                break;

              // Order
              case 'orderId':
                rowObj[col.label] = orderNum;
                break;
              case 'customerName':
                rowObj[col.label] = o.fullName || '-';
                break;
              case 'phone':
                rowObj[col.label] = o.phone || '-';
                break;
              case 'region':
                rowObj[col.label] = o.region || '-';
                break;
              case 'city':
                rowObj[col.label] = o.city || o.stopdeskCommune || '-';
                break;
              case 'address':
                rowObj[col.label] = o.address || '-';
                break;
              case 'orderDate':
                rowObj[col.label] = dateStr;
                break;
              case 'status1':
                rowObj[col.label] = o.status1 || 'مؤكد';
                break;

              // Finance
              case 'priceWithoutDelivery':
                rowObj[col.label] = priceWithoutDelivery;
                break;
              case 'totalCharge':
                rowObj[col.label] = totalCharge;
                break;
              case 'netProfit':
                rowObj[col.label] = profit;
                break;

              // Admin
              case 'sourceChannel':
                rowObj[col.label] = o.sourceChannel || '-';
                break;
              case 'confirmedBy':
                rowObj[col.label] = o.confirmedBy || '-';
                break;
              case 'tags':
                rowObj[col.label] = Array.isArray(o.tags) ? o.tags.map((t: any) => typeof t === 'string' ? t : t.name).join(', ') : (o.tag || '-');
                break;
              case 'notes':
                rowObj[col.label] = o.notes || '-';
                break;

              default:
                rowObj[col.label] = '-';
            }
          });

          exportRows.push(rowObj);
        }
      });

      // Calculate Sum Row (المجموع الكلي) for all active numeric columns
      const totalRow: Record<string, any> = {};
      activeColumns.forEach((col, idx) => {
        if (idx === 0) {
          totalRow[col.label] = 'المجموع الكلي';
        } else if (col.isNumeric && col.id !== 'unitCost') {
          const sum = exportRows.reduce((acc, row) => acc + (Number(row[col.label]) || 0), 0);
          totalRow[col.label] = Math.round(sum);
        } else {
          totalRow[col.label] = '';
        }
      });
      exportRows.push(totalRow);

      // Generate Workbook
      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Set Auto Column Widths
      const colWidths = activeColumns.map(col => {
        let maxLen = col.label.length;
        exportRows.forEach(row => {
          const val = row[col.label];
          if (val !== undefined && val !== null) {
            const strLen = String(val).length;
            if (strLen > maxLen) maxLen = strLen;
          }
        });
        return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
      });
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تسوية_الكريدي');

      const supplierNameSanitized = (selectedSupplier?.name || 'مورد').replace(/[\\/:*?"<>|]/g, '_');
      const prodNameSanitized = (selectedProduct?.name || 'منتج').replace(/[\\/:*?"<>|]/g, '_');
      const dateToday = new Date().toISOString().split('T')[0];
      const filename = `تسوية_الكريدي_${supplierNameSanitized}_${prodNameSanitized}_${dateToday}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast.success(`تم تصدير ملف الإكسل بنجاح (${exportRows.length - 1} سطر و ${activeColumns.length} عمود)! 📊✨`);
      onClose();
    } catch (err: any) {
      console.error('Error exporting consignment excel:', err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسل');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCount = selectedColumnIds.length;
  const totalAvailableCount = ALL_CONSIGNMENT_COLUMNS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-indigo-100 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shrink-0 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/40 text-indigo-300 border border-indigo-400/30 rounded-2xl shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  تخصيص أعمدة تصدير الإكسل (تسوية الكريدي)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {selectedCount} من {totalAvailableCount} عمود
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                حدد بالضبط الأعمدة التي ترغب في ظهورها بملف الإكسل بما فيها سعر الشحن الحقيقي، التكاليف، والأرباح.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Context Stats Summary */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200/80 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 font-bold block text-[10px]">الطلبيات المطابقة</span>
            <span className="text-slate-800 font-black text-sm">{matchedOrders.length} طلبية</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 font-bold block text-[10px]">القطع المحسوبة</span>
            <span className="text-slate-800 font-black text-sm">{totalQuantity} قطعة</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 font-bold block text-[10px]">تكلفة السلع (الدين)</span>
            <span className="text-rose-700 font-black text-sm">{totalCost.toLocaleString()} د.ج</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-400 font-bold block text-[10px] flex items-center gap-1">
              <span>سعر الشحن الحقيقي</span>
              <Truck className="w-3 h-3 text-blue-500" />
            </span>
            <span className="text-blue-700 font-black text-sm">{totalRealShippingAmount.toLocaleString()} د.ج</span>
          </div>
        </div>

        {/* Presets & Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white shrink-0 space-y-3">
          {/* Presets Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-xs font-black text-slate-700 ml-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              قوالب جاهزة:
            </span>

            <button
              type="button"
              onClick={() => handleApplyPreset('default')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              الافتراضي
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('shipping')}
              className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <Truck className="w-3 h-3 text-blue-600" />
              <span>الشحن والتوصيل الحقيقي</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('supplier')}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <Package className="w-3 h-3 text-amber-600" />
              <span>المورد وتكلفة السلع</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('full_finance')}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3 text-emerald-600" />
              <span>شامل تدقيق مالي وأرباح</span>
            </button>

            <div className="mr-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('all')}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
              >
                تحديد الكل ({totalAvailableCount})
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('none')}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن عمود (مثال: سعر الشحن الحقيقي، التكلفة، الهاتف...)"
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  activeCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل
              </button>
              {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategoryFilter(key as any)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                    activeCategoryFilter === key
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Columns Grid List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-slate-50/40">
          {Object.entries(groupedColumns).map(([catKey, cols]) => {
            if (cols.length === 0) return null;
            const cat = CATEGORY_MAP[catKey];
            const Icon = cat.icon;
            const selectedInCat = cols.filter(c => selectedColumnIds.includes(c.id)).length;
            const allCatSelected = selectedInCat === cols.length;

            return (
              <div key={catKey} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Category Header */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black text-slate-800">
                      {cat.label}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      {selectedInCat} / {cols.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCategory(catKey)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    {allCatSelected ? 'إلغاء تحديد هذه المجموعة' : 'تحديد المجموعة بالكامل'}
                  </button>
                </div>

                {/* Columns in Category */}
                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {cols.map((col) => {
                    const isSelected = selectedColumnIds.includes(col.id);
                    const isRealShipping = col.id === 'realShipping';

                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 relative ${
                          isSelected
                            ? isRealShipping
                              ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/50 shadow-2xs'
                              : 'bg-indigo-50/50 border-indigo-200 shadow-2xs'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">
                          {isSelected ? (
                            <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white"></div>
                          )}
                        </div>

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-black truncate ${
                              isSelected ? 'text-slate-900' : 'text-slate-600'
                            }`}>
                              {col.label}
                            </span>
                            {isRealShipping && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                شحن حقيقي 🚚
                              </span>
                            )}
                            {col.isNumeric && col.id !== 'unitCost' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                يجمع تلقائياً ∑
                              </span>
                            )}
                          </div>

                          {col.description && (
                            <p className="text-[10px] text-slate-400 font-medium leading-tight">
                              {col.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredColumns.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">لا توجد أعمدة تطابق بحثك "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              سيتم تصدير <strong className="text-slate-900 font-black">{matchedOrders.length}</strong> طلبية مستلمة مع <strong className="text-indigo-600 font-black">{selectedCount}</strong> عمود تم اختياره.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors flex-1 sm:flex-none cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleGenerateExcel}
              disabled={isExporting || selectedCount === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-all flex-1 sm:flex-none cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'جاري إنشاء الملف...' : `تحميل وتصدير الإكسل (${selectedCount} عمود)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
