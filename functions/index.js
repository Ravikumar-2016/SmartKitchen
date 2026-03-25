const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database')
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
