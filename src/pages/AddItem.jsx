import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { PlusCircle, ArrowLeft, Package, Calendar, Weight, Info, AlertTriangle, Edit3 } from 'lucide-react'
import { createItem, updateItem, fetchItemsByDeviceId, ITEM_SLOTS } from '../services/itemService'
import { useAuth } from '../context/AuthContext'

export default function AddItem() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { slotId } = useParams()
  const isEdit = !!slotId

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [itemCount, setItemCount] = useState(0)
  
  const [formData, setFormData] = useState({
    name: '',
    itemId: slotId || location.state?.slotId || 'item_1',
    capacity: '',
    expiry_days: '30',
    unit: 'g',
    price_per_unit: ''
  })

  // Load item data for editing
  useEffect(() => {
    if (!profile?.device_id || !isEdit) return
    
    const loadItem = async () => {
      setLoading(true)
      try {
        const items = await fetchItemsByDeviceId(profile.device_id)
        const item = items.find(i => i.id === slotId)
        if (item) {
          setFormData({
            name: item.name || '',
            itemId: item.id,
            capacity: item.capacity || '',
            expiry_days: item.max_expiry_days || '30',
            unit: item.unit || 'g',
            price_per_unit: item.price_per_unit || ''
          })
        }
      } catch (err) {
        setError('Failed to load item data')
      } finally {
        setLoading(false)
      }
    }
    loadItem()
  }, [profile?.device_id, slotId, isEdit])

  // Check item limit
  useEffect(() => {
    if (!profile?.device_id) return
    const checkLimit = async () => {
      try {
        const items = await fetchItemsByDeviceId(profile.device_id)
        setItemCount(items.length)
      } catch (err) {
        console.error(err)
      }
    }
    checkLimit()
  }, [profile?.device_id])

  useEffect(() => {
    if (location.state?.slotId && !isEdit) {
      setFormData(prev => ({ ...prev, itemId: location.state.slotId }))
    }
  }, [location.state, isEdit])

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
      const days = parseInt(formData.expiry_days) || 30
      const d = new Date()
      d.setDate(d.getDate() + days)
      const expiry_date = d.toISOString().split('T')[0]

      const { expiry_days, ...rest } = formData
      const payload = {
        ...rest,
        expiry_date,
        max_expiry_days: days,
        device_id: profile.device_id
      }

      if (isEdit) {
        await updateItem(payload)
      } else {
        await createItem(payload)
      }
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
          {isEdit ? <Edit3 className="w-64 h-64" /> : <PlusCircle className="w-64 h-64" />}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-sage-900 text-cream-50 flex items-center justify-center shadow-lg">
              {isEdit ? <Edit3 className="w-7 h-7" /> : <PlusCircle className="w-7 h-7" />}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-sage-950">{isEdit ? 'Edit Item' : 'Add New Item'}</h2>
              <p className="text-sage-500 font-body">{isEdit ? 'Update your smart slot configuration.' : 'Configure a new smart slot for your kitchen device.'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rust-50 border border-rust-100 rounded-xl text-rust-600 text-sm font-body animate-in">
                {error}
              </div>
            )}

            {!isEdit && itemCount >= 4 && (
              <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4 animate-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                   <p className="text-sm font-bold text-amber-900">Maximum Limit Reached</p>
                   <p className="text-xs text-amber-700 mt-1">Your device only supports 4 smart slots. Please delete an item in <span className="underline cursor-pointer font-bold" onClick={() => navigate('/manage-items')}>Manage Items</span> to add a new one.</p>
                </div>
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
                  className="input-field appearance-none disabled:opacity-50"
                  value={formData.itemId}
                  onChange={handleChange}
                  disabled={isEdit}
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

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Days until Expiry
                </label>
                <input
                  type="number"
                  name="expiry_days"
                  placeholder="e.g. 30"
                  className="input-field"
                  value={formData.expiry_days}
                  onChange={handleChange}
                  required
                  min="1"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-sage-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <span className="text-sm">₹</span> Price per kg
                </label>
                <input
                  type="number"
                  name="price_per_unit"
                  placeholder="e.g. 50 (₹ per kg)"
                  className="input-field"
                  value={formData.price_per_unit}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || (!isEdit && itemCount >= 4)}
                className="w-full btn-primary py-4 shadow-xl shadow-sage-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (isEdit ? 'Updating...' : 'Registering...') : (isEdit ? 'Save Changes' : 'Activate Smart Slot')}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  )
}
