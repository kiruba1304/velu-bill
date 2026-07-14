import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CheckCircle2,
  Printer,
  X,
  Check,
  Save,
  Package,
  AlertCircle,
  User,
  ChevronRight,
  ShieldCheck,
  History,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useServices, useProducts, useCustomers } from '../hooks/useDatabase';
import { Service, Product } from '../types';

interface ServiceBillProps {
  onNavigate?: (page: any) => void;
}

const ServiceBill: React.FC<ServiceBillProps> = () => {
  const { services, updateService, refreshServices, loading: servicesLoading } = useServices();
  const { products, updateProduct, refreshProducts, loading: productsLoading } = useProducts();
  const { customers } = useCustomers();

  // Tab state
  const [activeTab, setActiveTab] = useState<'assign' | 'worked'>('assign');

  // Search & Selection states
  const [productSearch, setProductSearch] = useState('');
  const [partsBasket, setPartsBasket] = useState<Array<{ product: Product; qty: number }>>([]);
  
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  
  // Worked history search
  const [workedSearch, setWorkedSearch] = useState('');

  // Custom UI Modals & Toasts
  const [confirmModal, setConfirmModal] = useState<{ show: boolean } | null>(null);
  const [successModal, setSuccessModal] = useState<{ show: boolean; title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Processing state
  const [isSaving, setIsSaving] = useState(false);

  // Auto-refresh when tab changes
  useEffect(() => {
    refreshServices();
    refreshProducts();
  }, [activeTab]);

  // Show a custom toast notification that auto-fades
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Format vehicle number cleanly
  const formatVehicleNumber = (val: string) => {
    return val ? val.toUpperCase().replace(/[^A-Z0-9-]/g, '') : 'N/A';
  };

  // Filter products by search (if search is empty, suggest all in-stock products)
  const filteredProducts = products.filter(p => {
    if (!productSearch) return p.count > 0;
    const query = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.company && p.company.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      (p.skuCode && p.skuCode.toLowerCase().includes(query)) ||
      (p.productCode && p.productCode.toLowerCase().includes(query)) ||
      String(p.id).includes(query)
    );
  });

  // Filter active services (status 'pending' or 'in_progress')
  const activeServices = services.filter(s => {
    if (s.status !== 'pending' && s.status !== 'in_progress') return false;
    if (!vehicleSearch) return true;
    
    const query = vehicleSearch.toLowerCase();
    const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
    return (
      s.vehicleNumber.toLowerCase().includes(query) ||
      s.vehicleName.toLowerCase().includes(query) ||
      (cust && cust.name.toLowerCase().includes(query)) ||
      (cust && cust.phone.includes(query))
    );
  });

  // Filter completed services (Worked Bills completed via POS Billing page)
  const completedServices = services.filter(s => {
    if (s.status !== 'completed') return false;
    if (!workedSearch) return true;
    
    const query = workedSearch.toLowerCase();
    const cust = s.customerId ? customers.find(c => c.id === s.customerId) : null;
    return (
      s.vehicleNumber.toLowerCase().includes(query) ||
      s.vehicleName.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      (cust && cust.name.toLowerCase().includes(query)) ||
      (cust && cust.phone.includes(query))
    );
  });

  // Add product to spares basket
  const handleAddPartToBasket = (prod: Product) => {
    if (prod.count < 1) {
      showToast(`${prod.name} is out of stock!`, 'error');
      return;
    }

    setPartsBasket(prev => {
      const existing = prev.find(item => item.product.id === prod.id);
      let updatedBasket = [];
      if (existing) {
        if (existing.qty >= prod.count) {
          showToast(`Cannot add more. Available stock for ${prod.name} is ${prod.count}.`, 'info');
          return prev;
        }
        updatedBasket = prev.map(item => 
          item.product.id === prod.id 
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      } else {
        updatedBasket = [...prev, { product: prod, qty: 1 }];
      }

      // Selection rule: If basket has > 1 product, restrict vehicles selection to only one vehicle
      if (updatedBasket.length > 1 && selectedServiceIds.length > 1) {
        setSelectedServiceIds(prevIds => [prevIds[0]]);
        showToast('Multiple spares added. Vehicle selection pruned to single vehicle.', 'info');
      }

      return updatedBasket;
    });

    showToast(`Added ${prod.name} to spares basket.`);
  };

  // Update quantity in basket
  const handleUpdateBasketQty = (productId: number, newQty: number) => {
    setPartsBasket(prev => {
      const target = prev.find(item => item.product.id === productId);
      if (!target) return prev;

      const maxStock = target.product.count;
      let finalQty = newQty;
      if (newQty < 1) finalQty = 1;
      if (newQty > maxStock) {
        showToast(`Cannot exceed stock limit of ${maxStock} units.`, 'info');
        finalQty = maxStock;
      }

      return prev.map(item => 
        item.product.id === productId 
          ? { ...item, qty: finalQty }
          : item
      );
    });
  };

  // Remove product from basket
  const handleRemoveFromBasket = (productId: number) => {
    setPartsBasket(prev => {
      const updatedBasket = prev.filter(item => item.product.id !== productId);
      // If we went down to 1 or 0 products, the multi-vehicle selection holds as is
      return updatedBasket;
    });
    showToast('Removed spare part from basket.', 'info');
  };

  // Handle vehicle selection with rules:
  // - If partsBasket.length === 1: multiple vehicles allowed (standard checkboxes)
  // - If partsBasket.length > 1: only single vehicle allowed (radio behavior)
  const handleToggleVehicle = (id: number) => {
    const isMultipleParts = partsBasket.length > 1;

    if (isMultipleParts) {
      // Force single selection: click toggles or overrides
      setSelectedServiceIds(prev => (prev.includes(id) ? [] : [id]));
    } else {
      // Allow multiple selection
      setSelectedServiceIds(prev => 
        prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
      );
    }
  };

  // Select all vehicles (only allowed when parts basket has exactly 1 part)
  const handleSelectAllVehicles = () => {
    if (partsBasket.length > 1) {
      showToast('Cannot select all. Multiple parts can only be assigned to a single vehicle.', 'error');
      return;
    }

    const activeIds = activeServices.map(s => s.id);
    const allSelected = activeIds.every(id => selectedServiceIds.includes(id));
    
    if (allSelected) {
      setSelectedServiceIds(prev => prev.filter(id => !activeIds.includes(id)));
    } else {
      setSelectedServiceIds(prev => {
        const unique = new Set([...prev, ...activeIds]);
        return Array.from(unique);
      });
    }
  };

  // Trigger Save check
  const triggerSaveConfirmation = () => {
    if (partsBasket.length === 0) {
      showToast('Please add at least one spare part first.', 'error');
      return;
    }
    if (selectedServiceIds.length === 0) {
      showToast('Please select at least one vehicle card.', 'error');
      return;
    }

    // Verify stock counts for all items
    const getQtyNeeded = (baseQty: number) => {
      // If single part, it is applied to multiple vehicles, so Qty = baseQty * number of vehicles.
      // If multiple parts, it is applied to only 1 vehicle, so Qty = baseQty.
      return partsBasket.length > 1 ? baseQty : baseQty * selectedServiceIds.length;
    };

    for (const item of partsBasket) {
      const totalNeeded = getQtyNeeded(item.qty);
      if (item.product.count < totalNeeded) {
        showToast(`Insufficient stock! You need ${totalNeeded} units of ${item.product.name}, but only ${item.product.count} are in stock.`, 'error');
        return;
      }
    }

    setConfirmModal({ show: true });
  };

  // Save changes / Apply products to vehicles (does NOT complete status - holds status as active/in_progress)
  const handleSave = async () => {
    setConfirmModal(null);
    const getQtyNeeded = (baseQty: number) => {
      return partsBasket.length > 1 ? baseQty : baseQty * selectedServiceIds.length;
    };

    try {
      setIsSaving(true);
      
      let sparesCostTotal = 0;
      const partLogLines: string[] = [];

      // Compile lines and calculate total
      for (const item of partsBasket) {
        const itemCost = item.product.finalPrice * item.qty;
        sparesCostTotal += itemCost;
        partLogLines.push(`- Part: ${item.product.name} (Qty: ${item.qty} @ ₹${item.product.finalPrice.toFixed(2)})`);
      }

      // 1. Deduct product stock from inventory
      for (const item of partsBasket) {
        const totalNeeded = getQtyNeeded(item.qty);
        const newStock = Math.max(0, item.product.count - totalNeeded);
        await updateProduct(item.product.id, {
          count: newStock
        });
      }

      // 2. Update service records (append logs, update estimatedCost, hold status as in_progress/active)
      for (const serviceId of selectedServiceIds) {
        const srv = services.find(s => s.id === serviceId);
        if (!srv) continue;

        const newCost = srv.estimatedCost + sparesCostTotal;
        const additionalLogs = partLogLines.join('\n');
        const newDesc = srv.description 
          ? `${srv.description}\n${additionalLogs}` 
          : additionalLogs;

        await updateService(srv.id, {
          description: newDesc,
          estimatedCost: newCost,
          status: 'in_progress' // Keep in active workshop status
        });
      }

      const assignedCount = selectedServiceIds.length;

      // Clear selection states
      setSelectedServiceIds([]);
      setPartsBasket([]);
      setProductSearch('');

      setSuccessModal({
        show: true,
        title: 'Spares Assigned!',
        message: `Successfully linked spares to ${assignedCount} vehicle(s). Now, open the New Bill section, search for this customer, and check out their bill to auto-complete this workshop service.`
      });
      
    } catch (e) {
      console.error(e);
      showToast('An error occurred while saving the service updates.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to parse description into parts and labor
  const parseServiceDetails = (desc: string, totalCost: number) => {
    const lines = desc ? desc.split('\n') : [];
    const parts: Array<{ name: string; qty: number; price: number; total: number }> = [];
    const laborLines: string[] = [];
    
    lines.forEach(line => {
      const partRegex = /-\s*Part:\s*(.+)\s*\(Qty:\s*(\d+)\s*@\s*₹([\d.]+)\)/i;
      const match = line.match(partRegex);
      if (match) {
        const name = match[1].trim();
        const qty = parseInt(match[2]);
        const price = parseFloat(match[3]);
        parts.push({
          name,
          qty,
          price,
          total: qty * price
        });
      } else {
        if (line.trim()) {
          laborLines.push(line.replace(/^-\s*/, '').trim());
        }
      }
    });
    
    const partsTotal = parts.reduce((sum, p) => sum + p.total, 0);
    const laborTotal = Math.max(0, totalCost - partsTotal);
    
    return { parts, laborLines, partsTotal, laborTotal };
  };

  // Print Service Invoice
  const printServiceBill = (srv: Service) => {
    const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
    const rawSettings = localStorage.getItem('app_settings');
    const settings = rawSettings ? JSON.parse(rawSettings) : {
      storeName: 'SAM SERVICES',
      phone: '9965326590, 9047656890',
      address: '32-F, Near Eswaran Temple, Kadaiveethi, Idappadi – 637101',
      gstNumber: '',
      showGst: true,
      upiId: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      accountHolderName: '',
      footerMessage: 'Thank you for choosing our workshop!'
    };

    const { parts, laborLines, partsTotal, laborTotal } = parseServiceDetails(srv.description, srv.estimatedCost);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const partsRows = parts.map((p, idx) => `
      <tr>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">${idx + 1}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 10px;">${p.name} [Spare Part]</td>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">${p.qty}</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px;">₹${p.price.toFixed(2)}</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px; font-weight: 600;">₹${p.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const startIdx = parts.length;
    const laborRows = laborLines.map((line, idx) => `
      <tr>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">${startIdx + idx + 1}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 10px;">Labour/Job: ${line}</td>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">1</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px;">-</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px; font-weight: 600;">-</td>
      </tr>
    `).join('');

    const fallbackLaborRow = (laborRows === '' && laborTotal > 0) ? `
      <tr>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">${startIdx + 1}</td>
        <td style="border-bottom: 1px solid #e2e8f0; padding: 10px;">Service & Repair Labour Charge</td>
        <td style="text-align: center; border-bottom: 1px solid #e2e8f0; padding: 10px;">1</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px;">₹${laborTotal.toFixed(2)}</td>
        <td style="text-align: right; border-bottom: 1px solid #e2e8f0; padding: 10px; font-weight: 600;">₹${laborTotal.toFixed(2)}</td>
      </tr>
    ` : '';

    const gstRate = 18;
    const taxableValue = srv.estimatedCost / (1 + gstRate/100);
    const totalGst = srv.estimatedCost - taxableValue;
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    printWindow.document.write(`
      <html>
        <head>
          <title>Service Invoice | Job #${srv.id}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; color: #1e293b; background: #fff; font-size: 13px; line-height: 1.4; }
            .container { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .store-name { font-size: 24px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0 0 5px 0; }
            .store-info { color: #475569; font-size: 12px; }
            .invoice-title { font-size: 20px; font-weight: 700; color: #2563eb; text-align: right; margin: 0; letter-spacing: 0.5px; }
            .invoice-meta { font-size: 12px; color: #475569; text-align: right; }
            .divider { height: 2px; background: #3b82f6; margin: 15px 0; }
            .info-grid { display: table; width: 100%; margin-bottom: 20px; }
            .info-col { display: table-cell; width: 50%; vertical-align: top; }
            .info-card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-right: 10px; }
            .info-card-last { margin-right: 0; margin-left: 10px; }
            .info-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
            .info-text { margin-bottom: 3px; }
            .info-label { font-weight: 600; color: #475569; }
            .item-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .item-table th { background: #f1f5f9; padding: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; text-align: left; color: #475569; border-bottom: 2px solid #cbd5e1; }
            .item-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .totals-table { width: 45%; float: right; border-collapse: collapse; margin-bottom: 20px; }
            .totals-table td { padding: 6px 12px; font-size: 12px; color: #475569; }
            .totals-table tr.grand-total td { font-weight: 700; font-size: 14px; color: #0f172a; border-top: 1px solid #cbd5e1; border-bottom: 2px double #0f172a; }
            .payment-section { background: #eff6ff; border: 1px dashed #bfdbfe; padding: 12px; border-radius: 8px; font-size: 11px; color: #1e3a8a; width: 50%; float: left; box-sizing: border-box; }
            .payment-title { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
            .footer-msg { clear: both; text-align: center; font-size: 11px; color: #64748b; padding-top: 30px; }
            .signatures { display: table; width: 100%; margin-top: 50px; }
            .signature-box { display: table-cell; width: 50%; text-align: center; font-size: 11px; color: #64748b; }
            .signature-line { border-top: 1px dashed #94a3b8; width: 180px; margin: 40px auto 5px auto; }
            @media print { body { padding: 0; background: #fff; } .container { border: none; padding: 0; } }
          </style>
        </head>
        <body onload="window.print()">
          <div class="container">
            <table class="header-table">
              <tr>
                <td style="vertical-align: top;">
                  <h1 class="store-name">${settings.storeName}</h1>
                  <div class="store-info">
                    <p class="info-text">${settings.address}</p>
                    <p class="info-text"><span class="info-label">Phone:</span> ${settings.phone}</p>
                    ${settings.gstNumber ? `<p class="info-text"><span class="info-label">GSTIN:</span> ${settings.gstNumber}</p>` : ''}
                  </div>
                </td>
                <td style="vertical-align: top; text-align: right;">
                  <h2 class="invoice-title">Service Invoice</h2>
                  <div class="invoice-meta" style="margin-top: 10px;">
                    <p class="info-text"><span class="info-label">Invoice No:</span> SRV-${srv.id}</p>
                    <p class="info-text"><span class="info-label">Date:</span> ${new Date(srv.serviceDate).toLocaleDateString()}</p>
                    <p class="info-text"><span class="info-label">Job Status:</span> COMPLETED</p>
                  </div>
                </td>
              </tr>
            </table>
            
            <div class="divider"></div>
            
            <div class="info-grid">
              <div class="info-col">
                <div class="info-card">
                  <div class="info-title">Customer Information</div>
                  <div class="info-text"><span class="info-label">Name:</span> ${cust?.name || 'Walk-in Customer'}</div>
                  <div class="info-text"><span class="info-label">Phone:</span> ${cust?.phone || 'N/A'}</div>
                  ${cust?.address ? `<div class="info-text"><span class="info-label">Address:</span> ${cust.address}</div>` : ''}
                </div>
              </div>
              <div class="info-col">
                <div class="info-card info-card-last">
                  <div class="info-title">Vehicle Details</div>
                  <div class="info-text"><span class="info-label">Model/Name:</span> ${srv.vehicleName || 'N/A'}</div>
                  <div class="info-text"><span class="info-label">Reg. Number:</span> <span style="font-family: monospace; font-size: 14px; font-weight: 700;">${formatVehicleNumber(srv.vehicleNumber)}</span></div>
                </div>
              </div>
            </div>
            
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">S.No</th>
                  <th style="width: 52%;">Description of Spares & Labour</th>
                  <th style="width: 10%; text-align: center;">Qty</th>
                  <th style="width: 15%; text-align: right;">Unit Price</th>
                  <th style="width: 15%; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${partsRows}
                ${laborRows}
                ${fallbackLaborRow}
              </tbody>
            </table>
            
            <div style="width: 100%; display: inline-block;">
              <div class="payment-section">
                <div class="payment-title">Payment Account Info</div>
                ${settings.upiId ? `<p class="info-text"><span class="info-label">UPI ID:</span> ${settings.upiId}</p>` : ''}
                ${settings.bankAccountNumber ? `<p class="info-text"><span class="info-label">Bank A/C:</span> ${settings.bankAccountNumber}</p>` : ''}
                ${settings.bankIfscCode ? `<p class="info-text"><span class="info-label">IFSC Code:</span> ${settings.bankIfscCode}</p>` : ''}
                ${settings.accountHolderName ? `<p class="info-text"><span class="info-label">Name:</span> ${settings.accountHolderName}</p>` : ''}
                ${(!settings.upiId && !settings.bankAccountNumber) ? '<p class="info-text">Please settle invoice at cash counter.</p>' : ''}
              </div>
              
              <table class="totals-table">
                ${partsTotal > 0 ? `
                  <tr>
                    <td>Parts Subtotal:</td>
                    <td style="text-align: right; font-weight: 600;">₹${partsTotal.toFixed(2)}</td>
                  </tr>
                ` : ''}
                ${laborTotal > 0 ? `
                  <tr>
                    <td>Labour Charges:</td>
                    <td style="text-align: right; font-weight: 600;">₹${laborTotal.toFixed(2)}</td>
                  </tr>
                ` : ''}
                
                ${settings.showGst ? `
                  <tr>
                    <td>CGST (9%):</td>
                    <td style="text-align: right;">₹${cgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>SGST (9%):</td>
                    <td style="text-align: right;">₹${sgst.toFixed(2)}</td>
                  </tr>
                ` : ''}
                
                <tr class="grand-total">
                  <td>Grand Total:</td>
                  <td style="text-align: right;">₹${srv.estimatedCost.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div class="signatures">
              <div class="signature-box">
                <div class="signature-line"></div>
                <p>Customer Signature</p>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <p>Authorized Signature</p>
              </div>
            </div>
            
            <div class="footer-msg">
              <p>${settings.footerMessage}</p>
              <p style="font-size: 9px; color: #94a3b8; margin-top: 10px;">Generated via Billing Suite</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calculate total spares cost in basket
  const basketTotal = partsBasket.reduce((sum, item) => sum + (item.product.finalPrice * item.qty), 0);

  return (
    <div className="relative min-h-full rounded-none md:rounded-[2rem] bg-gradient-to-br from-white/90 via-slate-50/50 to-blue-50/30 p-4 md:p-8 shadow-soft backdrop-blur-md">
      
      {/* Toast Notifications */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[99999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 transform translate-y-0 scale-100 ${
          toast.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
          toast.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
          'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl scale-100 transform transition-all duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 mb-4">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-950">Assign Spares to Vehicles</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              You are about to assign <span className="font-bold text-slate-800">{partsBasket.length} spare part(s)</span> (Total spares cost: <span className="font-bold text-slate-800">₹{basketTotal.toFixed(2)}</span>) to <span className="font-bold text-slate-800">{selectedServiceIds.length} vehicle(s)</span>.
            </p>
            <p className="mt-2 text-xs text-slate-400 font-medium">
              This action will deduct stock from your inventory, update the repair description log, and prepare the services for POS invoicing without completing them immediately.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary flex-1"
              >
                {isSaving ? 'Saving...' : 'Yes, Assign Spares'}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn">
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 max-w-md w-full shadow-2xl text-center transform transition-all duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-5 shadow-inner">
              <ShieldCheck className="h-10 w-10 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">{successModal.title}</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {successModal.message}
            </p>
            <div className="mt-6">
              <button
                onClick={() => setSuccessModal(null)}
                className="btn btn-primary w-full shadow-lg shadow-emerald-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="relative mb-8 pb-6 border-b border-slate-200/50">
        <div className="absolute -top-3 -left-3 h-24 w-24 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex rounded-xl bg-primary-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-700 mb-2 shadow-sm">
              ⚙️ Quick Workshop Billing
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-950 to-primary-800 bg-clip-text text-transparent">
              Service Billing
            </h1>
            <p className="mt-1 text-slate-500 max-w-xl text-sm font-medium">
              Select spare parts first, then assign them to vehicle tickets. Complete invoicing in New Bill to close job cards.
            </p>
          </div>
          
          {/* Active Flow Indicator */}
          {activeTab === 'assign' && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-900/5 border border-slate-200/80 p-2.5 px-4 rounded-2xl text-xs font-semibold text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${partsBasket.length > 0 ? 'bg-primary-500' : 'bg-slate-300'}`} />
              <span>Select Spares</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className={`h-2.5 w-2.5 rounded-full ${selectedServiceIds.length > 0 ? 'bg-primary-500' : 'bg-slate-300'}`} />
              <span>Select Vehicle</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span>POS Invoice Checkout</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="mb-8 inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/50">
        <button
          onClick={() => setActiveTab('assign')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${
            activeTab === 'assign'
              ? 'bg-white text-slate-950 shadow-md shadow-slate-900/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4 text-primary-500" />
          Assign Spares
          {activeServices.length > 0 && (
            <span className="ml-1.5 rounded-lg bg-primary-100 text-primary-700 px-2 py-0.5 text-[10px] font-black">
              {activeServices.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('worked')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${
            activeTab === 'worked'
              ? 'bg-white text-slate-950 shadow-md shadow-slate-900/5'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-emerald-500" />
          Worked History
          {completedServices.length > 0 && (
            <span className="ml-1.5 rounded-lg bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-black">
              {completedServices.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Assign Parts */}
      {activeTab === 'assign' && (
        <div className="space-y-6">
          
          {/* Main Symmetric Panels (Side by Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            
            {/* Left Panel: Find Spare Parts */}
            <div className="card bg-white border border-slate-200/60 shadow-soft p-5 flex flex-col h-[580px]">
              <h2 className="text-base font-extrabold text-slate-950 mb-3 flex items-center gap-2 flex-shrink-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-100 text-primary-600 text-xs font-bold">1</span>
                Add Spare Parts
              </h2>
              
              <div className="relative mb-3 flex-shrink-0">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Type part name, barcode, model..."
                  className="input pl-4 w-full rounded-xl border-slate-200 focus:border-primary-500 text-sm"
                />
                {productSearch && (
                  <button 
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>

              {/* Suggested / Search results list */}
              <div className="h-44 overflow-y-auto pr-1 border border-slate-200/60 rounded-xl bg-slate-50/20 mb-3 flex-shrink-0">
                <div className="divide-y divide-slate-100">
                  {productsLoading ? (
                    <div className="p-3 text-center text-slate-400 text-xs font-medium">Loading inventory records...</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs font-medium">No spares matched your query.</div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddPartToBasket(p)}
                        className="w-full text-left p-2.5 px-3 flex items-center justify-between hover:bg-primary-50/30 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">
                            {p.company || 'Generic'} {p.skuCode && `• SKU: ${p.skuCode}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-900 text-xs">₹{p.finalPrice.toFixed(2)}</p>
                          <span className={`inline-block rounded px-1 py-0.25 text-[8px] font-bold ${
                            p.count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            Stock: {p.count}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Basket list of selected spares */}
              <div className="flex-1 overflow-y-auto pr-1 mt-1 border-t border-slate-200/50 pt-2 flex flex-col">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex justify-between">
                  <span>Parts Basket ({partsBasket.length})</span>
                  {partsBasket.length > 0 && <span className="text-primary-600 font-black">Subtotal: ₹{basketTotal.toFixed(2)}</span>}
                </p>

                {partsBasket.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center p-6 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-600">Basket is Empty</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Search and click on spares above to add them to your list.</p>
                  </div>
                ) : (
                  <div className="space-y-2 flex-1">
                    {partsBasket.map(item => (
                      <div
                        key={item.product.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-xs truncate leading-snug">{item.product.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">Rate: ₹{item.product.finalPrice.toFixed(2)} | Stock: {item.product.count}</p>
                        </div>

                        {/* Qty and delete controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex gap-1 items-center bg-white p-0.5 rounded border border-slate-200">
                            <button
                              onClick={() => handleUpdateBasketQty(item.product.id, item.qty - 1)}
                              className="btn-secondary h-6 w-6 p-0 flex items-center justify-center text-xs font-black rounded-md"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                            <button
                              onClick={() => handleUpdateBasketQty(item.product.id, item.qty + 1)}
                              className="btn-secondary h-6 w-6 p-0 flex items-center justify-center text-xs font-black rounded-md"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemoveFromBasket(item.product.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Remove part"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Select Workshop Vehicles */}
            <div className="card bg-white border border-slate-200/60 shadow-soft p-5 flex flex-col h-[580px] relative">
              
              {partsBasket.length === 0 && (
                <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-[1px] rounded-3xl z-10 flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
                    <Wrench className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800">Select Vehicles Locked</h3>
                  <p className="text-xs text-slate-500 max-w-[240px] mt-1">
                    Please add at least one spare part in the left panel to unlock vehicle selection.
                  </p>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between flex-shrink-0 gap-2">
                <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-100 text-primary-600 text-xs font-bold">2</span>
                  Select Target Vehicles
                </h2>
                
                <div className="flex items-center gap-2.5">
                  {activeServices.length > 0 && partsBasket.length === 1 && (
                    <button
                      onClick={handleSelectAllVehicles}
                      className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 bg-primary-50/30 px-3 py-1.5 rounded-xl border border-primary-200/30 hover:border-primary-300 transition-all animate-fadeIn"
                    >
                      {activeServices.every(s => selectedServiceIds.includes(s.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  
                  <button
                    onClick={triggerSaveConfirmation}
                    disabled={isSaving || partsBasket.length === 0 || selectedServiceIds.length === 0}
                    className="btn btn-primary py-2 px-4 font-bold shadow-lg flex items-center gap-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none transition-all duration-200"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : 'Assign & Save'}
                  </button>
                </div>
              </div>

              {/* Selection Rule Toast Warning Banner */}
              {partsBasket.length > 1 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[10px] text-amber-800 font-semibold animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span>Multiple Spares Mode Active:</span>
                    <p className="font-normal text-slate-500 mt-0.5">Adding multiple spares restricts selection to only one vehicle at a time.</p>
                  </div>
                </div>
              )}

              {/* Vehicle Filter Search */}
              <div className="relative mb-3 flex-shrink-0">
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Filter by owner, vehicle number or name..."
                  className="input pl-4 w-full rounded-xl border-slate-200 focus:border-primary-500 text-sm"
                />
              </div>

              {/* Active services vertical list */}
              <div className="flex-1 overflow-y-auto pr-1">
                {servicesLoading ? (
                  <div className="p-8 text-center text-slate-400 font-medium">Loading vehicles list...</div>
                ) : activeServices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 h-full flex flex-col justify-center items-center">
                    <Wrench className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-slate-700 font-extrabold text-sm">No Active Workshop Vehicles</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeServices.map(srv => {
                      const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
                      const isSelected = selectedServiceIds.includes(srv.id);
                      const isMultipleParts = partsBasket.length > 1;
                      
                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleToggleVehicle(srv.id)}
                          className={`group p-3 rounded-xl border transition-all duration-200 cursor-pointer flex gap-3 items-center select-none ${
                            isSelected
                              ? 'bg-primary-50/40 border-primary-500 shadow-sm'
                              : 'bg-slate-50/40 hover:bg-white border-slate-100 hover:border-slate-300/80'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary-600 text-white">
                                <Check className="w-3.5 h-3.5 font-bold" />
                              </div>
                            ) : (
                              <div className={`h-5 w-5 border border-slate-300 bg-white ${isMultipleParts ? 'rounded-full' : 'rounded'}`} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-x-2">
                              <span className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.25 rounded">
                                {formatVehicleNumber(srv.vehicleNumber)}
                              </span>
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {srv.vehicleName || 'General Repair'}
                              </span>
                            </div>
                            
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{cust?.name || 'Walk-in Customer'}</span>
                              <span className="text-slate-300">•</span>
                              <span className="truncate">{cust?.phone || 'No Phone'}</span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 pl-1">
                            <span className="font-bold text-slate-950 text-xs">₹{srv.estimatedCost.toFixed(2)}</span>
                            <div className="mt-0.5">
                              {srv.status === 'pending' ? (
                                <span className="inline-flex rounded px-1 text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Pending
                                </span>
                              ) : (
                                <span className="inline-flex rounded px-1 text-[8px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  Workshop
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Centered/Wide Sticky Summary at the Bottom */}
          {partsBasket.length > 0 && selectedServiceIds.length > 0 && (
            <div className="card bg-slate-950 text-white border border-slate-800 p-4 shadow-xl relative overflow-hidden animate-fadeIn w-full flex items-center justify-between gap-4">
              <div className="absolute -right-8 -top-8 h-24 w-24 bg-primary-600/20 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary-900/40 text-primary-400">
                  <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">
                    Assigning {partsBasket.length} Spares to {selectedServiceIds.length} Vehicle(s)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Spares Total: <span className="text-white font-semibold">₹{(basketTotal * (partsBasket.length > 1 ? 1 : selectedServiceIds.length)).toFixed(2)}</span>. Please click **Assign & Save** at the top right of the vehicle selector to confirm.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Worked History */}
      {activeTab === 'worked' && (
        <div className="card bg-white border border-slate-200/60 shadow-soft p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
              Completed Service History
            </h2>
          </div>

          <div className="relative mb-5">
            <input
              type="text"
              value={workedSearch}
              onChange={(e) => setWorkedSearch(e.target.value)}
              placeholder="Search completed services by registration tag, model or customer..."
              className="input pl-4 w-full rounded-xl border-slate-200 focus:border-primary-500 text-sm"
            />
          </div>

          {servicesLoading ? (
            <div className="p-8 text-center text-slate-400 font-medium">Loading completed services...</div>
          ) : completedServices.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-700 font-extrabold text-sm">No Worked Bills Found</p>
              <p className="text-slate-400 text-xs mt-1">Services appear here after their checkout invoices are generated on the Billing page.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {completedServices.map(srv => {
                const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
                const { parts, laborTotal } = parseServiceDetails(srv.description, srv.estimatedCost);
                
                return (
                  <div
                    key={srv.id}
                    className="p-5 rounded-2xl border border-slate-100 bg-slate-50/20 hover:bg-white hover:border-slate-200/80 hover:shadow-soft transition-all duration-200 flex flex-col md:flex-row justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                          {formatVehicleNumber(srv.vehicleNumber)}
                        </span>
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {srv.vehicleName || 'General Repair'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                          SRV-{srv.id}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700">{cust?.name || 'Walk-in Customer'}</span>
                        <span className="text-slate-300">•</span>
                        <span>{cust?.phone || 'No Phone'}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 font-medium">Billed: {new Date(srv.serviceDate).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-3 bg-white p-3 rounded-xl border border-slate-100 max-w-xl">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mb-1.5">Job Card Log / Work Done</p>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{srv.description || 'No job details written.'}</p>
                        
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-x-3 text-[10px] text-slate-500 font-bold">
                          {parts.length > 0 && (
                            <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                              SPARE PARTS: {parts.length} items (₹{parts.reduce((sum, p) => sum + p.total, 0).toFixed(2)})
                            </span>
                          )}
                          {laborTotal > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              LABOUR & SERVICE CHARGE: ₹{laborTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right flex flex-row md:flex-col justify-between items-center md:items-end gap-3 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Final Billed Cost</span>
                        <span className="font-black text-emerald-600 text-lg">₹{srv.estimatedCost.toFixed(2)}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => printServiceBill(srv)}
                          className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold shadow-sm"
                          title="Print Invoice"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          Print Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceBill;
