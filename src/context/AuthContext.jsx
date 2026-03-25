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
import { ensureUserProfile } from '../services/userService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true) // true until first auth check

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setProfile(null)
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
    setLoading(false)
  }

  async function logOut() {
    await firebaseLogOut()
    setUser(null)
    setProfile(null)
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

  async function signUp(email, password, displayName) {
    setLoading(true)
    try {
      await firebaseSignUp(email, password, displayName)
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const value = {
    user,
    profile,
    loading,
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
