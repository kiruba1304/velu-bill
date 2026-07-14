import { Bill } from '../types';

interface AppSettings {
  storeName: string;
  upiId: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  accountHolderName: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
  showGst?: boolean;
  gstInclusive?: boolean;
  footerMessage?: string;
  logoUrl?: string;
}

export const generateQRData = (bill: Bill, settings: AppSettings): string => {
  const { upiId, accountHolderName, storeName } = settings;

  if (upiId.trim()) {
    const noteText = `Bill ${bill.billNumber}`;
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(accountHolderName || storeName)}&am=${bill.finalAmount.toFixed(2)}&tn=${encodeURIComponent(noteText)}`;
  }

  return `Bill:${bill.billNumber}|Total:${bill.finalAmount.toFixed(2)}|Date:${new Date(bill.createdAt).toISOString()}`;
};

// Thermal Printer Templates (80mm)
export const generateThermalCompactReceipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId } = settings;
  const storeAddress = settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101';
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsg = settings.footerMessage || 'Thank you!';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${bill.billNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 15px;
          font-size: 11px;
          line-height: 1.2;
          background: #fff;
        }
        .receipt { max-width: 280px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
        .company-name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .bill-info { margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; font-size: 10px; }
        .bill-info div { margin-bottom: 2px; }
        .items { margin-bottom: 8px; font-size: 10px; }
        .item { display: grid; grid-template-columns: 2fr 1fr 1.5fr; column-gap: 5px; margin-bottom: 3px; }
        .item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-qty { text-align: center; }
        .item-price { text-align: right; }
        .totals { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
        .total-line { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px; }
        .final-total { font-weight: bold; font-size: 12px; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
        .footer { text-align: center; margin-top: 10px; font-size: 9px; }
        .qr { text-align: center; margin-top: 8px; }
        @media print { html, body { width: 80mm; margin: 0 !important; padding: 0 !important; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="company-name">${storeName}</div>
          ${storeAddress ? `<div style="font-size: 9px; margin-top: 2px;">${storeAddress.replace(/\n/g, '<br>')}</div>` : ''}
          ${storePhone ? `<div style="font-size: 9px; margin-top: 2px;">Phone: ${storePhone}</div>` : ''}
          ${(isGstEnabled && gstNum) ? `<div style="font-size: 9px; margin-top: 2px;">GST: ${gstNum}</div>` : ''}
        </div>
        <div class="bill-info">
          <div><strong>Bill:</strong> ${bill.billNumber}</div>
          <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleString()}</div>
          ${bill.customer ? `<div><strong>Cust:</strong> ${bill.customer.name}</div>` : ''}
        </div>
        <div class="items">
          <div class="item" style="border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 5px; font-weight: bold; font-size: 9px;">
            <div class="item-name">Item</div>
            <div class="item-qty" style="text-align: center;">Qty</div>
            <div class="item-price" style="text-align: right;">Amt</div>
          </div>
          ${bill.items?.map(item => `
            <div class="item">
              <div class="item-name">
                ${item.product?.name || 'Product'}
                ${item.product?.productCode ? ` [${item.product.productCode}]` : ''}
                ${item.discount > 0 ? ` (${item.discount}% Off)` : ''}
              </div>
              <div class="item-qty">${item.quantity}</div>
              <div class="item-price">₹${item.totalPrice.toFixed(2)}</div>
            </div>
          `).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Disc:</span><span>-₹${bill.totalDiscount.toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST ${settings.gstInclusive ? '(Incl)' : '(Excl)'}:</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line" style="font-weight: bold; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px;"><span>Net Pending:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
          ${upiId.trim() ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #000; text-align: center;">
            <div style="font-weight: bold; font-size: 9px; margin-bottom: 5px;">SCAN TO PAY</div>
            <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}" width="100" height="100" /></div>
          </div>
          ` : ''}
        </div>
        <div class="footer">${footerMsg.replace(/\n/g, '<br>')}</div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};

export const generateThermalStandardReceipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId, accountHolderName } = settings;
  const storeAddressLines = (settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101')
    .split('\n')
    .filter(line => line.trim() !== '');
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsgHtml = (settings.footerMessage || 'Thank you for your business!\nVisit again soon')
    .split('\n')
    .map(line => `<div>${line}</div>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${bill.billNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
          background: #fff;
        }
        .receipt { max-width: 300px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .company-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .bill-info { margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .items { margin-bottom: 10px; }
        .item { display: grid; grid-template-columns: 1fr 40px 80px; column-gap: 10px; margin-bottom: 5px; }
        .item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-qty { text-align: center; }
        .item-price { text-align: right; }
        .totals { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
        .total-line { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .final-total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
        .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; }
        .qr { text-align: center; margin-top: 10px; }
        @media print { html, body { width: 80mm; margin: 0 !important; padding: 0 !important; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="company-name">${storeName}</div>
          ${storeAddressLines.map(line => `<div>${line}</div>`).join('')}
          ${storePhone ? `<div>Phone: ${storePhone}</div>` : ''}
          ${(isGstEnabled && gstNum) ? `<div>GST: ${gstNum}</div>` : ''}
        </div>
        <div class="bill-info">
          <div><strong>Bill No:</strong> ${bill.billNumber}</div>
          <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleString()}</div>
          ${bill.customer ? `<div><strong>Customer:</strong> ${bill.customer.name}</div>` : ''}
          ${bill.customer?.phone ? `<div><strong>Phone:</strong> ${bill.customer.phone}</div>` : ''}
          <div><strong>Payment:</strong> ${bill.paymentMethod.toUpperCase()}</div>
        </div>
        <div class="items">
          <div class="item" style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; font-weight: bold;">
            <div class="item-name">Item Description</div>
            <div class="item-qty" style="text-align: center;">Qty</div>
            <div class="item-price" style="text-align: right;">Price</div>
          </div>
          ${bill.items?.map(item => `
            <div class="item">
              <div class="item-name">
                ${item.product?.name || 'Unknown Product'}
                ${item.product?.productCode ? ` [${item.product.productCode}]` : ''}
                ${item.discount > 0 ? ` (${item.discount}% Off)` : ''}
              </div>
              <div class="item-qty">${item.quantity}</div>
              <div class="item-price">₹${item.totalPrice.toFixed(2)}</div>
            </div>
          `).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Discount:</span><span>-₹${bill.totalDiscount.toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST ${settings.gstInclusive ? '(Incl)' : '(Excl)'}:</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL:</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line" style="font-weight: bold; font-size: 13px; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px;"><span>Net Pending:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
          ${upiId.trim() ? `
          <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000;">
            <div style="text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 8px;">SCAN TO PAY</div>
            <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}" width="120" height="120" /></div>
            <div style="text-align: center; font-size: 10px; margin-top: 5px;">
              <div><strong>UPI:</strong> ${upiId}</div>
              ${accountHolderName ? `<div><strong>Name:</strong> ${accountHolderName}</div>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          ${footerMsgHtml}
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};

export const generateThermalDetailedReceipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId } = settings;
  const storeAddress = settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101';
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsg = settings.footerMessage || 'Thank you for shopping with us!';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${bill.billNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 20px;
          font-size: 11px;
          line-height: 1.3;
          background: #fff;
        }
        .receipt { max-width: 300px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .company-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .bill-info { margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; font-size: 10px; }
        .items { margin-bottom: 10px; }
        .item { border-bottom: 1px dotted #ccc; padding-bottom: 5px; margin-bottom: 5px; font-size: 10px; }
        .item-header { display: flex; justify-content: space-between; font-weight: bold; }
        .item-detail { display: flex; justify-content: space-between; font-size: 9px; color: #666; }
        .totals { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
        .total-line { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .final-total { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
        .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; font-size: 9px; }
        .qr { text-align: center; margin-top: 10px; }
        @media print { html, body { width: 80mm; margin: 0 !important; padding: 0 !important; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="company-name">${storeName}</div>
          ${storeAddress ? `<div style="font-size: 9px; margin-top: 2px;">${storeAddress.replace(/\n/g, '<br>')}</div>` : ''}
          ${storePhone ? `<div style="font-size: 9px; margin-top: 2px;">Phone: ${storePhone}</div>` : ''}
          <div style="font-size: 9px; margin-top: 2px;">Invoice #${bill.billNumber}</div>
        </div>
        <div class="bill-info">
          <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleString()}</div>
          ${bill.customer ? `<div><strong>Customer:</strong> ${bill.customer.name} (${bill.customer.phone})</div>` : ''}
          <div><strong>Payment Mode:</strong> ${bill.paymentMethod.toUpperCase()}</div>
        </div>
        <div class="items">
          <div style="font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 5px;">ITEMS</div>
          ${bill.items?.map(item => `
            <div class="item">
              <div class="item-header">
                <span>
                  ${item.product?.name || 'Product'}
                  ${item.discount > 0 ? ` <small style="color: #27ae60;">(${item.discount}% Off)</small>` : ''}
                </span>
                <span>₹${item.totalPrice.toFixed(2)}</span>
              </div>
              <div class="item-detail">
                <span>Qty: ${item.quantity} × ₹${item.unitPrice.toFixed(2)}</span>
                ${isGstEnabled ? `<span>GST: ${item.gst}%</span>` : ''}
              </div>
            </div>
          `).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Discount:</span><span style="color: red;">-₹${bill.totalDiscount.toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST ${settings.gstInclusive ? '(Incl)' : '(Excl)'}:</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL AMOUNT</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line" style="font-weight: bold; font-size: 12px; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px;"><span>Net Pending:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
          ${upiId.trim() ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000;">
            <div style="text-align: center; font-weight: bold; font-size: 10px; margin-bottom: 5px;">SCAN TO PAY VIA UPI</div>
            <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}" width="100" height="100" /></div>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <div>${footerMsg.replace(/\n/g, '<br>')}</div>
          ${(isGstEnabled && gstNum) ? `<div style="margin-top: 3px;">GST Registration: ${gstNum}</div>` : ''}
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};

// Regular Printer Templates (A4/A5)
export const generateRegularA5Receipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId } = settings;
  const storeAddress = settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101';
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsg = settings.footerMessage || 'Thank you for your business!';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${bill.billNumber}</title>
      <style>
        @page { size: 148mm 210mm; margin: 10mm; }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          font-size: 11px;
          line-height: 1.5;
          background: #fff;
        }
        .invoice { max-width: 128mm; margin: 0 auto; }
        .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 15px; margin-bottom: 15px; }
        .company-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
        .bill-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 10px; }
        .bill-details { border: 1px solid #ddd; padding: 10px; }
        .items { margin-bottom: 20px; }
        .item-header { display: grid; grid-template-columns: 2fr 1fr 1.5fr 1.5fr; gap: 10px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
        .item { display: grid; grid-template-columns: 2fr 1fr 1.5fr 1.5fr; gap: 10px; padding: 8px 0; border-bottom: 1px dotted #ddd; }
        .totals { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
        .total-line { display: flex; justify-content: space-between; padding: 5px 0; }
        .final-total { font-weight: bold; font-size: 13px; border-top: 2px solid #333; padding-top: 5px; }
        .footer { text-align: center; margin-top: 20px; font-size: 9px; }
        .qr { text-align: center; margin: 15px 0; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 15px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Store Logo" style="max-height: 60px; max-width: 110px; object-fit: contain;" />` : ''}
            <div>
              <div class="company-name" style="margin: 0; line-height: 1.2;">${storeName}</div>
              <div style="font-size: 12px; font-weight: bold; margin-top: 3px; color: #333;">INVOICE #${bill.billNumber}</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #555; line-height: 1.4;">
            ${storeAddress ? `${storeAddress.replace(/\n/g, '<br>')}<br>` : ''}
            Phone: ${storePhone} ${(isGstEnabled && gstNum) ? ` | GST: ${gstNum}` : ''}
          </div>
        </div>
        <div class="bill-info">
          <div class="bill-details">
            <strong>Bill Date:</strong><br>${new Date(bill.createdAt).toLocaleDateString()}
          </div>
          <div class="bill-details">
            ${bill.customer ? `
              <strong>${bill.customer.name}</strong><br>
              ${bill.customer.phone}
              ${bill.customer.address ? `<br>${bill.customer.address.replace(/\n/g, '<br>')}` : ''}
              ${bill.customer.gstNumber ? `<br><strong>GSTIN:</strong> ${bill.customer.gstNumber}` : ''}
            ` : '<strong>Walk-in Customer</strong>'}
          </div>
        </div>
        <div class="items">
          <div class="item-header">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit Price</span>
            <span>Amount</span>
          </div>
          ${bill.items?.map(item => `
            <div class="item">
              <span>
                ${item.product?.name || 'Product'}
                ${item.discount > 0 ? `<small style="color: #27ae60; font-weight: bold; margin-left: 6px;">(${item.discount}% Off)</small>` : ''}
              </span>
              <span style="text-align: center;">${item.quantity}</span>
              <span style="text-align: right;">₹${item.unitPrice.toFixed(2)}</span>
              <span style="text-align: right;">₹${item.totalPrice.toFixed(2)}</span>
            </div>
          `).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Discount:</span><span>-₹${bill.totalDiscount.toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST ${settings.gstInclusive ? '(Incl)' : '(Excl)'}:</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL:</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 2px solid #333; margin-top: 5px; padding-top: 5px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line" style="font-weight: bold; font-size: 12px; border-top: 2px solid #333; padding-top: 3px; margin-top: 3px;"><span>Net Pending:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
          ${upiId.trim() ? `
          <div class="qr">
            <strong>SCAN TO PAY</strong><br>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}" width="120" height="120" />
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <div>${footerMsg.replace(/\n/g, '<br>')}</div>
          <div>Payment Method: ${bill.paymentMethod.toUpperCase()}</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};

export const generateRegularA4Receipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId, accountHolderName } = settings;
  const storeAddress = settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101';
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsg = settings.footerMessage || 'Thank you for your business!';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${bill.billNumber}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 30px;
          font-size: 12px;
          line-height: 1.6;
          background: #fff;
        }
        .invoice { max-width: 210mm; margin: 0 auto; }
        .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 25px; }
        .company-name { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .company-details { font-size: 11px; color: #666; }
        .invoice-title { font-size: 18px; font-weight: bold; margin-top: 10px; }
        .bill-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; font-size: 11px; }
        .bill-section { border: 1px solid #ddd; padding: 15px; }
        .section-title { font-weight: bold; font-size: 12px; margin-bottom: 10px; }
        .items { margin-bottom: 30px; }
        .item-header { display: grid; grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr; gap: 15px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
        .item { display: grid; grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr; gap: 15px; padding: 10px 0; border-bottom: 1px dotted #ccc; }
        .totals { margin-bottom: 30px; border-top: 2px solid #333; padding-top: 15px; }
        .total-line { display: flex; justify-content: space-between; padding: 8px 0; }
        .final-total { font-weight: bold; font-size: 14px; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
        .notes { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-left: 4px solid #333; }
        .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
        .qr { text-align: center; margin: 20px 0; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 25px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 20px;">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Store Logo" style="max-height: 80px; max-width: 150px; object-fit: contain;" />` : ''}
            <div>
              <div class="company-name" style="margin: 0; line-height: 1.2;">${storeName}</div>
              <div class="invoice-title" style="margin-top: 5px; font-size: 16px; color: #666; font-weight: bold; letter-spacing: 0.05em;">INVOICE</div>
            </div>
          </div>
          <div class="company-details" style="text-align: right; font-size: 11px; color: #555; line-height: 1.5;">
            ${storeAddress ? `${storeAddress.replace(/\n/g, '<br>')}<br>` : ''}
            Phone: ${storePhone} ${(isGstEnabled && gstNum) ? ` | GST: ${gstNum}` : ''}
          </div>
        </div>
        <div class="bill-info">
          <div class="bill-section">
            <div class="section-title">INVOICE DETAILS</div>
            <div><strong>Invoice #:</strong> ${bill.billNumber}</div>
            <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleDateString()}</div>
            <div><strong>Time:</strong> ${new Date(bill.createdAt).toLocaleTimeString()}</div>
            <div><strong>Payment Method:</strong> ${bill.paymentMethod.toUpperCase()}</div>
          </div>
          <div class="bill-section">
            <div class="section-title">BILL TO</div>
            ${bill.customer ? `
              <div><strong>${bill.customer.name}</strong></div>
              <div>${bill.customer.phone}</div>
              ${bill.customer.email ? `<div>${bill.customer.email}</div>` : ''}
              ${bill.customer.address ? `<div>${bill.customer.address}</div>` : ''}
              ${bill.customer.gstNumber ? `<div><strong>GSTIN:</strong> ${bill.customer.gstNumber}</div>` : ''}
            ` : '<div><strong>Walk-in Customer</strong></div>'}
          </div>
        </div>
        <div class="items">
          <div class="item-header">
            <span>Description</span>
            <span style="text-align: center;">Quantity</span>
            <span style="text-align: right;">Unit Price</span>
            <span style="text-align: right;">Amount</span>
          </div>
          ${bill.items?.map(item => `
            <div class="item">
              <span>
                ${item.product?.name || 'Product'} ${item.product?.productCode ? `(${item.product.productCode})` : ''}
                ${item.discount > 0 ? `<small style="color: #27ae60; font-weight: bold; margin-left: 8px;">(${item.discount}% Off)</small>` : ''}
              </span>
              <span style="text-align: center;">${item.quantity}</span>
              <span style="text-align: right;">₹${item.unitPrice.toFixed(2)}</span>
              <span style="text-align: right;">₹${item.totalPrice.toFixed(2)}</span>
            </div>
          `).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Discount:</span><span style="color: red;">-₹${bill.totalDiscount.toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST (${bill.items?.[0]?.gst || 0}% ${settings.gstInclusive ? 'Incl' : 'Excl'}):</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL AMOUNT DUE:</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 2px solid #333; margin-top: 8px; padding-top: 8px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line final-total" style="font-weight: bold; font-size: 14px; border-top: 2px solid #333; padding-top: 5px; margin-top: 5px;"><span>NET PENDING BALANCE:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
        </div>
        ${upiId.trim() ? `
        <div class="qr">
          <strong>SCAN TO PAY VIA UPI</strong><br>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" width="150" height="150" />
          <div style="margin-top: 10px; font-size: 11px;">
            <div><strong>UPI ID:</strong> ${upiId}</div>
            ${accountHolderName ? `<div><strong>Payee Name:</strong> ${accountHolderName}</div>` : ''}
          </div>
        </div>
        ` : ''}
        <div class="notes">
          <strong>Notes:</strong><br>
          ${footerMsg.replace(/\n/g, '<br>')} Please retain this invoice for your records.
        </div>
        <div class="footer">
          <div>This is a computer-generated invoice, no signature required.</div>
          <div style="margin-top: 10px;">Bill போடு - Professional Billing Software</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};

export const generateRegularA4DetailedReceipt = (bill: Bill, settings: AppSettings, qrData: string): string => {
  const { storeName, upiId, accountHolderName } = settings;
  const storeAddress = settings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101';
  const storePhone = settings.phone || '9965326590, 9047656890';
  const gstNum = settings.gstNumber || '';
  const isGstEnabled = settings.showGst !== false && bill.isGstBill !== false;
  const footerMsg = settings.footerMessage || 'Thank you for your purchase!';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Detailed Invoice - ${bill.billNumber}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 30px;
          font-size: 11px;
          line-height: 1.6;
          background: #fff;
        }
        .invoice { max-width: 210mm; margin: 0 auto; }
        .header { text-align: center; border-bottom: 3px solid #1a3a52; padding-bottom: 20px; margin-bottom: 25px; }
        .company-name { font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #1a3a52; }
        .company-details { font-size: 10px; color: #666; }
        .invoice-title { font-size: 18px; font-weight: bold; margin-top: 10px; color: #1a3a52; }
        .bill-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; font-size: 10px; }
        .bill-section { border: 2px solid #1a3a52; padding: 15px; background: #f9f9f9; }
        .section-title { font-weight: bold; font-size: 12px; margin-bottom: 10px; color: #1a3a52; }
        .items { margin-bottom: 30px; }
        .item-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 12px; font-weight: bold; background: #1a3a52; color: white; padding: 10px; margin-bottom: 15px; }
        .item { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px dotted #ccc; }
        .totals { margin-bottom: 30px; border-top: 3px solid #1a3a52; padding-top: 15px; }
        .total-line { display: flex; justify-content: space-between; padding: 8px 0; font-size: 11px; }
        .final-total { font-weight: bold; font-size: 14px; border-top: 2px solid #1a3a52; padding-top: 8px; margin-top: 8px; color: #1a3a52; }
        .notes { margin-bottom: 20px; padding: 15px; background: #fffacd; border-left: 4px solid #ffd700; font-size: 10px; }
        .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
        .qr { text-align: center; margin: 20px 0; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a3a52; padding-bottom: 20px; margin-bottom: 25px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 20px;">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Store Logo" style="max-height: 80px; max-width: 150px; object-fit: contain;" />` : ''}
            <div>
              <div class="company-name" style="margin: 0; line-height: 1.2; color: #1a3a52;">${storeName}</div>
              <div class="invoice-title" style="margin-top: 5px; font-size: 16px; color: #1a3a52; font-weight: bold; letter-spacing: 0.05em;">TAX INVOICE</div>
            </div>
          </div>
          <div class="company-details" style="text-align: right; font-size: 11px; color: #555; line-height: 1.5;">
            ${storeAddress ? `${storeAddress.replace(/\n/g, '<br>')}<br>` : ''}
            Phone: ${storePhone} ${(isGstEnabled && gstNum) ? ` | GST: ${gstNum}` : ''}
          </div>
        </div>
        <div class="bill-info">
          <div class="bill-section">
            <div class="section-title">INVOICE INFORMATION</div>
            <div><strong>Invoice #:</strong> ${bill.billNumber}</div>
            <div><strong>Date:</strong> ${new Date(bill.createdAt).toLocaleDateString()}</div>
            <div><strong>Time:</strong> ${new Date(bill.createdAt).toLocaleTimeString()}</div>
            <div><strong>Status:</strong> ${bill.status.toUpperCase()}</div>
            <div><strong>Payment Mode:</strong> ${bill.paymentMethod.toUpperCase()}</div>
          </div>
          <div class="bill-section">
            <div class="section-title">BILL TO</div>
            ${bill.customer ? `
              <div><strong>${bill.customer.name}</strong></div>
              <div>Phone: ${bill.customer.phone}</div>
              ${bill.customer.email ? `<div>Email: ${bill.customer.email}</div>` : ''}
              ${bill.customer.address ? `<div>Address: ${bill.customer.address}</div>` : ''}
              ${bill.customer.gstNumber ? `<div><strong>GSTIN:</strong> ${bill.customer.gstNumber}</div>` : ''}
            ` : '<div><strong>Walk-in Customer</strong></div>'}
          </div>
        </div>
        <div class="items">
          <div class="item-header">
            <span>Product Description</span>
            <span style="text-align: center;">Qty</span>
            <span style="text-align: right;">Unit Price</span>
            <span style="text-align: right;">Discount</span>
            <span style="text-align: right;">Amount</span>
          </div>
          ${bill.items?.map(item => {
            const discountAmount = item.totalPrice * (item.discount / 100);
            return `
            <div class="item">
              <span>${item.product?.name || 'Product'}<br><small style="color: #666;">${item.product?.productCode ? `Code: ${item.product.productCode}` : ''}</small></span>
              <span style="text-align: center;">${item.quantity}</span>
              <span style="text-align: right;">₹${item.unitPrice.toFixed(2)}</span>
              <span style="text-align: right; color: red;">${item.discount > 0 ? `-₹${discountAmount.toFixed(2)} (${item.discount}%)` : '₹0.00'}</span>
              <span style="text-align: right;">₹${item.totalPrice.toFixed(2)}</span>
            </div>
          `;
          }).join('') || ''}
        </div>
        <div class="totals">
          <div class="total-line"><span>Subtotal:</span><span>₹${bill.totalAmount.toFixed(2)}</span></div>
          <div class="total-line"><span>Total Discount:</span><span style="color: red;">-₹${bill.totalDiscount.toFixed(2)}</span></div>
          <div class="total-line"><span>Base Amount (after discount):</span><span>₹${(bill.totalAmount - bill.totalDiscount).toFixed(2)}</span></div>
          ${isGstEnabled ? `<div class="total-line"><span>GST ${settings.gstInclusive ? '(Included)' : '(Excluded)'}:</span><span>₹${bill.totalGst.toFixed(2)}</span></div>` : ''}
          <div class="total-line final-total"><span>TOTAL AMOUNT DUE:</span><span>₹${bill.finalAmount.toFixed(2)}</span></div>
          ${(bill.paymentMethod === 'credit' && bill.previousBalance !== undefined) ? `
            <div style="border-top: 2px solid #1a3a52; margin-top: 8px; padding-top: 8px;">
              <div class="total-line"><span>Prev Balance:</span><span>₹${bill.previousBalance.toFixed(2)}</span></div>
              <div class="total-line"><span>Total Outstanding:</span><span>₹${(bill.totalOutstanding ?? 0).toFixed(2)}</span></div>
              <div class="total-line"><span>Currently Paid:</span><span>-₹${(bill.currentlyPaid ?? 0).toFixed(2)}</span></div>
              <div class="total-line final-total" style="font-weight: bold; font-size: 14px; border-top: 2px solid #1a3a52; padding-top: 5px; margin-top: 5px; color: #1a3a52;"><span>NET PENDING BALANCE:</span><span>₹${(bill.netBalance ?? 0).toFixed(2)}</span></div>
            </div>
          ` : ''}
        </div>
        ${upiId.trim() ? `
        <div class="qr">
          <strong style="color: #1a3a52;">PAYMENT VIA UPI - SCAN QR CODE</strong><br>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" width="150" height="150" />
          <div style="margin-top: 10px; font-size: 10px;">
            <div><strong>UPI ID:</strong> ${upiId}</div>
            ${accountHolderName ? `<div><strong>Payee Name:</strong> ${accountHolderName}</div>` : ''}
            <div><strong>Amount:</strong> ₹${bill.finalAmount.toFixed(2)}</div>
          </div>
        </div>
        ` : ''}
        <div class="notes">
          <strong>Terms & Conditions:</strong><br>
          • Thank you for your purchase!<br>
          • GST included in the bill<br>
          • All sales are final unless otherwise specified<br>
          • Please retain this invoice for warranty and return claims
        </div>
        <div class="footer">
          <div style="margin-bottom: 10px; font-weight: bold; font-size: 12px; color: #1a3a52;">${footerMsg.replace(/\n/g, '<br>')}</div>
          <div><strong>This is a computer-generated invoice. No signature required.</strong></div>
          <div style="margin-top: 10px;">Powered by Bill போடு - Professional Billing Software</div>
          <div>Generated on ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
};
