// src/services/userService.js
// ------------------------------------------------------------
// Firestore access layer for user data.
// Responsibilities (Step 1 scope):
// - Ensure user profile exists after auth signup/login
// - Keep user schema normalized for the email/password flow
// - Fetch user profile by uid
// ------------------------------------------------------------

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Ensure the user document exists and follows the latest users-only schema.
 */
export async function ensureUserProfile(authUser) {
  const userRef = doc(db, 'users', authUser.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      name: authUser.displayName || deriveNameFromEmail(authUser.email),
      email: authUser.email,
      deviceId: '',
      device_id: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    const fresh = await getDoc(userRef)
    const data = fresh.data()
    return {
      id: fresh.id,
      ...data,
      deviceId: data.deviceId ?? data.device_id ?? '',
    }
  }

  const existing = snapshot.data()
  const updates = {}

  if (!existing.name) {
    updates.name = authUser.displayName || deriveNameFromEmail(authUser.email)
  }
  if (!existing.email && authUser.email) {
    updates.email = authUser.email
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'deviceId')) {
    updates.deviceId = existing.device_id ?? ''
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'device_id')) {
    updates.device_id = existing.deviceId ?? ''
  }
  if (!existing.created_at) {
    updates.created_at = serverTimestamp()
  }

  if (Object.keys(updates).length) {
    await updateDoc(userRef, updates)
  }

  const fresh = await getDoc(userRef)
  const data = fresh.data()
  return {
    id: fresh.id,
    ...data,
    deviceId: data.deviceId ?? data.device_id ?? '',
  }
}

export async function fetchUserProfile(uid) {
  const ref = doc(db, 'users', uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    deviceId: data.deviceId ?? data.device_id ?? '',
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

  if (Object.prototype.hasOwnProperty.call(updates, 'deviceId')) {
    const deviceId = String(updates.deviceId || '').trim()
    if (!deviceId) {
      throw new Error('deviceId is required.')
    }
    payload.deviceId = deviceId
    payload.device_id = deviceId
  }

  payload.updated_at = serverTimestamp()

  if (!Object.keys(payload).length) {
    throw new Error('No valid fields provided for update.')
  }

  const ref = doc(db, 'users', uid)
  await updateDoc(ref, payload)
}

function deriveNameFromEmail(email) {
  if (!email) return 'Kitchen Manager'
  const handle = email.split('@')[0]
  return handle.charAt(0).toUpperCase() + handle.slice(1)
}

