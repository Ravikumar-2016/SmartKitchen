// src/pages/Signup.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatDeviceId } from '../utils/deviceId'

export default function Signup() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [form, setForm]       = useState({ name: '', email: '', device_id: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'device_id' ? formatDeviceId(value) : value,
    }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.device_id || !form.password || !form.confirm) {
      setError('Please fill in all fields.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.name, form.device_id)
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyError(err.code, err.message))
    } finally {
      setLoading(false)
    }
  }

  // Password strength indicator
  const strength = getStrength(form.password)

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sage-900 relative overflow-hidden
                      flex-col items-center justify-center p-16">
        <div className="absolute top-[-80px] right-[-80px] w-96 h-96 rounded-full
                        bg-sage-700/20 blur-3xl" />
        <div className="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full
                        bg-sage-500/20 blur-3xl" />

        <div className="relative z-10 text-center max-w-xs">
          <div className="text-7xl mb-6">🌿</div>
          <h2 className="font-display font-bold text-cream-100 text-3xl leading-tight mb-4">
            Set up your<br/>smart kitchen.
          </h2>
          <p className="font-body text-sage-300 text-sm leading-relaxed">
            Get started in under a minute. Track your pantry, prevent waste,
            and never run out of essentials again.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 mt-12 space-y-3 w-full max-w-xs">
          {[
            '✓  Real-time stock monitoring',
            '✓  AI-powered days-to-empty estimates',
            '✓  Automatic shopping list generation',
            '✓  Low stock & expiry alerts',
          ].map(feat => (
            <p key={feat} className="font-body text-sage-300 text-sm">{feat}</p>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-3xl">🥬</span>
            <span className="font-display font-bold text-sage-900 text-lg">AI Kitchen</span>
          </div>

          <h1 className="font-display font-bold text-sage-900 text-3xl mb-2">
            Create account
          </h1>
          <p className="font-body text-sage-500 text-sm mb-8">
            Start tracking your kitchen inventory today
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold
                                uppercase tracking-wider mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Smith"
                className="input-field"
                autoComplete="name"
              />
            </div>

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
                Device ID
              </label>
              <input
                type="text"
                name="device_id"
                value={form.device_id}
                onChange={handleChange}
                placeholder="BC:DD:C2:02:0C:98"
                className="input-field"
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
                placeholder="Min. 6 characters"
                className="input-field"
                autoComplete="new-password"
              />
              {/* Strength bar */}
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300
                          ${i <= strength.level
                            ? strength.color
                            : 'bg-cream-300'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-body ${strength.textColor}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold
                                uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                autoComplete="new-password"
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
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </form>

          <p className="text-center font-body text-sage-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-sage-600 font-semibold hover:text-sage-700
                                          transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function getStrength(password) {
  if (!password) return { level: 0, label: '', color: '', textColor: '' }
  let score = 0
  if (password.length >= 6)  score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { level: 1, label: 'Weak',        color: 'bg-rust-400',   textColor: 'text-rust-500'  },
    { level: 2, label: 'Fair',        color: 'bg-yellow-400', textColor: 'text-yellow-600' },
    { level: 3, label: 'Good',        color: 'bg-sage-400',   textColor: 'text-sage-500'  },
    { level: 4, label: 'Strong 💪',   color: 'bg-sage-500',   textColor: 'text-sage-600'  },
  ]
  return levels[Math.min(score, 4) - 1] ?? levels[0]
}

function friendlyError(code, message) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/weak-password':        'Password is too weak. Use at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  }
  if (map[code]) return map[code]
  if (message) return message
  return 'Something went wrong. Please try again.'
}
