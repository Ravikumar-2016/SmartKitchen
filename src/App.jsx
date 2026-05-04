// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root router.  Public routes (Login, Signup) are accessible
// to everyone.  All other routes live inside <ProtectedRoute>
// which redirects unauthenticated users to /login.
// ─────────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Layout & guards
import AppLayout      from './components/layout/AppLayout'
import ProtectedRoute from './components/common/ProtectedRoute'

// Public pages
import Login  from './pages/Login'
import Signup from './pages/Signup'

// Protected pages
import Dashboard    from './pages/Dashboard'
import ItemDetail   from './pages/ItemDetail'
import Alerts       from './pages/Alerts'
import ShoppingList from './pages/ShoppingList'
import AddItem      from './pages/AddItem'
import ManageItems   from './pages/ManageItems'
import Analytics    from './pages/Analytics'
import EditProfile  from './pages/EditProfile'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ─────────────────────────────── */}
        <Route path="/login"  element={<Login />}  />
        <Route path="/signup" element={<Signup />} />

        {/* ── Protected routes (require auth) ───────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard"     element={<Dashboard />}    />
            <Route path="/item/:id"      element={<ItemDetail />}   />
            <Route path="/alerts"        element={<Alerts />}       />
            <Route path="/shopping-list" element={<ShoppingList />} />
            <Route path="/add-item"      element={<AddItem />}      />
            <Route path="/edit-item/:slotId" element={<AddItem />}   />
            <Route path="/manage-items"  element={<ManageItems />}  />
            <Route path="/analytics"     element={<Analytics />}    />
            <Route path="/edit-profile"  element={<EditProfile />}  />
          </Route>
        </Route>



        {/* ── Fallback: redirect root to dashboard ──────── */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* ── 404 catch-all ─────────────────────────────── */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
