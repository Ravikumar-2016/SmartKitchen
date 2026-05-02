import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Bell, 
  ShoppingCart, 
  PlusCircle, 
  BarChart3, 
  LogOut,
  Leaf,
  User
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/alerts',        icon: Bell,            label: 'Alerts'        },
  { to: '/shopping-list', icon: ShoppingCart,    label: 'Shopping List' },
  { to: '/analytics',     icon: BarChart3,       label: 'Analytics'     },
  { to: '/add-item',      icon: PlusCircle,      label: 'Add Item'      },
  { to: '/edit-profile',  icon: User,            label: 'Edit Profile'  },
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
          className="fixed inset-0 bg-sage-950/40 backdrop-blur-md z-20 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-sage-900 z-30
          flex flex-col transition-all duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          border-r border-white/5 shadow-2xl
        `}
      >
        {/* Logo / Brand */}
        <div className="px-8 py-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sage-400 to-sage-600
                            flex items-center justify-center shadow-lg shadow-sage-900/40">
              <Leaf className="w-6 h-6 text-cream-50" />
            </div>
            <div>
              <p className="font-display font-bold text-cream-100 text-lg tracking-tight">
                AI Kitchen
              </p>
              <p className="font-mono text-sage-400 text-[10px] tracking-widest uppercase opacity-80">
                Premium Refill
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3.5 px-5 py-3.5 rounded-2xl
                font-display font-medium text-sm transition-all duration-200
                ${isActive
                  ? 'bg-white/10 text-cream-100 shadow-inner'
                  : 'text-sage-400 hover:text-cream-100 hover:bg-white/5'}
              `}
            >
              <Icon className={`w-5 h-5 transition-colors duration-200`} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-6 mt-auto">
          <div className="bg-white/5 rounded-[2.5rem] p-4 border border-white/5">
            {user && (
              <div className="mb-4 px-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sage-500/20 flex items-center justify-center border border-white/10">
                  <span className="text-sage-100 font-display text-sm">
                    {(user.displayName || 'K').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-cream-100 text-xs font-semibold truncate leading-none mb-1">
                    {user.displayName || 'Manager'}
                  </p>
                  <p className="font-mono text-sage-400 text-[9px] truncate opacity-70">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl
                         bg-rust-500/10 text-rust-400 hover:bg-rust-500/20
                         font-display font-bold text-xs tracking-wider uppercase transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

