import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Smartphone, ArrowLeft, Save, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatDeviceId } from '../utils/deviceId'

export default function EditProfile() {
  const navigate = useNavigate()
  const { profile, saveProfile } = useAuth()

  const [form, setForm] = useState({
    name: '',
    device_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        device_id: profile.device_id || ''
      })
    }
  }, [profile])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'device_id' ? formatDeviceId(value) : value
    }))
    setError('')
    setSuccess(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.device_id.trim()) return setError('Device ID is required.')

    setLoading(true)
    setError('')
    try {
      await saveProfile({
        name: form.name.trim(),
        device_id: form.device_id.trim()
      })
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sage-400 hover:text-sage-700 transition-colors mb-8 font-display font-bold text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="card p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12">
          <User className="w-64 h-64" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-sage-900 text-cream-50 flex items-center justify-center shadow-lg">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-sage-950">Edit Profile</h2>
              <p className="text-sage-500 font-body">Manage your account details and device connection.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rust-50 border border-rust-100 rounded-xl text-rust-600 text-sm font-body animate-in">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm font-body flex items-center gap-2 animate-in">
                <CheckCircle className="w-4 h-4" />
                Profile updated successfully! Redirecting...
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Jane Smith"
                  className="input-field"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5" /> Device ID
                </label>
                <input
                  type="text"
                  name="device_id"
                  placeholder="BC:DD:C2:02:0C:98"
                  className="input-field font-mono"
                  value={form.device_id}
                  onChange={handleChange}
                  required
                />
                <p className="px-1 text-[10px] text-sage-400 font-medium">
                  Use the ID printed on your Smart Kitchen hub.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || success}
                className="w-full btn-primary py-4 shadow-xl shadow-sage-900/10 flex items-center justify-center gap-2"
              >
                {loading ? 'Saving Changes...' : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
