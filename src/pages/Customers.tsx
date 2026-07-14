import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  MapPin,
  Receipt,
  X,
  Save,
  Download,
  AlertCircle,
  Wrench,
  TrendingUp
} from 'lucide-react';
import { Customer } from '../types';
import { useCustomers, useBills } from '../hooks/useDatabase';

type Page = 'dashboard' | 'products' | 'barcodes' | 'billing' | 'customers' | 'inventory' | 'reports' | 'settings' | 'services' | 'service_bill' | 'attendance';

interface CustomersProps {
  onNavigate: (page: Page) => void;
}

const formatIndianVehicleNumber = (val: string) => {
  let clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 0) return '';
  
  // State code: max 2 letters
  let state = clean.slice(0, 2).replace(/[^A-Z]/g, '');
  let formatted = state;
  if (clean.length <= 2) return formatted;
  
  // District code: max 2 digits
  let districtIndex = state.length;
  let district = clean.slice(districtIndex, districtIndex + 2).replace(/[^0-9]/g, '');
  if (district) formatted += '-' + district;
  if (clean.length <= districtIndex + 2) return formatted;
  
  // Letters: max 3 letters
  let remaining = clean.slice(districtIndex + district.length);
  let lettersMatch = remaining.match(/^[A-Z]+/);
  let letters = lettersMatch ? lettersMatch[0].slice(0, 3) : '';
  if (letters) formatted += '-' + letters;
  
  // Digits: max 4 digits
  let digits = remaining.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 4);
  if (digits) formatted += '-' + digits;
  
  return formatted;
};

const Customers: React.FC<CustomersProps> = ({ onNavigate }) => {
  const { customers, addCustomer, deleteCustomer, updateCustomer } = useCustomers();
  const { getBillsByCustomer } = useBills();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPendingAmountModal, setShowPendingAmountModal] = useState(false);
  const [selectedCustomerForPending, setSelectedCustomerForPending] = useState<Customer | null>(null);
  const [pendingAmountMode, setPendingAmountMode] = useState<'view' | 'add' | 'deduct'>('view');
  const [pendingAmountAdjustment, setPendingAmountAdjustment] = useState<string | number>('');
  const [pendingAmountReason, setPendingAmountReason] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstNumber: '',
    vehicleName: '',
    vehicleNumber: ''
  });

  const handleInputChange = (field: string, value: string) => {
    let finalValue = value;
    if (field === 'vehicleNumber') {
      finalValue = formatIndianVehicleNumber(value);
    }
    setFormData(prev => ({
      ...prev,
      [field]: finalValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
        alert('Customer updated successfully!');
      } else {
        await addCustomer(formData);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      gstNumber: '',
      vehicleName: '',
      vehicleNumber: ''
    });
    setShowAddForm(false);
    setEditingCustomer(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      gstNumber: customer.gstNumber || '',
      vehicleName: customer.vehicleName || '',
      vehicleNumber: customer.vehicleNumber || ''
    });
    setEditingCustomer(customer);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      try {
        const ok = await deleteCustomer(id);
        if (!ok) alert('Customer not found or already deleted');
      } catch (e) {
        alert('Failed to delete customer');
      }
    }
  };

  const viewHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistory(true);
  };

  const editBillInBillingPage = (bill: any) => {
    localStorage.setItem('billing_edit_bill', JSON.stringify(bill));
    setShowHistory(false);
    onNavigate('billing');
  };

  const openPendingAmountModal = (customer: Customer) => {
    setSelectedCustomerForPending(customer);
    setPendingAmountMode('view');
    setPendingAmountAdjustment('');
    setPendingAmountReason('');
    setShowPendingAmountModal(true);
  };

  const closePendingAmountModal = () => {
    setShowPendingAmountModal(false);
    setPendingAmountAdjustment('');
    setPendingAmountReason('');
    setSelectedCustomerForPending(null);
  };

  const handlePendingAmountAdjustment = async () => {
    const adjAmount = parseFloat(String(pendingAmountAdjustment)) || 0;
    if (!selectedCustomerForPending || adjAmount <= 0) return;

    try {
      let newPendingAmount = selectedCustomerForPending.creditBalance || 0;
      const transactionHistory = selectedCustomerForPending.creditHistory || [];
      const now = new Date().toISOString();

      if (pendingAmountMode === 'add') {
        newPendingAmount += adjAmount;
        // Add transaction for pending amount added
        transactionHistory.push({
          id: Date.now(),
          customerId: selectedCustomerForPending.id,
          amount: adjAmount,
          type: 'added',
          description: `Pending amount added${pendingAmountReason ? ': ' + pendingAmountReason : ''}`,
          createdAt: now
        });
      } else if (pendingAmountMode === 'deduct') {
        newPendingAmount = Math.max(0, newPendingAmount - adjAmount);
        // Add transaction for payment recorded
        transactionHistory.push({
          id: Date.now(),
          customerId: selectedCustomerForPending.id,
          amount: -adjAmount,
          type: 'used',
          description: `Payment recorded${pendingAmountReason ? ': ' + pendingAmountReason : ''}`,
          createdAt: now
        });
      }

      await updateCustomer(selectedCustomerForPending.id, {
        creditBalance: newPendingAmount,
        creditHistory: transactionHistory
      });

      closePendingAmountModal();
      alert(`Pending amount ${pendingAmountMode === 'add' ? 'added' : 'deducted'} successfully!`);
    } catch (error) {
      console.error('Error updating pending amount:', error);
      alert('Failed to update pending amount. Please try again.');
    }
  };

  const getCustomerStats = (customerId: number) => {
    const bills = getBillsByCustomer(customerId);
    const totalSpent = bills.reduce((sum, bill) => sum + bill.finalAmount, 0);
    const totalBills = bills.length;
    const lastPurchase = bills.length > 0 ?
      new Date(Math.max(...bills.map(bill => new Date(bill.createdAt).getTime()))) : null;

    return { totalSpent, totalBills, lastPurchase };
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportCustomersCsv = () => {
    const rows: (string | number)[][] = [
      ['ID', 'Name', 'Phone', 'Email', 'Address', 'Total Bills', 'Total Spent', 'Last Purchase']
    ];
    customers.forEach(c => {
      const bills = getBillsByCustomer(c.id);
      const totalSpent = bills.reduce((s, b) => s + b.finalAmount, 0);
      const last = bills.length ? new Date(Math.max(...bills.map(b => new Date(b.createdAt).getTime()))).toLocaleDateString() : '';
      rows.push([c.id, c.name, c.phone, c.email || '', c.address || '', bills.length, totalSpent.toFixed(2), last]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Client records</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Customer Management</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Track customer details, histories, and saved bills in a cleaner layout.</p>
        </div>
        <div className="flex gap-3 xl:justify-end">
          <button
            onClick={exportCustomersCsv}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Add New Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10 w-full max-w-md"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Add/Edit Customer Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={resetForm} className="btn-icon btn-icon-neutral text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input w-full"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="input w-full"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input w-full"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="input w-full h-20 resize-none"
                  placeholder="Enter customer address"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  GST Number
                </label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => handleInputChange('gstNumber', e.target.value)}
                  className="input w-full"
                  placeholder="Enter customer GST number"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Vehicle Name
                </label>
                <input
                  type="text"
                  value={formData.vehicleName}
                  onChange={(e) => handleInputChange('vehicleName', e.target.value)}
                  className="input w-full"
                  placeholder="e.g. Swift Dzire, Honda Activa"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={formData.vehicleNumber}
                  onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                  className="input w-full"
                  placeholder="e.g. TN-10-AU-1520"
                />
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  type="submit"
                  className="btn-primary flex flex-1 items-center gap-2 px-6 py-2"
                >
                  <Save className="h-4 w-4" />
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary px-6 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showHistory && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Purchase History - {selectedCustomer.name}
              </h2>
              <button onClick={() => setShowHistory(false)} className="btn-icon btn-icon-neutral text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const customerBillHistory = getBillsByCustomer(selectedCustomer.id);
              const stats = getCustomerStats(selectedCustomer.id);

              return (
                <div>
                  {/* Customer Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="card border border-white/60 bg-white/90 shadow-soft">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-green-100 p-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Total Spent</p>
                          <p className="text-lg font-bold text-slate-900">₹{stats.totalSpent.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card border border-white/60 bg-white/90 shadow-soft">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-100 p-2">
                          <Receipt className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Total Bills</p>
                          <p className="text-lg font-bold text-slate-900">{stats.totalBills}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card border border-white/60 bg-white/90 shadow-soft">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="rounded-xl bg-orange-100 p-2">
                            <TrendingUp className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Pending Amount (Owed)</p>
                            <p className="text-lg font-bold text-orange-700">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bills History */}
                  <div className="card border border-white/60 bg-white/90 shadow-soft">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Purchase History</h3>

                    {customerBillHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <Receipt className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                        <p className="text-slate-500">No purchase history found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Bill Number</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerBillHistory.map((bill) => (
                              <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                                <td className="px-4 py-3 font-medium text-slate-900">{bill.billNumber}</td>
                                <td className="px-4 py-3 text-slate-700">
                                  {new Date(bill.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  ₹{bill.finalAmount.toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${bill.paymentMethod === 'credit' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {bill.paymentMethod}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${bill.status === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : bill.status === 'pending'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                    {bill.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => editBillInBillingPage(bill)}
                                    className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit in Billing
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Credit Transaction History */}
                  {(() => {
                    const creditBills = customerBillHistory.filter(bill => bill.paymentMethod === 'credit');
                    const manualTransactions = selectedCustomer.creditHistory || [];
                    
                    // Combine and sort all transactions
                    const allTransactions = [
                      ...creditBills.map(bill => ({
                        type: 'bill' as const,
                        id: bill.id,
                        date: bill.createdAt,
                        amount: bill.finalAmount,
                        description: `Bill ${bill.billNumber}`,
                        transactionType: 'added' as const
                      })),
                      ...manualTransactions.map(trans => ({
                        type: 'transaction' as const,
                        id: trans.id,
                        date: trans.createdAt,
                        amount: Math.abs(trans.amount),
                        description: trans.description || (trans.type === 'used' ? 'Payment Recorded' : 'Pending Added'),
                        transactionType: trans.type
                      }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    
                    const totalAdded = allTransactions
                      .filter(t => t.transactionType === 'added')
                      .reduce((sum, t) => sum + t.amount, 0);
                    
                    const totalDeducted = manualTransactions
                      .filter(t => t.type === 'used')
                      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    
                    return (
                      <div className="card border border-white/60 bg-white/90 shadow-soft">
                        <h3 className="mb-4 text-lg font-semibold text-slate-900">Credit Transactions History</h3>
                        
                        {allTransactions.length === 0 ? (
                          <div className="text-center py-8">
                            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                            <p className="text-slate-500">No credit transactions found</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                                <p className="text-xs text-blue-600 font-medium">Total Added</p>
                                <p className="text-xl font-bold text-blue-700">₹{totalAdded.toFixed(2)}</p>
                              </div>
                              {totalDeducted > 0 && (
                                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                                  <p className="text-xs text-green-600 font-medium">Total Paid</p>
                                  <p className="text-xl font-bold text-green-700">₹{totalDeducted.toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {allTransactions.map((transaction) => (
                                    <tr key={`${transaction.type}-${transaction.id}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                                      <td className="px-4 py-3 font-medium text-slate-900">{transaction.description}</td>
                                      <td className="px-4 py-3 text-slate-700">
                                        {new Date(transaction.date).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-3 text-right font-semibold">
                                        <span className={transaction.transactionType === 'added' ? 'text-blue-700' : 'text-green-700'}>
                                          {transaction.transactionType === 'added' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {transaction.transactionType === 'added' ? (
                                          <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                            Added
                                          </span>
                                        ) : (
                                          <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                            Payment
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Customers List */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Customers List</h2>
          <span className="text-sm text-slate-500">
            {filteredCustomers.length} customer(s) found
          </span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No customers found</h3>
            <p className="mb-4 text-slate-600">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary px-4 py-2"
              >
                Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => {
              const stats = getCustomerStats(customer.id);

              return (
                <div key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary-200">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{customer.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3 h-3 text-slate-400 mt-1 shrink-0" />
                            <span className="break-words text-slate-600">{customer.address}</span>
                          </div>
                        )}
                        {customer.gstNumber && (
                          <div className="flex items-center gap-2 text-primary-600 font-semibold">
                            <Receipt className="w-3 h-3 shrink-0" />
                            <span className="truncate">GSTIN: {customer.gstNumber}</span>
                          </div>
                        )}
                        {(customer.vehicleName || customer.vehicleNumber) && (
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 rounded-xl px-2 py-0.5 mt-1.5 text-[11px] w-fit">
                            <span>🚗</span>
                            <span className="truncate">
                              {customer.vehicleName || 'Vehicle'}: {customer.vehicleNumber || 'N/A'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleEdit(customer)} className="btn-icon btn-icon-primary" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(customer.id)} className="btn-icon btn-icon-danger" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Customer Stats */}
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-slate-500">Total Spent</p>
                        <p className="font-medium text-slate-900">₹{stats.totalSpent.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total Bills</p>
                        <p className="font-medium text-slate-900">{stats.totalBills}</p>
                      </div>
                    </div>

                    {/* Pending Amount Display */}
                    {(customer.creditBalance || 0) > 0 && (
                      <div className="mb-3 p-2 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-orange-600 font-medium">Pending Amount</p>
                          <p className="text-sm font-bold text-orange-700">₹{(customer.creditBalance || 0).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => openPendingAmountModal(customer)}
                          className="ml-2 px-2 py-1 text-xs bg-orange-200 text-orange-700 rounded hover:bg-orange-300 font-medium whitespace-nowrap"
                        >
                          Manage
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => viewHistory(customer)}
                        className="btn btn-secondary py-2 text-xs flex items-center justify-center gap-1.5 border-slate-200"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View History
                      </button>
                      <button
                        onClick={() => {
                          const redirectPayload = {
                            customerId: customer.id,
                            vehicleName: customer.vehicleName || '',
                            vehicleNumber: customer.vehicleNumber || ''
                          };
                          localStorage.setItem('services_redirect_customer', JSON.stringify(redirectPayload));
                          onNavigate('services');
                        }}
                        className="btn btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        View Service
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manage Pending Amount Modal */}
      {showPendingAmountModal && selectedCustomerForPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Manage Pending Amount
              </h2>
              <button onClick={closePendingAmountModal} className="btn-icon btn-icon-neutral text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              <button
                onClick={() => setPendingAmountMode('view')}
                className={`pb-3 px-4 font-medium text-sm ${pendingAmountMode === 'view'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                View
              </button>
              <button
                onClick={() => setPendingAmountMode('add')}
                className={`pb-3 px-4 font-medium text-sm ${pendingAmountMode === 'add'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Add Pending
              </button>
              <button
                onClick={() => setPendingAmountMode('deduct')}
                className={`pb-3 px-4 font-medium text-sm ${pendingAmountMode === 'deduct'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Record Payment
              </button>
            </div>

            {/* View Mode */}
            {pendingAmountMode === 'view' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-sm text-orange-600 font-medium">Current Pending Amount</p>
                  <p className="text-2xl font-bold text-orange-700">₹{(selectedCustomerForPending.creditBalance || 0).toFixed(2)}</p>
                </div>
                <p className="text-sm text-slate-600">
                  This is the amount the customer currently owes. This pending amount will be automatically deducted from their next bill.
                </p>
              </div>
            )}

            {/* Add Pending Mode */}
            {pendingAmountMode === 'add' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Amount to Add *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pendingAmountAdjustment}
                    onChange={(e) => setPendingAmountAdjustment(e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={pendingAmountReason}
                    onChange={(e) => setPendingAmountReason(e.target.value)}
                    className="input w-full h-20 resize-none"
                    placeholder="Enter reason for adding pending amount"
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">New Pending Amount:</p>
                  <p className="text-lg font-bold text-slate-900">
                    ₹{((selectedCustomerForPending.creditBalance || 0) + (parseFloat(String(pendingAmountAdjustment)) || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Deduct Mode */}
            {pendingAmountMode === 'deduct' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Amount *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={selectedCustomerForPending.creditBalance || 0}
                    value={pendingAmountAdjustment}
                    onChange={(e) => setPendingAmountAdjustment(e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Method/Notes (Optional)
                  </label>
                  <textarea
                    value={pendingAmountReason}
                    onChange={(e) => setPendingAmountReason(e.target.value)}
                    className="input w-full h-20 resize-none"
                    placeholder="e.g., Cash, Card, Online Transfer"
                  />
                </div>
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-xs text-green-600 mb-1">Remaining Pending Amount:</p>
                  <p className="text-lg font-bold text-green-700">
                    ₹{Math.max(0, (selectedCustomerForPending.creditBalance || 0) - (parseFloat(String(pendingAmountAdjustment)) || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200">
              {pendingAmountMode !== 'view' && (
                <button
                  onClick={handlePendingAmountAdjustment}
                  disabled={(parseFloat(String(pendingAmountAdjustment)) || 0) <= 0}
                  className="btn-primary flex-1 px-4 py-2"
                >
                  <Save className="h-4 w-4 inline mr-2" />
                  {pendingAmountMode === 'add' ? 'Add Pending Amount' : 'Record Payment'}
                </button>
              )}
              <button
                onClick={closePendingAmountModal}
                className="btn-secondary flex-1 px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
