import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDatabase, User } from './useDatabase';

export interface AuthContextType {
  currentUser: User | null;
  allowedPages: string[];
  branches: any[];
  activeBranchId: number;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  setActiveBranchId: (branchId: number) => void;
  refreshPermissions: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_PAGES = [
  'dashboard',
  'billing',
  'services',
  'service_bill',
  'products',
  'categories',
  'barcodes',
  'customers',
  'inventory',
  'parties',
  'reports',
  'templates',
  'online_orders',
  'settings',
  'sale_bike',
  'attendance',
  'attendance_modify'
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('billing_app_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [allowedPages, setAllowedPages] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<number>(() => {
    try {
      const savedUser = sessionStorage.getItem('billing_app_current_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u.branchId) return u.branchId;
      }
      const savedBranch = sessionStorage.getItem('billing_app_active_branch_id');
      return savedBranch ? parseInt(savedBranch) : 1;
    } catch {
      return 1;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const loadPermissions = async (user: User | null) => {
    if (!user) {
      setAllowedPages([]);
      return;
    }
    if (user.role === 'super_admin' || user.role === 'admin') {
      setAllowedPages(ALL_PAGES);
      return;
    }
    try {
      let perms: string[] = [];
      const userPerms = await db.getUserPermissions(user.username, activeBranchId);
      if (userPerms && userPerms.length > 0) {
        perms = userPerms;
      } else {
        const rolePerms = await db.getRolePermissions(user.role, activeBranchId);
        perms = rolePerms || [];
      }
      
      // By default, subadmin must always have access to the attendance page
      if (user.role === 'sub_admin' && !perms.includes('attendance')) {
        perms = [...perms, 'attendance'];
      }
      
      setAllowedPages(perms);
    } catch (e) {
      console.error('Failed to load role/user permissions:', e);
      // Fallback default employee pages if DB fetch fails
      setAllowedPages(['dashboard', 'billing', 'products', 'customers', 'online_orders', 'barcodes', 'attendance']);
    }
  };

  const loadBranches = async () => {
    try {
      const list = await db.getBranches();
      setBranches(list || []);
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  };

  useEffect(() => {
    loadPermissions(currentUser);
    if (currentUser) {
      loadBranches();
      if (currentUser.branchId) {
        setActiveBranchIdState(currentUser.branchId);
      }
    } else {
      setBranches([]);
    }
  }, [currentUser, activeBranchId]);

  useEffect(() => {
    const refreshCurrentUser = async () => {
      if (currentUser) {
        try {
          const list = await db.getUsers();
          const latest = list.find(u => u.username === currentUser.username);
          if (latest) {
            const updatedUser = {
              ...currentUser,
              name: latest.name,
              role: latest.role,
              branchId: latest.branchId
            };
            if (
              currentUser.name !== latest.name ||
              currentUser.role !== latest.role ||
              currentUser.branchId !== latest.branchId
            ) {
              setCurrentUser(updatedUser);
              sessionStorage.setItem('billing_app_current_user', JSON.stringify(updatedUser));
              if (latest.branchId) {
                setActiveBranchIdState(latest.branchId);
              }
              window.dispatchEvent(new Event('branch-changed'));
            }
          }
        } catch (e) {
          console.error('Failed to auto-refresh current user session:', e);
        }
      }
    };
    refreshCurrentUser();
  }, [currentUser?.username]);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const user = await db.login(username, password);
      setCurrentUser(user);
      sessionStorage.setItem('billing_app_current_user', JSON.stringify(user));
      if (user.branchId) {
        setActiveBranchIdState(user.branchId);
      }
      window.dispatchEvent(new Event('branch-changed'));
      return user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('billing_app_current_user');
    sessionStorage.removeItem('billing_app_active_branch_id');
    window.dispatchEvent(new Event('branch-changed'));
  };

  const setActiveBranchId = (branchId: number) => {
    if (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') {
      setActiveBranchIdState(branchId);
      sessionStorage.setItem('billing_app_active_branch_id', String(branchId));
      window.dispatchEvent(new Event('branch-changed'));
    }
  };

  const refreshPermissions = async () => {
    await loadPermissions(currentUser);
  };

  const refreshBranches = async () => {
    await loadBranches();
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSubAdmin = currentUser?.role === 'sub_admin';
  const isEmployee = currentUser?.role === 'employee';

  return (
    <AuthContext.Provider value={{
      currentUser,
      allowedPages,
      branches,
      activeBranchId,
      loading,
      error,
      login,
      logout,
      setActiveBranchId,
      refreshPermissions,
      refreshBranches,
      isSuperAdmin,
      isAdmin,
      isSubAdmin,
      isEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
