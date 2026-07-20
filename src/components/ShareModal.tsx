import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Share as CapacitorShare } from '@capacitor/share';
import { X, Copy, Mail, Share2, Check, FileText, FolderOpen, Download } from 'lucide-react';
import { Bill } from '../types';
import { downloadInvoicePdf } from '../utils/downloadInvoicePdf';
import { getStoreSettings } from '../utils/getStoreSettings';
import { generateWhatsAppMessage } from '../utils/generateWhatsAppMessage';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useDatabase';

interface ShareModalProps {
  bill: Bill | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ bill, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  const { activeBranchId, branches } = useAuth();
  const { products } = useProducts();

  if (!bill) return null;

  const customerName = bill.customer?.name || 'Walk-in Customer';
  const customerPhone = bill.customer?.phone || '';
  const customerEmail = bill.customer?.email || '';

  const storeSettings = getStoreSettings(bill.branchId, branches, activeBranchId);
  const storeName = storeSettings.storeName;

  const { text: formattedMessageText } = generateWhatsAppMessage(bill, branches, activeBranchId, products);

  const generateWhatsAppLink = () => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(formattedMessageText)}`;
  };

  const generateEmailLink = () => {
    const subject = `Invoice ${bill.billNumber} from ${storeName}`;
    return `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formattedMessageText)}`;
  };

  const generateClipboardText = () => {
    return formattedMessageText;
  };

  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    handleShareClick();
    const api = (window as any).electronAPI;
    if (api && api.sendWhatsAppAuto && customerPhone) {
      try {
        setTipMessage('Sending WhatsApp message & PDF in background...');
        await api.sendWhatsAppAuto(customerPhone, formattedMessageText, bill.billNumber, customerName);
        setTipMessage('✅ Sent automatically via WhatsApp!');
        setTimeout(() => setTipMessage(''), 3000);
        e.preventDefault();
        return;
      } catch (err: any) {
        console.log('Auto WA send fallback:', err?.message || String(err));
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateClipboardText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    const textData = generateClipboardText();

    // 1. Android APK or native mobile platform using Capacitor Share plugin
    if (Capacitor.getPlatform() === 'android' || Capacitor.isNativePlatform()) {
      try {
        await CapacitorShare.share({
          title: `Invoice ${bill.billNumber} - ${storeName}`,
          text: textData,
          dialogTitle: 'Share Invoice'
        });
        return;
      } catch (err) {
        console.log('Capacitor share canceled or failed:', err);
      }
    }

    // 2. Web browser navigator.share fallback
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${bill.billNumber} - ${storeName}`,
          text: textData,
        });
        return;
      } catch (err) {
        console.log('Web share canceled or failed:', err);
      }
    }

    // 3. Desktop / Windows fallback: Copy text to clipboard and display tip
    try {
      await navigator.clipboard.writeText(textData);
      setCopied(true);
      setTipMessage('📋 Invoice text copied to clipboard! You can paste (Ctrl + V) into any application.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert('Invoice text copied to clipboard.');
    }
  };

  const handleShowInFolder = () => {
    const api = (window as any).electronAPI;
    if (api?.showFileInFolder) {
      api.showFileInFolder(bill.billNumber, customerName);
      setTipMessage("💡 Opened folder containing the PDF. You can drag and drop it into WhatsApp/Email to attach.");
    }
  };

  const handleViewPdf = () => {
    const api = (window as any).electronAPI;
    if (api?.openFile) {
      api.openFile(bill.billNumber, customerName);
    }
  };

  const handleShareClick = () => {
    const api = (window as any).electronAPI;
    if (api?.copyFileToClipboard) {
      api.copyFileToClipboard(bill.billNumber, customerName)
        .then((success: boolean) => {
          if (success) {
            setTipMessage("📋 PDF file copied to clipboard! Just paste (Ctrl + V) inside the WhatsApp/Email composer to attach the PDF.");
          } else {
            handleShowInFolder();
          }
        })
        .catch(() => {
          handleShowInFolder();
        });
    } else {
      handleShowInFolder();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-md transform overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-md transition-all scale-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Share Invoice</h3>
            <p className="text-xs text-slate-500 mt-1">Bill No: {bill.billNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Info */}
        <div className="my-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">To:</span>
            <span className="font-bold text-slate-900">{customerName}</span>
          </div>
          {customerPhone && (
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Phone:</span>
              <span className="font-semibold text-slate-800">{customerPhone}</span>
            </div>
          )}
          {customerEmail && (
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Email:</span>
              <span className="font-semibold text-slate-800">{customerEmail}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-slate-200/50 mt-1.5">
            <span className="text-slate-400 font-medium">Amount:</span>
            <span className="font-extrabold text-primary-600">₹{bill.finalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Info Drag & Drop Alert Tip */}
        {tipMessage && (
          <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50/50 px-3 py-2 text-xs text-primary-800 animate-fadeIn font-medium">
            {tipMessage}
          </div>
        )}

        {/* Share Action Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* WhatsApp Button */}
          <a
            href={generateWhatsAppLink()}
            onClick={handleWhatsAppClick}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <div className="mb-2 rounded-xl bg-white p-2.5 shadow-sm text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008 0c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 12.001-2.005-.001-3.975-.502-5.717-1.464L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.805 1.453 5.429-.003 9.85-4.42 9.853-9.852.002-2.63-1.023-5.101-2.883-6.963C16.562 1.93 14.09 1.1 11.46 1.1 6.029 1.1 1.61 5.52 1.608 10.953c-.001 1.696.443 3.35 1.286 4.81l-.995 3.636 3.737-.981zM17.156 14.1c-.3-.15-1.774-.875-2.046-.975-.27-.1-.468-.15-.665.15-.198.3-.767.975-.94 1.174-.173.2-.347.225-.648.075-.3-.15-1.266-.467-2.41-1.487-.89-.794-1.49-1.774-1.665-2.074-.173-.3-.018-.462.13-.61.135-.133.3-.347.45-.52.15-.172.2-.3.3-.5.1-.2.05-.375-.026-.525-.075-.15-.665-1.601-.91-2.196-.24-.575-.48-.496-.665-.506-.17-.008-.368-.01-.563-.01-.197 0-.518.075-.788.375-.27.3-1.03 1.008-1.03 2.455 0 1.447 1.053 2.846 1.2 3.047.147.2 2.072 3.165 5.02 4.44.701.304 1.248.485 1.674.621.705.224 1.346.193 1.854.117.566-.084 1.774-.726 2.021-1.427.247-.7.247-1.3.173-1.425-.074-.124-.27-.2-.57-.35z"/>
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">WhatsApp</span>
          </a>

          {/* Email Button */}
          <a
            href={generateEmailLink()}
            onClick={handleShareClick}
            className="flex flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <div className="mb-2 rounded-xl bg-white p-2.5 shadow-sm text-indigo-600">
              <Mail className="h-5.5 w-5.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Email</span>
          </a>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-slate-800 hover:bg-slate-800 hover:text-white hover:border-slate-800 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <div className="mb-2 rounded-xl bg-white p-2.5 shadow-sm text-slate-600">
              {copied ? <Check className="h-5.5 w-5.5 text-green-600" /> : <Copy className="h-5.5 w-5.5" />}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">
              {copied ? 'Copied!' : 'Copy Text'}
            </span>
          </button>

          {/* Native Share Button */}
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center justify-center rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-amber-900 hover:bg-amber-600 hover:text-white hover:border-amber-600 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <div className="mb-2 rounded-xl bg-white p-2.5 shadow-sm text-amber-600">
              <Share2 className="h-5.5 w-5.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">System Share</span>
          </button>
        </div>

        {/* Direct Download Invoice Button */}
        <button
          onClick={() => downloadInvoicePdf(bill, branches, activeBranchId)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition-all mb-3"
        >
          <Download className="w-4 h-4" />
          Download Invoice
        </button>

        {/* Local File Operations row */}
        <div className="border-t border-slate-100 pt-3 flex gap-3">
          <button
            onClick={handleViewPdf}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            View Bill PDF
          </button>
          <button
            onClick={handleShowInFolder}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-slate-500" />
            Show in Folder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
