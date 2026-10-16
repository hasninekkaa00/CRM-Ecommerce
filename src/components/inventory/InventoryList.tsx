import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { 
  Package, RefreshCw, AlertTriangle, Search, Tag, Box, Layers, 
  ShoppingBag, TrendingDown, CheckCircle, BarChart3, Plus, Minus, 
  Check, Edit2, LayoutGrid, List, Undo2, X, Calculator, History, 
  ChevronDown, ChevronUp, Trash2, Truck, AlertCircle, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SourceChannelBadge } from '../../utils/channelUtils';
import { InventoryProductModal } from './InventoryProductModal';
import { ReturnedOrdersModal } from './ReturnedOrdersModal';
import { ProductStockManagementModal } from './ProductStockManagementModal';
import { calculateDynamicStock, calculateReturnedStock, calculateShippedStock } from '../../utils/inventoryCalc';
import { checkProductMatch } from '../../utils/productFilters';
import { getProductDisplayPrice, getProductDisplayCost } from '../../utils/productCostUtils';
import { DeficitListModal } from './DeficitListModal';
import { InventoryAuditModal } from './InventoryAuditModal';
import { InventoryLogModal } from './InventoryLogModal';
import { QuickStockAdjustModal } from './QuickStockAdjustModal';
import { universalSyncWooCommerceProducts, universalSyncWooCommerceSingleProduct } from '../../utils/universalWooCommerceApi';
import { checkProductDeletionIntegrity, IntegrityCheckResult } from '../../utils/dataIntegrity';
import { IntegrityProtectionModal } from '../common/IntegrityProtectionModal';
import { TablePagination } from '../common/TablePagination';

export function InventoryList() {
  const { 
    inventoryProducts, bulkUpsertInventory, deleteInventoryProduct,
    orders, purchaseInvoices, salesChannels, settings, updateSettings,
    globalProductFilter
  } = useStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeficitAlertDismissed, setIsDeficitAlertDismissed] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showQuickAdjustModal, setShowQuickAdjustModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<number>(0);
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);
  const [managingStockProduct, setManagingStockProduct] = useState<{ product: any; varId?: string } | null>(null);
  const [viewingReturnedProducts, setViewingReturnedProducts] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => (localStorage.getItem('inventory_viewMode') as any) || 'table');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out' | 'shipped' | 'deficit'>(() => (localStorage.getItem('inventory_stockFilter') as any) || 'all');
  
  // Expand/collapse product variations in table
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Product Deletion Confirmation Modal
  const [deletingProduct, setDeletingProduct] = useState<any | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [integrityBlockResult, setIntegrityBlockResult] = useState<IntegrityCheckResult | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);

  // Modals state
  const [showDeficitModal, setShowDeficitModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New product form
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductQty, setNewProductQty] = useState<number>(0);
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductChannel, setNewProductChannel] = useState('');

  useEffect(() => {
    localStorage.setItem('inventory_viewMode', viewMode);
    localStorage.setItem('inventory_stockFilter', stockFilter);
  }, [viewMode, stockFilter]);

  useEffect(() => {
    const handleFilterEvent = (e: any) => {
      if (e.detail?.searchTerm) {
        setSearchTerm(e.detail.searchTerm);
      }
      if (e.detail?.stockFilter) {
        setStockFilter(e.detail.stockFilter);
      }
    };
    document.addEventListener('filter-inventory', handleFilterEvent);
    return () => document.removeEventListener('filter-inventory', handleFilterEvent);
  }, []);

  const products = inventoryProducts || [];

  const toggleExpand = (id: string) => {
    setExpandedProductIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddProduct = () => {
    if (!newProductName.trim()) {
      toast.error("يرجى إدخال اسم المنتج");
      return;
    }
    if (!newProductSku.trim()) {
      toast.error("يرجى إدخال رمز SKU");
      return;
    }

    const skuExists = products.some((p: any) => 
      (p.sku && p.sku.trim().toLowerCase() === newProductSku.trim().toLowerCase()) ||
      (p.variations && p.variations.some((v: any) => v.sku && v.sku.trim().toLowerCase() === newProductSku.trim().toLowerCase()))
    );

    if (skuExists) {
      toast.error("رمز SKU هذا مستخدم بالفعل لمنتج آخر في المخزن!");
      return;
    }

    const newProduct = {
      id: `local_${Date.now()}`,
      name: newProductName,
      sku: newProductSku,
      stock_quantity: Number(newProductQty) || 0,
      manage_stock: true,
      local_stock_quantity: Number(newProductQty) || 0,
      local_manage_stock: true,
      price: newProductPrice || '0',
      local_price: newProductPrice || '0',
      local_cost: Number(newProductCost) || 0,
      channelName: newProductChannel || 'طلب يدوي / مباشر',
      images: []
    };

    bulkUpsertInventory([newProduct]);
    toast.success("تمت إضافة المنتج بنجاح إلى المخزن");
    
    setNewProductName('');
    setNewProductSku('');
    setNewProductQty(0);
    setNewProductPrice('');
    setNewProductCost('');
    setNewProductChannel('');
    setShowAddModal(false);
  };

  const handleInitiateDeleteProduct = (product: any) => {
    const check = checkProductDeletionIntegrity(product, {
      orders,
      purchaseInvoices,
      settings
    });

    if (!check.canDelete) {
      setIntegrityBlockResult(check);
      setShowIntegrityModal(true);
      return;
    }

    setDeletingProduct(product);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeletingProduct(true);
    try {
      await deleteInventoryProduct(deletingProduct.id);
      toast.success('تم حذف المنتج بنجاح من المخزن');
      setDeletingProduct(null);
    } catch (e: any) {
      if (e?.name === 'DataIntegrityError') {
        setDeletingProduct(null);
        setIntegrityBlockResult({
          canDelete: false,
          title: e.title || 'عملية محظورة لحماية تماسك البيانات',
          reason: e.message,
          details: e.details || [],
          suggestions: e.suggestions || []
        });
        setShowIntegrityModal(true);
      } else {
        toast.error('حدث خطأ أثناء حذف المنتج');
      }
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const [syncingProductId, setSyncingProductId] = useState<string | null>(null);

  const handleSyncSingleProduct = async (product: any) => {
    if (product.channelType === 'manual' || (typeof product.id === 'string' && product.id.includes('-'))) {
      toast.error('هذا المنتج محلي ولا يمكن مزامنته مع WooCommerce.');
      return;
    }
    const wooChannels = salesChannels.filter(c => c.type === 'woocommerce');
    if (wooChannels.length === 0) {
      toast.error('لا يوجد متاجر WooCommerce مضافة.');
      return;
    }

    setSyncingProductId(product.id);
    try {
      let data = null;
      let successfulChannel = null;

      // Prioritize the known channel if available
      const knownChannel = wooChannels.find(c => c.name === product.channelName);
      let channelsToTry = knownChannel ? [knownChannel, ...wooChannels.filter(c => c !== knownChannel)] : wooChannels;

      for (const channel of channelsToTry) {
        if (!channel.config?.storeUrl || !channel.config?.consumerKey || !channel.config?.consumerSecret) continue;

        const result = await universalSyncWooCommerceSingleProduct({
          storeUrl: channel.config.storeUrl,
          consumerKey: channel.config.consumerKey,
          consumerSecret: channel.config.consumerSecret,
          productId: product.id
        });

        if (result.success && result.product) {
          data = result;
          successfulChannel = channel;
          break; // Stop trying other channels once found
        }
      }

      if (data && data.success && data.product && successfulChannel) {
        const syncedProduct = data.product;
        const existing = inventoryProducts.find(p => p.id === product.id) || product;
        
        // Check for NEW variations from WooCommerce that do not exist yet in existing.variations
        const existingVarIds = new Set(
          (existing.variations || []).map((v: any) => String(v.id || '').trim().toLowerCase()).filter(Boolean)
        );
        const existingVarSkus = new Set(
          (existing.variations || []).map((v: any) => String(v.sku || '').trim().toLowerCase()).filter(Boolean)
        );
        const existingVarNames = new Set(
          (existing.variations || []).map((v: any) => String(v.name || '').trim().toLowerCase()).filter(Boolean)
        );

        const brandNewVariations = (syncedProduct.variations || []).filter((v: any) => {
          const vId = String(v.id || '').trim().toLowerCase();
          const vSku = String(v.sku || '').trim().toLowerCase();
          const vName = String(v.name || v.attributes?.map((a: any) => a.option).join(' - ') || '').trim().toLowerCase();

          if (vId && existingVarIds.has(vId)) return false;
          if (vSku && existingVarSkus.has(vSku)) return false;
          if (vName && existingVarNames.has(vName)) return false;
          return true;
        }).map((v: any, idx: number) => {
          const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' 
            ? parseFloat(String(v.weight).replace(/,/g, '.')) 
            : undefined;
          const vWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : existing.weight;
          const vCost = v.local_cost !== undefined && !isNaN(Number(v.local_cost)) && Number(v.local_cost) > 0 
            ? Number(v.local_cost) 
            : (existing.local_cost !== undefined ? Number(existing.local_cost) : undefined);

          return {
            id: String(v.id || `${existing.id}-VAR-${(existing.variations?.length || 0) + idx + 1}`),
            name: v.name || v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع جديد ${idx + 1}`,
            sku: v.sku || `${existing.sku || existing.id}-VAR-${v.id || idx + 1}`,
            price: v.price || existing.price,
            regular_price: v.regular_price || existing.regular_price,
            sale_price: v.sale_price || existing.sale_price,
            stock_quantity: v.stock_quantity ?? 0,
            local_stock_quantity: v.stock_quantity ?? 0,
            stock_status: v.stock_status || 'instock',
            attributes: v.attributes || [],
            weight: vWeight,
            local_cost: vCost
          };
        });

        if (brandNewVariations.length > 0) {
          const updatedProduct = {
            ...existing,
            variations: [...(existing.variations || []), ...brandNewVariations]
          };
          await bulkUpsertInventory([updatedProduct]);
          toast.success(`تمت إضافة ${brandNewVariations.length} متغير جديد للمنتج مع الحفاظ التام على التكلفة والوزن.`);
        } else {
          toast('هذا المنتج وجميع متغيراته مضافة مسبقاً، تم الحفاظ على التكلفة والوزن دون تغيير.', {
            icon: '🔒'
          });
        }
      } else {
        toast.error('فشل مزامنة المنتج. تأكد أن المنتج متوفر على المتجر وأن الاتصال يعمل.');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setSyncingProductId(null);
    }
  };

  // Import products from WooCommerce - Only add new products and new variants, never overwrite existing costs/weights/data
  const handleSync = async () => {
    const wooChannels = salesChannels.filter(c => c.type === 'woocommerce');
    if (wooChannels.length === 0) {
      toast.error('لا يوجد متاجر WooCommerce مضافة. يرجى إضافتها من قسم قنوات البيع أولاً.');
      return;
    }

    setIsSyncing(true);
    let productsToUpsert: any[] = [];
    let newProductsCount = 0;
    let newVariationsCount = 0;
    
    try {
      for (const channel of wooChannels) {
        if (!channel.config?.storeUrl || !channel.config?.consumerKey || !channel.config?.consumerSecret) continue;
        
        const data = await universalSyncWooCommerceProducts({
          storeUrl: channel.config.storeUrl,
          consumerKey: channel.config.consumerKey,
          consumerSecret: channel.config.consumerSecret
        });
        
        if (data.success && data.products) {
          data.products.forEach((p: any) => {
            const hasVariations = p.variations && p.variations.length > 0;
            if (hasVariations) {
              p.variations.forEach((v: any, idx: number) => {
                if (!v.sku) v.sku = `${p.sku || p.id}-VAR-${v.id || idx + 1}`;
              });
            } else if (!p.sku) {
              p.sku = `SKU-${p.id}`;
            }

            const existingProduct = inventoryProducts.find(ip => {
              if (ip.id === `${channel.id}_${p.id}` || ip.id === String(p.id)) return true;
              if (p.sku && ip.sku && ip.sku.trim().toLowerCase() === p.sku.trim().toLowerCase()) return true;
              if (p.name && ip.name && ip.name.trim().toLowerCase() === p.name.trim().toLowerCase()) return true;
              return false;
            });

            if (existingProduct) {
              // 1. Existing Product: NEVER alter existing cost, weight, prices, stock, or existing variations!
              // Only check if WooCommerce has NEW variants that do not exist yet in existingProduct.variations
              if (hasVariations) {
                const existingVarIds = new Set(
                  (existingProduct.variations || []).map((v: any) => String(v.id || '').trim().toLowerCase()).filter(Boolean)
                );
                const existingVarSkus = new Set(
                  (existingProduct.variations || []).map((v: any) => String(v.sku || '').trim().toLowerCase()).filter(Boolean)
                );
                const existingVarNames = new Set(
                  (existingProduct.variations || []).map((v: any) => String(v.name || '').trim().toLowerCase()).filter(Boolean)
                );

                const brandNewVariations = p.variations.filter((v: any) => {
                  const vId = String(v.id || '').trim().toLowerCase();
                  const vSku = String(v.sku || '').trim().toLowerCase();
                  const vName = String(v.name || v.attributes?.map((a: any) => a.option).join(' - ') || '').trim().toLowerCase();

                  if (vId && existingVarIds.has(vId)) return false;
                  if (vSku && existingVarSkus.has(vSku)) return false;
                  if (vName && existingVarNames.has(vName)) return false;
                  return true;
                }).map((v: any, idx: number) => {
                  const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' 
                    ? parseFloat(String(v.weight).replace(/,/g, '.')) 
                    : undefined;
                  const vWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : existingProduct.weight;
                  const vCost = v.local_cost !== undefined && !isNaN(Number(v.local_cost)) && Number(v.local_cost) > 0 
                    ? Number(v.local_cost) 
                    : (existingProduct.local_cost !== undefined ? Number(existingProduct.local_cost) : undefined);

                  return {
                    id: String(v.id || `${existingProduct.id}-VAR-${(existingProduct.variations?.length || 0) + idx + 1}`),
                    name: v.name || v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع جديد ${idx + 1}`,
                    sku: v.sku || `${existingProduct.sku || existingProduct.id}-VAR-${v.id || idx + 1}`,
                    price: v.price || existingProduct.price,
                    regular_price: v.regular_price || existingProduct.regular_price,
                    sale_price: v.sale_price || existingProduct.sale_price,
                    stock_quantity: v.stock_quantity ?? 0,
                    local_stock_quantity: v.stock_quantity ?? 0,
                    stock_status: v.stock_status || 'instock',
                    attributes: v.attributes || [],
                    weight: vWeight,
                    local_cost: vCost
                  };
                });

                if (brandNewVariations.length > 0) {
                  // Only append new variants, keeping EVERYTHING else on the product completely untouched!
                  productsToUpsert.push({
                    ...existingProduct,
                    variations: [...(existingProduct.variations || []), ...brandNewVariations]
                  });
                  newVariationsCount += brandNewVariations.length;
                }
              }
              // If no new variations, do NOT touch existingProduct at all!
            } else {
              // 2. Completely NEW Product: Add to catalog with full weight & cost if available
              const rawWeight = p.weight !== undefined && p.weight !== null && p.weight !== '' 
                ? parseFloat(String(p.weight).replace(/,/g, '.')) 
                : undefined;
              const pWeight = typeof rawWeight === 'number' && !isNaN(rawWeight) ? rawWeight : undefined;
              const pCost = p.local_cost !== undefined && !isNaN(Number(p.local_cost)) && Number(p.local_cost) > 0 
                ? Number(p.local_cost) 
                : undefined;

              const newProduct = {
                id: `${channel.id}_${p.id}`,
                name: p.name,
                sku: p.sku || `SKU-${p.id}`,
                price: p.price ? String(p.price) : undefined,
                regular_price: p.regular_price ? String(p.regular_price) : undefined,
                sale_price: p.sale_price ? String(p.sale_price) : undefined,
                stock_quantity: p.stock_quantity ?? 0,
                local_stock_quantity: p.stock_quantity ?? 0,
                local_manage_stock: true,
                stock_status: p.stock_status || 'instock',
                images: p.images && p.images.length > 0 ? p.images : (p.image ? [{ src: p.image }] : []),
                type: p.type || (hasVariations ? 'variable' : 'simple'),
                weight: pWeight,
                local_cost: pCost,
                channelId: channel.id,
                channelName: channel.name,
                channelType: 'woocommerce',
                variations: (p.variations || []).map((v: any, idx: number) => {
                  const rawVWeight = v.weight !== undefined && v.weight !== null && v.weight !== '' 
                    ? parseFloat(String(v.weight).replace(/,/g, '.')) 
                    : undefined;
                  const vWeight = typeof rawVWeight === 'number' && !isNaN(rawVWeight) ? rawVWeight : pWeight;
                  const vCost = v.local_cost !== undefined && !isNaN(Number(v.local_cost)) && Number(v.local_cost) > 0 
                    ? Number(v.local_cost) 
                    : pCost;

                  return {
                    id: String(v.id || `${p.id}-VAR-${idx + 1}`),
                    name: v.name || v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع ${idx + 1}`,
                    sku: v.sku || `${p.sku || p.id}-VAR-${v.id || idx + 1}`,
                    price: v.price || p.price,
                    regular_price: v.regular_price || p.regular_price,
                    sale_price: v.sale_price || p.sale_price,
                    stock_quantity: v.stock_quantity ?? 0,
                    local_stock_quantity: v.stock_quantity ?? 0,
                    stock_status: v.stock_status || 'instock',
                    attributes: v.attributes || [],
                    weight: vWeight,
                    local_cost: vCost
                  };
                })
              };

              productsToUpsert.push(newProduct);
              newProductsCount++;
            }
          });
        }
      }

      if (productsToUpsert.length > 0) {
        await bulkUpsertInventory(productsToUpsert);
        if (newProductsCount > 0 && newVariationsCount > 0) {
          toast.success(`تم استيراد ${newProductsCount} منتج جديد وإضافة ${newVariationsCount} متغير جديد! تم الحفاظ الكامل على تكلفة ووزن المنتجات السابقة.`);
        } else if (newProductsCount > 0) {
          toast.success(`تم استيراد ${newProductsCount} منتج جديد بنجاح! لم يتم المساس بأي من المنتجات السابقة.`);
        } else {
          toast.success(`تمت إضافة ${newVariationsCount} متغير جديد للمنتجات! التكاليف والأوزان الحالية محفوظة بالكامل.`);
        }
      } else {
        toast('جميع المنتجات والمتغيرات موجودة بالفعل، وتم الحفاظ على تكاليف وأوزان كافة المنتجات دون تغيير.', {
          icon: '🔒'
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء استيراد المنتجات');
    } finally {
      setIsSyncing(false);
    }
  };

  const getProductDisplayData = (product: any) => {
    const isLocal = settings?.inventoryManagementMode === 'local';
    let totalQty = 0;
    let totalShipped = 0;
    let hasVariations = Array.isArray(product.variations) && product.variations.length > 0;
    
    const isOfferFallback = hasVariations && product.variations.some((v: any) => 
      v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))
    );
    const isOffer = product.local_is_offers !== undefined ? product.local_is_offers : isOfferFallback;

    if (hasVariations && !isOffer) {
      product.variations.forEach((v: any) => {
        const vQty = calculateDynamicStock(v, false, product, purchaseInvoices, orders);
        const vShipped = calculateShippedStock(v, false, product, orders);
        totalQty += vQty;
        totalShipped += vShipped;
      });
    } else {
      totalQty = calculateDynamicStock(product, true, product, purchaseInvoices, orders);
      totalShipped = calculateShippedStock(product, true, product, orders);
    }

    return { 
      qty: totalQty,
      shippedQty: totalShipped,
      hasVariations: hasVariations && !isOffer,
      variationCount: hasVariations ? product.variations.length : 0
    };
  };

  const getStockStatusInfo = (product: any) => {
    const { qty } = getProductDisplayData(product);
    const threshold = settings?.lowInventoryThreshold || 5;
    
    if (qty < 0) {
      return { label: 'عجز بالرصيد', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertTriangle, status: 'deficit' };
    }
    if (qty === 0) {
      return { label: 'نفد المخزون', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, status: 'out' };
    }
    if (qty <= threshold) {
      return { label: 'مخزون منخفض', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: TrendingDown, status: 'low' };
    }
    return { label: 'متوفر بالرصيد', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, status: 'in' };
  };

  // High level Statistics
  const stats = useMemo(() => {
    let totalAvailableStock = 0;
    let totalShippedStock = 0;
    let totalVariationsCount = 0;
    let lowCount = 0;
    let outCount = 0;
    let deficitCount = 0;

    products.forEach(p => {
      const data = getProductDisplayData(p);
      totalAvailableStock += data.qty;
      totalShippedStock += data.shippedQty;
      if (p.variations) totalVariationsCount += p.variations.length;

      const info = getStockStatusInfo(p);
      if (info.status === 'low') lowCount++;
      if (info.status === 'out') outCount++;
      if (info.status === 'deficit') deficitCount++;
    });

    return {
      totalProducts: products.length,
      totalVariations: totalVariationsCount,
      totalAvailableStock,
      totalShippedStock,
      lowCount,
      outCount,
      deficitCount
    };
  }, [products, orders, purchaseInvoices, settings]);

  const deficitProducts = useMemo(() => {
    return products.filter(p => getStockStatusInfo(p).status === 'deficit');
  }, [products, orders, purchaseInvoices]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = p.name?.toLowerCase().includes(q);
      const skuMatch = p.sku?.toLowerCase().includes(q);
      const varMatch = p.variations?.some((v: any) => 
        v.sku?.toLowerCase().includes(q) || 
        v.attributes?.some((a: any) => a.option?.toLowerCase().includes(q))
      );
      
      const matchesSearch = !q || nameMatch || skuMatch || varMatch;
      if (!matchesSearch) return false;

      if (globalProductFilter && globalProductFilter !== 'all') {
        const matchesGlobal = checkProductMatch(p.sku, globalProductFilter, inventoryProducts || []) ||
          p.variations?.some((v: any) => checkProductMatch(v.sku, globalProductFilter, inventoryProducts || []));
        if (!matchesGlobal) return false;
      }

      const info = getStockStatusInfo(p);
      const data = getProductDisplayData(p);

      if (stockFilter === 'all') return true;
      if (stockFilter === 'in') return info.status === 'in';
      if (stockFilter === 'low') return info.status === 'low';
      if (stockFilter === 'out') return info.status === 'out';
      if (stockFilter === 'deficit') return info.status === 'deficit';
      if (stockFilter === 'shipped') return data.shippedQty > 0;

      return true;
    });
  }, [products, searchTerm, stockFilter, orders, purchaseInvoices, globalProductFilter, inventoryProducts]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('inventory_pageSize');
    return saved ? Number(saved) : 25;
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('inventory_pageSize', String(newSize));
    setCurrentPage(1);
  };

  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stockFilter, globalProductFilter]);

  return (
    <div className="p-4 md:p-8 space-y-6 flex flex-col min-h-full bg-slate-50/60" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Package className="w-6 h-6" />
            </div>
            المخزن السهل والمرتب
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-2">
            <span>تتبع المنتجات والأنواع، وخصم الطلبيات في حالة (تم الشحن) تلقائياً</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              onClick={() => updateSettings({ inventoryManagementMode: 'local' })}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                settings?.inventoryManagementMode === 'local' 
                  ? 'bg-white text-indigo-700 shadow-sm font-black' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              مخزن التطبيق (محلي)
            </button>
            <button
              onClick={() => updateSettings({ inventoryManagementMode: 'sync' })}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                settings?.inventoryManagementMode !== 'local' 
                  ? 'bg-white text-indigo-700 shadow-sm font-black' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
              مخزن متزامن (المتجر)
            </button>
          </div>

          <button 
            onClick={() => setShowLogModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-indigo-600" />
            سجل الحركات
          </button>

          <button 
            onClick={() => setShowAuditModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            الجرد والتدقيق
          </button>

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            منتج جديد
          </button>

          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'جاري الاستيراد...' : 'استيراد المنتجات'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        
        {/* Total Products & Variations */}
        <div 
          onClick={() => setStockFilter('all')}
          className={`bg-white p-5 rounded-3xl border shadow-sm transition-all cursor-pointer flex items-center gap-4 ${
            stockFilter === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">إجمالي المنتجات والأنواع</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalProducts}</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                +{stats.totalVariations} أنواع
              </span>
            </div>
          </div>
        </div>

        {/* Total Available Warehouse Stock */}
        <div 
          onClick={() => setStockFilter('in')}
          className={`bg-white p-5 rounded-3xl border shadow-sm transition-all cursor-pointer flex items-center gap-4 ${
            stockFilter === 'in' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">المتوفر بالمستودع</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-emerald-700">{stats.totalAvailableStock}</span>
              <span className="text-xs font-bold text-slate-500">قطعة</span>
            </div>
          </div>
        </div>

        {/* Shipped Stock ("تم الشحن") */}
        <div 
          onClick={() => setStockFilter('shipped')}
          className={`bg-white p-5 rounded-3xl border shadow-sm transition-all cursor-pointer flex items-center gap-4 ${
            stockFilter === 'shipped' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-100 hover:border-slate-200'
          }`}
          title="خصم أوتوماتيكي: الطلبيات التي في حالة تم الشحن يتم خصمها من الرصيد، وتلغى الخصم عند الإلغاء"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">في حالة (تم الشحن)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-amber-700">{stats.totalShippedStock}</span>
              <span className="text-xs font-bold text-slate-500">طرد محجوز</span>
            </div>
          </div>
        </div>

        {/* Deficit / Low Stock */}
        <div 
          onClick={() => {
            if (stats.deficitCount > 0) setShowDeficitModal(true);
            else setStockFilter('low');
          }}
          className={`bg-white p-5 rounded-3xl border shadow-sm transition-all cursor-pointer flex items-center gap-4 ${
            stats.deficitCount > 0 ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
            stats.deficitCount > 0 ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">العجز والمخزون المنخفض</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              {stats.deficitCount > 0 ? (
                <span className="text-xl font-black text-rose-600">{stats.deficitCount} عجز</span>
              ) : (
                <span className="text-xl font-black text-slate-800">{stats.lowCount} منخفض</span>
              )}
              {stats.outCount > 0 && <span className="text-xs font-bold text-red-600">({stats.outCount} نفد)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Deficit Alert Banner */}
      {!isDeficitAlertDismissed && stats.deficitCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-sm font-black text-rose-900">يوجد عجز في رصيد {stats.deficitCount} منتج/تفرع!</h4>
              <p className="text-xs font-bold text-rose-700 mt-0.5">تم شحن أو تمرير طلبات بكمية أكبر من المتوفر. اضغط للاطلاع وتغطية العجز.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowDeficitModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              عرض قائم العجز
            </button>
            <button 
              onClick={() => setIsDeficitAlertDismissed(true)}
              className="p-2 text-rose-400 hover:text-rose-700 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar: Search & Filters */}
      <div className="bg-white p-3 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="ابحث باسم المنتج، رمز SKU، أبعاد التفرع، أو المتجر..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'in', label: 'متوفر' },
            { key: 'low', label: 'منخفض' },
            { key: 'shipped', label: 'في الشحن' },
            { key: 'deficit', label: 'عجز' },
            { key: 'out', label: 'نفد' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStockFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                stockFilter === f.key 
                  ? 'bg-indigo-600 text-white shadow-sm font-black' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="عرض جدول"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="عرض بطاقات"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Display Container */}
      <div className="flex-1">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">لم يتم العثور على أي منتجات مطابقة</h3>
            <p className="text-xs text-slate-500 font-bold max-w-md">جرب تغيير كلمات البحث أو الفلتر المختار، أو قم بإضافة منتج جديد يدوياً.</p>
          </div>
        ) : viewMode === 'table' ? (
          
          /* Table View */
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
                    <th className="px-5 py-4 w-12"></th>
                    <th className="px-5 py-4">المنتج و SKU</th>
                    <th className="px-5 py-4">أنواع وعروض</th>
                    <th className="px-5 py-4">السعر والتكلفة</th>
                    <th className="px-5 py-4 text-center">المتوفر بالمستودع</th>
                    <th className="px-5 py-4 text-center">في حالة (تم الشحن)</th>
                    <th className="px-5 py-4 text-center">الحالة</th>
                    <th className="px-5 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map((product) => {
                    const statusInfo = getStockStatusInfo(product);
                    const data = getProductDisplayData(product);
                    const isExpanded = !!expandedProductIds[product.id];
                    const hasVars = data.hasVariations;

                    return (
                      <React.Fragment key={product.id}>
                        <tr className="hover:bg-slate-50/60 transition-colors group">
                          
                          {/* Expand Button */}
                          <td className="px-4 py-4 text-center">
                            {hasVars ? (
                              <button
                                onClick={() => toggleExpand(product.id)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                title={isExpanded ? "طَي التفاصيل" : "عرض الأنواع والعروض"}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            ) : null}
                          </td>

                          {/* Product Info */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                                  <Package className="w-6 h-6" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-black text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                                  {product.shippingAliasName && (product.useShippingAlias !== false) && (
                                    <span className="inline-flex items-center shrink-0 whitespace-nowrap text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md" title="الاسم المستعار لشركات الشحن">
                                      🏷️ مستعار: {product.shippingAliasName}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="inline-flex items-center shrink-0 whitespace-nowrap font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    SKU: {product.sku || 'N/A'}
                                  </span>
                                  <SourceChannelBadge 
                                    order={{ sourceChannel: product.channelName || 'طلب يدوي / مباشر' }} 
                                    size="xs" 
                                    configuredSalesChannels={salesChannels} 
                                  />
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Variations Badge */}
                          <td className="px-5 py-4 font-bold text-slate-700">
                            {hasVars ? (
                              <button
                                onClick={() => toggleExpand(product.id)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl border border-purple-100 font-bold text-xs flex items-center gap-1 transition-colors"
                              >
                                <span>{data.variationCount} أنواع/عروض</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <span className="text-slate-400 font-normal">منتج بسيط</span>
                            )}
                          </td>

                          {/* Price & Cost */}
                          <td className="px-5 py-4">
                            <div className="font-black text-slate-900 text-xs">
                              {getProductDisplayPrice(product)}
                            </div>
                            {getProductDisplayCost(product) !== '—' ? (
                              <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                                التكلفة: {getProductDisplayCost(product)}
                              </div>
                            ) : null}
                          </td>

                          {/* Available Warehouse Stock */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-xl font-black text-sm border ${
                              data.qty < 0 
                                ? 'bg-rose-100 text-rose-800 border-rose-200' 
                                : data.qty === 0 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {data.qty} قطعة
                            </span>
                          </td>

                          {/* Shipped Stock ("تم الشحن") */}
                          <td className="px-5 py-4 text-center">
                            {data.shippedQty > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl font-black text-xs">
                                <Truck className="w-3.5 h-3.5 text-amber-600" />
                                {data.shippedQty} طرد
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">0</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${statusInfo.color}`}>
                              <statusInfo.icon className="w-3.5 h-3.5" />
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setManagingStockProduct({ product })}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1"
                                title="إدارة حركة المخزن (إضافة / سحب / تسوية)"
                              >
                                <Package className="w-3.5 h-3.5" />
                                إدارة المخزن
                              </button>

                              <button
                                onClick={() => setViewingReturnedProducts(product)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors"
                                title="المرتجعات العالقة (روتور) لإعادة الإدخال للمخزن"
                              >
                                <Undo2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setViewingProduct(product)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                                title="تعديل تفاصيل المنتج"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {!(product.channelType === 'manual' || (typeof product.id === 'string' && product.id.includes('-'))) && (
                              <button
                                onClick={() => handleSyncSingleProduct(product)}
                                disabled={syncingProductId === product.id}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
                                title="مزامنة المنتج لإحضار الأنواع الجديدة"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncingProductId === product.id ? 'animate-spin' : ''}`} />
                              </button>
                              )}
                              
                              <button
                                onClick={() => handleInitiateDeleteProduct(product)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                title="حذف المنتج من المخزن"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Variations / Offers Sub-table */}
                        {hasVars && isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={8} className="p-4 pr-12">
                              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-inner space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <h4 className="font-black text-slate-900 text-xs flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-indigo-600" />
                                    أنواع وعروض منتج: {product.name}
                                  </h4>
                                  <span className="text-[11px] text-slate-500 font-bold">
                                    إجمالي الأنواع: {product.variations.length}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {product.variations.map((v: any, idx: number) => {
                                    const vName = v.name || v.attributes?.map((a: any) => a.option).join(' • ') || `تفرع ${idx + 1}`;
                                    const vStock = calculateDynamicStock(v, false, product, purchaseInvoices, orders);
                                    const vShipped = calculateShippedStock(v, false, product, orders);
                                    const vPrice = v.local_price || v.price || v.regular_price || product.local_price || product.price || '0';
                                    const vCostVal = v.local_cost ?? v.cost ?? product.local_cost ?? product.cost;

                                    return (
                                      <div key={v.id || idx} className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3 text-xs">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-extrabold text-slate-900 shrink-0">{vName}</span>
                                              <span className="inline-flex items-center shrink-0 whitespace-nowrap font-mono text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                                                SKU: {v.sku || v.local_sku || (product.sku ? `${product.sku}-${idx + 1}` : 'غير محدد')}
                                              </span>
                                              {v.shippingAliasName && (
                                                <span className="inline-flex items-center shrink-0 whitespace-nowrap bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md text-[10px] font-bold" title="التسمية المستعارة للنوع">
                                                  🏷️ مستعار: {v.shippingAliasName}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                          <div className="text-slate-700 font-bold">
                                            السعر: <span className="text-slate-900 font-black">{vPrice} د.ج</span>
                                          </div>

                                          {vCostVal !== undefined && vCostVal !== null && (
                                            <div className="text-slate-700 font-bold">
                                              التكلفة: <span className="text-indigo-700 font-black">{vCostVal} د.ج</span>
                                            </div>
                                          )}

                                          <div className="text-slate-700 font-bold">
                                            المتوفر بالمستودع: 
                                            <span className={`mr-1 px-2 py-0.5 rounded-lg font-black ${
                                              vStock < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                            }`}>
                                              {vStock} قطعة
                                            </span>
                                          </div>

                                          {vShipped > 0 && (
                                            <div className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                              في تم الشحن: <span className="font-black">{vShipped} طرد</span>
                                            </div>
                                          )}

                                          <button
                                            onClick={() => setManagingStockProduct({ product, varId: v.id })}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1"
                                          >
                                            <Package className="w-3.5 h-3.5" />
                                            إدارة المخزن لهذا النوع
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (

          /* Grid Cards View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProducts.map((product) => {
              const statusInfo = getStockStatusInfo(product);
              const data = getProductDisplayData(product);

              return (
                <div key={product.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                            <Package className="w-7 h-7" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-black text-slate-900 text-sm line-clamp-1">{product.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                              SKU: {product.sku || 'N/A'}
                            </span>
                            <SourceChannelBadge 
                              order={{ sourceChannel: product.channelName || 'طلب يدوي / مباشر' }} 
                              size="xs" 
                              configuredSalesChannels={salesChannels} 
                            />
                          </div>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0 ${statusInfo.color}`}>
                        <statusInfo.icon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block">المتوفر بالمستودع</span>
                        <span className="text-base font-black text-slate-900">{data.qty} قطعة</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block">في حالة (تم الشحن)</span>
                        <span className="text-base font-black text-amber-700">{data.shippedQty} طرد</span>
                      </div>
                    </div>

                    {data.hasVariations && (
                      <div className="bg-purple-50/60 p-2.5 rounded-2xl border border-purple-100 text-xs font-bold text-purple-900 flex items-center justify-between">
                        <span>يحتوي على {data.variationCount} أنواع/عروض</span>
                        <button
                          onClick={() => setViewingProduct(product)}
                          className="text-[11px] underline text-purple-700 hover:text-purple-900"
                        >
                          استعراض الأنواع
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setManagingStockProduct({ product })}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Package className="w-4 h-4" />
                      إدارة المخزن
                    </button>
                    <button
                      onClick={() => setViewingReturnedProducts(product)}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-bold rounded-xl text-xs transition-colors"
                      title="المرتجعات العالقة (روتور)"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewingProduct(product)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                      title="التفاصيل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!(product.channelType === 'manual' || (typeof product.id === 'string' && product.id.includes('-'))) && (
                    <button
                      onClick={() => handleSyncSingleProduct(product)}
                      disabled={syncingProductId === product.id}
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
                      title="مزامنة"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingProductId === product.id ? 'animate-spin' : ''}`} />
                    </button>
                    )}
                    <button
                      onClick={() => handleInitiateDeleteProduct(product)}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[12, 24, 48, 96]}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          itemLabel="منتج"
          className="rounded-2xl border border-slate-100 shadow-sm mt-4"
        />
      </div>

      {/* Modals */}
      {managingStockProduct && (
        <ProductStockManagementModal
          product={managingStockProduct.product}
          initialVariationId={managingStockProduct.varId}
          onClose={() => setManagingStockProduct(null)}
        />
      )}

      {viewingProduct && (
        <InventoryProductModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onSave={(updated) => {
            bulkUpsertInventory([updated]);
            setViewingProduct(null);
            toast.success('تم حفظ التعديلات بنجاح');
          }}
          isLocalMode={settings?.inventoryManagementMode === 'local'}
        />
      )}

      {showLogModal && <InventoryLogModal onClose={() => setShowLogModal(false)} />}
      {showAuditModal && <InventoryAuditModal isOpen={showAuditModal} onClose={() => setShowAuditModal(false)} />}
      {showDeficitModal && <DeficitListModal onClose={() => setShowDeficitModal(false)} />}
      {viewingReturnedProducts && (
        <ReturnedOrdersModal
          product={viewingReturnedProducts}
          onClose={() => setViewingReturnedProducts(null)}
        />
      )}

      {/* Modal: Add Manual Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">إضافة منتج جديد للمخزن</h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">أدخل بيانات المنتج للبدء في تتبعه</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم المنتج (إلزامي):</label>
                <input
                  type="text"
                  placeholder="مثال: ساعة ذكية Ultra"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">رمز SKU (إلزامي):</label>
                <input
                  type="text"
                  placeholder="مثال: WATCH-ULTRA-01"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">قناة / مصدر المنتج:</label>
                <select
                  value={newProductChannel}
                  onChange={(e) => setNewProductChannel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">طلب يدوي / مباشر</option>
                  {salesChannels && salesChannels.length > 0 && salesChannels.map(sc => (
                    <option key={sc.id} value={sc.name}>{sc.name}</option>
                  ))}
                  <option value="المتجر الإلكتروني">المتجر الإلكتروني</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الكمية الأولى:</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductQty}
                    onChange={(e) => setNewProductQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">سعر البيع:</label>
                  <input
                    type="text"
                    placeholder="2500"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">التكلفة:</label>
                  <input
                    type="text"
                    placeholder="1500"
                    value={newProductCost}
                    onChange={(e) => setNewProductCost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAddProduct}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة للمخزن
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Product */}
      {deletingProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد حذف المنتج من المخزن</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">عملية غير قابلة للتراجع</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs font-bold text-rose-900 space-y-2 leading-relaxed">
              <p>هل أنت متأكد من حذف المنتج التالي نهائياً من المخزن؟</p>
              <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-slate-800 font-normal space-y-1 text-xs">
                <div><strong>الاسم:</strong> {deletingProduct.name}</div>
                <div><strong>رمز SKU:</strong> {deletingProduct.sku || 'N/A'}</div>
                <div><strong>المتجر:</strong> {deletingProduct.channelName || 'محلي'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isDeletingProduct}
                onClick={handleConfirmDeleteProduct}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingProduct ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
              <button
                disabled={isDeletingProduct}
                onClick={() => setDeletingProduct(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Integrity Safeguard Modal */}
      <IntegrityProtectionModal
        isOpen={showIntegrityModal}
        onClose={() => setShowIntegrityModal(false)}
        result={integrityBlockResult}
      />

    </div>
  );
}
