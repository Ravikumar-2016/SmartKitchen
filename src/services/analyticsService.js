import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { ITEM_SLOTS } from './itemService'

/**
 * Aggregates refill history into monthly consumption data.
 * Store in analytics/{deviceId}/{monthKey}
 */
export async function updateMonthlyAnalytics(deviceId) {
  if (!deviceId) return

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  
  const consumption = {}
  
  // Initialize slots
  ITEM_SLOTS.forEach(slot => {
    consumption[slot] = { total_consumed: 0, refill_count: 0 }
  })

  // We need to fetch ALL refills for ALL slots for this device
  // However, refills are subcollections of slots.
  // This is inefficient. In a flattened model, we'd have a global refills collection.
  // For now, we iterate through the defined slots.
  
  for (const slotId of ITEM_SLOTS) {
    const refillsRef = collection(db, 'items', deviceId, 'slots', slotId, 'refills')
    const snap = await getDocs(refillsRef)
    
    snap.forEach(d => {
      const data = d.data()
      // We check if the refill was in this month
      if (data.timestamp) {
        const date = data.timestamp.toDate()
        const dKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        if (dKey === monthKey) {
          // Calculation: previous_quantity + quantity_added - updated_quantity? 
          // Actually, consumption is hard to track without knowing the current weight daily.
          // Simplest is track sum of quantity_added as a proxy for consumption.
          consumption[slotId].total_consumed += (data.quantity_added || 0)
          consumption[slotId].refill_count += 1
        }
      }
    })
  }

  const analyticsRef = doc(db, 'analytics', deviceId, 'months', monthKey)
  await setDoc(analyticsRef, {
    device_id: deviceId,
    month: monthKey,
    consumption,
    updated_at: serverTimestamp()
  }, { merge: true })

  return consumption
}

export async function fetchMonthlyAnalytics(deviceId) {
  if (!deviceId) return []
  const monthsRef = collection(db, 'analytics', deviceId, 'months')
  const q = query(monthsRef, orderBy('month', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
