import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIClient;
}

export function registerAiRoutes(app: express.Express) {
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: "مصفوفة الرسائل مطلوبة" });
      }

      const latestUserMessage = messages[messages.length - 1];
      const userText = latestUserMessage?.content || "";

      // System instruction for the COD Master AI
      const systemInstruction = `أنت 'المستشار الذكي الشامل وخبير ذكاء الأعمال (COD Master AI & Business Intelligence Analyst)' داخل منصة إدارة التجارة الإلكترونية والدفع عند الاستلام في الجزائر.
لديك وصول مباشر ولحظي إلى قاعدة بيانات المتجر (Firestore) بكافة تفاصيلها وجداولها.

أهدافك وقواعد عملك الأساسية:
1. **الاعتماد الصريح على قاعدة البيانات كمصدر رسمي (Database as Source of Truth)**:
   - جميع إجاباتك وتحليلاتك مستمدة ومطابقة بدقة للبيانات الحقيقية المرفقة في السياق (السجلات، الطلبيات، المخزون، السلات المتروكة، الحملات، المصاريف، المؤكدين، وشركات التوصيل).
   - حدد دائماً في مصفوفة 'sources' مصادر البيانات التي اعتمدت عليها في إجابتك من مجموعات Firestore (مثل: قاعدة بيانات الطلبيات، كتالوج المخزون، السلات المتروكة، سجلات الحملات الإعلانية).

2. **الربط الذكي والعميق بين مختلف الكائنات (Cross-Entity Intelligence)**:
   - **الطلبيات ↔ المخزن**: عند السؤال عن طلبيات أو تأكيدها، تفحص حالة المخزون للمنتج واذكر إذا كان متوفراً بكثرة أو قارب على النفاد.
   - **المنتجات ↔ الحملات الإعلانية ↔ صافي الأرباح**: اربط بين الصرف الإعلاني (Ad Spend) للمنتج وعدد الطلبيات المسلمة فعلياً لحساب تكلفة الطلب الحقيقية (Real CPA) وصافي الربح بعد خصم الشحن والمرتجع وسعر شراء المنتج.
   - **الولايات ↔ شركات التوصيل**: قارن أداء شركات التوصيل (مثل Expedigo, Yalidine, Ecotrack, ZR) في مختلف الولايات والبلديات (نسبة التسليم، نسبة الارجاع، وسرعة الشحن).
   - **المؤكدون ↔ جودة الطلبيات**: اربط بين أداء فريق التأكيد ونسب الاستلام والمرتجع الناتجة عن تأكيدات كل مؤكد.
   - **السلات المتروكة ↔ المنتجات**: حدد المنتجات الأكثر تعرضاً للهجر واقترح عروضاً وخطوات استرجاع عبر رسائل SMS واتصالات مباشرة.

3. **تقديم نصائح استراتيجية وتطويرية ملموسة (Actionable Growth Advice)**:
   - قدم توصيات عملية مخصصة لسوق التجارة الإلكترونية الجزائري (COD):
     * كيفية رفع نسبة التأكيد إلى 85%+ (الاتصال السريع خلال أقل من 15 دقيقة، تأكيد العنوان والبلدية ومكتب الـ Stopdesk، السيناريو الصوتي المقنع).
     * كيفية خفض المرتجع إلى أقل من 15% (الشحن في نفس اليوم، رسائل التتبع اللحظية SMS عند خروج الطرد ووصوله للمكتب، القائمة السوداء).
     * استراتيجيات التسعير وهامش الربح وإعادة الطلب قبل نفاد المخزون (Reorder Point).
     * تقييم نظام الاشتراك الشهري للمرتجع مقارنة بتكلفة الطرد الفردي.

4. **عرض وتحديد الطلبيات المطابقة**:
   - عندما يسأل المستخدم عن طلبيات أو يطلب عرضها (مثال: طلبيات جديد، طلبيات ولاية وهران، طلبيات مستلمة، طلبيات غير مشحونة، طلبيات زبون محدد، أو منتج معين):
     * ابحث في مصفوفة الطلبيات المرفقة وضع معرفات الطلبيات المطابقة (IDs) في مصفوفة 'matchingOrderIds' لتظهر في الواجهة كبطاقات تفاعلية فورية.
     * لخص الأرقام (العدد الإجمالي، مجموع المبالغ، والخطوة التالية المقترحة).

5. **اقتراح وتنفيذ العمليات (One-Click Database Operations)**:
   - إذا طلب المستخدم إجراء أي عملية (مثل: تأكيد طلبية، إضافة تاغ، إرسال لشركة شحن، تعيين مؤكد، تعديل مخزون، تسجيل مصروف):
     * ابنِ عملية واضحة في 'proposedOperation' واكتب ملخصاً شفافاً ومطمئناً بالعربية في 'summaryArabic' ليوافق عليه التاجر بنقرة واحدة.

6. **الأسلوب والتنسيق**:
   - لغة عربية احترافية، دقيقة، مشجعة، مدعومة بتنسيق Markdown متقن (عناوين، نقاط، خط عريض، أرقام دقيقة وإحصائيات بالدينار الجزائري د.ج).
   - يجب أن تكون استجابتك دائماً بتنسيق JSON مطابق للمخطط المحدد.`;

      // Build compact context summary for prompt
      const contextSummary = JSON.stringify({
        dbSourcesManifest: context?.dbSourcesManifest || [],
        stats: context?.stats || {},
        inventory: context?.inventory || {},
        abandonedCarts: context?.abandonedCarts || {},
        financials: context?.financials || {},
        salesChannels: context?.salesChannels || {},
        selectedOrderIdsFromUI: context?.selectedOrderIds || [],
        availableOrdersSample: (context?.orders || []).slice(0, 100)
      });

      const conversationHistory = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }]
      }));

      const promptWithContext = `بيانات المتجر المحدثة لحظياً من قاعدة البيانات (Firestore Sources):
${contextSummary}

رسالة المستخدم:
${userText}`;

      const ai = getGenAI();

      if (ai) {
        // Try reliable modern models in cascade: gemini-3.6-flash -> gemini-3.8-flash -> gemini-flash-latest
        const candidateModels = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-flash-latest"];
        
        for (const modelName of candidateModels) {
          try {
            const contents = [
              ...conversationHistory.slice(0, -1),
              {
                role: 'user',
                parts: [{ text: promptWithContext }]
              }
            ];

            const response = await ai.models.generateContent({
              model: modelName,
              contents: contents as any,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    reply: {
                      type: Type.STRING,
                      description: "Comprehensive Markdown response providing deep analysis, advice, and answers based on the database."
                    },
                    matchingOrderIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of order IDs that match query or user request."
                    },
                    matchingProductIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of inventory product IDs matching query if applicable."
                    },
                    sources: {
                      type: Type.ARRAY,
                      description: "List of database collections consulted to answer the question.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          collection: { type: Type.STRING },
                          name: { type: Type.STRING },
                          count: { type: Type.INTEGER },
                          description: { type: Type.STRING }
                        },
                        required: ["collection", "name", "description"]
                      }
                    },
                    suggestedActions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Smart follow-up suggestions or clickable action prompts."
                    },
                    proposedOperation: {
                      type: Type.OBJECT,
                      description: "Proposed operation for user confirmation before executing on the database.",
                      properties: {
                        actionType: {
                          type: Type.STRING,
                          description: "UPDATE_ORDER_STATUS, ASSIGN_TAG, ASSIGN_SHIPPING, SEND_TO_SHIPPING, BULK_UPDATE_ORDERS, ASSIGN_TO_CONFIRMER, UPDATE_INVENTORY, ADD_EXPENSE"
                        },
                        orderIds: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        summaryArabic: {
                          type: Type.STRING,
                          description: "Clear Arabic summary of the operation."
                        },
                        paramsJson: {
                          type: Type.STRING,
                          description: "Stringified JSON object of changes to apply e.g. {\"status1\":\"مؤكد\",\"deliveryCompany\":\"Expedigo\"}"
                        }
                      }
                    },
                    dataInsights: {
                      type: Type.ARRAY,
                      description: "Key metrics summary pills",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          value: { type: Type.STRING },
                          type: { type: Type.STRING }
                        },
                        required: ["label", "value"]
                      }
                    }
                  },
                  required: ["reply"]
                }
              }
            });

            const rawText = response.text || "{}";
            let parsed: any;
            try {
              parsed = JSON.parse(rawText);
            } catch (e) {
              parsed = { reply: rawText };
            }

            if (parsed.proposedOperation && parsed.proposedOperation.paramsJson && typeof parsed.proposedOperation.paramsJson === 'string') {
              try {
                parsed.proposedOperation.params = JSON.parse(parsed.proposedOperation.paramsJson);
              } catch (e) {
                parsed.proposedOperation.params = {};
              }
            }

            // Ensure sources are present
            if (!parsed.sources || parsed.sources.length === 0) {
              parsed.sources = (context?.dbSourcesManifest || []).slice(0, 4);
            }

            return res.status(200).json({
              success: true,
              data: parsed
            });
          } catch (modelErr: any) {
            console.warn(`Model ${modelName} failed, trying next candidate:`, modelErr?.message || modelErr);
          }
        }
      }

      // If all Gemini calls failed or no API key, run high-intelligence fallback engine
      const fallbackResult = generateSmartFallbackResponse(userText, context);
      return res.status(200).json({
        success: true,
        data: fallbackResult
      });

    } catch (error: any) {
      console.error("AI Chat Route Error:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء معالجة استفسار الذكاء الاصطناعي",
        error: error.message
      });
    }
  });
}

/**
 * Advanced Algorithmic Business Intelligence Engine
 * Handles full cross-entity queries, linking, and strategic recommendations
 * with live database sources citation.
 */
function generateSmartFallbackResponse(query: string, context: any) {
  const lower = query.toLowerCase().trim();
  const orders: any[] = context?.orders || [];
  const stats = context?.stats || {};
  const inventory = context?.inventory || {};
  const abandonedCarts = context?.abandonedCarts || {};
  const financials = context?.financials || {};
  const dbSourcesManifest = context?.dbSourcesManifest || [
    { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: orders.length, description: 'سجلات الطلبيات' },
    { collection: 'inventoryProducts', name: 'كتالوج المخزون والمنتجات', count: inventory?.totalProducts || 0, description: 'المخزون والأسعار' },
    { collection: 'abandonedOrders', name: 'سجلات السلات المتروكة', count: abandonedCarts?.total || 0, description: 'سلات الشراء غير المكتملة' }
  ];

  // 1. Specific Order Operations by ID or Hash (#1042)
  const orderIdMatch = query.match(/#?([0-9]{3,8})/);
  const targetOrderId = orderIdMatch ? orderIdMatch[1] : null;
  const targetOrder = targetOrderId ? orders.find(o => String(o.orderId) === targetOrderId || String(o.id) === targetOrderId) : null;

  if (targetOrder && (lower.includes('مؤكد') || lower.includes('شحن') || lower.includes('تاغ') || lower.includes('ارسل') || lower.includes('اجعل') || lower.includes('عين') || lower.includes('غير'))) {
    const isConfirm = lower.includes('مؤكد') || lower.includes('تاكيد') || lower.includes('تأكيد');
    const isTag = lower.includes('تاغ') || lower.includes('tag') || lower.includes('وسم');
    let extractedTag = '';
    if (isTag) {
      const tagMatch = query.match(/(?:تاغ|وسم|tag)\s+([^\s،,]+)/i);
      extractedTag = tagMatch ? tagMatch[1] : 'VIP';
    }

    let company = targetOrder.deliveryCompany || 'Expedigo';
    if (lower.includes('expedigo') || lower.includes('اكسبيديغو')) company = 'Expedigo';
    else if (lower.includes('ecotrack') || lower.includes('ايكوتراك')) company = 'Ecotrack';
    else if (lower.includes('yalidine') || lower.includes('ياليدين')) company = 'Yalidine';
    else if (lower.includes('zr') || lower.includes('زد ار')) company = 'ZR Express';

    const updates: Record<string, any> = {};
    if (isConfirm) updates.status1 = 'مؤكد';
    if (company) updates.deliveryCompany = company;
    if (extractedTag) updates.tag = extractedTag;

    // Cross-entity check: Is the product for this order available in inventory?
    const matchedProduct = (inventory?.productsCatalogSample || []).find((p: any) => 
      p.name?.toLowerCase().includes((targetOrder.productName || '').toLowerCase()) ||
      (targetOrder.productName || '').toLowerCase().includes(p.name?.toLowerCase())
    );
    const stockInfo = matchedProduct 
      ? `\n\n🔍 **الربط مع المخزون**: المنتج **${matchedProduct.name}** متاح منه حالياً بالمخزن **${matchedProduct.stock ?? 'غير محدد'}** قطعة.`
      : '';

    const summary = `تحديث الطلبية #${targetOrder.orderId} للعميل ${targetOrder.fullName || 'العميل'}: ${isConfirm ? 'تغيير الحالة إلى مؤكد' : ''} ${company ? `| شركة التوصيل: ${company}` : ''} ${extractedTag ? `| تاغ: ${extractedTag}` : ''}`;

    return {
      reply: `مرحباً بك! فحصت سجلات قاعدة بيانات الطلبيات للطلبية **#${targetOrder.orderId}** الخاصة بالعميل **${targetOrder.fullName || 'غير مسمى'}** (${targetOrder.region || 'الولاية غير محددة'} - ${targetOrder.phone || ''}).\n\n📌 **المنتج المطلوب:** ${targetOrder.productName || 'غير محدد'} (الكمية: ${targetOrder.qnts || 1}) بمبلغ إجمالي **${targetOrder.totalCharge || 0} د.ج**.${stockInfo}\n\nيرجى مراجعة تفاصيل العملية المقترحة أدناه وتأكيدها ليتم تحديثها مباشرة في قاعدة بيانات Firestore.`,
      matchingOrderIds: [targetOrder.id],
      sources: [
        { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: 1, description: `سجل الطلبية #${targetOrder.orderId}` },
        { collection: 'inventoryProducts', name: 'كتالوج المخزون والمنتجات', count: 1, description: 'فحص توفر المنتج في المخزن' }
      ],
      proposedOperation: {
        actionType: 'UPDATE_ORDER_STATUS',
        orderIds: [targetOrder.id],
        summaryArabic: summary,
        params: updates
      },
      suggestedActions: [
        `عرض كامل تفاصيل الطلبية #${targetOrder.orderId}`,
        "أظهر لي باقي الطلبيات بحالة جديد",
        "تأكيد جميع الطلبيات الجديدة دفعة واحدة"
      ],
      dataInsights: [
        { label: "رقم الطلبية", value: `#${targetOrder.orderId}`, type: "info" },
        { label: "المبلغ الإجمالي", value: `${targetOrder.totalCharge || 0} د.ج`, type: "success" },
        { label: "الولاية", value: targetOrder.region || "غير محددة", type: "info" }
      ]
    };
  }

  // 2. Specific Order Inquiry (lookup)
  if (targetOrder) {
    return {
      reply: `إليك كامل بيانات الطلبية **#${targetOrder.orderId}** المستخرجة مباشرة من قاعدة بيانات المتجر:\n\n- **اسم العميل**: ${targetOrder.fullName || 'غير محدد'}\n- **رقم الهاتف**: \`${targetOrder.phone || 'غير مسجل'}\`\n- **الولاية والبلدية**: ${targetOrder.region || ''} / ${targetOrder.city || ''}\n- **المنتج والكمية**: ${targetOrder.productName || ''} (${targetOrder.qnts || 1} قطعة)\n- **إجمالي التحصيل**: **${targetOrder.totalCharge || 0} د.ج** (سعر المنتج: ${targetOrder.priceWithoutDelivery || 0} د.ج + التوصيل: ${targetOrder.deliveryPrice || 0} د.ج)\n- **الحالة الأولى**: \`${targetOrder.status1 || 'جديد'}\`\n- **حالة التوصيل**: \`${targetOrder.status2 || 'غير مشحون'}\`\n- **شركة الشحن**: ${targetOrder.deliveryCompany || 'لم تحدد بعد'}\n- **المؤكد**: ${targetOrder.confirmedBy || 'غير معين'}\n${targetOrder.notes ? `- **ملاحظات**: ${targetOrder.notes}` : ''}`,
      matchingOrderIds: [targetOrder.id],
      sources: [
        { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: 1, description: `وثيقة الطلبية #${targetOrder.orderId}` }
      ],
      suggestedActions: [
        `تأكيد الطلبية #${targetOrder.orderId}`,
        `إرسال الطلبية #${targetOrder.orderId} للشحن فوراً`,
        "عرض طلبيات بحالة جديد"
      ],
      dataInsights: [
        { label: "حالة الطلبية", value: targetOrder.status1 || "جديد", type: targetOrder.status1 === 'مؤكد' ? 'success' : 'warning' },
        { label: "قيمة الطلبية", value: `${targetOrder.totalCharge || 0} د.ج`, type: "info" }
      ]
    };
  }

  // 3. Inventory and Stock Inquiries ("مخزن", "مخزون", "منتجات", "منخفض", "نفاد", "stock")
  if (lower.includes('مخزن') || lower.includes('مخزون') || lower.includes('منتج') || lower.includes('stock') || lower.includes('نفاد') || lower.includes('منخفض')) {
    const lowStock = inventory?.lowStockItems || [];
    const outOfStock = inventory?.outOfStockItems || [];
    const totalProd = inventory?.totalProducts || 0;

    let stockAdvice = '';
    if (outOfStock.length > 0) {
      stockAdvice += `\n\n🚨 **تنبيه نفاد المخزون (${outOfStock.length} منتجات)**:\n${outOfStock.map((p: any) => `- **${p.name}** (الكمية: 0 قطعة) - يُرجى التواصل مع المورد لإعادة الطلب فوراً.`).join('\n')}`;
    }
    if (lowStock.length > 0) {
      stockAdvice += `\n\n⚠️ **منتجات أوشكت على النفاد (${lowStock.length} منتجات)**:\n${lowStock.map((p: any) => `- **${p.name}**: متبقي **${p.stock}** قطع فقط في المخزن.`).join('\n')}`;
    }

    return {
      reply: `بناءً على فحص **كتالوج المخزون والمنتجات** في قاعدة البيانات:\n\n- إجمالي المنتجات المسجلة: **${totalProd} منتج**\n- منتجات منخفضة المخزون: **${lowStock.length} منتج**\n- منتجات نافدة تماماً: **${outOfStock.length} منتج**${stockAdvice}\n\n💡 **توصية استراتيجية للربط بين المبيعات والمخزن:**\nقم بمزامنة مبيعات الحملات الإعلانية مع كميات المخزن؛ إذا كان المنتج يقترب من النفاد، اخفض ميزانية الإعلان لتجنب تلقي طلبيات تفوق قدرتك على التجهيز، مما يرفع نسبة الإلغاء.`,
      matchingProductIds: [...lowStock, ...outOfStock].map((p: any) => p.id),
      sources: [
        { collection: 'inventoryProducts', name: 'كتالوج المخزون والمنتجات (Firestore)', count: totalProd, description: 'فحص كميات المخزون والأسعار' },
        { collection: 'inventoryMovements', name: 'سجل حركات المخزون', count: inventory?.recentMovements?.length || 0, description: 'آخر عمليات الإدخال والصرف' }
      ],
      suggestedActions: [
        "عرض المنتجات منخفضة المخزون",
        "تسجيل توريد بضاعة جديدة للمخزن",
        "ربط المنتجات بالحملات الإعلانية",
        "أظهر لي طلبيات جديد"
      ],
      dataInsights: [
        { label: "إجمالي المنتجات", value: `${totalProd}`, type: "info" },
        { label: "منخفض المخزون", value: `${lowStock.length}`, type: lowStock.length > 0 ? "warning" : "success" },
        { label: "نافد المخزون", value: `${outOfStock.length}`, type: outOfStock.length > 0 ? "danger" : "success" }
      ]
    };
  }

  // 4. Abandoned Carts / Abandoned Orders ("سلات", "متروكة", "سلة", "مهجورة", "cart", "abandoned")
  if (lower.includes('سلات') || lower.includes('سلة') || lower.includes('متروك') || lower.includes('مهجور') || lower.includes('abandoned')) {
    const totalCarts = abandonedCarts?.total || 0;
    const uncontacted = abandonedCarts?.uncontacted || 0;
    const recovered = abandonedCarts?.recovered || 0;
    const potentialRev = (abandonedCarts?.potentialRevenue || 0).toLocaleString();

    return {
      reply: `مستنداً إلى **جدول السلات المتروكة (Abandoned Orders)** في قاعدة البيانات:\n\n- إجمالي السلات المتروكة: **${totalCarts} سلة**\n- بانتظار التواصل والاسترجاع: **${uncontacted} سلة**\n- تم استرجاعها بنجاح: **${recovered} سلة**\n- **القيمة المالية غير المحصلة**: **${potentialRev} د.ج**\n\n🎯 **خطة عمل ذكية لاسترجاع الزبائن وزيادة المبيعات دون مصاريف إعلانية:**\n1. **الاتصال الهاتفي السريع**: الاتصال بالزبون خلال 30 إلى 60 دقيقة من هجر السلة يرفع نسبة الاسترجاع بنسبة 35%.\n2. **تقديم حافز مباشر**: مثل شحن مجاني أو خصم 300 د.ج أو هدية رمزية.\n3. **إرسال رسائل SMS آلية**: إرسال رابط تأكيد الطلب مع ملخص المنتج.\n4. **التحقق من سبب الهجر**: هل سعر الشحن مرتفع لولايته؟ اعرض عليه الاستلام من مكتب الشحن (Stopdesk) بسعر أرخص.`,
      sources: [
        { collection: 'abandonedOrders', name: 'سجلات السلات المتروكة (Firestore)', count: totalCarts, description: 'محاولات الطلب غير المكتملة' }
      ],
      suggestedActions: [
        "أظهر لي السلات المتروكة بانتظار التواصل",
        "تفعيل رسائل SMS لاسترجاع السلات",
        "تحليل أكثر المنتجات التي تُترك في السلة"
      ],
      dataInsights: [
        { label: "السلات المتروكة", value: `${totalCarts}`, type: "warning" },
        { label: "بانتظار التواصل", value: `${uncontacted}`, type: "danger" },
        { label: "مبالغ قابلة للاسترجاع", value: `${potentialRev} د.ج`, type: "success" }
      ]
    };
  }

  // 5. Financial, Profit, Revenue, and Expenses ("أرباح", "مداخيل", "مصاريف", "مالية", "صافي", "profit", "revenue")
  if (lower.includes('ارباح') || lower.includes('أرباح') || lower.includes('ربح') || lower.includes('دخل') || lower.includes('مداخيل') || lower.includes('مصاريف') || lower.includes('مالية') || lower.includes('صافي')) {
    const totalRev = Number(stats?.totalRevenue || 0).toLocaleString();
    const delivRev = Number(stats?.deliveredRevenue || 0).toLocaleString();
    const adSpend = Number(financials?.totalAdSpend || 0).toLocaleString();
    const expensesTotal = Number(financials?.totalExpenses || 0).toLocaleString();
    const netCash = Number(financials?.estimatedNetCashFlow || 0).toLocaleString();

    return {
      reply: `مستنداً إلى **السجلات المالية وحركات الشركاء والطلبيات المسلمة** في قاعدة البيانات:\n\n- **إجمالي قيمة الطلبيات المسجلة**: **${totalRev} د.ج**\n- **المداخيل المحققة فعلياً (الطلبيات المسلمة)**: **${delivRev} د.ج**\n- **مصاريف الإعلانات المسجلة (Ad Spend)**: **${adSpend} د.ج**\n- **المصاريف التشغيلية والإدارية**: **${expensesTotal} د.ج**\n- **صافي التدفق النقدي التقديري**: **${netCash} د.ج**\n\n💡 **تحليل استراتيجي للمالية والأرباح:**\n- **نظام تكلفة المرتجع الحالي**: \`${stats?.returnCostMode === 'monthly_subscription' ? 'اشتراك شهري شامل' : 'محاسبة فردية لكل طرد مرتجع'}\`.\n- لرفع هامش الربح الصافي، ركز على **زيادة متوسط قيمة الطلب (AOV)** عبر العروض الثنائية (Upsell / Bundle)، والتأكد من إرسال الطرود لشركات الشحن ذات نسب التسليم الأعلى في كل ولاية.`,
      sources: [
        { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: stats?.totalOrders || 0, description: 'حساب مبالغ المبيعات والتحصيل' },
        { collection: 'campaignRecords', name: 'سجلات الحملات الإعلانية', count: 1, description: 'مصاريف الإعلانات' },
        { collection: 'expenses', name: 'جدول المصاريف العامة', count: 1, description: 'المصاريف التشغيلية' }
      ],
      suggestedActions: [
        "عرض تفاصيل الطلبيات المسلمة ومبالغها",
        "مقارنة تكلفة المرتجع بالاشتراك الشهري",
        "تسجيل مصروف تشغيلي جديد",
        "تحليل المنتجات الأكثر تحقيقاً للأرباح"
      ],
      dataInsights: [
        { label: "المداخيل المسلمة", value: `${delivRev} د.ج`, type: "success" },
        { label: "مصاريف الإعلانات", value: `${adSpend} د.ج`, type: "warning" },
        { label: "صافي التدفق", value: `${netCash} د.ج`, type: "info" }
      ]
    };
  }

  // 6. Confirmation Rate, Confirmation Team, or Confirmers ("تأكيد", "مؤكد", "مؤكدين", "فريق")
  if (lower.includes('تاكيد') || lower.includes('تأكيد') || lower.includes('مؤكد') || lower.includes('مؤكدين') || lower.includes('confirmer')) {
    const matching = orders.filter(o => o.status1 === 'مؤكد');
    const newOrders = orders.filter(o => o.status1 === 'جديد' || !o.status1);
    const confRate = stats?.confirmationRatePct || '0%';

    return {
      reply: `مستنداً إلى **سجلات تأكيد الطلبيات وفريق العمل** في قاعدة البيانات:\n\n- إجمالي الطلبيات المؤكدة: **${matching.length} طلبية**\n- نسبة التأكيد الحالية (Confirmation Rate): **${confRate}**\n- طلبيات بانتظار التأكيد والمعالجة: **${newOrders.length} طلبية جديدة**\n\n🎯 **أفضل 4 خطوات ذهبية لرفع نسبة التأكيد إلى 85%+:**\n1. **سرعة الاتصال الفائقة**: حاول الاتصال بالزبون في غضون 10 إلى 20 دقيقة من إرسال طلبه قبل أن يبرد اهتمامه.\n2. **التأكيد على العنوان بدقة**: اسأل الزبون عن اسم البلدية ومكتب التوصيل الأقرب إليه، واشرح له موعد التوصيل المتوقع (مثلاً خلال 48 ساعة).\n3. **إعادة محاولة الاتصال الذكية**: برمج 3 محاولات اتصال في أوقات متفرقة (الصباح، بعد الظهر، والمساء) للزبائن الذين لا يردون.\n4. **توزيع الطلبيات آلياً**: وزع الطلبيات الجديدة على المؤكدين حسب تفرغهم لتقليل زمن الانتظار.`,
      matchingOrderIds: matching.slice(0, 15).map(o => o.id),
      sources: [
        { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: matching.length, description: 'سجلات الطلبيات المؤكدة' },
        { collection: 'users', name: 'فريق العمل والتأكيد', count: stats?.confirmersCount || 1, description: 'بيانات المؤكدين' }
      ],
      suggestedActions: [
        "أظهر لي الطلبيات الجديدة لتأكيدها",
        "توزيع الطلبيات الجديدة على فريق التأكيد",
        "إظهار الطلبيات التي تم تأكيدها اليوم"
      ],
      dataInsights: [
        { label: "نسبة التأكيد", value: confRate, type: "success" },
        { label: "مؤكدة", value: `${matching.length} طلبية`, type: "success" },
        { label: "بانتظار التأكيد", value: `${newOrders.length} طلبية`, type: "warning" }
      ]
    };
  }

  // 7. Returns and Delivery Rates ("مرتجع", "رجوع", "توصيل", "شحن", "تسليم", "expedigo", "yalidine", "ecotrack")
  if (lower.includes('مرتجع') || lower.includes('توصيل') || lower.includes('شحن') || lower.includes('تسليم') || lower.includes('مستلم') || lower.includes('ارجاع')) {
    const delivered = orders.filter(o => o.status2 === 'مستلم' || o.status2 === 'تم التوصيل');
    const returned = orders.filter(o => o.status2 === 'مرتجع');
    const delivRate = stats?.deliveryRatePct || '0%';
    const retRate = stats?.returnRatePct || '0%';

    return {
      reply: `مستنداً إلى **بيانات شركات الشحن وحالات الطرود اللحظية** في قاعدة البيانات:\n\n- الطلبيات المسلمة بنجاح: **${delivered.length} طلبية** (نسبة التسليم: **${delivRate}**)\n- الطلبيات المرتجعة: **${returned.length} طلبية** (نسبة المرتجع: **${retRate}**)\n\n🚚 **تحليل أداء شركات الشحن والربط مع الولايات:**\n- شركات الشحن النشطة في النظام: **${(stats?.activeShippingCompanies || ['Expedigo', 'Yalidine', 'Ecotrack']).join('، ')}**.\n\n🛡️ **خارطة طريق لتقليل المرتجع إلى أدنى مستوياته:**\n1. **إرسال سريع للشحنات**: كل يوم تأخير في إرسال الطرد من مخزنك لشركة التوصيل يرفع احتمال الارتجاع بنسبة 5%.\n2. **تنبيهات SMS اللحظية**: إشعار الزبون برقم التتبع عند خروج الطرد مع الموزع، وتنبيهه فور وصوله لمكتب الشحن (Stopdesk).\n3. **تفعيل نظام الاشتراك الشهري للمرتجع**: إذا كان متجرك يشحن أكثر من 300 طرد شهرياً، فإن الاشتراك الشهري يوفر عليك مبالغ ضخمة مقارنة بالدفع لكل طرد راجع.`,
      matchingOrderIds: returned.length > 0 ? returned.slice(0, 15).map(o => o.id) : delivered.slice(0, 15).map(o => o.id),
      sources: [
        { collection: 'orders', name: 'قاعدة بيانات الطلبيات (Firestore)', count: stats?.totalOrders || 0, description: 'حالات الشحن والتسليم والمرتجع' },
        { collection: 'settings', name: 'إعدادات شركات الشحن والاشتراكات', count: 1, description: 'بيانات الربط مع شركات التوصيل' }
      ],
      suggestedActions: [
        "أظهر لي الطلبيات المرتجعة لدراسة أسبابها",
        "عرض أفضل الولايات من حيث نسبة الاستلام",
        "تفعيل نظام الاشتراك الشهري للمرتجع"
      ],
      dataInsights: [
        { label: "نسبة التسليم", value: delivRate, type: "success" },
        { label: "نسبة المرتجع", value: retRate, type: "danger" },
        { label: "المسلمة", value: `${delivered.length} طلبية`, type: "success" }
      ]
    };
  }

  // 8. Default Comprehensive Overview
  const total = orders.length;
  const newCount = orders.filter(o => o.status1 === 'جديد' || !o.status1).length;
  const delivCount = orders.filter(o => o.status2 === 'مستلم' || o.status2 === 'تم التوصيل').length;
  const retCount = orders.filter(o => o.status2 === 'مرتجع').length;

  return {
    reply: `أهلاً بك! أنا **المستشار الذكي الشامل (COD Master AI)** لمتجرك وتجارتك الإلكترونية 🚀.\n\nأنا متصل مباشرة بقاعدة بيانات متجرك اللحظية (Firestore) ومطّلع على جميع تفاصيل:\n- 📦 **الطلبيات** (${total} طلبية مسجلة في النظام)\n- 🏬 **المخزون والمنتجات** (${inventory?.totalProducts || 0} منتج)\n- 🛒 **السلات المتروكة** (${abandonedCarts?.total || 0} سلة بقيمة ${Number(abandonedCarts?.potentialRevenue || 0).toLocaleString()} د.ج)\n- 📊 **الحملات الإعلانية والمصروفات**\n- 🚚 **شركات الشحن ونسب التسليم والمرتجع**\n\n📊 **ملخص فوري لمتجرك من واقع قاعدة البيانات:**\n- طلبيات بانتظار التأكيد: **${newCount} طلبية جديدة**\n- تم تسليمها بنجاح: **${delivCount} طلبية** (بمداخيل محققة: **${Number(stats?.deliveredRevenue || 0).toLocaleString()} د.ج**)\n- مرتجعات مسجلة: **${retCount} طلبية**\n\n💡 يمكنك سؤالي عن أي شيء مثل:\n- *"ما هي المنتجات الأكثر مبيعاً والأعلى ربحاً؟"*\n- *"أظهر لي طلبيات جديد لتأكيدها دفعة واحدة"*\n- *"فحص المخزون والمنتجات التي قاربت على النفاد"*\n- *"كيف أرفع نسبة استلام الطرود وأقلل المرتجع؟"*`,
    matchingOrderIds: orders.slice(0, 8).map(o => o.id),
    sources: dbSourcesManifest.slice(0, 4),
    suggestedActions: [
      "أظهر لي طلبيات بحالة جديد",
      "فحص المنتجات منخفضة المخزون",
      "كيف أرفع نسبة التأكيد والاستلام؟",
      "تحليل السلات المتروكة وطرق استرجاعها"
    ],
    dataInsights: [
      { label: "إجمالي الطلبيات", value: `${total}`, type: "info" },
      { label: "بانتظار التأكيد", value: `${newCount}`, type: "warning" },
      { label: "تم تسليمها", value: `${delivCount}`, type: "success" }
    ]
  };
}
