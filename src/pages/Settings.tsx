import React, { useEffect, useState } from 'react';
import { Download, Save, Database, Upload, Users, UserPlus, Edit, Trash2, Building2, PhoneCall } from 'lucide-react';
import { useProducts, useCustomers, useBills, useTransactions, useDatabase, useCategories } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';

const Settings: React.FC = () => {
  const db = useDatabase();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { bills } = useBills();
  const { transactions } = useTransactions();

  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [backupDir, setBackupDir] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [showGst, setShowGst] = useState(true);
  const [gstInclusive, setGstInclusive] = useState(false);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [footerMessage, setFooterMessage] = useState('');
  const [ecommerceApiUrl, setEcommerceApiUrl] = useState('');
  const [ecommerceApiKey, setEcommerceApiKey] = useState('');
  const [ecommerceSyncInterval, setEcommerceSyncInterval] = useState<number>(10);

  const [ivrApiUrl, setIvrApiUrl] = useState('');
  const [ivrApiKey, setIvrApiKey] = useState('');
  const [ivrCallerId, setIvrCallerId] = useState('');
  const [ivrVirtualNumber, setIvrVirtualNumber] = useState('');
  const [ivrMethod, setIvrMethod] = useState('POST');
  const [ivrPayloadTemplate, setIvrPayloadTemplate] = useState('');
  const [ivrApiId, setIvrApiId] = useState('');
  const [ivrApiPassword, setIvrApiPassword] = useState('');
  const [ivrVendorAccountId, setIvrVendorAccountId] = useState('');
  const [ivrDuration, setIvrDuration] = useState('');
  const [ivrVoiceNote, setIvrVoiceNote] = useState('');
  const [ivrTitle, setIvrTitle] = useState('');

  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedReceiptPrinter, setSelectedReceiptPrinter] = useState<string>(() => localStorage.getItem('receipt_printer_name') || '');
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string>(() => localStorage.getItem('label_printer_name') || '');

  const { isSuperAdmin, isAdmin, isSubAdmin, currentUser, branches, refreshBranches } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'employee' as 'super_admin' | 'admin' | 'sub_admin' | 'employee',
    branchId: '' as string | number
  });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);

  const { categories, updateCategory } = useCategories(0); // Pass 0 to fetch all categories unfiltered
  const [selectedSettingBranch, setSelectedSettingBranch] = useState<string>('');
  const [branchCategoriesMap, setBranchCategoriesMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (branches.length > 0 && !selectedSettingBranch) {
      setSelectedSettingBranch(branches[0].name);
    }
  }, [branches]);

  useEffect(() => {
    if (selectedSettingBranch) {
      const map: Record<number, boolean> = {};
      categories.forEach(c => {
        const allowed = (c.allowedBranches || '')
          .split(',')
          .map(b => b.trim().toLowerCase());
        map[c.id] = allowed.includes(selectedSettingBranch.trim().toLowerCase());
      });
      setBranchCategoriesMap(map);
    }
  }, [selectedSettingBranch, categories]);

  const handleBranchCategoryToggle = (categoryId: number) => {
    setBranchCategoriesMap(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const saveBranchCategoryAccess = async () => {
    try {
      if (!selectedSettingBranch) {
        alert('Please select a branch first.');
        return;
      }

      for (const category of categories) {
        const isAllowedForSelected = !!branchCategoriesMap[category.id];
        const currentBranches = (category.allowedBranches || '')
          .split(',')
          .map(b => b.trim())
          .filter(Boolean);

        let updatedBranches;
        const exists = currentBranches.some(b => b.toLowerCase() === selectedSettingBranch.toLowerCase());

        if (isAllowedForSelected && !exists) {
          updatedBranches = [...currentBranches, selectedSettingBranch];
        } else if (!isAllowedForSelected && exists) {
          updatedBranches = currentBranches.filter(b => b.toLowerCase() !== selectedSettingBranch.toLowerCase());
        } else {
          continue; // No change needed
        }

        await updateCategory(category.id, {
          allowedBranches: updatedBranches.join(',')
        });
      }
      alert('Branch-based category access settings saved successfully!');
    } catch (e) {
      console.error('Failed to save branch category settings:', e);
      alert('Failed to save settings. Please try again.');
    }
  };

  const loadUsers = async () => {
    try {
      setUserLoading(true);
      const list = await db.getUsers();
      // Filter list based on role and branch assignment
      if (isSubAdmin) {
        setUsers((list || []).filter(u => u.role === 'employee' && u.branchId === currentUser?.branchId));
      } else if (!isSuperAdmin && isAdmin) {
        setUsers((list || []).filter(u => u.role === 'employee' || u.role === 'sub_admin'));
      } else {
        setUsers(list || []);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin || isAdmin || isSubAdmin) {
      loadUsers();
    }
  }, [isSuperAdmin, isAdmin, isSubAdmin]);

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedBranchId = isSubAdmin
        ? (currentUser?.branchId || null)
        : ((userForm.role === 'employee' || userForm.role === 'sub_admin')
          ? (userForm.branchId ? parseInt(userForm.branchId as string) : null)
          : null);

      if (editingUserId) {
        await db.updateUser(editingUserId, {
          username: userForm.username.trim(),
          name: userForm.name.trim(),
          role: userForm.role,
          branchId: selectedBranchId,
          ...(userForm.password ? { password: userForm.password } : {})
        });
      } else {
        if (!userForm.password) {
          alert('Password is required for new users.');
          return;
        }
        await db.createUser({
          username: userForm.username.trim(),
          password: userForm.password,
          name: userForm.name.trim(),
          role: userForm.role,
          branchId: selectedBranchId
        });
      }
      alert('User details saved successfully!');
      resetUserForm();
      loadUsers();
    } catch (err: any) {
      alert('Failed to save user: ' + (err.message || String(err)));
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (id === currentUser?.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await db.deleteUser(id);
      alert('User deleted successfully.');
      loadUsers();
    } catch (err: any) {
      alert('Failed to delete user: ' + (err.message || String(err)));
    }
  };

  const resetUserForm = () => {
    setUserForm({ 
      username: '', 
      password: '', 
      name: '', 
      role: 'employee', 
      branchId: isSubAdmin && currentUser?.branchId ? String(currentUser.branchId) : '' 
    });
    setEditingUserId(null);
    setShowUserForm(false);
  };

  // Branch CRUD State & Handlers
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    gst: ''
  });

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim()) {
      alert('Branch name is required.');
      return;
    }
    try {
      if (editingBranchId) {
        await db.updateBranch(editingBranchId, branchForm);
        alert('Branch updated successfully!');
      } else {
        await db.createBranch(branchForm);
        alert('Branch created successfully!');
      }
      setBranchForm({ name: '', address: '', phone: '', gst: '' });
      setEditingBranchId(null);
      setShowBranchForm(false);
      await refreshBranches();
    } catch (err: any) {
      alert('Failed to save branch: ' + (err.message || String(err)));
    }
  };

  const handleDeleteBranch = async (id: number) => {
    if (id === 1) {
      alert('The Main Branch (ID: 1) cannot be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to delete this branch? Doing so might leave associated data in an orphan state.')) return;
    try {
      await db.deleteBranch(id);
      alert('Branch deleted successfully.');
      await refreshBranches();
    } catch (err: any) {
      alert('Failed to delete branch: ' + (err.message || String(err)));
    }
  };

  const { refreshPermissions, activeBranchId } = useAuth();
  const [configTargetType, setConfigTargetType] = useState<'role' | 'user'>('role');
  const [selectedConfigRole, setSelectedConfigRole] = useState<'employee' | 'sub_admin'>('employee');
  const [selectedConfigUser, setSelectedConfigUser] = useState<string>('');
  const [selectedConfigBranch, setSelectedConfigBranch] = useState<number>(1);
  const [rolePages, setRolePages] = useState<string[]>([]);
  const [savePermsLoading, setSavePermsLoading] = useState(false);

  // Initialize selectedConfigBranch when activeBranchId is loaded
  useEffect(() => {
    if (activeBranchId) {
      setSelectedConfigBranch(activeBranchId);
    }
  }, [activeBranchId]);

  // Set default user selection when users list or selected branch changes
  useEffect(() => {
    const branchUsers = users.filter(u => 
      (u.role === 'employee' || u.role === 'sub_admin') && 
      Number(u.branchId) === selectedConfigBranch
    );
    
    // Check if currently selected user is in the active branch list
    const isCurrentUserValid = branchUsers.some(u => u.username === selectedConfigUser);
    
    if (!isCurrentUserValid) {
      setSelectedConfigUser(branchUsers.length > 0 ? branchUsers[0].username : '');
    }
  }, [users, selectedConfigBranch, configTargetType]);

  const loadPermissionsData = async () => {
    try {
      if (configTargetType === 'role') {
        const perms = await db.getRolePermissions(selectedConfigRole, selectedConfigBranch);
        setRolePages(perms || []);
      } else if (configTargetType === 'user' && selectedConfigUser) {
        const perms = await db.getUserPermissions(selectedConfigUser, selectedConfigBranch);
        setRolePages(perms || []);
      } else {
        setRolePages([]);
      }
    } catch (e) {
      console.error(`Failed to load permissions:`, e);
    }
  };

  useEffect(() => {
    if (isSuperAdmin || isAdmin || isSubAdmin) {
      loadPermissionsData();
    }
  }, [isSuperAdmin, isAdmin, isSubAdmin, configTargetType, selectedConfigRole, selectedConfigUser, selectedConfigBranch]);

  const handlePagePermissionToggle = (pageId: string) => {
    setRolePages(prev =>
      prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
    );
  };

  const handleSavePermissions = async () => {
    if (rolePages.length === 0) {
      alert(`Access configurations must have at least one authorized page.`);
      return;
    }
    try {
      setSavePermsLoading(true);
      if (configTargetType === 'role') {
        await db.updateRolePermissions(selectedConfigRole, selectedConfigBranch, rolePages);
        alert(`Page access levels saved successfully for Role: ${selectedConfigRole === 'employee' ? 'Employee' : 'Sub Admin'} (Branch ID: ${selectedConfigBranch})!`);
      } else {
        if (!selectedConfigUser) {
          alert('Please select a user account to configure.');
          return;
        }
        await db.updateUserPermissions(selectedConfigUser, selectedConfigBranch, rolePages);
        alert(`Page access levels saved successfully for User: ${selectedConfigUser} (Branch ID: ${selectedConfigBranch})!`);
      }
      await refreshPermissions();
    } catch (err: any) {
      alert('Failed to save permissions: ' + (err.message || String(err)));
    } finally {
      setSavePermsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('app_settings');
      const settings = raw ? JSON.parse(raw) : {};
      setStoreName(settings.storeName || 'SASHVIKA SAREES');
      setLogoUrl(settings.logoUrl || '');
      setUpiId(settings.upiId || '');
      setBankAccountNumber(settings.bankAccountNumber || '');
      setBankIfscCode(settings.bankIfscCode || '');
      setAccountHolderName(settings.accountHolderName || '');
      setAddress(settings.address || '32-F, Near Eswaran Temple, Kadaiveethi, Idappadi – 637101');
      setPhone(settings.phone || '9965326590, 9047656890');
      setGstNumber(settings.gstNumber || '');
      setShowGst(settings.showGst !== undefined ? settings.showGst : true);
      setGstInclusive(settings.gstInclusive || false);
      setGstPercentage(settings.gstPercentage !== undefined ? parseFloat(settings.gstPercentage) : 18);
      setEcommerceApiUrl(settings.ecommerceApiUrl || 'http://localhost:5500/api');
      setEcommerceApiKey(settings.ecommerceApiKey || '');
      setEcommerceSyncInterval(settings.ecommerceSyncInterval !== undefined ? parseInt(settings.ecommerceSyncInterval) : 10);
      setIvrApiUrl(settings.ivrApiUrl || '');
      setIvrApiKey(settings.ivrApiKey || '');
      setIvrCallerId(settings.ivrCallerId || '');
      setIvrVirtualNumber(settings.ivrVirtualNumber || '');
      setIvrMethod(settings.ivrMethod || 'POST');
      setIvrPayloadTemplate(settings.ivrPayloadTemplate || '{"api_key":"{api_key}","from":"{virtual_number}","to":"{customer_phone}","message":"Dear {customer_name}, your {bike_model} service #{service_no} is due on {scheduled_date}."}');
      setIvrApiId(settings.ivrApiId || '');
      setIvrApiPassword(settings.ivrApiPassword || '');
      setIvrVendorAccountId(settings.ivrVendorAccountId || '');
      setIvrDuration(settings.ivrDuration || '');
      setIvrVoiceNote(settings.ivrVoiceNote || '');
      setIvrTitle(settings.ivrTitle || '');
      setFooterMessage(settings.footerMessage || 'Thank you for your business!');
    } catch { }
    try {
      const dir = localStorage.getItem('backup_directory') || '';
      setBackupDir(dir);
    } catch { }

    try {
      const api = (window as any).electronAPI;
      if (api?.listPrinters) {
        api.listPrinters()
          .then((list: any[]) => setPrinters(list || []))
          .catch(() => setPrinters([]));
      }
    } catch { }
  }, []);

  const handleReceiptPrinterChange = (name: string) => {
    setSelectedReceiptPrinter(name);
  };

  const handleLabelPrinterChange = (name: string) => {
    setSelectedLabelPrinter(name);
  };

  const savePrinterSettings = () => {
    if (selectedReceiptPrinter) {
      localStorage.setItem('receipt_printer_name', selectedReceiptPrinter);
    } else {
      localStorage.removeItem('receipt_printer_name');
    }

    if (selectedLabelPrinter) {
      localStorage.setItem('label_printer_name', selectedLabelPrinter);
    } else {
      localStorage.removeItem('label_printer_name');
    }

    alert('Printer settings saved successfully!');
  };

  const testEcommerceConnection = async () => {
    if (!ecommerceApiUrl || !ecommerceApiKey) {
      alert('Please fill in both E-Commerce URL and API Key.');
      return;
    }
    try {
      const response = await fetch(`${ecommerceApiUrl.replace(/\/$/, '')}/billing/sync/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: ecommerceApiKey })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        alert(`Connection successful! Connected to shop: ${resData.shop_name}`);
      } else {
        alert(`Connection failed: ${resData.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Network error connecting to E-Commerce site: ${e.message || String(e)}`);
    }
  };

  const triggerEcommerceSync = () => {
    window.dispatchEvent(new Event('trigger-ecommerce-sync'));
    alert('Synchronization process triggered in background...');
  };

  const saveSettings = () => {
    const existingRaw = localStorage.getItem('app_settings');
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const next = { 
      ...existing, 
      storeName: storeName || 'SASHVIKA SAREES',
      logoUrl: logoUrl,
      upiId: upiId.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankIfscCode: bankIfscCode.trim(),
      accountHolderName: accountHolderName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      gstNumber: gstNumber.trim(),
      showGst: showGst,
      gstInclusive: gstInclusive,
      gstPercentage: gstPercentage,
      ecommerceApiUrl: ecommerceApiUrl.trim(),
      ecommerceApiKey: ecommerceApiKey.trim(),
      ecommerceSyncInterval: ecommerceSyncInterval,
      ivrApiUrl: ivrApiUrl.trim(),
      ivrApiKey: ivrApiKey.trim(),
      ivrCallerId: ivrCallerId.trim(),
      ivrVirtualNumber: ivrVirtualNumber.trim(),
      ivrMethod: ivrMethod,
      ivrPayloadTemplate: ivrPayloadTemplate,
      ivrApiId: ivrApiId.trim(),
      ivrApiPassword: ivrApiPassword.trim(),
      ivrVendorAccountId: ivrVendorAccountId.trim(),
      ivrDuration: ivrDuration.trim(),
      ivrVoiceNote: ivrVoiceNote.trim(),
      ivrTitle: ivrTitle.trim(),
      footerMessage: footerMessage.trim()
    };
    localStorage.setItem('app_settings', JSON.stringify(next));
    alert('Settings saved');
  };

  const downloadCsv = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportProducts = () => {
    const rows: (string | number)[][] = [
      ['ID', 'SKU Code', 'Name', 'Company', 'Stock', 'Cost', 'Selling', 'Discount', 'GST', 'Final', 'Barcode', 'HSN Code', 'Created', 'Updated'],
      ...products.map(p => [
        p.id, p.skuCode || p.productCode || '', p.name, p.company, p.count,
        p.costPrice.toFixed(2), p.sellingPrice.toFixed(2), p.discount,
        p.gst.toFixed(2), p.finalPrice.toFixed(2), p.barcode, p.hsnCode || '',
        p.createdAt, p.updatedAt
      ])
    ];
    downloadCsv(rows, 'products.csv');
  };

  const exportCustomers = () => {
    const rows: (string | number)[][] = [
      ['ID', 'Name', 'Phone', 'Email', 'Address', 'Created', 'Updated'],
      ...customers.map(c => [c.id, c.name, c.phone, c.email || '', c.address || '', c.createdAt, c.updatedAt])
    ];
    downloadCsv(rows, 'customers.csv');
  };

  const exportBills = () => {
    const rows: (string | number)[][] = [
      ['ID', 'Bill No', 'CustomerId', 'Date', 'Total', 'Discount', 'GST', 'Final', 'Payment', 'Status', 'ItemsCount'],
      ...bills.map(b => [
        b.id, b.billNumber, b.customerId || '', b.createdAt,
        b.totalAmount.toFixed(2), b.totalDiscount.toFixed(2), b.totalGst.toFixed(2),
        b.finalAmount.toFixed(2), b.paymentMethod, b.status, (b.items || []).length
      ])
    ];
    downloadCsv(rows, 'bills.csv');
  };

  const exportTransactions = () => {
    const rows: (string | number)[][] = [
      ['ID', 'ProductId', 'Type', 'Qty', 'Reason', 'BillId', 'Created'],
      ...transactions.map(t => [t.id, t.productId, t.type, t.quantity, t.reason, t.billId || '', t.createdAt])
    ];
    downloadCsv(rows, 'inventory_transactions.csv');
  };

  const chooseBackupDirectory = async () => {
    try {
      const api = (window as any).electronAPI;
      if (!api || !api.chooseBackupDirectory) {
        alert('You are running in browser mode (or Electron API is unavailable). Backups will be downloaded to your default Downloads folder instead of a specific directory.');
        return;
      }
      const chosen = await api.chooseBackupDirectory();
      if (chosen) {
        localStorage.setItem('backup_directory', chosen);
        setBackupDir(chosen);
        alert('Backup folder set to: ' + chosen);
      }
    } catch (e: any) {
      console.error('Failed to choose backup directory:', e);
      alert('Failed to choose folder: ' + (e?.message || String(e)));
    }
  };

  const runBackupNow = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `billing_backup_${today}.sql`;
      const content = await db.generateSqlDump();

      const api = (window as any).electronAPI;

      if (api && api.saveJson) {
        // Desktop Mode
        const dir = backupDir || localStorage.getItem('backup_directory');
        if (!dir) {
          alert('Please select a backup folder first.');
          return;
        }
        // Reusing saveJson for text content (it just writes string to file)
        const fullPath = await api.saveJson(fileName, content, dir);
        localStorage.setItem('last_backup_date', today);
        alert('Backup saved: ' + fullPath);
      } else {
        // Browser Fallback
        downloadJson(content, fileName);

        localStorage.setItem('last_backup_date', today);
        alert('Backup downloaded to your default Downloads folder.');
      }
    } catch (e: any) {
      alert('Backup failed: ' + (e?.message || String(e)));
    }
  };

  const handleImportSql = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSuperAdmin) {
      alert('Only Super Administrators are authorized to restore SQL backups.');
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Importing this backup will completely replace your current database. All products, customers, bills, transactions, and parties will be overwritten. Do you want to proceed?')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const sqlContent = e.target?.result as string;
      if (!sqlContent) {
        alert('Failed to read the backup file.');
        return;
      }

      try {
        const success = await db.importSqlDump(sqlContent);
        if (success) {
          alert('Database restored successfully! The application will now reload to apply the restored data.');
          window.location.reload();
        } else {
          alert('Failed to restore database: The SQL file content was invalid or empty.');
        }
      } catch (err: any) {
        alert('Restore failed: ' + (err?.message || String(err)));
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = async () => {
    if (!isSuperAdmin) {
      alert('Only Super Administrators are authorized to clear the database.');
      return;
    }
    if (!confirm('This will permanently delete all products, customers, bills, transactions, service job cards, bikes, and service reminders. Continue?')) return;
    try {
      await db.wipeDatabase();
      alert('All application data cleared. The app will reload now.');
      window.location.reload();
    } catch (e: any) {
      alert('Failed to clear database: ' + (e?.message || String(e)));
    }
  };


  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Administration</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Export data, customize receipts, and manage backups in one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Receipt Customization</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Store Logo</label>
              <div className="flex items-center gap-4 mt-1">
                {logoUrl ? (
                  <div className="relative w-20 h-20 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                    <img src={logoUrl} alt="Store logo" className="max-w-full max-h-full object-contain" />
                    <button 
                      type="button" 
                      onClick={() => setLogoUrl('')} 
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all flex items-center justify-center w-5 h-5 text-[10px] font-bold"
                      title="Remove logo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">No Logo</span>
                  </div>
                )}
                <label className="btn-secondary px-4 py-2 cursor-pointer text-sm font-semibold flex items-center gap-2">
                  Upload Image
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          setLogoUrl(event.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }} 
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Recommended: Square format (PNG/JPG). Displays beautifully on top of A4 bills.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Store Name</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input w-full" placeholder="Enter store name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Footer Message</label>
              <input type="text" value={footerMessage} onChange={(e) => setFooterMessage(e.target.value)} className="input w-full" placeholder="e.g., Thank you for shopping with us!" />
            </div>
            <button onClick={saveSettings} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Store Contact & GST Customization</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Store Address</label>
              <textarea 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                className="input w-full h-auto py-2" 
                rows={2} 
                placeholder="Enter store address" 
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Store Mobile Number</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="input w-full" 
                placeholder="Enter mobile number" 
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">GST Number</label>
              <input 
                type="text" 
                value={gstNumber} 
                onChange={(e) => setGstNumber(e.target.value)} 
                className="input w-full" 
                placeholder="e.g., 22AAAAA1111A1Z1" 
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default GST Percentage (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                step="0.01"
                value={gstPercentage} 
                onChange={(e) => setGstPercentage(parseFloat(e.target.value) || 0)} 
                className="input w-full" 
                placeholder="e.g., 18" 
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <label className="text-sm font-semibold text-slate-900">Show GST Number on Invoices</label>
                <p className="text-xs text-slate-500">Toggle whether to display the GST number in bill templates.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGst(!showGst)}
                style={{ backgroundColor: showGst ? 'var(--primary)' : '#cbd5e1' }}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showGst ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <label className="text-sm font-semibold text-slate-900">GST Calculation Mode</label>
                <p className="text-xs text-slate-500">{gstInclusive ? "Inclusive (GST is included in selling price)" : "Exclusive (GST is added on top of selling price)"}</p>
              </div>
              <button
                type="button"
                onClick={() => setGstInclusive(!gstInclusive)}
                style={{ backgroundColor: gstInclusive ? 'var(--primary)' : '#cbd5e1' }}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gstInclusive ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            <button onClick={saveSettings} className="btn-primary inline-flex items-center gap-2 px-4 py-2 mt-2">
              <Save className="h-4 w-4" /> Save Contact Details
            </button>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Export Data</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={exportProducts} className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" /> Products CSV
            </button>
            <button onClick={exportCustomers} className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" /> Customers CSV
            </button>
            <button onClick={exportBills} className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" /> Bills CSV
            </button>
            <button onClick={exportTransactions} className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" /> Inventory CSV
            </button>
          </div>
        </div>


        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Database Backup</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Backup Folder</label>
              <div className="flex gap-2">
                <input type="text" className="input flex-1" value={backupDir} readOnly placeholder="Not set" />
                <button onClick={chooseBackupDirectory} className="btn-secondary px-4 py-2">Browse…</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Choose a local folder (e.g., D:\Backups). A daily backup will be saved as billing_backup_YYYY-MM-DD.sql</p>
            </div>
            <div className="flex gap-2">
              <button onClick={runBackupNow} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                <Database className="h-4 w-4" /> Backup Now (SQL)
              </button>
              
              {isSuperAdmin && (
                <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 px-4 py-2">
                  <Upload className="h-4 w-4" /> Import SQL Backup
                  <input type="file" accept=".sql" className="hidden" onChange={handleImportSql} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">E-Commerce Integration Sync</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Website Sync Endpoint URL</label>
              <input 
                type="text" 
                value={ecommerceApiUrl} 
                onChange={(e) => setEcommerceApiUrl(e.target.value)} 
                className="input w-full" 
                placeholder="e.g., http://localhost:5000/api" 
              />
              <p className="mt-1 text-xs text-slate-500">Your online shop backend base API URL.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Billing Sync API Key</label>
              <input 
                type="password" 
                value={ecommerceApiKey} 
                onChange={(e) => setEcommerceApiKey(e.target.value)} 
                className="input w-full" 
                placeholder="Paste the generated key from website admin..." 
              />
              <p className="mt-1 text-xs text-slate-500">Generate this key in the Store settings of your website admin panel.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sync Interval (seconds)</label>
              <input 
                type="number" 
                min="5" 
                value={ecommerceSyncInterval} 
                onChange={(e) => setEcommerceSyncInterval(parseInt(e.target.value) || 10)} 
                className="input w-full" 
                placeholder="e.g., 10" 
              />
              <p className="mt-1 text-xs text-slate-500">How frequently the app automatically syncs with the website (minimum 5 seconds).</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={testEcommerceConnection} className="btn-secondary px-4 py-2 text-sm">
                Test Connection
              </button>
              <button onClick={triggerEcommerceSync} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                Sync Now
              </button>
              <button onClick={saveSettings} className="btn-secondary px-4 py-2 text-sm">
                Save Sync Details
              </button>
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary-500" /> IVR Call Configuration
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">IVR API URL</label>
                <input 
                  type="text" 
                  value={ivrApiUrl} 
                  onChange={(e) => setIvrApiUrl(e.target.value)} 
                  className="input w-full" 
                  placeholder="e.g., https://api.ivrprovider.com/call" 
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">IVR API Key</label>
                <input 
                  type="password" 
                  value={ivrApiKey} 
                  onChange={(e) => setIvrApiKey(e.target.value)} 
                  className="input w-full" 
                  placeholder="Enter IVR API Key..." 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">API ID</label>
                  <input 
                    type="text" 
                    value={ivrApiId} 
                    onChange={(e) => setIvrApiId(e.target.value)} 
                    className="input w-full" 
                    placeholder="Your API ID (e.g. BulkSMSPlans API ID)" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">API Password</label>
                  <input 
                    type="password" 
                    value={ivrApiPassword} 
                    onChange={(e) => setIvrApiPassword(e.target.value)} 
                    className="input w-full" 
                    placeholder="Your API Password / Secret" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Vendor Account ID</label>
                  <input 
                    type="text" 
                    value={ivrVendorAccountId} 
                    onChange={(e) => setIvrVendorAccountId(e.target.value)} 
                    className="input w-full" 
                    placeholder="e.g. 123" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Voice Note / File URL</label>
                  <input 
                    type="text" 
                    value={ivrVoiceNote} 
                    onChange={(e) => setIvrVoiceNote(e.target.value)} 
                    className="input w-full" 
                    placeholder="e.g. reminder.mp3" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Voice Duration</label>
                  <input 
                    type="text" 
                    value={ivrDuration} 
                    onChange={(e) => setIvrDuration(e.target.value)} 
                    className="input w-full" 
                    placeholder="e.g. 0:30" 
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Voice Media Title</label>
                <input 
                  type="text" 
                  value={ivrTitle} 
                  onChange={(e) => setIvrTitle(e.target.value)} 
                  className="input w-full" 
                  placeholder="e.g. Service Reminder Title" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">IVR Caller ID / Sender ID</label>
                  <input 
                    type="text" 
                    value={ivrCallerId} 
                    onChange={(e) => setIvrCallerId(e.target.value)} 
                    className="input w-full" 
                    placeholder="e.g., SENDER" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Virtual / Agent Number</label>
                  <input 
                    type="text" 
                    value={ivrVirtualNumber} 
                    onChange={(e) => setIvrVirtualNumber(e.target.value)} 
                    className="input w-full" 
                    placeholder="e.g., 918888888888" 
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">HTTP Method</label>
                <select 
                  value={ivrMethod} 
                  onChange={(e) => setIvrMethod(e.target.value)} 
                  className="input w-full"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payload / Query Parameters Template</label>
                <textarea 
                  value={ivrPayloadTemplate} 
                  onChange={(e) => setIvrPayloadTemplate(e.target.value)} 
                  className="input w-full h-24 font-mono text-xs" 
                  placeholder={`e.g., {"api_id":"{api_id}","api_password":"{api_password}","title":"{title}","vendor_account_id":"{vendor_account_id}","duration":"{duration}","voice_note":"{voice_note}"}`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Available placeholders: <code>{`{api_id}`}</code>, <code>{`{api_password}`}</code>, <code>{`{vendor_account_id}`}</code>, <code>{`{voice_note}`}</code>, <code>{`{duration}`}</code>, <code>{`{title}`}</code>, <code>{`{api_key}`}</code>, <code>{`{virtual_number}`}</code>, <code>{`{caller_id}`}</code>, <code>{`{customer_phone}`}</code>, <code>{`{customer_name}`}</code>, <code>{`{bike_model}`}</code>, <code>{`{service_no}`}</code>, <code>{`{scheduled_date}`}</code>.
                </p>
              </div>
              <button onClick={saveSettings} className="btn-primary inline-flex items-center gap-2 px-4 py-2 mt-2">
                <Save className="h-4 w-4" /> Save IVR Settings
              </button>
            </div>
          </div>
        )}

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Payment Method Account Details</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">UPI ID</label>
              <input 
                type="text" 
                value={upiId} 
                onChange={(e) => setUpiId(e.target.value)} 
                className="input w-full" 
                placeholder="e.g., user@upi" 
              />
              <p className="mt-1 text-xs text-slate-500">Your UPI ID for receiving payments via QR code</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bank Account Number</label>
              <input 
                type="text" 
                value={bankAccountNumber} 
                onChange={(e) => setBankAccountNumber(e.target.value)} 
                className="input w-full" 
                placeholder="e.g., 1234567890" 
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bank IFSC Code</label>
              <input 
                type="text" 
                value={bankIfscCode} 
                onChange={(e) => setBankIfscCode(e.target.value)} 
                className="input w-full" 
                placeholder="e.g., SBIN0001234" 
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Account Holder Name</label>
              <input 
                type="text" 
                value={accountHolderName} 
                onChange={(e) => setAccountHolderName(e.target.value)} 
                className="input w-full" 
                placeholder="Your business/personal name" 
              />
            </div>
            <button onClick={saveSettings} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Save className="h-4 w-4" /> Save Payment Details
            </button>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Printer Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default Receipt Printer</label>
              <select
                value={selectedReceiptPrinter}
                onChange={(e) => handleReceiptPrinterChange(e.target.value)}
                className="input w-full"
                title="Select Receipt Printer"
              >
                <option value="">Interactive (Show Print Dialog)</option>
                {printers.map((p: any) => (
                  <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Select your thermal receipt printer for silent, instant printing during checkout.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default Barcode Label Printer</label>
              <select
                value={selectedLabelPrinter}
                onChange={(e) => handleLabelPrinterChange(e.target.value)}
                className="input w-full"
                title="Select Label Printer"
              >
                <option value="">Select Label Printer...</option>
                {printers.map((p: any) => (
                  <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Select your label printer (e.g. TVS LP46 Dlite) to use when printing product labels.</p>
            </div>

            <button onClick={savePrinterSettings} className="btn-primary inline-flex items-center gap-2 px-4 py-2 mt-2">
              <Save className="h-4 w-4" /> Save Printer Settings
            </button>
          </div>
        </div>

        {(isSuperAdmin || isAdmin) && (
          <div className="card border border-white/60 bg-white/85 shadow-soft lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-slate-900">Branch Management</h2>
              </div>
              {!showBranchForm && (
                <button
                  onClick={() => {
                    setBranchForm({ name: '', address: '', phone: '', gst: '' });
                    setEditingBranchId(null);
                    setShowBranchForm(true);
                  }}
                  className="btn-primary flex items-center gap-2 px-4 py-2"
                >
                  <Building2 className="h-4 w-4" /> Add Branch
                </button>
              )}
            </div>

            {showBranchForm ? (
              <form onSubmit={handleBranchSubmit} className="space-y-4 max-w-xl p-6 rounded-3xl border border-slate-200 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-950">
                  {editingBranchId ? 'Edit Branch Details' : 'Create New Branch'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
                    <input
                      type="text"
                      required
                      value={branchForm.name}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. Salem Branch"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">GST Number (Optional)</label>
                    <input
                      type="text"
                      value={branchForm.gst}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, gst: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. 33AAAAA1111A1Z1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. 12 Main St, City"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="btn-primary px-5 py-2">Save Branch</button>
                  <button type="button" onClick={() => setShowBranchForm(false)} className="btn-secondary px-5 py-2">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                {branches.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-medium">No branches found.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ID</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch Name</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Address</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">GST Number</th>
                        <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {branches.map(b => (
                        <tr key={b.id}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">#{b.id}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{b.name}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">{b.address || 'N/A'}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">{b.phone || 'N/A'}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">{b.gst || 'N/A'}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingBranchId(b.id);
                                  setBranchForm({
                                    name: b.name || '',
                                    address: b.address || '',
                                    phone: b.phone || '',
                                    gst: b.gst || ''
                                  });
                                  setShowBranchForm(true);
                                }}
                                className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-slate-100 rounded-xl transition-all"
                                title="Edit Branch"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBranch(b.id)}
                                disabled={b.id === 1}
                                className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                                title="Delete Branch"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {(isSuperAdmin || isAdmin || isSubAdmin) && (
          <div className="card border border-white/60 bg-white/85 shadow-soft lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
              </div>
              {!showUserForm && (
                <button
                  onClick={() => {
                    resetUserForm();
                    setShowUserForm(true);
                  }}
                  className="btn-primary flex items-center gap-2 px-4 py-2"
                >
                  <UserPlus className="h-4 w-4" /> Add User
                </button>
              )}
            </div>

            {showUserForm ? (
              <form onSubmit={handleUserSubmit} className="space-y-4 max-w-xl p-6 rounded-3xl border border-slate-200 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-950">
                  {editingUserId ? 'Edit User Details' : 'Create New User Account'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username (Login ID)</label>
                    <input
                      type="text"
                      required
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      className="input w-full"
                      placeholder="e.g. johndoe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {editingUserId ? 'Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required={!editingUserId}
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      className="input w-full"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Role</label>
                    <select
                      value={userForm.role}
                      disabled={isSubAdmin}
                      onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as any }))}
                      className="input w-full disabled:bg-slate-100 disabled:opacity-75"
                      title="Select Role"
                    >
                      <option value="employee">Employee</option>
                      {!isSubAdmin && <option value="sub_admin">Sub Admin</option>}
                      {isSuperAdmin && (
                        <>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </>
                      )}
                    </select>
                  </div>
                  {(userForm.role === 'employee' || userForm.role === 'sub_admin') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Assign Branch</label>
                      <select
                        required
                        disabled={isSubAdmin}
                        value={userForm.branchId}
                        onChange={(e) => setUserForm(prev => ({ ...prev, branchId: e.target.value }))}
                        className="input w-full disabled:bg-slate-100 disabled:opacity-75"
                        title="Select Branch"
                      >
                        <option value="">Select Branch...</option>
                        {branches.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="btn-primary px-5 py-2">Save Account</button>
                  <button type="button" onClick={resetUserForm} className="btn-secondary px-5 py-2">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                {userLoading ? (
                  <div className="p-8 text-center text-slate-500 font-medium">Loading user accounts...</div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-medium">No users found.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Username</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created Date</th>
                        <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {users.map(u => (
                        <tr key={u.id}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{u.name || 'N/A'}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">{u.username}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                              u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              u.role === 'sub_admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : u.role === 'sub_admin' ? 'Sub Admin' : 'Employee'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">
                            {u.branchId ? (branches.find(b => b.id == u.branchId)?.name || `Branch #${u.branchId}`) : 'All Branches'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setUserForm({
                                    username: u.username,
                                    password: '',
                                    name: u.name || '',
                                    role: u.role,
                                    branchId: u.branchId !== null && u.branchId !== undefined ? String(u.branchId) : ''
                                  });
                                  setShowUserForm(true);
                                }}
                                className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-slate-100 rounded-xl transition-all"
                                title="Edit User"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.id === currentUser?.id}
                                className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {(isSuperAdmin || isAdmin || isSubAdmin) && (
          <div className="card border border-white/60 bg-white/85 shadow-soft lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-slate-900">Branch-Specific Page Access Control</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Configure page authorization policies separately by **User Account** or **General Role**, isolated per individual **Store Branch**.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
              {/* Target Type Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Configuration Type</label>
                <select
                  value={configTargetType}
                  onChange={(e) => {
                    setConfigTargetType(e.target.value as 'role' | 'user');
                    setRolePages([]);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-500 cursor-pointer font-bold"
                >
                  <option value="role">By General Role</option>
                  <option value="user">By Dedicated User Account</option>
                </select>
              </div>

              {/* Role/User Selector */}
              <div>
                {configTargetType === 'role' ? (
                  <>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Target Role</label>
                    <select
                      value={selectedConfigRole}
                      onChange={(e) => setSelectedConfigRole(e.target.value as 'employee' | 'sub_admin')}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-500 cursor-pointer font-bold"
                    >
                      <option value="employee">Employee</option>
                      {!isSubAdmin && <option value="sub_admin">Sub Admin</option>}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Dedicated User</label>
                    <select
                      value={selectedConfigUser}
                      onChange={(e) => setSelectedConfigUser(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-500 cursor-pointer font-bold"
                    >
                      <option value="">-- Choose User Account --</option>
                      {users
                        .filter(u => (u.role === 'employee' || u.role === 'sub_admin') && Number(u.branchId) === selectedConfigBranch)
                        .map(u => (
                          <option key={u.id} value={u.username}>
                            {u.name} ({u.username} - {u.role === 'employee' ? 'Employee' : 'Sub Admin'})
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </div>

              {/* Branch Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Store Branch</label>
                <select
                  value={selectedConfigBranch}
                  disabled={isSubAdmin}
                  onChange={(e) => setSelectedConfigBranch(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-500 cursor-pointer font-bold disabled:opacity-75 disabled:bg-slate-100"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID: {b.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'accounts', label: 'Accounts' },
                { id: 'billing', label: 'New Bill' },
                { id: 'services', label: 'Service Tickets' },
                { id: 'service_bill', label: 'Service Billing' },
                { id: 'sale_bike', label: 'Sale Bike' },
                { id: 'products', label: 'Products Catalog' },
                { id: 'categories', label: 'Categories' },
                { id: 'barcodes', label: 'Barcodes Manager' },
                { id: 'customers', label: 'Customers Database' },
                { id: 'inventory', label: 'Inventory' },
                { id: 'parties', label: 'Parties Ledger' },
                { id: 'reports', label: 'Sales Reports' },
                { id: 'templates', label: 'INV Templates' },
                { id: 'online_orders', label: 'Online Orders' },
                { id: 'settings', label: 'Settings Panel' },
                { id: 'attendance', label: 'Attendance' },
                { id: 'attendance_modify', label: 'Modify Attendance' }
              ].map(page => (
                <label key={page.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rolePages.includes(page.id)}
                    onChange={() => handlePagePermissionToggle(page.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-semibold text-slate-800">{page.label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleSavePermissions}
              disabled={savePermsLoading || (configTargetType === 'user' && !selectedConfigUser)}
              className="btn-primary inline-flex items-center gap-2 px-5 py-2"
            >
              <Save className="h-4 w-4" />
              {savePermsLoading ? 'Saving...' : 'Save Authorized Access Levels'}
            </button>
          </div>
        )}

        {(isSuperAdmin || isAdmin || isSubAdmin) && (
          <div className="card border border-white/60 bg-white/85 shadow-soft lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-slate-900">Branch-Based Category Access Control</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Configure which product categories are visible in each store branch. Products in unselected categories will be hidden in that branch.
            </p>

            <div className="max-w-xs mb-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Store Branch</label>
              <select
                value={selectedSettingBranch}
                onChange={(e) => setSelectedSettingBranch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-500 cursor-pointer font-bold"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-500 italic col-span-full">No categories found. Create categories first in the Categories page.</p>
              ) : (
                categories.map(category => (
                  <label key={category.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!branchCategoriesMap[category.id]}
                      disabled={!isSuperAdmin && !isAdmin}
                      onChange={() => (isSuperAdmin || isAdmin) && handleBranchCategoryToggle(category.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60"
                    />
                    <span className="text-sm font-semibold text-slate-800">{category.name}</span>
                  </label>
                ))
              )}
            </div>

            {(isSuperAdmin || isAdmin) && (
              <button
                onClick={saveBranchCategoryAccess}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2"
              >
                <Save className="h-4 w-4" />
                Save Category Access Rules
              </button>
            )}
          </div>
        )}

        {isSuperAdmin && (
          <div className="card border border-red-100 bg-gradient-to-br from-red-50 to-white shadow-soft">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Danger Zone</h2>
            <p className="mb-3 text-sm text-slate-600">Clear all data from the local database (products, customers, bills, transactions, service job cards, bikes, and service reminders).</p>
            <button onClick={clearAllData} className="btn-danger px-4 py-2">Clear All Data</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;

