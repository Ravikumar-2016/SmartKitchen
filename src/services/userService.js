// src/services/userService.js
// ------------------------------------------------------------
// Firestore access layer for user data.
// Responsibilities (Step 1 scope):
// - Ensure user profile exists after auth signup/login
// - Keep user schema normalized for the email/password flow
// - Fetch user profile by uid
// ------------------------------------------------------------

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { formatDeviceId } from '../utils/deviceId'

/**
 * Ensure the user document exists and follows the latest users-only schema.
 */
export async function ensureUserProfile(authUser, nameOverride = '') {
  const userRef = doc(db, 'users', authUser.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      name: nameOverride || authUser.displayName || deriveNameFromEmail(authUser.email),
      email: authUser.email,
      device_id: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    return fetchUserProfile(authUser.uid)
  }

  const existing = snapshot.data()
  const updates = {}

  if (!existing.name) {
    updates.name = nameOverride || authUser.displayName || deriveNameFromEmail(authUser.email)
  }
  if (!existing.email && authUser.email) {
    updates.email = authUser.email
  }

  const formattedDeviceId = formatDeviceId(existing.device_id ?? existing.deviceId ?? '')
  if (existing.device_id !== formattedDeviceId) {
    updates.device_id = formattedDeviceId
  }
  if (Object.prototype.hasOwnProperty.call(existing, 'deviceId')) {
    updates.deviceId = deleteField()
  }

  if (!existing.created_at) {
    updates.created_at = serverTimestamp()
  }

  if (Object.keys(updates).length) {
    await updateDoc(userRef, updates)
  }

  return fetchUserProfile(authUser.uid)
}

export async function fetchUserProfile(uid) {
  const ref = doc(db, 'users', uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    device_id: formatDeviceId(data.device_id ?? ''),
  }
}

export async function updateUserProfile(uid, updates = {}) {
  if (!uid) throw new Error('Missing uid for profile update.')

  const payload = {}
  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    const name = String(updates.name || '').trim()
    if (!name) {
      throw new Error('name is required.')
    }
    payload.name = name
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'device_id')) {
    const deviceId = formatDeviceId(updates.device_id)
    if (!deviceId) {
      throw new Error('device_id is required.')
    }

    const isTaken = await isDeviceIdTaken(deviceId, uid)
    if (isTaken) {
      throw new Error('This device_id is already linked to another user.')
    }

    payload.device_id = deviceId
  }

  // Always clear the deprecated field when any profile update occurs.
  payload.deviceId = deleteField()

  payload.updated_at = serverTimestamp()

  if (!Object.keys(payload).length) {
    throw new Error('No valid fields provided for update.')
  }

  const ref = doc(db, 'users', uid)
  await updateDoc(ref, payload)
}

async function isDeviceIdTaken(deviceId, excludeUid) {
  const normalized = formatDeviceId(deviceId)
  if (!normalized) return false

  const usersRef = collection(db, 'users')
  const usersQuery = query(usersRef, where('device_id', '==', normalized), limit(5))
  const snapshot = await getDocs(usersQuery)

  return snapshot.docs.some((docSnap) => docSnap.id !== excludeUid)
}

function deriveNameFromEmail(email) {
  if (!email) return 'Kitchen Manager'
  const handle = email.split('@')[0]
  return handle.charAt(0).toUpperCase() + handle.slice(1)
}

