import React, { useEffect, useMemo, useState } from 'react';
import { useBills, useCustomers } from '../hooks/useDatabase';
import { 
  Globe, Package, CheckCircle, Truck, Printer, Check, X, 
  RefreshCw, RotateCcw, AlertCircle, AlertTriangle 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

const LABEL_SIZES = [
  { value: '3in', label: '3 inch - Thermal label printer' },
  { value: '4x6', label: '4 x 6 in - Standard thermal' },
  { value: '4x8', label: '4 x 8 in - Extended thermal' },
  { value: 'A6', label: 'A6 - Compact label' },
  { value: 'A4', label: 'A4 - Full page label' }
] as const;

const LABEL_DIMENSIONS: Record<string, { width: string; height: string }> = {
  '3in': { width: '3in', height: '6in' },
  '4x6': { width: '4in', height: '6in' },
  '4x8': { width: '4in', height: '8in' },
  'A6': { width: '4.13in', height: '5.83in' },
  'A4': { width: '8.27in', height: '11.69in' }
};

const LABEL_LAYOUTS: Record<string, {
  padding: string;
  gap: string;
  headingSize: string;
  bodySize: string;
  metaSize: string;
  lineHeight: string;
}> = {
  '3in': {
    padding: '4px',
    gap: '2px',
    headingSize: '10px',
    bodySize: '10px',
    metaSize: '9px',
    lineHeight: '1.12'
  },
  '4x6': {
    padding: '6px',
    gap: '3px',
    headingSize: '11px',
    bodySize: '11px',
    metaSize: '10px',
    lineHeight: '1.15'
  },
  '4x8': {
    padding: '8px',
    gap: '4px',
    headingSize: '12px',
    bodySize: '12px',
    metaSize: '10px',
    lineHeight: '1.16'
  },
  'A6': {
    padding: '7px',
    gap: '4px',
    headingSize: '12px',
    bodySize: '12px',
    metaSize: '10px',
    lineHeight: '1.16'
  },
  'A4': {
    padding: '12px',
    gap: '6px',
    headingSize: '14px',
    bodySize: '14px',
    metaSize: '11px',
    lineHeight: '1.2'
  }
};

const getInitialLabelSize = () => {
  try {
    const raw = localStorage.getItem('app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const saved = String(parsed.shippingLabelSize || '').toUpperCase();
      if (LABEL_SIZES.some(size => size.value === saved)) return saved;
    }
  } catch {
    // ignore invalid storage
  }
  return '3in';
};

const formatDate = (dateInput: any) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const formatBarcodeText = (val: string) => {
  const clean = val.replace(/\s+/g, '');
  if (/^\d+$/.test(clean)) {
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }
  return val.split('').join(' ');
};

const buildBarcodeSvg = (value: string, labelSize: string, displayValue = false) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const targetWidth = labelSize === '3in' ? 175 : labelSize === 'A4' ? 320 : 240;
  const targetHeight = labelSize === '3in' ? 32 : labelSize === 'A4' ? 54 : 40;

  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: displayValue,
    margin: 0,
    width: labelSize === '3in' ? 0.9 : 1.05,
    height: targetHeight,
    fontSize: labelSize === '3in' ? 8 : 10,
    textMargin: 2,
    textAlign: 'center',
    textPosition: 'bottom',
    background: 'transparent',
    lineColor: '#111'
  });

  const extraHeight = displayValue ? 22 : 0;
  svg.setAttribute('width', String(targetWidth));
  svg.setAttribute('height', String(targetHeight + extraHeight));
  svg.setAttribute('viewBox', `0 0 ${targetWidth} ${targetHeight + extraHeight}`);

  return new XMLSerializer().serializeToString(svg);
};

const getDisplayOrderNumber = (order: any) => {
  if (!order) return '';
  return order.online_order_number 
    ? `#${String(order.online_order_number).padStart(6, '0')}` 
    : (order.billNumber ? order.billNumber.replace('EC-CUST-', '#') : `#${order.id}`);
};

const OnlineOrders: React.FC = () => {
  const { bills } = useBills();
  const { customers } = useCustomers();
  const [labelSize, setLabelSize] = useState(getInitialLabelSize);

  // Web Sync state
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [webCustomizations, setWebCustomizations] = useState<any[]>([]);
  const [quoteInputs, setQuoteInputs] = useState<Record<number, string>>({});
  const [apiUrl, setApiUrl] = useState('');

  const [activeTab, setActiveTab] = useState<'standard' | 'customization' | 'returns'>('standard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'upi'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispatched' | 'approved' | 'rejected'>('all');

  // Modal states for prompts
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'dispatch' | 'dispatch_custom' | 'book_dtdc' | 'book_custom_dtdc' | null>(null);
  const [modalTargetId, setModalTargetId] = useState<number | null>(null);
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [courierNameInput, setCourierNameInput] = useState("Delhivery");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");

  // Shiprocket Courier Selector states
  const [shiprocketModalOpen, setShiprocketModalOpen] = useState(false);
  const [shiprocketTargetId, setShiprocketTargetId] = useState<number | null>(null);
  const [shiprocketTargetType, setShiprocketTargetType] = useState<'standard' | 'customization' | null>(null);
  const [shiprocketWeight, setShiprocketWeight] = useState('0.5');
  const [shiprocketCouriers, setShiprocketCouriers] = useState<any[]>([]);
  const [shiprocketOrderRtoRisk, setShiprocketOrderRtoRisk] = useState<any | null>(null);
  const [shiprocketLoading, setShiprocketLoading] = useState(false);
  const [shiprocketError, setShiprocketError] = useState<string | null>(null);
  const [shiprocketWalletBalance, setShiprocketWalletBalance] = useState<number | null>(null);

  const sortedCouriers = useMemo(() => {
    return [...shiprocketCouriers].sort((a, b) => {
      const rateA = parseFloat(a.rate) || 0;
      const rateB = parseFloat(b.rate) || 0;
      return rateA - rateB;
    });
  }, [shiprocketCouriers]);

  const fetchShiprocketCourierRates = async (id: number, type: 'standard' | 'customization', weight: number) => {
    try {
      setShiprocketLoading(true);
      setShiprocketError(null);
      
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const endpoint = type === 'standard' 
        ? `${apiUrl}/billing/sync/orders/${id}/shipping-serviceability`
        : `${apiUrl}/billing/sync/customizations/${id}/shipping-serviceability`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, weight_kg: weight })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setShiprocketCouriers(data.available_couriers || []);
        setShiprocketOrderRtoRisk(data.order_rto_risk || null);
      } else {
        setShiprocketError(data.error || "Failed to fetch serviceability rates.");
      }
    } catch (err: any) {
      setShiprocketError(err.message || "Failed to fetch serviceability rates.");
    } finally {
      setShiprocketLoading(false);
    }
  };

  const fetchShiprocketWalletBalance = async () => {
    try {
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/shipping-wallet-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setShiprocketWalletBalance(data.balance);
      } else {
        setShiprocketWalletBalance(null);
      }
    } catch {
      setShiprocketWalletBalance(null);
    }
  };

  const handleInitiateShiprocketBooking = async (id: number, type: 'standard' | 'customization') => {
    setShiprocketTargetId(id);
    setShiprocketTargetType(type);
    setShiprocketWeight('0.5');
    setShiprocketCouriers([]);
    setShiprocketOrderRtoRisk(null);
    setShiprocketError(null);
    setShiprocketWalletBalance(null);
    setShiprocketModalOpen(true);
    
    // Fetch rates immediately for default weight 0.5
    await fetchShiprocketCourierRates(id, type, 0.5);
    // Fetch wallet balance
    fetchShiprocketWalletBalance();
  };

  const handleBookShiprocketCourier = async (courierId: number) => {
    if (!shiprocketTargetId || !shiprocketTargetType) return;
    
    try {
      setShiprocketLoading(true);
      setShiprocketError(null);
      
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const endpoint = shiprocketTargetType === 'standard' 
        ? `${apiUrl}/billing/sync/orders/${shiprocketTargetId}/book-shipping`
        : `${apiUrl}/billing/sync/customizations/${shiprocketTargetId}/book-shipping`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          api_key: apiKey, 
          carrier: 'Shiprocket', 
          weight_kg: parseFloat(shiprocketWeight) || 0.5,
          courier_id: courierId
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Shiprocket shipment booked successfully!");
        setShiprocketModalOpen(false);
        await loadOrders();
        
        // If there's a label URL, print or open it
        const target = shiprocketTargetType === 'standard' ? data.order : data.customization;
        if (target.shipping_label_url) {
          window.open(getFullImageUrl(target.shipping_label_url), '_blank');
        }
      } else {
        setShiprocketError(data.error || "Failed to book Shiprocket shipment.");
      }
    } catch (err: any) {
      setShiprocketError(err.message || "Failed to book Shiprocket shipment.");
    } finally {
      setShiprocketLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('app_settings');
      const settings = raw ? JSON.parse(raw) : {};
      const url = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      setApiUrl(url);
      const saved = String(settings.shippingLabelSize || '').toUpperCase();
      if (saved && LABEL_SIZES.some(size => size.value === saved)) {
        setLabelSize(saved);
      }
    } catch {
      // keep default
    }
  }, []);

  const getFullImageUrl = (imgUrl: string) => {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
      return imgUrl;
    }
    if (apiUrl) {
      try {
        const urlObj = new URL(apiUrl);
        const origin = urlObj.origin;
        const cleanPath = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
        return `${origin}${cleanPath}`;
      } catch (e) {
        let base = apiUrl.replace(/\/api\/?$/, '');
        const cleanPath = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
        return `${base}${cleanPath}`;
      }
    }
    return imgUrl;
  };

  const persistLabelSize = (nextSize: string) => {
    setLabelSize(nextSize);
    try {
      const raw = localStorage.getItem('app_settings');
      const settings = raw ? JSON.parse(raw) : {};
      localStorage.setItem('app_settings', JSON.stringify({
        ...settings,
        shippingLabelSize: nextSize
      }));
    } catch {
      // ignore storage write failures
    }
  };

  // Filter local bills where salesChannel === 'ecommerce' and invoiceType === 'customer_bill'
  const onlineOrders = useMemo(() => {
    return bills
      .filter(b => b.salesChannel === 'ecommerce' && b.invoiceType === 'customer_bill')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bills]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const settingsRaw = localStorage.getItem('app_settings');
      if (!settingsRaw) {
        setIsConfigured(false);
        setLoading(false);
        return;
      }
      
      const settings = JSON.parse(settingsRaw);
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      setApiUrl(apiUrl);
      const apiKey = settings.ecommerceApiKey || '';
      
      if (!apiUrl || !apiKey) {
        setIsConfigured(false);
        setLoading(false);
        return;
      }
      
      setIsConfigured(true);
      
      // Fetch standard orders
      const res = await fetch(`${apiUrl}/billing/sync/orders/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWebOrders(data.orders || []);
        } else {
          throw new Error(data.error || "Failed to load orders");
        }
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }

      // Fetch customization orders
      try {
        const custRes = await fetch(`${apiUrl}/billing/sync/customizations/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey })
        });
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.success) {
            setWebCustomizations(custData.customizations || []);
          }
        }
      } catch (custErr) {
        console.error("Error loading customization requests:", custErr);
      }

    } catch (err: any) {
      console.error("Error loading online orders from e-commerce:", err);
      setError(err.message || "Failed to connect to website backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Auto-reload on background sync completion
    window.addEventListener('ecommerce-sync-completed', loadOrders);
    return () => {
      window.removeEventListener('ecommerce-sync-completed', loadOrders);
    };
  }, []);

  // Update order status
  const handleUpdateStatus = async (orderId: number, status: string, additional: any = {}) => {
    try {
      setUpdatingId(orderId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, status, ...additional })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        await loadOrders();
      } else {
        alert(data.error || "Failed to update order status");
      }
    } catch (err: any) {
      alert("Error updating order: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Update customization status
  const handleUpdateCustomizationStatus = async (custId: number, status: string) => {
    try {
      setUpdatingId(custId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/customizations/${custId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, status })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        await loadOrders();
      } else {
        alert(data.error || "Failed to update customization status");
      }
    } catch (err: any) {
      alert("Error updating customization: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Send customization quote
  const handleSendQuote = async (custId: number, price: string) => {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      alert("Please enter a valid price greater than zero.");
      return;
    }
    
    try {
      setUpdatingId(custId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/customizations/${custId}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, quoted_price: numericPrice })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Price quote updated successfully!");
        await loadOrders();
      } else {
        alert(data.error || "Failed to update price quote");
      }
    } catch (err: any) {
      alert("Error sending quote: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // OpenLink utility

  const openLink = (url: string) => {
    const api = (window as any).electronAPI;
    if (api && api.openExternal) {
      api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Dispatch custom order (Open Modal)
  const handleDispatchCustomOrder = (custId: number) => {
    setModalTitle("Dispatch Custom Order");
    setCourierNameInput("Delhivery");
    setTrackingNumberInput("");
    setModalType('dispatch_custom');
    setModalTargetId(custId);
    setModalOpen(true);
  };

  // Book DTDC Shipment for Customization (Open Modal)
  const handleBookCustomDtdcShipping = (custId: number) => {
    setModalTitle("Book Custom DTDC Shipment");
    setModalPlaceholder("0.5");
    setModalInputValue("0.5");
    setModalType('book_custom_dtdc');
    setModalTargetId(custId);
    setModalOpen(true);
  };

  // Dispatch generic order (Open Modal)
  const handleDispatchOrder = (orderId: number) => {
    setModalTitle("Dispatch Order");
    setCourierNameInput("Delhivery");
    setTrackingNumberInput("");
    setModalType('dispatch');
    setModalTargetId(orderId);
    setModalOpen(true);
  };

  // Book DTDC Shipment (Open Modal)
  const handleBookDtdcShipping = (orderId: number) => {
    setModalTitle("Book DTDC Shipment");
    setModalPlaceholder("0.5");
    setModalInputValue("0.5");
    setModalType('book_dtdc');
    setModalTargetId(orderId);
    setModalOpen(true);
  };

  // Execute actual actions
  const executeDispatchOrder = async (orderId: number, trackingInfo: string) => {
    await handleUpdateStatus(orderId, 'Dispatched', { tracking_info: trackingInfo });
  };

  const executeBookDtdcShipping = async (orderId: number, weight: number) => {
    try {
      setUpdatingId(orderId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/orders/${orderId}/book-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, weight_kg: weight })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`DTDC shipment booked successfully! AWB: ${data.order.tracking_info.split('AWB:')[1]?.trim() || data.order.tracking_info}`);
        await loadOrders();
        if (data.order.shipping_label_url) {
          handlePrintLocalDtdcLabel(data.order);
        }
      } else {
        alert(data.error || "Failed to book DTDC shipment");
      }
    } catch (err: any) {
      alert("Error booking DTDC shipping: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const executeDispatchCustomOrder = async (custId: number, trackingInfo: string) => {
    try {
      setUpdatingId(custId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/customizations/${custId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, status: 'Dispatched', tracking_info: trackingInfo })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        await loadOrders();
      } else {
        alert(data.error || "Failed to dispatch customization order");
      }
    } catch (err: any) {
      alert("Error dispatching customization order: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const executeBookCustomDtdcShipping = async (custId: number, weight: number) => {
    try {
      setUpdatingId(custId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/customizations/${custId}/book-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, weight_kg: weight })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`DTDC shipment booked successfully! AWB: ${data.customization.tracking_info.split('AWB:')[1]?.trim() || data.customization.tracking_info}`);
        await loadOrders();
        if (data.customization.shipping_label_url) {
          handlePrintLocalCustomDtdcLabel(data.customization);
        }
      } else {
        alert(data.error || "Failed to book DTDC shipment for customization");
      }
    } catch (err: any) {
      alert("Error booking DTDC shipping for customization: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleModalSubmit = async () => {
    if (!modalTargetId || !modalType) return;
    
    if (modalType === 'dispatch') {
      const courier = courierNameInput.trim();
      const tracking = trackingNumberInput.trim();
      if (!courier || !tracking) {
        alert("Courier name and tracking number are required!");
        return;
      }
      setModalOpen(false);
      await executeDispatchOrder(modalTargetId, `${courier} AWB: ${tracking}`);
    } else if (modalType === 'dispatch_custom') {
      const courier = courierNameInput.trim();
      const tracking = trackingNumberInput.trim();
      if (!courier || !tracking) {
        alert("Courier name and tracking number are required!");
        return;
      }
      setModalOpen(false);
      await executeDispatchCustomOrder(modalTargetId, `${courier} AWB: ${tracking}`);
    } else {
      const value = modalInputValue.trim();
      setModalOpen(false);
      if (modalType === 'book_dtdc') {
        const weight = parseFloat(value) || 0.5;
        await executeBookDtdcShipping(modalTargetId, weight);
      } else if (modalType === 'book_custom_dtdc') {
        const weight = parseFloat(value) || 0.5;
        await executeBookCustomDtdcShipping(modalTargetId, weight);
      }
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    if (!window.confirm("Are you sure you want to reject this order?")) return;
    await handleUpdateStatus(orderId, 'Rejected');
  };

  const handleConfirmDelivery = async (orderId: number) => {
    await handleUpdateStatus(orderId, 'Customer Received');
  };

  // Resolve Return request
  const handleResolveReturn = async (orderId: number, decision: 'Approved' | 'Rejected') => {
    if (!window.confirm(`Are you sure you want to ${decision.toLowerCase()} this return request?`)) return;
    try {
      setUpdatingId(orderId);
      const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';
      
      const res = await fetch(`${apiUrl}/billing/sync/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, decision })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        await loadOrders();
      } else {
        alert(data.error || "Failed to resolve return request");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Dual-mode mapping
  const displayedOrders = useMemo(() => {
    let list = [];
    if (isConfigured && !error) {
      list = [...webOrders];
    } else {
      // Fallback: map local SQLite bills to order objects
      list = onlineOrders.map(b => {
        const customer = b.customer || customers.find(c => c.id === b.customerId);
        return {
          id: b.id,
          isLocalFallback: true,
          created_at: b.createdAt,
          billNumber: b.billNumber,
          final_amount: b.finalAmount,
          payment_method: (b.paymentMethod || 'ONLINE').toUpperCase(),
          status: b.status === 'completed' ? 'Customer Received' : 'Pending',
          customer: {
            name: customer?.name || 'Online Customer',
            phone: customer?.phone || '',
            email: customer?.email || '',
            shipping_address: customer?.address || ''
          },
          items: b.items?.map(item => ({
            id: item.id,
            product_name: item.product?.name || 'Product',
            product_image: item.productImage || item.product?.images?.[0],
            quantity: item.quantity,
            price: item.unitPrice
          })) || []
        };
      });
    }

    // Apply Date Filter
    list = list.filter(order => {
      const orderDate = new Date(order.created_at || order.createdAt);
      if (isNaN(orderDate.getTime())) return true;
      
      const now = new Date();
      if (dateFilter === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) return false;
        }
        if (end) {
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }
      return true;
    });

    // Apply Payment Method Filter
    list = list.filter(order => {
      if (paymentFilter === 'all') return true;
      const method = String(order.payment_method || '').toLowerCase();
      if (paymentFilter === 'cod') {
        return method === 'cod';
      }
      if (paymentFilter === 'upi') {
        return method === 'upi' || method === 'online';
      }
      return true;
    });

    // Apply Status Filter
    list = list.filter(order => {
      if (statusFilter === 'all') return true;
      const status = String(order.status || '').trim().toLowerCase();
      if (statusFilter === 'pending') {
        return status === 'pending' || status === 'accepted';
      }
      if (statusFilter === 'dispatched') {
        return status === 'dispatched';
      }
      if (statusFilter === 'approved') {
        return status === 'customer received' || status === 'delivered';
      }
      if (statusFilter === 'rejected') {
        return status === 'rejected';
      }
      return true;
    });

    const getStatusPriority = (status: string) => {
      const s = String(status || '').trim();
      if (s === 'Pending') return 1;
      if (s === 'Accepted') return 2;
      if (s === 'Dispatched') return 3;
      if (s === 'Customer Received') return 4;
      if (s === 'Returned') return 5;
      if (s === 'Rejected') return 6;
      return 7;
    };

    return list.sort((a, b) => {
      const pA = getStatusPriority(a.status);
      const pB = getStatusPriority(b.status);
      
      const groupA = pA <= 3 ? 0 : 1;
      const groupB = pB <= 3 ? 0 : 1;
      
      if (groupA !== groupB) {
        return groupA - groupB;
      }
      
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [isConfigured, error, webOrders, onlineOrders, customers, dateFilter, startDate, endDate, paymentFilter, statusFilter]);

  // Local printer label routine (reused)
  const handlePrintLocalLabel = async (order: any) => {
    const settingsRaw = localStorage.getItem('app_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const storeName = settings.storeName || settings.store || 'Store';
    const storeAddress = settings.address || '';
    const storePhone = settings.phone || '';

    const customerName = order.customer?.name || 'Customer';
    const customerAddress = order.customer?.shipping_address || order.customer?.address || '';
    const customerPhone = order.customer?.phone || '';

    const win = window.open('', '_blank');
    if (!win) return;

    function escapeHtml(s: any) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const paymentType = (order.payment_method || '').toString().toLowerCase() === 'cod' ? 'COD' : 'Prepaid';
    const barcodeValue = getDisplayOrderNumber(order).trim();
    const barcodeSvg = buildBarcodeSvg(barcodeValue, labelSize, false);
    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, { margin: 1, width: 120 });

    const size = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['4x6'];
    const layout = LABEL_LAYOUTS[labelSize] || LABEL_LAYOUTS['4x6'];

    const html = `
      <html>
        <head>
          <title>Shipping Label - ${escapeHtml(barcodeValue)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            @page { size: ${size.width} ${size.height}; margin: 0; }
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; font-family: 'Inter', Arial, sans-serif; background: #fff; color: #000; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; display: flex; align-items: center; justify-content: center; }
            
            .label-container { width: 100%; height: 100%; border: 3px solid #000; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
            
            /* Grid Rows */
            .row { display: flex; width: 100%; border-bottom: 2px solid #000; }
            .row:last-child { border-bottom: none; }
            
            /* Two Column Rows */
            .col-50 { width: 50%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; gap: 2px; justify-content: flex-start; }
            .col-50:last-child { border-right: none; }
            
            /* Header Row */
            .row-header { align-items: stretch; }
            .col-logo { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 3px; }
            .logo-icon { width: calc(${layout.headingSize} * 2.2); height: calc(${layout.headingSize} * 2.2); color: #000; }
            .logo-text { font-size: calc(${layout.metaSize} - 1.5px); font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; }
            .col-title { width: 66.666%; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; font-size: calc(${layout.headingSize} + 4px); font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; }
            
            /* Labels & Contents */
            .lbl { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; color: #000; letter-spacing: 0.03em; margin-bottom: 1px; }
            .val-bold { font-size: ${layout.bodySize}; font-weight: 800; text-transform: uppercase; line-height: ${layout.lineHeight}; }
            .val-text { font-size: calc(${layout.bodySize} - 0.5px); font-weight: 500; line-height: ${layout.lineHeight}; white-space: pre-line; }
            
            /* QR & Order Info Row */
            .col-qr { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; }
            .qr-code { width: calc(${layout.bodySize} * 5.2); height: calc(${layout.bodySize} * 5.2); display: block; max-width: 100%; height: auto; }
            .col-order-info { width: 66.666%; padding: ${layout.padding}; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
            .order-info-item { display: flex; flex-direction: column; }
            
            /* Barcode Row */
            .row-barcode { flex-direction: column; align-items: center; justify-content: center; padding: ${layout.padding}; text-align: center; gap: 4px; border-bottom: 2px solid #000; }
            .barcode-title { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            .barcode-svg-wrap { width: 100%; display: flex; justify-content: center; padding: 2px 0; }
            .barcode-svg-wrap svg { max-width: 95%; height: auto; display: block; }
            .barcode-text { font-size: calc(${layout.bodySize} + 1px); font-weight: 800; letter-spacing: 0.1em; margin-top: 1px; }
            
            /* Payment & Amount Row */
            .payment-big { font-size: calc(${layout.headingSize} * 1.8); font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-top: 2px; }
            
            /* Footer Row */
            .row-footer { padding: 4px; justify-content: center; align-items: center; text-align: center; font-size: calc(${layout.metaSize} - 1.5px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: #fafafb; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <!-- Row 1: Header -->
            <div class="row row-header">
              <div class="col-logo">
                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <div class="logo-text">${escapeHtml(storeName)}</div>
              </div>
              <div class="col-title">Shipping Label</div>
            </div>
            
            <!-- Row 2: Sender/Consignee Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">From:</span>
                <span class="val-bold">${escapeHtml(storeName)}</span>
                <span class="val-text">${escapeHtml(storeAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(storePhone)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">To:</span>
                <span class="val-bold">${escapeHtml(customerName)}</span>
                <span class="val-text">${escapeHtml(customerAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</span>
              </div>
            </div>
            
            <!-- Row 3: Carrier Details -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Courier Partner:</span>
                <div style="border-bottom: 1.5px dashed #000; width: 90%; height: 16px; margin-top: 4px;"></div>
              </div>
              <div class="col-50">
                <span class="lbl">Shipping Date:</span>
                <span class="val-bold">${formatDate(new Date())}</span>
              </div>
            </div>
            
            <!-- Row 4: QR & Order Details -->
            <div class="row">
              <div class="col-qr">
                <img class="qr-code" src="${qrCodeDataUrl}" alt="QR" />
              </div>
              <div class="col-order-info">
                <div class="order-info-item">
                  <span class="lbl">Order Date:</span>
                  <span class="val-bold">${formatDate(order.created_at || order.createdAt)}</span>
                </div>
                <div class="order-info-item">
                  <span class="lbl">Order ID:</span>
                  <span class="val-bold">${escapeHtml(barcodeValue)}</span>
                </div>
              </div>
            </div>
            
            <!-- Row 5: Barcode & Tracking -->
            <div class="row-barcode" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 10px 14px; height: 75px;">
              <!-- Hidden references to avoid unused variable warnings: ${barcodeSvg} ${formatBarcodeText(barcodeValue)} -->
              <span class="barcode-title" style="margin-bottom: 12px; font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase;">AWB / TRACKING NO:</span>
              <div style="border-bottom: 1.5px dashed #000; width: 100%; height: 10px;"></div>
            </div>
            
            <!-- Row 6: Payment Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Payment Type:</span>
                <span class="payment-big">${escapeHtml(paymentType)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">${paymentType === 'COD' ? 'COD Amount:' : 'Prepaid Amount:'}</span>
                <span class="payment-big">₹${parseFloat(order.final_amount).toFixed(2)}</span>
              </div>
            </div>
            
            <!-- Row 7: Footer -->
            <div class="row-footer">
              LOCAL OUTLET DELIVERY / SERVICE: STANDARD
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const handlePrintLocalDtdcLabel = async (order: any) => {
    const settingsRaw = localStorage.getItem('app_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const storeName = settings.storeName || settings.store || 'Store';
    const storeAddress = settings.address || '';
    const storePhone = settings.phone || '';

    const customerName = order.customer?.name || 'Customer';
    const customerAddress = order.customer?.shipping_address || order.customer?.address || '';
    const customerPhone = order.customer?.phone || '';

    const win = window.open('', '_blank');
    if (!win) return;

    function escapeHtml(s: any) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const paymentType = (order.payment_method || '').toString().toLowerCase() === 'cod' ? 'COD' : 'Prepaid';
    const rawTracking = order.tracking_info || '';
    const awbNumber = rawTracking.includes('AWB:') ? rawTracking.split('AWB:')[1]?.trim() : rawTracking;
    const barcodeValue = awbNumber || `D${String(order.id).padStart(8, '0')}`;
    const barcodeSvg = buildBarcodeSvg(barcodeValue, labelSize, false);
    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, { margin: 1, width: 120 });

    const size = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['4x6'];
    const layout = LABEL_LAYOUTS[labelSize] || LABEL_LAYOUTS['4x6'];

    const html = `
      <html>
        <head>
          <title>DTDC Shipping Label - ${escapeHtml(barcodeValue)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            @page { size: ${size.width} ${size.height}; margin: 0; }
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; font-family: 'Inter', Arial, sans-serif; background: #fff; color: #000; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; display: flex; align-items: center; justify-content: center; }
            
            .label-container { width: 100%; height: 100%; border: 3px solid #000; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
            
            /* Grid Rows */
            .row { display: flex; width: 100%; border-bottom: 2px solid #000; }
            .row:last-child { border-bottom: none; }
            
            /* Two Column Rows */
            .col-50 { width: 50%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; gap: 2px; justify-content: flex-start; }
            .col-50:last-child { border-right: none; }
            
            /* Header Row */
            .row-header { align-items: stretch; }
            .col-logo { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 3px; }
            .logo-icon { width: calc(${layout.headingSize} * 2.2); height: calc(${layout.headingSize} * 2.2); color: #000; }
            .logo-text { font-size: calc(${layout.metaSize} - 1.5px); font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; }
            .col-title { width: 66.666%; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; font-size: calc(${layout.headingSize} + 4px); font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; }
            
            /* Labels & Contents */
            .lbl { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; color: #000; letter-spacing: 0.03em; margin-bottom: 1px; }
            .val-bold { font-size: ${layout.bodySize}; font-weight: 800; text-transform: uppercase; line-height: ${layout.lineHeight}; }
            .val-text { font-size: calc(${layout.bodySize} - 0.5px); font-weight: 500; line-height: ${layout.lineHeight}; white-space: pre-line; }
            
            /* QR & Order Info Row */
            .col-qr { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; }
            .qr-code { width: calc(${layout.bodySize} * 5.2); height: calc(${layout.bodySize} * 5.2); display: block; max-width: 100%; height: auto; }
            .col-order-info { width: 66.666%; padding: ${layout.padding}; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
            .order-info-item { display: flex; flex-direction: column; }
            
            /* Barcode Row */
            .row-barcode { flex-direction: column; align-items: center; justify-content: center; padding: ${layout.padding}; text-align: center; gap: 4px; border-bottom: 2px solid #000; }
            .barcode-title { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            .barcode-svg-wrap { width: 100%; display: flex; justify-content: center; padding: 2px 0; }
            .barcode-svg-wrap svg { max-width: 95%; height: auto; display: block; }
            .barcode-text { font-size: calc(${layout.bodySize} + 1px); font-weight: 800; letter-spacing: 0.1em; margin-top: 1px; }
            
            /* Payment & Amount Row */
            .payment-big { font-size: calc(${layout.headingSize} * 1.8); font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-top: 2px; }
            
            /* Footer Row */
            .row-footer { padding: 4px; justify-content: center; align-items: center; text-align: center; font-size: calc(${layout.metaSize} - 1.5px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: #fafafb; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <!-- Row 1: Header -->
            <div class="row row-header">
              <div class="col-logo">
                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 2L11 13"></path>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <div class="logo-text">DTDC Express</div>
              </div>
              <div class="col-title">Shipping Label</div>
            </div>
            
            <!-- Row 2: Sender/Consignee Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">From:</span>
                <span class="val-bold">${escapeHtml(storeName)}</span>
                <span class="val-text">${escapeHtml(storeAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(storePhone)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">To:</span>
                <span class="val-bold">${escapeHtml(customerName)}</span>
                <span class="val-text">${escapeHtml(customerAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</span>
              </div>
            </div>
            
            <!-- Row 3: Carrier Details -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Shipping Partner:</span>
                <span class="val-bold">DTDC Express</span>
              </div>
              <div class="col-50">
                <span class="lbl">Shipping Date:</span>
                <span class="val-bold">${formatDate(new Date())}</span>
              </div>
            </div>
            
            <!-- Row 4: QR & Order Details -->
            <div class="row">
              <div class="col-qr">
                <img class="qr-code" src="${qrCodeDataUrl}" alt="QR" />
              </div>
              <div class="col-order-info">
                <div class="order-info-item">
                  <span class="lbl">Order Date:</span>
                  <span class="val-bold">${formatDate(order.created_at || order.createdAt)}</span>
                </div>
                <div class="order-info-item">
                  <span class="lbl">Order ID:</span>
                  <span class="val-bold">${escapeHtml(getDisplayOrderNumber(order))}</span>
                </div>
              </div>
            </div>
            
            <!-- Row 5: Barcode & Tracking -->
            <div class="row-barcode">
              <span class="barcode-title">Shipping Tracking Number:</span>
              <div class="barcode-svg-wrap">${barcodeSvg}</div>
              <div class="barcode-text">${formatBarcodeText(barcodeValue)}</div>
            </div>
            
            <!-- Row 6: Payment Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Payment Type:</span>
                <span class="payment-big">${escapeHtml(paymentType)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">${paymentType === 'COD' ? 'COD Amount:' : 'Prepaid Amount:'}</span>
                <span class="payment-big">₹${parseFloat(order.final_amount).toFixed(2)}</span>
              </div>
            </div>
            
            <!-- Row 7: Footer -->
            <div class="row-footer">
              DTDC COURIER CARRIER / SERVICE: EXPRESS RESIDENTIAL
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const handlePrintLocalCustomDtdcLabel = async (cust: any) => {
    const settingsRaw = localStorage.getItem('app_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const storeName = settings.storeName || settings.store || 'Store';
    const storeAddress = settings.address || '';
    const storePhone = settings.phone || '';

    const customerName = cust.user_name || 'Customer';
    const customerAddress = cust.shipping_address || '';
    const customerPhone = cust.user_phone || '';

    const win = window.open('', '_blank');
    if (!win) return;

    function escapeHtml(s: any) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const paymentType = 'Prepaid';
    const rawTracking = cust.tracking_info || '';
    const awbNumber = rawTracking.includes('AWB:') ? rawTracking.split('AWB:')[1]?.trim() : rawTracking;
    const barcodeValue = awbNumber || `CUST-D${String(cust.id).padStart(6, '0')}`;
    const barcodeSvg = buildBarcodeSvg(barcodeValue, labelSize, false);
    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, { margin: 1, width: 120 });

    const size = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['4x6'];
    const layout = LABEL_LAYOUTS[labelSize] || LABEL_LAYOUTS['4x6'];

    const unitPrice = cust.quoted_price ?? (cust.product?.price || 0.0);
    const finalAmount = unitPrice * cust.quantity;

    const html = `

      <html>
        <head>
          <title>DTDC Custom Shipping Label - ${escapeHtml(barcodeValue)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            @page { size: ${size.width} ${size.height}; margin: 0; }
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; font-family: 'Inter', Arial, sans-serif; background: #fff; color: #000; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; display: flex; align-items: center; justify-content: center; }
            
            .label-container { width: 100%; height: 100%; border: 3px solid #000; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
            
            /* Grid Rows */
            .row { display: flex; width: 100%; border-bottom: 2px solid #000; }
            .row:last-child { border-bottom: none; }
            
            /* Two Column Rows */
            .col-50 { width: 50%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; gap: 2px; justify-content: flex-start; }
            .col-50:last-child { border-right: none; }
            
            /* Header Row */
            .row-header { align-items: stretch; }
            .col-logo { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 3px; }
            .logo-icon { width: calc(${layout.headingSize} * 2.2); height: calc(${layout.headingSize} * 2.2); color: #000; }
            .logo-text { font-size: calc(${layout.metaSize} - 1.5px); font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; }
            .col-title { width: 66.666%; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; font-size: calc(${layout.headingSize} + 4px); font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; }
            
            /* Labels & Contents */
            .lbl { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; color: #000; letter-spacing: 0.03em; margin-bottom: 1px; }
            .val-bold { font-size: ${layout.bodySize}; font-weight: 800; text-transform: uppercase; line-height: ${layout.lineHeight}; }
            .val-text { font-size: calc(${layout.bodySize} - 0.5px); font-weight: 500; line-height: ${layout.lineHeight}; white-space: pre-line; }
            
            /* QR & Order Info Row */
            .col-qr { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; }
            .qr-code { width: calc(${layout.bodySize} * 5.2); height: calc(${layout.bodySize} * 5.2); display: block; max-width: 100%; height: auto; }
            .col-order-info { width: 66.666%; padding: ${layout.padding}; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
            .order-info-item { display: flex; flex-direction: column; }
            
            /* Barcode Row */
            .row-barcode { flex-direction: column; align-items: center; justify-content: center; padding: ${layout.padding}; text-align: center; gap: 4px; border-bottom: 2px solid #000; }
            .barcode-title { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            .barcode-svg-wrap { width: 100%; display: flex; justify-content: center; padding: 2px 0; }
            .barcode-svg-wrap svg { max-width: 95%; height: auto; display: block; }
            .barcode-text { font-size: calc(${layout.bodySize} + 1px); font-weight: 800; letter-spacing: 0.1em; margin-top: 1px; }
            
            /* Payment & Amount Row */
            .payment-big { font-size: calc(${layout.headingSize} * 1.8); font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-top: 2px; }
            
            /* Footer Row */
            .row-footer { padding: 4px; justify-content: center; align-items: center; text-align: center; font-size: calc(${layout.metaSize} - 1.5px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: #fafafb; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <!-- Row 1: Header -->
            <div class="row row-header">
              <div class="col-logo">
                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 2L11 13"></path>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <div class="logo-text">DTDC Custom</div>
              </div>
              <div class="col-title">Shipping Label</div>
            </div>
            
            <!-- Row 2: Sender/Consignee Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">From:</span>
                <span class="val-bold">${escapeHtml(storeName)}</span>
                <span class="val-text">${escapeHtml(storeAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(storePhone)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">To:</span>
                <span class="val-bold">${escapeHtml(customerName)}</span>
                <span class="val-text">${escapeHtml(customerAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</span>
              </div>
            </div>
            
            <!-- Row 3: Carrier Details -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Shipping Partner:</span>
                <span class="val-bold">DTDC Express</span>
              </div>
              <div class="col-50">
                <span class="lbl">Shipping Date:</span>
                <span class="val-bold">${formatDate(new Date())}</span>
              </div>
            </div>
            
            <!-- Row 4: QR & Custom Order Info -->
            <div class="row">
              <div class="col-qr">
                <img class="qr-code" src="${qrCodeDataUrl}" alt="QR" />
              </div>
              <div class="col-order-info">
                <div class="order-info-item">
                  <span class="lbl">Order Date:</span>
                  <span class="val-bold">${formatDate(cust.created_at || cust.createdAt)}</span>
                </div>
                <div class="order-info-item">
                  <span class="lbl">Order ID:</span>
                  <span class="val-bold">#CUST-${String(cust.id).padStart(6, '0')}</span>
                </div>
                <div class="order-info-item" style="border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 2px;">
                  <span class="lbl">Specs:</span>
                  <span class="val-text" style="font-size: 8px;"><strong>${escapeHtml(cust.product_name)}</strong> (Qty: ${cust.quantity})<br/>Color: ${escapeHtml(cust.selected_color_name)}<br/>Notes: ${escapeHtml(cust.customization_notes || 'None')}</span>
                </div>
              </div>
            </div>
            
            <!-- Row 5: Barcode & Tracking -->
            <div class="row-barcode">
              <span class="barcode-title">Shipping Tracking Number:</span>
              <div class="barcode-svg-wrap">${barcodeSvg}</div>
              <div class="barcode-text">${formatBarcodeText(barcodeValue)}</div>
            </div>
            
            <!-- Row 6: Payment Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Payment Type:</span>
                <span class="payment-big">${escapeHtml(paymentType)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">Prepaid Amount:</span>
                <span class="payment-big">₹${parseFloat(finalAmount.toString()).toFixed(2)}</span>
              </div>
            </div>
            
            <!-- Row 7: Footer -->
            <div class="row-footer">
              DTDC CUSTOM COURIER / SERVICE: SPECIAL HANDCRAFTED
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const displayedCustomizations = useMemo(() => {
    const getStatusPriority = (status: string) => {
      const s = String(status || '').trim();
      if (s === 'Pending') return 1;
      if (s === 'In Progress') return 2;
      if (s === 'Dispatched') return 3;
      if (s === 'Completed') return 4;
      if (s === 'Rejected') return 5;
      return 6;
    };

    let list = [...webCustomizations];

    // Apply Date Filter
    list = list.filter(cust => {
      const custDate = new Date(cust.created_at || cust.createdAt);
      if (isNaN(custDate.getTime())) return true;
      
      const now = new Date();
      if (dateFilter === 'today') {
        return custDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'month') {
        return custDate.getMonth() === now.getMonth() && custDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'year') {
        return custDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
          if (custDate < start) return false;
        }
        if (end) {
          end.setHours(23, 59, 59, 999);
          if (custDate > end) return false;
        }
      }
      return true;
    });

    // Apply Payment Method Filter
    list = list.filter(cust => {
      if (paymentFilter === 'all') return true;
      const method = String(cust.payment_method || '').toLowerCase();
      if (paymentFilter === 'cod') {
        return method === 'cod';
      }
      if (paymentFilter === 'upi') {
        return method === 'upi' || method === 'online';
      }
      return true;
    });

    // Apply Status Filter
    list = list.filter(cust => {
      if (statusFilter === 'all') return true;
      const status = String(cust.status || '').trim().toLowerCase();
      if (statusFilter === 'pending') {
        return status === 'pending' || status === 'in progress';
      }
      if (statusFilter === 'dispatched') {
        return status === 'dispatched';
      }
      if (statusFilter === 'approved') {
        return status === 'completed';
      }
      if (statusFilter === 'rejected') {
        return status === 'rejected';
      }
      return true;
    });

    return list.sort((a, b) => {
      const pA = getStatusPriority(a.status);
      const pB = getStatusPriority(b.status);
      
      const groupA = pA <= 3 ? 0 : 1;
      const groupB = pB <= 3 ? 0 : 1;
      
      if (groupA !== groupB) {
        return groupA - groupB;
      }
      
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [webCustomizations, dateFilter, startDate, endDate, paymentFilter, statusFilter]);

  const displayedReturns = useMemo(() => {
    let list = [];
    if (isConfigured && !error) {
      list = [...webOrders].filter(o => o.return_request_status && o.return_request_status !== 'None');
    } else {
      list = onlineOrders
        .filter((b: any) => b.status === 'Returned' || b.return_request_status && b.return_request_status !== 'None')
        .map((b: any) => {
          const customer = b.customer || customers.find(c => c.id === b.customerId);
          return {
            id: b.id,
            isLocalFallback: true,
            created_at: b.createdAt,
            billNumber: b.billNumber,
            final_amount: b.finalAmount,
            payment_method: (b.paymentMethod || 'ONLINE').toUpperCase(),
            status: b.status === 'completed' ? 'Customer Received' : 'Pending',
            return_request_status: b.return_request_status || 'Pending',
            customer: {
              name: customer?.name || 'Online Customer',
              phone: customer?.phone || '',
              email: customer?.email || '',
              shipping_address: customer?.address || ''
            },
            items: b.items?.map((item: any) => ({
              id: item.id,
              product_name: item.product?.name || 'Product',
              product_image: item.productImage || item.product?.images?.[0],
              quantity: item.quantity,
              price: item.unitPrice
            })) || []
          };
        });
    }

    // Apply Date Filter
    list = list.filter(order => {
      const orderDate = new Date(order.created_at || order.createdAt);
      if (isNaN(orderDate.getTime())) return true;
      
      const now = new Date();
      if (dateFilter === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) return false;
        }
        if (end) {
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }
      return true;
    });

    // Apply Payment Method Filter
    list = list.filter(order => {
      if (paymentFilter === 'all') return true;
      const method = String(order.payment_method || '').toLowerCase();
      if (paymentFilter === 'cod') {
        return method === 'cod';
      }
      if (paymentFilter === 'upi') {
        return method === 'upi' || method === 'online';
      }
      return true;
    });

    // Apply Status Filter (using return_request_status)
    list = list.filter(order => {
      if (statusFilter === 'all') return true;
      const status = String(order.return_request_status || 'Pending').toLowerCase();
      if (statusFilter === 'pending') {
        return status === 'pending';
      }
      if (statusFilter === 'approved') {
        return status === 'approved';
      }
      if (statusFilter === 'rejected') {
        return status === 'rejected';
      }
      if (statusFilter === 'dispatched') {
        return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [isConfigured, error, webOrders, onlineOrders, customers, dateFilter, startDate, endDate, paymentFilter, statusFilter]);

  const handlePrintLocalCustomLabel = async (cust: any) => {
    const settingsRaw = localStorage.getItem('app_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const storeName = settings.storeName || settings.store || 'Store';
    const storeAddress = settings.address || '';
    const storePhone = settings.phone || '';

    const customerName = cust.user_name || 'Customer';
    const customerAddress = cust.shipping_address || '';
    const customerPhone = cust.user_phone || '';

    const win = window.open('', '_blank');
    if (!win) return;

    function escapeHtml(s: any) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const paymentType = 'Prepaid';
    const barcodeValue = `CUST-${String(cust.id).padStart(6, '0')}`;
    const barcodeSvg = buildBarcodeSvg(barcodeValue, labelSize, false);
    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, { margin: 1, width: 120 });

    const size = LABEL_DIMENSIONS[labelSize] || LABEL_DIMENSIONS['4x6'];
    const layout = LABEL_LAYOUTS[labelSize] || LABEL_LAYOUTS['4x6'];

    const unitPrice = cust.quoted_price ?? (cust.product?.price || 0.0);
    const finalAmount = unitPrice * cust.quantity;

    const html = `

      <html>
        <head>
          <title>Custom Label - ${escapeHtml(barcodeValue)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            @page { size: ${size.width} ${size.height}; margin: 0; }
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; font-family: 'Inter', Arial, sans-serif; background: #fff; color: #000; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; display: flex; align-items: center; justify-content: center; }
            
            .label-container { width: 100%; height: 100%; border: 3px solid #000; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
            
            /* Grid Rows */
            .row { display: flex; width: 100%; border-bottom: 2px solid #000; }
            .row:last-child { border-bottom: none; }
            
            /* Two Column Rows */
            .col-50 { width: 50%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; gap: 2px; justify-content: flex-start; }
            .col-50:last-child { border-right: none; }
            
            /* Header Row */
            .row-header { align-items: stretch; }
            .col-logo { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 3px; }
            .logo-icon { width: calc(${layout.headingSize} * 2.2); height: calc(${layout.headingSize} * 2.2); color: #000; }
            .logo-text { font-size: calc(${layout.metaSize} - 1.5px); font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; }
            .col-title { width: 66.666%; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; font-size: calc(${layout.headingSize} + 4px); font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; }
            
            /* Labels & Contents */
            .lbl { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; color: #000; letter-spacing: 0.03em; margin-bottom: 1px; }
            .val-bold { font-size: ${layout.bodySize}; font-weight: 800; text-transform: uppercase; line-height: ${layout.lineHeight}; }
            .val-text { font-size: calc(${layout.bodySize} - 0.5px); font-weight: 500; line-height: ${layout.lineHeight}; white-space: pre-line; }
            
            /* QR & Order Info Row */
            .col-qr { width: 33.333%; border-right: 2px solid #000; padding: ${layout.padding}; display: flex; align-items: center; justify-content: center; }
            .qr-code { width: calc(${layout.bodySize} * 5.2); height: calc(${layout.bodySize} * 5.2); display: block; max-width: 100%; height: auto; }
            .col-order-info { width: 66.666%; padding: ${layout.padding}; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
            .order-info-item { display: flex; flex-direction: column; }
            
            /* Barcode Row */
            .row-barcode { flex-direction: column; align-items: center; justify-content: center; padding: ${layout.padding}; text-align: center; gap: 4px; border-bottom: 2px solid #000; }
            .barcode-title { font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            .barcode-svg-wrap { width: 100%; display: flex; justify-content: center; padding: 2px 0; }
            .barcode-svg-wrap svg { max-width: 95%; height: auto; display: block; }
            .barcode-text { font-size: calc(${layout.bodySize} + 1px); font-weight: 800; letter-spacing: 0.1em; margin-top: 1px; }
            
            /* Payment & Amount Row */
            .payment-big { font-size: calc(${layout.headingSize} * 1.8); font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-top: 2px; }
            
            /* Footer Row */
            .row-footer { padding: 4px; justify-content: center; align-items: center; text-align: center; font-size: calc(${layout.metaSize} - 1.5px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: #fafafb; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <!-- Row 1: Header -->
            <div class="row row-header">
              <div class="col-logo">
                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <div class="logo-text">${escapeHtml(storeName)}</div>
              </div>
              <div class="col-title">Shipping Label</div>
            </div>
            
            <!-- Row 2: Sender/Consignee Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">From:</span>
                <span class="val-bold">${escapeHtml(storeName)}</span>
                <span class="val-text">${escapeHtml(storeAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(storePhone)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">To:</span>
                <span class="val-bold">${escapeHtml(customerName)}</span>
                <span class="val-text">${escapeHtml(customerAddress)}</span>
                <span class="val-text" style="font-weight:700; margin-top:2px;">Phone: ${escapeHtml(customerPhone)}</span>
              </div>
            </div>
            
            <!-- Row 3: Carrier Details -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Courier Partner:</span>
                <div style="border-bottom: 1.5px dashed #000; width: 90%; height: 16px; margin-top: 4px;"></div>
              </div>
              <div class="col-50">
                <span class="lbl">Shipping Date:</span>
                <span class="val-bold">${formatDate(new Date())}</span>
              </div>
            </div>
            
            <!-- Row 4: QR & Custom Order Info -->
            <div class="row">
              <div class="col-qr">
                <img class="qr-code" src="${qrCodeDataUrl}" alt="QR" />
              </div>
              <div class="col-order-info">
                <div class="order-info-item">
                  <span class="lbl">Order Date:</span>
                  <span class="val-bold">${formatDate(cust.created_at || cust.createdAt)}</span>
                </div>
                <div class="order-info-item">
                  <span class="lbl">Order ID:</span>
                  <span class="val-bold">#CUST-${String(cust.id).padStart(6, '0')}</span>
                </div>
                <div class="order-info-item" style="border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 2px;">
                  <span class="lbl">Specs:</span>
                  <span class="val-text" style="font-size: 8px;"><strong>${escapeHtml(cust.product_name)}</strong> (Qty: ${cust.quantity})<br/>Color: ${escapeHtml(cust.selected_color_name)}<br/>Notes: ${escapeHtml(cust.customization_notes || 'None')}</span>
                </div>
              </div>
            </div>
            
            <!-- Row 5: Barcode & Tracking -->
            <div class="row-barcode" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 10px 14px; height: 75px;">
              <!-- Hidden references to avoid unused variable warnings: ${barcodeSvg} ${formatBarcodeText(barcodeValue)} -->
              <span class="barcode-title" style="margin-bottom: 12px; font-size: calc(${layout.metaSize} - 1px); font-weight: 800; text-transform: uppercase;">AWB / TRACKING NO:</span>
              <div style="border-bottom: 1.5px dashed #000; width: 100%; height: 10px;"></div>
            </div>
            
            <!-- Row 6: Payment Info -->
            <div class="row">
              <div class="col-50">
                <span class="lbl">Payment Type:</span>
                <span class="payment-big">${escapeHtml(paymentType)}</span>
              </div>
              <div class="col-50">
                <span class="lbl">Prepaid Amount:</span>
                <span class="val-big">₹${parseFloat(finalAmount.toString()).toFixed(2)}</span>
              </div>
            </div>
            
            <!-- Row 7: Footer -->
            <div class="row-footer">
              LOCAL CUSTOM WORKSHOP / SERVICE: OUTLET PICKUP
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">E-Commerce Integration</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Online Orders</h1>
          <p className="mt-2 max-w-2xl text-slate-600">View and manage orders synchronized from your online store.</p>
        </div>
      </div>

      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" /> Webhook Orders & Requests
            </h2>
            <p className="text-xs text-slate-500">Manage standard sales and custom fashion requests from your website.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-full border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setActiveTab('standard')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all ${
                  activeTab === 'standard'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setActiveTab('customization')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all ${
                  activeTab === 'customization'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Customizations
              </button>
              <button
                onClick={() => setActiveTab('returns')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all ${
                  activeTab === 'returns'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Returns
              </button>
            </div>
            {isConfigured && (
              <button 
                onClick={loadOrders}
                disabled={loading}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                title="Fetch live order statuses from website"
              >
                <RefreshCw className={`h-4 w-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Statuses</span>
              </button>
            )}
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <span>Label Size</span>
              <select
                value={labelSize}
                onChange={(e) => persistLabelSize(e.target.value)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-900 outline-none"
              >
                {LABEL_SIZES.map(size => (
                  <option key={size.value} value={size.value}>{size.label}</option>
                ))}
              </select>
            </label>
            <span className="badge bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold rounded-full">
              {activeTab === 'standard' ? displayedOrders.length : activeTab === 'customization' ? displayedCustomizations.length : displayedReturns.length} {activeTab === 'standard' ? 'Orders' : activeTab === 'customization' ? 'Customizations' : 'Returns'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <strong>Offline Mode:</strong> {error}. Showing last-synced order cache from local POS storage.
            </div>
          </div>
        )}

        {!isConfigured && !error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
            <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0" />
            <div className="flex-1">
              <strong>Configuration Notice:</strong> E-commerce API connection is not set up. Please head to settings to configure connection parameters. Displaying local order receipts.
            </div>
          </div>
        )}

        {/* Date Filter Toolbar */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter By Date:</span>
            {[
              { value: 'all', label: 'All Orders' },
              { value: 'today', label: 'Today' },
              { value: 'month', label: 'This Month' },
              { value: 'year', label: 'This Year' },
              { value: 'custom', label: 'Custom Range' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilter === opt.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Status and Payment Filter Toolbar */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter By Payment:</span>
            {[
              { value: 'all', label: 'All Payments' },
              { value: 'cod', label: 'COD' },
              { value: 'upi', label: 'UPI / Online' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPaymentFilter(opt.value as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  paymentFilter === opt.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter By Status:</span>
            {[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'dispatched', label: 'Dispatched' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === opt.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'customization' && (
          displayedCustomizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-medium text-slate-900">No customization requests yet</h3>
              <p className="text-slate-500 max-w-md mt-2">
                Custom design requests from your e-commerce platform will appear here when customers make custom orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Request ID</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Customer Details</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Product</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Customization Requirements</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Pricing / Quote</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Fulfillment Actions</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {displayedCustomizations.map((cust) => {
                    const displayId = `#CUST-${String(cust.id).padStart(6, '0')}`;
                    return (
                      <tr key={cust.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-4 font-bold text-indigo-950">
                          {displayId}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(cust.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{cust.user_name}</div>
                          <div className="text-xs text-slate-500">{cust.user_phone || cust.user_email}</div>
                          {cust.shipping_address && cust.shipping_address !== 'N/A' && (
                            <div className="text-xs text-slate-400 max-w-[200px] truncate mt-1" title={cust.shipping_address}>
                              {cust.shipping_address}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {cust.product_image ? (
                              <img 
                                src={getFullImageUrl(cust.product_image)} 
                                alt={cust.product_name} 
                                className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0 font-bold text-[10px]">
                                N/A
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-sm truncate max-w-[180px]" title={cust.product_name}>
                                {cust.product_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                Qty: {cust.quantity} • ₹{parseFloat(cust.product?.price || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {cust.selected_color_name && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-slate-500">Color:</span>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                                <span 
                                  className="h-2.5 w-2.5 rounded-full border border-black/10 shrink-0" 
                                  style={{ backgroundColor: cust.selected_color_hex || '#fff' }}
                                />
                                {cust.selected_color_name}
                              </span>
                            </div>
                          )}
                          {cust.customization_notes ? (
                            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-lg max-w-[220px] whitespace-pre-wrap">
                              {cust.customization_notes}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No notes provided</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {(!cust.quote_status || cust.quote_status === 'Pending') && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-500">₹</span>
                              <input 
                                type="number" 
                                placeholder="0.00 / pc"
                                value={quoteInputs[cust.id] || ''}
                                onChange={(e) => setQuoteInputs({ ...quoteInputs, [cust.id]: e.target.value })}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                              />
                              <button
                                onClick={() => handleSendQuote(cust.id, quoteInputs[cust.id])}
                                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                Send
                              </button>
                            </div>
                          )}
                          {cust.quote_status === 'Quoted' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-slate-900">₹{parseFloat(cust.quoted_price || 0).toFixed(2)} / pc</span>
                              <span className="text-xs text-slate-500 font-semibold">Total: ₹{parseFloat((cust.quoted_price * cust.quantity).toString()).toFixed(2)}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Awaiting Customer Response</span>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <input 
                                  type="number" 
                                  placeholder="Update / pc"
                                  value={quoteInputs[cust.id] || ''}
                                  onChange={(e) => setQuoteInputs({ ...quoteInputs, [cust.id]: e.target.value })}
                                  className="w-16 rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                                />
                                <button
                                  onClick={() => handleSendQuote(cust.id, quoteInputs[cust.id])}
                                  className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition-all"
                                >
                                  Update
                                </button>
                              </div>
                            </div>
                          )}
                          {cust.quote_status === 'Accepted' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-slate-950">₹{parseFloat(cust.quoted_price || 0).toFixed(2)} / pc</span>
                              <span className="text-xs text-emerald-600 font-bold">Total: ₹{parseFloat((cust.quoted_price * cust.quantity).toString()).toFixed(2)}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full w-max mt-1">
                                <Check className="h-3 w-3" /> Accepted
                              </span>
                            </div>
                          )}
                          {cust.quote_status === 'Rejected' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-slate-400 line-through">₹{parseFloat(cust.quoted_price || 0).toFixed(2)} / pc</span>
                              <span className="text-xs text-rose-600 font-bold line-through">Total: ₹{parseFloat((cust.quoted_price * cust.quantity).toString()).toFixed(2)}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full w-max mt-1">
                                <X className="h-3 w-3" /> Rejected
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2 min-w-[160px] align-right items-stretch">
                            {/* Pending State */}
                            {cust.status === 'Pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateCustomizationStatus(cust.id, 'In Progress')}
                                  disabled={updatingId === cust.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to reject this customization?")) {
                                      handleUpdateCustomizationStatus(cust.id, 'Rejected');
                                    }
                                  }}
                                  disabled={updatingId === cust.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                            {/* In Progress State */}
                            {cust.status === 'In Progress' && (
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleDispatchCustomOrder(cust.id)}
                                  disabled={updatingId === cust.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
                                >
                                  Dispatch Custom Order
                                </button>
                                <button
                                  onClick={() => handleBookCustomDtdcShipping(cust.id)}
                                  disabled={updatingId === cust.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Book DTDC
                                </button>
                                <button
                                  onClick={() => handleInitiateShiprocketBooking(cust.id, 'customization')}
                                  disabled={updatingId === cust.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-1.5 text-xs font-semibold text-white hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-sm"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Book Shiprocket
                                </button>
                              </div>
                            )}

                            {/* Dispatched State */}
                            {cust.status === 'Dispatched' && (
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleUpdateCustomizationStatus(cust.id, 'Completed')}
                                  disabled={updatingId === cust.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                  <Check className="h-3.5 w-3.5" /> Confirm Completed
                                </button>
                                {cust.shipping_label_url && (
                                  cust.tracking_info?.includes('Shiprocket') ? (
                                    <button
                                      onClick={() => window.open(getFullImageUrl(cust.shipping_label_url), '_blank')}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-sm"
                                    >
                                      <Printer className="h-3.5 w-3.5" /> Print Shiprocket Label
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handlePrintLocalCustomDtdcLabel(cust)}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                                    >
                                      <Printer className="h-3.5 w-3.5" /> Print DTDC Label
                                    </button>
                                  )
                                )}
                              </div>
                            )}

                            {/* Print Label Actions */}
                            <button
                              onClick={() => handlePrintLocalCustomLabel(cust)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                              <Printer className="h-3.5 w-3.5" /> Local Custom Label
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                            cust.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            cust.status === 'Dispatched' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            cust.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            cust.status === 'Rejected' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {cust.status === 'Completed' && <CheckCircle className="h-3.5 w-3.5" />}
                            {cust.status}
                          </span>
                          {cust.tracking_info && (
                            <div className="text-[10px] text-slate-500 font-medium mt-1 truncate max-w-[120px]" title={cust.tracking_info}>
                              {cust.tracking_info}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'standard' && (
          displayedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-medium text-slate-900">No online orders yet</h3>
              <p className="text-slate-500 max-w-md mt-2">
                Orders from your e-commerce platform will appear here automatically when they sync with your store.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Order ID</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Customer</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Ordered Items</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Total / Payment</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Fulfillment Actions</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map((order) => {
                    const displayOrderNumber = getDisplayOrderNumber(order);

                    return (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-4 font-bold text-indigo-950">
                          {displayOrderNumber}
                          {order.isLocalFallback && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">cached POS receipt</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(order.created_at || order.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{order.customer?.name || 'Online Customer'}</div>
                          <div className="text-xs text-slate-500">{order.customer?.phone || order.customer?.email}</div>
                          {order.customer?.shipping_address && (
                            <div className="text-xs text-slate-400 max-w-[200px] truncate mt-1" title={order.customer.shipping_address}>
                              {order.customer.shipping_address}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-3 my-1">
                            {order.items?.map((item: any) => {
                              const imageUrl = item.product_image || item.productImage;
                              return (
                                <div key={item.id} className="flex items-center gap-3">
                                  {imageUrl ? (
                                    <img 
                                      src={getFullImageUrl(imageUrl)} 
                                      alt={item.product_name} 
                                      className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0 font-bold text-[10px]">
                                      N/A
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 text-sm truncate max-w-[180px]" title={item.product_name}>
                                      {item.product_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Qty: {item.quantity} • ₹{item.price}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">₹{parseFloat(order.final_amount).toFixed(2)}</div>
                          <div className="mt-1">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                              order.payment_method?.toLowerCase() === 'cod' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {order.payment_method || 'ONLINE'}
                            </span>
                            {order.payment_method?.toLowerCase() !== 'cod' && order.razorpay_payment_id && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 select-all" title="Razorpay Payment ID">
                                {order.razorpay_payment_id}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2 min-w-[160px] align-right items-stretch">
                            {/* Accept/Reject for Pending COD */}
                            {order.status === 'Pending' && order.payment_method?.toLowerCase() === 'cod' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'Accepted')}
                                  disabled={updatingId === order.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                  <Check className="h-3 w-3" /> Accept
                                </button>
                                <button
                                  onClick={() => handleRejectOrder(order.id)}
                                  disabled={updatingId === order.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                                >
                                  <X className="h-3 w-3" /> Reject
                                </button>
                              </div>
                            )}

                            {/* Dispatch & DTDC shipment for Accepted or Prepaid Pending */}
                            {(order.status === 'Accepted' || (order.status === 'Pending' && order.payment_method?.toLowerCase() !== 'cod')) && (
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleDispatchOrder(order.id)}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
                                >
                                  Dispatch Order
                                </button>
                                <button
                                  onClick={() => handleBookDtdcShipping(order.id)}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Book DTDC
                                </button>
                                <button
                                  onClick={() => handleInitiateShiprocketBooking(order.id, 'standard')}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-1.5 text-xs font-semibold text-white hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-sm"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Book Shiprocket
                                </button>
                              </div>
                            )}

                            {/* Confirm delivery / print labels for Dispatched */}
                            {order.status === 'Dispatched' && (
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleConfirmDelivery(order.id)}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                  <Check className="h-3.5 w-3.5" /> Confirm Delivery
                                </button>
                                {order.shipping_label_url && (
                                  order.tracking_info?.includes('Shiprocket') ? (
                                    <button
                                      onClick={() => window.open(getFullImageUrl(order.shipping_label_url), '_blank')}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-sm mt-1"
                                    >
                                      <Printer className="h-3.5 w-3.5" /> Print Shiprocket Label
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handlePrintLocalDtdcLabel(order)}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                    >
                                      <Printer className="h-3.5 w-3.5" /> Print DTDC Label
                                    </button>
                                  )
                                )}
                              </div>
                            )}

                            {/* Returns workflow for Customer Received */}
                            {order.status === 'Customer Received' && order.return_request_status === 'Pending' && (
                              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2 flex flex-col gap-1.5">
                                <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
                                  <RotateCcw className="h-3 w-3" /> Return Requested
                                </div>
                                <div className="text-[10px] text-slate-600 line-clamp-2" title={order.return_reason}>
                                  Reason: "{order.return_reason}"
                                </div>
                                {order.return_image_url && (
                                  <button
                                    onClick={() => openLink(getFullImageUrl(order.return_image_url))}
                                    className="text-[10px] text-indigo-600 underline block mb-0.5 text-left bg-transparent border-none p-0 cursor-pointer"
                                  >
                                    View Proof Image
                                  </button>
                                )}
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleResolveReturn(order.id, 'Approved')}
                                    disabled={updatingId === order.id}
                                    className="flex-1 rounded bg-emerald-600 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleResolveReturn(order.id, 'Rejected')}
                                    disabled={updatingId === order.id}
                                    className="flex-1 rounded bg-rose-600 py-1 text-[10px] font-semibold text-white hover:bg-rose-700"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Standard Local Invoice Label Print */}
                            <button
                              onClick={() => handlePrintLocalLabel(order)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                              <Printer className="h-3.5 w-3.5" /> Local Invoice Label
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                            order.status === 'Customer Received' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            order.status === 'Dispatched' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            order.status === 'Accepted' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            order.status === 'Rejected' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            order.status === 'Returned' ? 'bg-red-100 text-red-800 border border-red-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {order.status === 'Customer Received' && <CheckCircle className="h-3.5 w-3.5" />}
                            {order.status}
                          </span>
                          {order.tracking_info && (
                            <div className="text-[10px] text-slate-500 font-medium mt-1 truncate max-w-[120px]" title={order.tracking_info}>
                              {order.tracking_info}
                            </div>
                          )}
                          {order.return_request_status && order.return_request_status !== 'None' && order.return_request_status !== 'Pending' && (
                            <div className={`text-[10px] font-bold mt-1 uppercase ${
                              order.return_request_status === 'Approved' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              Return {order.return_request_status}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'returns' && (
          displayedReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-medium text-slate-900">No return requests found</h3>
              <p className="text-slate-500 max-w-md mt-2">
                All customer return requests from your website will appear here for you to approve or reject.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Order ID</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Buyer</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Returned Products</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Return Reason</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Proof Image</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Refund Value</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReturns.map((order) => {
                    const displayOrderNumber = getDisplayOrderNumber(order);

                    return (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-4 font-bold text-indigo-950">
                          {displayOrderNumber}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(order.created_at || order.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{order.customer?.name || 'Online Customer'}</div>
                          <div className="text-xs text-slate-500">{order.customer?.phone || order.customer?.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-3 my-1">
                            {order.items?.map((item: any) => {
                              const imageUrl = item.product_image || item.productImage;
                              return (
                                <div key={item.id} className="flex items-center gap-3">
                                  {imageUrl ? (
                                    <img 
                                      src={getFullImageUrl(imageUrl)} 
                                      alt={item.product_name} 
                                      className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0 font-bold text-[10px]">
                                      N/A
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 text-sm truncate max-w-[180px]" title={item.product_name}>
                                      {item.product_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Qty: {item.quantity} • ₹{item.price}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {order.return_reason ? (
                            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 p-2 rounded-lg max-w-[220px] whitespace-pre-wrap">
                              {order.return_reason}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No reason provided</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {order.return_image_url ? (
                            <div className="flex flex-col gap-1.5 items-start">
                              <img 
                                src={getFullImageUrl(order.return_image_url)} 
                                alt="Proof" 
                                className="h-10 w-10 rounded-lg object-cover border border-slate-200 hover:scale-105 transition-transform cursor-pointer shadow-sm" 
                                onClick={() => openLink(getFullImageUrl(order.return_image_url))}
                                title="Click to view full image"
                              />
                              <button
                                onClick={() => openLink(getFullImageUrl(order.return_image_url))}
                                className="text-[10px] text-indigo-600 hover:underline bg-transparent border-none p-0 cursor-pointer text-left font-semibold"
                              >
                                View Proof
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Image</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">₹{parseFloat(order.final_amount).toFixed(2)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5 min-w-[120px] align-right items-stretch">
                            {order.return_request_status === 'Pending' ? (
                              <>
                                <button
                                  onClick={() => handleResolveReturn(order.id, 'Approved')}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                  <Check className="h-3.5 w-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => handleResolveReturn(order.id, 'Rejected')}
                                  disabled={updatingId === order.id}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                                >
                                  <X className="h-3.5 w-3.5" /> Reject
                                </button>
                              </>
                            ) : (
                              <span className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-full text-xs font-bold ${
                                order.return_request_status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {order.return_request_status}
                              </span>
                            )}
                            {order.shipping_label_url && (
                              order.tracking_info?.includes('Shiprocket') ? (
                                <button
                                  onClick={() => window.open(getFullImageUrl(order.shipping_label_url), '_blank')}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-sm mt-1"
                                >
                                  <Printer className="h-3.5 w-3.5" /> Print Shiprocket Label
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePrintLocalDtdcLabel(order)}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors mt-1"
                                >
                                  <Printer className="h-3.5 w-3.5" /> Print DTDC Label
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md scale-95 transform rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-2xl transition-all duration-300">
            <h3 className="text-xl font-bold text-slate-900">{modalTitle}</h3>
            <p className="mt-2 text-xs text-slate-500">
              {modalType?.startsWith('dispatch') 
                ? "Please enter the courier name and tracking details to dispatch this order."
                : "Please enter the weight of the package in kilograms to book the DTDC shipment."}
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {modalType?.startsWith('dispatch') ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Courier Name</label>
                    <input
                      type="text"
                      value={courierNameInput}
                      onChange={(e) => setCourierNameInput(e.target.value)}
                      placeholder="e.g. Delhivery, DTDC, Blue Dart"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-4 transition-all"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleModalSubmit();
                        if (e.key === 'Escape') setModalOpen(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tracking / AWB Number</label>
                    <input
                      type="text"
                      value={trackingNumberInput}
                      onChange={(e) => setTrackingNumberInput(e.target.value)}
                      placeholder="e.g. 123456789"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-4 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleModalSubmit();
                        if (e.key === 'Escape') setModalOpen(false);
                      }}
                    />
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder={modalPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-4 transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleModalSubmit();
                    if (e.key === 'Escape') setModalOpen(false);
                  }}
                />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {shiprocketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl scale-95 transform rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Select Shiprocket Courier Partner</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Compare rates and choose the best carrier for delivery.
                </p>
                {shiprocketOrderRtoRisk && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700">
                    <span className="font-semibold text-slate-500">Order RTO Risk:</span>
                    {(() => {
                      const risk = String(shiprocketOrderRtoRisk.risk).toLowerCase();
                      if (risk.includes('high')) {
                        return <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">🔴 High Risk ({Math.round(shiprocketOrderRtoRisk.score * 100)}%)</span>;
                      } else if (risk.includes('mod') || risk.includes('mid') || risk.includes('medium')) {
                        return <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">🟡 Mid Risk ({Math.round(shiprocketOrderRtoRisk.score * 100)}%)</span>;
                      } else {
                        return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">🟢 Low Risk ({Math.round(shiprocketOrderRtoRisk.score * 100)}%)</span>;
                      }
                    })()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {shiprocketWalletBalance !== null && (
                  <div className="rounded-full bg-indigo-50 border border-indigo-200 px-3.5 py-1 text-xs font-bold text-indigo-700">
                    Wallet Balance: ₹{shiprocketWalletBalance.toFixed(2)}
                  </div>
                )}
                <button 
                  onClick={() => setShiprocketModalOpen(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-end gap-3 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Package Weight (KG)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={shiprocketWeight}
                  onChange={(e) => setShiprocketWeight(e.target.value)}
                  placeholder="e.g. 0.5"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-4 transition-all"
                />
              </div>
              <button
                onClick={() => {
                  const wt = parseFloat(shiprocketWeight) || 0.5;
                  if (shiprocketTargetId && shiprocketTargetType) {
                    fetchShiprocketCourierRates(shiprocketTargetId, shiprocketTargetType, wt);
                  }
                }}
                disabled={shiprocketLoading}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-all shadow-md shrink-0 flex items-center justify-center gap-2 hover:bg-slate-800/95"
              >
                <RefreshCw className={`h-4 w-4 ${shiprocketLoading ? 'animate-spin' : ''}`} />
                <span>Fetch Rates</span>
              </button>
            </div>

            {shiprocketError && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <div className="flex-1">
                  <strong>Error:</strong> {shiprocketError}
                </div>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto min-h-[200px] border border-slate-100 rounded-2xl">
              {shiprocketLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Fetching available couriers and live rates...</p>
                </div>
              ) : sortedCouriers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No couriers available. Enter weight and click Fetch Rates.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 sticky top-0">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Courier</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">RTO Risk</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Rate</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Pickup</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ETD</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCouriers.map((courier, index) => {
                      const charge = courier.rate ?? 0;
                      return (
                        <tr key={courier.courier_company_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{courier.courier_name}</span>
                              {index === 0 && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Cheapest
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">ID: {courier.courier_company_id} • Min Wt: {courier.min_weight}kg</div>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const score = courier.rto_performance;
                              if (score === undefined || score === null || score === '') {
                                return <span className="text-xs text-slate-400 font-semibold">N/A</span>;
                              }
                              const perf = Number(score);
                              if (isNaN(perf)) {
                                return <span className="text-xs text-slate-700 font-semibold">{score}</span>;
                              }
                              if (perf >= 4) {
                                return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-200/50">🟢 Low ({perf}/5)</span>;
                              } else if (perf === 3) {
                                return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-200/50">🟡 Mid ({perf}/5)</span>;
                              } else {
                                return <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded border border-rose-200/50">🔴 High ({perf}/5)</span>;
                              }
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">₹{parseFloat(charge).toFixed(2)}</div>
                            {courier.cod_charges > 0 && (
                              <div className="text-[10px] text-amber-600 font-medium">Incl. COD Charge: ₹{courier.cod_charges}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">
                            {(() => {
                              if (courier.suppress_date) {
                                return courier.suppress_date;
                              }
                              if (courier.etd) {
                                const etdDate = new Date(courier.etd);
                                if (!isNaN(etdDate.getTime())) {
                                  const days = parseInt(courier.estimated_delivery_days) || 0;
                                  if (days > 0) {
                                    const calculatedPickup = new Date(etdDate.getTime() - days * 24 * 60 * 60 * 1000);
                                    const today = new Date();
                                    const earliestPickup = new Date();
                                    if (today.getHours() >= 14) {
                                      earliestPickup.setDate(today.getDate() + 1);
                                    }
                                    earliestPickup.setHours(0, 0, 0, 0);
                                    calculatedPickup.setHours(0, 0, 0, 0);
                                    
                                    const finalPickup = calculatedPickup < earliestPickup ? earliestPickup : calculatedPickup;
                                    return finalPickup.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    });
                                  }
                                }
                              }
                              const today = new Date();
                              if (today.getHours() >= 14) {
                                today.setDate(today.getDate() + 1);
                              }
                              return today.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-700">{courier.etd || 'N/A'}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleBookShiprocketCourier(courier.courier_company_id)}
                              disabled={shiprocketLoading}
                              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-sm"
                            >
                              Book Partner
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShiprocketModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
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

export default OnlineOrders;
