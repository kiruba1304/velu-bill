import { useEffect } from 'react';
import { useDatabase } from './useDatabase';
import { executeIvrCall } from '../utils/triggerIvrCall';
import { generateServiceWhatsAppMessage, generateOverdueWhatsAppMessage } from '../utils/generateServiceWhatsAppMessage';

export const useAutoIvrScheduler = () => {
  const db = useDatabase();

  useEffect(() => {
    const checkAndSendAutoAlerts = async () => {
      try {
        await db.waitForInit();
        const reminders = await db.getBikeServiceReminders(0);
        const customers = await db.getCustomers(0);
        const bikes = await db.getBikes(0);

        const todayStr = new Date().toISOString().split('T')[0];

        // Find reminders whose Alert Date (reminderDate) is reached or past, and status is pending
        const dueAlertReminders = (reminders || []).filter((r: any) => {
          if (r.status !== 'pending') return false;
          return r.reminderDate && todayStr >= r.reminderDate;
        });

        const rawSettings = localStorage.getItem('app_settings');
        const settings = rawSettings ? JSON.parse(rawSettings) : {};

        // 1. Check & Dispatch Auto IVR Calls (if IVR API URL is configured by Super Admin)
        if (settings.ivrApiUrl) {
          for (const reminder of dueAlertReminders) {
            const key = `auto_ivr_sent_${reminder.id}_${todayStr}`;
            if (!localStorage.getItem(key)) {
              const cust = (customers || []).find((c: any) => c.id === reminder.customerId);
              const bike = (bikes || []).find((b: any) => b.id === reminder.bikeId);

              console.log(`[Auto IVR] Triggering automated alert call for Service #${reminder.serviceNo} to ${cust?.name || 'Customer'} (${cust?.phone})`);
              
              const res = await executeIvrCall(reminder, cust, bike, true, db.updateBikeServiceReminder.bind(db), 'auto');
              if (res.success) {
                localStorage.setItem(key, new Date().toISOString());
              }
            }
          }
        }

        // 2. Check & Dispatch Auto WhatsApp Alerts (if WhatsApp Web Automation is connected)
        const api = (window as any).electronAPI;
        if (api && api.getWhatsAppStatus && api.sendWhatsAppAuto) {
          try {
            const waStatusRes = await api.getWhatsAppStatus();
            if (waStatusRes && waStatusRes.status === 'connected') {
              for (const reminder of dueAlertReminders) {
                const key = `auto_wa_sent_${reminder.id}_${todayStr}`;
                if (!localStorage.getItem(key)) {
                  const cust = (customers || []).find((c: any) => c.id === reminder.customerId);
                  const bike = (bikes || []).find((b: any) => b.id === reminder.bikeId);

                  if (cust && cust.phone) {
                    const messageText = generateServiceWhatsAppMessage(reminder, cust, bike, settings.storeName, settings.address, settings.phone);
                    console.log(`[Auto WhatsApp] Sending automated alert to ${cust.name} (${cust.phone})`);
                    
                    try {
                      await api.sendWhatsAppAuto(cust.phone, messageText, null, cust.name);
                      const nowIso = new Date().toISOString();
                      localStorage.setItem(key, nowIso);
                      try {
                        const existingLogs = Array.isArray(reminder.waLogs)
                          ? reminder.waLogs
                          : (typeof reminder.waLogs === 'string' && reminder.waLogs ? JSON.parse(reminder.waLogs) : []);
                        const newLog = {
                          timestamp: nowIso,
                          type: 'auto',
                          status: 'success',
                          message: 'Auto WhatsApp alert sent'
                        };
                        await db.updateBikeServiceReminder(reminder.id, {
                          waSentCount: (reminder.waSentCount || 0) + 1,
                          lastWaSentDate: nowIso,
                          waLogs: JSON.stringify([newLog, ...existingLogs])
                        });
                      } catch (dbErr) {
                        console.error('[Auto WhatsApp] Failed to update reminder DB:', dbErr);
                      }
                    } catch (waErr) {
                      console.error('[Auto WhatsApp] Failed to send auto WhatsApp alert:', waErr);
                    }
                  }
                }
              }

              // Also check & dispatch Auto WhatsApp OVERDUE alerts for overdue reminders
              const overdueReminders = (reminders || []).filter((r: any) => {
                if (r.status === 'completed') return false;
                return r.status === 'overdue' || (r.status === 'pending' && todayStr > r.scheduledDate);
              });

              for (const reminder of overdueReminders) {
                const key = `auto_wa_overdue_${reminder.id}_${todayStr}`;
                if (!localStorage.getItem(key)) {
                  const cust = (customers || []).find((c: any) => c.id === reminder.customerId);
                  const bike = (bikes || []).find((b: any) => b.id === reminder.bikeId);

                  if (cust && cust.phone) {
                    const messageText = generateOverdueWhatsAppMessage(reminder, cust, bike, settings.storeName, settings.address, settings.phone);
                    console.log(`[Auto WhatsApp] Sending automated OVERDUE alert to ${cust.name} (${cust.phone})`);
                    
                    try {
                      await api.sendWhatsAppAuto(cust.phone, messageText, null, cust.name);
                      const nowIso = new Date().toISOString();
                      localStorage.setItem(key, nowIso);
                      try {
                        const existingLogs = Array.isArray(reminder.waLogs)
                          ? reminder.waLogs
                          : (typeof reminder.waLogs === 'string' && reminder.waLogs ? JSON.parse(reminder.waLogs) : []);
                        const newLog = {
                          timestamp: nowIso,
                          type: 'auto',
                          status: 'success',
                          message: 'Auto Overdue WhatsApp alert sent'
                        };
                        await db.updateBikeServiceReminder(reminder.id, {
                          waSentCount: (reminder.waSentCount || 0) + 1,
                          lastWaSentDate: nowIso,
                          waLogs: JSON.stringify([newLog, ...existingLogs])
                        });
                      } catch (dbErr) {
                        console.error('[Auto WhatsApp] Failed to update reminder DB:', dbErr);
                      }
                    } catch (waErr) {
                      console.error('[Auto WhatsApp] Failed to send auto Overdue WhatsApp alert:', waErr);
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error('[Auto WhatsApp] Status check error:', err);
          }
        }
      } catch (err) {
        console.error('[Auto Scheduler] Error checking automatic IVR/WhatsApp dispatch:', err);
      }
    };

    // Run check on initial load
    checkAndSendAutoAlerts();

    // Check periodically every 10 minutes
    const interval = setInterval(checkAndSendAutoAlerts, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};
