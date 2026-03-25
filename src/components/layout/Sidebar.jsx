// src/components/layout/Sidebar.jsx
// ─────────────────────────────────────────────────────────────
// Persistent left sidebar shown on all protected pages.
// Collapses on mobile — toggle handled via prop.
// ─────────────────────────────────────────────────────────────

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard',     icon: '⬡',  label: 'Dashboard'     },
  { to: '/alerts',        icon: '⚡',  label: 'Alerts'        },
  { to: '/shopping-list', icon: '◈',  label: 'Shopping List' },
  { to: '/add-item',      icon: '+',  label: 'Add Item'      },
]

export default function Sidebar({ open, onClose }) {
  const { user, logOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-sage-900/30 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-sage-900 z-30
          flex flex-col transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo / Brand */}
        <div className="px-6 py-7 border-b border-sage-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sage-500/30 border border-sage-400/20
                            flex items-center justify-center text-xl">
              🥬
            </div>
            <div>
              <p className="font-display font-bold text-cream-100 text-sm leading-tight">
                AI Kitchen
              </p>
              <p className="font-mono text-sage-400 text-[10px] tracking-widest uppercase">
                Smart Refill
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl
                font-display font-medium text-sm transition-all duration-150
                ${isActive
                  ? 'bg-sage-500/20 text-cream-100 border border-sage-500/30'
                  : 'text-sage-300 hover:text-cream-100 hover:bg-sage-700/40'}
              `}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-sage-700/50">
          {user && (
            <div className="mb-3 px-2">
              <p className="font-display text-cream-200 text-xs font-semibold truncate">
                {user.displayName || 'Kitchen Manager'}
              </p>
              <p className="font-mono text-sage-400 text-[10px] truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl
                       text-rust-400 hover:bg-rust-600/10 hover:text-rust-400
                       font-display font-medium text-sm transition-all duration-150"
          >
            <span className="w-5 text-center">↩</span>
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
