// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────
// Provides { user, loading, logOut } to the entire component
// tree via React context.  Wrap <App /> with <AuthProvider>.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from 'react'
import {
  logIn as firebaseLogIn,
  logOut as firebaseLogOut,
  onAuthChange,
  signUp as firebaseSignUp,
} from '../services/authService'
import { ensureUserProfile, fetchUserProfile, updateUserProfile } from '../services/userService'

const AuthContext = createContext(null)
const PROFILE_STORAGE_KEY = 'smart-kitchen.profile'

function getStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setStoredProfile(profile) {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
      return
    }
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(getStoredProfile)
  const [loading, setLoading]       = useState(true) // true until first auth check

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setProfile(null)
        setStoredProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setUser(firebaseUser)

      hydrateUser(firebaseUser).catch(() => setLoading(false))
    })
    return unsubscribe   // cleanup on unmount
  }, [])

  async function hydrateUser(authUser) {
    const userProfile = await ensureUserProfile(authUser)

    setProfile(userProfile)
    setStoredProfile(userProfile)
    setLoading(false)
  }

  async function refreshProfile(nextUser = user) {
    if (!nextUser?.uid) {
      setProfile(null)
      setStoredProfile(null)
      return null
    }

    const userProfile = await fetchUserProfile(nextUser.uid)
    if (!userProfile) {
      setProfile(null)
      setStoredProfile(null)
      return null
    }

    setProfile(userProfile)
    setStoredProfile(userProfile)
    return userProfile
  }

  async function saveProfile(updates = {}) {
    if (!user?.uid) throw new Error('You must be logged in to update profile.')
    await updateUserProfile(user.uid, updates)
    return refreshProfile(user)
  }

  async function logOut() {
    await firebaseLogOut()
    setUser(null)
    setProfile(null)
    setStoredProfile(null)
  }

  async function logIn(email, password) {
    setLoading(true)
    try {
      await firebaseLogIn(email, password)
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  async function signUp(email, password, displayName, device_id) {
    setLoading(true)
    try {
      const createdUser = await firebaseSignUp(email, password, displayName)
      if (createdUser?.uid) {
        const seededProfile = await ensureUserProfile(createdUser, displayName)
        if (device_id) {
          await updateUserProfile(createdUser.uid, { device_id })
          const freshProfile = await fetchUserProfile(createdUser.uid)
          setProfile(freshProfile)
          setStoredProfile(freshProfile)
        } else {
          setProfile(seededProfile)
          setStoredProfile(seededProfile)
        }
      }
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const value = {
    user,
    profile,
    loading,
    refreshProfile,
    saveProfile,
    logIn,
    signUp,
    logOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/** Convenience hook — use anywhere inside <AuthProvider> */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
