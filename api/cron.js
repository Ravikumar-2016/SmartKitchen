import { db } from './_lib/firebase-admin.js';
import admin from 'firebase-admin';

const NOISE_THRESHOLD = 5.0;
const MAX_REASONABLE_DROP = 2000.0;
const MIN_POINTS_OK = 4;
const BOX_TARE_WEIGHT = 25.0;

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatISTString(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export default async function handler(request, response) {
  // Authorization check
  const authHeader = request.headers.authorization;
  const queryKey = request.query.key;
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret) {
    const isAuthorized = 
      authHeader === `Bearer ${expectedSecret}` || 
      queryKey === expectedSecret;

    if (!isAuthorized) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
  }

  // 1. Calculate IST Window (Asia/Kolkata)
  // Vercel server is UTC. IST = UTC + 5:30.
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  // Round down to nearest 6-minute boundary
  const minutes = istNow.getUTCMinutes();
  const roundedMinutes = Math.floor(minutes / 6) * 6;
  
  const windowEndIST = new Date(istNow);
  windowEndIST.setUTCMinutes(roundedMinutes, 0, 0);
  windowEndIST.setUTCSeconds(0, 0);

  const windowStartIST = new Date(windowEndIST.getTime() - (6 * 60 * 1000));
  
  // Timestamps for Firestore query (assuming ts is absolute/UTC milliseconds)
  const windowStart = windowStartIST.getTime() - istOffset;
  const windowEnd = windowEndIST.getTime() - istOffset;

  // Format IST date string for storage
  const dateStr = formatISTString(windowStartIST);

  console.log('Starting 6-minute simulation aggregation', { 
    istNow: istNow.toISOString(),
    windowStartIST: windowStartIST.toISOString(),
    windowEndIST: windowEndIST.toISOString(),
    windowStart,
    windowEnd
  });

  try {
    // Identify all device/item pairs from slots
    const slotsSnapshot = await db.collectionGroup('slots').get();
    
    if (slotsSnapshot.empty) {
      return response.status(200).json({ status: 'No items to process' });
    }

    const results = [];

    for (const slotDoc of slotsSnapshot.docs) {
      const itemId = slotDoc.id; 
      const deviceId = slotDoc.ref.parent.parent.id; // mac_id
      
      if (!deviceId || !itemId) continue;

      try {
        // Step 1: Fetch readings from Kitchen_Readings subcollection
        const readingsRef = db.collection('Kitchen_Readings').doc(deviceId).collection(itemId);
        
        // Use string comparison for the window (format: YYYY-MM-DD HH:mm:ss)
        const startStr = formatISTString(windowStartIST);
        const endStr = formatISTString(windowEndIST);

        const querySnapshot = await readingsRef
          .where('timestamp', '>=', startStr)
          .where('timestamp', '<', endStr)
          .orderBy('timestamp', 'asc')
          .get();

        const readings = [];
        querySnapshot.forEach(doc => {
          readings.push({ id: doc.id, ...doc.data() });
        });

        let total_consumption = 0;
        let total_refill = 0;
        let valid_deltas = 0;
        let status = "OK";

        // Step 1.5: Smart Persistent Consumption Logic
        const itemRef = db.collection('items').doc(deviceId).collection('slots').doc(itemId);
        const itemDoc = await itemRef.get();
        const itemData = itemDoc.exists ? itemDoc.data() : {};

        let persistentWeight = Number(itemData.persistent_weight ?? 0);
        let avgConsumption = Number(itemData.avg_consumption ?? 0);

        // Find the latest "settled" weight in this window (last reading >= 5g, box is on scale)
        let settledWeight = null;
        for (let i = readings.length - 1; i >= 0; i--) {
          const wRaw = Number(readings[i].weight);
          if (wRaw >= 10) { // If raw weight is > 10g, box is likely on scale
            settledWeight = Math.max(0, wRaw - BOX_TARE_WEIGHT);
            break;
          }
        }

        let current_window_consumption = 0;

        if (settledWeight !== null) {
          // FIRST TIME PLACEMENT: persistent_weight was never set (is 0)
          // Rule: previous weight = current weight on first placement → skip consumption
          if (persistentWeight === 0) {
            persistentWeight = settledWeight; // Initialize previous = current
            console.log(`[${deviceId}/${itemId}] First placement: setting persistent_weight = ${settledWeight}g`);
          } else {
            const diff = persistentWeight - settledWeight;
            
            if (diff >= 5) {
              // Valid Consumption Event: current < previous by 5g or more
              current_window_consumption = diff;
              
              // Smart Average (EMA): NewAvg = (consumed * 0.3) + (oldAvg * 0.7)
              if (avgConsumption === 0) {
                avgConsumption = current_window_consumption;
              } else {
                avgConsumption = (current_window_consumption * 0.3) + (avgConsumption * 0.7);
              }
              
              // Update previous weight to current (box is now lighter)
              persistentWeight = settledWeight;
              console.log(`[${deviceId}/${itemId}] Consumption: ${diff}g, avgNow=${round2(avgConsumption)}g/use`);
            } else if (diff <= -10) {
              // Refill Detected: weight increased significantly → just update previous, no consumption
              persistentWeight = settledWeight;
              console.log(`[${deviceId}/${itemId}] Refill detected: previous=${persistentWeight}g → ${settledWeight}g`);
            }
            // else: diff between -10 and +5 → noise, ignore completely
          }
        }

        // Calculate Dynamic Threshold (2 days = avg * 2, default to 20g)
        const dynamicThreshold = avgConsumption > 0 ? round2(avgConsumption * 2) : 20;

        // Calculate Days Left (Default to 30 if no avg yet)
        const daysLeft = avgConsumption > 0 ? Math.floor(settledWeight / avgConsumption) : 30;

        // Update Item Document (Maintain all 5 core variables)
        await itemRef.set({
          current_quantity: settledWeight !== null ? settledWeight : itemData.current_quantity,
          persistent_weight: persistentWeight,
          avg_consumption: round2(avgConsumption),
          days_left: daysLeft,
          threshold: dynamicThreshold,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Generate Alert & Shopping List if below threshold
        if (settledWeight !== null && settledWeight <= dynamicThreshold && dynamicThreshold > 0) {
           await generateSmartAlert(deviceId, itemId, itemData.name, settledWeight, dynamicThreshold);
        }

        // Step 2: Idempotent store in days_consumption
        const docId = `${deviceId}_${itemId}_${windowStart}`;
        const consumptionLog = {
          device_id: deviceId,
          item_id: itemId,
          date: dateStr,
          window_start_ts: windowStart,
          consumption: round2(current_window_consumption),
          avg_at_time: round2(avgConsumption),
          current_weight: settledWeight,
          threshold_at_time: dynamicThreshold,
          status: status,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('days_consumption').doc(docId).set(consumptionLog);

        /* Step 3: Delete processed readings - DISABLED PER USER REQUEST FOR NO DATA LOSS
        if (readings.length > 0) {
          const batch = db.batch();
          querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        */

        results.push({ deviceId, itemId, readings: readings.length, consumption: total_consumption });

      } catch (itemErr) {
        console.error(`Error processing ${deviceId}/${itemId}:`, itemErr);
      }
    }

    return response.status(200).json({ 
      status: 'Success', 
      window: { start: dateStr, ts: windowStart },
      processed: results.length 
    });

  } catch (err) {
    console.error('Simulation Cron failed:', err);
    return response.status(500).json({ error: err.message });
  }
}

async function generateSmartAlert(deviceId, itemId, itemName, currentWeight, threshold) {
  const alertId = `${deviceId}_${itemId}_low_stock`;
  const alertRef = db.collection('items').doc(deviceId).collection('alerts').doc(alertId);
  
  // 1. Create Alert
  await alertRef.set({
    type: 'LOW_STOCK',
    item_id: itemId,
    message: `Smart Alert: ${itemName} is below your 2-day threshold (${currentWeight}g < ${threshold}g).`,
    status: 'unread',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Add to Shopping List
  const shopId = `${deviceId}_${itemId}`;
  await db.collection('items').doc(deviceId).collection('shopping_list').doc(shopId).set({
    name: itemName,
    item_id: itemId,
    needed_quantity: Math.max(0, 1000 - currentWeight), // Default to 1kg capacity
    status: 'pending',
    added_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
