// src/components/common/ProtectedRoute.jsx
// ─────────────────────────────────────────────────────────────
// Wraps private pages.  Redirects to /login if not authenticated.
// Shows a spinner while the auth state is resolving.
// ─────────────────────────────────────────────────────────────

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="flex flex-col items-center gap-4">
          {/* Animated leaf / kitchen icon */}
          <span className="text-5xl animate-pulse-soft">🌿</span>
          <p className="font-display text-sage-500 text-sm tracking-widest uppercase">
            Loading…
          </p>
        </div>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
