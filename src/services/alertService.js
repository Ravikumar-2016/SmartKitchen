import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore'
import { db } from './firebase'
import { fetchItemsByDeviceId } from './itemService'

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
      alerts.push({
        device_id: deviceId,
        item_id: item.id,
        item_name: item.name,
        type: 'LOW_STOCK',
        message: `${item.name} is running low (${item.current_quantity}${item.unit || ''} remaining)`,
        created_at: serverTimestamp()
      })
    }

    // 2. Check Expiry
    if (item.expiry_date) {
      const expiryDate = new Date(item.expiry_date)
      if (expiryDate <= expiryThreshold) {
        const isExpired = expiryDate <= today
        alerts.push({
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

  // Optional: Deduplicate or clear old alerts before adding new ones
  // For simplicity now, we just return the alerts and let the caller handle persistence
  // or we can persist them here. Let's persist them.
  await syncAlertsToFirestore(deviceId, alerts)

  return alerts
}

async function syncAlertsToFirestore(deviceId, newAlerts) {
  const alertsRef = collection(db, 'alerts')
  
  // 1. Clear existing alerts for this device to prevent duplicates
  const q = query(alertsRef, where('device_id', '==', deviceId))
  const existingAlerts = await getDocs(q)
  
  const deletePromises = existingAlerts.docs.map(d => deleteDoc(doc(db, 'alerts', d.id)))
  await Promise.all(deletePromises)

  // 2. Add new unique alerts
  const addPromises = newAlerts.map(alert => addDoc(alertsRef, alert))
  await Promise.all(addPromises)
}

export async function fetchAlerts(deviceId) {
  if (!deviceId) return []
  const alertsRef = collection(db, 'alerts')
  const q = query(alertsRef, where('device_id', '==', deviceId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
