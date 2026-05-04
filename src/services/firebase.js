// src/services/firebase.js
// ─────────────────────────────────────────────────────────────
// Firebase initialization and exported instances.
// Values must come from environment variables.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getAuth }       from 'firebase/auth'
import { getFirestore }  from 'firebase/firestore'
import { getDatabase }   from 'firebase/database'

function requiredEnv(name) {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required Firebase env variable: ${name}`)
  }
  return value
}

const firebaseConfig = {
  apiKey:            requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain:        requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:         requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  storageBucket:     requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             requiredEnv('VITE_FIREBASE_APP_ID'),
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const rtdb = getDatabase(app)
export default app
