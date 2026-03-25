import { useEffect, useState } from 'react'

export default function DeviceIdModal({ open, initialValue = '', loading, error, onSave }) {
  const [deviceId, setDeviceId] = useState(initialValue)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (open) {
      setDeviceId(initialValue || '')
      setLocalError('')
    }
  }, [open, initialValue])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = deviceId.trim()

    if (!trimmed) {
      setLocalError('Device ID is required to continue.')
      return
    }

    setLocalError('')
    await onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sage-900/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-md card p-6 animate-slide-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage-500 mb-2">Required Step</p>
        <h2 className="font-display text-2xl text-sage-900 mb-2">Connect your device</h2>
        <p className="font-body text-sage-500 text-sm mb-5">
          Enter your Device ID to enable inventory tracking and live updates.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. ESP32_KITCHEN_01"
              className="input-field"
              autoFocus
              disabled={loading}
            />
          </div>

          {(localError || error) && (
            <div className="bg-rust-500/10 border border-rust-500/20 rounded-xl px-4 py-3 text-rust-600 text-sm font-body">
              {localError || error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving…' : 'Save Device ID'}
          </button>
        </form>
      </div>
    </div>
  )
}
