// src/services/firebase.js
// ─────────────────────────────────────────────────────────────
// Firebase initialization and exported instances.
// Replace the firebaseConfig values with your own project's
// credentials from the Firebase Console.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getAuth }       from 'firebase/auth'
import { getFirestore }  from 'firebase/firestore'
import { getDatabase }   from 'firebase/database'

// Uses .env values when provided; falls back to the shared project config
// so the app runs locally without extra setup.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? 'AIzaSyD0qQ3wuCrC-0zQPUaRN5RPrpImRVMlgO4',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'smartkitchen-8c101.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? 'smartkitchen-8c101',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       ?? 'https://smartkitchen-8c101-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'smartkitchen-8c101.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?? '702839426372',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '1:702839426372:web:85e0c92766e4b50f939b11',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const rtdb = getDatabase(app)
export default app
