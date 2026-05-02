// src/services/migrationService.js
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Migrates data from legacy 'devices' collection to new 'items' collection.
 * Old path: devices/{deviceId}/items/{slotId}
 * New path: items/{deviceId}/slots/{slotId}
 */
export async function migrateLegacyData() {
  const results = {
    devicesProcessed: 0,
    itemsMigrated: 0,
    refillsMigrated: 0,
    errors: []
  }

  try {
    const devicesRef = collection(db, 'devices')
    const devicesSnap = await getDocs(devicesRef)

    for (const deviceDoc of devicesSnap.docs) {
      const deviceId = deviceDoc.id
      results.devicesProcessed++

      // 1. Create/Update device in 'items' collection
      const newDeviceRef = doc(db, 'items', deviceId)
      await setDoc(newDeviceRef, {
        device_id: deviceId,
        migrated_at: serverTimestamp(),
        status: 'active',
        // Preserve any data from the old device doc if it existed
        ...deviceDoc.data()
      }, { merge: true })

      // 2. Fetch items (slots) from legacy path: devices/{deviceId}/items
      const oldItemsRef = collection(db, 'devices', deviceId, 'items')
      const itemsSnap = await getDocs(oldItemsRef)

      for (const itemDoc of itemsSnap.docs) {
        const itemId = itemDoc.id
        const itemData = itemDoc.data()

        // 3. Move to new path: items/{deviceId}/slots/{itemId}
        const newSlotRef = doc(db, 'items', deviceId, 'slots', itemId)
        await setDoc(newSlotRef, {
          ...itemData,
          migrated_at: serverTimestamp()
        }, { merge: true })
        
        results.itemsMigrated++

        // 4. Move refills history if any
        const oldRefillsRef = collection(db, 'devices', deviceId, 'items', itemId, 'refills')
        const refillsSnap = await getDocs(oldRefillsRef)

        for (const refillDoc of refillsSnap.docs) {
          const refillData = refillDoc.data()
          const newRefillRef = doc(newSlotRef, 'refills', refillDoc.id)
          await setDoc(newRefillRef, refillData, { merge: true })
          results.refillsMigrated++
        }
      }
    }
  } catch (error) {
    console.error('Migration failed:', error)
    results.errors.push(error.message)
  }

  return results
}
