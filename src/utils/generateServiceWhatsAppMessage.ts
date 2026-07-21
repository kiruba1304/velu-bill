import { BikeServiceReminder, Customer, Bike } from '../types';
import { getStoreSettings } from './getStoreSettings';

export function generateServiceWhatsAppMessage(
  reminder: BikeServiceReminder,
  customer: Customer | undefined,
  bike: Bike | undefined,
  storeName?: string,
  storeAddress?: string,
  storePhone?: string
): string {
  const settings = getStoreSettings();
  const name = storeName || settings.storeName || 'SAM Motors';
  const address = storeAddress || settings.address || '';
  const phone = storePhone || settings.phone || '';

  const customerName = customer?.name || 'Valued Customer';
  const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : 'Vehicle';
  const chassisNo = bike?.chassisNumber ? ` (Chassis: ${bike.chassisNumber})` : '';

  let storeBlock = `*${name}*`;
  if (address) {
    storeBlock += `\n📍 ${address}`;
  }
  if (phone) {
    storeBlock += `\n📞 Contact: ${phone}`;
  }

  return `*SERVICE REMINDER ALERT* 🏍️

Dear *${customerName}*,

This is a friendly reminder from *${name}* regarding your vehicle *${bikeModel}*${chassisNo}.

📋 *Service Details:*
• General Service No: *#${reminder.serviceNo}*
• Scheduled Due Date: *${reminder.scheduledDate}*
• Alert Date: *${reminder.reminderDate}*

Please visit our service center or contact us to schedule your service appointment.

Thank you!
${storeBlock}`;
}

export function generateVisitCompletedWhatsAppMessage(
  reminder: BikeServiceReminder,
  nextReminder: BikeServiceReminder | undefined,
  customer: Customer | undefined,
  bike: Bike | undefined,
  actualVisitDate: string,
  storeName?: string,
  storeAddress?: string,
  storePhone?: string
): string {
  const settings = getStoreSettings();
  const name = storeName || settings.storeName || 'SAM Motors';
  const address = storeAddress || settings.address || '';
  const phone = storePhone || settings.phone || '';

  const customerName = customer?.name || 'Valued Customer';
  const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : 'Vehicle';
  const chassisNo = bike?.chassisNumber ? ` (Chassis: ${bike.chassisNumber})` : '';

  let nextServiceSection = '';
  if (nextReminder) {
    nextServiceSection = `

🔄 *Next Maintenance Cycle:*
• Next General Service No: *#${nextReminder.serviceNo}*
• Scheduled Due Date: *${nextReminder.scheduledDate}*
• Alert Date: *${nextReminder.reminderDate}*`;
  }

  let storeBlock = `*${name}*`;
  if (address) {
    storeBlock += `\n📍 ${address}`;
  }
  if (phone) {
    storeBlock += `\n📞 Contact: ${phone}`;
  }

  return `✅ *SERVICE VISIT COMPLETED* 🏍️

Dear *${customerName}*,

Thank you for servicing your *${bikeModel}*${chassisNo} with *${name}*!

📋 *Visit Summary:*
• General Service No: *#${reminder.serviceNo}*
• Visit Date: *${actualVisitDate}*
• Status: *Completed*${nextServiceSection}

We appreciate your business. Ride safely!

Thank you!
${storeBlock}`;
}

export function generateOverdueWhatsAppMessage(
  reminder: BikeServiceReminder,
  customer: Customer | undefined,
  bike: Bike | undefined,
  storeName?: string,
  storeAddress?: string,
  storePhone?: string
): string {
  const settings = getStoreSettings();
  const name = storeName || settings.storeName || 'SAM Motors';
  const address = storeAddress || settings.address || '';
  const phone = storePhone || settings.phone || '';

  const customerName = customer?.name || 'Valued Customer';
  const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : 'Vehicle';
  const chassisNo = bike?.chassisNumber ? ` (Chassis: ${bike.chassisNumber})` : '';

  let storeBlock = `*${name}*`;
  if (address) {
    storeBlock += `\n📍 ${address}`;
  }
  if (phone) {
    storeBlock += `\n📞 Contact: ${phone}`;
  }

  return `⚠️ *URGENT: OVERDUE SERVICE NOTICE* 🚨

Dear *${customerName}*,

Your vehicle *${bikeModel}*${chassisNo} general service is now *OVERDUE*.

📋 *Service Details:*
• General Service No: *#${reminder.serviceNo}*
• Original Scheduled Due Date: *${reminder.scheduledDate}*
• Current Status: *OVERDUE*

To ensure your vehicle remains in top working condition and maintain your warranty, please visit our service center immediately or contact us to book an urgent slot.

Thank you!
${storeBlock}`;
}
