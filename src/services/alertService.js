import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  deleteDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import { fetchItemsByDeviceId } from './itemService'

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

/**
 * Checks all items for a device and generates alerts for:
 * 1. Low stock (below threshold)
 * 2. Near expiry (within 7 days)
 */
export async function evaluateInventory(deviceId) {
  if (!deviceId) return []

  const items = await fetchItemsByDeviceId(deviceId)
  const alerts = []
  const today = new Date()
  const expiryThreshold = new Date()
  expiryThreshold.setDate(today.getDate() + 7)

  items.forEach(item => {
    // 1. Check Low Stock
    if (item.current_quantity <= item.threshold && item.threshold > 0) {
      const amountToBuy = Math.max(0, item.capacity - item.current_quantity)
      alerts.push({
        id: `${deviceId}_${item.id}_LOW_STOCK`,
        device_id: deviceId,
        item_id: item.id,
        item_name: item.name,
        type: 'LOW_STOCK',
        message: `${item.name} is running low. Please purchase ${round2(amountToBuy)}${item.unit || 'g'} to refill.`,
        created_at: serverTimestamp()
      })
    }

    // 2. Check Expiry
    if (item.expiry_date) {
      const expiryDate = new Date(item.expiry_date)
      if (expiryDate <= expiryThreshold) {
        const isExpired = expiryDate <= today
        alerts.push({
          id: `${deviceId}_${item.id}_EXPIRY`,
          device_id: deviceId,
          item_id: item.id,
          item_name: item.name,
          type: 'EXPIRY',
          message: isExpired 
            ? `${item.name} expired on ${item.expiry_date}` 
            : `${item.name} is expiring soon (${item.expiry_date})`,
          created_at: serverTimestamp()
        })
      }
    }
  })

  await syncAlertsToFirestore(deviceId, alerts)

  return alerts
}

import { setDoc } from 'firebase/firestore'

async function syncAlertsToFirestore(deviceId, newAlerts) {
  const alertsRef = collection(db, 'alerts')
  
  // 1. Fetch existing alerts for this device
  const q = query(alertsRef, where('device_id', '==', deviceId))
  const existingAlerts = await getDocs(q)
  
  const newAlertIds = new Set(newAlerts.map(a => a.id))
  
  const promises = []

  // 2. Delete alerts that are no longer active
  existingAlerts.docs.forEach(d => {
    if (!newAlertIds.has(d.id)) {
      promises.push(deleteDoc(doc(db, 'alerts', d.id)))
    }
  })

  // 3. Upsert new/active alerts using deterministic IDs
  newAlerts.forEach(alert => {
    const { id, ...alertData } = alert
    promises.push(setDoc(doc(db, 'alerts', id), alertData, { merge: true }))
  })

  await Promise.all(promises)
}

export async function fetchAlerts(deviceId) {
  if (!deviceId) return []
  const alertsRef = collection(db, 'alerts')
  const q = query(alertsRef, where('device_id', '==', deviceId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function subscribeToAlerts(deviceId, onUpdate) {
  if (!deviceId) return () => {}
  const alertsRef = collection(db, 'alerts')
  const q = query(alertsRef, where('device_id', '==', deviceId))
  
  return onSnapshot(q, (snap) => {
    const updatedAlerts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    onUpdate(updatedAlerts)
  })
}
