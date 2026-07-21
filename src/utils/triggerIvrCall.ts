import { BikeServiceReminder, Customer, Bike, IvrLogEntry } from '../types';

export const executeIvrCall = async (
  reminder: BikeServiceReminder,
  customer: Customer | undefined,
  bike: Bike | undefined,
  isSilent = false,
  updateReminderFn?: (id: number, updates: Partial<BikeServiceReminder>) => Promise<boolean>,
  callType: 'auto' | 'manual' = 'manual'
): Promise<{ success: boolean; message: string }> => {
  try {
    const rawSettings = localStorage.getItem('app_settings');
    if (!rawSettings) {
      if (!isSilent) alert('IVR Settings are not configured. Please configure them in Settings page.');
      return { success: false, message: 'IVR Settings are not configured.' };
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
      if (!isSilent) alert('IVR API URL is not configured. Please configure it in Settings under Super Admin.');
      return { success: false, message: 'IVR API URL is not configured.' };
    }

    const customerPhone = customer?.phone || '';
    const customerName = customer?.name || '';
    const bikeModel = bike ? `${bike.brand} ${bike.modelName}` : '';
    const serviceNo = String(reminder.serviceNo);
    const scheduledDate = reminder.scheduledDate;

    if (!customerPhone) {
      if (!isSilent) alert('Customer has no phone number registered.');
      return { success: false, message: 'Customer has no phone number.' };
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
    const method = (ivrMethod || 'GET').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    let options: RequestInit = { method, headers };

    if (method === 'POST' && ivrPayloadTemplate) {
      const finalPayload = replacePlaceholders(ivrPayloadTemplate);
      options.body = finalPayload;
    }

    const existingLogs: IvrLogEntry[] = Array.isArray(reminder.ivrLogs)
      ? reminder.ivrLogs
      : (typeof reminder.ivrLogs === 'string' && reminder.ivrLogs ? JSON.parse(reminder.ivrLogs) : []);

    const nowIso = new Date().toISOString();

    const resp = await fetch(finalUrl, options);
    const isSuccess = resp.ok;
    const errText = !isSuccess ? await resp.text() : '';

    const newLog: IvrLogEntry = {
      timestamp: nowIso,
      type: callType,
      status: isSuccess ? 'success' : 'failed',
      message: isSuccess ? 'Call initiated successfully' : `Failed (${resp.status}): ${errText}`
    };

    const updatedLogs = [newLog, ...existingLogs];
    const nextCount = (reminder.ivrCallCount || 0) + (isSuccess ? 1 : 0);

    if (updateReminderFn) {
      try {
        await updateReminderFn(reminder.id, {
          ivrCallCount: nextCount,
          lastIvrCallDate: nowIso,
          ivrLogs: JSON.stringify(updatedLogs)
        });
      } catch (e) {
        console.error('Failed to update IVR call log in DB:', e);
      }
    }

    if (isSuccess) {
      if (!isSilent) alert(`IVR Call successfully initiated to ${customerName} (${customerPhone}).`);
      return { success: true, message: `IVR call sent to ${customerPhone}` };
    } else {
      if (!isSilent) alert(`IVR Call failed (${resp.status}): ${errText}`);
      return { success: false, message: `IVR call failed: ${errText}` };
    }
  } catch (err: any) {
    if (!isSilent) alert(`IVR Call Error: ${err.message || String(err)}`);
    return { success: false, message: err.message || String(err) };
  }
};
