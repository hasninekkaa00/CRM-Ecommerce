import React, { useEffect, useState, useRef } from 'react';
import { auth, db, subscribeQuotaStatus, notifyQuotaExceeded, isQuotaError } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useStore } from '../store';
import { Order, AbandonedOrder, Campaign, CampaignRecord, CampaignField, SalesChannel, SystemSettings, Expense, AppUser } from '../types';
import { DEFAULT_TAGS } from '../utils/tagUtils';
import { DEFAULT_STATUS_COLORS } from '../utils/statusColorUtils';
import { LogIn, UserX, ShieldAlert, LogOut, Loader2, AlertTriangle, X, ExternalLink } from 'lucide-react';
import { firebaseConfig } from '../lib/firebaseConfig';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [dismissQuotaAlert, setDismissQuotaAlert] = useState(false);
  const quotaLoggedRef = useRef(false);
  const userLoginRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubQuota = subscribeQuotaStatus((exceeded) => {
      if (exceeded) {
        setQuotaExceeded(true);
        setLoading(false);
      }
    });
    return unsubQuota;
  }, []);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const currentUserProfile = useStore(state => state.currentUserProfile);

  const handleFetchError = (resourceName: string, error: any) => {
    const isQuota = error?.code === 'resource-exhausted' || 
                    error?.message?.includes('Quota exceeded') || 
                    error?.message?.includes('resource-exhausted');
    if (isQuota) {
      setQuotaExceeded(true);
      setLoading(false);
      if (!quotaLoggedRef.current) {
        console.warn(`[Firestore Quota Exceeded] Daily free quota reached for Firestore. Working in offline/cached mode.`);
        quotaLoggedRef.current = true;
      }
    } else {
      console.error(`Error fetching ${resourceName}:`, error);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const store = useStore.getState();

        // Setup User Listener & Profile sync
        const unsubUsers = onSnapshot(query(collection(db, 'users')), async (snapshot) => {
          const docs: AppUser[] = [];
          snapshot.forEach(d => docs.push({ id: d.id, ...d.data() } as AppUser));
          useStore.getState().setUsers(docs);

          let currentProf = docs.find(u => u.id === currentUser.uid || u.email?.toLowerCase() === currentUser.email?.toLowerCase());

          if (!currentProf) {
            // First user or missing profile: First user in DB is always admin
            const isFirst = docs.length === 0;
            const newProfile: AppUser = {
              id: currentUser.uid,
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || (isFirst ? 'المدير العام' : 'مؤكد طلبات'),
              role: isFirst ? 'admin' : 'confirmer',
              isActive: true,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };

            try {
              userLoginRecordedRef.current = currentUser.uid;
              await setDoc(doc(db, 'users', currentUser.uid), newProfile);
              currentProf = newProfile;
            } catch (err) {
              console.error("Error creating initial user profile:", err);
            }
          } else if (currentProf.isActive && userLoginRecordedRef.current !== currentUser.uid) {
            // Update last login timestamp quietly ONCE per user login session
            userLoginRecordedRef.current = currentUser.uid;
            try {
              updateDoc(doc(db, 'users', currentProf.id), {
                lastLoginAt: new Date().toISOString(),
                uid: currentUser.uid
              }).catch(() => {});
            } catch (_) {}
          }

          useStore.getState().setCurrentUserProfile(currentProf || null);
        }, (err) => handleFetchError("users", err));

        const unsubOrders = onSnapshot(query(collection(db, 'orders')), (snapshot) => {
          const docs: Order[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as Order));
          useStore.getState().setOrders(docs.sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
        }, (error) => handleFetchError("orders", error));

        const unsubAbandoned = onSnapshot(query(collection(db, 'abandonedOrders')), (snapshot) => {
          const docs: AbandonedOrder[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as AbandonedOrder));
          useStore.getState().setAbandonedOrders(docs.sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
        }, (error) => handleFetchError("abandonedOrders", error));

        const unsubCampaignList = onSnapshot(query(collection(db, 'campaigns')), (snapshot) => {
          const docs: Campaign[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as Campaign));
          useStore.getState().setCampaigns(docs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }, (error) => handleFetchError("campaigns", error));

        const unsubCampaigns = onSnapshot(query(collection(db, 'campaignRecords')), (snapshot) => {
          const docs: CampaignRecord[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as CampaignRecord));
          useStore.getState().setCampaignRecords(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("campaignRecords", error));

        const unsubFields = onSnapshot(query(collection(db, 'campaignFields')), (snapshot) => {
          const docs: CampaignField[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as CampaignField));
          useStore.getState().setCampaignFields(docs);
        }, (error) => handleFetchError("campaignFields", error));

        const unsubChannels = onSnapshot(query(collection(db, 'salesChannels')), (snapshot) => {
          const docs: SalesChannel[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as SalesChannel));
          useStore.getState().setSalesChannels(docs);
        }, (error) => handleFetchError("salesChannels", error));

        const unsubExpenses = onSnapshot(query(collection(db, 'expenses')), (snapshot) => {
          const docs: Expense[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as Expense));
          useStore.getState().setExpenses(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("expenses", error));

        const unsubPartners = onSnapshot(query(collection(db, 'partners')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
          useStore.getState().setPartners(docs.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        }, (error) => handleFetchError("partners", error));

        const unsubPartnerTransactions = onSnapshot(query(collection(db, 'partnerTransactions')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
          useStore.getState().setPartnerTransactions(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("partnerTransactions", error));

        const unsubInventory = onSnapshot(query(collection(db, 'inventory')), (snapshot) => {
          const map = new Map<string, any>();
          snapshot.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
          useStore.getState().setInventoryProducts(Array.from(map.values()));
        }, (error) => handleFetchError("inventory", error));

        const unsubMovements = onSnapshot(query(collection(db, 'inventoryMovements')), (snapshot) => {
          const map = new Map<string, any>();
          snapshot.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
          const docs = Array.from(map.values());
          useStore.getState().setInventoryMovements(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("inventoryMovements", error));

        const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setSuppliers(docs);
        }, (error) => handleFetchError("suppliers", error));

        const unsubPurchaseInvoices = onSnapshot(query(collection(db, 'purchaseInvoices')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setPurchaseInvoices(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("purchase invoices", error));

        const unsubSupplierPayments = onSnapshot(query(collection(db, 'supplierPayments')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setSupplierPayments(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("supplier payments", error));

        const unsubShippingInvoices = onSnapshot(query(collection(db, 'shippingInvoices')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setShippingInvoices(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (error) => handleFetchError("shipping invoices", error));

        const unsubShippingBureaus = onSnapshot(query(collection(db, 'shippingBureaus')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setShippingBureaus(docs);
        }, (error) => handleFetchError("shipping bureaus", error));

        
        const unsubNotes = onSnapshot(query(collection(db, 'settings', 'notes_data', 'items')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setNotes(docs);
        }, (error) => handleFetchError("notes", error));

        const unsubConfirmerInvoices = onSnapshot(query(collection(db, 'confirmerInvoices')), (snapshot) => {
          const docs: any[] = [];
          snapshot.forEach(doc => docs.push({ ...doc.data(), id: doc.id }));
          useStore.getState().setConfirmerInvoices(docs.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        }, (error) => handleFetchError("confirmer invoices", error));

        const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
          if (docSnap.exists()) {
            const rawData = docSnap.data() as SystemSettings;
            const fallbackDelivery = ['ياليدين', 'مايسترو', 'زد آر إكسبريس', 'إيكوتراك', 'أرامكس', 'سمسا', 'توصيل محلي'];
            const resolvedDelivery = Array.isArray(rawData.deliveryCompanies) && rawData.deliveryCompanies.length > 0
              ? rawData.deliveryCompanies
              : fallbackDelivery;

            // CRITICAL FIX: Only seed DEFAULT_TAGS if tags property is completely undefined in Firestore!
            // If the user has saved tags (even custom or modified), preserve them permanently!
            const hasTagsInDb = Array.isArray(rawData.tags);
            const cachedSettings = useStore.getState().settings;
            const resolvedTags = hasTagsInDb ? rawData.tags : (cachedSettings?.tags !== undefined ? cachedSettings.tags : DEFAULT_TAGS);

            // CRITICAL FIX: Preserve returnCostMode and return subscription
            const returnCostMode = rawData.returnCostMode || cachedSettings?.returnCostMode || 'per_order';
            const returnMonthlySubscription = rawData.returnMonthlySubscription !== undefined 
              ? rawData.returnMonthlySubscription 
              : (cachedSettings?.returnMonthlySubscription || 0);
            const returnCost = rawData.returnCost !== undefined 
              ? rawData.returnCost 
              : (cachedSettings?.returnCost ?? 400);

            // CRITICAL FIX: Preserve statusColors and orderRowColorMode
            const statusColors = rawData.statusColors || cachedSettings?.statusColors || DEFAULT_STATUS_COLORS;
            const orderRowColorMode = rawData.orderRowColorMode || cachedSettings?.orderRowColorMode || 'auto';

            const mergedSettings: SystemSettings = { 
              id: docSnap.id, 
              ...rawData, 
              deliveryCompanies: resolvedDelivery,
              tags: resolvedTags,
              returnCostMode,
              returnMonthlySubscription,
              returnCost,
              statusColors,
              orderRowColorMode,
            };

            useStore.getState().setSettings(mergedSettings);

            // Proactively ensure essential fields are permanently written in Firestore doc if missing
            const missingInDb: Partial<SystemSettings> = {};
            if (!hasTagsInDb) missingInDb.tags = resolvedTags;
            if (rawData.returnCostMode === undefined) missingInDb.returnCostMode = returnCostMode;
            if (rawData.returnMonthlySubscription === undefined) missingInDb.returnMonthlySubscription = returnMonthlySubscription;
            if (rawData.returnCost === undefined) missingInDb.returnCost = returnCost;
            if (!rawData.statusColors) missingInDb.statusColors = statusColors;
            if (!rawData.orderRowColorMode) missingInDb.orderRowColorMode = orderRowColorMode;

            if (Object.keys(missingInDb).length > 0) {
              setDoc(doc(db, 'settings', 'general'), missingInDb, { merge: true }).catch(err => {
                console.warn("Could not seed missing settings fields into Firestore:", err);
              });
            }
          } else {
            // Default settings if non-existent
            const defaultSettings: SystemSettings = {
              status1Options: ['جديد', 'قيد المراجعة', 'مؤكد', 'ملغى', 'مؤجل', 'لا يرد'],
              status2Options: ['قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'],
              deliveryCompanies: ['أرامكس', 'سمسا', 'ياليدين', 'مايان', 'زاجل', 'توصيل محلي'],
              confirmers: [],
              inventoryManagementMode: 'local',
              tags: DEFAULT_TAGS,
              statusColors: DEFAULT_STATUS_COLORS,
              orderRowColorMode: 'auto',
              returnCostMode: 'per_order',
              returnMonthlySubscription: 0,
              returnCost: 400,
            };
            useStore.getState().setSettings(defaultSettings);
            // Proactively create the document so the collection is created inside Firestore!
            setDoc(doc(db, 'settings', 'general'), defaultSettings).catch(err => {
              handleFetchError("create default settings", err);
            });
          }
        }, (error) => handleFetchError("settings", error));

        setLoading(false);

        return () => {
          unsubUsers();
          unsubOrders();
          unsubAbandoned();
          unsubCampaignList();
          unsubCampaigns();
          unsubFields();
          unsubChannels();
          unsubExpenses();
          unsubPartners();
          unsubPartnerTransactions();
          unsubInventory();
          unsubMovements();
          unsubSuppliers();
          unsubPurchaseInvoices();
          unsubSupplierPayments();
          unsubShippingInvoices();
          unsubShippingBureaus();
          unsubNotes();
          unsubConfirmerInvoices();
          unsubSettings();
        };
      } else {
        userLoginRecordedRef.current = null;
        useStore.getState().setCurrentUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (cred.user) {
          const newProf: AppUser = {
            id: cred.user.uid,
            uid: cred.user.uid,
            email: cred.user.email || email.trim(),
            displayName: displayName.trim() || email.trim().split('@')[0],
            role: 'confirmer',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', cred.user.uid), newProf);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)');
      } else {
        setAuthError('حدث خطأ أثناء المصادقة: ' + (error.message || ''));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">جاري المزامنة مع قاعدة البيانات...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center space-y-6 border border-gray-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <LogIn className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">{isLoginView ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h1>
            <p className="text-gray-500 text-xs">
              {isLoginView ? 'قم بتسجيل الدخول للوصول إلى لوحة التحكم.' : 'قم بإنشاء حساب للوصول للنظام وفق الصلاحيات المحددة.'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-3.5 text-right">
            {!isLoginView && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل</label>
                <input 
                  type="text" 
                  required 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد مؤكد الطلبات"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
            </div>

            {authError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:bg-blue-400 shadow-md cursor-pointer text-sm"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المعالجة...</span>
                </>
              ) : (isLoginView ? 'تسجيل الدخول' : 'إنشاء الحساب')}
            </button>
          </form>

          <button 
            type="button" 
            onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            {isLoginView ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
          </button>
        </div>
      </div>
    );
  }

  // Check if current user account is deactivated
  if (currentUserProfile && currentUserProfile.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
            <UserX className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 mb-2">تم تعطيل هذا الحساب</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              عذراً <span className="font-bold text-gray-800">{currentUserProfile.displayName}</span>، تم تعطيل وصول حسابك مؤقتاً من قِبل إدارة النظام. يرجى التواصل مع المدير لتفعيل الحساب.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => signOut(auth)}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج والتبديل لحساب آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  const upgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

  return (
    <>
      {quotaExceeded && !dismissQuotaAlert && (
        <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium sticky top-0 z-[99999]" dir="rtl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-200" />
            <span>
              <strong>تنبيه حصة Firestore (Quota Exceeded):</strong> تم استهلاك الحد اليومي المجاني لقاعدة بيانات فايربيس (Spark Plan). يعمل التطبيق حالياً بالبيانات المخزنة محلياً (Offline Cache)، وسيتم إعادة تفعيل الحصة تلقائياً غداً أو يمكنك ترقية الخطة عبر لوحة تحكم Firebase.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={upgradeUrl}
              target="_blank" 
              rel="noreferrer"
              className="bg-white text-amber-900 font-bold px-3 py-1 rounded-lg text-xs hover:bg-amber-100 transition inline-flex items-center gap-1 shadow-xs"
            >
              <span>ترقية خطة Firebase</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={() => setDismissQuotaAlert(true)}
              className="text-amber-200 hover:text-white p-1 rounded-md transition cursor-pointer"
              title="إخفاء التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

