import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from './firebase'
import { fetchItemsByDeviceId } from './itemService'

/**
 * Generates or updates the shopping list for a device.
 * Items are added if current_quantity <= threshold.
 */
export async function syncShoppingList(deviceId) {
  if (!deviceId) return null

  const items = await fetchItemsByDeviceId(deviceId)
  const itemsToBuy = items
    .filter(item => {
      const isLowStock = item.current_quantity <= item.threshold && item.threshold > 0
      
      // Calculate simulated expiry days
      let isExpired = false
      if (item.expiry_date) {
        const expiryDate = new Date(item.expiry_date)
        const today = new Date()
        today.setHours(0,0,0,0)
        if (expiryDate <= today) isExpired = true
      }

      const isEmpty = (item.days_left || 0) <= 0
      
      return isLowStock || isExpired || isEmpty
    })
    .map(item => {
      const isExpired = item.expiry_date && (new Date(item.expiry_date) <= new Date())
      const isEmpty = (item.days_left || 0) <= 0
      
      let requiredQty = item.capacity - item.current_quantity
      
      // Per user request: if expired=0 and days_left=0, set qty to avg_consumption * 8
      if (isExpired && isEmpty) {
        requiredQty = (item.avg_consumption || 0) * 8
      }

      return {
        item_id: item.id,
        item_name: item.name,
        current_quantity: item.current_quantity,
        required_quantity: Math.max(0, Math.round(requiredQty)),
        status: 'pending'
      }
    })

  const listRef = doc(db, 'shopping_lists', deviceId)
  
  const shoppingListData = {
    device_id: deviceId,
    items: itemsToBuy,
    updated_at: serverTimestamp(),
    count: itemsToBuy.length
  }

  await setDoc(listRef, shoppingListData, { merge: true })
  return shoppingListData
}

export async function fetchShoppingList(deviceId) {
  if (!deviceId) return null
  const listRef = doc(db, 'shopping_lists', deviceId)
  const snap = await getDoc(listRef)
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() }
  }
  return null
}
