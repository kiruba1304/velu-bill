import React, { useState, useEffect } from 'react';
import { 
  Bike as BikeIcon, 
  Plus, 
  Search, 
  Trash2, 
  User, 
  Calendar, 
  CheckCircle2, 
  Save, 
  PlusCircle, 
  BadgeAlert,
  Sparkles,
  Info,
  PhoneCall,
  ChevronDown,
  ChevronRight,
  Pencil,
  Printer,
  Download,
  X,
  MessageSquare
} from 'lucide-react';
import { 
  useBikes, 
  useBikeServiceReminders, 
  useCustomers,
  useBills
} from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { getStoreSettings } from '../utils/getStoreSettings';
import { BikeServiceReminder, Bill, IvrLogEntry, WaLogEntry } from '../types';
import {
  generateQRData,
  generateThermalCompactReceipt,
  generateThermalStandardReceipt,
  generateThermalDetailedReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt
} from '../utils/templateGenerator';
import { jsPDF } from 'jspdf';
import { executeIvrCall } from '../utils/triggerIvrCall';
import { generateServiceWhatsAppMessage, generateVisitCompletedWhatsAppMessage, generateOverdueWhatsAppMessage } from '../utils/generateServiceWhatsAppMessage';
import { generateWhatsAppMessage } from '../utils/generateWhatsAppMessage';

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const SaleBike: React.FC = () => {
  const { bikes, addBike, updateBike, deleteBike, loading: bikesLoading } = useBikes();
  const { reminders, addReminder, updateReminder, deleteReminder, loading: remindersLoading } = useBikeServiceReminders();
  const { customers, updateCustomer } = useCustomers();
  const { addBill } = useBills();
  const { activeBranchId, branches } = useAuth();

  const [activeTab, setActiveTab] = useState<'catalog' | 'sales' | 'reminders'>('catalog');

  // IVR History Modal State
  const [selectedIvrReminder, setSelectedIvrReminder] = useState<BikeServiceReminder | null>(null);
  const [isCallingIvr, setIsCallingIvr] = useState(false);

  // WhatsApp History Modal State
  const [selectedWaReminder, setSelectedWaReminder] = useState<BikeServiceReminder | null>(null);

  useEffect(() => {
    if (selectedIvrReminder) {
      const fresh = reminders.find(r => r.id === selectedIvrReminder.id);
      if (fresh) setSelectedIvrReminder(fresh);
    }
    if (selectedWaReminder) {
      const fresh = reminders.find(r => r.id === selectedWaReminder.id);
      if (fresh) setSelectedWaReminder(fresh);
    }
  }, [reminders]);

  // Catalog tab states
  const [showAddBikeModal, setShowAddBikeModal] = useState(false);
  const [bikeSearch, setBikeSearch] = useState('');
  const [bikeUnits, setBikeUnits] = useState<Array<{ chassisNumber: string; engineNumber: string }>>([
    { chassisNumber: '', engineNumber: '' }
  ]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleExpandGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [newBike, setNewBike] = useState({
    brand: '',
    modelName: '',
    chassisNumber: '',
    engineNumber: '',
    color: '',
    costPrice: '',
    sellingPrice: '',
    discountPrice: '',
    discountPercentage: '',
    gstPercentage: '',
    showGstInBill: true,
    price: '', // calculated finalPrice
    stockDate: new Date().toISOString().split('T')[0],
    batchName: ''
  });

  const calculateFinalPrice = (
    sellPriceStr: string,
    discPriceStr: string,
    _discPctStr: string,
    gstPctStr: string,
    showGst: boolean
  ) => {
    const sellPrice = parseFloat(sellPriceStr) || 0;
    const discPrice = parseFloat(discPriceStr) || 0;
    const gstPct = parseFloat(gstPctStr) || 0;

    const basePrice = Math.max(0, sellPrice - discPrice);
    const gstAmount = showGst ? (basePrice * (gstPct / 100)) : 0;
    return basePrice + gstAmount;
  };

  const handleSellingPriceChange = (val: string) => {
    const sellPrice = parseFloat(val) || 0;
    const discPrice = parseFloat(newBike.discountPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(val, newBike.discountPrice, discPct, newBike.gstPercentage, newBike.showGstInBill);

    setNewBike(prev => ({
      ...prev,
      sellingPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleDiscountPriceChange = (val: string) => {
    const discPrice = parseFloat(val) || 0;
    const sellPrice = parseFloat(newBike.sellingPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(newBike.sellingPrice, val, discPct, newBike.gstPercentage, newBike.showGstInBill);

    setNewBike(prev => ({
      ...prev,
      discountPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleDiscountPercentageChange = (val: string) => {
    const discPct = parseFloat(val) || 0;
    const sellPrice = parseFloat(newBike.sellingPrice) || 0;
    const discPrice = sellPrice > 0 ? ((discPct / 100) * sellPrice).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(newBike.sellingPrice, discPrice, val, newBike.gstPercentage, newBike.showGstInBill);

    setNewBike(prev => ({
      ...prev,
      discountPercentage: val,
      discountPrice: discPrice,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleGstPercentageChange = (val: string) => {
    const finalPrice = calculateFinalPrice(newBike.sellingPrice, newBike.discountPrice, newBike.discountPercentage, val, newBike.showGstInBill);

    setNewBike(prev => ({
      ...prev,
      gstPercentage: val,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleShowGstInBillToggle = (val: boolean) => {
    const finalPrice = calculateFinalPrice(newBike.sellingPrice, newBike.discountPrice, newBike.discountPercentage, newBike.gstPercentage, val);

    setNewBike(prev => ({
      ...prev,
      showGstInBill: val,
      price: finalPrice.toFixed(2)
    }));
  };

  // Sales checkout states
  const [selectedModelKey, setSelectedModelKey] = useState<string>('');
  const [selectedBikeId, setSelectedBikeId] = useState<number | ''>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'credit' | 'other'>('cash');
  
  // Custom Maintenance intervals
  const [serviceIntervals, setServiceIntervals] = useState<Array<{ serviceNo: number; days: number }>>([
    { serviceNo: 1, days: 15 },
    { serviceNo: 2, days: 30 },
    { serviceNo: 3, days: 30 }
  ]);

  // Reminders tab states
  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderStatusFilter, setReminderStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [loggingVisit, setLoggingVisit] = useState<BikeServiceReminder | null>(null);
  const [actualVisitDate, setActualVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [expandedReminderGroups, setExpandedReminderGroups] = useState<Record<number, boolean>>({});

  const toggleExpandReminderGroup = (bikeId: number) => {
    setExpandedReminderGroups(prev => ({
      ...prev,
      [bikeId]: !prev[bikeId]
    }));
  };

  const [editingReminder, setEditingReminder] = useState<BikeServiceReminder | null>(null);
  const [editFormData, setEditFormData] = useState({
    scheduledDays: 0,
    scheduledDate: '',
    reminderDate: '',
    status: 'pending' as 'pending' | 'overdue' | 'completed',
    actualVisitDate: '',
    notes: ''
  });

  const [editingBike, setEditingBike] = useState<any | null>(null);
  const [editBikeFormData, setEditBikeFormData] = useState({
    brand: '',
    modelName: '',
    color: '',
    costPrice: '',
    sellingPrice: '',
    discountPrice: '',
    discountPercentage: '',
    gstPercentage: '',
    showGstInBill: true,
    price: '',
    chassisNumber: '',
    engineNumber: '',
    stockDate: '',
    batchName: ''
  });

  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editGroupFormData, setEditGroupFormData] = useState({
    brand: '',
    modelName: '',
    color: '',
    costPrice: '',
    sellingPrice: '',
    discountPrice: '',
    discountPercentage: '',
    gstPercentage: '',
    showGstInBill: true,
    price: '',
    stockDate: '',
    batchName: ''
  });
  const [newGroupUnits, setNewGroupUnits] = useState<Array<{ chassisNumber: string; engineNumber: string }>>([]);

  // Handle Add Bike Submit
  const handleAddBikeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBike.brand.trim() || !newBike.modelName.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    const invalidUnit = bikeUnits.find(u => !u.chassisNumber.trim() || !u.engineNumber.trim());
    if (invalidUnit) {
      alert('Please enter a chassis and engine number for all showroom units.');
      return;
    }

    try {
      let addedCount = 0;
      for (const unit of bikeUnits) {
        await addBike({
          brand: newBike.brand.trim(),
          modelName: newBike.modelName.trim(),
          chassisNumber: unit.chassisNumber.trim().toUpperCase(),
          engineNumber: unit.engineNumber.trim().toUpperCase(),
          color: newBike.color.trim() || 'N/A',
          price: parseFloat(newBike.price) || 0.00,
          costPrice: parseFloat(newBike.costPrice) || 0.00,
          sellingPrice: parseFloat(newBike.sellingPrice) || 0.00,
          discountPrice: parseFloat(newBike.discountPrice) || 0.00,
          discountPercentage: parseFloat(newBike.discountPercentage) || 0.00,
          gstPercentage: parseFloat(newBike.gstPercentage) || 0.00,
          showGstInBill: newBike.showGstInBill,
          finalPrice: parseFloat(newBike.price) || 0.00,
          status: 'available',
          soldToCustomerId: null,
          saleDate: null,
          stockDate: newBike.stockDate || new Date().toISOString().split('T')[0],
          batchName: newBike.batchName.trim() || 'N/A'
        });
        addedCount++;
      }

      setNewBike({
        brand: '',
        modelName: '',
        chassisNumber: '',
        engineNumber: '',
        color: '',
        costPrice: '',
        sellingPrice: '',
        discountPrice: '',
        discountPercentage: '',
        gstPercentage: '',
        showGstInBill: true,
        price: '',
        stockDate: new Date().toISOString().split('T')[0],
        batchName: ''
      });
      setBikeUnits([{ chassisNumber: '', engineNumber: '' }]);
      setShowAddBikeModal(false);
      alert(`Successfully registered ${addedCount} showroom bike(s) to catalog!`);
    } catch (err) {
      console.error(err);
      alert('Failed to add some or all bikes. Ensure chassis/engine numbers are unique and not already registered.');
    }
  };

  // Pre-fill sale price when bike is selected
  const handleBikeSelect = (bikeId: number) => {
    setSelectedBikeId(bikeId);
    const bike = bikes.find(b => b.id === bikeId);
    if (bike) {
      setSalePrice(String(bike.price));
    }
  };

  // Add dynamic service schedule row
  const handleAddServiceRow = () => {
    const nextNo = serviceIntervals.length + 1;
    setServiceIntervals(prev => [...prev, { serviceNo: nextNo, days: 30 }]);
  };

  // Remove dynamic service schedule row
  const handleRemoveServiceRow = (index: number) => {
    if (serviceIntervals.length <= 1) return;
    const filtered = serviceIntervals.filter((_, i) => i !== index);
    // Reindex
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      serviceNo: idx + 1
    }));
    setServiceIntervals(reindexed);
  };

  // Update dynamic service interval days
  const handleUpdateIntervalDays = (index: number, days: number) => {
    const updated = [...serviceIntervals];
    updated[index].days = Math.max(1, days);
    setServiceIntervals(updated);
  };

  // Complete Sales Checkout
  const handleCompleteSale = async () => {
    if (!selectedBikeId || !selectedCustomerId || !salePrice.trim()) {
      alert('Please select a bike, customer, and set a sale price.');
      return;
    }

    const bike = bikes.find(b => b.id === selectedBikeId);
    if (!bike) return;

    try {
      // 1. Update Bike status to Sold in DB
      await updateBike(bike.id, {
        status: 'sold',
        soldToCustomerId: Number(selectedCustomerId),
        saleDate: saleDate,
        price: parseFloat(salePrice)
      });

      // 1.5. Generate a formal Bill Invoice in the database
      const billNumber = generateBillNumber();
      const customer = customers.find(c => c.id === Number(selectedCustomerId));
      // Construct exact ISO timestamp including the user selected sale date
      const currentTimePart = new Date().toISOString().split('T')[1];
      const nowIso = new Date(`${saleDate}T${currentTimePart}`).toISOString();

      // Calculate proportional pricing
      const finalAmount = parseFloat(salePrice) || bike.finalPrice || 0;
      const ratio = bike.finalPrice > 0 ? (finalAmount / bike.finalPrice) : 1;

      const adjustedSellingPrice = (bike.sellingPrice || 0) * ratio;
      const adjustedDiscountPrice = (bike.discountPrice || 0) * ratio;
      const adjustedBasePrice = adjustedSellingPrice - adjustedDiscountPrice;
      const adjustedGstAmount = bike.showGstInBill ? (adjustedBasePrice * ((bike.gstPercentage || 0) / 100)) : 0;

      const dummyBikeProduct = {
        id: -888, // dummy ID indicating showroom bike sale product
        name: `${bike.brand} ${bike.modelName}`,
        company: `Chassis: ${bike.chassisNumber} | Engine: ${bike.engineNumber}`,
        count: 1,
        costPrice: bike.costPrice || 0,
        sellingPrice: adjustedSellingPrice,
        discount: bike.discountPercentage || 0,
        gst: bike.gstPercentage || 0,
        barcode: `BIKE_${bike.chassisNumber}`,
        finalPrice: finalAmount,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const billItem = {
        id: Date.now(),
        billId: 0,
        productId: -888,
        quantity: 1,
        unitPrice: adjustedSellingPrice,
        discount: bike.discountPercentage || 0,
        gst: bike.showGstInBill ? (bike.gstPercentage || 0) : 0,
        totalPrice: adjustedSellingPrice, // subtotal before discount/GST
        product: dummyBikeProduct
      };

      const tempBill: Bill = {
        id: 0,
        customerId: Number(selectedCustomerId),
        billNumber,
        totalAmount: adjustedSellingPrice,
        totalDiscount: adjustedDiscountPrice,
        totalGst: adjustedGstAmount,
        finalAmount,
        paymentMethod,
        status: 'completed',
        createdAt: nowIso,
        updatedAt: nowIso,
        customer: customer || undefined,
        items: [billItem],
        isGstBill: bike.showGstInBill,
      };

      await addBill(tempBill);

      // Update customer credit balance if payment method is credit
      if (paymentMethod === 'credit' && customer) {
        const newCreditBalance = (customer.creditBalance || 0) + finalAmount;
        const transactionHistory = [...(customer.creditHistory || [])];
        
        await updateCustomer(customer.id, {
          creditBalance: newCreditBalance,
          creditHistory: transactionHistory
        });
      }

      // 2. Generate and write the entire service schedules to BikeServiceReminders
      let runningDate = saleDate;
      for (const interval of serviceIntervals) {
        // Compute targets
        const targetDue = addDays(runningDate, interval.days);
        const targetReminder = addDays(targetDue, -1);
        
        await addReminder({
          bikeId: bike.id,
          customerId: Number(selectedCustomerId),
          serviceNo: interval.serviceNo,
          scheduledDays: interval.days,
          scheduledDate: targetDue,
          reminderDate: targetReminder,
          actualVisitDate: null,
          status: 'pending',
          notes: ''
        });

        // Set runningDate to targetDue for cascaded placeholder calculations
        runningDate = targetDue;
      }

      // Print the Bill Receipt
      const pdfSavingPromise = printReceipt(tempBill);

      // Trigger background WhatsApp Web Auto-Send if customer phone is present
      const customerPhone = customer?.phone;
      if (customerPhone) {
        const api = (window as any).electronAPI;
        if (api?.sendWhatsAppAuto) {
          const { text, customerName } = generateWhatsAppMessage(tempBill, branches, activeBranchId, []);
          Promise.resolve(pdfSavingPromise).then(() => {
            setTimeout(() => {
              api.sendWhatsAppAuto(customerPhone, text, tempBill.billNumber, customerName)
                .then(() => console.log('WhatsApp bike sale invoice auto-sent successfully with PDF!'))
                .catch((err: any) => console.log('WhatsApp auto-send info:', err?.message || String(err)));
            }, 300);
          });
        }
      }

      // Reset Form States
      setSelectedBikeId('');
      setSelectedCustomerId('');
      setCustomerSearchQuery('');
      setSalePrice('');
      setPaymentMethod('cash');
      alert('Bike sale logged, invoice bill generated and service schedule created successfully!');
      setActiveTab('reminders');
    } catch (err) {
      console.error(err);
      alert('Failed to complete sale transaction.');
    }
  };

  // Submit visit check-in log
  const handleLogVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingVisit) return;

    try {
      // 1. Complete the current service iteration
      await updateReminder(loggingVisit.id, {
        status: 'completed',
        actualVisitDate: actualVisitDate,
        notes: visitNotes.trim()
      });

      // 2. Find and recalculate dates for the NEXT service (serviceNo = current + 1)
      const nextReminder = reminders.find(r => 
        r.bikeId === loggingVisit.bikeId && 
        r.serviceNo === loggingVisit.serviceNo + 1
      );

      if (nextReminder) {
        const nextDue = addDays(actualVisitDate, nextReminder.scheduledDays);
        const nextReminderDate = addDays(nextDue, -1);
        
        await updateReminder(nextReminder.id, {
          scheduledDate: nextDue,
          reminderDate: nextReminderDate,
          status: 'pending' // activate next service
        });
      }

      // 3. Automated WhatsApp Confirmation on Visit Completion
      const cust = customers.find(c => c.id === loggingVisit.customerId);
      const bike = bikes.find(b => b.id === loggingVisit.bikeId);
      const storeSettings = getStoreSettings();
      const storeName = storeSettings.storeName || 'SAM Motors';

      if (cust && cust.phone) {
        const messageText = generateVisitCompletedWhatsAppMessage(
          loggingVisit,
          nextReminder,
          cust,
          bike,
          actualVisitDate,
          storeSettings.storeName,
          storeSettings.address,
          storeSettings.phone
        );

        const nowIso = new Date().toISOString();
        const existingLogs: WaLogEntry[] = Array.isArray(loggingVisit.waLogs)
          ? loggingVisit.waLogs
          : (typeof loggingVisit.waLogs === 'string' && loggingVisit.waLogs ? JSON.parse(loggingVisit.waLogs) : []);

        const newLog: WaLogEntry = {
          timestamp: nowIso,
          type: 'auto',
          status: 'success',
          message: 'Visit completion WhatsApp sent'
        };

        const api = (window as any).electronAPI;
        let isSent = false;
        if (api && api.sendWhatsAppAuto) {
          try {
            await api.sendWhatsAppAuto(cust.phone, messageText, null, cust.name);
            isSent = true;
          } catch (waErr) {
            console.warn('Auto WhatsApp for Log Visit failed:', waErr);
          }
        }

        if (!isSent) {
          const cleanPhone = String(cust.phone).replace(/\D/g, '');
          const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
          const waUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(messageText)}`;
          window.open(waUrl, '_blank');
          isSent = true;
        }

        if (isSent) {
          await updateReminder(loggingVisit.id, {
            waSentCount: (loggingVisit.waSentCount || 0) + 1,
            lastWaSentDate: nowIso,
            waLogs: JSON.stringify([newLog, ...existingLogs])
          });
        }
      }

      setLoggingVisit(null);
      setVisitNotes('');
      alert('Service visit logged, WhatsApp confirmation sent, and next maintenance cycle updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to update service record.');
    }
  };

  const handleEditReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isNowOverdue = editFormData.status === 'overdue' || (editFormData.status === 'pending' && todayStr > editFormData.scheduledDate);

      await updateReminder(editingReminder.id, {
        scheduledDays: editFormData.scheduledDays,
        scheduledDate: editFormData.scheduledDate,
        reminderDate: editFormData.reminderDate,
        status: editFormData.status,
        actualVisitDate: editFormData.status === 'completed' ? editFormData.actualVisitDate : null,
        notes: editFormData.status === 'completed' ? editFormData.notes.trim() : ''
      });

      if (isNowOverdue) {
        const updatedRecord = {
          ...editingReminder,
          status: editFormData.status,
          scheduledDate: editFormData.scheduledDate
        };
        await handleSendWhatsAppAlert(updatedRecord as any, 'manual');
      }

      setEditingReminder(null);
      alert('Service reminder updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update service reminder.');
    }
  };

  const handlePrintReminder = (reminder: BikeServiceReminder) => {
    const cust = customers.find(c => c.id === reminder.customerId);
    const bike = bikes.find(b => b.id === reminder.bikeId);

    const customerName = cust?.name || 'Unknown';
    const customerPhone = cust?.phone || 'N/A';
    const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : 'Unknown';
    const chassisNumber = bike?.chassisNumber || 'N/A';
    const engineNumber = bike?.engineNumber || 'N/A';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print the visit log.');
      return;
    }

    const htmlContent = `
      <html>
      <head>
        <title>Service Receipt - Service #${reminder.serviceNo}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 5px 0; letter-spacing: 0.05em; }
          .header p { font-size: 11px; color: #64748b; margin: 0; text-transform: uppercase; }
          .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin: 20px 0 10px 0; }
          .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
          .grid-item { font-size: 11px; }
          .label { font-weight: 600; color: #64748b; display: inline-block; width: 120px; }
          .value { font-weight: 700; color: #0f172a; }
          .notes-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 11px; min-height: 60px; margin-top: 5px; white-space: pre-wrap; }
          .footer { margin-top: 60px; display: grid; grid-template-cols: 1fr 1fr; gap: 50px; text-align: center; font-size: 10px; color: #64748b; }
          .signature-line { border-top: 1px dashed #cbd5e1; margin-top: 40px; padding-top: 8px; font-weight: 600; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MAINTENANCE SERVICE VISIT LOG</h1>
          <p>Official Bike Service Completion Record</p>
        </div>
        
        <div class="section-title">Customer Information</div>
        <div class="grid">
          <div class="grid-item"><span class="label">Customer Name:</span><span class="value">${customerName}</span></div>
          <div class="grid-item"><span class="label">Phone Number:</span><span class="value">${customerPhone}</span></div>
        </div>

        <div class="section-title">Vehicle Specifications</div>
        <div class="grid">
          <div class="grid-item"><span class="label">Model / Color:</span><span class="value">${bikeModel} (${bike?.color || 'N/A'})</span></div>
          <div class="grid-item"><span class="label">Chassis No:</span><span class="value">${chassisNumber}</span></div>
          <div class="grid-item"><span class="label">Engine No:</span><span class="value">${engineNumber}</span></div>
        </div>

        <div class="section-title">Service Details</div>
        <div class="grid">
          <div class="grid-item"><span class="label">Service Iteration:</span><span class="value">Service #${reminder.serviceNo}</span></div>
          <div class="grid-item"><span class="label">Scheduled Target:</span><span class="value">${reminder.scheduledDays} Days</span></div>
          <div class="grid-item"><span class="label">Scheduled Date:</span><span class="value">${reminder.scheduledDate}</span></div>
          <div class="grid-item"><span class="label">Actual Visit Date:</span><span class="value">${reminder.actualVisitDate || 'N/A'}</span></div>
          <div class="grid-item"><span class="label">Status:</span><span class="value" style="color: #10b981;">COMPLETED</span></div>
        </div>

        <div class="section-title">Technician Findings & Notes</div>
        <div class="notes-box">${reminder.notes || 'No notes logged for this service visit.'}</div>

        <div class="footer">
          <div>
            <div class="signature-line">Customer Signature</div>
          </div>
          <div>
            <div class="signature-line">Authorized Technician Signature</div>
          </div>
        </div>
        <script>
          window.print();
          setTimeout(() => { window.close(); }, 500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDownloadReminder = (reminder: BikeServiceReminder) => {
    const cust = customers.find(c => c.id === reminder.customerId);
    const bike = bikes.find(b => b.id === reminder.bikeId);

    const customerName = cust?.name || 'Unknown';
    const customerPhone = cust?.phone || 'N/A';
    const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : 'Unknown';
    const chassisNumber = bike?.chassisNumber || 'N/A';
    const engineNumber = bike?.engineNumber || 'N/A';

    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BIKE MAINTENANCE SERVICE VISIT LOG", 105, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Official Bike Service Completion Record", 105, y, { align: "center" });
    y += 10;

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 10;

    // Reset color
    doc.setTextColor(30, 41, 59);

    // Helper to print key value pair
    const addKeyValue = (label: string, value: string, nextY: number, labelX = 15, valueX = 55) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(label, labelX, nextY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(value, valueX, nextY);
    };

    // Section title helper
    const addSectionTitle = (title: string, currentY: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(title.toUpperCase(), 15, currentY);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 2, 195, currentY + 2);
      return currentY + 10;
    };

    // Customer Information Section
    y = addSectionTitle("Customer Information", y);
    addKeyValue("Customer Name:", customerName, y);
    addKeyValue("Phone Number:", customerPhone, y, 110, 145);
    y += 12;

    // Vehicle Specifications Section
    y = addSectionTitle("Vehicle Specifications", y);
    addKeyValue("Model / Color:", `${bikeModel} (${bike?.color || 'N/A'})`, y);
    y += 8;
    addKeyValue("Chassis No:", chassisNumber, y);
    addKeyValue("Engine No:", engineNumber, y, 110, 140);
    y += 12;

    // Service Details Section
    y = addSectionTitle("Service Details", y);
    addKeyValue("Service Iteration:", `Service #${reminder.serviceNo}`, y);
    addKeyValue("Target Days:", `${reminder.scheduledDays} Days`, y, 110, 140);
    y += 8;
    addKeyValue("Scheduled Date:", reminder.scheduledDate, y);
    addKeyValue("Actual Visit Date:", reminder.actualVisitDate || 'N/A', y, 110, 145);
    y += 8;
    addKeyValue("Status:", "COMPLETED", y);
    y += 12;

    // Technician Findings & Notes Section
    y = addSectionTitle("Technician Findings & Notes", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    
    const notesText = reminder.notes || 'No notes logged for this service visit.';
    const splitNotes = doc.splitTextToSize(notesText, 175);
    doc.text(splitNotes, 15, y);
    
    y += (splitNotes.length * 5) + 15;

    // Signatures Section
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);

    // Customer Signature Line
    doc.line(15, y + 15, 85, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("CUSTOMER SIGNATURE", 50, y + 21, { align: "center" });

    // Technician Signature Line
    doc.line(125, y + 15, 195, y + 15);
    doc.text("AUTHORIZED TECHNICIAN", 160, y + 21, { align: "center" });

    // Save Document
    doc.save(`service_visit_log_${reminder.id}_service_${reminder.serviceNo}.pdf`);
  };

  const generateBillNumber = () => {
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const branch = activeBranchId || 1;
    const key = `sb_bill_counter_branch_${branch}_${yyyymmdd}`;
    let counter = parseInt(localStorage.getItem(key) || '0', 10);
    counter += 1;
    localStorage.setItem(key, String(counter));
    const seq = String(counter).padStart(2, '0');
    return `SB${branch}-${yyyymmdd}-${seq}`;
  };

  const printReceipt = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const settings = getStoreSettings(bill.branchId, branches, activeBranchId);

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
    let pdfPromise = Promise.resolve(true);
    if (api?.saveBillPdf) {
      pdfPromise = api.saveBillPdf(bill.billNumber, receiptHTML, bill.customer?.name)
        .catch((err: any) => {
          console.error("Failed to auto-save PDF bill:", err);
          return false;
        });
    }

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
      return pdfPromise;
    }

    (printWindow as any).document.write(receiptHTML);
    (printWindow as any).document.close();
    return pdfPromise;
  };

  const handleEditBikeSellingPriceChange = (val: string) => {
    const sellPrice = parseFloat(val) || 0;
    const discPrice = parseFloat(editBikeFormData.discountPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(val, editBikeFormData.discountPrice, discPct, editBikeFormData.gstPercentage, editBikeFormData.showGstInBill);

    setEditBikeFormData(prev => ({
      ...prev,
      sellingPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditBikeDiscountPriceChange = (val: string) => {
    const discPrice = parseFloat(val) || 0;
    const sellPrice = parseFloat(editBikeFormData.sellingPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(editBikeFormData.sellingPrice, val, discPct, editBikeFormData.gstPercentage, editBikeFormData.showGstInBill);

    setEditBikeFormData(prev => ({
      ...prev,
      discountPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditBikeDiscountPercentageChange = (val: string) => {
    const discPct = parseFloat(val) || 0;
    const sellPrice = parseFloat(editBikeFormData.sellingPrice) || 0;
    const discPrice = sellPrice > 0 ? ((discPct / 100) * sellPrice).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(editBikeFormData.sellingPrice, discPrice, val, editBikeFormData.gstPercentage, editBikeFormData.showGstInBill);

    setEditBikeFormData(prev => ({
      ...prev,
      discountPercentage: val,
      discountPrice: discPrice,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditBikeGstPercentageChange = (val: string) => {
    const finalPrice = calculateFinalPrice(editBikeFormData.sellingPrice, editBikeFormData.discountPrice, editBikeFormData.discountPercentage, val, editBikeFormData.showGstInBill);

    setEditBikeFormData(prev => ({
      ...prev,
      gstPercentage: val,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditBikeShowGstInBillToggle = (val: boolean) => {
    const finalPrice = calculateFinalPrice(editBikeFormData.sellingPrice, editBikeFormData.discountPrice, editBikeFormData.discountPercentage, editBikeFormData.gstPercentage, val);

    setEditBikeFormData(prev => ({
      ...prev,
      showGstInBill: val,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditBikeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBike) return;

    try {
      await updateBike(editingBike.id, {
        brand: editBikeFormData.brand.trim(),
        modelName: editBikeFormData.modelName.trim(),
        color: editBikeFormData.color.trim() || 'N/A',
        costPrice: parseFloat(editBikeFormData.costPrice) || 0,
        sellingPrice: parseFloat(editBikeFormData.sellingPrice) || 0,
        discountPrice: parseFloat(editBikeFormData.discountPrice) || 0,
        discountPercentage: parseFloat(editBikeFormData.discountPercentage) || 0,
        gstPercentage: parseFloat(editBikeFormData.gstPercentage) || 0,
        showGstInBill: editBikeFormData.showGstInBill,
        price: parseFloat(editBikeFormData.price) || 0,
        finalPrice: parseFloat(editBikeFormData.price) || 0,
        chassisNumber: editBikeFormData.chassisNumber.trim().toUpperCase(),
        engineNumber: editBikeFormData.engineNumber.trim().toUpperCase()
      });

      setEditingBike(null);
      alert('Showroom bike updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update showroom bike. Ensure chassis and engine numbers are unique.');
    }
  };

  const handleEditGroupSellingPriceChange = (val: string) => {
    const sellPrice = parseFloat(val) || 0;
    const discPrice = parseFloat(editGroupFormData.discountPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(val, editGroupFormData.discountPrice, discPct, editGroupFormData.gstPercentage, editGroupFormData.showGstInBill);

    setEditGroupFormData(prev => ({
      ...prev,
      sellingPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditGroupDiscountPriceChange = (val: string) => {
    const discPrice = parseFloat(val) || 0;
    const sellPrice = parseFloat(editGroupFormData.sellingPrice) || 0;
    const discPct = sellPrice > 0 ? ((discPrice / sellPrice) * 100).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(editGroupFormData.sellingPrice, val, discPct, editGroupFormData.gstPercentage, editGroupFormData.showGstInBill);

    setEditGroupFormData(prev => ({
      ...prev,
      discountPrice: val,
      discountPercentage: discPct,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditGroupDiscountPercentageChange = (val: string) => {
    const discPct = parseFloat(val) || 0;
    const sellPrice = parseFloat(editGroupFormData.sellingPrice) || 0;
    const discPrice = sellPrice > 0 ? ((discPct / 100) * sellPrice).toFixed(2) : '0';
    const finalPrice = calculateFinalPrice(editGroupFormData.sellingPrice, discPrice, val, editGroupFormData.gstPercentage, editGroupFormData.showGstInBill);

    setEditGroupFormData(prev => ({
      ...prev,
      discountPercentage: val,
      discountPrice: discPrice,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditGroupGstPercentageChange = (val: string) => {
    const finalPrice = calculateFinalPrice(editGroupFormData.sellingPrice, editGroupFormData.discountPrice, editGroupFormData.discountPercentage, val, editGroupFormData.showGstInBill);

    setEditGroupFormData(prev => ({
      ...prev,
      gstPercentage: val,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditGroupShowGstInBillToggle = (val: boolean) => {
    const finalPrice = calculateFinalPrice(editGroupFormData.sellingPrice, editGroupFormData.discountPrice, editGroupFormData.discountPercentage, editGroupFormData.gstPercentage, val);

    setEditGroupFormData(prev => ({
      ...prev,
      showGstInBill: val,
      price: finalPrice.toFixed(2)
    }));
  };

  const handleEditGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    if (!editGroupFormData.brand.trim() || !editGroupFormData.modelName.trim()) {
      alert('Please fill in required fields.');
      return;
    }

    const invalidUnit = newGroupUnits.find(u => !u.chassisNumber.trim() || !u.engineNumber.trim());
    if (invalidUnit) {
      alert('Please enter a chassis and engine number for all restocked units.');
      return;
    }

    try {
      // 1. Update existing units in this group
      for (const unit of editingGroup.units) {
        await updateBike(unit.id, {
          brand: editGroupFormData.brand.trim(),
          modelName: editGroupFormData.modelName.trim(),
          color: editGroupFormData.color.trim() || 'N/A',
          costPrice: parseFloat(editGroupFormData.costPrice) || 0.00,
          sellingPrice: parseFloat(editGroupFormData.sellingPrice) || 0.00,
          discountPrice: parseFloat(editGroupFormData.discountPrice) || 0.00,
          discountPercentage: parseFloat(editGroupFormData.discountPercentage) || 0.00,
          gstPercentage: parseFloat(editGroupFormData.gstPercentage) || 0.00,
          showGstInBill: editGroupFormData.showGstInBill,
          price: parseFloat(editGroupFormData.price) || 0.00,
          finalPrice: parseFloat(editGroupFormData.price) || 0.00,
          stockDate: editGroupFormData.stockDate,
          batchName: editGroupFormData.batchName.trim()
        });
      }

      // 2. Add new restocked units
      for (const unit of newGroupUnits) {
        await addBike({
          brand: editGroupFormData.brand.trim(),
          modelName: editGroupFormData.modelName.trim(),
          chassisNumber: unit.chassisNumber.trim().toUpperCase(),
          engineNumber: unit.engineNumber.trim().toUpperCase(),
          color: editGroupFormData.color.trim() || 'N/A',
          price: parseFloat(editGroupFormData.price) || 0.00,
          costPrice: parseFloat(editGroupFormData.costPrice) || 0.00,
          sellingPrice: parseFloat(editGroupFormData.sellingPrice) || 0.00,
          discountPrice: parseFloat(editGroupFormData.discountPrice) || 0.00,
          discountPercentage: parseFloat(editGroupFormData.discountPercentage) || 0.00,
          gstPercentage: parseFloat(editGroupFormData.gstPercentage) || 0.00,
          showGstInBill: editGroupFormData.showGstInBill,
          finalPrice: parseFloat(editGroupFormData.price) || 0.00,
          status: 'available',
          soldToCustomerId: null,
          saleDate: null,
          stockDate: editGroupFormData.stockDate || new Date().toISOString().split('T')[0],
          batchName: editGroupFormData.batchName.trim() || 'N/A'
        });
      }

      setEditingGroup(null);
      setNewGroupUnits([]);
      alert('Showroom model updated and stock units restocked successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update showroom model. Ensure chassis/engine numbers are unique and not already registered.');
    }
  };



  const handleSendWhatsAppAlert = async (reminder: BikeServiceReminder, type: 'auto' | 'manual' = 'manual') => {
    const cust = customers.find(c => c.id === reminder.customerId);
    const bike = bikes.find(b => b.id === reminder.bikeId);
    const storeSettings = getStoreSettings();
    const storeName = storeSettings.storeName || 'SAM Motors';

    if (!cust || !cust.phone) {
      alert('Customer has no phone number registered.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = reminder.status === 'overdue' || (reminder.status === 'pending' && todayStr > reminder.scheduledDate);

    const messageText = isOverdue
      ? generateOverdueWhatsAppMessage(reminder, cust, bike, storeSettings.storeName, storeSettings.address, storeSettings.phone)
      : generateServiceWhatsAppMessage(reminder, cust, bike, storeSettings.storeName, storeSettings.address, storeSettings.phone);
    const nowIso = new Date().toISOString();
    const existingLogs = Array.isArray(reminder.waLogs)
      ? reminder.waLogs
      : (typeof reminder.waLogs === 'string' && reminder.waLogs ? JSON.parse(reminder.waLogs) : []);

    const api = (window as any).electronAPI;
    let isSent = false;

    if (api && api.sendWhatsAppAuto) {
      try {
        await api.sendWhatsAppAuto(cust.phone, messageText, null, cust.name);
        alert(`WhatsApp Service Alert sent successfully to ${cust.name}!`);
        isSent = true;
      } catch (err: any) {
        console.warn('Auto WhatsApp failed, falling back to Web WhatsApp:', err?.message || err);
      }
    }

    if (!isSent) {
      const cleanPhone = String(cust.phone).replace(/\D/g, '');
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const waUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, '_blank');
      isSent = true;
    }

    if (isSent) {
      const newLog = {
        timestamp: nowIso,
        type,
        status: 'success',
        message: 'WhatsApp alert sent'
      };
      await updateReminder(reminder.id, {
        waSentCount: (reminder.waSentCount || 0) + 1,
        lastWaSentDate: nowIso,
        waLogs: JSON.stringify([newLog, ...existingLogs])
      });
    }
  };

  // Helper to resolve customer name
  const getCustomerDetails = (id: number) => {
    const c = customers.find(item => item.id === id);
    return c ? `${c.name} (${c.phone})` : 'Unknown';
  };

  // Helper to resolve bike details
  const getBikeDetails = (id: number) => {
    const b = bikes.find(item => item.id === id);
    return b ? `${b.brand} ${b.modelName} [Chassis: ${b.chassisNumber}]` : 'Unknown';
  };

  const filteredBikes = bikes.filter(b => 
    b.brand.toLowerCase().includes(bikeSearch.toLowerCase()) ||
    b.modelName.toLowerCase().includes(bikeSearch.toLowerCase()) ||
    b.chassisNumber.toLowerCase().includes(bikeSearch.toLowerCase())
  );

  const groupedBikes = React.useMemo(() => {
    const groups: { [key: string]: typeof bikes } = {};
    filteredBikes.forEach(b => {
      const key = `${b.brand.toLowerCase()}_${b.modelName.toLowerCase()}_${(b.color || '').toLowerCase()}_${b.price}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(b);
    });
    return Object.entries(groups).map(([key, list]) => ({
      key,
      brand: list[0].brand,
      modelName: list[0].modelName,
      color: list[0].color,
      costPrice: list[0].costPrice,
      sellingPrice: list[0].sellingPrice,
      discountPrice: list[0].discountPrice,
      discountPercentage: list[0].discountPercentage,
      gstPercentage: list[0].gstPercentage,
      showGstInBill: list[0].showGstInBill,
      price: list[0].price,
      finalPrice: list[0].finalPrice,
      units: list
    }));
  }, [filteredBikes]);

  const availableBikeModels = React.useMemo(() => {
    const groups: { [key: string]: { brand: string; modelName: string; color: string; price: number; list: typeof bikes } } = {};
    bikes.filter(b => b.status === 'available').forEach(b => {
      const key = `${b.brand.toLowerCase()}_${b.modelName.toLowerCase()}_${(b.color || '').toLowerCase()}_${b.price}`;
      if (!groups[key]) {
        groups[key] = {
          brand: b.brand,
          modelName: b.modelName,
          color: b.color || 'N/A',
          price: b.price,
          list: []
        };
      }
      groups[key].list.push(b);
    });
    return Object.entries(groups).map(([key, info]) => ({
      key,
      ...info
    }));
  }, [bikes]);

  const availableUnitsForSelectedModel = React.useMemo(() => {
    if (!selectedModelKey) return [];
    const model = availableBikeModels.find(m => m.key === selectedModelKey);
    return model ? model.list : [];
  }, [selectedModelKey, availableBikeModels]);

  const filteredReminders = reminders.filter(r => {
    const cust = customers.find(c => c.id === r.customerId);
    const bike = bikes.find(b => b.id === r.bikeId);
    const textMatch = 
      (cust?.name || '').toLowerCase().includes(reminderSearch.toLowerCase()) ||
      (cust?.phone || '').toLowerCase().includes(reminderSearch.toLowerCase()) ||
      (bike?.chassisNumber || '').toLowerCase().includes(reminderSearch.toLowerCase()) ||
      (bike?.modelName || '').toLowerCase().includes(reminderSearch.toLowerCase());

    if (!textMatch) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = r.status === 'overdue' || (r.status === 'pending' && todayStr > r.scheduledDate);

    if (reminderStatusFilter === 'completed') return r.status === 'completed';
    if (reminderStatusFilter === 'overdue') return isOverdue;
    if (reminderStatusFilter === 'pending') return r.status === 'pending' && !isOverdue;

    return true;
  });

  const groupedReminders = React.useMemo(() => {
    const bikeIds = Array.from(new Set(filteredReminders.map(r => r.bikeId)));
    
    return bikeIds.map(bikeId => {
      const bikeReminders = reminders
        .filter(r => r.bikeId === bikeId)
        .sort((a, b) => a.serviceNo - b.serviceNo);
        
      const matched = bikeReminders.filter(r => filteredReminders.some(fr => fr.id === r.id));
      
      let displayReminder = matched.find(r => r.status === 'pending' || r.status === 'overdue');
      if (!displayReminder) {
        displayReminder = matched[matched.length - 1];
      }
      
      const otherReminders = bikeReminders.filter(r => r.id !== displayReminder?.id);
      
      return {
        bikeId,
        displayReminder,
        otherReminders,
        allReminders: bikeReminders
      };
    }).filter(group => group.displayReminder !== undefined);
  }, [filteredReminders, reminders]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-3xl border border-slate-200/60 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-200/30">
            <BikeIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-950">Bike Sales & Maintenance Control</h1>
            <p className="text-xs font-semibold text-slate-500">Manage showroom stock, log invoice checkouts and configure maintenance logs</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 self-start">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'catalog'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Showroom Catalog
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sales'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Sales Checkout
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'reminders'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Service Reminders
            {reminders.some(r => r.status === 'pending' && new Date().toISOString().split('T')[0] > r.scheduledDate) && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Showroom Catalog */}
      {activeTab === 'catalog' && (
        <div className="card bg-white border border-slate-200/60 shadow-soft p-5 space-y-4">
          <div className="flex justify-between items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={bikeSearch}
                onChange={(e) => setBikeSearch(e.target.value)}
                placeholder="Search brand, model, engine or chassis no..."
                className="input pl-10 w-full rounded-xl border-slate-200 text-xs"
              />
            </div>
            
            <button
              onClick={() => {
                setBikeUnits([{ chassisNumber: '', engineNumber: '' }]);
                setShowAddBikeModal(true);
              }}
              className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-500/25"
            >
              <Plus className="w-4 h-4" />
              Add Showroom Bike
            </button>
          </div>

          {/* Catalog grid list */}
          {bikesLoading ? (
            <p className="text-center text-slate-400 text-xs py-8">Loading showroom catalog...</p>
          ) : filteredBikes.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <BikeIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 font-extrabold text-sm">No Bikes Available</p>
              <p className="text-slate-500 text-xs mt-1">Please register available bikes inside showroom catalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedBikes.map(group => {
                const totalUnits = group.units.length;
                const availableUnits = group.units.filter(u => u.status === 'available').length;
                
                return (
                  <div key={group.key} className="p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-150 hover:border-slate-300 transition-all shadow-sm hover:shadow-soft flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{group.brand}</span>
                            <h4 className="font-black text-slate-900 text-sm mt-0.5">{group.modelName}</h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroup(group);
                              setEditGroupFormData({
                                brand: group.brand,
                                modelName: group.modelName,
                                color: group.color || '',
                                costPrice: String(group.costPrice),
                                sellingPrice: String(group.sellingPrice),
                                discountPrice: String(group.discountPrice),
                                discountPercentage: String(group.discountPercentage),
                                gstPercentage: String(group.gstPercentage),
                                showGstInBill: group.showGstInBill,
                                price: String(group.price),
                                stockDate: group.units[0]?.stockDate || new Date().toISOString().split('T')[0],
                                batchName: group.units[0]?.batchName || ''
                              });
                              setNewGroupUnits([{ chassisNumber: '', engineNumber: '' }]);
                            }}
                            className="p-1 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition-all"
                            title="Edit Showroom Model & Add Stock"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          availableUnits > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {availableUnits > 0 ? `${availableUnits} AVAILABLE` : 'SOLD OUT'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-[11px]">
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 mb-2">
                          <div>
                            <span className="text-[8px] font-bold text-slate-450 uppercase block">Batch</span>
                            <span className="font-extrabold text-slate-800">{group.units[0]?.batchName || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-slate-450 uppercase block">Stock Date</span>
                            <span className="font-extrabold text-slate-800">
                              {group.units[0]?.stockDate ? new Date(group.units[0].stockDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <span>Color:</span>
                          <span className="font-semibold text-slate-800">{group.color || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Cost Price:</span>
                          <span className="font-semibold text-slate-800">₹{(group.costPrice || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Selling Price:</span>
                          <span className="font-semibold text-slate-800">₹{(group.sellingPrice || 0).toFixed(2)}</span>
                        </div>
                        {(group.discountPrice || 0) > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Discount:</span>
                            <span className="font-bold text-emerald-600">-₹{(group.discountPrice || 0).toFixed(2)} ({(group.discountPercentage || 0).toFixed(1)}%)</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-600">
                          <span>GST Option:</span>
                          <span className="font-semibold text-slate-700">
                            {(group.gstPercentage || 0)}% {group.showGstInBill ? '(Show in Bill)' : '(Hide)'}
                          </span>
                        </div>
                        
                        {/* Units list container */}
                        <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpandGroup(group.key)}
                            className="w-full flex justify-between items-center bg-slate-100 hover:bg-slate-200 p-2 rounded-xl text-[10px] font-bold uppercase text-slate-600 transition-colors"
                          >
                            <span>Showroom Units ({totalUnits})</span>
                            <span className="text-primary-600">{expandedGroups[group.key] ? 'Hide Details' : 'Show Details'}</span>
                          </button>
                          
                          {expandedGroups[group.key] && (
                            <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1">
                              {group.units.map((unit, uIdx) => (
                                <div key={unit.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex flex-col gap-1 relative">
                                  <div className="flex justify-between font-mono text-[9px] text-slate-450 items-center">
                                    <span>Unit #{uIdx + 1}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${
                                        unit.status === 'available'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-250'
                                      }`}>
                                        {unit.status.toUpperCase()}
                                      </span>
                                      {unit.status === 'available' && (
                                        <div className="flex items-center gap-0.5 ml-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingBike(unit);
                                              setEditBikeFormData({
                                                brand: unit.brand,
                                                modelName: unit.modelName,
                                                color: unit.color || '',
                                                costPrice: String(unit.costPrice),
                                                sellingPrice: String(unit.sellingPrice),
                                                discountPrice: String(unit.discountPrice),
                                                discountPercentage: String(unit.discountPercentage),
                                                gstPercentage: String(unit.gstPercentage),
                                                showGstInBill: unit.showGstInBill,
                                                price: String(unit.price),
                                                chassisNumber: unit.chassisNumber,
                                                engineNumber: unit.engineNumber,
                                                stockDate: unit.stockDate || '',
                                                batchName: unit.batchName || ''
                                              });
                                            }}
                                            className="p-1 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded transition-colors"
                                            title="Edit Bike Unit"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm(`Remove Chassis ${unit.chassisNumber} from catalog?`)) {
                                                try {
                                                  await deleteBike(unit.id);
                                                } catch (err) {
                                                  alert('Failed to delete bike.');
                                                }
                                              }
                                            }}
                                            className="p-1 text-slate-500 hover:text-red-655 hover:bg-red-50 rounded transition-colors"
                                            title="Delete Bike Unit"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Chassis:</span>
                                    <span className="font-mono font-bold text-slate-800">{unit.chassisNumber}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Engine:</span>
                                    <span className="font-mono font-bold text-slate-800">{unit.engineNumber}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-bold text-slate-450 uppercase">Final Showroom Price</p>
                        <p className="font-black text-slate-900 text-base">₹{(group.finalPrice || group.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sales Checkout */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Sales Fields */}
          <div className="lg:col-span-7 card bg-white border border-slate-200/60 shadow-soft p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              Log Bike Sale Checkout
            </h3>

            <div className="space-y-3.5">
              {/* Select Customer */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Customer Account</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                      setSelectedCustomerId('');
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search existing customer by name or phone..."
                    className="input pl-9 w-full rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                {/* Customer Dropdown */}
                {showCustomerDropdown && customerSearchQuery.trim() !== '' && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-2xl max-h-48 overflow-y-auto p-1.5">
                    {customers
                      .filter(c => 
                        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                        c.phone.includes(customerSearchQuery)
                      )
                      .map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchQuery(`${c.name} (${c.phone})`);
                            setShowCustomerDropdown(false);
                          }}
                          className="p-2 hover:bg-slate-55 rounded-xl cursor-pointer text-xs font-bold text-slate-800 flex justify-between"
                        >
                          <span>{c.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{c.phone}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

          {/* Select Bike Model & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Select Bike Model & Color</label>
              <select
                value={selectedModelKey}
                onChange={(e) => {
                  setSelectedModelKey(e.target.value);
                  setSelectedBikeId('');
                  setSalePrice('');
                }}
                className="input w-full rounded-xl text-xs cursor-pointer font-bold text-slate-800"
              >
                <option value="">-- Choose Bike Model --</option>
                {availableBikeModels.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.brand} {m.modelName} ({m.color}) - ₹{m.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Select Chassis & Engine No</label>
              <select
                value={selectedBikeId}
                onChange={(e) => {
                  const bikeId = e.target.value ? Number(e.target.value) : '';
                  if (bikeId !== '') {
                    handleBikeSelect(bikeId);
                  } else {
                    setSelectedBikeId('');
                    setSalePrice('');
                  }
                }}
                disabled={!selectedModelKey}
                className="input w-full rounded-xl text-xs cursor-pointer disabled:opacity-50 font-bold text-slate-800"
              >
                <option value="">-- Select Chassis / Engine --</option>
                {availableUnitsForSelectedModel.map(b => (
                  <option key={b.id} value={b.id}>
                    Chassis: {b.chassisNumber} | Engine: {b.engineNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
                    {/* Billing Price, Sale Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Finalized Price (₹)</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="Enter sale price"
                className="input w-full rounded-xl text-xs font-bold text-primary-700"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Sale Date</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="input w-full rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="input w-full rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="credit">Credit / Pending</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleCompleteSale}
          disabled={!selectedBikeId || !selectedCustomerId}
          className="btn btn-primary w-full py-2.5 rounded-xl font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 text-xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          Complete Bike Sale & Schedule Maintenance
        </button>
      </div>

      {/* Service Intervals Planner */}
          <div className="lg:col-span-5 card bg-white border border-slate-200/60 shadow-soft p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-500" />
                    Configure Service Timeline
                  </h3>
                  <p className="text-[10px] text-slate-455 font-semibold mt-0.5">Define cascading maintenance intervals</p>
                </div>
                <button
                  onClick={handleAddServiceRow}
                  className="text-primary-600 hover:text-primary-850 p-1 flex items-center gap-1 text-[10px] font-bold"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Service
                </button>
              </div>

              {/* Interval list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {serviceIntervals.map((interval, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-155 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 bg-white border border-slate-250 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                        {interval.serviceNo}
                      </span>
                      <span className="font-bold text-slate-700">Service {interval.serviceNo}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={interval.days}
                        onChange={(e) => handleUpdateIntervalDays(idx, parseInt(e.target.value) || 1)}
                        className="w-16 text-center input py-1 px-1 text-xs font-extrabold rounded-lg"
                      />
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Days</span>

                      {serviceIntervals.length > 1 && (
                        <button
                          onClick={() => handleRemoveServiceRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 space-y-1.5 mt-4">
              <p className="flex items-center gap-1 font-bold text-slate-650">
                <Info className="w-3.5 h-3.5 text-primary-500" />
                Service Calculations Rule:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>**Service 1** triggers **{serviceIntervals[0]?.days || 15} days** after sale (reminder alert on day **{(serviceIntervals[0]?.days || 15) - 1}**).</li>
                <li>**Service 2** triggers **{serviceIntervals[1]?.days || 30} days** after **Service 1 actual visit** date.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Service Reminders */}
      {activeTab === 'reminders' && (
        <div className="card bg-white border border-slate-200/60 shadow-soft p-5 space-y-4">
          {/* Controls row */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={reminderSearch}
                onChange={(e) => setReminderSearch(e.target.value)}
                placeholder="Search owner name, phone, chassis no..."
                className="input pl-9 w-full rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={reminderStatusFilter}
                onChange={(e: any) => setReminderStatusFilter(e.target.value)}
                className="input text-xs rounded-xl cursor-pointer w-full sm:w-44"
              >
                <option value="all">All Reminders</option>
                <option value="pending">Active Pending</option>
                <option value="overdue">Overdue Reminders</option>
                <option value="completed">Completed Visits</option>
              </select>
            </div>
          </div>

          {/* Reminders table/grid */}
          {remindersLoading ? (
            <p className="text-center text-slate-400 text-xs py-8">Loading service reminders...</p>
          ) : groupedReminders.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 font-extrabold text-sm">No Service Reminders Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Bike Description</th>
                    <th className="p-3 text-center">Service #</th>
                    <th className="p-3">Target Days</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Alert Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">IVR Status</th>
                    <th className="p-3">WA Status</th>
                    <th className="p-3">Actual Visit</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {groupedReminders.map(group => {
                    const r = group.displayReminder;
                    if (!r) return null;
                    const isExpanded = !!expandedReminderGroups[group.bikeId];
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = r.status === 'overdue' || (r.status === 'pending' && todayStr > r.scheduledDate);

                    return (
                      <React.Fragment key={`group-${group.bikeId}`}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2.5">
                              {group.otherReminders.length > 0 && (
                                <button
                                  onClick={() => toggleExpandReminderGroup(group.bikeId)}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary-600 transition-all flex items-center justify-center"
                                  title={isExpanded ? "Hide Other Services" : "Show All Services"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-primary-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <div>
                                <p>{getCustomerDetails(r.customerId).split(' (')[0]}</p>
                                <span className="text-[10px] text-slate-400 font-mono font-bold block">{getCustomerDetails(r.customerId).split(' (')[1]?.replace(')', '') || ''}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 truncate max-w-[200px]" title={getBikeDetails(r.bikeId)}>
                            {getBikeDetails(r.bikeId).split(' [')[0]}
                            <span className="text-[9px] text-slate-400 font-mono block">Chassis: {getBikeDetails(r.bikeId).split('Chassis: ')[1]?.replace(']', '') || ''}</span>
                          </td>
                          <td className="p-3 text-center font-extrabold text-slate-900">
                            {r.serviceNo}
                          </td>
                          <td className="p-3 text-slate-500">{r.scheduledDays} Days</td>
                          <td className="p-3 font-mono font-bold">{r.scheduledDate}</td>
                          <td className="p-3 font-mono text-slate-450">{r.reminderDate}</td>
                          <td className="p-3">
                            {r.status === 'completed' ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[9px] border border-emerald-250">Completed</span>
                            ) : isOverdue ? (
                              <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-md font-bold text-[9px] border border-red-250 flex items-center gap-0.5 w-max animate-pulse">
                                <BadgeAlert className="w-3 h-3" />
                                OVERDUE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-[9px] border border-amber-250">Pending</span>
                            )}
                          </td>
                          <td className="p-3">
                            {(r.ivrCallCount || 0) > 0 ? (
                              <button 
                                onClick={() => setSelectedIvrReminder(r)}
                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-[9px] border border-indigo-200 inline-flex items-center gap-1 transition-all"
                                title="Click to view IVR Call History"
                              >
                                <PhoneCall className="w-2.5 h-2.5" />
                                Called ({r.ivrCallCount})
                              </button>
                            ) : (
                              <button 
                                onClick={() => setSelectedIvrReminder(r)}
                                className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium hover:underline flex items-center gap-1"
                                title="Click to view IVR Call History"
                              >
                                Not Called
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            {(r.waSentCount || 0) > 0 ? (
                              <button 
                                onClick={() => setSelectedWaReminder(r)}
                                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-bold text-[9px] border border-emerald-200 inline-flex items-center gap-1 transition-all"
                                title="Click to view WhatsApp Alert History"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                Sent ({r.waSentCount})
                              </button>
                            ) : (
                              <button 
                                onClick={() => setSelectedWaReminder(r)}
                                className="text-[10px] text-slate-400 hover:text-emerald-600 font-medium hover:underline flex items-center gap-1"
                                title="Click to view WhatsApp Alert History"
                              >
                                Not Sent
                              </button>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-700">
                            {r.actualVisitDate || '-'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {r.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => setSelectedIvrReminder(r)}
                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl border border-indigo-200/50 hover:border-indigo-600 font-bold transition-all text-[10px] flex items-center gap-1"
                                  >
                                    <PhoneCall className="w-3 h-3" />
                                    IVR Call
                                  </button>
                                  <button
                                    onClick={() => setSelectedWaReminder(r)}
                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl border border-emerald-200/50 hover:border-emerald-600 font-bold transition-all text-[10px] flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    WhatsApp
                                  </button>
                                  <button
                                    onClick={() => {
                                      setLoggingVisit(r);
                                      setActualVisitDate(new Date().toISOString().split('T')[0]);
                                    }}
                                    className="px-2.5 py-1.5 bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white rounded-xl border border-primary-200/50 hover:border-primary-600 font-bold transition-all text-[10px]"
                                  >
                                    Log Visit
                                  </button>
                                </>
                              )}
                              {r.status === 'completed' && (
                                <>
                                  <button
                                    onClick={() => handlePrintReminder(r)}
                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Print Visit Log"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadReminder(r)}
                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Download Visit Log"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setEditingReminder(r);
                                  setEditFormData({
                                    scheduledDays: r.scheduledDays,
                                    scheduledDate: r.scheduledDate,
                                    reminderDate: r.reminderDate,
                                    status: r.status,
                                    actualVisitDate: r.actualVisitDate || new Date().toISOString().split('T')[0],
                                    notes: r.notes || ''
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Reminder"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete Service #${r.serviceNo} reminder?`)) {
                                    try {
                                      await deleteReminder(r.id);
                                      alert('Service reminder deleted successfully.');
                                    } catch (err) {
                                      alert('Failed to delete service reminder.');
                                    }
                                  }
                                }}
                                className="p-1.5 text-slate-500 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Reminder"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && group.otherReminders.map(otherR => {
                          const otherIsOverdue = otherR.status === 'overdue' || (otherR.status === 'pending' && todayStr > otherR.scheduledDate);

                          return (
                            <tr key={otherR.id} className="bg-slate-50/40 hover:bg-slate-100/55 transition-colors">
                              <td className="p-3 border-l-2 border-primary-500/30 pl-8" colSpan={2}>
                                <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  Related Service Record
                                </div>
                              </td>
                              <td className="p-3 text-center font-semibold text-slate-600">
                                {otherR.serviceNo}
                              </td>
                              <td className="p-3 text-slate-550">{otherR.scheduledDays} Days</td>
                              <td className="p-3 font-mono text-slate-600">{otherR.scheduledDate}</td>
                              <td className="p-3 font-mono text-slate-400">{otherR.reminderDate}</td>
                              <td className="p-3">
                                {otherR.status === 'completed' ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[9px] border border-emerald-250">Completed</span>
                                ) : otherIsOverdue ? (
                                  <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-md font-bold text-[9px] border border-red-250 flex items-center gap-0.5 w-max animate-pulse">
                                    <BadgeAlert className="w-3 h-3" />
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-[9px] border border-amber-250">Pending</span>
                                )}
                              </td>
                              <td className="p-3">
                                {(otherR.ivrCallCount || 0) > 0 ? (
                                  <button 
                                    onClick={() => setSelectedIvrReminder(otherR)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-[9px] border border-indigo-200 inline-flex items-center gap-1 transition-all"
                                    title="Click to view IVR Call History"
                                  >
                                    <PhoneCall className="w-2.5 h-2.5" />
                                    Called ({otherR.ivrCallCount})
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => setSelectedIvrReminder(otherR)}
                                    className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium hover:underline flex items-center gap-1"
                                    title="Click to view IVR Call History"
                                  >
                                    Not Called
                                  </button>
                                )}
                              </td>
                              <td className="p-3">
                                {(otherR.waSentCount || 0) > 0 ? (
                                  <button 
                                    onClick={() => setSelectedWaReminder(otherR)}
                                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-bold text-[9px] border border-emerald-200 inline-flex items-center gap-1 transition-all"
                                    title="Click to view WhatsApp Alert History"
                                  >
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    Sent ({otherR.waSentCount})
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => setSelectedWaReminder(otherR)}
                                    className="text-[10px] text-slate-400 hover:text-emerald-600 font-medium hover:underline flex items-center gap-1"
                                    title="Click to view WhatsApp Alert History"
                                  >
                                    Not Sent
                                  </button>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-600">
                                {otherR.actualVisitDate || '-'}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end items-center gap-1.5">
                                  {otherR.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => setSelectedIvrReminder(otherR)}
                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl border border-indigo-200/50 hover:border-indigo-600 font-bold transition-all text-[10px] flex items-center gap-1"
                                      >
                                        <PhoneCall className="w-3 h-3" />
                                        IVR Call
                                      </button>
                                      <button
                                        onClick={() => setSelectedWaReminder(otherR)}
                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl border border-emerald-200/50 hover:border-emerald-600 font-bold transition-all text-[10px] flex items-center gap-1"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                        WhatsApp
                                      </button>
                                      <button
                                        onClick={() => {
                                          setLoggingVisit(otherR);
                                          setActualVisitDate(new Date().toISOString().split('T')[0]);
                                        }}
                                        className="px-2.5 py-1.5 bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white rounded-xl border border-primary-200/50 hover:border-primary-600 font-bold transition-all text-[10px]"
                                      >
                                        Log Visit
                                      </button>
                                    </>
                                  )}
                                  {otherR.status === 'completed' && (
                                    <>
                                      <button
                                        onClick={() => handlePrintReminder(otherR)}
                                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Print Visit Log"
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDownloadReminder(otherR)}
                                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Download Visit Log"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingReminder(otherR);
                                      setEditFormData({
                                        scheduledDays: otherR.scheduledDays,
                                        scheduledDate: otherR.scheduledDate,
                                        reminderDate: otherR.reminderDate,
                                        status: otherR.status,
                                        actualVisitDate: otherR.actualVisitDate || new Date().toISOString().split('T')[0],
                                        notes: otherR.notes || ''
                                      });
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit Reminder"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to delete Service #${otherR.serviceNo} reminder?`)) {
                                        try {
                                          await deleteReminder(otherR.id);
                                          alert('Service reminder deleted successfully.');
                                        } catch (err) {
                                          alert('Failed to delete service reminder.');
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Reminder"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Showroom Bike Modal */}
      {showAddBikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl scale-100 transform transition-all duration-300">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <BikeIcon className="w-5 h-5 text-primary-500" />
              Register Showroom Bike
            </h3>

            <form onSubmit={handleAddBikeSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={newBike.brand}
                    onChange={(e) => setNewBike({ ...newBike, brand: e.target.value })}
                    placeholder="e.g. Yamaha"
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Model Name *</label>
                  <input
                    type="text"
                    value={newBike.modelName}
                    onChange={(e) => setNewBike({ ...newBike, modelName: e.target.value })}
                    placeholder="e.g. R15 V4"
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Showroom Units (Chassis & Engine) *</h4>
                  <button
                    type="button"
                    onClick={() => setBikeUnits(prev => [...prev, { chassisNumber: '', engineNumber: '' }])}
                    className="text-primary-600 hover:text-primary-850 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Unit
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {bikeUnits.map((unit, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={unit.chassisNumber}
                          onChange={(e) => {
                            const updated = [...bikeUnits];
                            updated[idx].chassisNumber = e.target.value;
                            setBikeUnits(updated);
                          }}
                          placeholder={`Chassis #${idx + 1}`}
                          className="input w-full text-[10px] font-mono font-bold py-1.5 px-2"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={unit.engineNumber}
                          onChange={(e) => {
                            const updated = [...bikeUnits];
                            updated[idx].engineNumber = e.target.value;
                            setBikeUnits(updated);
                          }}
                          placeholder={`Engine #${idx + 1}`}
                          className="input w-full text-[10px] font-mono font-bold py-1.5 px-2"
                          required
                        />
                      </div>
                      {bikeUnits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBikeUnits(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Stock Date</label>
                  <input
                    type="date"
                    value={newBike.stockDate}
                    onChange={(e) => setNewBike({ ...newBike, stockDate: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Name (with Year)</label>
                  <input
                    type="text"
                    value={newBike.batchName}
                    onChange={(e) => setNewBike({ ...newBike, batchName: e.target.value })}
                    placeholder="e.g. Batch 2026"
                    className="input w-full text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Color</label>
                  <input
                    type="text"
                    value={newBike.color}
                    onChange={(e) => setNewBike({ ...newBike, color: e.target.value })}
                    placeholder="e.g. Racing Blue"
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    value={newBike.costPrice}
                    onChange={(e) => setNewBike({ ...newBike, costPrice: e.target.value })}
                    placeholder="Showroom Cost"
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={newBike.sellingPrice}
                    onChange={(e) => handleSellingPriceChange(e.target.value)}
                    placeholder="Retail Sell Price"
                    className="input w-full text-xs font-bold text-primary-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount Price (₹)</label>
                  <input
                    type="number"
                    value={newBike.discountPrice}
                    onChange={(e) => handleDiscountPriceChange(e.target.value)}
                    placeholder="Disc. Amount"
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount %</label>
                  <input
                    type="number"
                    value={newBike.discountPercentage}
                    onChange={(e) => handleDiscountPercentageChange(e.target.value)}
                    placeholder="Disc. %"
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST % *</label>
                  <input
                    type="number"
                    value={newBike.gstPercentage}
                    onChange={(e) => handleGstPercentageChange(e.target.value)}
                    placeholder="e.g. 18"
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-150 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newBike.showGstInBill}
                    onChange={(e) => handleShowGstInBillToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-350 text-primary-650 focus:ring-primary-500"
                  />
                  <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">GST Show in Bill</span>
                </label>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Final Price (₹) *</label>
                  <input
                    type="text"
                    value={newBike.price}
                    readOnly
                    className="input w-full text-xs font-black bg-slate-100/80 text-slate-800 border-slate-300"
                    placeholder="Calculated Price"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Bike Record
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBikeModal(false)}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Visit Popup Overlay Modal */}
      {loggingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl scale-100 transform transition-all duration-300">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-5 h-5 text-primary-500" />
              Log Customer Service Visit
            </h3>

            <form onSubmit={handleLogVisitSubmit} className="mt-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bike Description</p>
                <p className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{getBikeDetails(loggingVisit.bikeId).split(' [')[0]}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Actual Visit Date *</label>
                <input
                  type="date"
                  value={actualVisitDate}
                  onChange={(e) => setActualVisitDate(e.target.value)}
                  className="input w-full text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Technician Notes</label>
                <textarea
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Notes on parts replaced or general checkup findings..."
                  className="input w-full text-xs rounded-xl h-20"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Visit Log
                </button>
                <button
                  type="button"
                  onClick={() => setLoggingVisit(null)}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Reminder Modal */}
      {editingReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl scale-100 transform transition-all duration-300">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-5 h-5 text-primary-500" />
              Edit Service Reminder
            </h3>

            <form onSubmit={handleEditReminderSubmit} className="mt-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bike Description</p>
                <p className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{getBikeDetails(editingReminder.bikeId).split(' [')[0]}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Service No</label>
                  <input
                    type="number"
                    value={editingReminder.serviceNo}
                    disabled
                    className="input w-full text-xs font-semibold bg-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Days</label>
                  <input
                    type="number"
                    value={editFormData.scheduledDays}
                    onChange={(e) => setEditFormData({ ...editFormData, scheduledDays: parseInt(e.target.value) || 1 })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={editFormData.scheduledDate}
                    onChange={(e) => setEditFormData({ ...editFormData, scheduledDate: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alert Date *</label>
                  <input
                    type="date"
                    value={editFormData.reminderDate}
                    onChange={(e) => setEditFormData({ ...editFormData, reminderDate: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e: any) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="input w-full text-xs font-semibold"
                >
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {editFormData.status === 'completed' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Actual Visit Date *</label>
                    <input
                      type="date"
                      value={editFormData.actualVisitDate}
                      onChange={(e) => setEditFormData({ ...editFormData, actualVisitDate: e.target.value })}
                      className="input w-full text-xs font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Visit Notes</label>
                    <textarea
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="Notes on parts replaced or general checkup findings..."
                      className="input w-full text-xs rounded-xl h-20"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingReminder(null)}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Showroom Bike Modal */}
      {editingBike && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl scale-100 transform transition-all duration-300">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <BikeIcon className="w-5 h-5 text-primary-500" />
              Edit Showroom Bike Unit
            </h3>

            <form onSubmit={handleEditBikeSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={editBikeFormData.brand}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, brand: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Model Name *</label>
                  <input
                    type="text"
                    value={editBikeFormData.modelName}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, modelName: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Chassis Number *</label>
                  <input
                    type="text"
                    value={editBikeFormData.chassisNumber}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, chassisNumber: e.target.value })}
                    className="input w-full text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Engine Number *</label>
                  <input
                    type="text"
                    value={editBikeFormData.engineNumber}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, engineNumber: e.target.value })}
                    className="input w-full text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Stock Date</label>
                  <input
                    type="date"
                    value={editBikeFormData.stockDate}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, stockDate: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Name (with Year)</label>
                  <input
                    type="text"
                    value={editBikeFormData.batchName}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, batchName: e.target.value })}
                    placeholder="e.g. Batch 2026"
                    className="input w-full text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Color</label>
                  <input
                    type="text"
                    value={editBikeFormData.color}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, color: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    value={editBikeFormData.costPrice}
                    onChange={(e) => setEditBikeFormData({ ...editBikeFormData, costPrice: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={editBikeFormData.sellingPrice}
                    onChange={(e) => handleEditBikeSellingPriceChange(e.target.value)}
                    className="input w-full text-xs font-bold text-primary-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount Price (₹)</label>
                  <input
                    type="number"
                    value={editBikeFormData.discountPrice}
                    onChange={(e) => handleEditBikeDiscountPriceChange(e.target.value)}
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount %</label>
                  <input
                    type="number"
                    value={editBikeFormData.discountPercentage}
                    onChange={(e) => handleEditBikeDiscountPercentageChange(e.target.value)}
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST % *</label>
                  <input
                    type="number"
                    value={editBikeFormData.gstPercentage}
                    onChange={(e) => handleEditBikeGstPercentageChange(e.target.value)}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-150 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editBikeFormData.showGstInBill}
                    onChange={(e) => handleEditBikeShowGstInBillToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-350 text-primary-650 focus:ring-primary-500"
                  />
                  <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">GST Show in Bill</span>
                </label>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Final Price (₹) *</label>
                  <input
                    type="text"
                    value={editBikeFormData.price}
                    readOnly
                    className="input w-full text-xs font-black bg-slate-100/80 text-slate-800 border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBike(null)}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Showroom Model & Add Stock Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl scale-100 transform transition-all duration-300">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <BikeIcon className="w-5 h-5 text-primary-500" />
              Edit Model & Restock Units
            </h3>

            <form onSubmit={handleEditGroupSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={editGroupFormData.brand}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, brand: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Model Name *</label>
                  <input
                    type="text"
                    value={editGroupFormData.modelName}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, modelName: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Stock Date</label>
                  <input
                    type="date"
                    value={editGroupFormData.stockDate}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, stockDate: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Name (with Year)</label>
                  <input
                    type="text"
                    value={editGroupFormData.batchName}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, batchName: e.target.value })}
                    placeholder="e.g. Batch 2026"
                    className="input w-full text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Color</label>
                  <input
                    type="text"
                    value={editGroupFormData.color}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, color: e.target.value })}
                    className="input w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    value={editGroupFormData.costPrice}
                    onChange={(e) => setEditGroupFormData({ ...editGroupFormData, costPrice: e.target.value })}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={editGroupFormData.sellingPrice}
                    onChange={(e) => handleEditGroupSellingPriceChange(e.target.value)}
                    className="input w-full text-xs font-bold text-primary-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount Price (₹)</label>
                  <input
                    type="number"
                    value={editGroupFormData.discountPrice}
                    onChange={(e) => handleEditGroupDiscountPriceChange(e.target.value)}
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount %</label>
                  <input
                    type="number"
                    value={editGroupFormData.discountPercentage}
                    onChange={(e) => handleEditGroupDiscountPercentageChange(e.target.value)}
                    className="input w-full text-xs font-semibold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST % *</label>
                  <input
                    type="number"
                    value={editGroupFormData.gstPercentage}
                    onChange={(e) => handleEditGroupGstPercentageChange(e.target.value)}
                    className="input w-full text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-150 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editGroupFormData.showGstInBill}
                    onChange={(e) => handleEditGroupShowGstInBillToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-350 text-primary-650 focus:ring-primary-500"
                  />
                  <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">GST Show in Bill</span>
                </label>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Final Price (₹) *</label>
                  <input
                    type="text"
                    value={editGroupFormData.price}
                    readOnly
                    className="input w-full text-xs font-black bg-slate-100/80 text-slate-800 border-slate-300"
                    required
                  />
                </div>
              </div>

              {/* Add New restocked Units section */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Restock Showroom Units (New Chassis & Engine)</h4>
                  <button
                    type="button"
                    onClick={() => setNewGroupUnits(prev => [...prev, { chassisNumber: '', engineNumber: '' }])}
                    className="text-primary-600 hover:text-primary-850 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Unit
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {newGroupUnits.map((unit, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={unit.chassisNumber}
                          onChange={(e) => {
                            const updated = [...newGroupUnits];
                            updated[idx].chassisNumber = e.target.value;
                            setNewGroupUnits(updated);
                          }}
                          placeholder={`Chassis #${idx + 1}`}
                          className="input w-full text-[10px] font-mono font-bold py-1.5 px-2"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={unit.engineNumber}
                          onChange={(e) => {
                            const updated = [...newGroupUnits];
                            updated[idx].engineNumber = e.target.value;
                            setNewGroupUnits(updated);
                          }}
                          placeholder={`Engine #${idx + 1}`}
                          className="input w-full text-[10px] font-mono font-bold py-1.5 px-2"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewGroupUnits(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove Restock Unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {newGroupUnits.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic text-center py-2">No additional restock units added. Add a row to restock this model.</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Model & Add Units
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(null);
                    setNewGroupUnits([]);
                  }}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IVR History & Dispatch Modal */}
      {selectedIvrReminder && (() => {
        const logs: IvrLogEntry[] = Array.isArray(selectedIvrReminder.ivrLogs)
          ? selectedIvrReminder.ivrLogs
          : (typeof selectedIvrReminder.ivrLogs === 'string' && selectedIvrReminder.ivrLogs ? JSON.parse(selectedIvrReminder.ivrLogs) : []);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">IVR Call History</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Service #{selectedIvrReminder.serviceNo} • {getCustomerDetails(selectedIvrReminder.customerId)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIvrReminder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Log Entries */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <PhoneCall className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-700 font-extrabold text-xs">No IVR Calls Logged Yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click "Make IVR Call Now" below to dispatch an automated voice call.</p>
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          <PhoneCall className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${log.type === 'auto' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {log.type === 'auto' ? 'Auto Alert' : 'Manual'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{log.message || (log.status === 'success' ? 'Call initiated successfully' : 'Failed')}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Call Action Bar */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Total Calls: <strong className="text-slate-800 font-extrabold">{selectedIvrReminder.ivrCallCount || 0}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppAlert(selectedIvrReminder)}
                    className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp Alert
                  </button>
                  <button
                    type="button"
                    disabled={isCallingIvr}
                    onClick={async () => {
                      if (!selectedIvrReminder) return;
                      setIsCallingIvr(true);
                      try {
                        const cust = customers.find(c => c.id === selectedIvrReminder.customerId);
                        const bike = bikes.find(b => b.id === selectedIvrReminder.bikeId);
                        await executeIvrCall(selectedIvrReminder, cust, bike, false, updateReminder, 'manual');
                      } finally {
                        setIsCallingIvr(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    <PhoneCall className="w-4 h-4" />
                    {isCallingIvr ? 'Calling...' : 'Make IVR Call Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* WhatsApp History & Dispatch Modal */}
      {selectedWaReminder && (() => {
        const logs: WaLogEntry[] = Array.isArray(selectedWaReminder.waLogs)
          ? selectedWaReminder.waLogs
          : (typeof selectedWaReminder.waLogs === 'string' && selectedWaReminder.waLogs ? JSON.parse(selectedWaReminder.waLogs) : []);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">WhatsApp Alert History</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Service #{selectedWaReminder.serviceNo} • {getCustomerDetails(selectedWaReminder.customerId)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWaReminder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Log Entries */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-700 font-extrabold text-xs">No WhatsApp Alerts Sent Yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click "Send WhatsApp Alert Now" below to dispatch a message.</p>
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${log.type === 'auto' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {log.type === 'auto' ? 'Auto Alert' : 'Manual'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{log.message || (log.status === 'success' ? 'WhatsApp alert sent' : 'Failed')}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Total Sent: <strong className="text-slate-800 font-extrabold">{selectedWaReminder.waSentCount || 0}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rem = selectedWaReminder;
                      setSelectedWaReminder(null);
                      setSelectedIvrReminder(rem);
                    }}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    IVR Calls
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedWaReminder) return;
                      await handleSendWhatsAppAlert(selectedWaReminder, 'manual');
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send WhatsApp Alert Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SaleBike;
