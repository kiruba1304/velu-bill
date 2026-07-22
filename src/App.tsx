import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import packageJson from '../package.json';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import BarcodeManager from './pages/BarcodeManager';
import Billing from './pages/Billing';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Parties from './pages/Parties';
import Reports from './pages/Reports';
import InvoiceTemplates from './pages/InvoiceTemplates';
import Settings from './pages/Settings';
import OnlineOrders from './pages/OnlineOrders';
import Services from './pages/Services';
import ServiceBill from './pages/ServiceBill';
import SaleBike from './pages/SaleBike';
import Accounts from './pages/Accounts';
import { useDatabase } from './hooks/useDatabase';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useECommerceIntegration } from './hooks/useECommerceIntegration';
import Login from './pages/Login';
import Attendance from './pages/Attendance';
import loginBg from '../assets/Login page image.png';
import { Database, FileText, FileCode, FolderDown, Menu, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

import { useAutoIvrScheduler } from './hooks/useAutoIvrScheduler';

type Page = 'dashboard' | 'accounts' | 'services' | 'service_bill' | 'products' | 'categories' | 'barcodes' | 'billing' | 'customers' | 'inventory' | 'parties' | 'reports' | 'templates' | 'settings' | 'online_orders' | 'sale_bike' | 'attendance';

function AppContent() {
  const { currentUser, allowedPages } = useAuth();
  useAutoIvrScheduler();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    try {
      const saved = localStorage.getItem('app_current_page');
      return (saved as Page) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  // Screen Saver State & Logic
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const getTimeoutMs = () => {
      try {
        const saved = localStorage.getItem('screensaver_timeout');
        if (saved !== null) {
          return parseInt(saved, 10) * 1000;
        }
        localStorage.setItem('screensaver_timeout', '300');
        return 300 * 1000;
      } catch {
        return 300 * 1000;
      }
    };

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      const timeoutMs = getTimeoutMs();
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          setIsScreensaverActive(true);
        }, timeoutMs);
      }
    };

    const handleUserActivity = () => {
      setIsScreensaverActive(false);
      resetTimer();
    };

    const handleSettingChange = () => {
      setIsScreensaverActive(false);
      resetTimer();
    };

    const handlePreviewTrigger = () => {
      setIsScreensaverActive(true);
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('screensaver-setting-changed', handleSettingChange);
    window.addEventListener('trigger-screensaver-preview', handlePreviewTrigger);

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('screensaver-setting-changed', handleSettingChange);
      window.removeEventListener('trigger-screensaver-preview', handlePreviewTrigger);
    };
  }, []);

  useEffect(() => {
    try {
      if (currentPage) {
        localStorage.setItem('app_current_page', currentPage);
      }
    } catch {}
  }, [currentPage]);

  // Handle Android Hardware / Gesture Back Button
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const backListener = CapacitorApp.addListener('backButton', () => {
      if (currentPage !== 'dashboard') {
        setCurrentPage('dashboard');
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backListener.then(h => h.remove?.());
    };
  }, [currentPage]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const db = useDatabase();
  useECommerceIntegration();
  const [isClosing, setIsClosing] = useState(false);
  const [closingCountdown, setClosingCountdown] = useState(5);

  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFade(true);
    }, 2000);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);


  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [androidUpdateUrl, setAndroidUpdateUrl] = useState('');

  useEffect(() => {
    // Only run update checker on Android
    if (Capacitor.getPlatform() !== 'android') return;

    const checkAndroidUpdate = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/kiruba1304/velu-bill/releases');
        if (!response.ok) return;
        const releases = await response.json();
        
        // Find the latest release with tag name starting with 'android-v'
        const latestAndroidRelease = releases.find((r: any) => r.tag_name && r.tag_name.startsWith('android-v'));
        if (!latestAndroidRelease) return;

        // Parse version numbers (tag name is android-v1.0.8, we get 1.0.8)
        const latestVersion = latestAndroidRelease.tag_name.replace('android-v', '');
        const currentVersion = packageJson.version;

        // Version comparison helper
        const isNewer = (latest: string, current: string) => {
          const lParts = latest.split('.').map(Number);
          const cParts = current.split('.').map(Number);
          for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
            const l = lParts[i] || 0;
            const c = cParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
          }
          return false;
        };

        if (isNewer(latestVersion, currentVersion)) {
          // Find the APK asset
          const apkAsset = latestAndroidRelease.assets?.find((a: any) => a.name === 'app-release.apk');
          if (apkAsset && apkAsset.browser_download_url) {
            setUpdateVersion(latestVersion);
            setAndroidUpdateUrl(apkAsset.browser_download_url);
            setUpdateStatus('available');
          }
        }
      } catch (err) {
        console.error('Android update check failed:', err);
      }
    };

    // Run check on startup
    checkAndroidUpdate();
  }, []);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    if (api.onUpdateAvailable) {
      api.onUpdateAvailable((info: any) => {
        setUpdateStatus('available');
        setUpdateVersion(info.version || '');
      });
    }

    if (api.onUpdateProgress) {
      api.onUpdateProgress((progress: any) => {
        setUpdateStatus('downloading');
        setUpdateProgress(Math.round(progress.percent || 0));
      });
    }

    if (api.onUpdateDownloaded) {
      api.onUpdateDownloaded((info: any) => {
        setUpdateStatus('ready');
        setUpdateVersion(info.version || '');
      });
    }

    if (api.onUpdateError) {
      api.onUpdateError((err: string) => {
        setUpdateStatus('error');
        setUpdateError(err);
        setTimeout(() => setUpdateStatus('idle'), 8000);
      });
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const api = (window as any).electronAPI;
    if (!api || !api.onAppClose) return;

    api.onAppClose(async () => {
      setIsClosing(true);
      setClosingCountdown(5);

      let timeLeft = 5;
      const interval = setInterval(async () => {
        timeLeft--;
        setClosingCountdown(timeLeft);

        if (timeLeft <= 0) {
          clearInterval(interval);
          try {
            const dir = localStorage.getItem('backup_directory');
            if (dir) {
              const sqlContent = await db.generateSqlDump();
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const seconds = String(now.getSeconds()).padStart(2, '0');
              const fileName = `billing_backup_auto_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.sql`;
              await api.saveJson(fileName, sqlContent, dir);
              console.log('App close auto backup saved to', dir);
            }
          } catch (e) {
            console.error('App close auto backup failed:', e);
          } finally {
            if (api.closeApp) {
              api.closeApp();
            }
          }
        }
      }, 1000);
    });
  }, [db, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const api = (window as any).electronAPI;
    if (!api?.saveJson) return; // Only available in the desktop (Electron) app

    const doBackupIfNeeded = async () => {
      try {
        const dir = localStorage.getItem('backup_directory');
        if (!dir) return;
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem('last_backup_date');
        if (last === today) return; // already backed up today

        const payload = {
          products: JSON.parse(localStorage.getItem('billing_app_products') || '[]'),
          customers: JSON.parse(localStorage.getItem('billing_app_customers') || '[]'),
          bills: JSON.parse(localStorage.getItem('billing_app_bills') || '[]'),
          transactions: JSON.parse(localStorage.getItem('billing_app_transactions') || '[]'),
        };
        const content = JSON.stringify(payload, null, 2);
        const fileName = `billing_backup_${today}.json`;
        await api.saveJson(fileName, content, dir);
        localStorage.setItem('last_backup_date', today);
        console.log('Daily backup saved to', dir);
      } catch (e) {
        console.error('Daily backup failed:', e);
      }
    };

    doBackupIfNeeded();
    const id = setInterval(doBackupIfNeeded, 60 * 60 * 1000); // hourly check
    return () => clearInterval(id);
  }, [currentUser]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreen = (e: Event) => {
      setIsFullscreen((e as CustomEvent).detail);
    };
    window.addEventListener('attendance-fullscreen', handleFullscreen);
    return () => window.removeEventListener('attendance-fullscreen', handleFullscreen);
  }, []);

  useEffect(() => {
    if (currentUser && allowedPages.length > 0 && !allowedPages.includes(currentPage)) {
      setCurrentPage(allowedPages[0] as Page);
    }
  }, [currentUser, allowedPages, currentPage]);

  if (!currentUser) {
    return (
      <>
        {isScreensaverActive && (
          <div
            onClick={() => setIsScreensaverActive(false)}
            className="fixed inset-0 z-[999999] bg-black flex items-center justify-center cursor-pointer overflow-hidden animate-in fade-in duration-300"
          >
            <img
              src={loginBg}
              alt="Screen Saver"
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-full text-white/90 text-xs font-semibold tracking-wider uppercase border border-white/20 shadow-2xl pointer-events-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Move mouse or press any key to resume
            </div>
          </div>
        )}
        <Login onLoginSuccess={() => {}} />
      </>
    );
  }

  const renderPage = () => {
    let pageToRender = currentPage;
    if (!allowedPages.includes(currentPage)) {
      if (allowedPages.length > 0) {
        pageToRender = allowedPages[0] as Page;
      } else {
        return <div className="flex h-full items-center justify-center font-semibold text-slate-500">No pages authorized.</div>;
      }
    }

    switch (pageToRender) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'accounts':
        return <Accounts />;
      case 'products':
        return <Products />;
      case 'categories':
        return <Categories />;
      case 'barcodes':
        return <BarcodeManager />;
      case 'billing':
        return <Billing />;
      case 'services':
        return <Services />;
      case 'service_bill':
        return <ServiceBill />;
      case 'customers':
        return <Customers onNavigate={setCurrentPage} />;
      case 'inventory':
        return <Inventory />;
      case 'parties':
        return <Parties />;
      case 'reports':
        return <Reports />;
      case 'templates':
        return <InvoiceTemplates />;
      case 'online_orders':
        return <OnlineOrders />;
      case 'sale_bike':
        return <SaleBike />;
      case 'settings':
        return <Settings />;
      case 'attendance':
        return <Attendance />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <>
      {/* Fullscreen Image Screensaver */}
      {isScreensaverActive && (
        <div
          onClick={() => setIsScreensaverActive(false)}
          className="fixed inset-0 z-[999999] bg-black flex items-center justify-center cursor-pointer overflow-hidden animate-in fade-in duration-300"
        >
          <img
            src={loginBg}
            alt="Screen Saver"
            className="w-full h-full object-cover select-none pointer-events-none"
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-full text-white/90 text-xs font-semibold tracking-wider uppercase border border-white/20 shadow-2xl pointer-events-none flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Move mouse or press any key to resume
          </div>
        </div>
      )}

      <div className="app-root flex flex-col md:flex-row h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 text-slate-900">
      {showSplash && (
        <div 
          className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-500 ${
            splashFade ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-28 w-28 rounded-2xl shadow-xl animate-fade-in-scale" 
            />
            <h1 className="text-2xl font-bold tracking-wider text-white animate-pulse">
              Bill போடு
            </h1>
          </div>
          
          <style>{`
            @keyframes fadeInScale {
              0% {
                opacity: 0;
                transform: scale(0.8);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
            .animate-fade-in-scale {
              animation: fadeInScale 0.8s ease-out forwards;
            }
          `}</style>
        </div>
      )}
      {/* Mobile Top Header */}
      {!isFullscreen && (
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-4 py-3 text-white md:hidden shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition-all"
            title="Open Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold uppercase tracking-[0.2em] text-xs text-primary-100">Bill போடு</span>
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary-500/20 text-xs font-bold uppercase border border-primary-500/30 text-primary-200">
            {currentUser ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
          </div>
        </header>
      )}

      {/* Backdrop overlay for mobile menu */}
      {isSidebarOpen && !isFullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentPage={currentPage} 
        onNavigate={(page) => {
          setCurrentPage(page);
          setIsSidebarOpen(false);
        }} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className={`flex-1 overflow-auto max-w-full ${isFullscreen ? 'p-0' : 'p-0 md:p-6'}`}>
        {renderPage()}
      </main>

      {isClosing && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 text-white backdrop-blur-xl">
          <style>{`
            @keyframes fly-file {
              0% {
                transform: translate(0, 0) scale(0.6) rotate(0deg);
                opacity: 0;
              }
              15% {
                opacity: 1;
              }
              85% {
                opacity: 1;
              }
              100% {
                transform: translate(240px, -20px) scale(1.1) rotate(360deg);
                opacity: 0;
              }
            }
            .flying-file {
              animation: fly-file 2.2s infinite linear;
            }
            .flying-file-delay-1 {
              animation: fly-file 2.2s infinite linear;
              animation-delay: 0.7s;
            }
            .flying-file-delay-2 {
              animation: fly-file 2.2s infinite linear;
              animation-delay: 1.4s;
            }
            @keyframes pulse-glow {
              0%, 100% {
                box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
              }
              50% {
                box-shadow: 0 0 45px rgba(59, 130, 246, 0.6);
              }
            }
            .db-glow {
              animation: pulse-glow 2s infinite ease-in-out;
            }
          `}</style>

          <div className="text-center max-w-lg px-6 flex flex-col items-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Securing Your Database
            </h2>
            <p className="text-slate-400 text-sm mb-12">
              Please wait while we generate a complete SQL backup of your products, customers, bills, and transactions...
            </p>

            {/* Animation Container */}
            <div className="relative flex items-center justify-between w-[440px] h-[150px] mx-auto mb-16 px-4">
              
              {/* Left Side: Local DB */}
              <div className="db-glow relative z-10 flex flex-col items-center justify-center w-24 h-24 rounded-3xl bg-blue-600 border border-blue-400/50 shadow-lg">
                <Database className="h-12 w-12 text-white animate-pulse" />
                <span className="absolute -bottom-7 text-[10px] font-bold tracking-widest text-blue-400 uppercase">Local DB</span>
              </div>

              {/* Center: Flying Files Container */}
              <div className="absolute left-[110px] top-[40px] w-[220px] h-[80px] pointer-events-none">
                {/* File 1 */}
                <div className="flying-file absolute left-0 top-0 flex items-center justify-center w-10 h-12 bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                {/* File 2 */}
                <div className="flying-file-delay-1 absolute left-0 top-0 flex items-center justify-center w-10 h-12 bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                  <FileCode className="h-5 w-5 text-amber-400" />
                </div>
                {/* File 3 */}
                <div className="flying-file-delay-2 absolute left-0 top-0 flex items-center justify-center w-10 h-12 bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
              </div>

              {/* Right Side: Backup Folder */}
              <div className="relative z-10 flex flex-col items-center justify-center w-24 h-24 rounded-3xl bg-emerald-600 border border-emerald-400/50 shadow-lg">
                <FolderDown className="h-12 w-12 text-white animate-pulse" />
                <span className="absolute -bottom-7 text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Backup Dir</span>
              </div>
            </div>

            {/* Countdown Display */}
            <div className="relative flex items-center justify-center w-36 h-36 mb-6 rounded-full bg-slate-900 border-4 border-blue-500/30">
              {/* Spinning progress border */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500 animate-spin" />
              
              <div className="text-center">
                <span className="text-4xl font-extrabold text-blue-400">{closingCountdown}</span>
                <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">Seconds</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic animate-pulse">
              Safely writing to backup folder... Do not turn off your computer.
            </p>
          </div>
        </div>
      )}

      {/* Auto-updater Banner */}
      {updateStatus !== 'idle' && updateStatus !== 'checking' && (updateStatus !== 'available' || Capacitor.getPlatform() === 'android') && (
        <div className="fixed bottom-6 right-6 z-[9999] w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white transition-all duration-300 transform translate-y-0 opacity-100 flex flex-col gap-3">
          {updateStatus === 'downloading' && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Download className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Downloading Update</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Version {updateVersion}</p>
                </div>
              </div>
              <div className="w-full">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden relative">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                  <span>Downloading...</span>
                  <span>{updateProgress}%</span>
                </div>
              </div>
            </>
          )}

          {updateStatus === 'ready' && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Update Ready!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Version {updateVersion} is downloaded.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => (window as any).electronAPI.restartAndInstall()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                >
                  <RefreshCw className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
                  Restart & Update
                </button>
                <button
                  onClick={() => setUpdateStatus('idle')}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium py-1 transition-colors"
                >
                  Later
                </button>
              </div>
            </>
          )}

          {updateStatus === 'available' && Capacitor.getPlatform() === 'android' && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">New Update Available!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Android Version {updateVersion} is ready.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    window.open(androidUpdateUrl, '_system');
                    setUpdateStatus('idle');
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download & Install
                </button>
                <button
                  onClick={() => setUpdateStatus('idle')}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium py-1 transition-colors"
                >
                  Later
                </button>
              </div>
            </>
          )}

          {updateStatus === 'error' && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Update Failed</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={updateError}>
                  {updateError || 'An error occurred during update.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
