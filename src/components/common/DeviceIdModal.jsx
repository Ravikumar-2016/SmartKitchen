import { useEffect, useState } from 'react'
import { formatDeviceId } from '../../utils/deviceId'
import { Leaf } from 'lucide-react'

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
    const trimmed = formatDeviceId(deviceId)

    if (!trimmed) {
      setLocalError('Device ID is required to continue.')
      return
    }

    setLocalError('')
    await onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-sage-950/40 backdrop-blur-md p-4 animate-in">
      <div className="w-full max-w-md glass-card p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
           <Leaf className="w-40 h-40" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-[2rem] bg-sage-900 text-cream-50 flex items-center justify-center mb-6 shadow-xl shadow-sage-900/40">
            <Leaf className="w-8 h-8" />
          </div>
          
          <h2 className="text-3xl font-bold text-sage-950 mb-3">Setup Device</h2>
          <p className="text-sage-500 text-sm mb-8 font-body leading-relaxed max-w-[280px]">
            Please enter your unique <strong>Device ID</strong> to synchronize your kitchen inventory.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-2">
                Serial Number
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="ESP32_KITCHEN_XX"
                className="input-field text-center font-mono tracking-widest uppercase font-bold"
                autoFocus
                disabled={loading}
              />
            </div>

            {(localError || error) && (
              <div className="p-4 bg-rust-50 border border-rust-100 rounded-2xl text-rust-600 text-xs font-body animate-in text-center">
                {localError || error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary w-full py-4 shadow-xl shadow-sage-900/10 text-sm tracking-wide"
            >
              {loading ? 'Validating Connection...' : 'Connect to device'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
