import React, { useState } from 'react';
import { useStore } from '../../store';
import { ConfirmerDashboard } from './ConfirmerDashboard';
import { ConfirmerAssignmentManager } from './ConfirmerAssignmentManager';
import { ConfirmerFinanceManager } from './ConfirmerFinanceManager';
import { ConfirmerInvoiceModal } from './ConfirmerInvoiceModal';
import { ConfirmerInvoicePrintView } from './ConfirmerInvoicePrintView';
import { ConfirmerOrderBreakdownModal } from './ConfirmerOrderBreakdownModal';
import { ConfirmerInvoice, AppUser } from '../../types';
import { 
  Users, 
  BarChart3, 
  Settings2, 
  Wallet, 
  FileText, 
  Plus, 
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const ConfirmersHub: React.FC = () => {
  const { users, orders, settings, autoAssignPendingOrders, currentUserProfile } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assignment' | 'finance' | 'invoices'>('dashboard');
  
  // Modals state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedConfirmerForInvoice, setSelectedConfirmerForInvoice] = useState<AppUser | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<ConfirmerInvoice | null>(null);
  const [breakdownModalConfirmer, setBreakdownModalConfirmer] = useState<AppUser | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [assignmentAlert, setAssignmentAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const confirmersList = users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive));
  const unassignedOrdersCount = orders.filter(o => !o.assignedTo && (!o.status1 || o.status1 === 'جديد' || o.status1 === 'قيد المراجعة')).length;

  const handleQuickAutoAssign = async () => {
    try {
      setIsAutoAssigning(true);
      setAssignmentAlert(null);
      const res = await autoAssignPendingOrders();
      if (res.assignedCount > 0) {
        const summaryText = Object.entries(res.summary)
          .map(([name, count]) => `${name}: ${count} طلبية`)
          .join(' | ');
        setAssignmentAlert({
          type: 'success',
          message: `تم إسناد ${res.assignedCount} طلبية بنجاح! (${summaryText})`
        });
      } else {
        setAssignmentAlert({
          type: 'success',
          message: 'لا توجد طلبيات جديدة غير مسندة لتوزيعها حالياً'
        });
      }
    } catch (err: any) {
      setAssignmentAlert({
        type: 'error',
        message: err.message || 'حدث خطأ أثناء التوزيع الآلي'
      });
    } finally {
      setIsAutoAssigning(false);
      setTimeout(() => setAssignmentAlert(null), 7000);
    }
  };

  const handleOpenInvoiceModal = (confirmer?: AppUser) => {
    setSelectedConfirmerForInvoice(confirmer || null);
    setIsInvoiceModalOpen(true);
  };

  const handleViewBreakdown = (confirmer: AppUser) => {
    setBreakdownModalConfirmer(confirmer);
  };

  return (
    <div id="confirmers-hub-container" className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">إدارة فريق التأكيد والإسناد</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {confirmersList.length} مؤكد نشط
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                توزيع الطلبيات، متابعة أداء ونسب التأكيد، وإدارة العمولات والتحاسب المالي
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {unassignedOrdersCount > 0 && (
              <button
                id="quick-auto-assign-btn"
                onClick={handleQuickAutoAssign}
                disabled={isAutoAssigning}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {isAutoAssigning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>توزيع آلي ({unassignedOrdersCount} غير مسندة)</span>
              </button>
            )}

            <button
              id="create-invoice-header-btn"
              onClick={() => handleOpenInvoiceModal()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>تحرير فاتورة مستحقات</span>
            </button>
          </div>
        </div>

        {/* Assignment notification feedback */}
        {assignmentAlert && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2.5 text-sm ${
            assignmentAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {assignmentAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="font-medium">{assignmentAlert.message}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 mt-6 border-b border-slate-200 overflow-x-auto pb-px">
          <button
            id="tab-confirmers-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>لوحة الأداء والإحصائيات</span>
          </button>

          <button
            id="tab-confirmers-assignment"
            onClick={() => setActiveTab('assignment')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'assignment'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>قواعد وطرق الإسناد</span>
            {unassignedOrdersCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {unassignedOrdersCount}
              </span>
            )}
          </button>

          <button
            id="tab-confirmers-finance"
            onClick={() => setActiveTab('finance')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'finance'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>المستحقات والعمولات</span>
          </button>

          <button
            id="tab-confirmers-invoices"
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>أرشيف الفواتير والسداد</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <ConfirmerDashboard 
          onOpenInvoiceModal={handleOpenInvoiceModal}
          onViewBreakdown={handleViewBreakdown}
        />
      )}

      {activeTab === 'assignment' && (
        <ConfirmerAssignmentManager />
      )}

      {activeTab === 'finance' && (
        <ConfirmerFinanceManager 
          onOpenInvoiceModal={handleOpenInvoiceModal}
          onViewBreakdown={handleViewBreakdown}
        />
      )}

      {activeTab === 'invoices' && (
        <ConfirmerFinanceManager 
          defaultShowInvoicesList={true}
          onOpenInvoiceModal={handleOpenInvoiceModal}
          onViewBreakdown={handleViewBreakdown}
          onPrintInvoice={(inv) => setSelectedInvoiceForPrint(inv)}
        />
      )}

      {/* Invoice Generator Modal */}
      {isInvoiceModalOpen && (
        <ConfirmerInvoiceModal 
          isOpen={isInvoiceModalOpen}
          initialConfirmer={selectedConfirmerForInvoice}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedConfirmerForInvoice(null);
          }}
          onSuccessPrint={(invoice) => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceForPrint(invoice);
          }}
        />
      )}

      {/* Invoice Print & Export Preview */}
      {selectedInvoiceForPrint && (
        <ConfirmerInvoicePrintView 
          invoice={selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}

      {/* Confirmer Order Breakdown Modal */}
      {breakdownModalConfirmer && (
        <ConfirmerOrderBreakdownModal 
          confirmer={breakdownModalConfirmer}
          onClose={() => setBreakdownModalConfirmer(null)}
          onOpenInvoice={() => {
            const c = breakdownModalConfirmer;
            setBreakdownModalConfirmer(null);
            handleOpenInvoiceModal(c);
          }}
        />
      )}
    </div>
  );
};
