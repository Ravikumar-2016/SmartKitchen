import { useEffect, useRef, useState } from 'react'

export default function ProfileMenu({ name, email, onEditProfile, onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const initial = (name || email || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-10 h-10 rounded-xl border border-cream-300 bg-white hover:bg-cream-50 transition-colors
                   flex items-center justify-center font-display text-sage-700"
        aria-label="Open profile menu"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 card border-cream-200 shadow-lg p-2 z-20 animate-fade-in">
          <div className="px-2 py-2 border-b border-cream-200 mb-2">
            <p className="font-display text-sm text-sage-900 font-semibold truncate">{name || 'Kitchen User'}</p>
            <p className="font-body text-xs text-sage-500 truncate">{email || 'No email'}</p>
          </div>

          <button
            onClick={() => {
              setOpen(false)
              onEditProfile()
            }}
            className="w-full text-left px-3 py-2 rounded-lg font-body text-sm text-sage-700 hover:bg-sage-50"
          >
            Edit Profile
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="w-full text-left px-3 py-2 rounded-lg font-body text-sm text-rust-600 hover:bg-rust-500/10"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
