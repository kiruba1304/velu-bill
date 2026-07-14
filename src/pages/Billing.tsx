import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  User,
  Search,
  ShoppingCart,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Product, Customer, Bill, BillItem, Service } from '../types';
import { useProducts, useCustomers, useBills, useServices } from '../hooks/useDatabase';
import {
  generateQRData,
  generateThermalCompactReceipt,
  generateThermalStandardReceipt,
  generateThermalDetailedReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt
} from '../utils/templateGenerator';

interface BillItemWithProduct extends BillItem {
  product: Product;
}

const Billing: React.FC = () => {
  const [billItems, setBillItems] = useState<BillItemWithProduct[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadedServiceId, setLoadedServiceId] = useState<number | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'credit' | 'other' | 'online' | 'cod'>('cash');
  const [gstBillingEnabled, setGstBillingEnabled] = useState(true);
  // extra discount value and mode: percent or rupees
  const [extraDiscountValue, setExtraDiscountValue] = useState<string>('');
  const [extraDiscountMode, setExtraDiscountMode] = useState<'percent' | 'rupees'>('percent');
  // Credit balance management
  const [appliedCreditAmount, setAppliedCreditAmount] = useState<number>(0);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditManagementMode, setCreditManagementMode] = useState<'view' | 'add' | 'deduct' | 'apply'>('view');
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState<string>('');
  const [creditAdjustmentReason, setCreditAdjustmentReason] = useState<string>( '');
  const [showCheckoutCreditModal, setShowCheckoutCreditModal] = useState(false);
  const [currentlyPayInput, setCurrentlyPayInput] = useState<string>('');
  const [editingBillMeta, setEditingBillMeta] = useState<{ billNumber: string; createdAt: string; customerId?: number } | null>(null);
  const [heldBills, setHeldBills] = useState<any[]>(() => {
    const saved = localStorage.getItem('held_bills');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHeldBills, setShowHeldBills] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Save held bills to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('held_bills', JSON.stringify(heldBills));
  }, [heldBills]);


  // Use real database data
  const { products, getProductByBarcode } = useProducts();

  const { customers, updateCustomer } = useCustomers();
  const { addBill, updateBill, getBillsByCustomer } = useBills();
  const { services, updateService } = useServices();

  useEffect(() => {
    const raw = localStorage.getItem('billing_edit_bill');
    if (!raw || products.length === 0) return;

    try {
      const bill = JSON.parse(raw) as Bill;

      const mappedItems: BillItemWithProduct[] = (bill.items || [])
        .map((item) => {
          const product = products.find((p) => p.id === item.productId) || item.product;
          if (!product) return null;

          return {
            ...item,
            id: Date.now() + Math.floor(Math.random() * 100000) + item.productId,
            product,
          } as BillItemWithProduct;
        })
        .filter((item): item is BillItemWithProduct => item !== null);

      setBillItems(mappedItems);
      setPaymentMethod(bill.paymentMethod || 'cash');
      setExtraDiscountValue('');
      setExtraDiscountMode('percent');
      setEditingBillMeta({
        billNumber: bill.billNumber,
        createdAt: bill.createdAt,
        customerId: bill.customerId,
      });
      setGstBillingEnabled(bill.isGstBill !== false);

      if (bill.customerId) {
        const found = customers.find((c) => c.id === bill.customerId) || bill.customer || null;
        setSelectedCustomer(found);
      } else {
        setSelectedCustomer(null);
      }

      localStorage.removeItem('billing_edit_bill');
    } catch (error) {
      console.error('Failed to load bill for editing:', error);
      localStorage.removeItem('billing_edit_bill');
    }
  }, [products, customers]);

  useEffect(() => {
    const raw = localStorage.getItem('billing_import_service');
    if (!raw || customers.length === 0) return;

    try {
      const data = JSON.parse(raw);
      
      let matchedCustomer = null;
      if (data.customerPhone) {
        matchedCustomer = customers.find(c => c.phone === data.customerPhone) || null;
      }
      
      if (matchedCustomer) {
        setSelectedCustomer(matchedCustomer);
      } else {
        setSelectedCustomer(null);
        setWalkInName(data.customerName || 'Walk-in Customer');
        setWalkInPhone(data.customerPhone || '');
      }

      const dummyServiceProduct: Product = {
        id: -999,
        name: `Service: ${data.description || 'Vehicle Repair'}`,
        company: data.vehicleName ? `${data.vehicleName} (${data.vehicleNumber})` : 'General Service',
        count: 1,
        costPrice: 0,
        sellingPrice: data.serviceCost || 0,
        discount: 0,
        gst: 18,
        barcode: 'SERVICE_CUSTOM',
        finalPrice: data.serviceCost || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const serviceItem: BillItemWithProduct = {
        id: Date.now(),
        billId: 0,
        productId: -999,
        quantity: 1,
        unitPrice: data.serviceCost || 0,
        discount: 0,
        gst: 18,
        totalPrice: data.serviceCost || 0,
        product: dummyServiceProduct
      };

      setBillItems([serviceItem]);
      setLoadedServiceId(data.serviceId);
      localStorage.removeItem('billing_import_service');
      alert(`Imported Service Card #${data.serviceId} details!`);
    } catch (e) {
      console.error('Failed to import service:', e);
      localStorage.removeItem('billing_import_service');
    }
  }, [products, customers]);

  const handleLoadServiceIntoBill = async (srv: Service) => {
    try {
      const dummyServiceProduct: Product = {
        id: -999,
        name: `Service: ${srv.description || 'Vehicle Repair'}`,
        company: srv.vehicleName ? `${srv.vehicleName} (${srv.vehicleNumber})` : 'General Service',
        count: 1,
        costPrice: 0,
        sellingPrice: srv.estimatedCost || 0,
        discount: 0,
        gst: 18,
        barcode: 'SERVICE_CUSTOM',
        finalPrice: srv.estimatedCost || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const serviceItem: BillItemWithProduct = {
        id: Date.now(),
        billId: 0,
        productId: -999,
        quantity: 1,
        unitPrice: srv.estimatedCost || 0,
        discount: 0,
        gst: 18,
        totalPrice: srv.estimatedCost || 0,
        product: dummyServiceProduct
      };

      setBillItems(prev => {
        const filtered = prev.filter(item => item.productId !== -999);
        return [...filtered, serviceItem];
      });

      setLoadedServiceId(srv.id);
      alert(`Loaded Service Ticket SRV-${srv.id} details for vehicle ${srv.vehicleNumber} into current bill.`);
    } catch (e) {
      console.error('Failed to load service into bill:', e);
      alert('Failed to load service details.');
    }
  };

  const refreshCustomerPurchaseStats = async (customerId: number) => {
    const bills = getBillsByCustomer(customerId);
    const totalPurchases = bills.reduce((sum, bill) => sum + bill.finalAmount, 0);
    const purchaseCount = bills.length;
    const latest = [...bills].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    await updateCustomer(customerId, {
      totalPurchases,
      purchaseCount,
      lastPurchaseDate: latest?.createdAt,
      lastPurchaseAmount: latest?.finalAmount,
    });
  };

  const handleBarcodeInput = (barcode: string) => {
    const product = getProductByBarcode(barcode);
    if (product) {
      addProductToBill(product);
      setBarcodeInput('');
    } else {
      // Allow searching by name without alert if results exist
      if (filteredProducts.length === 0) {
        alert('Product not found for: ' + barcode);
      }
    }
  };

  const addProductToBill = (product: Product, quantity: number = 1) => {
    const existingItemIndex = billItems.findIndex(item => item.productId === product.id);

    if (existingItemIndex >= 0) {
      setBillItems(prev => prev.map((item, index) =>
        index === existingItemIndex
          ? {
            ...item,
            quantity: item.quantity + quantity,
            totalPrice: (item.quantity + quantity) * item.unitPrice
          }
          : item
      ));
    } else {
      let activeGst = 18;
      try {
        const raw = localStorage.getItem('app_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.gstPercentage !== undefined) {
            activeGst = parseFloat(parsed.gstPercentage) || 0;
          }
        }
      } catch {}

      // Add new item
      const newItem: BillItemWithProduct = {
        id: Date.now(),
        billId: 0, // Will be set when bill is saved
        productId: product.id,
        quantity,
        unitPrice: product.sellingPrice,
        discount: product.discount,
        gst: activeGst,
        totalPrice: quantity * product.sellingPrice,
        product
      };
      setBillItems(prev => [...prev, newItem]);
    }

    // Clear search input to hide dropdown after product is selected
    setBarcodeInput('');
  };

  const updateItemQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    setBillItems(prev => prev.map(item =>
      item.id === itemId
        ? {
          ...item,
          quantity: newQuantity,
          totalPrice: newQuantity * item.unitPrice
        }
        : item
    ));
  };

  const removeItem = (itemId: number) => {
    setBillItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    let gstInclusive = false;
    let gstPercentage = 18;
    try {
      const raw = localStorage.getItem('app_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        gstInclusive = !!parsed.gstInclusive;
        if (parsed.gstPercentage !== undefined) {
          gstPercentage = parseFloat(parsed.gstPercentage) || 0;
        }
      }
    } catch {}

    const subtotal = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemDiscount = billItems.reduce((sum, item) => sum + (item.totalPrice * item.discount / 100), 0);
    const base = Math.max(0, subtotal - itemDiscount);

    let extraDiscountAmount = 0;
    if (extraDiscountMode === 'percent') {
      const pct = Math.max(0, Math.min(100, parseFloat(extraDiscountValue) || 0));
      extraDiscountAmount = base * (pct / 100);
    } else {
      // rupees mode: discount is a fixed amount, capped at base
      extraDiscountAmount = Math.max(0, Math.min(base, parseFloat(extraDiscountValue) || 0));
    }
    const baseAfterExtra = Math.max(0, base - extraDiscountAmount);

    let totalGst = 0;
    if (gstBillingEnabled && base > 0) {
      billItems.forEach(item => {
        const itemBase = item.totalPrice - (item.totalPrice * item.discount / 100);
        const adjustedItemBase = itemBase * (baseAfterExtra / base);
        if (gstInclusive) {
          totalGst += adjustedItemBase * (gstPercentage / 100) / (1 + gstPercentage / 100);
        } else {
          totalGst += adjustedItemBase * (gstPercentage / 100);
        }
      });
    }

    const totalDiscount = itemDiscount + extraDiscountAmount;
    const finalTotal = gstInclusive ? baseAfterExtra : (baseAfterExtra + totalGst);

    return { subtotal, itemDiscount, extraDiscountAmount, totalDiscount, totalGst, finalTotal };
  };

  const holdBill = () => {
    if (billItems.length === 0) {
      alert('Please add items to hold a bill');
      return;
    }
    const totals = calculateTotals();
    const newHeldBill = {
      id: Date.now(),
      customer: selectedCustomer,
      walkInName,
      walkInPhone,
      items: billItems,
      totals,
      paymentMethod,
      extraDiscountValue: parseFloat(extraDiscountValue) || 0,
      extraDiscountMode,
      appliedCreditAmount,
      isGstBill: gstBillingEnabled,
      timestamp: new Date()
    };
    setHeldBills([...heldBills, newHeldBill]);
    // Clear current bill
    setBillItems([]);
    setSelectedCustomer(null);
    setWalkInName('');
    setWalkInPhone('');
    setExtraDiscountValue('');
    setAppliedCreditAmount(0);
    setGstBillingEnabled(true);
    alert('Bill held successfully!');
  };

  const restoreBill = (id: number) => {
    const bill = heldBills.find(b => b.id === id);
    if (bill) {
      setBillItems(bill.items);
      setSelectedCustomer(bill.customer);
      setWalkInName(bill.walkInName);
      setWalkInPhone(bill.walkInPhone);
      setExtraDiscountValue(bill.extraDiscountValue ? String(bill.extraDiscountValue) : '');
      setExtraDiscountMode(bill.extraDiscountMode || 'percent');
      setAppliedCreditAmount(bill.appliedCreditAmount || 0);
      setPaymentMethod(bill.paymentMethod);
      setGstBillingEnabled(bill.isGstBill !== false);
      setHeldBills(heldBills.filter(b => b.id !== id));
      setShowHeldBills(false);
    }
  };

  const generateBillNumber = () => {
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const key = `bill_counter_${yyyymmdd}`;
    let counter = parseInt(localStorage.getItem(key) || '0', 10);
    counter += 1;
    localStorage.setItem(key, String(counter));
    const seq = String(counter).padStart(2, '0');
    return `${yyyymmdd}-${seq}`;
  };

  const handleCreditAdjustment = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    const adjAmount = parseFloat(creditAdjustmentAmount) || 0;
    if (adjAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      let newCreditBalance = (selectedCustomer.creditBalance || 0);
      
      if (creditManagementMode === 'add') {
        newCreditBalance += adjAmount;
      } else if (creditManagementMode === 'deduct') {
        newCreditBalance = Math.max(0, newCreditBalance - adjAmount);
      }

      await updateCustomer(selectedCustomer.id, {
        creditBalance: newCreditBalance,
      });

      // Update the selected customer in state
      setSelectedCustomer({
        ...selectedCustomer,
        creditBalance: newCreditBalance
      });

      setCreditAdjustmentAmount('');
      setCreditAdjustmentReason('');
      setCreditManagementMode('view');
      alert(`Credit balance updated successfully!`);
    } catch (error) {
      console.error('Error updating credit balance:', error);
      alert('Failed to update credit balance');
    }
  };

  // const handleApplyCredit = () => {
  //   if (!selectedCustomer || !selectedCustomer.creditBalance) {
  //     alert('No credit balance available');
  //     return;
  //   }
  // 
  //   const totals = calculateTotals();
  //   const maxCredit = Math.min(selectedCustomer.creditBalance, totals.finalTotal);
  //   
  //   if (appliedCreditAmount > maxCredit) {
  //     alert(`Credit amount cannot exceed ₹${maxCredit.toFixed(2)}`);
  //     return;
  //   }
  // 
  //   setCreditManagementMode('apply');
  //   setShowCreditModal(true);
  // };

  const printReceipt = (bill: Bill) => {
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
      gstInclusive: appSettings.gstInclusive || false,
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

  const performCheckout = async (currentlyPayAmount: number = 0) => {
    try {
      const billNumber = editingBillMeta?.billNumber || generateBillNumber();
      const billCreatedAt = editingBillMeta?.createdAt || new Date().toISOString();
      const previousBalance = selectedCustomer?.creditBalance || 0;
      const totalOutstanding = previousBalance + totals.finalTotal;
      const netBalance = Math.max(0, totalOutstanding - currentlyPayAmount);

      const tempBill: Bill = {
        id: 0,
        customerId: selectedCustomer?.id || 0,
        billNumber,
        totalAmount: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalGst: totals.totalGst,
        finalAmount: totals.finalTotal,
        paymentMethod,
        status: 'completed',
        createdAt: billCreatedAt,
        updatedAt: new Date().toISOString(),
        customer: selectedCustomer || undefined,
        items: billItems.map(item => ({
          ...item,
          gst: gstBillingEnabled ? item.gst : 0
        })),
        isGstBill: gstBillingEnabled,
        previousBalance: paymentMethod === 'credit' ? previousBalance : undefined,
        currentlyPaid: paymentMethod === 'credit' ? currentlyPayAmount : undefined,
        totalOutstanding: paymentMethod === 'credit' ? totalOutstanding : undefined,
        netBalance: paymentMethod === 'credit' ? netBalance : undefined
      };

      if (editingBillMeta) {
        const success = await updateBill(editingBillMeta.billNumber, {
          customerId: tempBill.customerId,
          billNumber: tempBill.billNumber,
          totalAmount: tempBill.totalAmount,
          totalDiscount: tempBill.totalDiscount,
          totalGst: tempBill.totalGst,
          finalAmount: tempBill.finalAmount,
          paymentMethod: tempBill.paymentMethod,
          status: tempBill.status,
          customer: tempBill.customer,
          items: tempBill.items,
          isGstBill: tempBill.isGstBill,
          previousBalance: tempBill.previousBalance,
          currentlyPaid: tempBill.currentlyPaid,
          totalOutstanding: tempBill.totalOutstanding,
          netBalance: tempBill.netBalance
        });

        if (!success) {
          throw new Error('Original bill not found for update');
        }
      } else {
        await addBill(tempBill);
      }

      // Update customer credit balance based on payment method
      if (selectedCustomer?.id) {
        let newCreditBalance = selectedCustomer.creditBalance || 0;
        const transactionHistory = [...(selectedCustomer.creditHistory || [])];

        // If payment method is credit, add the bill amount to pending
        if (paymentMethod === 'credit') {
          newCreditBalance += tempBill.finalAmount;
          
          if (currentlyPayAmount > 0) {
            newCreditBalance = Math.max(0, newCreditBalance - currentlyPayAmount);
            
            // Record payment in credit history
            transactionHistory.push({
              id: Date.now(),
              customerId: selectedCustomer.id,
              amount: -currentlyPayAmount,
              type: 'used',
              description: `Payment towards bill ${billNumber}`,
              createdAt: new Date().toISOString()
            });
          }
        } else if (appliedCreditAmount > 0) {
          // If credit was applied to reduce bill, deduct from pending
          newCreditBalance = Math.max(0, newCreditBalance - appliedCreditAmount);
        }

        await updateCustomer(selectedCustomer.id, {
          creditBalance: newCreditBalance,
          creditHistory: transactionHistory
        });
      }

      // Recalculate customer history to avoid double-counting on edited bills
      if (selectedCustomer?.id) {
        await refreshCustomerPurchaseStats(selectedCustomer.id);
      }
      if (editingBillMeta?.customerId && editingBillMeta.customerId !== selectedCustomer?.id) {
        await refreshCustomerPurchaseStats(editingBillMeta.customerId);
      }

      printReceipt(tempBill);
 
      // Auto-complete the associated workshop service card status in the database
      if (loadedServiceId) {
        await updateService(loadedServiceId, { status: 'completed' });
        setLoadedServiceId(null);
      }

      // Clear bill after successful checkout
      setBillItems([]);
      setSelectedCustomer(null);
      setWalkInName('');
      setWalkInPhone('');
      setExtraDiscountValue('');
      setAppliedCreditAmount(0);
      setPaymentMethod('cash');
      setEditingBillMeta(null);
      setGstBillingEnabled(true);
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error saving bill: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const totals = calculateTotals();

  const filteredProducts = !barcodeInput.trim() ? [] : products.filter(product =>
    product.name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
    product.company.toLowerCase().includes(barcodeInput.toLowerCase()) ||
    (product.barcode && product.barcode.toLowerCase().includes(barcodeInput.toLowerCase())) ||
    (product.productCode && product.productCode.toLowerCase().includes(barcodeInput.toLowerCase())) ||
    (product.skuCode && product.skuCode.toLowerCase().includes(barcodeInput.toLowerCase())) ||
    String(product.id).includes(barcodeInput)
  );

  const gstInclusive = (() => {
    try {
      const raw = localStorage.getItem('app_settings');
      if (raw) return !!JSON.parse(raw).gstInclusive;
    } catch {}
    return false;
  })();

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column - Product Selection and Customer */}
        <div className="space-y-6">
          <div className="relative">
            <div className="card border border-white/60 bg-white/85 shadow-soft">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Product Search</h3>
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan barcode or search by name..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBarcodeInput(barcodeInput);
                    }
                  }}
                  className="input w-full pr-10"
                  autoFocus
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <button
                onClick={() => handleBarcodeInput(barcodeInput)}
                className="btn-primary px-4 py-2"
                disabled={!barcodeInput.trim()}
              >
                Add
              </button>
            </div>
            </div>

            {filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-[118px] z-30 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="grid grid-cols-1 gap-3">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:bg-white"
                      onClick={() => addProductToBill(product)}
                    >
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="text-sm text-slate-600">{product.company}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-slate-500">Stock: {product.count}</span>
                        <span className="font-medium text-primary-600">₹{product.finalPrice.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{product.barcode}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Customer</h3>
              <button onClick={() => setShowCustomerModal(true)} className="btn-secondary flex items-center gap-2 px-3 py-1 text-xs">
                <User className="h-3 w-3" />
                Select
              </button>
            </div>

            {selectedCustomer ? (
              <div className="rounded-xl bg-gradient-to-br from-primary-50 to-slate-50 p-3 ring-1 ring-primary-100">
                <div className="font-medium text-sm text-slate-900">{selectedCustomer.name}</div>
                <div className="text-xs text-slate-600">{selectedCustomer.phone}</div>
                {selectedCustomer.email && (
                  <div className="text-xs text-slate-600">{selectedCustomer.email}</div>
                )}
                {(selectedCustomer.vehicleName || selectedCustomer.vehicleNumber) && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                    <span>🚗</span>
                    <span>
                      {selectedCustomer.vehicleName || 'Vehicle'}: {selectedCustomer.vehicleNumber || 'N/A'}
                    </span>
                  </div>
                )}

                {/* Show completed service tickets for this customer */}
                {services.filter(s => s.customerId === selectedCustomer.id && s.status === 'completed').length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Unbilled Workshop Services</p>
                    <div className="space-y-1.5">
                      {services
                        .filter(s => s.customerId === selectedCustomer.id && s.status === 'completed')
                        .map(srv => (
                          <button
                            key={srv.id}
                            onClick={() => handleLoadServiceIntoBill(srv)}
                            className="w-full text-left bg-indigo-50/50 border border-indigo-100/60 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all p-2 rounded-xl text-xs flex justify-between items-center group font-medium"
                          >
                            <div className="truncate pr-1">
                              <span className="font-bold text-slate-800 group-hover:text-white block text-[11px] truncate">
                                🚗 {srv.vehicleName || 'Vehicle'}
                              </span>
                              <span className="text-slate-400 group-hover:text-indigo-200 text-[10px] font-mono">
                                ({srv.vehicleNumber})
                              </span>
                            </div>
                            <span className="flex-shrink-0 bg-white text-indigo-700 font-extrabold px-2 py-1 rounded-lg border border-indigo-200 transition-all">
                              ₹{srv.estimatedCost.toFixed(2)}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                <div className="text-xs text-slate-700">Walk-in details (optional)</div>
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  <input
                    type="text"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="input text-sm"
                    placeholder="Name"
                  />
                  <input
                    type="tel"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    className="input text-sm"
                    placeholder="Contact"
                  />
                </div>
                <div className="text-xs text-gray-500">Leave blank for walk-in</div>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          {billItems.length > 0 && (
            <div className="card border border-white/60 bg-gradient-to-br from-emerald-50 to-white shadow-soft">
              <h3 className="mb-2 text-base font-semibold text-slate-900">Bill Summary</h3>

              {/* GST Billing Toggle switch */}
              <div className="mb-3 p-3 rounded-2xl bg-white/80 border border-slate-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-900">GST Billing</p>
                  <p className="text-[10px] text-slate-500">Enable GST tax calculations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGstBillingEnabled(!gstBillingEnabled)}
                  style={{ backgroundColor: gstBillingEnabled ? 'var(--primary)' : '#cbd5e1' }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gstBillingEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              {/* Pending Amount Section (if customer selected) */}
              {selectedCustomer && (
                <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-orange-600 font-medium">Pending Amount (Amount Owed)</p>
                      <p className="text-lg font-bold text-orange-700">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => setShowCreditModal(true)}
                      className="px-3 py-1 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium text-slate-900">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.itemDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Item Disc:</span>
                    <span className="font-medium text-red-600">-₹{totals.itemDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-600">Extra Disc</label>
                    <div className="inline-flex rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setExtraDiscountMode('percent')}
                        className={`px-2 py-1 rounded ${extraDiscountMode === 'percent' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtraDiscountMode('rupees')}
                        className={`px-2 py-1 rounded ${extraDiscountMode === 'rupees' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                      >
                        ₹
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={extraDiscountValue}
                    onChange={(e) => setExtraDiscountValue(e.target.value)}
                    className="input w-24 text-right text-sm"
                  />
                </div>
                
                {/* Applied Pending Amount Display */}
                {appliedCreditAmount > 0 && selectedCustomer && paymentMethod !== 'credit' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Pending Amount Adjusted:</span>
                    <span className="font-medium text-orange-600">-₹{appliedCreditAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">GST {gstInclusive ? '(Inclusive)' : '(Exclusive)'}:</span>
                  <span className="font-medium text-slate-900">
                    {gstBillingEnabled ? `₹${totals.totalGst.toFixed(2)}` : '₹0.00 (Off)'}
                  </span>
                </div>
                <hr className="my-1 border-slate-200" />
                
                {/* Credit Payment Display */}
                {paymentMethod === 'credit' && selectedCustomer && (
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-slate-900">Amount to Add:</span>
                      <span className="text-blue-600">₹{totals.finalTotal.toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-600 font-medium">Current Pending:</span>
                        <span className="text-blue-700 font-semibold">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-600 font-medium">+ This Bill:</span>
                        <span className="text-blue-700 font-semibold">₹{totals.finalTotal.toFixed(2)}</span>
                      </div>
                      <hr className="my-1 border-blue-200" />
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600 font-medium">New Pending Total:</span>
                        <span className="text-blue-700 font-bold">₹{((selectedCustomer.creditBalance || 0) + totals.finalTotal).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-center text-sm text-blue-600 font-medium">
                      ✓ Amount will be added to pending balance on checkout
                    </div>
                  </div>
                )}
                
                {/* Normal Payment Display */}
                {paymentMethod !== 'credit' && (
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-primary-600">₹{(totals.finalTotal - appliedCreditAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Payment
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="input w-full text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  {selectedCustomer && <option value="credit">Credit</option>}
                  <option value="other">Other</option>
                </select>
                {paymentMethod === 'credit' && selectedCustomer && (
                  <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium">
                      ℹ️ Full bill amount (₹{totals.finalTotal.toFixed(2)}) will be added to {selectedCustomer.name}'s pending balance
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Bill Details */}
        <div className="space-y-6">
          {/* Bill Items */}
          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Bill Items</h3>
              <div className="flex items-center gap-3">
                {editingBillMeta && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Editing Bill: {editingBillMeta.billNumber}
                  </span>
                )}
                {billItems.length > 0 && (
                  <>
                    <button
                      onClick={holdBill}
                      className="btn-icon btn-icon-neutral text-slate-500 hover:text-amber-600"
                      title="Hold Bill"
                    >
                      <Clock className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const previousBalance = selectedCustomer?.creditBalance || 0;
                        const totalOutstanding = previousBalance + totals.finalTotal;
                        const tempBill: Bill = {
                          id: 0,
                          customerId: selectedCustomer?.id || 0,
                          billNumber: 'PREVIEW',
                          totalAmount: totals.subtotal,
                          totalDiscount: totals.totalDiscount,
                          totalGst: totals.totalGst,
                          finalAmount: totals.finalTotal,
                          paymentMethod,
                          status: 'pending',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          customer: selectedCustomer || undefined,
                          items: billItems,
                          previousBalance: paymentMethod === 'credit' ? previousBalance : undefined,
                          currentlyPaid: paymentMethod === 'credit' ? 0 : undefined,
                          totalOutstanding: paymentMethod === 'credit' ? totalOutstanding : undefined,
                          netBalance: paymentMethod === 'credit' ? totalOutstanding : undefined
                        };
                        printReceipt(tempBill);
                      }}
                      className="btn-icon btn-icon-neutral text-slate-500 hover:text-primary-600"
                      title="Print Bill"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowHeldBills(!showHeldBills)}
                  className="relative btn-icon btn-icon-neutral text-slate-500 hover:text-slate-700"
                  title="View Held Bills"
                >
                  <RotateCcw className="h-4 w-4" />
                  {heldBills.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {heldBills.length}
                    </span>
                  )}
                </button>
                <span className="text-sm text-gray-600">{billItems.length} item(s)</span>
              </div>
            </div>

            {showHeldBills && heldBills.length > 0 && (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 border border-amber-200">
                <h4 className="mb-2 font-semibold text-amber-900 text-sm">Held Bills ({heldBills.length})</h4>
                <div className="space-y-2">
                  {heldBills.map(bill => (
                    <button
                      key={bill.id}
                      onClick={() => restoreBill(bill.id)}
                      className="w-full text-left rounded-lg bg-white p-2 border border-amber-200 hover:bg-amber-100 transition-colors text-sm"
                    >
                      <div className="font-medium text-slate-900">
                        {bill.customer?.name || bill.walkInName || 'Walk-in'} • {bill.items.length} items
                      </div>
                      <div className="text-xs text-slate-600">
                        ₹{bill.totals.finalTotal.toFixed(2)} • {new Date(bill.timestamp).toLocaleTimeString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {billItems.length === 0 ? (
              <div className="py-8 text-center">
                <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <p className="text-slate-500">No items added</p>
                <p className="text-sm text-slate-400">Scan barcode or search products to add items</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {billItems.map(item => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 text-sm">{item.product.name}</div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-2">
                          <span>SKU: {item.product.skuCode || item.product.productCode || '-'}</span>
                          {item.product.hsnCode && <span>• HSN: {item.product.hsnCode}</span>}
                        </div>

                        <div className="text-xs text-slate-500">
                          ₹{item.unitPrice.toFixed(2)} each
                          {item.discount > 0 && (
                            <span className="ml-2 text-emerald-600 font-semibold">({item.discount}% off)</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="btn-icon btn-icon-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="btn-icon btn-icon-neutral h-7 w-7">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-semibold text-slate-900 text-sm">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="btn-icon btn-icon-neutral h-7 w-7">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="font-semibold text-slate-900 text-sm">
                        ₹{item.totalPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {billItems.length > 0 && (
              <button
                onClick={async () => {
                  if (paymentMethod === 'credit' && selectedCustomer) {
                    setCurrentlyPayInput('');
                    setShowCheckoutCreditModal(true);
                  } else {
                    await performCheckout(0);
                  }
                }}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all active:scale-95"
              >
                {editingBillMeta ? 'Update Bill & Print' : 'Checkout & Print'}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Select Customer</h3>

            {/* Customer Search */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customers by name, phone, or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-4 pr-10 shadow-sm focus:border-primary-300 focus:ring-2 focus:ring-primary-200"
                  autoFocus
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowCustomerModal(false);
                  setCustomerSearch(''); // Clear search when modal is closed
                }}
                className="w-full rounded-2xl border border-slate-200 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">Walk-in Customer</div>
                <div className="text-sm text-slate-600">No customer details</div>
              </button>

              {customers
                .filter(customer => {
                  if (!customerSearch) return true;
                  const searchLower = customerSearch.toLowerCase();
                  return (
                    customer.name.toLowerCase().includes(searchLower) ||
                    customer.phone.toLowerCase().includes(searchLower) ||
                    (customer.email && customer.email.toLowerCase().includes(searchLower))
                  );
                })
                .map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                      setCustomerSearch(''); // Clear search when customer is selected
                    }}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{customer.name}</div>
                    <div className="text-sm text-slate-600">{customer.phone}</div>
                    {customer.email && (
                      <div className="text-sm text-slate-600">{customer.email}</div>
                    )}
                  </button>
                ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerSearch(''); // Clear search when modal is cancelled
                }}
                className="btn-secondary flex-1 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Amount Management Modal */}
      {showCreditModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Manage Pending Amount</h3>
              <button
                onClick={() => {
                  setShowCreditModal(false);
                  setCreditManagementMode('view');
                  setCreditAdjustmentAmount('');
                  setCreditAdjustmentReason('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Customer Info */}
            <div className="mb-4 p-3 rounded-lg bg-slate-100">
              <div className="text-sm font-medium text-slate-900">{selectedCustomer.name}</div>
              <div className="text-xs text-slate-600">{selectedCustomer.phone}</div>
            </div>

            {/* Current Pending Amount Display */}
            <div className="mb-6 p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-xs text-orange-600 font-medium mb-1">Current Pending Amount (Amount Owed)</div>
              <div className="text-2xl font-bold text-orange-700">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</div>
            </div>

            {/* Mode Selection Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCreditManagementMode('view')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  creditManagementMode === 'view'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                View
              </button>
              <button
                onClick={() => setCreditManagementMode('add')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  creditManagementMode === 'add'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Add Pending
              </button>
              <button
                onClick={() => setCreditManagementMode('deduct')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  creditManagementMode === 'deduct'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Payment Received
              </button>
            </div>

            {/* View Mode */}
            {creditManagementMode === 'view' && (
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-xs text-orange-600 mb-1">Total Pending Amount</div>
                  <div className="text-xl font-bold text-orange-700">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</div>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="mb-2">This is the amount the customer currently owes. This pending amount will be automatically deducted from their next bill.</p>
                </div>
              </div>
            )}

            {/* Add Pending Amount Mode */}
            {creditManagementMode === 'add' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pending Amount to Add (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditAdjustmentAmount}
                    onChange={(e) => setCreditAdjustmentAmount(e.target.value)}
                    className="input w-full"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
                  <textarea
                    value={creditAdjustmentReason}
                    onChange={(e) => setCreditAdjustmentReason(e.target.value)}
                    className="input w-full text-sm"
                    rows={2}
                    placeholder="Reason for pending amount (e.g., partial payment, bill adjustment)..."
                  />
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="text-xs text-orange-600 mb-1">New Pending Amount</div>
                  <div className="text-lg font-bold text-orange-700">
                    ₹{((selectedCustomer.creditBalance || 0) + (parseFloat(creditAdjustmentAmount) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Received Mode */}
            {creditManagementMode === 'deduct' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Received Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={selectedCustomer.creditBalance || 0}
                    value={creditAdjustmentAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val) || 0;
                      const max = selectedCustomer.creditBalance || 0;
                      if (num > max) {
                        setCreditAdjustmentAmount(String(max));
                      } else {
                        setCreditAdjustmentAmount(val);
                      }
                    }}
                    className="input w-full"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method (optional)</label>
                  <textarea
                    value={creditAdjustmentReason}
                    onChange={(e) => setCreditAdjustmentReason(e.target.value)}
                    className="input w-full text-sm"
                    rows={2}
                    placeholder="Payment method (e.g., Cash, Bank Transfer, Cheque)..."
                  />
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="text-xs text-green-600 mb-1">Remaining Pending Amount</div>
                  <div className="text-lg font-bold text-green-700">
                    ₹{Math.max(0, (selectedCustomer.creditBalance || 0) - (parseFloat(creditAdjustmentAmount) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreditModal(false);
                  setCreditManagementMode('view');
                  setCreditAdjustmentAmount('');
                  setCreditAdjustmentReason('');
                }}
                className="btn-secondary flex-1 px-4 py-2"
              >
                Cancel
              </button>
              {creditManagementMode !== 'view' && (
                <button
                  onClick={handleCreditAdjustment}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-colors ${
                    creditManagementMode === 'add'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {creditManagementMode === 'add' ? 'Add Pending Amount' : 'Record Payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Credit Modal */}
      {showCheckoutCreditModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Credit Checkout Details</h3>
              <button
                onClick={() => {
                  setShowCheckoutCreditModal(false);
                  setCurrentlyPayInput('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Customer Pill */}
            <div className="mb-4 flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-primary-50 to-slate-50 border border-primary-100/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{selectedCustomer.name}</div>
                <div className="text-xs text-slate-500">{selectedCustomer.phone}</div>
              </div>
            </div>

            {/* Bill & Credit Summary Card */}
            <div className="mb-6 space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Current Bill Amount</span>
                <span className="font-semibold text-slate-900">₹{totals.finalTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Previous Pending Credit</span>
                <span className="font-semibold text-orange-600">₹{(selectedCustomer.creditBalance || 0).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200/60 my-2 pt-2 flex justify-between items-center text-base font-bold">
                <span className="text-slate-800">Total Outstanding Balance</span>
                <span className="text-primary-600">₹{((selectedCustomer.creditBalance || 0) + totals.finalTotal).toFixed(2)}</span>
              </div>
            </div>

            {/* Currently Pay Input Field */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Currently Paying Amount (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={(selectedCustomer.creditBalance || 0) + totals.finalTotal}
                  value={currentlyPayInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseFloat(val) || 0;
                    const maxVal = (selectedCustomer.creditBalance || 0) + totals.finalTotal;
                    if (num > maxVal) {
                      setCurrentlyPayInput(String(maxVal));
                    } else {
                      setCurrentlyPayInput(val);
                    }
                  }}
                  className="input w-full pl-8 py-3 text-lg font-bold text-slate-800 border-primary-200 focus:border-primary-500 focus:ring-primary-200 rounded-2xl"
                  placeholder="0"
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Enter any amount the customer is paying right now.
              </p>
            </div>

            {/* Summary of final balance after current payment */}
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700 font-medium">Remaining Pending Balance:</span>
                <span className="font-extrabold text-emerald-800 text-lg">
                  ₹{Math.max(0, ((selectedCustomer.creditBalance || 0) + totals.finalTotal) - (parseFloat(currentlyPayInput) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await performCheckout(parseFloat(currentlyPayInput) || 0);
                  setShowCheckoutCreditModal(false);
                  setCurrentlyPayInput('');
                }}
                className="btn-secondary flex-1 py-3 font-semibold rounded-2xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await performCheckout(parseFloat(currentlyPayInput) || 0);
                  setShowCheckoutCreditModal(false);
                  setCurrentlyPayInput('');
                }}
                className="flex-1 py-3 px-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-md transition-all active:scale-95 text-center"
              >
                Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
