import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { formatDeviceId } from '../utils/deviceId'
import { evaluateInventory } from './alertService'
import { syncShoppingList } from './shoppingService'
import { updateMonthlyAnalytics } from './analyticsService'

const ITEM_SLOTS = ['item_1', 'item_2', 'item_3', 'item_4']

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
      threshold,
      unit,
      expiry_date: expiryDate,
      current_quantity: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  )

  await triggerInventorySync(deviceId)
  return itemId
}

export async function fetchItemsByDeviceId(deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return []

  const itemsRef = collection(db, 'items', normalizedDeviceId, 'slots')
  const snap = await getDocs(itemsRef)

  const order = new Map(ITEM_SLOTS.map((slot, idx) => [slot, idx]))
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data()
      const slot = data?.item_id ?? data?.itemId ?? docSnap.id
      const currentQuantity = toNumber(data?.current_quantity)
      return {
        id: slot,
        ...data,
        item_id: slot,
        itemId: slot,
        itemCode: slot,
        current_quantity: currentQuantity ?? 0,
        current_weight: currentQuantity ?? 0,
        threshold: data?.threshold ?? null,
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

export { ITEM_SLOTS }

