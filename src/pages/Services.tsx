import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  DollarSign,
  User,
  X,
  Save,
  Printer,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useServices, useCustomers } from '../hooks/useDatabase';
import { Service, Bill, BillItem } from '../types';
import {
  generateQRData,
  generateThermalCompactReceipt,
  generateThermalStandardReceipt,
  generateThermalDetailedReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt
} from '../utils/templateGenerator';

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

const Services: React.FC = () => {
  const { services, addService, updateService, deleteService, refreshServices, loading } = useServices();
  const { customers } = useCustomers();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [billingModal, setBillingModal] = useState<{
    show: boolean;
    service: Service;
    customerName: string;
    customerPhone: string;
    additionalCharges: Array<{ name: string; amount: number }>;
    newChargeName: string;
    newChargeAmount: string;
  } | null>(null);
  
  // Search state for linking existing customer
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '' as string | number,
    vehicleName: '',
    vehicleNumber: '',
    serviceDate: new Date().toISOString().split('T')[0],
    description: '',
    estimatedCost: '' as string | number,
    status: 'pending' as 'pending' | 'in_progress' | 'completed' | 'cancelled'
  });

  React.useEffect(() => {
    const redirectDataRaw = localStorage.getItem('services_redirect_customer');
    if (redirectDataRaw && services && services.length > 0) {
      localStorage.removeItem('services_redirect_customer');
      try {
        const { customerId, vehicleName, vehicleNumber } = JSON.parse(redirectDataRaw);
        
        // Find if there is an active (non-completed, non-cancelled) job card for this customer/vehicle
        const activeTicket = services.find(s => 
          (s.customerId === customerId || (vehicleNumber && s.vehicleNumber.toLowerCase() === vehicleNumber.toLowerCase())) &&
          s.status !== 'completed' && s.status !== 'cancelled'
        );
        
        if (activeTicket) {
          // Redirect to existing job card: filter search list and open modal
          setSearchTerm(activeTicket.vehicleNumber);
          setEditingService(activeTicket);
          setFormData({
            customerId: activeTicket.customerId || '',
            vehicleName: activeTicket.vehicleName || '',
            vehicleNumber: activeTicket.vehicleNumber || '',
            serviceDate: activeTicket.serviceDate ? activeTicket.serviceDate.split('T')[0] : new Date().toISOString().split('T')[0],
            description: activeTicket.description || '',
            estimatedCost: activeTicket.estimatedCost || '',
            status: activeTicket.status || 'pending'
          });
          if (activeTicket.customerId) {
            const linkedCustomer = customers.find(c => c.id === activeTicket.customerId);
            if (linkedCustomer) {
              setCustomerSearchQuery(linkedCustomer.name);
            }
          }
          setShowFormModal(true);
        } else {
          // Create a new job card: open form and prefill data
          setEditingService(null);
          setFormData({
            customerId: customerId || '',
            vehicleName: vehicleName || '',
            vehicleNumber: vehicleNumber || '',
            serviceDate: new Date().toISOString().split('T')[0],
            description: '',
            estimatedCost: '',
            status: 'pending'
          });
          if (customerId) {
            const linkedCustomer = customers.find(c => c.id === customerId);
            if (linkedCustomer) {
              setCustomerSearchQuery(linkedCustomer.name);
            }
          }
          setShowFormModal(true);
        }
      } catch (e) {
        console.error('Failed to parse redirect data', e);
      }
    }
  }, [services, customers]);

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

  const handleSelectCustomer = (cust: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: cust.id,
      vehicleName: cust.vehicleName || prev.vehicleName,
      vehicleNumber: cust.vehicleNumber || prev.vehicleNumber
    }));
    setCustomerSearchQuery(cust.name);
    setShowCustomerDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      vehicleName: '',
      vehicleNumber: '',
      serviceDate: new Date().toISOString().split('T')[0],
      description: '',
      estimatedCost: '',
      status: 'pending'
    });
    setCustomerSearchQuery('');
    setEditingService(null);
    setShowFormModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNumber.trim()) {
      alert('Vehicle number is required.');
      return;
    }

    try {
      const dataToSave = {
        customerId: formData.customerId ? parseInt(String(formData.customerId)) : null,
        vehicleName: formData.vehicleName.trim(),
        vehicleNumber: formData.vehicleNumber.trim(),
        serviceDate: formData.serviceDate,
        description: formData.description.trim(),
        estimatedCost: parseFloat(String(formData.estimatedCost)) || 0,
        status: formData.status
      };

      if (editingService) {
        await updateService(editingService.id, dataToSave);
        alert('Service ticket updated successfully!');
      } else {
        await addService(dataToSave);
        alert('Service ticket created successfully!');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to save service ticket.');
    }
  };

  const handleEdit = (srv: Service) => {
    setEditingService(srv);
    setFormData({
      customerId: srv.customerId || '',
      vehicleName: srv.vehicleName || '',
      vehicleNumber: srv.vehicleNumber || '',
      serviceDate: srv.serviceDate || new Date().toISOString().split('T')[0],
      description: srv.description || '',
      estimatedCost: srv.estimatedCost || 0,
      status: srv.status || 'pending'
    });
    
    if (srv.customerId) {
      const linkedCustomer = customers.find(c => c.id === srv.customerId);
      if (linkedCustomer) {
        setCustomerSearchQuery(linkedCustomer.name);
      }
    }
    
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this service ticket?')) {
      try {
        await deleteService(id);
        alert('Service ticket deleted.');
      } catch (e) {
        alert('Failed to delete service ticket.');
      }
    }
  };

  const handleStatusChange = async (srv: Service, newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      await updateService(srv.id, { status: newStatus });
    } catch (e) {
      alert('Failed to update status.');
    }
  };

  const handleConvertToBill = (srv: Service) => {
    const billCustomer = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
    setBillingModal({
      show: true,
      service: srv,
      customerName: billCustomer ? billCustomer.name : 'Walk-in Customer',
      customerPhone: billCustomer ? billCustomer.phone : '',
      additionalCharges: [],
      newChargeName: '',
      newChargeAmount: ''
    });
  };

  const printEstimatedBill = (srv: Service, finalCustomerName: string, finalCustomerPhone: string) => {
    // 1. Fetch store settings
    const appSettingsRaw = localStorage.getItem('app_settings');
    const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : {};
    const settings = {
      storeName: appSettings.storeName || 'SAM SERVICES',
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

    // 2. Parse description lines to extract spares, labor, and additionals
    const lines = srv.description ? srv.description.split('\n') : [];
    const parts: Array<{ name: string; qty: number; price: number; total: number }> = [];
    const additionals: Array<{ name: string; amount: number }> = [];
    const laborLines: string[] = [];
    
    lines.forEach(line => {
      const partRegex = /-\s*Part:\s*(.+)\s*\(Qty:\s*(\d+)\s*@\s*₹([\d.]+)\)/i;
      const addRegex = /-\s*Additional:\s*(.+)\s*\(₹([\d.]+)\)/i;
      
      const partMatch = line.match(partRegex);
      const addMatch = line.match(addRegex);
      
      if (partMatch) {
        const name = partMatch[1].trim();
        const qty = parseInt(partMatch[2]);
        const price = parseFloat(partMatch[3]);
        parts.push({
          name,
          qty,
          price,
          total: qty * price
        });
      } else if (addMatch) {
        const name = addMatch[1].trim();
        const amount = parseFloat(addMatch[2]);
        additionals.push({
          name,
          amount
        });
      } else {
        if (line.trim()) {
          laborLines.push(line.replace(/^-\s*/, '').trim());
        }
      }
    });
    
    const partsTotal = parts.reduce((sum, p) => sum + p.total, 0);
    const additionalsTotal = additionals.reduce((sum, a) => sum + a.amount, 0);
    const laborTotal = Math.max(0, srv.estimatedCost - partsTotal - additionalsTotal);

    // 3. Map srv items to BillItem[]
    const mockBillItems: BillItem[] = [];
    let itemIdCounter = 1;

    // Add spares
    parts.forEach(p => {
      mockBillItems.push({
        id: itemIdCounter++,
        billId: srv.id,
        productId: itemIdCounter,
        quantity: p.qty,
        unitPrice: p.price,
        discount: 0,
        gst: 18,
        totalPrice: p.total,
        product: {
          id: itemIdCounter,
          name: p.name,
          company: '',
          barcode: 'SPARE_PART',
          sellingPrice: p.price,
          finalPrice: p.price,
          count: p.qty,
          costPrice: 0,
          discount: 0,
          gst: 18,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    });

    // Add additionals
    additionals.forEach(a => {
      mockBillItems.push({
        id: itemIdCounter++,
        billId: srv.id,
        productId: itemIdCounter,
        quantity: 1,
        unitPrice: a.amount,
        discount: 0,
        gst: 18,
        totalPrice: a.amount,
        product: {
          id: itemIdCounter,
          name: `${a.name} [Additional Charge]`,
          company: '',
          barcode: 'SERVICE_CUSTOM',
          sellingPrice: a.amount,
          finalPrice: a.amount,
          count: 1,
          costPrice: 0,
          discount: 0,
          gst: 18,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    });

    // Add labor
    if (laborTotal > 0 || (laborLines.length > 0 && srv.estimatedCost > partsTotal + additionalsTotal)) {
      const laborDesc = laborLines.join(', ') || 'Labour & Service Charges';
      mockBillItems.push({
        id: itemIdCounter++,
        billId: srv.id,
        productId: -999,
        quantity: 1,
        unitPrice: laborTotal,
        discount: 0,
        gst: 18,
        totalPrice: laborTotal,
        product: {
          id: -999,
          name: `Labour: ${laborDesc}`,
          company: '',
          barcode: 'SERVICE_CUSTOM',
          sellingPrice: laborTotal,
          finalPrice: laborTotal,
          count: 1,
          costPrice: 0,
          discount: 0,
          gst: 18,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }

    // 4. Construct mock Bill object
    const mockBill: Bill = {
      id: srv.id,
      billNumber: `SRV-${srv.id}`,
      totalAmount: srv.estimatedCost,
      totalDiscount: 0,
      totalGst: srv.estimatedCost - (srv.estimatedCost / 1.18),
      finalAmount: srv.estimatedCost,
      paymentMethod: 'cash',
      status: 'completed',
      createdAt: srv.serviceDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: {
        id: srv.customerId || 0,
        name: finalCustomerName,
        phone: finalCustomerPhone,
        address: '',
        email: '',
        creditBalance: 0,
        totalPurchases: srv.estimatedCost,
        purchaseCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vehicleName: srv.vehicleName,
        vehicleNumber: srv.vehicleNumber
      },
      items: mockBillItems,
      isGstBill: settings.showGst
    };

    // 5. Generate template
    const qrData = generateQRData(mockBill, settings);
    const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';
    
    let receiptHTML = '';
    switch (selectedTemplate) {
      case 'thermal-compact':
        receiptHTML = generateThermalCompactReceipt(mockBill, settings, qrData);
        break;
      case 'thermal-detailed':
        receiptHTML = generateThermalDetailedReceipt(mockBill, settings, qrData);
        break;
      case 'regular-a5':
        receiptHTML = generateRegularA5Receipt(mockBill, settings, qrData);
        break;
      case 'regular-a4':
        receiptHTML = generateRegularA4Receipt(mockBill, settings, qrData);
        break;
      case 'regular-a4-detailed':
        receiptHTML = generateRegularA4DetailedReceipt(mockBill, settings, qrData);
        break;
      case 'thermal-standard':
      default:
        receiptHTML = generateThermalStandardReceipt(mockBill, settings, qrData);
    }

    // Write to window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    }
  };

  const printJobCard = (srv: Service) => {
    const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Service Job Card #${srv.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #1e3a8a; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .section-title { font-weight: bold; font-size: 14px; text-transform: uppercase; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
            .info-item { margin-bottom: 8px; font-size: 14px; }
            .info-label { font-weight: bold; color: #374151; }
            .desc-box { border: 1px solid #d1d5db; padding: 15px; border-radius: 8px; background: #f9fafb; font-size: 14px; white-space: pre-wrap; margin-bottom: 20px; min-height: 100px; }
            .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-in_progress { background: #dbeafe; color: #1e40af; }
            .status-completed { background: #d1fae5; color: #065f46; }
            .status-cancelled { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; }
            .signature { border-top: 1px dashed #9ca3af; width: 200px; text-align: center; padding-top: 5px; margin-top: 40px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <h1>SERVICE JOB CARD</h1>
            <p style="margin: 5px 0 0 0;">Ticket ID: #${srv.id} | Date: ${new Date(srv.serviceDate).toLocaleDateString()}</p>
          </div>
          
          <div class="grid">
            <div>
              <div class="section-title">Customer Information</div>
              <div class="info-item"><span class="info-label">Name:</span> ${cust?.name || 'Walk-in'}</div>
              <div class="info-item"><span class="info-label">Phone:</span> ${cust?.phone || 'N/A'}</div>
              ${cust?.email ? `<div class="info-item"><span class="info-label">Email:</span> ${cust.email}</div>` : ''}
              ${cust?.address ? `<div class="info-item"><span class="info-label">Address:</span> ${cust.address}</div>` : ''}
            </div>
            
            <div>
              <div class="section-title">Vehicle & Cost details</div>
              <div class="info-item"><span class="info-label">Vehicle Name:</span> ${srv.vehicleName || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Vehicle Number:</span> <span style="font-family: monospace; font-size: 15px; font-weight: bold;">${srv.vehicleNumber}</span></div>
              <div class="info-item"><span class="info-label">Estimated Cost:</span> ₹${srv.estimatedCost.toFixed(2)}</div>
              <div class="info-item">
                <span class="info-label">Status:</span> 
                <span class="status-badge status-${srv.status}">
                  ${srv.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          
          <div class="section-title">Service Description / Requested Tasks</div>
          <div class="desc-box">${srv.description || 'No description provided.'}</div>
          
          <div class="footer">
            <div class="signature">Customer Signature</div>
            <div class="signature">Technician Signature</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredCustomerOptions = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.phone.includes(customerSearchQuery)
  );

  const filteredServices = services.filter(srv => {
    const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
    const nameMatch = cust?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const vehicleMatch = srv.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         srv.vehicleName.toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = srv.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const searchMatches = nameMatch || vehicleMatch || descMatch || searchTerm === '';
    const statusMatches = statusFilter === 'all' || srv.status === statusFilter;

    return searchMatches && statusMatches;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            <Wrench className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} /> In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            <XCircle className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = services.filter(s => s.status === 'pending').length;
  const progressCount = services.filter(s => s.status === 'in_progress').length;
  const completedCount = services.filter(s => s.status === 'completed').length;

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Automotive repairs</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Service Tickets</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Track and manage client vehicles, repair progress, and job sheets seamlessly.</p>
        </div>
        <div className="flex gap-3 xl:justify-end">
          <button
            type="button"
            onClick={refreshServices}
            className="btn-secondary flex items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Refresh Job Cards"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowFormModal(true);
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Create Job Card
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border border-white/60 bg-white/95 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Pending Vehicles</p>
              <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="card border border-white/60 bg-white/95 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">In Workshop</p>
              <p className="text-2xl font-bold text-slate-900">{progressCount}</p>
            </div>
          </div>
        </div>
        <div className="card border border-white/60 bg-white/95 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Ready / Done</p>
              <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & search */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-1.5 md:border-b-0 md:pb-0">
          {(['all', 'pending', 'in_progress', 'completed', 'cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100/70'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by vehicle, client, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10 w-full max-w-sm"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* List Container */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading service list...</div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No service tickets found</h3>
            <p className="text-slate-600">
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting filters or search query' : 'Create your first vehicle job card to start.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(srv => {
              const cust = srv.customerId ? customers.find(c => c.id === srv.customerId) : null;
              
              return (
                <div key={srv.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft hover:-translate-y-0.5 hover:border-primary-200 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-400">Card #{srv.id}</span>
                      {getStatusBadge(srv.status)}
                    </div>

                    <h3 className="font-bold text-slate-950 text-base flex items-center gap-1.5">
                      <span>🚗</span>
                      {srv.vehicleName || 'Unknown Vehicle'}
                    </h3>
                    
                    <p className="mt-1 text-[13px] font-mono font-bold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 w-fit uppercase">
                      {srv.vehicleNumber}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Client: <strong className="text-slate-900">{cust ? cust.name : 'Walk-in'}</strong> {cust ? `(${cust.phone})` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Date: {new Date(srv.serviceDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Estimated Cost: <strong className="text-slate-900 text-sm font-bold">₹{srv.estimatedCost.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Details:</p>
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 line-clamp-3 leading-relaxed border border-slate-100 font-medium">
                        {srv.description || 'No work description details provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 border-t border-slate-100 pt-3 flex flex-col gap-2">
                    {/* Status progress shortcut buttons */}
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Set Status:</span>
                      <div className="flex gap-1">
                        {srv.status !== 'pending' && (
                          <button
                            onClick={() => handleStatusChange(srv, 'pending')}
                            className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] hover:bg-amber-200"
                          >
                            Pend
                          </button>
                        )}
                        {srv.status !== 'in_progress' && (
                          <button
                            onClick={() => handleStatusChange(srv, 'in_progress')}
                            className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px] hover:bg-blue-200"
                          >
                            Work
                          </button>
                        )}
                        {srv.status !== 'completed' && (
                          <button
                            onClick={() => handleStatusChange(srv, 'completed')}
                            className="bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[10px] hover:bg-emerald-200"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => printJobCard(srv)}
                        className="btn-secondary flex-1 flex items-center justify-center gap-1 py-1.5 text-xs"
                        title="Print Job Slip"
                      >
                        <Printer className="w-3.5 h-3.5" /> Job Card
                      </button>

                      {srv.status !== 'cancelled' && (
                        <button
                          onClick={() => handleConvertToBill(srv)}
                          className="btn-primary bg-indigo-600 hover:bg-indigo-700 flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold"
                          title="Generate POS Invoice"
                        >
                          Bill POS <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end mt-1">
                      <button
                        onClick={() => handleEdit(srv)}
                        className="text-primary-600 hover:text-primary-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                        title="Edit Job sheet"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(srv.id)}
                        className="text-red-600 hover:text-red-900 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        title="Delete Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation/Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Wrench className="text-primary-600" />
                {editingService ? 'Edit Service Job Card' : 'Create New Job Card'}
              </h2>
              <button onClick={resetForm} className="btn-icon btn-icon-neutral text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Linked Customer (Autocomplete search) */}
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search & Link Customer (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                      if (e.target.value === '') {
                        setFormData(prev => ({ ...prev, customerId: '' }));
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="input w-full pr-10"
                    placeholder="Type name or phone to search..."
                  />
                  <Search className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                </div>

                {showCustomerDropdown && customerSearchQuery.trim() !== '' && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredCustomerOptions.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">No customers found.</div>
                    ) : (
                      filteredCustomerOptions.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 flex flex-col transition-colors"
                        >
                          <span className="font-semibold text-slate-900 text-sm">{c.name}</span>
                          <span className="text-xs text-slate-500">{c.phone} {c.vehicleNumber ? `[🚗 ${c.vehicleNumber}]` : ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleNumber}
                    onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                    className="input w-full uppercase"
                    placeholder="e.g. TN-10-AU-1520"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Service Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.serviceDate}
                    onChange={(e) => handleInputChange('serviceDate', e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Estimated Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estimatedCost}
                    onChange={(e) => handleInputChange('estimatedCost', e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="input w-full"
                  title="Select Status"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Service Tasks / Descriptions
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full h-28 resize-none rounded-lg px-3 py-2.5 text-sm text-slate-900 font-medium bg-white border-2 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition placeholder:text-slate-400 leading-relaxed"
                  placeholder="Describe service work (e.g. Engine Oil Change, AC repair...)"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5"
                >
                  <Save className="w-4 h-4" />
                  {editingService ? 'Update Job Card' : 'Save Job Card'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS Billing & Additional Charges Modal */}
      {billingModal && billingModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-lg w-full shadow-2xl scale-100 transform transition-all duration-300 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600 animate-pulse" />
                Complete POS Bill Checkout
              </h3>
              <button
                onClick={() => setBillingModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Customer Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={billingModal.customerName}
                    onChange={(e) => setBillingModal({ ...billingModal, customerName: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Contact</label>
                  <input
                    type="text"
                    value={billingModal.customerPhone}
                    onChange={(e) => setBillingModal({ ...billingModal, customerPhone: e.target.value })}
                    className="input w-full text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Vehicle info (read only) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/60 text-xs flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Details</p>
                  <p className="font-bold text-slate-800 mt-0.5">{billingModal.service.vehicleName || 'General Repair'}</p>
                </div>
                <span className="font-mono text-xs font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                  {billingModal.service.vehicleNumber.toUpperCase()}
                </span>
              </div>

              {/* Spare Parts List */}
              {(() => {
                const parseModalParts = (desc: string) => {
                  const descLines = desc ? desc.split('\n') : [];
                  const parsed: Array<{ name: string; qty: number; price: number; total: number }> = [];
                  descLines.forEach(line => {
                    const partRegex = /-\s*Part:\s*(.+)\s*\(Qty:\s*(\d+)\s*@\s*₹([\d.]+)\)/i;
                    const match = line.match(partRegex);
                    if (match) {
                      parsed.push({
                        name: match[1].trim(),
                        qty: parseInt(match[2]),
                        price: parseFloat(match[3]),
                        total: parseInt(match[2]) * parseFloat(match[3])
                      });
                    }
                  });
                  return parsed;
                };
                const assignedParts = parseModalParts(billingModal.service.description);
                if (assignedParts.length === 0) return null;
                return (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Spare Parts</p>
                    <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                      {assignedParts.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <span className="font-semibold text-slate-700">⚙️ {p.name} (Qty: {p.qty})</span>
                          <span className="font-bold text-slate-900">₹{p.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Additional Charges Section */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Additional Charges</p>
                
                {/* Inputs to add new charge */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-7">
                    <input
                      type="text"
                      value={billingModal.newChargeName}
                      onChange={(e) => setBillingModal({ ...billingModal, newChargeName: e.target.value })}
                      placeholder="Charge name (e.g. Water Wash)"
                      className="input w-full text-xs border-slate-200"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={billingModal.newChargeAmount}
                      onChange={(e) => setBillingModal({ ...billingModal, newChargeAmount: e.target.value })}
                      placeholder="Amount (₹)"
                      className="input w-full text-xs font-bold border-slate-200"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => {
                        if (!billingModal.newChargeName.trim()) {
                          alert('Please enter a charge name.');
                          return;
                        }
                        const amt = parseFloat(billingModal.newChargeAmount);
                        if (isNaN(amt) || amt <= 0) {
                          alert('Please enter a valid positive amount.');
                          return;
                        }
                        setBillingModal({
                          ...billingModal,
                          additionalCharges: [
                            ...billingModal.additionalCharges,
                            { name: billingModal.newChargeName.trim(), amount: amt }
                          ],
                          newChargeName: '',
                          newChargeAmount: ''
                        });
                      }}
                      className="btn btn-secondary w-full py-2 flex items-center justify-center border-slate-200"
                      title="Add Charge"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* List of current additional charges */}
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {billingModal.additionalCharges.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No additional charges added.</p>
                  ) : (
                    billingModal.additionalCharges.map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 border border-slate-150 rounded-xl">
                        <span className="font-semibold text-slate-700">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-950">₹{c.amount.toFixed(2)}</span>
                          <button
                            onClick={() => {
                              const updated = [...billingModal.additionalCharges];
                              updated.splice(idx, 1);
                              setBillingModal({ ...billingModal, additionalCharges: updated });
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total calculations */}
              <div className="p-4 bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-md">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Base Job Cost:</span>
                  <span>₹{billingModal.service.estimatedCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Additional Charges:</span>
                  <span>
                    ₹{billingModal.additionalCharges.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white mt-2 pt-2 border-t border-slate-800">
                  <span className="text-primary-300">Final Estimated Bill:</span>
                  <span className="text-primary-300 font-extrabold text-base">
                    ₹{(
                      billingModal.service.estimatedCost + 
                      billingModal.additionalCharges.reduce((sum, c) => sum + c.amount, 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                onClick={async () => {
                  try {
                    const additionalsTotal = billingModal.additionalCharges.reduce((sum, c) => sum + c.amount, 0);
                    const finalCost = billingModal.service.estimatedCost + additionalsTotal;
                    
                    // Compile logs in standard parseable format
                    const additionalLogs = billingModal.additionalCharges
                      .map(c => `- Additional: ${c.name} (₹${c.amount.toFixed(2)})`)
                      .join('\n');
                    
                    const newDesc = billingModal.service.description
                      ? `${billingModal.service.description}\n${additionalLogs}`
                      : additionalLogs;

                    // Update database
                    await updateService(billingModal.service.id, {
                      description: newDesc,
                      estimatedCost: finalCost
                    });

                    // Close Modal
                    setBillingModal(null);
                    alert('Service bill details saved successfully!');
                  } catch (err) {
                    console.error(err);
                    alert('Failed to save service bill.');
                  }
                }}
                className="btn btn-secondary flex-1 py-2.5 font-bold border-emerald-250 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 flex items-center justify-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                Save Bill
              </button>

              <button
                onClick={async () => {
                  try {
                    const additionalsTotal = billingModal.additionalCharges.reduce((sum, c) => sum + c.amount, 0);
                    const finalCost = billingModal.service.estimatedCost + additionalsTotal;
                    
                    // Compile logs in standard parseable format
                    const additionalLogs = billingModal.additionalCharges
                      .map(c => `- Additional: ${c.name} (₹${c.amount.toFixed(2)})`)
                      .join('\n');
                    
                    const newDesc = billingModal.service.description
                      ? `${billingModal.service.description}\n${additionalLogs}`
                      : additionalLogs;

                    // Update database
                    await updateService(billingModal.service.id, {
                      description: newDesc,
                      estimatedCost: finalCost,
                      status: 'completed'
                    });

                    // Construct cloned object for print parser
                    const updatedServiceForPrint = {
                      ...billingModal.service,
                      description: newDesc,
                      estimatedCost: finalCost,
                      status: 'completed' as const
                    };

                    // Trigger Print Receipt
                    printEstimatedBill(
                      updatedServiceForPrint,
                      billingModal.customerName,
                      billingModal.customerPhone
                    );

                    // Close Modal
                    setBillingModal(null);
                  } catch (err) {
                    console.error(err);
                    alert('Failed to checkout service bill.');
                  }
                }}
                className="btn btn-primary flex-1 py-2.5 font-bold shadow-lg shadow-primary-500/25 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Complete & Print Bill
              </button>

              <button
                onClick={() => setBillingModal(null)}
                className="btn btn-secondary w-full sm:w-auto px-5 py-2.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
