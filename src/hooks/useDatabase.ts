import { useState, useEffect } from 'react';
import { Product, Category, Customer, Bill, InventoryTransaction, Party, PartyStockMovement, PartyPayment, Service, Bike, BikeServiceReminder } from '../types';

class BrowserDatabase {
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  private getElectronApi() {
    const api = (window as any).electronAPI;
    if (api?.dbCall) {
      return api;
    }

    const defaultBackend = `http://${window.location.hostname}:3001`;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || localStorage.getItem('billing_app_backend_url') || defaultBackend;

    // Web Browser Fallback: proxy queries to hosted Express server
    return {
      dbCall: async (method: string, ...args: any[]): Promise<any> => {
        try {
          const response = await fetch(`${backendUrl}/api/db-call`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tunnel-Skip-Anti-Phishing-Threshold': 'true',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ method, args }),
          });
          let result: any = null;
          try {
            result = await response.json();
          } catch (e) {}
          if (!response.ok) {
            if (result && result.error) {
              throw new Error(result.error);
            }
            throw new Error(`HTTP error ${response.status}`);
          }
          if (!result || !result.success) {
            throw new Error(result?.error || 'Database operation failed');
          }
          return result.data;
        } catch (err: any) {
          console.error(`Failed to execute DB call via web fallback for ${method}:`, err);
          throw new Error(err.message || 'Failed to connect to local database server. Please ensure the app backend is running.');
        }
      }
    };
  }

  async waitForInit(): Promise<void> {
    return;
  }

  async getProducts(branchId?: number): Promise<Product[]> {
    return await this.getElectronApi().dbCall('getProducts', branchId);
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number | null): Promise<number> {
    return await this.getElectronApi().dbCall('createProduct', productData, branchId);
  }

  async updateProduct(id: number, productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateProduct', id, productData);
  }

  async deleteProduct(id: number, _syncToServer: boolean = true): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteProduct', id);
  }

  async getCategories(branchId?: number): Promise<Category[]> {
    return await this.getElectronApi().dbCall('getCategories', branchId);
  }

  async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createCategory', categoryData, branchId);
  }

  async updateCategory(id: number, categoryData: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateCategory', id, categoryData);
  }

  async deleteCategory(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteCategory', id);
  }

  async getCustomers(branchId?: number): Promise<Customer[]> {
    return await this.getElectronApi().dbCall('getCustomers', branchId);
  }

  async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number | null): Promise<number> {
    return await this.getElectronApi().dbCall('createCustomer', customerData, branchId);
  }

  async updateCustomer(id: number, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateCustomer', id, updates);
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteCustomer', id);
  }

  async getParties(branchId?: number): Promise<Party[]> {
    return await this.getElectronApi().dbCall('getParties', branchId);
  }

  async createParty(partyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createParty', partyData, branchId);
  }

  async updateParty(id: number, updates: Partial<Omit<Party, 'id' | 'createdAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateParty', id, updates);
  }

  async deleteParty(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteParty', id);
  }

  async getPartyMovements(branchId?: number): Promise<PartyStockMovement[]> {
    return await this.getElectronApi().dbCall('getPartyMovements', branchId);
  }

  async createPartyMovement(movementData: Omit<PartyStockMovement, 'id' | 'createdAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createPartyMovement', movementData, branchId);
  }

  async getPartyPayments(branchId?: number): Promise<PartyPayment[]> {
    return await this.getElectronApi().dbCall('getPartyPayments', branchId);
  }

  async createPartyPayment(paymentData: Omit<PartyPayment, 'id' | 'createdAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createPartyPayment', paymentData, branchId);
  }

  async getBills(branchId?: number): Promise<Bill[]> {
    return await this.getElectronApi().dbCall('getBills', branchId);
  }

  async createBill(bill: Bill, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createBill', bill, branchId);
  }

  async updateBill(billNumber: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateBill', billNumber, updates);
  }

  async getTransactions(branchId?: number): Promise<InventoryTransaction[]> {
    return await this.getElectronApi().dbCall('getTransactions', branchId);
  }

  async generateSqlDump(): Promise<string> {
    return await this.getElectronApi().dbCall('generateSqlDump');
  }

  async importSqlDump(sqlContent: string): Promise<boolean> {
    return await this.getElectronApi().dbCall('importSqlDump', sqlContent);
  }

  async wipeDatabase(): Promise<void> {
    await this.getElectronApi().dbCall('wipeDatabase');
  }

  async login(username: string, password: string): Promise<any> {
    const res = await this.getElectronApi().dbCall('login', username, password);
    if (res && res.error) {
      throw new Error(res.error);
    }
    return res;
  }

  async getUsers(): Promise<any[]> {
    return await this.getElectronApi().dbCall('getUsers');
  }

  async createUser(userData: any): Promise<number> {
    return await this.getElectronApi().dbCall('createUser', userData);
  }

  async updateUser(id: number, userData: any): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateUser', id, userData);
  }

  async deleteUser(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteUser', id);
  }

  async getRolePermissions(role: string, branchId?: number): Promise<string[]> {
    return await this.getElectronApi().dbCall('getRolePermissions', role, branchId);
  }

  async updateRolePermissions(role: string, branchId: number, pageIds: string[]): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateRolePermissions', role, branchId, pageIds);
  }

  async getUserPermissions(username: string, branchId?: number): Promise<string[]> {
    return await this.getElectronApi().dbCall('getUserPermissions', username, branchId);
  }

  async updateUserPermissions(username: string, branchId: number, pageIds: string[]): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateUserPermissions', username, branchId, pageIds);
  }

  async getBranches(): Promise<any[]> {
    return await this.getElectronApi().dbCall('getBranches');
  }

  async createBranch(branchData: any): Promise<number> {
    return await this.getElectronApi().dbCall('createBranch', branchData);
  }

  async updateBranch(id: number, branchData: any): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateBranch', id, branchData);
  }

  async deleteBranch(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteBranch', id);
  }

  async getServices(branchId?: number): Promise<Service[]> {
    return await this.getElectronApi().dbCall('getServices', branchId);
  }

  async createService(serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createService', serviceData, branchId);
  }

  async updateService(id: number, serviceData: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateService', id, serviceData);
  }

  async deleteService(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteService', id);
  }

  async getBikes(branchId?: number): Promise<Bike[]> {
    return await this.getElectronApi().dbCall('getBikes', branchId);
  }

  async createBike(bikeData: Omit<Bike, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createBike', bikeData, branchId);
  }

  async updateBike(id: number, bikeData: Partial<Omit<Bike, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateBike', id, bikeData);
  }

  async deleteBike(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteBike', id);
  }

  async getBikeServiceReminders(branchId?: number): Promise<BikeServiceReminder[]> {
    return await this.getElectronApi().dbCall('getBikeServiceReminders', branchId);
  }

  async createBikeServiceReminder(reminderData: Omit<BikeServiceReminder, 'id' | 'createdAt' | 'updatedAt'>, branchId?: number): Promise<number> {
    return await this.getElectronApi().dbCall('createBikeServiceReminder', reminderData, branchId);
  }

  async updateBikeServiceReminder(id: number, reminderData: Partial<Omit<BikeServiceReminder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateBikeServiceReminder', id, reminderData);
  }

  async deleteBikeServiceReminder(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteBikeServiceReminder', id);
  }

  async getAttendance(date: string, branchId?: number): Promise<any[]> {
    return await this.getElectronApi().dbCall('getAttendance', date, branchId);
  }

  async saveAttendance(record: any): Promise<any> {
    return await this.getElectronApi().dbCall('saveAttendance', record);
  }

  async getAttendanceReport(month: number, year: number, branchId?: number): Promise<any[]> {
    return await this.getElectronApi().dbCall('getAttendanceReport', month, year, branchId);
  }

  async getAttendanceRules(): Promise<any> {
    return await this.getElectronApi().dbCall('getAttendanceRules');
  }

  async saveAttendanceRules(rules: any): Promise<any> {
    return await this.getElectronApi().dbCall('saveAttendanceRules', rules);
  }

  async getMyAttendanceHistory(userId: number, month: number, year: number): Promise<any[]> {
    return await this.getElectronApi().dbCall('getMyAttendanceHistory', userId, month, year);
  }

  async getHolidays(branchId?: number): Promise<any[]> {
    return await this.getElectronApi().dbCall('getHolidays', branchId);
  }

  async saveHoliday(holiday: any): Promise<any> {
    return await this.getElectronApi().dbCall('saveHoliday', holiday);
  }

  async deleteHoliday(id: number): Promise<boolean> {
    return await this.getElectronApi().dbCall('deleteHoliday', id);
  }

  async getLeaveRequests(branchId?: number, userId?: number): Promise<any[]> {
    return await this.getElectronApi().dbCall('getLeaveRequests', branchId, userId);
  }

  async saveLeaveRequest(request: any): Promise<any> {
    return await this.getElectronApi().dbCall('saveLeaveRequest', request);
  }

  async updateLeaveRequestStatus(id: number, status: string, approvedBy: number, rejectReason?: string): Promise<boolean> {
    return await this.getElectronApi().dbCall('updateLeaveRequestStatus', id, status, approvedBy, rejectReason);
  }

}


// Global database instance
const browserDb = new BrowserDatabase();

export const useDatabase = () => {
  return browserDb;
};

const getActiveBranchId = () => {
  try {
    const savedUser = sessionStorage.getItem('billing_app_current_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      const bId = u.branchId !== undefined ? u.branchId : u.branchid;
      if (bId) return bId;
    }
    const savedBranch = sessionStorage.getItem('billing_app_active_branch_id');
    return savedBranch ? parseInt(savedBranch) : 1;
  } catch {
    return 1;
  }
};

export const useProducts = (branchId?: number) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const currentBranchId = getTargetBranchId();
      const productList = await db.getProducts(currentBranchId);
      
      let filteredProducts = productList || [];
      if (currentBranchId !== 0) {
        try {
          const branchesList = await db.getBranches();
          const activeBranch = (branchesList || []).find(b => Number(b.id) === Number(currentBranchId));
          if (activeBranch) {
            const activeBranchName = activeBranch.name.trim().toLowerCase();
            const categoriesList = await db.getCategories();
            filteredProducts = (productList || []).filter(p => {
              if (!p.categoryName) return true;
              const cat = categoriesList.find(c => c.name.toLowerCase() === p.categoryName.toLowerCase());
              if (!cat || !cat.allowedBranches) return true;
              const allowed = cat.allowedBranches.split(',').map((bName: string) => bName.trim().toLowerCase());
              return allowed.includes(activeBranchName);
            });
          }
        } catch (e) {
          console.error('Failed to filter products based on branch category access:', e);
        }
      }

      setProducts(filteredProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      let branchToSave: number | null = getTargetBranchId();
      try {
        const savedUser = sessionStorage.getItem('billing_app_current_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'sub_admin') {
            branchToSave = null;
          }
        }
      } catch (e) {
        console.error('Failed to resolve user role for branch mapping:', e);
      }

      const id = await db.createProduct(productData, branchToSave);
      await loadProducts(); // Reload products
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
      throw err;
    }
  };

  const updateProduct = async (id: number, productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const success = await db.updateProduct(id, productData);
      if (success) {
        await loadProducts(); // Reload products
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      throw err;
    }
  };

  const deleteProduct = async (id: number, syncToServer: boolean = true) => {
    try {
      const success = await db.deleteProduct(id, syncToServer);
      if (success) {
        await loadProducts(); // Reload products
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      throw err;
    }
  };

  const getProductByBarcode = (barcode: string): Product | null => {
    const key = String(barcode || '').trim().toLowerCase();
    return products.find(p => 
      String(p.barcode || '').trim().toLowerCase() === key ||
      (p.productCode && String(p.productCode).trim().toLowerCase() === key) ||
      (p.skuCode && String(p.skuCode).trim().toLowerCase() === key) ||
      String(p.id).trim() === key
    ) || null;
  };

  useEffect(() => {
    loadProducts();
    const handleBranchChange = () => {
      loadProducts();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    const handleSync = () => {
      loadProducts();
    };
    window.addEventListener('ecommerce-sync-completed', handleSync);
    
    const interval = setInterval(() => {
      loadProducts();
    }, 15000);

    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
      window.removeEventListener('ecommerce-sync-completed', handleSync);
      clearInterval(interval);
    };
  }, [branchId]);

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductByBarcode,
    refreshProducts: loadProducts,
  };
};

export const useCategories = (branchId?: number) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const currentBranchId = getTargetBranchId();
      const list = await db.getCategories(currentBranchId);
      
      let filteredCategories = list || [];
      if (currentBranchId !== 0) {
        try {
          const branchesList = await db.getBranches();
          const activeBranch = (branchesList || []).find(b => Number(b.id) === Number(currentBranchId));
          if (activeBranch) {
            const activeBranchName = activeBranch.name.trim().toLowerCase();
            filteredCategories = (list || []).filter(c => {
              if (!c.allowedBranches) return true;
              const allowed = c.allowedBranches.split(',').map((bName: string) => bName.trim().toLowerCase());
              return allowed.includes(activeBranchName);
            });
          }
        } catch (e) {
          console.error('Failed to filter categories based on branch access:', e);
        }
      }
      setCategories(filteredCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await db.createCategory(categoryData, getTargetBranchId());
      await loadCategories();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
      throw err;
    }
  };

  const updateCategory = async (id: number, categoryData: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const success = await db.updateCategory(id, categoryData);
      if (success) {
        await loadCategories();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
      throw err;
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      const success = await db.deleteCategory(id);
      if (success) {
        await loadCategories();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      throw err;
    }
  };

  useEffect(() => {
    loadCategories();
    const handleBranchChange = () => {
      loadCategories();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    const handleSync = () => {
      loadCategories();
    };
    window.addEventListener('ecommerce-sync-completed', handleSync);
    
    const interval = setInterval(() => {
      loadCategories();
    }, 15000);

    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
      window.removeEventListener('ecommerce-sync-completed', handleSync);
      clearInterval(interval);
    };
  }, [branchId]);

  return {
    categories,
    loading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshCategories: loadCategories,
  };
};

export const useCustomers = (branchId?: number) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const customerList = await db.getCustomers(getTargetBranchId());
      setCustomers(customerList || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      let branchToSave: number | null = getTargetBranchId();
      try {
        const savedUser = sessionStorage.getItem('billing_app_current_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          if (user.role === 'super_admin' || user.role === 'admin') {
            branchToSave = null;
          }
        }
      } catch (e) {
        console.error('Failed to resolve user role for customer branch mapping:', e);
      }

      const id = await db.createCustomer(customerData, branchToSave);
      await loadCustomers(); // Reload customers
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer');
      throw err;
    }
  };

  const deleteCustomer = async (id: number) => {
    try {
      const success = await db.deleteCustomer(id);
      if (success) {
        await loadCustomers();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
      throw err;
    }
  };

  const updateCustomer = async (id: number, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>) => {
    try {
      const success = await db.updateCustomer(id, updates);
      if (success) {
        await loadCustomers();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
      throw err;
    }
  };

  useEffect(() => {
    loadCustomers();
    const handleBranchChange = () => {
      loadCustomers();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    const handleSync = () => {
      loadCustomers();
    };
    window.addEventListener('ecommerce-sync-completed', handleSync);
    
    const interval = setInterval(() => {
      loadCustomers();
    }, 15000);

    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
      window.removeEventListener('ecommerce-sync-completed', handleSync);
      clearInterval(interval);
    };
  }, [branchId]);

  return {
    customers,
    loading,
    error,
    addCustomer,
    deleteCustomer,
    updateCustomer,
    refreshCustomers: loadCustomers,
  };
};

export const useParties = (branchId?: number) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [movements, setMovements] = useState<PartyStockMovement[]>([]);
  const [payments, setPayments] = useState<PartyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadParties = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const list = await db.getParties(getTargetBranchId());
      const movs = await db.getPartyMovements(getTargetBranchId());
      const pays = await db.getPartyPayments(getTargetBranchId());
      setParties(list || []);
      setMovements(movs || []);
      setPayments(pays || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const addParty = async (partyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await db.createParty(partyData, getTargetBranchId());
    await loadParties();
    return id;
  };

  const updateParty = async (id: number, updates: Partial<Omit<Party, 'id' | 'createdAt'>>) => {
    const success = await db.updateParty(id, updates);
    if (success) await loadParties();
    return success;
  };

  const deleteParty = async (id: number) => {
    const success = await db.deleteParty(id);
    if (success) await loadParties();
    return success;
  };

  const addMovement = async (movementData: Omit<PartyStockMovement, 'id' | 'createdAt'>) => {
    const id = await db.createPartyMovement(movementData, getTargetBranchId());
    await loadParties();
    return id;
  };

  const addPayment = async (paymentData: Omit<PartyPayment, 'id' | 'createdAt'>) => {
    const id = await db.createPartyPayment(paymentData, getTargetBranchId());
    await loadParties();
    return id;
  };

  useEffect(() => {
    loadParties();
    const handleBranchChange = () => {
      loadParties();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
    };
  }, [branchId]);

  return {
    parties,
    movements,
    payments,
    loading,
    error,
    addParty,
    updateParty,
    deleteParty,
    addMovement,
    addPayment,
    refreshParties: loadParties,
  };
};

export const useBills = (branchId?: number) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadBills = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const list = await db.getBills(getTargetBranchId());
      if (list && list.sort) {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      setBills(list || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const addBill = async (bill: Bill) => {
    try {
      const id = await db.createBill(bill, getTargetBranchId());
      await loadBills();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill');
      throw err;
    }
  };

  const updateBill = async (billNumber: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>) => {
    try {
      const success = await db.updateBill(billNumber, updates);
      if (success) {
        await loadBills();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bill');
      throw err;
    }
  };

  const getBillsByCustomer = (customerId: number) => {
    return bills.filter(b => b.customerId === customerId);
  };

  useEffect(() => {
    loadBills();
    const handleBranchChange = () => {
      loadBills();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    const handleSync = () => {
      loadBills();
    };
    window.addEventListener('ecommerce-sync-completed', handleSync);
    
    const interval = setInterval(() => {
      loadBills();
    }, 15000);

    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
      window.removeEventListener('ecommerce-sync-completed', handleSync);
      clearInterval(interval);
    };
  }, [branchId]);

  return {
    bills,
    loading,
    error,
    addBill,
    updateBill,
    refreshBills: loadBills,
    getBillsByCustomer,
  };
};

export const useTransactions = (branchId?: number) => {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const list = await db.getTransactions(getTargetBranchId());
      if (list && list.sort) {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      setTransactions(list || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    const handleBranchChange = () => {
      loadTransactions();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    const handleSync = () => {
      loadTransactions();
    };
    window.addEventListener('ecommerce-sync-completed', handleSync);
    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
      window.removeEventListener('ecommerce-sync-completed', handleSync);
    };
  }, [branchId]);

  return { transactions, loading, error, refreshTransactions: loadTransactions };
};

export interface User {
  id: number;
  username: string;
  role: 'super_admin' | 'admin' | 'sub_admin' | 'employee';
  name: string;
  branchId?: number | null;
}

export const useServices = (branchId?: number) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useDatabase();

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      await db.waitForInit();
      const list = await db.getServices(getTargetBranchId());
      setServices(list || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const addService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await db.createService(serviceData, getTargetBranchId());
      await loadServices();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service');
      throw err;
    }
  };

  const updateService = async (id: number, serviceData: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const success = await db.updateService(id, serviceData);
      if (success) {
        await loadServices();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
      throw err;
    }
  };

  const deleteService = async (id: number) => {
    try {
      const success = await db.deleteService(id);
      if (success) {
        await loadServices();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
      throw err;
    }
  };

  useEffect(() => {
    loadServices();
    const handleBranchChange = () => {
      loadServices();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
    };
  }, [branchId]);

  return {
    services,
    loading,
    error,
    addService,
    updateService,
    deleteService,
    refreshServices: loadServices
  };
};

export const useBikes = (branchId?: number) => {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadBikes = async () => {
    try {
      setLoading(true);
      const rows = await browserDb.getBikes(getTargetBranchId());
      setBikes(rows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bikes');
    } finally {
      setLoading(false);
    }
  };

  const addBike = async (bikeData: Omit<Bike, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await browserDb.createBike(bikeData, getTargetBranchId());
      await loadBikes();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bike');
      throw err;
    }
  };

  const updateBike = async (id: number, bikeData: Partial<Omit<Bike, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const success = await browserDb.updateBike(id, bikeData);
      if (success) {
        await loadBikes();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bike');
      throw err;
    }
  };

  const deleteBike = async (id: number) => {
    try {
      const success = await browserDb.deleteBike(id);
      if (success) {
        await loadBikes();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bike');
      throw err;
    }
  };

  useEffect(() => {
    loadBikes();
    const handleBranchChange = () => {
      loadBikes();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
    };
  }, [branchId]);

  return {
    bikes,
    loading,
    error,
    addBike,
    updateBike,
    deleteBike,
    refreshBikes: loadBikes
  };
};

export const useBikeServiceReminders = (branchId?: number) => {
  const [reminders, setReminders] = useState<BikeServiceReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTargetBranchId = () => branchId !== undefined ? branchId : getActiveBranchId();

  const loadReminders = async () => {
    try {
      setLoading(true);
      const rows = await browserDb.getBikeServiceReminders(getTargetBranchId());
      setReminders(rows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service reminders');
    } finally {
      setLoading(false);
    }
  };

  const addReminder = async (reminderData: Omit<BikeServiceReminder, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await browserDb.createBikeServiceReminder(reminderData, getTargetBranchId());
      await loadReminders();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service reminder');
      throw err;
    }
  };

  const updateReminder = async (id: number, reminderData: Partial<Omit<BikeServiceReminder, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const success = await browserDb.updateBikeServiceReminder(id, reminderData);
      if (success) {
        await loadReminders();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service reminder');
      throw err;
    }
  };

  const deleteReminder = async (id: number) => {
    try {
      const success = await browserDb.deleteBikeServiceReminder(id);
      if (success) {
        await loadReminders();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service reminder');
      throw err;
    }
  };

  useEffect(() => {
    loadReminders();
    const handleBranchChange = () => {
      loadReminders();
    };
    window.addEventListener('branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('branch-changed', handleBranchChange);
    };
  }, [branchId]);

  return {
    reminders,
    loading,
    error,
    addReminder,
    updateReminder,
    deleteReminder,
    refreshReminders: loadReminders
  };
};
