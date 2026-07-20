import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Bill } from '../types';
import { getStoreSettings } from './getStoreSettings';
import {
  generateQRData,
  generateThermalStandardReceipt,
  generateThermalCompactReceipt,
  generateThermalDetailedReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt
} from './templateGenerator';

export async function downloadInvoicePdf(
  bill: Bill,
  branches: any[] = [],
  activeBranchId: any = null
): Promise<void> {
  if (!bill) return;

  const settings = getStoreSettings(bill.branchId, branches, activeBranchId);
  const qrData = generateQRData(bill, settings);
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

  const customerName = bill.customer?.name || 'Walk-in Customer';
  const sanitizeName = customerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Invoice_${bill.billNumber}_${sanitizeName}.html`;

  // 1. Android APK Native Save & Share
  if (Capacitor.getPlatform() === 'android') {
    try {
      const base64Data = btoa(unescape(encodeURIComponent(receiptHTML)));

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: `Invoice ${bill.billNumber}`,
        text: `Invoice ${bill.billNumber} - ${customerName}`,
        url: savedFile.uri,
        dialogTitle: 'Save / Open / Download Invoice'
      });
      return;
    } catch (err) {
      console.error('Android APK invoice download error:', err);
    }
  }

  // 2. Electron Desktop App
  const api = (window as any).electronAPI;
  if (api?.saveBillPdf) {
    await api.saveBillPdf(bill.billNumber, receiptHTML, customerName);
    if (api.openFile) {
      api.openFile(bill.billNumber, customerName);
    }
    return;
  }

  // 3. Web Browser fallback
  const blob = new Blob([receiptHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
