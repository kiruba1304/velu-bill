import { Bill, Product } from '../types';
import { getStoreSettings } from './getStoreSettings';

export function generateWhatsAppMessage(
  bill: Bill,
  branches: any[] = [],
  activeBranchId: any = null,
  productsList: Product[] = []
): { text: string; customerName: string; customerPhone: string; storeName: string } {
  const customerName = bill.customer?.name || (bill as any).walkInName || 'Walk-in Customer';
  const customerPhone = bill.customer?.phone || (bill as any).walkInPhone || '';
  const storeSettings = getStoreSettings(bill.branchId, branches, activeBranchId);
  const storeName = storeSettings.storeName;

  let itemsText = 'No items listed';
  if (bill.items && bill.items.length > 0) {
    itemsText = bill.items.map(it => {
      const matchedProduct = productsList.find(p => Number(p.id) === Number(it.productId));
      const pName = it.product?.name || matchedProduct?.name || (it as any).name || (it as any).productName || (it as any).title || `Item #${it.productId}`;
      const qty = it.quantity;
      const unitPrice = Number(it.unitPrice).toFixed(2);
      const itemTotal = Number(it.totalPrice || (it.unitPrice * it.quantity)).toFixed(2);
      return `• ${pName} - Qty: ${qty} x ₹${unitPrice} = ₹${itemTotal}`;
    }).join('\n');
  }

  const text = `*${storeName.toUpperCase()}*\nInvoice: *${bill.billNumber}*\nDate: ${new Date(bill.createdAt).toLocaleDateString()}\n\nHello ${customerName},\nHere is your purchase summary:\n\n*Items Purchased:*\n${itemsText}\n\n*Summary:*\n- Subtotal: ₹${bill.totalAmount.toFixed(2)}\n- Discount: ₹${bill.totalDiscount.toFixed(2)}\n- Total GST: ₹${bill.totalGst.toFixed(2)}\n- *Final Total Amount: ₹${bill.finalAmount.toFixed(2)}*\n- Payment Method: ${bill.paymentMethod.toUpperCase()}\n\nThank you for shopping with ${storeName}!`;

  return { text, customerName, customerPhone, storeName };
}
