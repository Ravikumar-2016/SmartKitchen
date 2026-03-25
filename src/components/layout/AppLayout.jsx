// src/components/layout/AppLayout.jsx
// ─────────────────────────────────────────────────────────────
// Shell for authenticated views.
// Sidebar (desktop: always visible, mobile: toggleable)
// + main content area with a top bar showing page context.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/alerts':        'Alerts',
  '/shopping-list': 'Shopping List',
  '/add-item':      'Add Item',
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // For /item/:id routes
  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/item/') ? 'Item Detail' : 'Kitchen')

  return (
    <div className="flex min-h-screen bg-cream-100">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-cream-50/80 backdrop-blur-md
                           border-b border-cream-200 px-6 py-4
                           flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-cream-200 transition-colors"
            aria-label="Open menu"
          >
            <div className="space-y-1.5">
              <span className="block w-5 h-0.5 bg-sage-700 rounded" />
              <span className="block w-5 h-0.5 bg-sage-700 rounded" />
              <span className="block w-3 h-0.5 bg-sage-700 rounded" />
            </div>
          </button>

          <h1 className="font-display font-bold text-sage-900 text-xl tracking-tight">
            {title}
          </h1>

          {/* Right slot — reserved for Step 2 (notification bell, etc.) */}
          <div className="ml-auto flex items-center gap-2" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
