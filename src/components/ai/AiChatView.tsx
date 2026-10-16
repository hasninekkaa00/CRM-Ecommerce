import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  TrendingUp, 
  DollarSign, 
  Truck, 
  Tag, 
  User, 
  Lightbulb,
  CheckSquare,
  Square,
  HelpCircle,
  BarChart3,
  Flame,
  ArrowRight,
  ShieldCheck,
  Database,
  Boxes,
  ShoppingCart,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store';
import { AiChatMessage, AiProposedOperation, Order, InventoryProduct } from '../../types';
import { sendAiChatMessage, executeAiOperation } from '../../services/aiChatService';
import { AiOrderCard } from './AiOrderCard';
import { AiOperationCard } from './AiOperationCard';
import { AiOrderDetailModal } from './AiOrderDetailModal';
import toast from 'react-hot-toast';

const INITIAL_GREETING_MESSAGE: AiChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `مرحباً بك! أنا **المستشار الذكي الشامل (COD Master AI)** لمتجرك وتجارتك الإلكترونية 🚀.\n\nأنا متصل مباشرة وحصرياً بقاعدة بيانات متجرك اللحظية (Firestore)، ولدي معرفة واطلاع كامل على:\n- 📦 **سجلات الطلبيات وحالاتها** (جديد، مؤكد، مشحون، مستلم، مرتجع).\n- 🏬 **المخزون والمنتجات** (الكميات المتوفرة، نفاد المخزون، وتكلفة المنتجات).\n- 🛒 **السلات المتروكة** ومحاولات الشراء المعلقة.\n- 📊 **الحملات الإعلانية ومصاريف التسويق** وصافي الأرباح التقديرية.\n- 🚚 **شركات الشحن (Expedigo, Yalidine, Ecotrack, ZR Express)** ومعدلات التسليم لكل ولاية.\n- 👥 **فريق التأكيد والمبيعات**.\n\n💡 **ماذا يمكنني أن أقدم لك؟**\n1. **تحليل ذكي فوري والربط بين الكائنات** (مثلاً: التحقق من توفر المنتج بالمخزن عند طلب طلبياته، أو حساب صافي الربح الحقيقي لكل حملة إعلانية بعد خصم الشحن والمرتجع).\n2. **تقديم نصائح استراتيجية وحلول لتطوير المتجر** (رفع نسبة التأكيد لأكثر من 85%، وخفض المرتجع، وتسريع تدفق السيولة النقدية).\n3. **تنفيذ عمليات مباشرة في قاعدة البيانات بنقرة واحدة** بعد مراجعتك وموافقتك الصريحة.\n\nاطرح عليّ أي سؤال أو اختر من الاقتراحات السريعة أدناه!`,
  timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
  sources: [
    { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', description: 'سجلات الطلبيات المباشرة' },
    { collection: 'inventoryProducts', name: 'كتالوج المخزون والمنتجات', description: 'الكميات المتوفرة والأسعار' },
    { collection: 'abandonedOrders', name: 'سجلات السلات المتروكة', description: 'السلات غير المكتملة' },
    { collection: 'campaignRecords', name: 'سجلات الحملات الإعلانية', description: 'صرف الإعلانات والمبيعات' }
  ],
  suggestedActions: [
    "أظهر لي طلبيات بحالة جديد",
    "فحص المخزون والمنتجات القريبة من النفاد",
    "كيف أرفع نسبة استلام الطرود وأقلل المرتجع؟",
    "تحليل الأرباح وصافي التدفق المالي"
  ],
  dataInsights: [
    { label: "مصدر المعرفة", value: "قاعدة بيانات Firestore اللحظية", type: "success" },
    { label: "صلاحية التنفيذ", value: "بموافقة المستخدم فقط", type: "info" }
  ]
};

export function AiChatView() {
  const store = useStore();
  const orders = store.orders || [];
  const inventoryProducts = store.inventoryProducts || [];
  const abandonedOrders = store.abandonedOrders || [];
  const settings = store.settings;
  const campaignRecords = store.campaignRecords || [];

  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [INITIAL_GREETING_MESSAGE];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle sending a message
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await sendAiChatMessage(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        selectedOrderIds
      );

      const assistantMessage: AiChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        matchingOrderIds: response.matchingOrderIds,
        matchingProductIds: response.matchingProductIds,
        sources: response.sources,
        suggestedActions: response.suggestedActions,
        proposedOperation: response.proposedOperation,
        dataInsights: response.dataInsights
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: AiChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ عذراً، حدث خطأ أثناء معالجة الطلب:\n\n${error.message || 'يرجى المحاولة مرة أخرى لاحقاً.'}`,
        timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        suggestedActions: [
          "أظهر لي طلبيات بحالة جديد",
          "أظهر لي الطلبيات المستلمة",
          "إعادة المحاولة"
        ]
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle order selection for bulk operations in chat
  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Execute a proposed operation
  const handleExecuteOperation = async (op: AiProposedOperation) => {
    try {
      const result = await executeAiOperation(op);
      toast.success(result.message);

      // Update operation status in messages
      setMessages(prev => prev.map(m => {
        if (m.proposedOperation && m.proposedOperation.summaryArabic === op.summaryArabic) {
          return {
            ...m,
            proposedOperation: {
              ...m.proposedOperation,
              status: 'executed',
              executedAt: new Date().toLocaleTimeString('ar-DZ')
            }
          };
        }
        return m;
      }));

      // Append confirmation message from AI
      const confirmMessage: AiChatMessage = {
        id: `msg_conf_${Date.now()}`,
        role: 'assistant',
        content: `✅ **تم تأكيد وتنفيذ العملية بنجاح في قاعدة البيانات!**\n\n${result.message}\n\nتم تطبيق التغييرات وتحديث السجلات اللحظية. هل ترغب في إجراء أي خطوة إضافية؟`,
        timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        sources: [
          { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', description: 'تحديث حالة السجلات بنجاح' }
        ],
        suggestedActions: [
          "أظهر لي الطلبيات بعد التحديث",
          "إرسال تنبيه SMS للعملاء",
          "عرض مؤشرات الأداء المحدثة"
        ]
      };
      setMessages(prev => [...prev, confirmMessage]);
      setSelectedOrderIds([]);
    } catch (err: any) {
      toast.error(err.message || 'فشل في تنفيذ العملية');
    }
  };

  // Cancel an operation
  const handleCancelOperation = (op: AiProposedOperation) => {
    setMessages(prev => prev.map(m => {
      if (m.proposedOperation && m.proposedOperation.summaryArabic === op.summaryArabic) {
        return {
          ...m,
          proposedOperation: {
            ...m.proposedOperation,
            status: 'cancelled'
          }
        };
      }
      return m;
    }));
    toast('تم إلغاء تنفيذ العملية', { icon: 'ℹ️' });
  };

  // Quick confirm single order from card
  const handleQuickConfirm = async (order: Order) => {
    try {
      await store.updateOrder(order.id, { status1: 'مؤكد' });
      toast.success(`تم تأكيد الطلبية #${order.orderId} بنجاح!`);
    } catch (e: any) {
      toast.error(e.message || 'فشل في التأكيد');
    }
  };

  // Quick ship single order from card
  const handleQuickShip = async (order: Order) => {
    const defaultCompany = settings?.deliveryCompanies?.[0] || 'Expedigo';
    try {
      await store.updateOrder(order.id, { 
        deliveryCompany: defaultCompany,
        status2: 'قيد التجهيز'
      });
      toast.success(`تم إرسال الطلبية #${order.orderId} لشركة ${defaultCompany}!`);
    } catch (e: any) {
      toast.error(e.message || 'فشل في الشحن');
    }
  };

  // Clear chat history
  const handleClearHistory = () => {
    if (window.confirm('هل أنت متأكد من مسح سجل المحادثة؟')) {
      setMessages([INITIAL_GREETING_MESSAGE]);
      setSelectedOrderIds([]);
      localStorage.removeItem('ai_chat_history');
      toast.success('تم مسح المحادثة');
    }
  };

  // Quick bulk prompt from selected orders banner
  const handleBulkActionPrompt = (actionType: 'confirm' | 'ship' | 'tag') => {
    if (selectedOrderIds.length === 0) return;
    if (actionType === 'confirm') {
      handleSendMessage(`قم بتأكيد الطلبيات المحددة (عددها ${selectedOrderIds.length}) وتغيير حالتها إلى مؤكد`);
    } else if (actionType === 'ship') {
      handleSendMessage(`قم بإرسال الطلبيات المحددة (عددها ${selectedOrderIds.length}) إلى شركة الشحن Expedigo`);
    } else if (actionType === 'tag') {
      handleSendMessage(`ضع تاغ VIP على الطلبيات المحددة (عددها ${selectedOrderIds.length})`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" dir="rtl">
      {/* Top Header Bar */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 text-base">المستشار الذكي الشامل (COD Master AI)</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                متصل بقاعدة البيانات
              </span>
            </div>
            <p className="text-xs text-slate-500">
              خبير تحليل البيانات، الربط بين الكائنات، وتطوير المبيعات والأرباح
            </p>
          </div>
        </div>

        {/* Header Tools & Live DB Sources Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSourcesPanel(!showSourcesPanel)}
            className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-800 font-medium transition-colors cursor-pointer"
            title="عرض مصادر قاعدة البيانات المتصلة بالمساعد الذكي"
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">مصادر البيانات:</span>
            <span className="font-bold font-mono">Firestore</span>
            {showSourcesPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleClearHistory}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
            title="مسح سجل المحادثة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Expandable Live Database Sources Panel */}
      {showSourcesPanel && (
        <div className="bg-slate-900 text-slate-200 px-6 py-3 border-b border-slate-800 text-xs shrink-0 animate-in slide-in-from-top duration-150 z-20">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white">مصادر المعرفة الحية للمساعد الذكي من قاعدة بيانات Firestore:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-indigo-400" />
                <span>الطلبيات:</span>
                <span className="font-bold font-mono text-emerald-400">{orders.length}</span>
              </div>
              <div className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <Boxes className="w-3 h-3 text-amber-400" />
                <span>المخزون والمنتجات:</span>
                <span className="font-bold font-mono text-emerald-400">{inventoryProducts.length}</span>
              </div>
              <div className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <ShoppingCart className="w-3 h-3 text-rose-400" />
                <span>السلات المتروكة:</span>
                <span className="font-bold font-mono text-emerald-400">{abandonedOrders.length}</span>
              </div>
              <div className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3 text-sky-400" />
                <span>الحملات الإعلانية:</span>
                <span className="font-bold font-mono text-emerald-400">{campaignRecords.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Selection Action Banner */}
      {selectedOrderIds.length > 0 && (
        <div className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between text-xs shadow-md animate-in slide-in-from-top-2 duration-200 shrink-0 z-10">
          <div className="flex items-center gap-2 font-bold">
            <CheckSquare className="w-4 h-4" />
            <span>تم تحديد {selectedOrderIds.length} طلبية من نتائج المحادثة</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkActionPrompt('confirm')}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition-colors cursor-pointer"
            >
              ✅ تأكيد الكل
            </button>
            <button
              onClick={() => handleBulkActionPrompt('ship')}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition-colors cursor-pointer"
            >
              🚚 إرسال للشحن
            </button>
            <button
              onClick={() => handleBulkActionPrompt('tag')}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition-colors cursor-pointer"
            >
              🏷️ تاغ VIP
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-2 py-1 bg-black/20 hover:bg-black/30 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => {
            const isUser = message.role === 'user';

            // Find matching orders in store if any
            const matchingOrders = (message.matchingOrderIds || [])
              .map(id => orders.find(o => o.id === id || o.orderId === id))
              .filter(Boolean) as Order[];

            // Find matching products in store if any
            const matchingProducts = (message.matchingProductIds || [])
              .map(id => inventoryProducts.find(p => p.id === id || p.sku === id))
              .filter(Boolean) as InventoryProduct[];

            return (
              <div 
                key={message.id} 
                className={`flex gap-3 md:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-xs ${
                  isUser 
                    ? 'bg-slate-700' 
                    : message.isError 
                    ? 'bg-rose-600' 
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Bubble Container */}
                <div className={`max-w-[85%] md:max-w-[82%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Sender label & Timestamp */}
                  <div className={`flex items-center gap-2 text-[11px] text-slate-400 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="font-semibold text-slate-600">{isUser ? 'أنت' : 'المستشار الذكي'}</span>
                    <span>•</span>
                    <span>{message.timestamp}</span>
                  </div>

                  {/* Main Bubble */}
                  <div className={`p-4 md:p-5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                    isUser 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : message.isError
                      ? 'bg-rose-50 text-rose-950 border border-rose-200 rounded-tl-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                  }`}>
                    {/* Database Sources Badges (if citing database) */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-2.5 border-b border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
                          <Database className="w-3 h-3 text-indigo-600" />
                          المصادر المعتمدة من قاعدة البيانات:
                        </span>
                        {message.sources.map((src, sIdx) => (
                          <span 
                            key={sIdx} 
                            title={src.description} 
                            className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/70 font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {src.name}
                            {src.count !== undefined && src.count > 0 && (
                              <span className="font-mono text-indigo-600 text-[10px]">({src.count})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Data Insights Pills (if any) */}
                    {message.dataInsights && message.dataInsights.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-100">
                        {message.dataInsights.map((insight, idx) => (
                          <div 
                            key={idx}
                            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 font-medium ${
                              insight.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              insight.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              insight.type === 'danger' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                              'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            <span className="opacity-75">{insight.label}:</span>
                            <span className="font-bold font-mono">{insight.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text content with Markdown support */}
                    <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {/* Proposed Operation Card (if AI suggested a database action) */}
                    {message.proposedOperation && (
                      <AiOperationCard
                        operation={message.proposedOperation}
                        onExecute={handleExecuteOperation}
                        onCancel={handleCancelOperation}
                      />
                    )}
                  </div>

                  {/* Matching Products Cards (if inventory items match) */}
                  {matchingProducts.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-amber-600" />
                          منتجات المخزن المرتبطة ({matchingProducts.length} منتج):
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {matchingProducts.map(p => (
                          <div key={p.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs space-y-1">
                            <div className="font-bold text-slate-800 truncate">{p.name}</div>
                            <div className="flex items-center justify-between text-slate-500 text-[11px]">
                              <span>المخزون المتوفر:</span>
                              <span className={`font-bold font-mono ${(p.local_stock_quantity || 0) <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {p.local_stock_quantity ?? 'غير محدد'} قطعة
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 text-[11px]">
                              <span>السعر:</span>
                              <span className="font-bold font-mono text-indigo-600">{p.sale_price || p.price || 0} د.ج</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Order Cards Grid (if user asked to see orders) */}
                  {matchingOrders.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                          الطلبيات المستخرجة من قاعدة البيانات ({matchingOrders.length} طلبية):
                        </span>
                        <span className="text-[11px] text-slate-400">انقر على أي طلبية لعرض كامل التفاصيل</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {matchingOrders.map(order => (
                          <AiOrderCard
                            key={order.id}
                            order={order}
                            isSelected={selectedOrderIds.includes(order.id)}
                            onToggleSelect={handleToggleSelectOrder}
                            onViewDetails={(ord) => setModalOrder(ord)}
                            onQuickConfirm={handleQuickConfirm}
                            onQuickShip={handleQuickShip}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Action Options (Clickable Chips) */}
                  {message.suggestedActions && message.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {message.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(action)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 hover:text-indigo-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer group"
                        >
                          <Lightbulb className="w-3 h-3 text-amber-500 group-hover:text-indigo-600" />
                          <span>{action}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-center text-slate-500 text-xs">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]" />
                <span className="text-slate-600 font-medium mr-1">المستشار الذكي يحلل بيانات المتجر ويربط بين الجداول...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Prompts Suggestion Bar */}
      <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 shrink-0 overflow-x-auto no-scrollbar">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-500" />
            استفسارات ذكية:
          </span>
          {[
            "أظهر لي طلبيات جديد لتأكيدها",
            "فحص المخزون والمنتجات المنخفضة",
            "كيف أرفع نسبة استلام الطرود وأقلل المرتجع؟",
            "تحليل المداخيل وصافي الأرباح",
            "تحليل أداء شركات التوصيل والولايات"
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 text-[11px] whitespace-nowrap font-medium transition-colors shrink-0 shadow-2xs cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form Bar */}
      <div className="p-4 bg-white border-t border-slate-200 shadow-md shrink-0">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-300/80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="اسأل المستشار الذكي عن أي إحصائية، نصيحة، أو اطلب عملية (مثلاً: أظهر لي طلبيات جديد أو اجعل الطلبية #1024 مؤكدة)..."
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden resize-none min-h-[40px] max-h-32"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer"
              title="إرسال"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 rotate-180" />
              )}
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-400 mt-2">
            المستشار الذكي يستند إلى قاعدة بيانات Firestore المباشرة لمتجرك، ولا ينفذ أي تعديل إلا بعد موافقتك الصريحة.
          </p>
        </div>
      </div>

      {/* Order Detail Modal */}
      <AiOrderDetailModal
        order={modalOrder}
        isOpen={!!modalOrder}
        onClose={() => setModalOrder(null)}
        onConfirmOrder={handleQuickConfirm}
      />
    </div>
  );
}
