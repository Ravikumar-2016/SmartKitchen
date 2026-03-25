// src/pages/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { logIn } = useAuth()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      await logIn(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sage-900 relative overflow-hidden
                      flex-col items-center justify-center p-16">
        {/* Background organic shapes */}
        <div className="absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full
                        bg-sage-700/30 blur-3xl" />
        <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 rounded-full
                        bg-sage-500/20 blur-3xl" />

        <div className="relative z-10 max-w-xs text-center">
          <div className="text-7xl mb-6">🥬</div>
          <h2 className="font-display font-bold text-cream-100 text-3xl leading-tight mb-4">
            Your kitchen,<br/>intelligently managed.
          </h2>
          <p className="font-body text-sage-300 text-sm leading-relaxed">
            Real-time inventory tracking, smart alerts, and AI-powered restocking —
            all in one place.
          </p>
        </div>

        {/* Decorative stat cards */}
        <div className="relative z-10 mt-12 space-y-3 w-full max-w-xs">
          {[
            { emoji: '📦', label: 'Items Tracked',   value: '24' },
            { emoji: '⚡', label: 'Active Alerts',   value: '3'  },
            { emoji: '🛒', label: 'Items to Reorder', value: '7' },
          ].map(({ emoji, label, value }) => (
            <div key={label}
                 className="flex items-center gap-3 bg-sage-800/50 rounded-xl px-4 py-3
                            border border-sage-600/30 backdrop-blur-sm">
              <span className="text-xl">{emoji}</span>
              <span className="font-body text-sage-300 text-sm flex-1">{label}</span>
              <span className="font-display font-bold text-cream-100">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-3xl">🥬</span>
            <span className="font-display font-bold text-sage-900 text-lg">
              AI Kitchen
            </span>
          </div>

          <h1 className="font-display font-bold text-sage-900 text-3xl mb-2">
            Welcome back
          </h1>
          <p className="font-body text-sage-500 text-sm mb-8">
            Sign in to your kitchen dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold
                                uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold
                                uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-rust-500/10 border border-rust-500/20 rounded-xl
                              px-4 py-3 text-rust-600 text-sm font-body">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>

          <p className="text-center font-body text-sage-500 text-sm mt-6">
            No account yet?{' '}
            <Link to="/signup" className="text-sage-600 font-semibold hover:text-sage-700
                                          transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function friendlyError(code, message) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please wait and try again.',
    'auth/invalid-credential':   'Invalid email or password.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  }
  if (map[code]) return map[code]
  if (message) return `Something went wrong: ${message}`
  if (code) return `Something went wrong. (${code})`
  return 'Something went wrong. Please try again.'
}
