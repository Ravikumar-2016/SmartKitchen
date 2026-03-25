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

const ITEM_SLOTS = ['item_1', 'item_2', 'item_3', 'item_4']

function toNumber(value) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function normalizeDeviceId(value) {
  return String(value ?? '').trim()
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
  const deviceId = normalizeDeviceId(payload?.deviceId)
  const itemId = normalizeSlot(payload?.itemId)
  const expiryDate = payload?.expiry_date?.trim() || payload?.expiryDate?.trim()

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

  // Items are stored per-device in a fixed slot doc (item_1..item_4).
  const itemRef = doc(db, 'devices', deviceId, 'items', itemId)

  await setDoc(
    itemRef,
    {
      name,
      capacity,
      threshold,
      expiry_date: expiryDate,
      current_quantity: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  )

  return itemId
}

export async function fetchItemsByDeviceId(deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
  if (!normalizedDeviceId) return []

  const itemsRef = collection(db, 'devices', normalizedDeviceId, 'items')
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

export async function handleRefill({ deviceId, itemId, refill_type, quantity_input }) {
  const normalizedDeviceId = normalizeDeviceId(deviceId)
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

  const itemRef = doc(db, 'devices', normalizedDeviceId, 'items', normalizedItemId)
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

  // reset: starts from zero, normal: adds to current quantity.
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

  // Store refill history before updating the source-of-truth quantity.
  const refillsRef = collection(itemRef, 'refills')
  await addDoc(refillsRef, refillPayload)

  await updateDoc(itemRef, {
    current_quantity: updatedQuantity,
    updated_at: serverTimestamp(),
  })

  return {
    previous_quantity: previousQuantity,
    updated_quantity: updatedQuantity,
    quantity_added: quantityInput,
    refill_type: refillType,
  }
}

// Backward-compatible alias for older callers.
export async function logRefillEvent({ deviceId, itemId, newQuantity }) {
  return handleRefill({
    deviceId,
    itemId,
    refill_type: 'reset',
    quantity_input: newQuantity,
  })
}

export { ITEM_SLOTS }
