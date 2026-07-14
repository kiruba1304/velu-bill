import { useEffect, useRef } from 'react';
import { useDatabase } from './useDatabase';
import { BillItem } from '../types';

export const useECommerceIntegration = () => {
  const db = useDatabase();
  const isSyncingRef = useRef(false);

  const sendHeartbeat = async () => {
    try {
      const settingsRaw = localStorage.getItem('app_settings');
      if (!settingsRaw) return;

      const settings = JSON.parse(settingsRaw);
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';

      if (!apiUrl || !apiKey) return;

      await fetch(`${apiUrl}/billing/sync/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
    } catch {
      // Heartbeat is best-effort only.
    }
  };

  const performSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      await db.waitForInit();

      // Read configurations from localStorage
      const settingsRaw = localStorage.getItem('app_settings');
      if (!settingsRaw) {
        isSyncingRef.current = false;
        return;
      }

      const settings = JSON.parse(settingsRaw);
      const apiUrl = (settings.ecommerceApiUrl || '').replace(/\/$/, '');
      const apiKey = settings.ecommerceApiKey || '';

      if (!apiUrl || !apiKey) {
        isSyncingRef.current = false;
        return;
      }

      console.log('Starting E-Commerce Bidirectional Sync...');

      await sendHeartbeat();

      // -------------------------------------------------------------
      // 0. SYNC CATEGORIES (BIDIRECTIONAL)
      // -------------------------------------------------------------
      const localCategories = await db.getCategories();
      const categorySyncRes = await fetch(`${apiUrl}/billing/sync/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          categories: localCategories
        })
      });

      if (categorySyncRes.ok) {
        const catData = await categorySyncRes.json();
        const webCategories = catData.categories || [];

        for (const wc of webCategories) {
          const localCat = localCategories.find(
            lc => lc.name.toLowerCase() === wc.name.toLowerCase()
          );

          if (localCat) {
            await db.updateCategory(localCat.id, {
              description: wc.description || '',
              customizationEnabled: wc.customization_enabled || false,
              returnWindowDays: wc.return_window_days
            });
          } else {
            await db.createCategory({
              name: wc.name,
              description: wc.description || '',
              customizationEnabled: wc.customization_enabled || false,
              returnWindowDays: wc.return_window_days
            });
          }
        }
      }

      // -------------------------------------------------------------
      // 1. SYNC PRODUCTS (BIDIRECTIONAL)
      // -------------------------------------------------------------
      const localProducts = await db.getProducts();
      
      const deletedKey = 'billing_app_deleted_products_sync';
      const deletedListRaw = localStorage.getItem(deletedKey);
      const deletedList = deletedListRaw ? JSON.parse(deletedListRaw) : [];

      const productSyncRes = await fetch(`${apiUrl}/billing/sync/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          products: localProducts,
          deleted_products: deletedList
        })
      });

      if (productSyncRes.ok) {
        // Clear locally synced deleted products queue
        localStorage.removeItem(deletedKey);
        
        const prodData = await productSyncRes.json();
        const webProducts = prodData.products || [];
        const webDeletedProducts = prodData.deleted_products || [];

        // Delete any local products that were deleted on the web admin side
        for (const wdp of webDeletedProducts) {
          const localProd = localProducts.find(
            lp => (wdp.barcode && lp.barcode === wdp.barcode) || (wdp.sku_code && lp.skuCode === wdp.sku_code)
          );
          if (localProd) {
            await db.deleteProduct(localProd.id, false); // false = don't re-queue for server sync
          }
        }

        // Update local storage products with details from website
        for (const wp of webProducts) {
          const localProd = localProducts.find(
            lp => (wp.barcode && lp.barcode === wp.barcode) || (wp.sku_code && lp.skuCode === wp.sku_code)
          );

          if (localProd) {
            // Update local product: stock count, price, name, classification code, images, category
            await db.updateProduct(localProd.id, {
              count: wp.stock,
              sellingPrice: wp.price,
              name: wp.name,
              skuCode: wp.sku_code,
              hsnCode: wp.hsc_code,
              images: wp.images || [],
              categoryName: wp.category_name || ''
            });
          } else {
            // Create product locally since it does not exist
            await db.createProduct({
              name: wp.name,
              company: 'N/A',
              productCode: wp.sku_code,
              skuCode: wp.sku_code,
              hsnCode: wp.hsc_code,
              count: wp.stock,
              costPrice: wp.original_price || wp.price,
              sellingPrice: wp.price,
              discount: 0,
              gst: settings.gstPercentage || 18,
              barcode: wp.barcode || `BC-${Date.now()}-${Math.floor(Math.random() * 100)}`,
              finalPrice: wp.price,
              images: wp.images || [],
              categoryName: wp.category_name || ''
            });
          }
        }
      }

      // -------------------------------------------------------------
      // 2. SYNC POS BILLS TO WEBSITE
      // -------------------------------------------------------------
      const localBills = await db.getBills();
      
      // Load synced bill numbers list to prevent resending
      const syncedBillsRaw = localStorage.getItem('synced_bill_numbers');
      const syncedBillNumbers: string[] = syncedBillsRaw ? JSON.parse(syncedBillsRaw) : [];

      const unsyncedBills = localBills.filter(b => !syncedBillNumbers.includes(b.billNumber) && b.salesChannel !== 'ecommerce');

      if (unsyncedBills.length > 0) {
        const allCustomers = await db.getCustomers();
        const unsyncedBillsWithCustomers = unsyncedBills.map(b => {
          if (!b.customer && b.customerId) {
            const foundCust = allCustomers.find(c => c.id === b.customerId);
            if (foundCust) {
              return { ...b, customer: foundCust };
            }
          }
          return b;
        });

        const billSyncRes = await fetch(`${apiUrl}/billing/sync/bills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            bills: unsyncedBillsWithCustomers
          })
        });

        if (billSyncRes.ok) {
          const resJson = await billSyncRes.json();
          if (resJson.success) {
            // Add all processed bill numbers to synced bills list
            const updatedSynced = [...syncedBillNumbers, ...unsyncedBills.map(b => b.billNumber)];
            localStorage.setItem('synced_bill_numbers', JSON.stringify(updatedSynced));
          }
        }
      }

      // -------------------------------------------------------------
      // 3. PULL WEBSITE ORDERS TO POS
      // -------------------------------------------------------------
      const orderPullRes = await fetch(`${apiUrl}/billing/sync/orders/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });

      if (orderPullRes.ok) {
        const orderData = await orderPullRes.json();
        const pendingOrders = orderData.orders || [];

        if (pendingOrders.length > 0) {
          console.log(`Fetched ${pendingOrders.length} pending orders from website.`);
          const processedOrderIds: number[] = [];

          const currentProducts = await db.getProducts();

          for (const order of pendingOrders) {
            // Find or create customer
            let customerId: number;
            const customers = await db.getCustomers();
            const email = order.customer?.email;
            const phone = order.customer?.phone;
            
            const existingCustomer = customers.find(
              c => (phone && c.phone === phone) || (email && c.email === email)
            );

            if (existingCustomer) {
              customerId = existingCustomer.id;
              await db.updateCustomer(customerId, {
                type: 'online',
                address: order.customer?.shipping_address
              });
            } else {
              customerId = await db.createCustomer({
                name: order.customer?.name || 'Online Customer',
                phone: phone || '',
                email: email,
                address: order.customer?.shipping_address,
                type: 'online'
              });
            }

            // Prepare items and reduce stock locally
            const billItems: BillItem[] = [];
            let totalAmount = 0;

            const taxableAmount = Math.max(0, Number(order.final_amount || 0) - Number(order.gst_amount || 0));
            const derivedGstRateRaw = taxableAmount > 0
              ? (Number(order.gst_amount || 0) / taxableAmount) * 100
              : Number(settings.gstPercentage || 18);
            const derivedGstRate = Number(derivedGstRateRaw.toFixed(2));

            for (const item of (order.items || [])) {
              // Match product locally on Barcode or SKU code (avoiding database ID collision)
              const product = currentProducts.find(
                p => (item.barcode && p.barcode === item.barcode) || (item.sku_code && p.skuCode === item.sku_code)
              );

              if (product) {
                const itemTotal = item.price * item.quantity;
                totalAmount += itemTotal;

                billItems.push({
                  id: Date.now() + Math.random(),
                  billId: 0, // will be set by createBill
                  productId: product.id,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  discount: 0,
                  gst: derivedGstRate,
                  totalPrice: itemTotal,
                  product, // store reference to product for rendering
                  productImage: item.product_image
                });
              }
            }

            // Map payment method to 'cod' or 'online' or other valid POS payment method
            let mappedPaymentMethod: any = 'online';
            if (order.payment_method) {
              const methodLower = order.payment_method.toLowerCase();
              if (['cod', 'cash', 'card', 'upi', 'credit', 'other'].includes(methodLower)) {
                mappedPaymentMethod = methodLower;
              }
            }

            // Find the updated customer details to embed in the bill object
            const currentCustomers = await db.getCustomers();
            const customerObj = currentCustomers.find(c => c.id === customerId);

            // Create POS Customer Bill for records
            const onlineOrderNumber = (order as any).online_order_number ?? order.id;
            const formattedOrderNumber = String(onlineOrderNumber).padStart(6, '0');

            await db.createBill({
              id: 0,
              billNumber: `EC-CUST-${formattedOrderNumber}`,
              customerId,
              customer: customerObj,
              totalAmount: totalAmount,
              totalDiscount: order.discount_amount || 0,
              totalGst: order.gst_amount || 0,
              finalAmount: order.final_amount,
              paymentMethod: mappedPaymentMethod,
              status: 'completed',
              salesChannel: 'ecommerce',
              invoiceType: 'customer_bill',
              items: billItems,
              createdAt: order.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              shippingCharge: (order as any).shipping_charge || 0,
              shippingGst: (order as any).shipping_gst || 0
            });

            processedOrderIds.push(order.id);
          }

          // Report processed orders back to website to mark them as synced
          if (processedOrderIds.length > 0) {
            await fetch(`${apiUrl}/billing/sync/orders/mark-synced`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: apiKey,
                order_ids: processedOrderIds
              })
            });
          }

          const api = (window as any).electronAPI;
          if (api?.showAlert) {
            api.showAlert(`Successfully synced ${pendingOrders.length} orders from website!`, 'Sync Complete');
          }
        }
      }

      // Save sync timing log
      const nowStr = new Date().toLocaleString();
      const updatedSettings = {
        ...settings,
        lastSyncTime: nowStr,
        syncStatus: 'Success'
      };
      localStorage.setItem('app_settings', JSON.stringify(updatedSettings));
      console.log('Bidirectional E-Commerce Sync completed successfully.');
      
      // Dispatch custom window event to trigger React hooks to reload from localStorage/backup file
      window.dispatchEvent(new CustomEvent('ecommerce-sync-completed'));

    } catch (e: any) {
      console.error('E-Commerce Sync error:', e);
      try {
        const raw = localStorage.getItem('app_settings');
        if (raw) {
          const settings = JSON.parse(raw);
          localStorage.setItem('app_settings', JSON.stringify({
            ...settings,
            syncStatus: `Failed: ${e.message || String(e)}`
          }));
        }
      } catch {}
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // Run sync on startup
    performSync();

    let timer: any = null;
    let lastSyncTime = Date.now();

    const tick = async () => {
      // Load latest interval from localStorage
      let intervalSeconds = 10;
      try {
        const raw = localStorage.getItem('app_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.ecommerceSyncInterval !== undefined) {
            intervalSeconds = Math.max(5, parseInt(parsed.ecommerceSyncInterval) || 10);
          }
        }
      } catch {}

      const elapsed = (Date.now() - lastSyncTime) / 1000;
      if (elapsed >= intervalSeconds) {
        await performSync();
        lastSyncTime = Date.now();
      }

      timer = setTimeout(tick, 1000); // Check every second
    };

    timer = setTimeout(tick, 1000);

    const heartbeatTimer = setInterval(() => {
      sendHeartbeat();
    }, 20000);

    sendHeartbeat();

    // Bind custom window event listener for manual triggers from Settings page
    const handleManualSync = async () => {
      await performSync();
      lastSyncTime = Date.now();
    };
    window.addEventListener('trigger-ecommerce-sync', handleManualSync);

    return () => {
      clearTimeout(timer);
      clearInterval(heartbeatTimer);
      window.removeEventListener('trigger-ecommerce-sync', handleManualSync);
    };
  }, [db]);
};
