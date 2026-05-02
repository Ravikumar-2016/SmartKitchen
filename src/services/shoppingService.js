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
    .filter(item => item.current_quantity <= item.threshold && item.threshold > 0)
    .map(item => ({
      item_id: item.id,
      item_name: item.name,
      current_quantity: item.current_quantity,
      required_quantity: item.capacity - item.current_quantity,
      status: 'pending'
    }))

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
