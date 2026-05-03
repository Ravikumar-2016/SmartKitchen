import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  increment
} from 'firebase/firestore'

import { db } from './firebase'
import { formatDeviceId } from '../utils/deviceId'
import { evaluateInventory } from './alertService'
import { syncShoppingList } from './shoppingService'
import { updateMonthlyAnalytics } from './analyticsService'

const ITEM_SLOTS = ['item_1', 'item_2', 'item_3', 'item_4']
const NOISE_THRESHOLD = 4.0
const BOX_TARE_WEIGHT = 25.0

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

/**
 * Called every time a new live weight arrives for a slot.
 * Computes consumption, updates avg, threshold, days_left, and writes to Firestore.
 * Returns the updated item fields so the UI can reflect them immediately.
 */
export async function processConsumptionEvent(deviceId, itemId, newWeight) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return null

  const itemRef = doc(db, 'items', normalizedDeviceId, 'slots', itemId)
  const itemSnap = await getDoc(itemRef)
  if (!itemSnap.exists()) return null

  const data = itemSnap.data()
  let persistentWeight = Number(data.persistent_weight ?? 0)
  let avgConsumption   = Number(data.avg_consumption   ?? 0)

  const rawWeight = Number(newWeight)
  if (isNaN(rawWeight)) return null
  
  // Real weight is live weight minus box weight (25g)
  const curr = Math.max(0, rawWeight - BOX_TARE_WEIGHT)

  let consumed = 0
  const batch = writeBatch(db)

  if (persistentWeight === 0) {
    persistentWeight = curr
  } else {
    const diff = persistentWeight - curr
    if (diff >= NOISE_THRESHOLD) {
      consumed = diff
      
      // Smart Average (EMA): NewAvg = (consumed * 0.3) + (oldAvg * 0.7)
      // This adapts to habit changes faster than a simple average.
      if (avgConsumption === 0) {
        avgConsumption = consumed
      } else {
        avgConsumption = (consumed * 0.3) + (avgConsumption * 0.7)
      }

      persistentWeight = curr
      
      // --- NEW: Track atomic monthly consumption (20 events = 1 month/cycle) ---
      const stateRef = doc(db, 'analytics', normalizedDeviceId, 'state')
      const stateSnap = await getDoc(stateRef)
      let currentCycle = 1
      let eventCount = 0

      if (stateSnap.exists()) {
        currentCycle = stateSnap.data().current_cycle || 1
        eventCount = stateSnap.data().cycle_event_count || 0
      }

      eventCount += 1
      if (eventCount > 20) {
        currentCycle += 1
        eventCount = 1
      }

      batch.set(stateRef, {
        current_cycle: currentCycle,
        cycle_event_count: eventCount,
        updated_at: serverTimestamp()
      }, { merge: true })

      const monthKey = `Cycle ${currentCycle}`
      const analyticsRef = doc(db, 'analytics', normalizedDeviceId, 'months', monthKey)
      
      batch.set(analyticsRef, {
        device_id: normalizedDeviceId,
        month: monthKey,
        [`consumption.${itemId}.total_consumed`]: increment(consumed),
        updated_at: serverTimestamp()
      }, { merge: true })

    } else if (diff <= -10) {
      persistentWeight = curr
    }
  }

  const dynamicThreshold = avgConsumption > 0 ? round2(avgConsumption * 2) : 20
  const daysLeft = avgConsumption > 0 ? Math.floor(curr / avgConsumption) : 30

  const updates = {
    current_quantity:  round2(curr),
    persistent_weight: round2(persistentWeight),
    avg_consumption:   round2(avgConsumption),
    threshold:         dynamicThreshold,
    days_left:         daysLeft,
    updated_at:        serverTimestamp(),
  }

  // Add main item update to batch
  batch.set(itemRef, updates, { merge: true })

  // --- Recalculate ALL other slots' derived metrics ---
  // We use Promise.all to fetch them, but batch.set to update them
  const otherSlotsSnapshots = await Promise.all(
    ITEM_SLOTS
      .filter(sid => sid !== itemId)
      .map(sid => getDoc(doc(db, 'items', normalizedDeviceId, 'slots', sid)))
  )

  otherSlotsSnapshots.forEach(sSnap => {
    if (!sSnap.exists()) return
    const sid = sSnap.id
    const sd = sSnap.data()
    const sRef = doc(db, 'items', normalizedDeviceId, 'slots', sid)
    
    const sQty = Number(sd.current_quantity ?? 0)
    const sAvg = Number(sd.avg_consumption ?? 0)

    const sThr  = sAvg > 0 ? round2(sAvg * 2) : (sd.threshold ?? 20)
    const sDays = sAvg > 0 ? Math.floor(sQty / sAvg) : (sd.days_left ?? 30)
    
    batch.set(sRef, {
      threshold: sThr,
      days_left: sDays,
      updated_at: serverTimestamp(),
    }, { merge: true })
  })

  // Commit everything at once for a single UI refresh
  await batch.commit()

  // --- Trigger full inventory sync (alerts, shopping list, analytics) ---
  try {
    await triggerInventorySync(normalizedDeviceId)
  } catch (err) {
    console.warn('Inventory sync failed (non-blocking):', err)
  }

  return updates
}


/**
 * Triggers all background sync operations for a device.
 */
async function triggerInventorySync(deviceId) {
  if (!deviceId) return
  // We don't await these to prevent blocking the UI, 
  // but for reliability in some cases we might.
  await Promise.all([
    evaluateInventory(deviceId),
    syncShoppingList(deviceId),
    updateMonthlyAnalytics(deviceId)
  ])
}

/**
 * Ensures that the device document exists in the top-level 'items' collection.
 */
async function ensureDeviceDocument(deviceId) {
  const deviceRef = doc(db, 'items', deviceId)
  const snap = await getDoc(deviceRef)

  if (!snap.exists()) {
    await setDoc(deviceRef, {
      device_id: deviceId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      status: 'active'
    })
  } else {
    await updateDoc(deviceRef, {
      updated_at: serverTimestamp()
    })
  }
}

function toNumber(value) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function normalizeDeviceId(value) {
  return formatDeviceId(value)
}

function normalizeSlot(value) {
  const slot = String(value ?? '').trim().toLowerCase()
  if (!ITEM_SLOTS.includes(slot)) {
    throw new Error('Slot must be one of item_1, item_2, item_3, item_4.')
  }
  return slot
}

export async function createItem(payload) {
  const name = payload?.name?.trim()
  const deviceId = normalizeDeviceId(payload?.device_id)
  const itemId = normalizeSlot(payload?.itemId)
  const expiryDate = payload?.expiry_date?.trim() || payload?.expiryDate?.trim()
  const unit = payload?.unit || 'g'

  const capacity = toNumber(payload?.capacity)
  const threshold = toNumber(payload?.threshold ?? payload?.thresholdWeight)

  if (!name) throw new Error('Item name is required.')
  if (!deviceId) throw new Error('Device ID is required.')
  if (!capacity || capacity <= 0) throw new Error('Capacity must be greater than zero.')
  if (threshold == null || threshold < 0) {
    throw new Error('Threshold weight must be 0 or more.')
  }
  if (threshold > capacity) {
    throw new Error('Threshold weight cannot be greater than capacity.')
  }
  if (!expiryDate) throw new Error('Expiry date is required.')

  await ensureDeviceDocument(deviceId)

  const itemRef = doc(db, 'items', deviceId, 'slots', itemId)

  await setDoc(
    itemRef,
    {
      name,
      capacity,
      threshold: 20, // Initial default, will be updated by AI logic
      unit,
      expiry_date: expiryDate,
      current_quantity: 0,
      persistent_weight: 0,
      avg_consumption: 0,
      total_consumed: 0,
      first_usage_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  )

  await triggerInventorySync(deviceId)
  return itemId
}

export async function fetchLatestWeights(deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return {}

  const readingsRef = collection(db, 'Kitchen_Readings')
  const latestWeights = {}

  try {
    await Promise.all(
      ITEM_SLOTS.map(async (itemId) => {
        // Query nested subcollection: Kitchen_Readings/{deviceId}/{itemId}
        const itemReadingsRef = collection(db, 'Kitchen_Readings', normalizedDeviceId, itemId)
        const q = query(
          itemReadingsRef,
          orderBy('timestamp', 'desc'),
          limit(1)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          latestWeights[itemId] = snap.docs[0].data().weight
        }
      })
    )
  } catch (err) {
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      console.warn('Firestore index missing for kitchen_Readings. Real-time weights will be unavailable until index is created.')
    } else {
      console.error('Error fetching latest weights:', err)
    }
  }

  return latestWeights
}

export function subscribeToLatestWeights(deviceId, onUpdate) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return () => {}

  const unsubscribers = ITEM_SLOTS.map((itemId) => {
    const itemReadingsRef = collection(db, 'Kitchen_Readings', normalizedDeviceId, itemId)
    const q = query(itemReadingsRef, orderBy('timestamp', 'desc'), limit(1))
    
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        onUpdate(itemId, snap.docs[0].data().weight)
      }
    }, (err) => {
      console.error(`Subscription error for ${itemId}:`, err)
    })
  })

  return () => unsubscribers.forEach(unsub => unsub())
}

export function subscribeToItems(deviceId, onUpdate) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return () => {}

  const itemsRef = collection(db, 'items', normalizedDeviceId, 'slots')
  return onSnapshot(itemsRef, (snap) => {
    const updatedItems = {}
    snap.docs.forEach(doc => {
      updatedItems[doc.id] = { id: doc.id, ...doc.data() }
    })
    onUpdate(updatedItems)
  })
}

export async function fetchItemsByDeviceId(deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return []

  const itemsRef = collection(db, 'items', normalizedDeviceId, 'slots')
  const [snap, latestWeights] = await Promise.all([
    getDocs(itemsRef),
    fetchLatestWeights(normalizedDeviceId)
  ])

  const order = new Map(ITEM_SLOTS.map((slot, idx) => [slot, idx]))
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data()
      const slot = data?.item_id ?? data?.itemId ?? docSnap.id
      
      // Use latest weight from readings if available, otherwise fallback to current_quantity
      const liveWeightRaw = latestWeights[slot]
      const liveWeight = liveWeightRaw !== undefined ? Math.max(0, liveWeightRaw - BOX_TARE_WEIGHT) : undefined
      const currentQuantity = liveWeight !== undefined ? liveWeight : toNumber(data?.current_quantity)

      return {
        id: slot,
        ...data,
        item_id: slot,
        itemId: slot,
        itemCode: slot,
        current_quantity: currentQuantity ?? 0,
        current_weight: currentQuantity ?? 0,
        threshold: data?.threshold ?? 0,
        avg_consumption: data?.avg_consumption ?? 0,
        consumption_count: data?.consumption_count ?? 0,
        persistent_weight: data?.persistent_weight ?? 0,
        days_left: data?.days_left ?? 30,
        is_live: liveWeight !== undefined
      }
    })
    .sort((a, b) => {
      return (order.get(a.item_id) ?? 999) - (order.get(b.item_id) ?? 999)
    })
}


export async function handleRefill({ device_id, itemId, refill_type, quantity_input }) {
  const normalizedDeviceId = normalizeDeviceId(device_id)
  const normalizedItemId = normalizeSlot(itemId)
  const refillType = String(refill_type ?? '').trim().toLowerCase()
  const quantityInput = toNumber(quantity_input)

  if (!normalizedDeviceId) {
    throw new Error('Device ID is required for refill.')
  }
  if (refillType !== 'normal' && refillType !== 'reset') {
    throw new Error('refill_type must be either "normal" or "reset".')
  }
  if (quantityInput == null || quantityInput <= 0) {
    throw new Error('quantity_input must be greater than zero.')
  }

  const itemRef = doc(db, 'items', normalizedDeviceId, 'slots', normalizedItemId)
  const itemSnap = await getDoc(itemRef)
  if (!itemSnap.exists()) {
    throw new Error('Item does not exist for this device.')
  }

  const itemData = itemSnap.data() || {}
  const previousQuantity = toNumber(itemData.current_quantity) ?? 0
  const capacity = toNumber(itemData.capacity)

  if (capacity == null || capacity <= 0) {
    throw new Error('Item capacity is missing or invalid.')
  }

  const updatedQuantity = refillType === 'reset'
    ? quantityInput
    : previousQuantity + quantityInput

  if (updatedQuantity > capacity) {
    throw new Error(`Updated quantity cannot exceed capacity (${capacity}).`)
  }

  const refillPayload = {
    previous_quantity: previousQuantity,
    updated_quantity: updatedQuantity,
    quantity_added: quantityInput,
    refill_type: refillType,
    timestamp: serverTimestamp(),
  }

  const refillsRef = collection(itemRef, 'refills')
  await addDoc(refillsRef, refillPayload)

  await updateDoc(itemRef, {
    current_quantity: updatedQuantity,
    updated_at: serverTimestamp(),
  })

  await triggerInventorySync(normalizedDeviceId)

  return {
    previous_quantity: previousQuantity,
    updated_quantity: updatedQuantity,
    quantity_added: quantityInput,
    refill_type: refillType,
  }
}

export async function logRefillEvent({ device_id, itemId, newQuantity }) {
  return handleRefill({
    device_id,
    itemId,
    refill_type: 'reset',
    quantity_input: newQuantity,
  })
}

export async function resetDeviceSmartVariables(deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return

  const promises = []

  // 1. Reset all AI variables on every slot + delete their refills & Kitchen_Readings
  const slotsRef = collection(db, 'items', normalizedDeviceId, 'slots')
  const slotsSnap = await getDocs(slotsRef)
  for (const docSnap of slotsSnap.docs) {
    const slotId = docSnap.id
    const itemRef = doc(db, 'items', normalizedDeviceId, 'slots', slotId)

    // Reset AI fields on the slot document
    promises.push(updateDoc(itemRef, {
      avg_consumption: 0,
      persistent_weight: 0,
      threshold: 20,
      days_left: 30,
      updated_at: serverTimestamp()
    }))

    // Delete all refill history for this slot
    const refillsRef = collection(itemRef, 'refills')
    const refillsSnap = await getDocs(refillsRef)
    refillsSnap.docs.forEach((d) => {
      promises.push(deleteDoc(d.ref))
    })

    // Delete all Kitchen_Readings for this slot
    const readingsRef = collection(db, 'Kitchen_Readings', normalizedDeviceId, slotId)
    const readingsSnap = await getDocs(readingsRef)
    readingsSnap.docs.forEach((d) => {
      promises.push(deleteDoc(d.ref))
    })
  }

  // 2. Delete days_consumption records for this device
  const consumptionRef = collection(db, 'days_consumption')
  const consumptionQ = query(consumptionRef, where('device_id', '==', normalizedDeviceId))
  const consumptionSnap = await getDocs(consumptionQ)
  consumptionSnap.docs.forEach((d) => {
    promises.push(deleteDoc(doc(db, 'days_consumption', d.id)))
  })

  // 3. Delete all analytics months for this device
  const analyticsRef = collection(db, 'analytics', normalizedDeviceId, 'months')
  const analyticsSnap = await getDocs(analyticsRef)
  analyticsSnap.docs.forEach((d) => {
    promises.push(deleteDoc(d.ref))
  })

  // 4. Clear all alerts (top-level 'alerts' collection)
  const alertsRef = collection(db, 'alerts')
  const alertsQ = query(alertsRef, where('device_id', '==', normalizedDeviceId))
  const alertsSnap = await getDocs(alertsQ)
  alertsSnap.docs.forEach((d) => {
    promises.push(deleteDoc(doc(db, 'alerts', d.id)))
  })

  // 5. Clear shopping list document
  const shopRef = doc(db, 'shopping_lists', normalizedDeviceId)
  promises.push(setDoc(shopRef, { device_id: normalizedDeviceId, items: [], count: 0, updated_at: serverTimestamp() }))

  // 6. Clear backend-generated alerts subcollection (items/{deviceId}/alerts)
  const backendAlertsRef = collection(db, 'items', normalizedDeviceId, 'alerts')
  const backendAlertsSnap = await getDocs(backendAlertsRef)
  backendAlertsSnap.docs.forEach((d) => {
    promises.push(deleteDoc(doc(db, 'items', normalizedDeviceId, 'alerts', d.id)))
  })

  // 7. Clear backend-generated shopping_list subcollection (items/{deviceId}/shopping_list)
  const backendShopRef = collection(db, 'items', normalizedDeviceId, 'shopping_list')
  const backendShopSnap = await getDocs(backendShopRef)
  backendShopSnap.docs.forEach((d) => {
    promises.push(deleteDoc(doc(db, 'items', normalizedDeviceId, 'shopping_list', d.id)))
  })

  await Promise.all(promises)
}

export { ITEM_SLOTS }

