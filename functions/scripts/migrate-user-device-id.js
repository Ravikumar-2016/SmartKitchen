const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

function formatDeviceId(id) {
  return String(id ?? '').replace(/[:-]/g, '').trim().toUpperCase()
}

async function migrateUsers({ apply = false } = {}) {
  const usersSnapshot = await db.collection('users').get()

  const seen = new Map()
  const updates = []

  usersSnapshot.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const raw = data.device_id ?? data.deviceId ?? ''
    const formatted = formatDeviceId(raw)

    if (formatted) {
      const owners = seen.get(formatted) || []
      owners.push(docSnap.id)
      seen.set(formatted, owners)
    }

    const patch = {}
    let hasChanges = false

    if (data.device_id !== formatted) {
      patch.device_id = formatted
      hasChanges = true
    }

    if (Object.prototype.hasOwnProperty.call(data, 'deviceId')) {
      patch.deviceId = admin.firestore.FieldValue.delete()
      hasChanges = true
    }

    if (hasChanges) {
      updates.push({ ref: docSnap.ref, patch, uid: docSnap.id, formatted })
    }
  })

  const duplicateDeviceIds = [...seen.entries()].filter(([, uids]) => uids.length > 1)

  console.log(`Users scanned: ${usersSnapshot.size}`)
  console.log(`Users requiring update: ${updates.length}`)

  if (duplicateDeviceIds.length) {
    console.warn('Duplicate device_id values found:')
    duplicateDeviceIds.forEach(([device_id, uids]) => {
      console.warn(`- ${device_id}: ${uids.join(', ')}`)
    })
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to commit updates.')
    return
  }

  let batch = db.batch()
  let writes = 0

  for (const update of updates) {
    batch.update(update.ref, update.patch)
    writes += 1

    if (writes % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }

  if (writes % 400 !== 0) {
    await batch.commit()
  }

  console.log(`Migration completed. Updated ${writes} user documents.`)
}

const apply = process.argv.includes('--apply')
migrateUsers({ apply })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
