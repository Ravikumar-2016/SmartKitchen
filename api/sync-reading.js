import { getFirebaseAdmin } from './_lib/firebaseAdmin.js'

function normalizeQuantity(readingValue) {
  const value = Number(readingValue)
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }
  return value
}

async function syncOneItem({ database, firestore, admin, deviceId, itemId }) {
  try {
    const readingRef = database.ref(`devices/${deviceId}/${itemId}/latest_reading`)
    const readingSnapshot = await readingRef.get()

    const quantity = normalizeQuantity(readingSnapshot.val())

    const itemRef = firestore.doc(`devices/${deviceId}/items/${itemId}`)
    await itemRef.set(
      {
        current_quantity: quantity,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return { ok: true, deviceId, itemId, quantity }
  } catch (error) {
    console.error('syncOneItem failed', { deviceId, itemId, error: error?.message })
    return { ok: false, deviceId, itemId, error: error?.message || 'Unknown item sync error' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  // Optional hardening: only enforce if CRON_SECRET is configured.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization || ''
    const expected = `Bearer ${process.env.CRON_SECRET}`
    if (authHeader !== expected) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' })
    }
  }

  try {
    const { firestore, database, admin } = getFirebaseAdmin()

    const devicesSnapshot = await firestore.collection('devices').get()
    if (devicesSnapshot.empty) {
      return res.status(200).json({
        ok: true,
        message: 'No devices found. Nothing to sync.',
        stats: { devices: 0, items: 0, updated: 0, failed: 0 },
      })
    }

    const deviceDocs = devicesSnapshot.docs
    let totalItems = 0

    const itemSyncTasks = []
    for (const deviceDoc of deviceDocs) {
      const deviceId = deviceDoc.id
      const itemsSnapshot = await firestore.collection(`devices/${deviceId}/items`).get()

      for (const itemDoc of itemsSnapshot.docs) {
        totalItems += 1
        itemSyncTasks.push(
          syncOneItem({
            database,
            firestore,
            admin,
            deviceId,
            itemId: itemDoc.id,
          })
        )
      }
    }

    const results = await Promise.all(itemSyncTasks)
    const failed = results.filter((r) => !r.ok)
    const updated = results.length - failed.length

    return res.status(200).json({
      ok: true,
      message: 'Sync completed',
      stats: {
        devices: deviceDocs.length,
        items: totalItems,
        updated,
        failed: failed.length,
      },
      failures: failed.slice(0, 20),
    })
  } catch (error) {
    console.error('sync-reading route failed', error)
    return res.status(500).json({
      ok: false,
      message: 'Sync failed',
      error: error?.message || 'Unknown server error',
    })
  }
}
