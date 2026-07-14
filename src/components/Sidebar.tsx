import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Home,
  Package,
  Receipt,
  Users,
  Warehouse,
  BarChart3,
  Settings,
  Barcode,
  Layout,
  Building2,
  FolderOpen,
  LogOut,
  Wrench,
  FileText,
  Bike,
  CalendarCheck,
  X
} from 'lucide-react';

type Page = 'dashboard' | 'services' | 'service_bill' | 'products' | 'categories' | 'barcodes' | 'billing' | 'customers' | 'inventory' | 'parties' | 'reports' | 'templates' | 'settings' | 'online_orders' | 'sale_bike' | 'attendance';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'billing', label: 'New Bill', icon: Receipt },
  { id: 'services', label: 'Services', icon: Wrench },
  { id: 'service_bill', label: 'Service Bill', icon: FileText },
  { id: 'sale_bike', label: 'Sale Bike', icon: Bike },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'categories', label: 'Categories', icon: FolderOpen },
  { id: 'barcodes', label: 'Barcodes', icon: Barcode },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Warehouse },
  { id: 'parties', label: 'Parties', icon: Building2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'templates', label: 'INV Template', icon: Layout },
  { id: 'online_orders', label: 'Online Orders', icon: Package },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
];


const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, onClose }) => {
  const { currentUser, logout, allowedPages, branches, activeBranchId, setActiveBranchId, isSuperAdmin, isAdmin } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreen = (e: Event) => {
      setIsFullscreen((e as CustomEvent).detail);
    };
    window.addEventListener('attendance-fullscreen', handleFullscreen);
    return () => window.removeEventListener('attendance-fullscreen', handleFullscreen);
  }, []);

  if (isFullscreen) return null;

  const filteredMenuItems = menuItems.filter(item => {
    return allowedPages.includes(item.id);
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'sub_admin': return 'Sub Admin';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const getInitials = (name: string) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/50 bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary-500/30 to-transparent" />
      <div className="relative p-6 pb-4">
        {/* Close Button on Mobile */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
          title="Close Menu"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="inline-flex rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-100 backdrop-blur">
          Bill போடு
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Billing Suite</h1>
        <p className="mt-1 text-sm text-slate-300">Professional POS system</p>

        {/* Branch Selector or Branch Indicator */}
        {(isSuperAdmin || isAdmin) ? (
          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Active Store Branch
            </label>
            <select
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(parseInt(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-primary-500 focus:bg-slate-900 cursor-pointer"
              title="Select Active Branch"
            >
              <option value="0" className="bg-slate-950 text-white">All Branch Data</option>
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-slate-950 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          currentUser?.branchId && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/5 p-2 px-3 flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">Branch:</span>
              <span className="font-semibold text-white truncate max-w-[140px]" title={branches.find(b => b.id == currentUser.branchId)?.name || 'Loading...'}>
                {branches.find(b => b.id == currentUser.branchId)?.name || 'Loading...'}
              </span>
            </div>
          )
        )}
      </div>

      <nav className="relative mt-2 flex-1 px-3 pb-4 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={`mb-1 flex w-full items-center rounded-2xl px-4 py-3 text-left transition-all duration-200 ${isActive
                  ? 'bg-white/14 text-white shadow-lg shadow-black/10 ring-1 ring-white/10'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-primary-200' : 'text-slate-400'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 space-y-3 bg-slate-950/50">
        {allowedPages.includes('settings') && (
          <button
            onClick={() => onNavigate('settings')}
            className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition-all duration-200 ${currentPage === 'settings'
                ? 'bg-white/14 text-white shadow-lg shadow-black/10 ring-1 ring-white/10'
                : 'text-slate-300 hover:bg-white/8 hover:text-white'
              }`}
          >
            <Settings className="mr-3 h-5 w-5 text-primary-200" />
            <span className="font-medium">Settings</span>
          </button>
        )}

        {/* User profile & Logout footer */}
        {currentUser && (
          <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20 text-sm font-bold uppercase tracking-wider text-primary-200 border border-primary-500/30">
                {getInitials(currentUser.name)}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-xs font-semibold text-white">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">{getRoleLabel(currentUser.role)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to logout?")) {
                  logout();
                }
              }}
              className="rounded-xl p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
