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

export async function updateMonthlyAnalytics(deviceId) {
  if (!deviceId) return

  // We now track consumption atomically during processConsumptionEvent in itemService.js.
  // We no longer sum refills as a proxy for consumption.
  // This function is kept to support legacy UI refresh flows.
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const analyticsRef = doc(db, 'analytics', deviceId, 'months', monthKey)
  
  // Ensure the document exists
  await setDoc(analyticsRef, {
    device_id: deviceId,
    month: monthKey,
    updated_at: serverTimestamp()
  }, { merge: true })

  const snap = await getDoc(analyticsRef)
  return snap.exists() ? snap.data() : null
}

export async function fetchMonthlyAnalytics(deviceId) {
  if (!deviceId) return []
  const monthsRef = collection(db, 'analytics', deviceId, 'months')
  const q = query(monthsRef, orderBy('month', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
