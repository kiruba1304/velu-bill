import React from 'react';
import {
  Plus,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Settings as SettingsIcon,
  Printer,
} from 'lucide-react';
import { useProducts, useCustomers, useBills } from '../hooks/useDatabase';
import { Bill } from '../types';
import {
  generateQRData,
  generateThermalCompactReceipt,
  generateThermalDetailedReceipt,
  generateThermalStandardReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt,
} from '../utils/templateGenerator';

type Page = 'dashboard' | 'products' | 'barcodes' | 'billing' | 'customers' | 'inventory' | 'reports' | 'settings' | 'attendance';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { products, loading: productsLoading } = useProducts();
  const { customers, loading: customersLoading } = useCustomers();

  // Calculate real statistics
  const totalProducts = products.length;
  const totalCustomers = customers.length;
  const lowStockItems = products.filter(p => p.count <= 10).length;
  const totalValue = products.reduce((sum, p) => sum + (p.count * p.costPrice), 0);

  const stats = [
    {
      title: 'Total Products',
      value: totalProducts.toString(),
      change: productsLoading ? 'Loading...' : `${totalProducts} items`,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Customers',
      value: totalCustomers.toString(),
      change: customersLoading ? 'Loading...' : `${totalCustomers} customers`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Inventory Value',
      value: `₹${totalValue.toLocaleString()}`,
      change: `Total stock value`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Low Stock Alert',
      value: lowStockItems.toString(),
      change: lowStockItems > 0 ? 'Needs attention' : 'All good',
      icon: AlertTriangle,
      color: lowStockItems > 0 ? 'text-red-600' : 'text-green-600',
      bgColor: lowStockItems > 0 ? 'bg-red-50' : 'bg-green-50'
    }
  ];

  const quickActions = [
    {
      title: 'Create New Bill',
      description: 'Start a new billing session',
      icon: Plus,
      action: () => onNavigate('billing'),
      color: 'bg-primary-600 hover:bg-primary-700'
    },
    {
      title: 'Add Product',
      description: 'Add new product to inventory',
      icon: Package,
      action: () => onNavigate('products'),
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Customer History',
      description: 'View customer purchase history',
      icon: Users,
      action: () => onNavigate('customers'),
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'View Reports',
      description: 'Check sales and inventory reports',
      icon: TrendingUp,
      action: () => onNavigate('reports'),
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      title: 'Settings',
      description: 'Configure store, backups, and more',
      icon: SettingsIcon,
      action: () => onNavigate('settings'),
      color: 'bg-gray-700 hover:bg-gray-800'
    }
  ];

  const lowStockProducts = products.filter(p => p.count <= 10).slice(0, 3);

  const { bills, loading: billsLoading } = useBills();

  const recentBills = bills.slice(0, 5);

  const handlePrintBill = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const appSettingsRaw = localStorage.getItem('app_settings');
    const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : {};
    
    const settings = {
      storeName: appSettings.storeName || 'SASHVIKA SAREES',
      upiId: appSettings.upiId || '',
      bankAccountNumber: appSettings.bankAccountNumber || '',
      bankIfscCode: appSettings.bankIfscCode || '',
      accountHolderName: appSettings.accountHolderName || '',
      address: appSettings.address || '',
      phone: appSettings.phone || '',
      gstNumber: appSettings.gstNumber || '',
      showGst: appSettings.showGst !== undefined ? appSettings.showGst : true,
      footerMessage: appSettings.footerMessage || '',
      logoUrl: appSettings.logoUrl || ''
    };

    const qrData = generateQRData(bill, settings);
    
    // Get selected template, default to thermal-standard
    const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';

    let receiptHTML = '';

    switch (selectedTemplate) {
      case 'thermal-compact':
        receiptHTML = generateThermalCompactReceipt(bill, settings, qrData);
        break;
      case 'thermal-detailed':
        receiptHTML = generateThermalDetailedReceipt(bill, settings, qrData);
        break;
      case 'regular-a5':
        receiptHTML = generateRegularA5Receipt(bill, settings, qrData);
        break;
      case 'regular-a4':
        receiptHTML = generateRegularA4Receipt(bill, settings, qrData);
        break;
      case 'regular-a4-detailed':
        receiptHTML = generateRegularA4DetailedReceipt(bill, settings, qrData);
        break;
      case 'thermal-standard':
      default:
        receiptHTML = generateThermalStandardReceipt(bill, settings, qrData);
    }

    const api = (window as any).electronAPI;
    if (api?.printHtml) {
      try { (printWindow as any).close(); } catch { }
      const selectedReceiptPrinter = localStorage.getItem('receipt_printer_name') || '';
      api.printHtml(receiptHTML, { deviceName: selectedReceiptPrinter || undefined })
        .catch((err: any) => {
          const errMsg = err?.message || String(err);
          if (errMsg.includes('canceled') || errMsg.includes('cancelled')) {
            console.log('Print job was canceled by the user.');
            return;
          }
          alert('Print failed: ' + errMsg);
        });
      return;
    }

    (printWindow as any).document.write(receiptHTML);
    (printWindow as any).document.close();
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Overview</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-600">A clean view of sales, stock, and customers with quick access to the most common actions.</p>
        </div>
        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-200 shadow-soft">
          Live inventory and billing status
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  <p className={`mt-1 text-sm ${stat.color}`}>{stat.change} from yesterday</p>
                </div>
                <div className={`rounded-2xl p-3 ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.action}
                className={`group rounded-2xl p-6 text-left text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${action.color}`}
              >
                <Icon className="mb-4 h-8 w-8 transition-transform duration-200 group-hover:scale-105" />
                <h3 className="mb-1 text-lg font-semibold">{action.title}</h3>
                <p className="text-sm opacity-90">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="mb-4 flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-slate-900">Low Stock Alert</h2>
          </div>
          <div className="space-y-3">
            {lowStockProducts.length > 0 ? lowStockProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between rounded-2xl bg-orange-50/80 p-3">
                <div>
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-600">Current: {product.count} | Company: {product.company}</p>
                </div>
                <span className="badge bg-orange-200 text-orange-900">
                  Low Stock
                </span>
              </div>
            )) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No low stock items</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Bills */}
        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Bills</h2>
            <button 
              onClick={() => onNavigate('billing')}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {billsLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading bills...</p>
              </div>
            ) : recentBills.length > 0 ? (
              recentBills.map((bill, index) => {
                const customer = customers.find(c => c.id === bill.customerId);
                const customerName = customer?.name || bill.customer?.name || 'Walk-in Customer';
                return (
                  <div key={index} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3 hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900">{bill.billNumber}</p>
                      <p className="text-sm text-slate-600">
                        {customerName}
                      </p>
                    </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">₹{bill.finalAmount.toFixed(2)}</p>
                      <p className="text-sm text-slate-600">
                        {new Date(bill.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePrintBill(bill)}
                      className="btn-icon btn-icon-neutral text-slate-500 hover:text-primary-600 p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-primary-100 transition-all"
                      title="Preview and Print Bill"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No recent bills available</p>
                <button 
                  onClick={() => onNavigate('billing')}
                  className="mt-2 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary/10 px-3 py-1.5 rounded-full"
                >
                  Create your first bill
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
