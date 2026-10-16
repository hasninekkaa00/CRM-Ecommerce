import { FloatingUndoButton } from './components/common/FloatingUndoButton';
import { useState, useEffect, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AppSectionsView } from './components/layout/AppSectionsView';
import { ProductProfileBar } from './components/layout/ProductProfileBar';
import { AutoSyncManager } from './components/layout/AutoSyncManager';
import { AutoBackupManager } from './components/layout/AutoBackupManager';
import { BackupManager } from './components/backup/BackupManager';
import { TrackingQueueManager } from './components/layout/TrackingQueueManager';
import { LowInventoryAlertManager } from './components/layout/LowInventoryAlertManager';
import { ReminderManager } from './components/layout/ReminderManager';
import { SyncProgressBar } from './components/layout/SyncProgressBar';
import { FloatingTopBarControls } from './components/layout/FloatingTopBarControls';
import { Dashboard } from './components/dashboard/Dashboard';
import { IndicatorsDashboard } from './components/dashboard/IndicatorsDashboard';
import { OrdersList } from './components/orders/OrdersList';
import { ShippedOrdersList } from './components/orders/ShippedOrdersList';
import { SuiviDashboard } from './components/orders/SuiviDashboard';
import { InventoryList } from './components/inventory/InventoryList';
import { PurchasesManager } from './components/inventory/PurchasesManager';
import { AbandonedList } from './components/abandoned/AbandonedList';
import { CampaignTracker } from './components/campaigns/CampaignTracker';
import { ProfitSimulator } from './components/finance/ProfitSimulator';
import { AdvancedProfitSimulator } from './components/finance/AdvancedProfitSimulator';
import { SalesChannels } from './components/channels/SalesChannels';
import { SettingsConfig } from './components/settings/SettingsConfig';
import { ShippingManager } from './components/shipping/ShippingManager';
import { ShippingInvoices } from './components/shipping/ShippingInvoices';
import { ShippingBureaus } from './components/shipping/ShippingBureaus';
import { OrderAnalytics } from './components/analytics/OrderAnalytics';
import { ExpensesManager } from './components/expenses/ExpensesManager';
import { UserManager } from './components/users/UserManager';
import { NotesManager } from './components/notes/NotesManager';
import { ConfirmersHub } from './components/confirmers/ConfirmersHub';
import { ViewPresetsManager } from './components/layout/ViewPresetsManager';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { SpeedDialFAB } from "./components/layout/SpeedDialFAB";
import { LiveNotificationsManager } from "./components/layout/LiveNotificationsManager";
import { CommandPalette } from './components/layout/CommandPalette';
import { RecoveryCenterModal } from './components/common/RecoveryCenterModal';
import { AiChatView } from './components/ai/AiChatView';
import { FloatingAiChatWidget } from './components/ai/FloatingAiChatWidget';
import { SavedLayoutView } from './utils/savedLayoutViews';
import { ViewState } from './types';
import { useStore } from './store';
import { ShieldAlert } from 'lucide-react';

const THEMES = {
  classic: { sidebarBg: '#1a1a1a', sidebarActiveBg: '#2563eb', primaryColor: '#2563eb', primaryHover: '#1d4ed8', primaryLight: '#eff6ff', primaryLightBorder: '#bfdbfe' },
  emerald: { sidebarBg: '#064e3b', sidebarActiveBg: '#059669', primaryColor: '#10b981', primaryHover: '#059669', primaryLight: '#ecfdf5', primaryLightBorder: '#a7f3d0' },
  ruby: { sidebarBg: '#4c0519', sidebarActiveBg: '#e11d48', primaryColor: '#e11d48', primaryHover: '#be123c', primaryLight: '#fff1f2', primaryLightBorder: '#fecdd3' },
  midnight: { sidebarBg: '#0f172a', sidebarActiveBg: '#4f46e5', primaryColor: '#6366f1', primaryHover: '#4f46e5', primaryLight: '#eef2ff', primaryLightBorder: '#c7d2fe' },
  desert: { sidebarBg: '#451a03', sidebarActiveBg: '#d97706', primaryColor: '#f59e0b', primaryHover: '#d97706', primaryLight: '#fffbeb', primaryLightBorder: '#fde68a' },
  ocean: { sidebarBg: '#083344', sidebarActiveBg: '#0284c7', primaryColor: '#0ea5e9', primaryHover: '#0284c7', primaryLight: '#f0f9ff', primaryLightBorder: '#bae6fd' },
};

const CONFIRMER_ALLOWED_VIEWS: ViewState[] = ['orders', 'shipped_orders', 'suivi', 'abandoned', 'sections'];

export default function App() {
  const defaultLandingView = useStore(state => state.settings?.defaultLandingView);
  const themePalette = useStore(state => state.settings?.themePalette);
  const customThemePalettes = useStore(state => state.settings?.customThemePalettes);
  const userRole = useStore(state => state.currentUserProfile?.role);
  const isConfirmer = userRole === 'confirmer';

  const hasUserNavigatedRef = useRef(false);
  const initialLandingAppliedRef = useRef(false);

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const localPref = localStorage.getItem('app_default_landing_view') as ViewState;
    if (localPref) return localPref;
    return 'dashboard';
  });

  // Apply default landing view once on load if user has not actively switched views
  useEffect(() => {
    if (defaultLandingView && !initialLandingAppliedRef.current && !hasUserNavigatedRef.current) {
      initialLandingAppliedRef.current = true;
      if (!isConfirmer || CONFIRMER_ALLOWED_VIEWS.includes(defaultLandingView)) {
        setCurrentView(prev => (prev === defaultLandingView ? prev : defaultLandingView));
      }
    }
  }, [defaultLandingView, isConfirmer]);

  const handleNavigate = (view: ViewState) => {
    hasUserNavigatedRef.current = true;
    if (isConfirmer && !CONFIRMER_ALLOWED_VIEWS.includes(view)) {
      setCurrentView('orders');
    } else {
      setCurrentView(view);
    }
  };

  const [showRecoveryCenter, setShowRecoveryCenter] = useState(false);

  const [sidebarMode, setSidebarMode] = useState<'full' | 'mini' | 'hidden'>(() => {
    const savedMode = localStorage.getItem('sidebar_mode');
    if (savedMode === 'full' || savedMode === 'mini' || savedMode === 'hidden') return savedMode;
    const legacyOpen = localStorage.getItem('sidebar_is_open');
    if (legacyOpen === 'false') return 'hidden';
    return window.innerWidth >= 1024 ? 'full' : 'hidden';
  });

  const [sidebarViewMode, setSidebarViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('sidebar_view_mode');
    return (saved === 'grid' || saved === 'list') ? saved : 'list';
  });

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('layout_header_collapsed') === 'true';
  });

  const [isProductBarCollapsed, setIsProductBarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('layout_productbar_collapsed') === 'true';
  });

  const [isSyncBarCollapsed, setIsSyncBarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('layout_syncbar_collapsed') === 'true';
  });

  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  // Sync fullscreen state changes (e.g. via F11 or Esc)
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          setIsFullscreen(true);
          setIsHeaderCollapsed(true);
          setIsProductBarCollapsed(true);
          setIsSyncBarCollapsed(true);
          setSidebarMode('mini');
        }).catch(() => {
          handleToggleFocusMode();
        });
      } else {
        handleToggleFocusMode();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Guard confirmer from accessing restricted views when role changes
  useEffect(() => {
    if (isConfirmer) {
      setCurrentView(prev => (CONFIRMER_ALLOWED_VIEWS.includes(prev) ? prev : 'orders'));
    }
  }, [isConfirmer]);

  const handleChangeSidebarMode = (mode: 'full' | 'mini' | 'hidden') => {
    setSidebarMode(mode);
    localStorage.setItem('sidebar_mode', mode);
  };

  const handleToggleSidebar = () => {
    setSidebarMode(prev => {
      const next = prev === 'hidden' ? 'full' : 'hidden';
      localStorage.setItem('sidebar_mode', next);
      return next;
    });
  };

  const handleToggleSidebarMini = () => {
    setSidebarMode(prev => {
      const next = prev === 'mini' ? 'full' : 'mini';
      localStorage.setItem('sidebar_mode', next);
      return next;
    });
  };

  const handleToggleViewMode = (mode: 'list' | 'grid') => {
    setSidebarViewMode(mode);
    localStorage.setItem('sidebar_view_mode', mode);
  };

  const handleToggleHeaderCollapse = () => {
    setIsHeaderCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('layout_header_collapsed', String(next));
      return next;
    });
  };

  const handleToggleProductBarCollapse = () => {
    setIsProductBarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('layout_productbar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleSyncBarCollapse = () => {
    setIsSyncBarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('layout_syncbar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleFocusMode = () => {
    setIsFocusMode(prev => {
      const next = !prev;
      if (next) {
        setIsHeaderCollapsed(true);
        setIsProductBarCollapsed(true);
        setIsSyncBarCollapsed(true);
        setSidebarMode('mini');
      } else {
        setIsHeaderCollapsed(false);
        setIsProductBarCollapsed(false);
        setIsSyncBarCollapsed(false);
        setSidebarMode(window.innerWidth >= 1024 ? 'full' : 'hidden');
      }
      return next;
    });
  };

  const handleResetAllBars = () => {
    setIsHeaderCollapsed(false);
    setIsProductBarCollapsed(false);
    setIsSyncBarCollapsed(false);
    setIsFocusMode(false);
    setSidebarMode('full');
    localStorage.removeItem('layout_header_collapsed');
    localStorage.removeItem('layout_productbar_collapsed');
    localStorage.removeItem('layout_syncbar_collapsed');
    localStorage.setItem('sidebar_mode', 'full');
  };

  const handleApplySavedView = (view: SavedLayoutView) => {
    if (view.sidebarMode) {
      setSidebarMode(view.sidebarMode);
      localStorage.setItem('sidebar_mode', view.sidebarMode);
    }
    if (view.sidebarViewMode) {
      setSidebarViewMode(view.sidebarViewMode);
      localStorage.setItem('sidebar_view_mode', view.sidebarViewMode);
    }
    if (view.isHeaderCollapsed !== undefined) {
      setIsHeaderCollapsed(view.isHeaderCollapsed);
      localStorage.setItem('layout_header_collapsed', String(view.isHeaderCollapsed));
    }
    if (view.isProductBarCollapsed !== undefined) {
      setIsProductBarCollapsed(view.isProductBarCollapsed);
      localStorage.setItem('layout_productbar_collapsed', String(view.isProductBarCollapsed));
    }
    if (view.isSyncBarCollapsed !== undefined) {
      setIsSyncBarCollapsed(view.isSyncBarCollapsed);
      localStorage.setItem('layout_syncbar_collapsed', String(view.isSyncBarCollapsed));
    }
    if (view.isSectionsCardCollapsed !== undefined) {
      localStorage.setItem('app_sections_card_collapsed', JSON.stringify(view.isSectionsCardCollapsed));
    }
    if (view.isFocusMode !== undefined) {
      setIsFocusMode(view.isFocusMode);
    }
    if (view.globalProductFilter !== undefined) {
      useStore.getState().setGlobalProductFilter(view.globalProductFilter);
    }
    if (view.themePalette && useStore.getState().updateSettings) {
      useStore.getState().updateSettings({ themePalette: view.themePalette });
    }
  };

  // Global Keyboard Shortcuts (Alt+M for Fullscreen/Fill, Alt+H for header, Alt+S for sidebar, Alt+P for product bar, Alt+B for sync bar, Alt+F for focus mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.altKey && (e.key === 'm' || e.key === 'M' || e.key === 'ة')) {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.altKey && (e.key === 'h' || e.key === 'H' || e.key === 'ا')) {
        e.preventDefault();
        handleToggleHeaderCollapse();
      } else if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'س')) {
        e.preventDefault();
        setSidebarMode(prev => {
          const next = prev === 'full' ? 'mini' : prev === 'mini' ? 'hidden' : 'full';
          localStorage.setItem('sidebar_mode', next);
          return next;
        });
      } else if (e.altKey && (e.key === 'f' || e.key === 'F' || e.key === 'ب')) {
        e.preventDefault();
        handleToggleFocusMode();
      } else if (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'ح')) {
        e.preventDefault();
        handleToggleProductBarCollapse();
      } else if (e.altKey && (e.key === 'b' || e.key === 'B' || e.key === 'ل')) {
        e.preventDefault();
        handleToggleSyncBarCollapse();
      } else if (e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'ئ')) {
        e.preventDefault();
        setShowRecoveryCenter(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const themeName = themePalette || 'classic';
    const customTheme = customThemePalettes?.find(t => t.id === themeName);
    const theme = customTheme || THEMES[themeName as keyof typeof THEMES] || THEMES.classic;
    
    root.style.setProperty('--sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--sidebar-active-bg', theme.sidebarActiveBg);
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--primary-hover', theme.primaryHover);
    root.style.setProperty('--primary-light', theme.primaryLight);
    root.style.setProperty('--primary-light-border', theme.primaryLightBorder);
  }, [themePalette, customThemePalettes]);

  const renderView = () => {
    // If confirmer tries to access any restricted section
    if (isConfirmer && !CONFIRMER_ALLOWED_VIEWS.includes(currentView)) {
      return (
        <div className="p-8 max-w-xl mx-auto text-center" dir="rtl">
          <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl">
            <ShieldAlert className="w-14 h-14 text-amber-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">صلاحية وصول مقيدة</h2>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              حسابك مخصص لتأكيد الطلبيات وتتبع الشحن فقط، ولا يملك تصريحاً لعرض الأقسام المالية والمخازن والتقارير الإدارية.
            </p>
            <button
              onClick={() => handleNavigate('orders')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              الذهاب إلى قائمة الطلبيات
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'ai_assistant':
        return <AiChatView />;
      case 'dashboard':
        return <Dashboard onViewChange={handleNavigate} />;
      case 'sections':
        return <AppSectionsView onSelectView={handleNavigate} currentView={currentView} />;
      case 'indicators':
        return <IndicatorsDashboard />;
      case 'analytics':
        return <OrderAnalytics />;
      case 'orders':
        return <OrdersList />;
      case 'shipped_orders':
        return <ShippedOrdersList />;
      case 'suivi':
        return <SuiviDashboard />;
      case 'inventory':
        return <InventoryList />;
      case 'purchases':
        return <PurchasesManager />;
      case 'abandoned':
        return <AbandonedList />;
      case 'campaigns':
        return <CampaignTracker />;
      case 'profits':
        return <ProfitSimulator />;
      case 'expenses':
        return <ExpensesManager onViewChange={handleNavigate} />;
      case 'advanced_simulator':
        return <AdvancedProfitSimulator />;
      case 'channels':
        return <SalesChannels />;
      case 'settings':
        return <SettingsConfig />;
      case 'backup':
        return <BackupManager />;
      case 'notes':
        return <NotesManager />;
      case 'shipping':
        return <ShippingManager />;
      case 'shipping_invoices':
        return <ShippingInvoices />;
      case 'shipping_bureaus':
        return <ShippingBureaus />;
      case 'confirmers':
        return <ConfirmersHub />;
      case 'users':
        return <UserManager />;
      default:
        return <Dashboard onViewChange={handleNavigate} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f5f7] text-[#1a1a1a] font-sans overflow-hidden text-sm select-none relative" dir="rtl">
      {/* Floating pull-down controls tab when top bars are collapsed or in focus mode */}
      <FloatingTopBarControls
        isHeaderCollapsed={isHeaderCollapsed}
        onToggleHeaderCollapse={handleToggleHeaderCollapse}
        isProductBarCollapsed={isProductBarCollapsed}
        onToggleProductBarCollapse={handleToggleProductBarCollapse}
        isSyncBarCollapsed={isSyncBarCollapsed}
        onToggleSyncBarCollapse={handleToggleSyncBarCollapse}
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        sidebarMode={sidebarMode}
        onChangeSidebarMode={handleChangeSidebarMode}
        onResetAllBars={handleResetAllBars}
        onOpenSearch={() => handleNavigate('orders')}
        onApplySavedView={handleApplySavedView}
      />

      {/* Auto Sync Progress Bar (collapsible) */}
      <SyncProgressBar 
        isCollapsed={isSyncBarCollapsed}
        onToggleCollapse={handleToggleSyncBarCollapse}
      />

      <TrackingQueueManager />
      <div className="flex flex-1 overflow-hidden relative">
        <AutoSyncManager />
        <AutoBackupManager />
        <LowInventoryAlertManager onViewChange={handleNavigate} />
        <ReminderManager onViewChange={handleNavigate} />
        <Sidebar 
          currentView={currentView} 
          onViewChange={handleNavigate}
          isOpen={sidebarMode !== 'hidden'}
          onClose={() => setSidebarMode('hidden')}
          isMini={sidebarMode === 'mini'}
          onToggleMini={handleToggleSidebarMini}
          viewMode={sidebarViewMode}
          onToggleViewMode={handleToggleViewMode}
          onOpenAppGrid={() => handleNavigate('sections')}
        />
        
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Collapsible Header Container */}
          <div className={`transition-all duration-300 ease-in-out shrink-0 z-20 ${
            isHeaderCollapsed 
              ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' 
              : 'max-h-24 opacity-100'
          }`}>
            <Header 
              currentView={currentView}
              onViewChange={handleNavigate} 
              isSidebarOpen={sidebarMode !== 'hidden'}
              onToggleSidebar={handleToggleSidebar}
              sidebarMode={sidebarMode}
              onChangeSidebarMode={handleChangeSidebarMode}
              onOpenAppGrid={() => handleNavigate('sections')}
              isHeaderCollapsed={isHeaderCollapsed}
              onToggleHeaderCollapse={handleToggleHeaderCollapse}
              isProductBarCollapsed={isProductBarCollapsed}
              onToggleProductBarCollapse={handleToggleProductBarCollapse}
              isSyncBarCollapsed={isSyncBarCollapsed}
              onToggleSyncBarCollapse={handleToggleSyncBarCollapse}
              isFocusMode={isFocusMode}
              onToggleFocusMode={handleToggleFocusMode}
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
              onResetAllBars={handleResetAllBars}
              onApplySavedView={handleApplySavedView}
            />
          </div>

          {/* Product Profile Filter Bar (collapsible) */}
          <ProductProfileBar 
            isCollapsed={isProductBarCollapsed}
            onToggleCollapse={handleToggleProductBarCollapse}
          />
          
          <main className="flex-1 overflow-y-auto min-h-0 flex flex-col pb-16 md:pb-0">
            {renderView()}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <SpeedDialFAB onNavigate={handleNavigate} />
      <CommandPalette onNavigate={handleNavigate} />
        <LiveNotificationsManager />
      <MobileBottomNav 
        currentView={currentView}
        onViewChange={handleNavigate}
        onOpenRecovery={() => setShowRecoveryCenter(true)}
      />

      {/* Recovery / Undo Center Modal */}
      <RecoveryCenterModal 
        isOpen={showRecoveryCenter}
        onClose={() => setShowRecoveryCenter(false)}
      />

      <FloatingUndoButton />
      <FloatingAiChatWidget 
        onNavigateToFullAi={() => handleNavigate('ai_assistant')} 
        currentView={currentView} 
      />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            fontFamily: 'inherit',
            fontWeight: 'bold',
          },
        }} 
      />
    </div>
  );
}

