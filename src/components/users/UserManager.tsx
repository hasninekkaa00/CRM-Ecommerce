import React, { useState } from 'react';
import {  
  Users, UserPlus, Shield, ShieldCheck, Headphones, CheckCircle2, 
  XCircle, AlertCircle, Edit, Trash2, Key, Search, Phone, 
  Mail, Calendar, Eye, EyeOff, Lock, UserCheck, ShieldAlert, RefreshCw
, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { AppUser, UserRole } from '../../types';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut, sendPasswordResetEmail } from 'firebase/auth';
import { firebaseConfig } from '../../lib/firebaseConfig';
import { auth } from '../../lib/firebase';
import { checkUserDeletionIntegrity, IntegrityCheckResult } from '../../utils/dataIntegrity';
import { IntegrityProtectionModal } from '../common/IntegrityProtectionModal';

export function UserManager() {
  const { users, currentUserProfile, orders, addUser, updateUser, deleteUser, settings, updateSettings } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // User Deletion & Integrity states
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [integrityBlockResult, setIntegrityBlockResult] = useState<IntegrityCheckResult | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [blockedUser, setBlockedUser] = useState<AppUser | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'confirmer' as UserRole,
    phone: '',
    isActive: true,
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isAdmin = currentUserProfile?.role === 'admin';

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone || '').includes(searchQuery);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin' && u.isActive).length;
  const confirmerCount = users.filter(u => u.role === 'confirmer' && u.isActive).length;
  const suspendedCount = users.filter(u => !u.isActive).length;

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      password: '',
      role: 'confirmer',
      phone: '',
      isActive: true,
      notes: ''
    });
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      password: '',
      role: user.role || 'confirmer',
      phone: user.phone || '',
      isActive: user.isActive !== undefined ? user.isActive : true,
      notes: user.notes || ''
    });
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);

    try {
      if (editingUser) {
        // Edit existing user
        await updateUser(editingUser.id, {
          displayName: formData.displayName.trim(),
          email: formData.email.trim(),
          role: formData.role,
          phone: formData.phone.trim(),
          isActive: formData.isActive,
          notes: formData.notes.trim()
        });

        // Sync confirmer list in settings if needed
        if (formData.role === 'confirmer' && formData.displayName.trim()) {
          const currentConfirmers = settings?.confirmers || [];
          if (!currentConfirmers.includes(formData.displayName.trim())) {
            await updateSettings({
              confirmers: [...currentConfirmers, formData.displayName.trim()]
            });
          }
        }

        setFormSuccess('تم تحديث بيانات المستخدم بنجاح');
        setTimeout(() => setIsModalOpen(false), 900);
      } else {
        // Add new user
        if (!formData.password || formData.password.length < 6) {
          throw new Error('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل');
        }

        // Create Firebase Auth account via secondary app to keep current session
        let newUid = `user_${Date.now()}`;
        try {
          const secondaryAppName = `AuthApp_${Date.now()}`;
          const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);
          const cred = await createUserWithEmailAndPassword(secondaryAuth, formData.email.trim(), formData.password);
          newUid = cred.user.uid;
          await secondarySignOut(secondaryAuth);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            // Already in auth, check if doc can be assigned
            newUid = `user_${Date.now()}`;
          } else {
            throw authErr;
          }
        }

        const newUser: AppUser = {
          id: newUid,
          uid: newUid,
          email: formData.email.trim(),
          displayName: formData.displayName.trim(),
          role: formData.role,
          phone: formData.phone.trim(),
          isActive: formData.isActive,
          notes: formData.notes.trim(),
          createdAt: new Date().toISOString(),
          lastLoginAt: ''
        };

        await addUser(newUser);

        // If confirmer, sync with settings.confirmers
        if (formData.role === 'confirmer' && formData.displayName.trim()) {
          const currentConfirmers = settings?.confirmers || [];
          if (!currentConfirmers.includes(formData.displayName.trim())) {
            await updateSettings({
              confirmers: [...currentConfirmers, formData.displayName.trim()]
            });
          }
        }

        setFormSuccess('تم إنشاء حساب المستخدم وتعيين الصلاحيات بنجاح!');
        setTimeout(() => setIsModalOpen(false), 1000);
      }
    } catch (err: any) {
      console.error('Error saving user:', err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('هذا البريد الإلكتروني مسجل بالفعل في النظام');
      } else if (err.code === 'auth/weak-password') {
        setFormError('كلمة المرور ضعيفة جداً');
      } else {
        setFormError(err.message || 'حدث خطأ أثناء حفظ المستخدم');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleMakeDefault = (user: AppUser) => {
    updateSettings({ defaultConfirmedBy: user.displayName });
  };

  const handleToggleStatus = async (user: AppUser) => {
    if (user.id === currentUserProfile?.id) {
      toast.error('لا يمكنك تعطيل حسابك الحالي المسجل به!');
      return;
    }
    const newStatus = !user.isActive;
    await updateUser(user.id, { isActive: newStatus });
    toast.success(newStatus ? `تم تفعيل حساب "${user.displayName}"` : `تم تعطيل حساب "${user.displayName}"`);
  };

  const handleInitiateDeleteUser = (user: AppUser) => {
    const check = checkUserDeletionIntegrity(user, {
      orders,
      settings,
      users,
      currentUserProfile
    });

    if (!check.canDelete) {
      setIntegrityBlockResult(check);
      setBlockedUser(user);
      setShowIntegrityModal(true);
      return;
    }

    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await deleteUser(userToDelete.id);
      toast.success(`تم حذف المستخدم "${userToDelete.displayName}" بنجاح`);
      setUserToDelete(null);
    } catch (e: any) {
      if (e?.name === 'DataIntegrityError') {
        setUserToDelete(null);
        setIntegrityBlockResult({
          canDelete: false,
          title: e.title || 'محظور لحماية تماسك النظام',
          reason: e.message,
          details: e.details || [],
          suggestions: e.suggestions || []
        });
        setShowIntegrityModal(true);
      } else {
        toast.error('حدث خطأ أثناء حذف المستخدم');
      }
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleSafeDeactivateUser = async () => {
    if (blockedUser) {
      await updateUser(blockedUser.id, { isActive: false });
      toast.success(`تم تعطيل حساب "${blockedUser.displayName}" بدلاً من حذفه، مع الحفاظ الكامل على سلامة السجلات.`);
      setBlockedUser(null);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني: ${email}`);
    } catch (e: any) {
      alert('فشل إرسال الرابط: ' + (e.message || ''));
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center" dir="rtl">
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl">
          <ShieldAlert className="w-16 h-16 text-amber-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">منطقة خاصة بالمدراء</h2>
          <p className="text-sm text-gray-600">
            ليس لديك صلاحية للوصول إلى إدارة المستخدمين. فقط المدير العام يملك صلاحية إضافة وتعديل المستخدمين وتحديد أدوارهم.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            إضافة وإدارة حسابات فريق العمل وتحديد الصلاحيات بين المدراء ومؤكدي الطلبات
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Permissions Rules Explanation Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 sm:p-5">
        <h3 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          نظام الصلاحيات والأدوار المعتمد:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed text-blue-950">
          <div className="bg-white/80 p-3 rounded-xl border border-blue-200/60 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-purple-900 block mb-0.5">👑 دور المدير العام (Admin):</span>
              له كامل الصلاحيات المطلقة: رؤية الأرباح والمالية، الحملات الإعلانية، الموردين والمشتريات، شركات الشحن، فواتير التوصيل، محاكي الأرباح، المصاريف والشركاء، الإعدادات، وإدارة المستخدمين.
            </div>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-blue-200/60 flex items-start gap-2.5">
            <Headphones className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-emerald-900 block mb-0.5">🎧 دور المؤكد (Confirmer):</span>
              مخصص لتأكيد الطلبيات وتتبع الشحن وسلات الشراء المتروكة. <span className="font-bold text-red-600">محجوب عنه بالكامل:</span> التفاصيل المالية، الحملات الإعلانية، الموردين، شركات الشحن وفواتيرها، محاكي الأرباح، ومصاريف الشركاء.
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-gray-900">{totalUsers}</div>
            <div className="text-xs text-gray-500 font-medium">إجمالي الحسابات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-purple-700">{adminCount}</div>
            <div className="text-xs text-gray-500 font-medium">مدراء بصلاحية كاملة</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-700">{confirmerCount}</div>
            <div className="text-xs text-gray-500 font-medium">مؤكدو الطلبيات والتتبع</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-rose-600">{suspendedCount}</div>
            <div className="text-xs text-gray-500 font-medium">حسابات معطلة</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو البريد الإلكتروني أو الهاتف..."
            className="w-full pl-3 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              roleFilter === 'all' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            الكل ({totalUsers})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              roleFilter === 'admin' 
                ? 'bg-purple-600 text-white shadow-xs' 
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Shield className="w-3 h-3" />
            المدراء ({users.filter(u => u.role === 'admin').length})
          </button>
          <button
            onClick={() => setRoleFilter('confirmer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              roleFilter === 'confirmer' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Headphones className="w-3 h-3" />
            المؤكدين ({users.filter(u => u.role === 'confirmer').length})
          </button>
        </div>
      </div>

      {/* Users List / Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-bold text-sm">لم يتم العثور على أي مستخدمين مطابقين</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="p-3.5">المستخدم</th>
                  <th className="p-3.5">الدور والصلاحية</th>
                  <th className="p-3.5">معلومات التواصل</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">تاريخ الإضافة / آخر نشاط</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserProfile?.id;
                  const isUserAdmin = user.role === 'admin';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      {/* Name & Avatar */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            isUserAdmin 
                              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                              {user.displayName || 'مستخدم بدون اسم'}
                              {isCurrent && (
                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-extrabold">
                                  حسابك
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono" dir="ltr">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3.5">
                        {isUserAdmin ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-black">
                            <Shield className="w-3.5 h-3.5 text-purple-600" />
                            مدير عام (صلاحية كاملة)
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black">
                            <Headphones className="w-3.5 h-3.5 text-emerald-600" />
                            مؤكد ومتابع شحن
                          </div>
                        )}
                      </td>

                      {/* Phone & Notes */}
                      <td className="p-3.5">
                        {user.phone ? (
                          <div className="flex items-center gap-1 text-gray-700 font-mono text-xs">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span dir="ltr">{user.phone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                        {user.notes && (
                          <div className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5">
                            {user.notes}
                          </div>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isCurrent}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          } ${isCurrent ? 'cursor-not-allowed opacity-80' : ''}`}
                          title={isCurrent ? 'حسابك الحالي' : 'انقر للتبديل بين التفعيل والتعطيل'}
                        >
                          {user.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              <span>نشط</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-600" />
                              <span>معطل</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Dates */}
                      <td className="p-3.5 text-gray-500 text-[11px]">
                        <div>أُضيف: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-DZ') : '-'}</div>
                        {user.lastLoginAt && (
                          <div className="text-[10px] text-gray-400">آخر دخول: {new Date(user.lastLoginAt).toLocaleString('ar-DZ')}</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="تعديل المستخدم والصلاحيات"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendPasswordReset(user.email)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="إرسال رابط إعادة تعيين كلمة المرور"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleInitiateDeleteUser(user)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="حذف المستخدم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {user.role === 'confirmer' && settings?.defaultConfirmedBy !== user.displayName && (
                            <button
                              onClick={() => handleMakeDefault(user)}
                              title="تعيين كمؤكد افتراضي"
                              className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Star className="w-4 h-4" />
                              <span className="text-[10px] font-bold">تعيين كافتراضي</span>
                            </button>
                          )}
                          {user.role === 'confirmer' && settings?.defaultConfirmedBy === user.displayName && (
                            <div className="p-1.5 text-amber-600 bg-amber-50 rounded-lg flex items-center gap-1">
                              <Star className="w-4 h-4 fill-amber-500" />
                              <span className="text-[10px] font-bold">افتراضي</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirm Delete User */}
      {userToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">تأكيد حذف حساب المستخدم</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">عملية غير قابلة للتراجع</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs font-bold text-rose-900 space-y-2 leading-relaxed">
              <p>هل أنت متأكد من حذف حساب المستخدم التالي نهائياً؟</p>
              <div className="bg-white/90 p-3 rounded-xl border border-rose-100 text-slate-800 font-normal space-y-1 text-xs">
                <div><strong>الاسم:</strong> {userToDelete.displayName}</div>
                <div><strong>البريد:</strong> {userToDelete.email}</div>
                <div><strong>الدور:</strong> {userToDelete.role === 'admin' ? 'مدير عام' : 'مؤكد ومتابع'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
              <button
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
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
        onClose={() => {
          setShowIntegrityModal(false);
          setBlockedUser(null);
        }}
        result={integrityBlockResult}
        safeActionLabel="تعطيل الحساب بدلاً من الحذف"
        onConfirmSafeAction={handleSafeDeactivateUser}
      />

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-auto max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  {editingUser ? <Edit className="w-5 h-5 text-blue-400" /> : <UserPlus className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {editingUser ? `تعديل حساب: ${editingUser.displayName}` : 'إضافة مستخدم جديد للنظام'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-400">حدد بيانات المستخدم ودوره وصلاحيات الوصول</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {formSuccess}
                  </div>
                )}

                {/* Role Selection Box */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">الدور والصلاحيات *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div
                      onClick={() => setFormData({ ...formData, role: 'confirmer' })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.role === 'confirmer'
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Headphones className={`w-4 h-4 shrink-0 ${formData.role === 'confirmer' ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <span className={`text-xs sm:text-sm font-extrabold ${formData.role === 'confirmer' ? 'text-emerald-900' : 'text-gray-700'}`}>
                          مؤكد ومتابع شحن
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-tight">
                        تأكيد الطلبيات وتتبع السويفي والسلات فقط (محجوب عن المالية والموردين)
                      </p>
                    </div>

                    <div
                      onClick={() => setFormData({ ...formData, role: 'admin' })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.role === 'admin'
                          ? 'border-purple-600 bg-purple-50/60 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className={`w-4 h-4 shrink-0 ${formData.role === 'admin' ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className={`text-xs sm:text-sm font-extrabold ${formData.role === 'admin' ? 'text-purple-900' : 'text-gray-700'}`}>
                          مدير عام (Admin)
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-tight">
                        كامل الصلاحيات (المالية، الحملات، الموردين، شركات الشحن، الإعدادات)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={formData.displayName ?? ''}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="مثال: يوسف مؤكد الطلبات"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">البريد الإلكتروني لتسجيل الدخول *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    dir="ltr"
                  />
                </div>

                {/* Password (for new user) */}
                {!editingUser && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور الأولية *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password ?? ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="كلمة مرور الحساب (6 خانات على الأقل)"
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Phone & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف (اختياري)</label>
                    <input
                      type="tel"
                      value={formData.phone ?? ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="05 / 06 / 07..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">حالة الحساب</label>
                    <select
                      value={formData.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="active">نشط (يمكنه تسجيل الدخول)</option>
                      <option value="inactive">معطل (ممنوع من تسجيل الدخول)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات داخلية (اختياري)</label>
                  <textarea
                    rows={2}
                    value={formData.notes ?? ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="ملاحظات حول الموظف أو أوقات العمل..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md disabled:bg-blue-400 flex items-center gap-1.5 cursor-pointer"
                >
                  {formLoading ? 'جاري الحفظ...' : (editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
