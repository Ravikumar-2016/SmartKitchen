import { db } from './_lib/firebase-admin.js';
import admin from 'firebase-admin';

const NOISE_THRESHOLD_GRAMS = 5;

function normalizeReading(input) {
  if (!input || typeof input !== 'object') return null;
  const timestamp = Number(input.timestamp);
  const weight = Number(input.weight);
  return { timestamp: timestamp || Date.now(), weight };
}

function isValidWeight(weight) {
  return typeof weight === 'number' && Number.isFinite(weight) && weight >= 0;
}

function toNumber(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function getAutoRefillThreshold(itemData) {
  const fromProcessing = toNumber(itemData?.processing?.auto_refill_delta);
  const fromTopLevel = toNumber(itemData?.auto_refill_threshold);
  return fromProcessing || fromTopLevel || 1000;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export default async function handler(request, response) {
  // Check Vercel CRON_SECRET for security
  if (
    process.env.CRON_SECRET &&
    request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  let targetDate = new Date();
  const queryDate = request.query.date; // e.g., ?date=2026-05-02
  
  if (queryDate) {
    targetDate = new Date(queryDate);
  } else {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`).getTime();

  console.log('Starting daily aggregation via API', { dateStr, startOfDay, endOfDay });

  try {
    const itemsSnapshot = await db.collection('items').get();
    if (itemsSnapshot.empty) {
      return response.status(200).json({ status: 'No items to process' });
    }

    const itemDocs = itemsSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    for (const itemDoc of itemDocs) {
      const deviceId = itemDoc.data.device_id;
      const itemId = itemDoc.data.item_id;
      const autoRefillThreshold = getAutoRefillThreshold(itemDoc.data);
      const capacity = toNumber(itemDoc.data.capacity) || 10000;

      if (!deviceId || !itemId) continue;

      try {
        const logsRef = db.collection('Kitchen_Readings').doc(deviceId).collection(itemId);
        const logsSnapshot = await logsRef
          .where('timestamp', '>=', startOfDay)
          .where('timestamp', '<=', endOfDay)
          .orderBy('timestamp', 'asc')
          .get();

        const readings = [];
        logsSnapshot.forEach(doc => {
          const val = doc.data();
          const normalized = normalizeReading(val);
          if (normalized && isValidWeight(normalized.weight)) {
            readings.push(normalized);
          }
        });

        readings.sort((a, b) => a.timestamp - b.timestamp);

        const readingsCount = readings.length;
        let dailyConsumption = 0;
        let validEventsCount = 0;
        let totalRefillDetected = 0;

        if (readingsCount > 1) {
          let previousReading = readings[0];

          for (let i = 1; i < readingsCount; i++) {
            const currentReading = readings[i];
            const delta = currentReading.weight - previousReading.weight;
            const absDelta = Math.abs(delta);

            if (absDelta < NOISE_THRESHOLD_GRAMS) continue;

            if (delta < 0) {
              if (absDelta > capacity * 1.5) { 
                console.warn('Ignoring abnormal drop', { deviceId, itemId, absDelta });
              } else {
                dailyConsumption += absDelta;
                validEventsCount++;
              }
              previousReading = currentReading;
            } else {
              if (delta > autoRefillThreshold) {
                totalRefillDetected++;
                previousReading = currentReading;
              } else {
                previousReading = currentReading;
              }
            }
          }
        }

        let status = 'OK';
        if (readingsCount === 0) status = 'MISSING';
        else if (readingsCount < 72) status = 'PARTIAL';

        dailyConsumption = round2(dailyConsumption);

        const docId = `${deviceId}_${itemId}_${dateStr}`;
        await db.collection('daily_consumption').doc(docId).set({
          user_id: deviceId, 
          item_id: itemId,
          date: dateStr,
          consumption: dailyConsumption,
          readings_count: readingsCount,
          valid_consumption_events: validEventsCount,
          total_refill_detected: totalRefillDetected,
          status: status,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // 1. Update Monthly Analytics
        const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
        const analyticsRef = db.collection('analytics').doc(deviceId).collection('months').doc(monthKey);
        
        await db.runTransaction(async (transaction) => {
          const monthDoc = await transaction.get(analyticsRef);
          let monthData = monthDoc.exists ? monthDoc.data() : { consumption: {} };
          
          if (!monthData.consumption) monthData.consumption = {};
          if (!monthData.consumption[itemId]) {
            monthData.consumption[itemId] = { total_consumed: 0, refill_count: 0 };
          }

          monthData.consumption[itemId].total_consumed = round2((monthData.consumption[itemId].total_consumed || 0) + dailyConsumption);
          monthData.consumption[itemId].refill_count = (monthData.consumption[itemId].refill_count || 0) + totalRefillDetected;
          
          transaction.set(analyticsRef, {
            ...monthData,
            device_id: deviceId,
            month: monthKey,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        // 2. Remove processed data from Kitchen_Readings
        if (readingsCount > 0) {
          const batch = db.batch();
          logsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`Cleaned up ${readingsCount} readings for ${deviceId}/${itemId}`);
        }

      } catch (itemErr) {
        console.error('Error processing item', { deviceId, itemId, error: itemErr.message });
      }
    }

    return response.status(200).json({ status: 'Success', date: dateStr });
  } catch (err) {
    console.error('Cron failed', err);
    return response.status(500).json({ error: err.message });
  }
}
