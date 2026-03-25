import { useEffect, useMemo, useState } from 'react'
import { ITEM_SLOTS, createItem, fetchItemsByDeviceId, handleRefill } from '../services/itemService'
import { useAuth } from '../context/AuthContext'

const PROFILE_STORAGE_KEY = 'smart-kitchen.profile'

function getStoredDeviceId() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return String(parsed?.deviceId ?? parsed?.device_id ?? '').trim()
  } catch {
    return ''
  }
}

export default function AddItem() {
  const { user, profile, loading } = useAuth()

  const [form, setForm] = useState({
    itemId: ITEM_SLOTS[0],
    name: '',
    capacity: '',
    threshold: '',
    expiryDate: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState('')

  const [refillLoadingBySlot, setRefillLoadingBySlot] = useState({})
  const [refillInputBySlot, setRefillInputBySlot] = useState({})
  const [refillTypeBySlot, setRefillTypeBySlot] = useState({})
  const [refillOpenBySlot, setRefillOpenBySlot] = useState({})
  const [refillErrorBySlot, setRefillErrorBySlot] = useState({})
  const [toast, setToast] = useState(null)

  const deviceId = profile?.deviceId?.trim() || getStoredDeviceId()
  const isDeviceReady = Boolean(deviceId)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (loading) return
    if (!user?.uid || !isDeviceReady) {
      setItems([])
      setItemsLoading(false)
      return
    }
    loadItems()
  }, [loading, user?.uid, isDeviceReady, deviceId])

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const usedSlots = new Set(items.map((item) => item.item_id))
  const availableSlots = ITEM_SLOTS.filter((slot) => !usedSlots.has(slot))

  useEffect(() => {
    if (!availableSlots.length) return
    if (availableSlots.includes(form.itemId)) return
    setForm((prev) => ({ ...prev, itemId: availableSlots[0] }))
  }, [form.itemId, availableSlots])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFormError('')
  }

  async function loadItems() {
    setItemsLoading(true)
    setItemsError('')
    try {
      const list = await fetchItemsByDeviceId(deviceId)
      setItems(list)
    } catch (err) {
      setItemsError(err?.message || 'Failed to load items.')
    } finally {
      setItemsLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    if (!isDeviceReady) {
      setFormError('Device ID is required. Set it in Dashboard profile settings first.')
      return
    }

    if (!availableSlots.length) {
      setFormError('All 4 slots are already configured for this device.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      await createItem({
        itemId: form.itemId,
        name: form.name,
        deviceId,
        capacity: form.capacity,
        threshold: form.threshold,
        expiryDate: form.expiryDate,
      })

      setForm({ itemId: availableSlots[0] || ITEM_SLOTS[0], name: '', capacity: '', threshold: '', expiryDate: '' })
      setToast({ type: 'success', message: 'Item created successfully.' })
      await loadItems()
    } catch (err) {
      setFormError(err?.message || 'Could not create item.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleRefillForm(item) {
    const itemId = item?.item_id
    if (!itemId) return
    setRefillOpenBySlot((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
    setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: '' }))
    setRefillInputBySlot((prev) => ({
      ...prev,
      [itemId]: prev[itemId] ?? '',
    }))
    setRefillTypeBySlot((prev) => ({
      ...prev,
      [itemId]: prev[itemId] ?? 'normal',
    }))
  }

  function handleRefillInputChange(itemId, value) {
    setRefillInputBySlot((prev) => ({ ...prev, [itemId]: value }))
    setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: '' }))
  }

  function handleRefillTypeChange(itemId, value) {
    setRefillTypeBySlot((prev) => ({ ...prev, [itemId]: value }))
    setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: '' }))
  }

  async function handleRefillSubmit(item) {
    const itemId = item?.item_id
    if (!isDeviceReady || !itemId || refillLoadingBySlot[itemId]) return

    const raw = refillInputBySlot[itemId]
    const quantity = Number(raw)
    const refillType = refillTypeBySlot[itemId] || 'normal'

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: 'Refill quantity must be greater than zero.' }))
      return
    }

    setRefillLoadingBySlot((prev) => ({ ...prev, [itemId]: true }))
    try {
      await handleRefill({
        deviceId,
        itemId,
        refill_type: refillType,
        quantity_input: quantity,
      })
      setRefillOpenBySlot((prev) => ({ ...prev, [itemId]: false }))
      setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: '' }))
      setToast({ type: 'success', message: `Refill saved for ${itemId}.` })
      await loadItems()
    } catch (err) {
      setRefillErrorBySlot((prev) => ({ ...prev, [itemId]: err?.message || 'Failed to log refill.' }))
    } finally {
      setRefillLoadingBySlot((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  function formatDate(value) {
    if (!value) return 'Not set'
    return value
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {toast && (
        <div
          className={`fixed right-6 bottom-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-body
            ${toast.type === 'error'
              ? 'bg-rust-500/10 border-rust-500/30 text-rust-600'
              : 'bg-sage-100 border-sage-300 text-sage-800'}`}
        >
          {toast.message}
        </div>
      )}

      <div className="grid xl:grid-cols-5 gap-6">
        <section className="xl:col-span-2 card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage-500 mb-2">Add New Item</p>
          <h2 className="font-display text-2xl text-sage-900 mb-1">Slot Registration</h2>
          <p className="font-body text-sage-500 text-sm mb-5">
            Configure one pantry item per fixed slot ({ITEM_SLOTS.join(', ')}).
          </p>

          <div className="mb-4 rounded-xl border border-cream-200 bg-cream-50 px-4 py-3">
            <p className="font-body text-sm text-sage-700">
              Device ID: <span className="font-mono text-sage-900">{loading ? 'Loading...' : (deviceId || 'Not set')}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Item Slot
              </label>
              <select
                name="itemId"
                value={form.itemId}
                onChange={handleChange}
                className="input-field"
                disabled={submitting || !availableSlots.length}
              >
                {ITEM_SLOTS.map((slot) => (
                  <option key={slot} value={slot} disabled={loading || !availableSlots.includes(slot)}>
                    {slot} {!availableSlots.includes(slot) ? '(Configured)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Item Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Rice"
                className="input-field"
                disabled={submitting}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Capacity (g)
                </label>
                <input
                  type="number"
                  name="capacity"
                  min="1"
                  step="0.01"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="5000"
                  className="input-field"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Threshold (g)
                </label>
                <input
                  type="number"
                  name="threshold"
                  min="0"
                  step="0.01"
                  value={form.threshold}
                  onChange={handleChange}
                  placeholder="1000"
                  className="input-field"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Expiry Date
              </label>
              <input
                type="date"
                name="expiryDate"
                min={today}
                value={form.expiryDate}
                onChange={handleChange}
                className="input-field"
                disabled={submitting}
              />
            </div>

            {formError && (
              <div className="bg-rust-500/10 border border-rust-500/20 rounded-xl px-4 py-3 text-rust-600 text-sm font-body">
                {formError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading || submitting || !isDeviceReady || !availableSlots.length}>
              {submitting ? 'Creating item...' : 'Create Item'}
            </button>
          </form>
        </section>

        <section className="xl:col-span-3 card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage-500 mb-1">Items</p>
              <h3 className="font-display text-2xl text-sage-900">Tracked Catalog</h3>
            </div>
            <button onClick={loadItems} className="btn-ghost" disabled={itemsLoading || !isDeviceReady}>
              Refresh
            </button>
          </div>

          {!isDeviceReady && (
            <div className="rounded-xl border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-rust-600 text-sm font-body">
              Set a Device ID from Dashboard before adding or tracking items.
            </div>
          )}

          {isDeviceReady && itemsLoading && (
            <div className="grid sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="border border-cream-200 rounded-xl p-4 animate-pulse-soft">
                  <div className="h-4 w-24 bg-cream-200 rounded mb-2" />
                  <div className="h-3 w-36 bg-cream-200 rounded mb-2" />
                  <div className="h-3 w-20 bg-cream-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {isDeviceReady && !itemsLoading && itemsError && (
            <div className="rounded-xl border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-rust-600 text-sm font-body">
              {itemsError}
            </div>
          )}

          {isDeviceReady && !itemsLoading && !itemsError && items.length === 0 && (
            <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-6 text-center">
              <p className="font-display text-sage-900 text-lg">No items yet</p>
              <p className="font-body text-sage-500 text-sm mt-1">Create your first item to start tracking usage.</p>
            </div>
          )}

          {isDeviceReady && !itemsLoading && !itemsError && items.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <article key={item.id} className="border border-cream-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-display text-lg text-sage-900 leading-tight">{item.name}</p>
                      <p className="font-mono text-xs text-sage-500">{item.item_id}</p>
                    </div>
                    <button
                      className="btn-ghost"
                      onClick={() => toggleRefillForm(item)}
                      disabled={Boolean(refillLoadingBySlot[item.item_id])}
                    >
                      {refillOpenBySlot[item.item_id] ? 'Cancel' : 'Refill'}
                    </button>
                  </div>

                  {refillOpenBySlot[item.item_id] && (
                    <div className="mb-3 rounded-xl border border-cream-200 bg-cream-50 p-3">
                      <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                        Refill Type
                      </label>
                      <select
                        value={refillTypeBySlot[item.item_id] || 'normal'}
                        onChange={(e) => handleRefillTypeChange(item.item_id, e.target.value)}
                        className="input-field mb-2"
                        disabled={Boolean(refillLoadingBySlot[item.item_id])}
                      >
                        <option value="normal">normal (add to current)</option>
                        <option value="reset">reset (set from zero)</option>
                      </select>

                      <label className="block font-display text-sage-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                        Quantity Input
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={refillInputBySlot[item.item_id] ?? ''}
                          onChange={(e) => handleRefillInputChange(item.item_id, e.target.value)}
                          className="input-field"
                          disabled={Boolean(refillLoadingBySlot[item.item_id])}
                        />
                        <button
                          className="btn-primary"
                          onClick={() => handleRefillSubmit(item)}
                          disabled={Boolean(refillLoadingBySlot[item.item_id])}
                          type="button"
                        >
                          {refillLoadingBySlot[item.item_id] ? 'Saving...' : 'Submit'}
                        </button>
                      </div>
                      {refillErrorBySlot[item.item_id] && (
                        <p className="mt-2 text-sm font-body text-rust-600">{refillErrorBySlot[item.item_id]}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-y-1 text-sm font-body">
                    <p className="text-sage-500">Capacity</p>
                    <p className="text-sage-800 text-right">{item.capacity}</p>

                    <p className="text-sage-500">Threshold</p>
                    <p className="text-sage-800 text-right">{item.threshold}</p>

                    <p className="text-sage-500">Current</p>
                    <p className="text-sage-800 text-right">{item.current_quantity ?? 0}</p>

                    <p className="text-sage-500">Expiry</p>
                    <p className="text-sage-800 text-right">{formatDate(item.expiry_date)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
