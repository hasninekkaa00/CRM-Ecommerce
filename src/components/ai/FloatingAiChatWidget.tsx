import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Maximize2, 
  Minimize2, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Lightbulb, 
  Package,
  Trash2,
  Database
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store';
import { AiChatMessage, AiProposedOperation, Order } from '../../types';
import { sendAiChatMessage, executeAiOperation } from '../../services/aiChatService';
import { AiOrderCard } from './AiOrderCard';
import { AiOperationCard } from './AiOperationCard';
import { AiOrderDetailModal } from './AiOrderDetailModal';
import toast from 'react-hot-toast';

interface FloatingAiChatWidgetProps {
  onNavigateToFullAi: () => void;
  currentView?: string;
}

export function FloatingAiChatWidget({ onNavigateToFullAi, currentView }: FloatingAiChatWidgetProps) {
  // If the user is already on the full AI page, don't show the floating widget
  if (currentView === 'ai_assistant') return null;

  const store = useStore();
  const orders = store.orders || [];

  const [isOpen, setIsOpen] = useState(false);
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
    return [
      {
        id: 'msg_float_greet',
        role: 'assistant',
        content: 'أهلاً بك! 👋 أنا **المساعد الذكي** المتصل بقاعدة بيانات متجرك. يمكنك سؤالي عن أي إحصائية، أو طلب عرض وتأكيد طلبيات فوراً!',
        timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: [
          "أظهر لي طلبيات جديد",
          "أظهر لي الطلبيات المسلمة",
          "كيف أرفع نسبة استلام الطرود؟"
        ]
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    };

    const updated = [...messages, userMessage];
    setMessages(updated);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await sendAiChatMessage(
        updated.map(m => ({ role: m.role, content: m.content }))
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
    } catch (err: any) {
      const errMessage: AiChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ حدث خطأ:\n${err.message || 'يرجى المحاولة مجدداً.'}`,
        timestamp: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteOperation = async (op: AiProposedOperation) => {
    try {
      const res = await executeAiOperation(op);
      toast.success(res.message);
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
    } catch (e: any) {
      toast.error(e.message || 'فشل في تنفيذ العملية');
    }
  };

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
    toast('تم إلغاء العملية');
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 left-6 z-40" dir="rtl">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-white/20"
            title="فتح المساعد الذكي"
          >
            <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-200" />
            </div>
            <span>المساعد الذكي (AI)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </button>
        </div>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-6 left-6 z-50 w-[95vw] sm:w-[460px] h-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-300"
          dir="rtl"
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">المساعد الذكي</h3>
                <span className="text-[10px] text-indigo-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  مباشر مع قاعدة البيانات
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToFullAi();
                }}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                title="توسيع إلى الشاشة الكاملة"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 text-xs">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const matchingOrders = (message.matchingOrderIds || [])
                .map(id => orders.find(o => o.id === id || o.orderId === id))
                .filter(Boolean) as Order[];

              return (
                <div key={message.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-white ${
                    isUser ? 'bg-slate-700' : 'bg-indigo-600'
                  }`}>
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`p-3 rounded-2xl leading-relaxed ${
                      isUser 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-2xs'
                    }`}>
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mb-2 pb-1.5 border-b border-slate-100 text-[10px] text-slate-500">
                          <Database className="w-2.5 h-2.5 text-indigo-600" />
                          <span className="font-semibold text-slate-600">المصادر:</span>
                          {message.sources.map((s, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[9px] border border-indigo-100">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {message.dataInsights && message.dataInsights.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2 pb-1.5 border-b border-slate-100">
                          {message.dataInsights.map((ins, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {ins.label}: <b>{ins.value}</b>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="prose prose-xs max-w-none text-slate-800">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>

                      {message.proposedOperation && (
                        <AiOperationCard
                          operation={message.proposedOperation}
                          onExecute={handleExecuteOperation}
                          onCancel={handleCancelOperation}
                        />
                      )}
                    </div>

                    {matchingOrders.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="font-semibold text-slate-600 text-[11px] block">
                          الطلبيات المطابقة ({matchingOrders.length}):
                        </span>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {matchingOrders.slice(0, 6).map(ord => (
                            <AiOrderCard
                              key={ord.id}
                              order={ord}
                              onViewDetails={(o) => setModalOrder(o)}
                              onQuickConfirm={(o) => {
                                store.updateOrder(o.id, { status1: 'مؤكد' });
                                toast.success(`تم تأكيد الطلبية #${o.orderId}`);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {message.suggestedActions.slice(0, 3).map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(act)}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10px] font-semibold text-slate-700 hover:text-indigo-700 transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <Lightbulb className="w-2.5 h-2.5 text-amber-500" />
                            {act}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2 items-center text-slate-500 text-xs">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-[11px] text-slate-600 shadow-2xs">
                  جاري التحليل...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="اسأل المساعد أو اطلب عملية..."
                className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 rotate-180" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AiOrderDetailModal
        order={modalOrder}
        isOpen={!!modalOrder}
        onClose={() => setModalOrder(null)}
      />
    </>
  );
}
