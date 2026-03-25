// src/services/authService.js
// ─────────────────────────────────────────────────────────────
// All Firebase Authentication calls live here.
// Components/context import these functions — never call
// Firebase SDK methods directly outside this file.
// ─────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth } from './firebase'

// Defensive: ensure we always have an auth instance even if module resolution changes.
const authInstance = auth ?? getAuth()

/**
 * Register a new user with email + password.
 * Optionally sets a display name on the profile.
 */
export async function signUp(email, password, displayName = '') {
  const credential = await createUserWithEmailAndPassword(authInstance, email, password)
  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }
  return credential.user
}

/**
 * Sign in an existing user.
 */
export async function logIn(email, password) {
  const credential = await signInWithEmailAndPassword(authInstance, email, password)
  return credential.user
}

/**
 * Sign out the current user.
 */
export async function logOut() {
  await signOut(authInstance)
}

/**
 * Subscribe to auth state changes.
 * Returns the unsubscribe function — call it on cleanup.
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(authInstance, callback)
}
