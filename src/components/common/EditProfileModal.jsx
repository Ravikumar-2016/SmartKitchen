import { useEffect, useState } from 'react'

export default function EditProfileModal({ open, profile, loading, error, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', deviceId: '' })
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({
        name: profile?.name || '',
        deviceId: profile?.deviceId || '',
      })
      setLocalError('')
    }
  }, [open, profile])

  if (!open) return null

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setLocalError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const payload = {
      name: form.name.trim(),
      deviceId: form.deviceId.trim(),
    }

    if (!payload.name || !payload.deviceId) {
      setLocalError('Name and Device ID are required.')
      return
    }

    await onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sage-900/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg card p-6 animate-slide-up">
        <h2 className="font-display text-2xl text-sage-900 mb-1">Edit Profile</h2>
        <p className="font-body text-sage-500 text-sm mb-5">
          Update your account details and active kitchen configuration.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Device ID
            </label>
            <input
              type="text"
              name="deviceId"
              value={form.deviceId}
              onChange={handleChange}
              className="input-field"
              disabled={loading}
            />
          </div>

          {(localError || error) && (
            <div className="bg-rust-500/10 border border-rust-500/20 rounded-xl px-4 py-3 text-rust-600 text-sm font-body">
              {localError || error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
