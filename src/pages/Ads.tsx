import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Megaphone,
  Search,
  Image as ImageIcon,
  Send,
  Trash2,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Square,
  MessageSquare
} from 'lucide-react';
import { useCustomers } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { getStoreSettings } from '../utils/getStoreSettings';

interface CustomerLog {
  id: number;
  name: string;
  phone: string;
  status: 'pending' | 'sending' | 'success' | 'failed';
  error?: string;
}

export default function Ads() {
  const { activeBranchId, branches } = useAuth();
  const { customers, loading: customersLoading } = useCustomers(activeBranchId);
  const storeSettings = useMemo(() => getStoreSettings(activeBranchId, branches, activeBranchId), [activeBranchId, branches]);

  // WhatsApp connection state
  const [waStatus, setWaStatus] = useState<'connected' | 'disconnected' | 'qr_ready' | 'connecting'>('disconnected');

  // Search & selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());

  // Message composition state
  const [messageText, setMessageText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);

  // Campaign sending state
  const [isSending, setIsSending] = useState(false);
  const [campaignLogs, setCampaignLogs] = useState<CustomerLog[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const cancelRef = useRef(false);

  // Fetch WhatsApp status on mount
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api || !api.getWhatsAppStatus) return;

    api.getWhatsAppStatus().then((res: any) => {
      if (res) {
        setWaStatus(res.status || 'disconnected');
      }
    });

    if (api.onWhatsAppStatus) {
      api.onWhatsAppStatus((data: any) => {
        setWaStatus(data.status || 'disconnected');
      });
    }
  }, []);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.address && c.address.toLowerCase().includes(query))
      );
    });
  }, [customers, searchQuery]);

  // Select all toggle
  const isAllSelected = useMemo(() => {
    if (filteredCustomers.length === 0) return false;
    return filteredCustomers.every(c => selectedCustomerIds.has(c.id));
  }, [filteredCustomers, selectedCustomerIds]);

  const handleSelectAllToggle = () => {
    const newSelected = new Set(selectedCustomerIds);
    if (isAllSelected) {
      // Deselect all in filtered list
      filteredCustomers.forEach(c => newSelected.delete(c.id));
    } else {
      // Select all in filtered list
      filteredCustomers.forEach(c => newSelected.add(c.id));
    }
    setSelectedCustomerIds(newSelected);
  };

  const handleCustomerToggle = (id: number) => {
    const newSelected = new Set(selectedCustomerIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCustomerIds(newSelected);
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAttachedImage({
          base64: event.target.result as string,
          mimeType: file.type,
          fileName: file.name
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Preset Message Templates
  const presets = [
    {
      title: '🌸 Festive Wishes',
      text: `Dear {customer_name},\n\nMay this festive season fill your life with happiness, good health, and success! We value your trust and support.\n\nWarm regards,\n{store_name}`
    },
    {
      title: '⚡ New EV Launch',
      text: `Hello {customer_name},\n\nWe have exciting news! New models of electric two-wheelers have just arrived at our showroom! 🛵⚡\n\nVisit us today for a free test drive and enjoy exclusive early-bird benefits.\n\nBest regards,\n{store_name}`
    },
    {
      title: '🛠️ Service Special',
      text: `Dear {customer_name},\n\nIs your vehicle due for servicing? Keep your ride running smoothly! Book your service with our authorized workshop this week and get a flat 10% discount on labor charges.\n\nContact us: {store_phone}\n{store_name}`
    }
  ];

  const applyPreset = (presetText: string) => {
    if (messageText && !confirm('This will replace your current message content. Do you want to proceed?')) {
      return;
    }
    setMessageText(presetText);
  };

  // Send campaign implementation
  const startCampaign = async () => {
    if (selectedCustomerIds.size === 0) {
      alert('Please select at least one customer.');
      return;
    }
    if (!messageText.trim() && !attachedImage) {
      alert('Please compose a message or attach an image.');
      return;
    }

    const api = (window as any).electronAPI;
    if (!api || !api.sendWhatsAppAds) {
      alert('WhatsApp messaging campaigns are only supported on the Desktop App.');
      return;
    }

    if (waStatus !== 'connected') {
      alert('Your WhatsApp account is not connected. Please pair your account in Settings first.');
      return;
    }

    const selectedCustomers = (customers || []).filter(c => selectedCustomerIds.has(c.id));
    
    // Initialize logs
    const initialLogs = selectedCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      status: 'pending' as const
    }));
    
    setCampaignLogs(initialLogs);
    setIsSending(true);
    setCurrentSendIndex(0);
    cancelRef.current = false;

    // Run send loop with delayed timer to avoid WhatsApp spam bans
    for (let i = 0; i < selectedCustomers.length; i++) {
      if (cancelRef.current) {
        break;
      }
      
      const customer = selectedCustomers[i];
      setCurrentSendIndex(i);
      
      setCampaignLogs(prev =>
        prev.map((log, idx) => (idx === i ? { ...log, status: 'sending' } : log))
      );

      // Customize templates tokens dynamically
      const customizedText = messageText
        .replace(/{customer_name}/g, customer.name)
        .replace(/{store_name}/g, storeSettings.storeName)
        .replace(/{store_phone}/g, storeSettings.phone || '');

      try {
        await api.sendWhatsAppAds({
          phone: customer.phone,
          text: customizedText,
          imageBase64: attachedImage?.base64 || null,
          imageMimeType: attachedImage?.mimeType || null,
          imageFileName: attachedImage?.fileName || null
        });

        setCampaignLogs(prev =>
          prev.map((log, idx) => (idx === i ? { ...log, status: 'success' } : log))
        );
      } catch (err: any) {
        setCampaignLogs(prev =>
          prev.map((log, idx) => (idx === i ? { ...log, status: 'failed', error: err.message || String(err) } : log))
        );
      }

      // 2 seconds cooldown between messages
      await new Promise(r => setTimeout(r, 2000));
    }

    setIsSending(false);
    if (!cancelRef.current) {
      alert('Campaign completed successfully!');
    }
  };

  const cancelCampaign = () => {
    cancelRef.current = true;
    setIsSending(false);
    alert('Campaign paused.');
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Marketing & Outreach</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Megaphone className="h-9 w-9 text-primary-600" />
            ADS Campaign Manager
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 text-sm">
            Send warm wishes, holiday greetings, offers, or announcements to your customers with custom text and image attachments using WhatsApp.
          </p>
        </div>
        
        {/* WhatsApp Connection status indicator */}
        <div className="shrink-0">
          {waStatus === 'connected' ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              WhatsApp Connected
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 border border-rose-200 shadow-sm animate-pulse">
              <AlertCircle className="w-4 h-4" />
              WhatsApp Disconnected
            </div>
          )}
        </div>
      </div>

      {waStatus !== 'connected' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">WhatsApp Connection Required</p>
            <p className="text-xs text-amber-800 mt-1">
              You must pair your WhatsApp account to send campaigns. Please navigate to the **Settings** panel and link your account under WhatsApp Web Automation.
            </p>
          </div>
        </div>
      )}

      {/* Main Campaign Builder Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Customers List Selection (5 cols) */}
        <div className="lg:col-span-5 card border border-white/60 bg-white/85 shadow-soft p-5 h-[650px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-500" />
              Select Targets
            </h2>
            <span className="badge bg-primary/10 text-primary-800 font-bold text-[10px]">
              {selectedCustomerIds.size} Selected
            </span>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, address..."
              className="input pl-9 w-full text-xs"
            />
          </div>

          {/* Select all bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl mb-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAllToggle}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Select All Filtered ({filteredCustomers.length})
            </label>
          </div>

          {/* Customers Scrollable List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
            {customersLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                <span className="text-xs text-slate-400">Loading customers...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No matching customers found.
              </div>
            ) : (
              filteredCustomers.map(customer => {
                const isSelected = selectedCustomerIds.has(customer.id);
                return (
                  <div
                    key={customer.id}
                    onClick={() => handleCustomerToggle(customer.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-50/55 border-primary-200/80 hover:bg-primary-50/70 shadow-sm'
                        : 'bg-white border-slate-200/60 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-xs truncate">{customer.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium tracking-wide">{customer.phone}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message & Media Composer (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Quick presets */}
          <div className="card border border-white/60 bg-white/85 shadow-soft p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Quick Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(p.text)}
                  className="p-3 text-left bg-slate-50 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/10 rounded-xl transition-all group"
                  title="Click to apply"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-primary-700">{p.title}</p>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {p.text.replace(/{customer_name}/g, 'Customer').replace(/{store_name}/g, storeSettings.storeName)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="card border border-white/60 bg-white/85 shadow-soft p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              Compose Message
            </h2>

            {/* Custom variable helper hints */}
            <div className="flex flex-wrap gap-2 py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600">
              <span className="text-slate-400 mr-1 self-center">Double-click to insert:</span>
              <button
                type="button"
                onClick={() => setMessageText(prev => prev + ' {customer_name}')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 shadow-sm transition-colors"
                title="Inserts individual customer name"
              >
                {'{customer_name}'}
              </button>
              <button
                type="button"
                onClick={() => setMessageText(prev => prev + ' {store_name}')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 shadow-sm transition-colors"
                title="Inserts active store branch name"
              >
                {'{store_name}'}
              </button>
              <button
                type="button"
                onClick={() => setMessageText(prev => prev + ' {store_phone}')}
                className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 shadow-sm transition-colors"
                title="Inserts active store phone number"
              >
                {'{store_phone}'}
              </button>
            </div>

            {/* Textarea */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Message Content</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type or paste greetings content here. Use fields above to personalize."
                className="input w-full h-44 py-3 leading-relaxed text-xs"
              />
            </div>

            {/* Media Upload Area */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attached Banner / Image</label>
              {attachedImage ? (
                <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center p-4">
                  <div className="relative group max-h-56 overflow-hidden rounded-xl border border-slate-150 shadow-sm bg-white">
                    <img
                      src={attachedImage.base64}
                      alt="Campaign attachment preview"
                      className="max-h-48 max-w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setAttachedImage(null)}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2.5 shadow-md transform hover:scale-105 transition-all"
                        title="Remove attached image"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-350 hover:border-primary-400/80 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-primary-50/5 transition-all cursor-pointer group">
                  <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-primary-500 mb-2 transition-transform duration-200 group-hover:scale-105" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-primary-800">Choose Image File</span>
                  <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, or WEBP up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Send Campaign Button */}
            <button
              onClick={startCampaign}
              disabled={isSending || waStatus !== 'connected' || selectedCustomerIds.size === 0 || (!messageText.trim() && !attachedImage)}
              className="btn btn-primary w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
            >
              <Send className="w-4 h-4" />
              Send Wishes to {selectedCustomerIds.size} Customers
            </button>
          </div>
        </div>
      </div>

      {/* Sending Progress Overlay */}
      {isSending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="card border border-white/60 bg-white shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                Sending Broadcast Campaign
              </h3>
              <button
                onClick={cancelCampaign}
                className="btn btn-secondary px-3 py-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 font-bold flex items-center gap-1"
              >
                <Square className="w-3.5 h-3.5" />
                Pause
              </button>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Transmitting messages...</span>
                <span>{currentSendIndex + 1} / {campaignLogs.length}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((currentSendIndex + 1) / campaignLogs.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Live activity log */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <div className="px-3 py-2 border-b bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Transmission Logs
              </div>
              <div className="h-56 overflow-y-auto p-3 space-y-2 text-xs no-scrollbar">
                {campaignLogs.slice(0, currentSendIndex + 1).reverse().map(log => (
                  <div key={log.id} className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{log.name} ({log.phone})</span>
                    <span>
                      {log.status === 'pending' && <span className="text-slate-400 font-bold">Pending</span>}
                      {log.status === 'sending' && <span className="text-blue-500 font-bold animate-pulse">Sending...</span>}
                      {log.status === 'success' && <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sent</span>}
                      {log.status === 'failed' && <span className="text-red-500 font-bold flex items-center gap-1" title={log.error}><AlertCircle className="w-3.5 h-3.5" /> Failed</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
