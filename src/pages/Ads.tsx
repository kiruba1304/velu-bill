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
  MessageSquare,
  File,
  Video,
  Music,
  History
} from 'lucide-react';
import { useCustomers, useDatabase } from '../hooks/useDatabase';
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

  const db = useDatabase();
  const [targetType, setTargetType] = useState<'customers' | 'employees'>('customers');
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const list = await db.getUsers();
      const branchEmployees = (list || []).filter((u: any) => {
        if (activeBranchId === 0) return true;
        return Number(u.branchId) === Number(activeBranchId);
      });
      setEmployees(branchEmployees);
    } catch (err) {
      console.error('Failed to load employees for ADS:', err);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [activeBranchId]);

  // WhatsApp connection state
  const [waStatus, setWaStatus] = useState<'connected' | 'disconnected' | 'qr_ready' | 'connecting'>('disconnected');

  // Search & selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());

  // Message composition state
  const [messageText, setMessageText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    base64: string;
    mimeType: string;
    fileName: string;
  }>>([]);

  // Campaign sending state
  const [isSending, setIsSending] = useState(false);
  const [campaignLogs, setCampaignLogs] = useState<CustomerLog[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const cancelRef = useRef(false);

  // Tab and persistent log history state
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');

  // Fetch templates from database
  const fetchTemplates = async () => {
    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;
    setTemplatesLoading(true);
    try {
      const result = await api.dbCall('getCampaignTemplates', activeBranchId);
      if (result) {
        setTemplates(result);
      }
    } catch (err) {
      console.error('Failed to fetch campaign templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateTitle.trim()) {
      alert('Please enter a template title.');
      return;
    }
    if (!messageText.trim()) {
      alert('Please compose a message first.');
      return;
    }

    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;

    try {
      const newId = await api.dbCall('createCampaignTemplate', {
        title: newTemplateTitle.trim(),
        templateText: messageText.trim(),
        branchId: activeBranchId
      });
      if (newId) {
        alert('Template saved successfully!');
        setNewTemplateTitle('');
        setIsTemplateModalOpen(false);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      alert('Error saving template.');
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;

    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;

    try {
      const success = await api.dbCall('deleteCampaignTemplate', id);
      if (success) {
        setTemplates(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Error deleting template.');
    }
  };

  // Fetch templates when entering builder or active branch changes
  useEffect(() => {
    fetchTemplates();
  }, [activeBranchId]);

  // Fetch logs from database
  const fetchDbLogs = async () => {
    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;
    setLogsLoading(true);
    try {
      const result = await api.dbCall('getCampaignLogs', activeBranchId);
      if (result) {
        setDbLogs(result);
      }
    } catch (err) {
      console.error('Failed to fetch campaign logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;
    if (!confirm('Are you sure you want to delete this log entry?')) return;

    try {
      const success = await api.dbCall('deleteCampaignLog', id);
      if (success) {
        setDbLogs(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete log entry:', err);
      alert('Error deleting log entry');
    }
  };

  const handleClearAllLogs = async () => {
    const api = (window as any).electronAPI;
    if (!api || !api.dbCall) return;
    if (!confirm('Are you sure you want to delete ALL transmission history? This action cannot be undone.')) return;

    try {
      const success = await api.dbCall('clearCampaignLogs', activeBranchId);
      if (success) {
        setDbLogs([]);
      }
    } catch (err) {
      console.error('Failed to clear log history:', err);
      alert('Error clearing log history');
    }
  };

  // Fetch DB logs when entering history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchDbLogs();
    }
  }, [activeTab, activeBranchId]);

  // Compute log stats
  const stats = useMemo(() => {
    const total = dbLogs.length;
    const success = dbLogs.filter(l => l.status === 'success').length;
    const failed = dbLogs.filter(l => l.status === 'failed').length;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, failed, rate };
  }, [dbLogs]);

  // Filtered DB logs
  const filteredDbLogs = useMemo(() => {
    return dbLogs.filter(l => {
      const q = logsSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        l.customerName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.messageText && l.messageText.toLowerCase().includes(q))
      );
    });
  }, [dbLogs, logsSearchQuery]);

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

  // Filtered target list
  const filteredTargets = useMemo(() => {
    if (targetType === 'customers') {
      return (customers || []).filter(c => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.address && c.address.toLowerCase().includes(query))
        );
      });
    } else {
      return (employees || []).filter(u => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          u.name.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          (u.phone && u.phone.includes(query))
        );
      });
    }
  }, [targetType, customers, employees, searchQuery]);

  // Select all toggle
  const isAllSelected = useMemo(() => {
    if (filteredTargets.length === 0) return false;
    return filteredTargets.every(t => selectedCustomerIds.has(t.id));
  }, [filteredTargets, selectedCustomerIds]);

  const handleSelectAllToggle = () => {
    const newSelected = new Set(selectedCustomerIds);
    if (isAllSelected) {
      // Deselect all in filtered list
      filteredTargets.forEach(t => newSelected.delete(t.id));
    } else {
      // Select all in filtered list
      filteredTargets.forEach(t => newSelected.add(t.id));
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

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFilesPromises = Array.from(files).map((file) => {
      return new Promise<{ base64: string; mimeType: string; fileName: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve({
              base64: event.target.result as string,
              mimeType: file.type || 'application/octet-stream',
              fileName: file.name
            });
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('File reading error'));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newFilesPromises)
      .then((uploadedFiles) => {
        setAttachedFiles(prev => [...prev, ...uploadedFiles]);
      })
      .catch((err) => {
        console.error(err);
        alert('Error uploading files');
      });
  };

  // Helper to render preview icon or thumbnail based on MIME type
  const renderFilePreview = (file: { base64: string; mimeType: string; fileName: string }) => {
    if (file.mimeType.startsWith('image/')) {
      return (
        <img
          src={file.base64}
          alt={file.fileName}
          className="h-10 w-10 object-cover rounded-lg border border-slate-200"
        />
      );
    } else if (file.mimeType.startsWith('video/')) {
      return (
        <div className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 animate-in fade-in zoom-in-75">
          <Video className="w-5 h-5" />
        </div>
      );
    } else if (file.mimeType.startsWith('audio/')) {
      return (
        <div className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 animate-in fade-in zoom-in-75">
          <Music className="w-5 h-5" />
        </div>
      );
    } else {
      return (
        <div className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 animate-in fade-in zoom-in-75">
          <File className="w-5 h-5" />
        </div>
      );
    }
  };

  // Preset templates are now loaded dynamically from the database.

  const applyPreset = (presetText: string) => {
    if (messageText && !confirm('This will replace your current message content. Do you want to proceed?')) {
      return;
    }
    setMessageText(presetText);
  };

  // Send campaign implementation
  const startCampaign = async () => {
    const selectedTargets = targetType === 'customers'
      ? (customers || []).filter(c => selectedCustomerIds.has(c.id))
      : (employees || []).filter(u => selectedCustomerIds.has(u.id));

    if (selectedTargets.length === 0) {
      alert(`Please select at least one ${targetType === 'customers' ? 'customer' : 'employee'}.`);
      return;
    }
    if (!messageText.trim() && attachedFiles.length === 0) {
      alert('Please compose a message or attach files.');
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
    
    // Initialize logs
    const initialLogs = selectedTargets.map(t => ({
      id: t.id,
      name: t.name,
      phone: t.phone || '',
      status: 'pending' as const
    }));
    
    setCampaignLogs(initialLogs);
    setIsSending(true);
    setCurrentSendIndex(0);
    cancelRef.current = false;

    // Run send loop with delayed timer to avoid WhatsApp spam bans
    for (let i = 0; i < selectedTargets.length; i++) {
      if (cancelRef.current) {
        break;
      }
      
      const target = selectedTargets[i];
      setCurrentSendIndex(i);
      
      setCampaignLogs(prev =>
        prev.map((log, idx) => (idx === i ? { ...log, status: 'sending' } : log))
      );

      // Customize templates tokens dynamically
      const customizedText = messageText
        .replace(/{customer_name}/g, target.name)
        .replace(/{store_name}/g, storeSettings.storeName)
        .replace(/{store_phone}/g, storeSettings.phone || '');

      let sendStatus: 'success' | 'failed' = 'success';
      let sendError: string | null = null;

      if (!target.phone) {
        sendStatus = 'failed';
        sendError = 'No phone number registered';
        setCampaignLogs(prev =>
          prev.map((log, idx) => (idx === i ? { ...log, status: 'failed', error: 'No phone number registered' } : log))
        );
      } else {
        try {
          await api.sendWhatsAppAds({
            phone: target.phone,
            text: customizedText,
            files: attachedFiles.length > 0 ? attachedFiles : null
          });

          setCampaignLogs(prev =>
            prev.map((log, idx) => (idx === i ? { ...log, status: 'success' } : log))
          );
        } catch (err: any) {
          sendStatus = 'failed';
          sendError = err.message || String(err);
          setCampaignLogs(prev =>
            prev.map((log, idx) => (idx === i ? { ...log, status: 'failed', error: err.message || String(err) } : log))
          );
        }
      }

      // Save transmission log entry to database
      try {
        await api.dbCall('createCampaignLog', {
          customerName: target.name,
          phone: target.phone || 'N/A',
          messageText: customizedText,
          attachments: attachedFiles.map(f => ({ fileName: f.fileName, mimeType: f.mimeType })),
          status: sendStatus,
          error: sendError,
          branchId: activeBranchId
        });
      } catch (dbErr) {
        console.error('Failed to save campaign log to DB:', dbErr);
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
      <div className="mb-6 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('builder')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all mr-6 flex items-center gap-2 ${
            activeTab === 'builder'
              ? 'border-primary-600 text-primary-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Campaign Builder
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-primary-600 text-primary-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Transmission History
        </button>
      </div>

      {activeTab === 'builder' ? (
        /* Main Campaign Builder Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
          
          {/* Left Column: Targets List Selection (5 cols) */}
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

            {/* Target Type Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => {
                  setTargetType('customers');
                  setSelectedCustomerIds(new Set());
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  targetType === 'customers'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Customers
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('employees');
                  setSelectedCustomerIds(new Set());
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  targetType === 'employees'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Employees
              </button>
            </div>

            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={targetType === 'customers' ? "Search by name, phone, address..." : "Search by name, username, phone..."}
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
                Select All Filtered ({filteredTargets.length})
              </label>
            </div>

            {/* Targets Scrollable List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
              {targetType === 'customers' && customersLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                  <span className="text-xs text-slate-400">Loading customers...</span>
                </div>
              ) : targetType === 'employees' && employeesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                  <span className="text-xs text-slate-400">Loading employees...</span>
                </div>
              ) : filteredTargets.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No matching {targetType === 'customers' ? 'customers' : 'employees'} found.
                </div>
              ) : (
                filteredTargets.map(target => {
                  const isSelected = selectedCustomerIds.has(target.id);
                  return (
                    <div
                      key={target.id}
                      onClick={() => handleCustomerToggle(target.id)}
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
                        <p className="font-semibold text-slate-900 text-xs truncate">{target.name || target.username}</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                          {target.phone || <span className="text-rose-500 italic">No phone registered</span>}
                        </p>
                      </div>
                      {targetType === 'employees' && (
                        <span className="shrink-0 badge bg-slate-100 text-slate-700 capitalize text-[9px]">
                          {target.role === 'sub_admin' ? 'Sub Admin' : target.role}
                        </span>
                      )}
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
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Quick Templates
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[170px] overflow-y-auto pr-1 no-scrollbar">
                {templatesLoading ? (
                  <div className="col-span-full py-4 text-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="col-span-full py-4 text-center text-xs text-slate-400">
                    No templates saved yet. Type a message below and click "Save as Template" to create one.
                  </div>
                ) : (
                  templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => applyPreset(t.templateText)}
                      className="p-3 text-left bg-slate-50 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/10 rounded-xl transition-all group relative cursor-pointer flex flex-col justify-between min-h-[80px]"
                      title="Click to apply template"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-bold text-slate-800 group-hover:text-primary-700 truncate pr-4">{t.title}</p>
                          <button
                            onClick={(e) => handleDeleteTemplate(e, t.id)}
                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100/80 rounded-md transition-all shrink-0"
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {t.templateText.replace(/{customer_name}/g, 'Customer').replace(/{store_name}/g, storeSettings.storeName)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message Content</label>
                  {messageText.trim() && (
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="text-[10px] font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                      Save as Template
                    </button>
                  )}
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type or paste greetings content here. Use fields above to personalize."
                  className="input w-full h-44 py-3 leading-relaxed text-xs"
                />
              </div>

              {/* Media Upload Area */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attached Files</label>
                
                {attachedFiles.length > 0 && (
                  <div className="mb-3 grid grid-cols-1 gap-2 border border-slate-200 rounded-2xl p-3 bg-slate-50 max-h-60 overflow-y-auto no-scrollbar">
                    {attachedFiles.map((file, fileIdx) => (
                      <div key={fileIdx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-150 shadow-sm relative group animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {renderFilePreview(file)}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate" title={file.fileName}>{file.fileName}</p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{file.mimeType.split('/')[0]} File</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== fileIdx))}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="border-2 border-dashed border-slate-350 hover:border-primary-400/80 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-primary-50/5 transition-all cursor-pointer group">
                  <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-primary-500 mb-2 transition-transform duration-200 group-hover:scale-105" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-primary-800">Choose Files</span>
                  <span className="text-[10px] text-slate-400 mt-1">Select one or more images, audio, video, or documents</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Send Campaign Button */}
              <button
                onClick={startCampaign}
                disabled={isSending || waStatus !== 'connected' || selectedCustomerIds.size === 0 || (!messageText.trim() && attachedFiles.length === 0)}
                className="btn btn-primary w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
              >
                <Send className="w-4 h-4" />
                Send Wishes to {selectedCustomerIds.size} Customers
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Campaign Transmission History Layout */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 border border-white/60 bg-white/85 shadow-soft rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sent</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
            </div>
            <div className="card p-5 border border-emerald-100 bg-emerald-50/20 shadow-soft rounded-2xl">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Delivered (Success)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.success}</p>
            </div>
            <div className="card p-5 border border-rose-100 bg-rose-50/20 shadow-soft rounded-2xl">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Failed</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{stats.failed}</p>
            </div>
            <div className="card p-5 border border-primary-100 bg-primary-50/20 shadow-soft rounded-2xl">
              <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">Delivery Rate</p>
              <p className="text-2xl font-bold text-primary-700 mt-1">{stats.rate}%</p>
            </div>
          </div>

          <div className="card border border-white/60 bg-white/85 shadow-soft p-5 space-y-4">
            {/* Search and wipe header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={logsSearchQuery}
                  onChange={(e) => setLogsSearchQuery(e.target.value)}
                  placeholder="Search history by name, phone, or message content..."
                  className="input pl-9 w-full text-xs"
                />
              </div>
              {dbLogs.length > 0 && (
                <button
                  onClick={handleClearAllLogs}
                  className="btn btn-secondary text-xs text-red-600 border-red-200 hover:bg-red-50 py-2.5 px-4 rounded-xl flex items-center gap-1.5 font-bold shadow-sm shrink-0 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear History
                </button>
              )}
            </div>

            {/* Logs Table */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Customer</th>
                      <th className="p-4">Message</th>
                      <th className="p-4">Attachments</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Sent At</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {logsLoading ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-2" />
                          Loading transmission log history...
                        </td>
                      </tr>
                    ) : filteredDbLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400">
                          No transmission history logs found.
                        </td>
                      </tr>
                    ) : (
                      filteredDbLogs.map(log => {
                        const files = log.attachments || [];
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-slate-800">{log.customerName}</p>
                              <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">{log.phone}</p>
                            </td>
                            <td className="p-4 max-w-xs sm:max-w-md">
                              <p className="truncate text-slate-600" title={log.messageText}>
                                {log.messageText || <span className="text-slate-400 italic">No text content</span>}
                              </p>
                            </td>
                            <td className="p-4">
                              {files.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-200">
                                  <File className="w-3 h-3" />
                                  {files.length} {files.length === 1 ? 'file' : 'files'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="p-4">
                              {log.status === 'success' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Success
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 border border-rose-100 cursor-help"
                                  title={log.error || 'Unknown error'}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-slate-500 font-medium">
                              {new Date(log.sentAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg transition-all"
                                title="Delete log"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Save Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="card border border-white/60 bg-white shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500 animate-pulse" />
                Save as Quick Template
              </h3>
              <button
                onClick={() => {
                  setIsTemplateModalOpen(false);
                  setNewTemplateTitle('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Template Title</label>
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="e.g. Festival Offer, Clearance Sale..."
                  className="input w-full text-xs"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Preview Content</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 max-h-36 overflow-y-auto no-scrollbar whitespace-pre-wrap leading-relaxed">
                  {messageText}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveTemplate}
              className="btn btn-primary w-full py-2.5 rounded-xl text-xs font-bold"
            >
              Save Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
