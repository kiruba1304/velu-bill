import React, { useState } from 'react';
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
  PhoneCall
} from 'lucide-react';
import { 
  useBikes, 
  useBikeServiceReminders, 
  useCustomers 
} from '../hooks/useDatabase';
import { BikeServiceReminder } from '../types';

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const SaleBike: React.FC = () => {
  const { bikes, addBike, updateBike, deleteBike, loading: bikesLoading } = useBikes();
  const { reminders, addReminder, updateReminder, loading: remindersLoading } = useBikeServiceReminders();
  const { customers } = useCustomers();

  const [activeTab, setActiveTab] = useState<'catalog' | 'sales' | 'reminders'>('catalog');

  // Catalog tab states
  const [showAddBikeModal, setShowAddBikeModal] = useState(false);
  const [bikeSearch, setBikeSearch] = useState('');
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
    price: '' // calculated finalPrice
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
  const [selectedBikeId, setSelectedBikeId] = useState<number | ''>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
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

  // Handle Add Bike Submit
  const handleAddBikeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBike.brand.trim() || !newBike.modelName.trim() || !newBike.chassisNumber.trim() || !newBike.engineNumber.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await addBike({
        brand: newBike.brand.trim(),
        modelName: newBike.modelName.trim(),
        chassisNumber: newBike.chassisNumber.trim().toUpperCase(),
        engineNumber: newBike.engineNumber.trim().toUpperCase(),
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
        saleDate: null
      });

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
        price: ''
      });
      setShowAddBikeModal(false);
      alert('New bike added to catalog!');
    } catch (err) {
      console.error(err);
      alert('Failed to add bike. Ensure chassis/engine numbers are unique.');
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

      // 2. Generate and write the entire service schedules to BikeServiceReminders
      let runningDate = saleDate;
      for (const interval of serviceIntervals) {
        // Compute targets
        const targetDue = addDays(runningDate, interval.days);
        const targetReminder = addDays(targetDue, 1);
        
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

      // Reset Form States
      setSelectedBikeId('');
      setSelectedCustomerId('');
      setCustomerSearchQuery('');
      setSalePrice('');
      alert('Bike sale logged and service maintenance schedule created successfully!');
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
        const nextReminderDate = addDays(nextDue, 1);
        
        await updateReminder(nextReminder.id, {
          scheduledDate: nextDue,
          reminderDate: nextReminderDate,
          status: 'pending' // activate next service
        });
      }

      setLoggingVisit(null);
      setVisitNotes('');
      alert('Service visit logged and next maintenance cycle updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to update service record.');
    }
  };

  const triggerIvrCall = async (reminder: BikeServiceReminder) => {
    const rawSettings = localStorage.getItem('app_settings');
    if (!rawSettings) {
      alert('IVR Settings are not configured. Please configure them in Settings page.');
      return;
    }
    const settings = JSON.parse(rawSettings);
    const { 
      ivrApiUrl, 
      ivrApiKey, 
      ivrCallerId, 
      ivrVirtualNumber, 
      ivrMethod, 
      ivrPayloadTemplate,
      ivrApiId,
      ivrApiPassword,
      ivrVendorAccountId,
      ivrDuration,
      ivrVoiceNote,
      ivrTitle
    } = settings;

    if (!ivrApiUrl) {
      alert('IVR API URL is not configured. Please configure it in Settings under Super Admin.');
      return;
    }

    const cust = customers.find(c => c.id === reminder.customerId);
    const bike = bikes.find(b => b.id === reminder.bikeId);

    const customerPhone = cust?.phone || '';
    const customerName = cust?.name || '';
    const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : '';
    const serviceNo = String(reminder.serviceNo);
    const scheduledDate = reminder.scheduledDate;

    if (!customerPhone) {
      alert('Customer has no phone number registered.');
      return;
    }

    const replacePlaceholders = (str: string) => {
      if (!str) return '';
      return str
        .replace(/{api_key}/g, ivrApiKey || '')
        .replace(/{virtual_number}/g, ivrVirtualNumber || '')
        .replace(/{caller_id}/g, ivrCallerId || '')
        .replace(/{api_id}/g, ivrApiId || '')
        .replace(/{api_password}/g, ivrApiPassword || '')
        .replace(/{vendor_account_id}/g, ivrVendorAccountId || '')
        .replace(/{voice_note}/g, ivrVoiceNote || '')
        .replace(/{duration}/g, ivrDuration || '')
        .replace(/{title}/g, ivrTitle || '')
        .replace(/{customer_phone}/g, customerPhone)
        .replace(/{customer_name}/g, customerName)
        .replace(/{bike_model}/g, bikeModel)
        .replace(/{service_no}/g, serviceNo)
        .replace(/{scheduled_date}/g, scheduledDate);
    };

    const finalUrl = replacePlaceholders(ivrApiUrl);
    const method = ivrMethod || 'POST';
    let body: any = null;
    let headers: any = {};

    if (ivrPayloadTemplate) {
      const filledTemplate = replacePlaceholders(ivrPayloadTemplate);
      if (method === 'POST') {
        try {
          JSON.parse(filledTemplate);
          body = filledTemplate;
          headers['Content-Type'] = 'application/json';
        } catch {
          body = filledTemplate;
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }

    try {
      const options: RequestInit = {
        method,
        headers
      };
      if (body && method !== 'GET' && method !== 'HEAD') {
        options.body = body;
      }

      const response = await fetch(finalUrl, options);
      const resText = await response.text();
      if (response.ok) {
        alert('IVR Reminder Call triggered successfully!');
      } else {
        alert(`IVR Call failed: Server responded with status ${response.status}. Response: ${resText}`);
      }
    } catch (err: any) {
      console.error('Error triggering IVR call:', err);
      alert(`Failed to trigger IVR call: ${err.message || String(err)}`);
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

  // Filters
  const filteredBikes = bikes.filter(b => 
    b.brand.toLowerCase().includes(bikeSearch.toLowerCase()) ||
    b.modelName.toLowerCase().includes(bikeSearch.toLowerCase()) ||
    b.chassisNumber.toLowerCase().includes(bikeSearch.toLowerCase())
  );

  const availableBikes = bikes.filter(b => b.status === 'available');

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
    const isOverdue = r.status === 'pending' && todayStr > r.scheduledDate;

    if (reminderStatusFilter === 'completed') return r.status === 'completed';
    if (reminderStatusFilter === 'overdue') return isOverdue;
    if (reminderStatusFilter === 'pending') return r.status === 'pending' && !isOverdue;

    return true;
  });

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
              onClick={() => setShowAddBikeModal(true)}
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
              {filteredBikes.map(b => (
                <div key={b.id} className="p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-150 hover:border-slate-300 transition-all shadow-sm hover:shadow-soft flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{b.brand}</span>
                        <h4 className="font-black text-slate-900 text-sm mt-0.5">{b.modelName}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                        b.status === 'available'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {b.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Chassis No:</span>
                        <span className="font-mono font-bold text-slate-800">{b.chassisNumber}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Engine No:</span>
                        <span className="font-mono font-bold text-slate-800">{b.engineNumber}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Color:</span>
                        <span className="font-semibold text-slate-800">{b.color || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 border-t border-slate-50 pt-1.5">
                        <span>Cost Price:</span>
                        <span className="font-semibold text-slate-800">₹{(b.costPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Selling Price:</span>
                        <span className="font-semibold text-slate-800">₹{(b.sellingPrice || 0).toFixed(2)}</span>
                      </div>
                      {(b.discountPrice || 0) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Discount:</span>
                          <span className="font-bold text-emerald-600">-₹{(b.discountPrice || 0).toFixed(2)} ({(b.discountPercentage || 0).toFixed(1)}%)</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>GST Option:</span>
                        <span className="font-semibold text-slate-700">
                          {(b.gstPercentage || 0)}% {b.showGstInBill ? '(Show in Bill)' : '(Hide)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] font-bold text-slate-450 uppercase">Final Showroom Price</p>
                      <p className="font-black text-slate-900 text-base">₹{(b.finalPrice || b.price || 0).toFixed(2)}</p>
                    </div>
                    {b.status === 'available' && (
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this bike from inventory?')) {
                            try {
                              await deleteBike(b.id);
                              alert('Bike removed.');
                            } catch (e) {
                              alert('Failed to delete bike.');
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Bike"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Customer Account</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                    className="input pl-9 w-full rounded-xl text-xs"
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
                          className="p-2 hover:bg-slate-50 rounded-xl cursor-pointer text-xs font-semibold text-slate-800 flex justify-between"
                        >
                          <span>{c.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{c.phone}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Select Bike */}
              <div>
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Select Available Bike</label>
                <select
                  value={selectedBikeId}
                  onChange={(e) => handleBikeSelect(Number(e.target.value))}
                  className="input w-full rounded-xl text-xs cursor-pointer"
                >
                  <option value="">-- Choose Showroom Bike --</option>
                  {availableBikes.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.brand} {b.modelName} [Chassis: {b.chassisNumber}] - ₹{b.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Billing Price & Sale Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Finalized Price (₹)</label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Enter sale price"
                    className="input w-full rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">Sale Date</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="input w-full rounded-xl text-xs"
                  />
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
                <li>**Service 1** triggers **{serviceIntervals[0]?.days || 15} days** after sale (reminder alert on day **{(serviceIntervals[0]?.days || 15) + 1}**).</li>
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
          ) : filteredReminders.length === 0 ? (
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
                    <th className="p-3">Actual Visit</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredReminders.map(r => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = r.status === 'pending' && todayStr > r.scheduledDate;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">
                          <p>{getCustomerDetails(r.customerId).split(' (')[0]}</p>
                          <span className="text-[10px] text-slate-400 font-mono font-bold block">{getCustomerDetails(r.customerId).split(' (')[1]?.replace(')', '') || ''}</span>
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
                        <td className="p-3 font-mono text-slate-700">
                          {r.actualVisitDate || '-'}
                        </td>
                        <td className="p-3 text-right">
                          {r.status === 'pending' && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => triggerIvrCall(r)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl border border-indigo-200/50 hover:border-indigo-600 font-bold transition-all text-[10px] flex items-center gap-1"
                              >
                                <PhoneCall className="w-3 h-3" />
                                IVR Call
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
                            </div>
                          )}
                        </td>
                      </tr>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Chassis Number *</label>
                  <input
                    type="text"
                    value={newBike.chassisNumber}
                    onChange={(e) => setNewBike({ ...newBike, chassisNumber: e.target.value })}
                    placeholder="Unique Chassis Code"
                    className="input w-full text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Engine Number *</label>
                  <input
                    type="text"
                    value={newBike.engineNumber}
                    onChange={(e) => setNewBike({ ...newBike, engineNumber: e.target.value })}
                    placeholder="Unique Engine Code"
                    className="input w-full text-xs font-mono font-bold"
                    required
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
    </div>
  );
};

export default SaleBike;
