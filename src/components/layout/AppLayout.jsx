import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, ChevronRight } from 'lucide-react'
import Sidebar from './Sidebar'

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/alerts':        'Alerts',
  '/shopping-list': 'Shopping List',
  '/add-item':      'Add Item',
  '/analytics':     'Analytics',
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/item/') ? 'Item Detail' : 'Kitchen')

  return (
    <div className="flex min-h-screen bg-[#fdfcf8] selection:bg-sage-100 selection:text-sage-900">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 z-20 bg-white/70 backdrop-blur-xl border-b border-cream-100 px-8 py-5
                           flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 rounded-2xl bg-sage-50 text-sage-600 hover:bg-sage-100 transition-all border border-sage-100 shadow-sm"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sage-400 font-display text-sm">
              <span className="opacity-60">Smart Kitchen</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
              <h1 className="font-bold text-sage-900 text-lg tracking-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Right slot */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sage-400 leading-none mb-1">Status</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-display text-xs font-semibold text-sage-700">System Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

