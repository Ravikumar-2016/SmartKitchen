import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlusCircle, ArrowLeft, Package, Calendar, Weight, Info, AlertTriangle } from 'lucide-react'
import { createItem, ITEM_SLOTS } from '../services/itemService'
import { useAuth } from '../context/AuthContext'

export default function AddItem() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    itemId: location.state?.slotId || 'item_1',
    capacity: '',
    threshold: '',
    expiry_date: '',
    unit: 'g'
  })

  useEffect(() => {
    if (location.state?.slotId) {
      setFormData(prev => ({ ...prev, itemId: location.state.slotId }))
    }
  }, [location.state])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!profile?.device_id) {
      setError('Device ID not found in profile. Please set it in dashboard.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createItem({
        ...formData,
        device_id: profile.device_id
      })
      navigate('/dashboard')
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
        Back to Console
      </button>

      <div className="card p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12">
          <PlusCircle className="w-64 h-64" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-sage-900 text-cream-50 flex items-center justify-center shadow-lg">
              <PlusCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-sage-950">Add New Item</h2>
              <p className="text-sage-500 font-body">Configure a new smart slot for your kitchen device.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rust-50 border border-rust-100 rounded-xl text-rust-600 text-sm font-body animate-in">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Item Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Rice, Flour, Coffee"
                  className="input-field"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1">Storage Slot</label>
                <select
                  name="itemId"
                  className="input-field appearance-none"
                  value={formData.itemId}
                  onChange={handleChange}
                >
                  {ITEM_SLOTS.map(slot => (
                    <option key={slot} value={slot}>
                      Slot {slot.split('_')[1]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1">Unit</label>
                <select
                  name="unit"
                  className="input-field appearance-none"
                  value={formData.unit}
                  onChange={handleChange}
                >
                  <option value="g">Grams (g)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="l">Liters (l)</option>
                  <option value="pcs">Pieces (pcs)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Weight className="w-3.5 h-3.5" /> Capacity
                </label>
                <input
                  type="number"
                  name="capacity"
                  placeholder="Max weight/qty"
                  className="input-field"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Threshold
                </label>
                <input
                  type="number"
                  name="threshold"
                  placeholder="Notify me below..."
                  className="input-field"
                  value={formData.threshold}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Expiry Date
                </label>
                <input
                  type="date"
                  name="expiry_date"
                  className="input-field"
                  value={formData.expiry_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 shadow-xl shadow-sage-900/10"
              >
                {loading ? 'Registering Item...' : 'Activate Smart Slot'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 p-6 bg-sage-50/50 rounded-3xl border border-sage-100 flex gap-4">
        <Info className="w-5 h-5 text-sage-400 flex-shrink-0" />
        <p className="text-xs text-sage-500 font-body leading-relaxed">
          Creating an item will reset the current stock level to 0. 
          Use the <strong>Quick Refill</strong> action on the dashboard after registering to add stock.
        </p>
      </div>
    </div>
  )
}
