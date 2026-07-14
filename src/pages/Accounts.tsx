import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase, useExpenses } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Calculator, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  X,
  Upload,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { Bill, PartyPayment } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const Accounts: React.FC = () => {
  const db = useDatabase();
  const { activeBranchId, isAdmin, isSuperAdmin } = useAuth();
  
  const { expenses: customExpensesList, addExpense, deleteExpense, refreshExpenses } = useExpenses(activeBranchId);

  // Custom Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseType, setExpenseType] = useState<'Store Expense' | 'Staff Expense' | 'Customer Expense'>('Store Expense');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [viewingBillImage, setViewingBillImage] = useState<string | null>(null);
  const [expensesTab, setExpensesTab] = useState<'vendor' | 'custom'>('vendor');

  // State variables
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PartyPayment[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCard, setActiveCard] = useState<'sales' | 'expenses' | 'profit'>('sales');
  
  // Search query for breakdowns
  const [breakdownSearch, setBreakdownSearch] = useState<string>('');

  // Editable row values local state
  const [gridData, setGridData] = useState<{
    [month: number]: { customSales: string; customExpenses: string; notes: string }
  }>({});

  // Years options for selector
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 5; y <= current + 2; y++) {
      years.push(y);
    }
    return years.reverse();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load custom accounts from DB
      const monthlyData = await db.getMonthlyAccounts(selectedYear, activeBranchId);

      // Load bills for auto sales calculation
      const billsData = await db.getBills(activeBranchId);
      setBills(billsData || []);

      // Load party payments for auto expenses
      const paymentsData = await db.getPartyPayments(activeBranchId);
      setPayments(paymentsData || []);

      // Load party names to resolve in payments breakdown
      const partiesData = await db.getParties(activeBranchId);
      setParties(partiesData || []);

      // Fetch custom expenses directly to sum them up for the selected month
      const detailedExpList = await db.getExpenses(selectedYear, selectedMonth, activeBranchId);
      const customExpensesSum = (detailedExpList || []).reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

      // Initialize grid editable data
      const initialGrid: typeof gridData = {};
      for (let m = 1; m <= 12; m++) {
        const record = (monthlyData || []).find((r: any) => r.month === m);
        let customExpVal = record ? String(record.customExpenses) : '0';
        if (m === selectedMonth) {
          customExpVal = String(customExpensesSum);
        }
        initialGrid[m] = {
          customSales: record ? String(record.customSales) : '0',
          customExpenses: customExpVal,
          notes: record ? record.notes || '' : ''
        };
      }
      setGridData(initialGrid);

      // Refresh the useExpenses list hook state
      await refreshExpenses(selectedYear, selectedMonth);
    } catch (error) {
      console.error('Failed to load accounts data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, activeBranchId]);

  // Safe Date parsing helper
  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  };

  // Auto-calculated monthly values from DB
  const autoCalculatedMonthly = useMemo(() => {
    const monthlySales: { [month: number]: number } = {};
    const monthlyExpenses: { [month: number]: number } = {};

    // Initialize all months with 0
    for (let m = 1; m <= 12; m++) {
      monthlySales[m] = 0;
      monthlyExpenses[m] = 0;
    }

    // Accumulate sales from bills
    bills.forEach(bill => {
      const d = parseDateStr(bill.createdAt);
      if (d && d.getFullYear() === selectedYear) {
        const month = d.getMonth() + 1; // 1-indexed
        monthlySales[month] += Number(bill.finalAmount || 0);
      }
    });

    // Accumulate expenses from party payments
    payments.forEach(pay => {
      const d = parseDateStr(pay.createdAt);
      if (d && d.getFullYear() === selectedYear) {
        const month = d.getMonth() + 1; // 1-indexed
        monthlyExpenses[month] += Number(pay.amount || 0);
      }
    });

    return { sales: monthlySales, expenses: monthlyExpenses };
  }, [bills, payments, selectedYear]);

  // Handle auto-saving notes on blur
  const handleSaveNotes = async (month: number) => {
    const input = gridData[month];
    if (!input) return;

    try {
      const autoSalesVal = autoCalculatedMonthly.sales[month] || 0;
      await db.saveMonthlyAccount({
        year: selectedYear,
        month: month,
        customSales: autoSalesVal,
        customExpenses: parseFloat(input.customExpenses) || 0,
        notes: input.notes,
        branchId: activeBranchId === 0 ? 1 : activeBranchId
      });
      await db.getMonthlyAccounts(selectedYear, activeBranchId);
    } catch (e) {
      console.error('Failed to save monthly account notes:', e);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (!expenseTitle.trim()) {
      alert('Please enter an expense title.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    try {
      // 1. Create expense row in the Expenses table
      await addExpense({
        type: expenseType,
        title: expenseTitle.trim(),
        amount,
        date: expenseDate,
        billImage
      });

      // 2. Fetch the updated list of expenses for the selected month to calculate the new sum
      const detailedExpList = await db.getExpenses(selectedYear, selectedMonth, activeBranchId);
      const newExpensesSum = (detailedExpList || []).reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

      // 3. Save the new customExpenses to the MonthlyAccounts table
      await db.saveMonthlyAccount({
        year: selectedYear,
        month: selectedMonth,
        customSales: autoCalculatedMonthly.sales[selectedMonth] || 0,
        customExpenses: newExpensesSum,
        notes: gridData[selectedMonth]?.notes || '',
        branchId: activeBranchId === 0 ? 1 : activeBranchId
      });

      // 4. Refresh our local grid and state data
      await loadData();

      // 5. Reset modal fields & close modal
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setBillImage(null);
      setShowExpenseModal(false);
      alert('Expense logged successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save expense.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBillImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this custom expense?')) return;

    try {
      // 1. Delete expense row
      await deleteExpense(id);

      // 2. Fetch updated list to calculate new sum
      const detailedExpList = await db.getExpenses(selectedYear, selectedMonth, activeBranchId);
      const newExpensesSum = (detailedExpList || []).reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

      // 3. Save new sum to MonthlyAccounts
      await db.saveMonthlyAccount({
        year: selectedYear,
        month: selectedMonth,
        customSales: autoCalculatedMonthly.sales[selectedMonth] || 0,
        customExpenses: newExpensesSum,
        notes: gridData[selectedMonth]?.notes || '',
        branchId: activeBranchId === 0 ? 1 : activeBranchId
      });

      // 4. Refresh grid and state
      await loadData();
      alert('Expense deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete expense.');
    }
  };

  // Overall totals for cards (filtered by selected month)
  const summaryTotals = useMemo(() => {
    const customData = gridData[selectedMonth] || { customSales: '0', customExpenses: '0' };
    
    // Income amount comes from sales only
    const autoSales = autoCalculatedMonthly.sales[selectedMonth] || 0;
    const customSales = autoSales; 
    
    const customExpenses = parseFloat(customData.customExpenses) || 0;
    const autoExpenses = autoCalculatedMonthly.expenses[selectedMonth] || 0;

    const customProfit = customSales - customExpenses;
    const autoProfit = autoSales - autoExpenses;

    return {
      customSales,
      customExpenses,
      customProfit,
      autoSales,
      autoExpenses,
      autoProfit
    };
  }, [gridData, autoCalculatedMonthly, selectedMonth]);

  // Excel conditioning styles
  const getProfitCellClass = (val: number) => {
    if (val > 0) return 'bg-emerald-50 text-emerald-700 font-bold';
    if (val < 0) return 'bg-red-50 text-red-700 font-bold';
    return 'text-slate-500';
  };

  // Filter Invoices for Breakdown (filtered by selected month)
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const d = parseDateStr(bill.createdAt);
      if (!d || d.getFullYear() !== selectedYear || (d.getMonth() + 1) !== selectedMonth) return false;
      
      // Search filter
      const searchKey = breakdownSearch.toLowerCase();
      if (!searchKey) return true;

      const customerName = bill.customer?.name || '';
      return (
        bill.billNumber.toLowerCase().includes(searchKey) ||
        customerName.toLowerCase().includes(searchKey) ||
        (bill.paymentMethod || '').toLowerCase().includes(searchKey)
      );
    });
  }, [bills, selectedYear, selectedMonth, breakdownSearch]);

  // Filter Party Payments for Breakdown (filtered by selected month)
  const filteredPayments = useMemo(() => {
    return payments.filter(pay => {
      const d = parseDateStr(pay.createdAt);
      if (!d || d.getFullYear() !== selectedYear || (d.getMonth() + 1) !== selectedMonth) return false;

      const searchKey = breakdownSearch.toLowerCase();
      if (!searchKey) return true;

      const party = parties.find(p => p.id === pay.partyId);
      const partyName = party ? party.name : '';
      return (
        partyName.toLowerCase().includes(searchKey) ||
        (pay.method || '').toLowerCase().includes(searchKey) ||
        (pay.referenceNo || '').toLowerCase().includes(searchKey) ||
        (pay.notes || '').toLowerCase().includes(searchKey)
      );
    });
  }, [payments, parties, selectedYear, selectedMonth, breakdownSearch]);

  // Filter Custom Expenses for Breakdown (filtered by selected month)
  const filteredCustomExpenses = useMemo(() => {
    return customExpensesList.filter(exp => {
      const searchKey = breakdownSearch.toLowerCase();
      if (!searchKey) return true;

      return (
        exp.title.toLowerCase().includes(searchKey) ||
        exp.type.toLowerCase().includes(searchKey) ||
        String(exp.amount).includes(searchKey)
      );
    });
  }, [customExpensesList, breakdownSearch]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur border border-white/60 p-6 rounded-3xl shadow-soft">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-500/10 rounded-2xl text-primary-600 border border-primary-500/20">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts Ledger</h1>
            <p className="text-sm text-slate-500 font-medium">Manage and audit custom sales, budgets, and actual financial profit</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              title="Select Accounts Month"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={index + 1} value={index + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              title="Select Accounts Year"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y} Accounts</option>
              ))}
            </select>
          </div>

          <button 
            onClick={loadData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sales Card */}
        <div 
          onClick={() => setActiveCard('sales')}
          className={`card cursor-pointer transition-all duration-300 p-6 border rounded-3xl shadow-soft flex flex-col justify-between relative overflow-hidden group ${
            activeCard === 'sales' 
              ? 'border-blue-500 bg-blue-50/70 shadow-lg ring-1 ring-blue-500/30' 
              : 'border-white/60 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <FileSpreadsheet className="h-32 w-32 text-blue-900" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 border border-blue-500/20">
              <DollarSign className="h-6 w-6" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              activeCard === 'sales' ? 'bg-blue-200/50 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              Click to view sales details
            </span>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500">Monthly Sales (Invoices)</h3>
            <p className="text-3xl font-black text-slate-900 mt-1">₹{summaryTotals.customSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-xs font-semibold text-slate-500 relative z-10">
            <span>Sales from Bills: ₹{summaryTotals.autoSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="flex items-center gap-1 text-emerald-600">
              <ArrowUpRight className="h-3 w-3" /> Ledger Active
            </span>
          </div>
        </div>

        {/* Expenses Card */}
        <div 
          onClick={() => setActiveCard('expenses')}
          className={`card cursor-pointer transition-all duration-300 p-6 border rounded-3xl shadow-soft flex flex-col justify-between relative overflow-hidden group ${
            activeCard === 'expenses' 
              ? 'border-amber-500 bg-amber-50/70 shadow-lg ring-1 ring-amber-500/30' 
              : 'border-white/60 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <TrendingDown className="h-32 w-32 text-amber-900" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600 border border-amber-500/20">
              <TrendingDown className="h-6 w-6" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              activeCard === 'expenses' ? 'bg-amber-200/50 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}>
              Click to view expenses details
            </span>
          </div>
          <div className="mt-4 flex justify-between items-center relative z-10">
            <div>
              <h3 className="text-sm font-semibold text-slate-500">Monthly Custom Expenses</h3>
              <p className="text-3xl font-black text-slate-900 mt-1">₹{summaryTotals.customExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowExpenseModal(true);
              }}
              className="btn bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition-all relative z-20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-xs font-semibold text-slate-500 relative z-10">
            <span>Auto Expenses: ₹{summaryTotals.autoExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="flex items-center gap-1 text-red-500">
              <ArrowDownRight className="h-3 w-3" /> Costs Tracked
            </span>
          </div>
        </div>

        {/* Profit Card */}
        <div 
          onClick={() => setActiveCard('profit')}
          className={`card cursor-pointer transition-all duration-300 p-6 border rounded-3xl shadow-soft flex flex-col justify-between relative overflow-hidden group ${
            activeCard === 'profit' 
              ? 'border-emerald-500 bg-emerald-50/70 shadow-lg ring-1 ring-emerald-500/30' 
              : 'border-white/60 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <TrendingUp className="h-32 w-32 text-emerald-900" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 border border-emerald-500/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              activeCard === 'profit' ? 'bg-emerald-200/50 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              Click to view profit audit
            </span>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500">Monthly Net Profit</h3>
            <p className={`text-3xl font-black mt-1 ${summaryTotals.customProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              ₹{summaryTotals.customProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/50 flex items-center justify-between text-xs font-semibold text-slate-500 relative z-10">
            <span>Auto Profit: ₹{summaryTotals.autoProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className={`flex items-center gap-0.5 ${summaryTotals.customProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {summaryTotals.customProfit >= 0 ? '+' : ''}
              {(((summaryTotals.customProfit) / (summaryTotals.customSales || 1)) * 100).toFixed(1)}% Margin
            </span>
          </div>
        </div>
      </div>

      {/* Excel Sheet input section */}
      <div className="card border border-white/60 bg-white/85 shadow-soft overflow-hidden rounded-3xl">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Custom Accounts Ledger for {MONTH_NAMES[selectedMonth - 1]} ({selectedYear})</h2>
          </div>
          <div className="text-[10px] font-bold text-slate-400 bg-slate-200/60 rounded-full px-2.5 py-1 uppercase tracking-widest">
            Spreadsheet Editor (Auto-computes totals)
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
            Loading accounts editor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-800">
              <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 border-r border-slate-200 w-12 text-center">No</th>
                  <th className="px-6 py-4 border-r border-slate-200 w-40">Month</th>
                  <th className="px-6 py-4 border-r border-slate-200 w-48 text-right bg-blue-50/50 text-blue-900">Incoming Sales (₹)</th>
                  <th className="px-6 py-4 border-r border-slate-200 w-48 text-right bg-amber-50/50 text-amber-900">Custom Expenses (₹)</th>
                  <th className="px-6 py-4 border-r border-slate-200 w-40 text-right text-slate-500">Auto Expenses (₹)</th>
                  <th className="px-6 py-4 border-r border-slate-200 w-44 text-right">Net Profit (₹)</th>
                  <th className="px-6 py-4 border-r border-slate-200 min-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(() => {
                  const m = selectedMonth;
                  const monthName = MONTH_NAMES[m - 1];
                  const autoSalesVal = autoCalculatedMonthly.sales[m] || 0;
                  const customSalesVal = autoSalesVal; // overridden, comes from sales only
                  const customExpensesVal = parseFloat(gridData[m]?.customExpenses) || 0;
                  const netProfit = customSalesVal - customExpensesVal;

                  const autoExpensesVal = autoCalculatedMonthly.expenses[m] || 0;

                  return (
                    <tr key={m} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 border-r border-slate-200 font-semibold text-slate-400 text-center">{m}</td>
                      <td className="px-6 py-3 border-r border-slate-200 font-bold text-slate-900">{monthName}</td>
                      
                      {/* Incoming Sales Indicator (Disabled edit, comes from sales only) */}
                      <td className="px-6 py-3 border-r border-slate-200 text-right font-bold text-blue-900 bg-blue-50/5">
                        ₹{autoSalesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Custom Expenses (Read-Only) */}
                      <td className="px-6 py-3 border-r border-slate-200 text-right font-bold text-amber-950 bg-amber-50/5">
                        ₹{customExpensesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Auto Expenses Indicator */}
                      <td className="px-6 py-3 border-r border-slate-200 text-right text-slate-500 font-semibold">
                        ₹{autoExpensesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Net Profit (Spreadsheet Color Coded) */}
                      <td className={`px-6 py-3 border-r border-slate-200 text-right font-bold ${getProfitCellClass(netProfit)}`}>
                        ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Notes Input */}
                      <td className="px-3 py-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          value={gridData[m]?.notes || ''}
                          onChange={(e) => setGridData(prev => ({
                            ...prev,
                            [m]: { ...prev[m], notes: e.target.value }
                          }))}
                          onBlur={() => handleSaveNotes(m)}
                          className="w-full bg-transparent border-0 outline-none focus:ring-1 focus:ring-slate-300 rounded p-1 text-slate-700 font-medium"
                          placeholder="Add comments..."
                        />
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card Detail Breakdowns */}
      <div className="card border border-white/60 bg-white/85 shadow-soft rounded-3xl overflow-hidden p-6 space-y-6">
        
        {/* Breakdown Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              {activeCard === 'sales' && `Sales Ledger Audit Breakdown (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`}
              {activeCard === 'expenses' && `Expenses Ledger Audit Breakdown (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`}
              {activeCard === 'profit' && `Monthly Profit & Net Budget margins (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`}
            </h2>
          </div>

          {activeCard !== 'profit' && (
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger entries..."
                value={breakdownSearch}
                onChange={(e) => setBreakdownSearch(e.target.value)}
                className="input pl-9 w-full text-xs font-semibold py-2"
              />
            </div>
          )}
        </div>

        {/* Breakdown Render */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          
          {/* Sales Breakdown */}
          {activeCard === 'sales' && (
            filteredBills.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-semibold italic">No recorded invoice invoices match the criteria.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5 text-left">Invoice No</th>
                    <th className="px-6 py-3.5 text-left">Date</th>
                    <th className="px-6 py-3.5 text-left">Customer</th>
                    <th className="px-6 py-3.5 text-right">Taxable Subtotal</th>
                    <th className="px-6 py-3.5 text-right">Total GST</th>
                    <th className="px-6 py-3.5 text-right bg-blue-50/50 text-blue-900">Final Bill Total (₹)</th>
                    <th className="px-6 py-3.5 text-left">Method</th>
                    <th className="px-6 py-3.5 text-left">Channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm">
                  {filteredBills.map(bill => {
                    const customerName = bill.customer ? bill.customer.name : 'Walk-in Customer';
                    const date = parseDateStr(bill.createdAt);
                    return (
                      <tr key={bill.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{bill.billNumber}</td>
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          {date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-semibold">{customerName}</td>
                        <td className="px-6 py-4 text-right text-slate-600 font-medium">
                          ₹{Number(bill.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 font-medium">
                          ₹{Number(bill.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-extrabold text-blue-800 bg-blue-50/10">
                          ₹{Number(bill.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold leading-5 text-slate-800 capitalize">
                            {bill.paymentMethod || 'cash'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium uppercase text-xs">{bill.salesChannel || 'pos'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* Expenses Breakdown */}
          {activeCard === 'expenses' && (
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex gap-2 border-b border-slate-200 pb-3">
                <button
                  onClick={() => setExpensesTab('vendor')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    expensesTab === 'vendor'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Vendor Expenses (Auto)
                </button>
                <button
                  onClick={() => setExpensesTab('custom')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    expensesTab === 'custom'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Detailed Custom Expenses
                </button>
              </div>

              {expensesTab === 'vendor' ? (
                filteredPayments.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-semibold italic">No recorded vendor expense payments match the criteria.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5 text-left">Payment ID</th>
                        <th className="px-6 py-3.5 text-left">Date</th>
                        <th className="px-6 py-3.5 text-left">Party/Vendor Name</th>
                        <th className="px-6 py-3.5 text-right bg-amber-50/50 text-amber-900">Amount Paid (₹)</th>
                        <th className="px-6 py-3.5 text-left">Payment Method</th>
                        <th className="px-6 py-3.5 text-left">Reference No</th>
                        <th className="px-6 py-3.5 text-left">Description / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white text-sm">
                      {filteredPayments.map(pay => {
                        const party = parties.find(p => p.id === pay.partyId);
                        const partyName = party ? party.name : `Party ID #${pay.partyId}`;
                        const date = parseDateStr(pay.createdAt);
                        return (
                          <tr key={pay.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">#PAY-{pay.id}</td>
                            <td className="px-6 py-4 text-slate-500 font-medium">
                              {date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-semibold">{partyName}</td>
                            <td className="px-6 py-4 text-right font-extrabold text-amber-800 bg-amber-50/10">
                              ₹{Number(pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold leading-5 text-slate-800 capitalize">
                                {pay.method || 'Cash'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-semibold">{pay.referenceNo || 'N/A'}</td>
                            <td className="px-6 py-4 text-slate-500 font-medium truncate max-w-xs" title={pay.notes}>{pay.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                filteredCustomExpenses.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-semibold italic">No recorded custom expenses match the criteria.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5 text-left">Expense ID</th>
                        <th className="px-6 py-3.5 text-left">Date</th>
                        <th className="px-6 py-3.5 text-left">Title / Purpose</th>
                        <th className="px-6 py-3.5 text-left">Expense Type</th>
                        <th className="px-6 py-3.5 text-right bg-amber-50/50 text-amber-900">Amount (₹)</th>
                        <th className="px-6 py-3.5 text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white text-sm">
                      {filteredCustomExpenses.map((exp: any) => {
                        const date = parseDateStr(exp.date);
                        return (
                          <tr key={exp.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">#EXP-{exp.id}</td>
                            <td className="px-6 py-4 text-slate-500 font-medium">
                              {date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : exp.date || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-semibold">{exp.title}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                                exp.type === 'Store Expense' ? 'bg-indigo-100 text-indigo-800' :
                                exp.type === 'Staff Expense' ? 'bg-sky-100 text-sky-800' :
                                'bg-pink-100 text-pink-800'
                              }`}>
                                {exp.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-amber-800 bg-amber-50/10">
                              ₹{Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-center space-x-2 flex justify-center items-center">
                              {exp.billImage && (isAdmin || isSuperAdmin) && (
                                <button
                                  onClick={() => setViewingBillImage(exp.billImage)}
                                  className="text-primary-600 hover:text-primary-900 hover:bg-primary-50 p-1.5 rounded-lg transition-colors inline-flex items-center"
                                  title="View Receipt / Bill"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="text-red-600 hover:text-red-900 hover:bg-red-50 p-1.5 rounded-lg transition-colors inline-flex items-center"
                                title="Delete Custom Expense"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}

          {/* Net Profit Breakdown (filtered to selected month) */}
          {activeCard === 'profit' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3.5 text-left">Month</th>
                  <th className="px-6 py-3.5 text-right">Incoming Sales (₹)</th>
                  <th className="px-6 py-3.5 text-right">Expenses Budget (₹)</th>
                  <th className="px-6 py-3.5 text-right bg-emerald-50/50 text-emerald-950">Net Custom Profit (₹)</th>
                  <th className="px-6 py-3.5 text-right">Auto Profit (₹)</th>
                  <th className="px-6 py-3.5 text-right">Profit Variance (₹)</th>
                  <th className="px-6 py-3.5 text-right">Profit Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-sm">
                {[MONTH_NAMES[selectedMonth - 1]].map((monthName) => {
                  const m = selectedMonth;
                  const customSalesVal = autoCalculatedMonthly.sales[m] || 0; // overridden, sales only
                  const customExpensesVal = parseFloat(gridData[m]?.customExpenses) || 0;
                  const customProfit = customSalesVal - customExpensesVal;

                  const autoSalesVal = autoCalculatedMonthly.sales[m] || 0;
                  const autoExpensesVal = autoCalculatedMonthly.expenses[m] || 0;
                  const autoProfit = autoSalesVal - autoExpensesVal;

                  const variance = customProfit - autoProfit;
                  const margin = customSalesVal > 0 ? (customProfit / customSalesVal) * 100 : 0;

                  return (
                    <tr key={m} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{monthName}</td>
                      <td className="px-6 py-4 text-right text-slate-600 font-semibold">
                        ₹{customSalesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-semibold">
                        ₹{customExpensesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-extrabold ${
                        customProfit > 0 ? 'bg-emerald-50/50 text-emerald-700' : customProfit < 0 ? 'bg-red-50/50 text-red-700' : 'text-slate-600'
                      }`}>
                        ₹{customProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-medium">
                        ₹{autoProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ₹{variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-700">
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Custom Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl scale-100 transform transition-all duration-300">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-amber-600 animate-pulse" />
                Log Custom Expense
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Expense Type
                </label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as any)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:ring-amber-500"
                >
                  <option value="Store Expense">Store Expense</option>
                  <option value="Staff Expense">Staff Expense</option>
                  <option value="Customer Expense">Customer Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Title / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. buy paper bundle"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Upload Bill / Receipt (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="expense-bill-upload"
                  />
                  <label
                    htmlFor="expense-bill-upload"
                    className="btn border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" /> {billImage ? 'Change File' : 'Choose Receipt'}
                  </label>
                  {billImage && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Uploaded
                      <button
                        type="button"
                        onClick={() => setBillImage(null)}
                        className="text-red-500 hover:text-red-700 font-semibold ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Bill Modal for Admin */}
      {viewingBillImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-2xl w-full shadow-2xl scale-100 transform transition-all duration-300">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 animate-pulse" />
                View Expense Bill / Receipt
              </h3>
              <button
                onClick={() => setViewingBillImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-4 p-2 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex justify-center items-center">
              <img
                src={viewingBillImage}
                alt="Expense Bill"
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-inner"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={() => setViewingBillImage(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
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

export default Accounts;
