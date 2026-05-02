const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()

exports.syncLatestReadingToFirestore = onValueWritten(
  {
    ref: '/devices/{deviceId}/{itemId}/latest_reading',
  },
  async (event) => {
    const { deviceId, itemId } = event.params
    const latestReading = event.data?.after?.val()

    if (latestReading === null || latestReading === undefined) {
      logger.info('latest_reading is null/undefined. Skipping Firestore sync.', {
        deviceId,
        itemId,
      })
      return
    }

    await db
      .collection('devices')
      .doc(deviceId)
      .collection('items')
      .doc(itemId)
      .set(
        {
          current_quantity: latestReading,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

    logger.info('Synced latest_reading from RTDB to Firestore.', {
      deviceId,
      itemId,
      latestReading,
    })
  }
)

const NOISE_THRESHOLD_GRAMS = 5
const AUTO_REFILL_THRESHOLD_GRAMS = 1000

exports.aggregateDailyConsumption = onValueCreated(
  {
    ref: '/Devices/{device_id}/{item_id}/{log_id}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const { device_id: deviceId, item_id: itemId, log_id: logId } = event.params
    const currentLog = normalizeReading(event.data?.val())

    if (!currentLog) {
      logger.warn('Skipping malformed log payload', { deviceId, itemId, logId })
      return
    }

    if (!isValidWeight(currentLog.weight)) {
      logger.warn('Skipping reading: invalid or negative weight.', {
        deviceId,
        itemId,
        logId,
        weight: currentLog.weight,
      })
      return
    }

    const date = toDateKey(currentLog.timestamp)
    const dailyDocId = `${deviceId}*${itemId}*${date}`
    const dailyRef = db.collection('daily_logs').doc(dailyDocId)
    const consumptionRef = db.collection('consumption').doc(dailyDocId)
    const itemRef = db.collection('items').doc(`${deviceId}_${itemId}`)

    const [dailySnap, itemSnap] = await Promise.all([dailyRef.get(), itemRef.get()])
    const existingEvents = normalizeEvents(dailySnap.data()?.events)
    const lastEvent = existingEvents.length ? existingEvents[existingEvents.length - 1] : null
    const lastValidReading = findLastValidReading(existingEvents)
    const autoRefillThreshold = getAutoRefillThreshold(itemSnap.data())

    const readingEvent = {
      timestamp: currentLog.timestamp,
      weight: currentLog.weight,
      type: 'reading',
    }

    await dailyRef.set(
      {
        device_id: deviceId,
        item_id: itemId,
        date,
        events: admin.firestore.FieldValue.arrayUnion(readingEvent),
      },
      { merge: true }
    )

    if (String(lastEvent?.type || '').toLowerCase() === 'refill') {
      logger.info('Reading after refill: baseline set, no consumption.', {
        deviceId,
        itemId,
        logId,
      })
      return
    }

    if (!lastValidReading) {
      logger.info('No previous valid reading. Baseline established.', {
        deviceId,
        itemId,
        logId,
      })
      return
    }

    const delta = currentLog.weight - lastValidReading.weight
    const absDelta = Math.abs(delta)

    if (absDelta < NOISE_THRESHOLD_GRAMS) {
      logger.info('Noise filtered out.', {
        deviceId,
        itemId,
        logId,
        delta,
      })
      return
    }

    if (delta > autoRefillThreshold) {
      await dailyRef.set(
        {
          device_id: deviceId,
          item_id: itemId,
          date,
          events: admin.firestore.FieldValue.arrayUnion({
            type: 'refill',
            timestamp: currentLog.timestamp,
          }),
        },
        { merge: true }
      )
      logger.info('Auto refill detected. Consumption not updated.', {
        deviceId,
        itemId,
        logId,
        increasedBy: round2(delta),
        autoRefillThreshold,
      })
      return
    }

    if (delta >= 0) {
      logger.info('Weight increased but below refill threshold; ignored for consumption.', {
        deviceId,
        itemId,
        logId,
        delta,
      })
      return
    }

    const consumed = round2(Math.abs(delta))
    if (consumed <= 0) return

    await consumptionRef.set(
      {
        device_id: deviceId,
        item_id: itemId,
        date,
        total_consumption: admin.firestore.FieldValue.increment(consumed),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    logger.info('Daily consumption incremented.', {
      deviceId,
      itemId,
      logId,
      consumed,
      date,
    })
  }
)

function normalizeReading(input) {
  if (!input || typeof input !== 'object') return null
  const timestamp = toNumber(input.timestamp)
  const weight = toNumber(input.weight)

  return {
    timestamp: timestamp || Date.now(),
    weight,
  }
}

function toNumber(value) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function isValidWeight(weight) {
  return typeof weight === 'number' && Number.isFinite(weight) && weight >= 0
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) return []
  return events.filter((entry) => entry && typeof entry === 'object')
}

function findLastValidReading(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (String(event.type || '').toLowerCase() !== 'reading') continue
    const weight = toNumber(event.weight)
    if (!isValidWeight(weight)) continue
    return { ...event, weight }
  }
  return null
}

function getAutoRefillThreshold(itemData) {
  const fromProcessing = toNumber(itemData?.processing?.auto_refill_delta)
  const fromTopLevel = toNumber(itemData?.auto_refill_threshold)
  return fromProcessing || fromTopLevel || AUTO_REFILL_THRESHOLD_GRAMS
}

function toDateKey(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

function round2(value) {
  return Math.round(value * 100) / 100
}

exports.dailyAggregationPipeline = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'UTC',
    region: 'asia-southeast1',
  },
  async (event) => {
    // 1. Identify Target Date (Previous Day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Start and end of yesterday in UTC
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`).getTime();

    logger.info('Starting dailyAggregationPipeline', { dateStr, startOfDay, endOfDay });

    try {
      // 2. Fetch All Devices/Items
      const itemsSnapshot = await db.collection('items').get();
      if (itemsSnapshot.empty) {
        logger.info('No items found to process.');
        return;
      }

      const itemDocs = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));

      // 3. Process Each Item (Loop)
      for (const itemDoc of itemDocs) {
        const deviceId = itemDoc.data.device_id;
        const itemId = itemDoc.data.item_id;
        const autoRefillThreshold = getAutoRefillThreshold(itemDoc.data);
        const capacity = toNumber(itemDoc.data.capacity) || 10000; // default glitch threshold

        if (!deviceId || !itemId) {
          logger.warn('Skipping malformed item document', { docId: itemDoc.id });
          continue;
        }

        try {
          // Fetch readings from Firestore for this device and item within the time range
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

          // Sort sequentially by timestamp
          readings.sort((a, b) => a.timestamp - b.timestamp);

          const readingsCount = readings.length;
          let dailyConsumption = 0;
          let validEventsCount = 0;
          let totalRefillDetected = 0;

          // 4. Compute Consumption
          if (readingsCount > 1) {
            let previousReading = readings[0];

            for (let i = 1; i < readingsCount; i++) {
              const currentReading = readings[i];
              const delta = currentReading.weight - previousReading.weight;
              const absDelta = Math.abs(delta);

              // Ignore noise
              if (absDelta < NOISE_THRESHOLD_GRAMS) {
                continue;
              }

              if (delta < 0) {
                // Weight decreased -> consumption
                // Check for abnormal large drop (glitch)
                if (absDelta > capacity * 1.5) { 
                  logger.warn('Ignoring abnormal large drop (glitch)', { deviceId, itemId, absDelta, capacity });
                } else {
                  dailyConsumption += absDelta;
                  validEventsCount++;
                }
                previousReading = currentReading; // update baseline
              } else {
                // Weight increased -> refill
                if (delta > autoRefillThreshold) {
                  totalRefillDetected++;
                  previousReading = currentReading; // new baseline after refill
                } else {
                  // Weight increased but below refill threshold (might be slow refill or noise)
                  previousReading = currentReading;
                }
              }
            }
          }

          // 5. Handle Edge Cases / Determine Status
          let status = 'OK';
          if (readingsCount === 0) {
            status = 'MISSING';
          } else if (readingsCount < 72) { // Less than half of expected 144 readings (10-min intervals)
            status = 'PARTIAL';
          }

          // Data Quality Layer: Round to 2 decimal places
          dailyConsumption = round2(dailyConsumption);

          // 6. Store Result
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

          logger.info('Processed daily consumption', { deviceId, itemId, dateStr, dailyConsumption, status });

        } catch (itemErr) {
          logger.error('Error processing item', { deviceId, itemId, error: itemErr.message });
          // skip failed users, continue pipeline
        }
      }

      logger.info('dailyAggregationPipeline completed successfully');

    } catch (err) {
      logger.error('dailyAggregationPipeline failed', { error: err.message });
    }
  }
);
