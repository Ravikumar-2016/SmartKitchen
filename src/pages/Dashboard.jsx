// src/pages/Dashboard.jsx

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeviceIdModal from '../components/common/DeviceIdModal'
import EditProfileModal from '../components/common/EditProfileModal'
import ProfileMenu from '../components/common/ProfileMenu'
import { useAuth } from '../context/AuthContext'
import { fetchItemsByDeviceId } from '../services/itemService'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, saveProfile, logOut } = useAuth()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [deviceSaving, setDeviceSaving] = useState(false)
  const [deviceError, setDeviceError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState('')

  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    loadProfile()
  }, [user?.uid])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const deviceId = profile?.deviceId?.trim()
    if (!deviceId) {
      setItems([])
      setItemsError('')
      return
    }
    loadRecentItems(deviceId)
  }, [profile?.deviceId])

  const deviceMissing = useMemo(() => {
    return !profile?.deviceId || !String(profile.deviceId).trim()
  }, [profile])

  async function loadProfile() {
    if (!user?.uid) return

    setLoading(true)
    setLoadError('')
    try {
      const doc = await refreshProfile(user)
      const missingDevice = !doc?.deviceId || !String(doc.deviceId).trim()
      setDeviceModalOpen(missingDevice)
    } catch (err) {
      setLoadError(err?.message || 'Failed to load profile.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecentItems(deviceId) {
    setItemsLoading(true)
    setItemsError('')
    try {
      const list = await fetchItemsByDeviceId(deviceId)
      setItems(list.slice(0, 6))
    } catch (err) {
      setItemsError(err?.message || 'Failed to load recent items.')
    } finally {
      setItemsLoading(false)
    }
  }

  async function handleSaveDeviceId(deviceId) {
    if (!user?.uid || deviceSaving) return
    setDeviceSaving(true)
    setDeviceError('')
    try {
      await saveProfile({ deviceId })
      await loadRecentItems(deviceId)
      setDeviceModalOpen(false)
      setToast({ type: 'success', message: 'Device ID saved successfully.' })
    } catch (err) {
      setDeviceError(err?.message || 'Failed to save Device ID.')
    } finally {
      setDeviceSaving(false)
    }
  }

  async function handleSaveProfile(values) {
    if (!user?.uid || editSaving) return

    setEditSaving(true)
    setEditError('')
    try {
      const nextProfile = await saveProfile(values)
      if (nextProfile?.deviceId) {
        await loadRecentItems(nextProfile.deviceId)
      }
      setEditOpen(false)
      setToast({ type: 'success', message: 'Profile updated.' })
    } catch (err) {
      setEditError(err?.message || 'Failed to update profile.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleLogout() {
    await logOut()
    navigate('/login')
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <DeviceIdModal
        open={deviceModalOpen}
        initialValue={profile?.deviceId || ''}
        loading={deviceSaving}
        error={deviceError}
        onSave={handleSaveDeviceId}
      />

      <EditProfileModal
        open={editOpen}
        profile={profile}
        loading={editSaving}
        error={editError}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveProfile}
      />

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

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage-500 mb-1">Kitchen Console</p>
          <h2 className="font-display text-3xl text-sage-900 leading-tight">
            Welcome, {profile?.name || user?.displayName || 'Kitchen Manager'}
          </h2>
          <p className="font-body text-sage-500 text-sm mt-1">
            Monitor inventory health and keep your kitchen always ready.
          </p>
        </div>

        <ProfileMenu
          name={profile?.name}
          email={profile?.email || user?.email}
          onEditProfile={() => setEditOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="card p-5 animate-pulse-soft">
              <div className="h-4 w-24 bg-cream-200 rounded mb-3" />
              <div className="h-7 w-32 bg-cream-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="card p-5 border-rust-500/30 bg-rust-500/5">
          <p className="font-body text-rust-600 text-sm">{loadError}</p>
          <button className="btn-ghost mt-3" onClick={loadProfile}>Retry</button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <section className="card p-5">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-500 mb-2">User Profile</p>
              <p className="font-display text-2xl text-sage-900">{profile?.name || user?.displayName || 'Kitchen User'}</p>
              <p className="font-body text-sm text-sage-500 mt-1">{profile?.email || user?.email || 'No email available'}</p>
            </section>

            <section className="card p-5">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-500 mb-2">Device Status</p>
              <p className="font-display text-2xl text-sage-900">
                {deviceMissing ? 'Not Set' : 'Connected'}
              </p>
              <p className="font-body text-sm text-sage-500 mt-1 break-all">
                {deviceMissing ? 'Add your Device ID to enable tracking.' : profile?.deviceId}
              </p>
            </section>

            <section className="card p-5">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-500 mb-2">Account</p>
              <p className="font-display text-xl text-sage-900">{profile?.email || user?.email}</p>
              <p className="font-body text-sm text-sage-500 mt-1">Inventory tracking is active for your configured device.</p>
            </section>
          </div>

          <section className="card p-5 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-sage-100" />
            <div className="relative">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-500 mb-3">Quick Actions</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ActionButton
                  title="Add Items"
                  desc="Register pantry items"
                  icon="＋"
                  disabled={deviceMissing}
                  onClick={() => navigate('/add-item')}
                />
                <ActionButton
                  title="View Alerts"
                  desc="See low stock warnings"
                  icon="⚡"
                  disabled={deviceMissing}
                  onClick={() => navigate('/alerts')}
                />
                <ActionButton
                  title="Shopping List"
                  desc="Open auto-generated list"
                  icon="◈"
                  disabled={deviceMissing}
                  onClick={() => navigate('/shopping-list')}
                />
                <ActionButton
                  title="Edit Profile"
                  desc="Update kitchen settings"
                  icon="✎"
                  disabled={false}
                  onClick={() => setEditOpen(true)}
                />
              </div>
              {deviceMissing && (
                <p className="font-body text-sm text-rust-600 mt-3">
                  Device ID is required before inventory tracking features can be used.
                </p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage-500 mb-1">Recent Items</p>
                <h3 className="font-display text-2xl text-sage-900">Inventory Snapshot</h3>
              </div>
              <button className="btn-ghost" onClick={() => navigate('/add-item')}>
                Manage Items
              </button>
            </div>

            {deviceMissing && (
              <div className="rounded-xl border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-rust-600 text-sm font-body">
                Add Device ID to start seeing your created items.
              </div>
            )}

            {!deviceMissing && itemsLoading && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="border border-cream-200 rounded-xl p-4 animate-pulse-soft">
                    <div className="h-4 w-24 bg-cream-200 rounded mb-2" />
                    <div className="h-3 w-28 bg-cream-200 rounded mb-2" />
                    <div className="h-3 w-16 bg-cream-200 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!deviceMissing && !itemsLoading && itemsError && (
              <div className="rounded-xl border border-rust-500/30 bg-rust-500/5 px-4 py-3 text-rust-600 text-sm font-body">
                {itemsError}
              </div>
            )}

            {!deviceMissing && !itemsLoading && !itemsError && items.length === 0 && (
              <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-5 text-center">
                <p className="font-display text-sage-900 text-lg">No items created yet</p>
                <p className="font-body text-sage-500 text-sm mt-1">Create your first item from Add Item.</p>
              </div>
            )}

            {!deviceMissing && !itemsLoading && !itemsError && items.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => (
                  <article key={item.id} className="border border-cream-200 rounded-xl p-4 bg-white">
                    <p className="font-display text-lg text-sage-900 leading-tight">{item.name}</p>
                    <p className="font-mono text-xs text-sage-500 mt-0.5">{item.itemCode}</p>
                    <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm font-body">
                      <p className="text-sage-500">Capacity</p>
                      <p className="text-sage-800 text-right">{item.capacity}</p>
                      <p className="text-sage-500">Current</p>
                      <p className="text-sage-800 text-right">{item.current_weight ?? 'Unknown'}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ActionButton({ title, desc, icon, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left bg-white/80 border border-cream-200 rounded-xl p-4 hover:border-sage-300 hover:shadow-sm
                 transition-all duration-200 disabled:opacity-55 disabled:cursor-not-allowed"
    >
      <div className="w-9 h-9 rounded-lg bg-sage-100 text-sage-700 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="font-display text-sage-900 text-base leading-tight">{title}</p>
      <p className="font-body text-sage-500 text-sm mt-1">{desc}</p>
    </button>
  )
}

// ─── Shared placeholder component used by all stub pages ───────────────────

export function PlaceholderPage({ emoji, title, description, badge }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Icon circle */}
      <div className="w-24 h-24 rounded-3xl bg-sage-100 border-2 border-sage-200
                      flex items-center justify-center text-5xl mb-6 shadow-inner">
        {emoji}
      </div>

      {/* Badge */}
      <span className="inline-block font-mono text-[10px] tracking-widest uppercase
                       bg-cream-200 text-sage-500 px-3 py-1 rounded-full mb-3">
        Coming in {badge}
      </span>

      <h2 className="font-display font-bold text-sage-900 text-3xl mb-3">{title}</h2>
      <p className="font-body text-sage-500 text-sm max-w-xs leading-relaxed">
        {description}
      </p>

      {/* Decorative dots */}
      <div className="flex gap-2 mt-10">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-sage-300 animate-pulse-soft"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>
    </div>
  )
}
