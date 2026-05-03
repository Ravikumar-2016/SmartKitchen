import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  AlertTriangle, 
  Calendar, 
  RefreshCcw, 
  ArrowRight,
  ChevronRight,
  Package,
  Weight,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  Zap,
  RotateCcw,
  Brain
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchItemsByDeviceId, ITEM_SLOTS, handleRefill, subscribeToLatestWeights, resetDeviceSmartVariables, subscribeToItems, processConsumptionEvent } from '../services/itemService'
import { fetchAlerts, subscribeToAlerts } from '../services/alertService'
import DeviceIdModal from '../components/common/DeviceIdModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, saveProfile } = useAuth()

  const [items, setItems] = useState({})
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  // Track previous weight per slot to detect genuine consumption (box lift + replace)
  const slotPrevWeightRef = useRef({})

  const deviceId = profile?.device_id

  useEffect(() => {
    if (!user?.uid) return
    init()
  }, [user?.uid, deviceId])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    if (!deviceId) return
    const unsub = subscribeToItems(deviceId, (updatedItems) => {
      setItems(prev => {
        const newMap = { ...prev }
        Object.keys(updatedItems).forEach(id => {
          newMap[id] = { 
            // Start with current state (preserves is_live and other UI flags)
            ...(prev[id] || {}), 
            // Overwrite with fresh data from Firestore (metrics, name, capacity, etc)
            ...updatedItems[id],
            // Explicitly ensure is_live persists from sensor listener
            is_live: prev[id]?.is_live ?? false
          }
        })
        return newMap
      })
    })
    return () => unsub()
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    const unsub = subscribeToAlerts(deviceId, (updatedAlerts) => {
      // Sort by newest first and limit to 4
      const sorted = updatedAlerts.sort((a, b) => {
        const timeA = a.created_at?.toDate?.()?.getTime() || 0
        const timeB = b.created_at?.toDate?.()?.getTime() || 0
        return timeB - timeA
      })
      setAlerts(sorted.slice(0, 4))
    })
    return () => unsub()
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) return
    const unsub = subscribeToLatestWeights(deviceId, async (itemId, weightRaw) => {
      // Real weight = Live Weight - Box Weight (25g)
      const weight = Math.max(0, Number(weightRaw) - 25)

      // 1. Update live weight on UI immediately
      setItems(prev => {
        const item = prev[itemId]
        if (!item) return prev
        return {
          ...prev,
          [itemId]: { ...item, current_quantity: weight, current_weight: weight, is_live: true }
        }
      })

      // 2. Only process consumption when weight drops by >=4g from last reading
      // Track RAW weight for accurate diffs and processing
      const prev = slotPrevWeightRef.current[itemId]
      const currRaw = Number(weightRaw)
      const prevVal = Number(prev ?? 0)

      if (currRaw < 10) return // Box is lifted, don't update prev or process consumption

      // Initialize on first reading
      if (prev === undefined) {
        slotPrevWeightRef.current[itemId] = currRaw
        // Send initial weight to backend so persistentWeight isn't 0
        try {
          await processConsumptionEvent(deviceId, itemId, currRaw)
        } catch (err) {
          console.error('Initial consumption processing error:', err)
        }
        return
      }

      const diff = prevVal - currRaw
      if (diff >= 4.0 || diff <= -10) {
        // Weight changed meaningfully (consumption or refill) — process it
        slotPrevWeightRef.current[itemId] = currRaw
        try {
          await processConsumptionEvent(deviceId, itemId, currRaw)
        } catch (err) {
          console.error('Consumption processing error:', err)
        }
      }
    })
    return () => unsub()
  }, [deviceId])

  async function init() {
    if (!profile) await refreshProfile(user)
    if (!deviceId) {
      setDeviceModalOpen(true)
      setLoading(false)
      return
    }
    loadData()
  }

  async function loadData() {
    setLoading(true)
    try {
      const [itemList, alertList] = await Promise.all([
        fetchItemsByDeviceId(deviceId),
        fetchAlerts(deviceId)
      ])
      
      const itemMap = {}
      itemList.forEach(item => {
        itemMap[item.id] = item
      })
      setItems(itemMap)
      setAlerts(alertList.slice(0, 4))
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessAI = async () => {
    setRefreshing(true)
    try {
      // In development, we might need to use a direct call if env is set
      const secret = import.meta.env.VITE_CRON_SECRET || 'simulation_secret'
      const res = await fetch(`/api/cron?key=${secret}`)
      if (!res.ok) throw new Error('AI processing failed')
      
      setToast({ type: 'success', message: 'AI Analysis Complete! Metrics updated.' })
      await loadData()
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', message: 'AI Processing failed. Ensure your local server is running.' })
    } finally {
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    setToast({ type: 'success', message: 'Data refreshed' })
  }

  const handleReset = async () => {
    if (!window.confirm(
      '⚠️ TOTAL RESET: This will permanently delete ALL data for this device — including sensor readings, consumption history, analytics, refill history, alerts, and shopping list.\n\nThe AI will start learning from scratch. This cannot be undone.\n\nAre you absolutely sure?'
    )) return
    
    setRefreshing(true)
    try {
      await resetDeviceSmartVariables(deviceId)
      setToast({ type: 'success', message: '✅ Total Reset complete. Everything cleared. AI is starting fresh.' })
      await init()
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-10 animate-fade-in relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-down ${
          toast.type === 'success' ? 'bg-sage-900 text-cream-50' : 'bg-rust-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-sage-400" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}

      <DeviceIdModal
        open={deviceModalOpen}
        initialValue={deviceId || ''}
        onSave={async (id) => {
          await saveProfile({ device_id: id })
          setDeviceModalOpen(false)
          loadData()
        }}
      />

      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-sage-100 text-sage-700 uppercase tracking-tighter">Kitchen Overview</span>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-sage-400 uppercase tracking-widest">System Online</span>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-sage-950">
            Welcome, <span className="text-sage-600">{profile?.name || 'Manager'}</span>
          </h2>
          <p className="text-sage-500 mt-2 max-w-md font-body">
            You have <span className="text-sage-950 font-semibold">{alerts.length} active alerts</span> regarding your inventory stock and expiry.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleProcessAI}
            title="Process AI Metrics Now"
            disabled={refreshing}
            className={`btn-secondary p-4 rounded-2xl shadow-sm border-emerald-100 text-emerald-600 hover:bg-emerald-50 ${refreshing ? 'animate-pulse' : ''}`}
          >
            <Brain className="w-5 h-5" />
          </button>
          <button 
            onClick={handleReset}
            title="Reset AI Training"
            disabled={refreshing}
            className={`btn-secondary p-4 rounded-2xl shadow-sm border-rust-100 text-rust-600 hover:bg-rust-50 ${refreshing ? 'animate-pulse' : ''}`}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleRefresh}
            className={`btn-secondary p-4 rounded-2xl shadow-sm ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCcw className="w-5 h-5 text-sage-600" />
          </button>
          <button 
            onClick={() => navigate('/add-item')}
            className="btn-primary flex items-center gap-3 shadow-lg shadow-sage-900/10 h-[56px] px-8"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
      </header>

      {/* Inventory Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-sage-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-sage-500" />
            Smart Slots
          </h3>
          <span className="text-xs font-mono text-sage-400 bg-white px-3 py-1 rounded-full shadow-sm">
            Device ID: <span className="text-sage-600 font-bold">{deviceId}</span>
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ITEM_SLOTS.map((slotId) => (
            <SlotCard 
              key={slotId} 
              slotId={slotId} 
              item={items[slotId]} 
              deviceId={deviceId}
              onRefill={(msg) => {
                loadData()
                setToast({ type: 'success', message: msg || 'Refill successful' })
              }}
              onError={(err) => setToast({ type: 'error', message: err })}
              onAdd={() => navigate('/add-item', { state: { slotId } })}
            />
          ))}
        </div>
      </section>

      {/* Bottom Section: Alerts & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-sage-900">Recent Alerts</h3>
            <button 
              onClick={() => navigate('/alerts')}
              className="text-sage-500 text-sm font-semibold flex items-center gap-1 hover:text-sage-700 transition-colors"
            >
              View Feed <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))
            ) : (
              <div className="card p-8 text-center bg-sage-50/50 border-dashed border-2">
                <p className="text-sage-400 font-medium font-body italic">All systems normal. No active alerts.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Summary */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-sage-900">Stats Overview</h3>
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sage-500 text-sm font-body">Total Items</span>
              <span className="text-2xl font-bold text-sage-900">{Object.keys(items).length}</span>
            </div>
            <div className="h-px bg-sage-900/5" />
            <div className="flex items-center justify-between">
              <span className="text-sage-500 text-sm font-body">Low Stock</span>
              <span className={`text-2xl font-bold ${alerts.some(a => a.type === 'LOW_STOCK') ? 'text-rust-500' : 'text-sage-900'}`}>
                {alerts.filter(a => a.type === 'LOW_STOCK').length}
              </span>
            </div>
            <button 
              onClick={() => navigate('/shopping-list')}
              className="w-full btn-secondary mt-2 flex items-center justify-center gap-2 group h-[52px]"
            >
              Generate Shopping List
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlotCard({ slotId, item, deviceId, onRefill, onError, onAdd }) {
  const [highlight, setHighlight] = useState(false)
  const prevWeightRef = useRef(item?.current_quantity)

  useEffect(() => {
    // Trigger highlight on ANY meaningful update (quantity, threshold, or days_left)
    // This makes the UI feel 'alive' when AI recalculates everything
    const currentVal = `${item?.current_quantity}-${item?.threshold}-${item?.days_left}`
    
    if (!prevWeightRef.current) {
      prevWeightRef.current = currentVal
      return
    }

    if (prevWeightRef.current !== currentVal) {
      setHighlight(true)
      const timer = setTimeout(() => setHighlight(false), 1200)
      prevWeightRef.current = currentVal
      return () => clearTimeout(timer)
    }
  }, [item?.current_quantity, item?.threshold, item?.days_left])

  if (!item) {
    return (
      <button 
        onClick={onAdd}
        className="card p-6 border-dashed border-2 bg-sage-50/30 hover:bg-sage-50 hover:border-sage-300 transition-all text-center flex flex-col items-center justify-center group h-64"
      >
        <div className="w-12 h-12 rounded-full bg-white border border-sage-200 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-sage-400" />
        </div>
        <p className="text-sage-500 font-bold uppercase tracking-widest text-[10px] mb-1">Slot {slotId.split('_')[1]}</p>
        <p className="text-sage-400 text-sm font-body">Tap to configure item</p>
      </button>
    )
  }

  const daysLeft = item.days_left ?? 30
  const isLow = item.current_quantity <= item.threshold && item.threshold > 0
  
  // Box is lifted if live weight is significantly less than box weight (25g)
  // We use current_weight which already has 25g subtracted, so if it's < 0 (effectively 0)
  // we check if the raw weight was < 10g. 
  // Actually, let's just say if real weight is 0 and it's live, it's either empty or lifted.
  // But a more robust way is to check if it's < 5g (raw)
  const isLifted = item.current_quantity <= 0 && item.is_live 

  return (
    <div className={`card overflow-hidden group hover:translate-y-[-4px] transition-all duration-300 relative
      ${isLow ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100' : 'bg-green-50 border-green-100'} 
      ${highlight ? 'animate-slot-update z-10' : ''}`}>
      
      {isLifted && (
        <div className="absolute inset-0 bg-sage-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-20 animate-in">
          <div className="w-16 h-16 rounded-full bg-rust-500/20 border border-rust-500 flex items-center justify-center mb-4 animate-bounce">
            <Package className="w-8 h-8 text-rust-500" />
          </div>
          <h5 className="text-white font-bold text-lg mb-1">Box Lifted!</h5>
          <p className="text-cream-100/70 text-[10px] leading-relaxed uppercase tracking-widest font-bold">
            Please keep your box back on the slot
          </p>
        </div>
      )}
      <div className="p-6 pb-2">
        <div className="flex items-start justify-between mb-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${isLow ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            Slot {slotId.split('_')[1]}
          </div>
          {item.is_live && (
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase animate-pulse ${isLow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>Live</span>
          )}
        </div>
        
        <h4 className={`text-xl font-bold truncate mb-1 ${isLow ? 'text-red-800' : 'text-slate-900'}`}>{item.name}</h4>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${isLow ? 'text-red-400' : 'text-blue-400'}`}>
          <Weight className="w-3 h-3" />
          <span>{Math.round(item.current_quantity)} / {Math.round(item.capacity)} {item.unit || 'g'}</span>
        </div>
      </div>

      {/* AI Metrics Section */}
      <div className="px-6 py-4 flex flex-col gap-2.5">
        {/* Row 1: Threshold */}
        <div className={`flex items-center justify-between text-[10px] font-bold px-3 py-2 rounded-xl border ${isLow ? 'bg-red-100/60 border-red-200/60 text-red-600' : 'bg-blue-50/50 border-blue-100/50 text-blue-600'}`}>
          <div className="flex items-center gap-2">
            <Bell className="w-3 h-3" />
            <span className="uppercase tracking-wider">AI Threshold</span>
          </div>
          <span className="text-xs">{Math.round(item.threshold || 0)} {item.unit || 'g'}</span>
        </div>

        {/* Row 2: Avg Rate */}
        <div className={`flex items-center justify-between text-[10px] font-bold px-3 py-2 rounded-xl border ${isLow ? 'bg-red-100/60 border-red-200/60 text-red-600' : 'bg-sky-50/50 border-sky-100/50 text-sky-600'}`}>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3" />
            <span className="uppercase tracking-wider">Avg Usage</span>
          </div>
          <span className="text-xs">{Math.round(item.avg_consumption || 0)}{item.unit || 'g'} / use</span>
        </div>

        {/* Row 3: Estimated Time */}
        <div className={`flex items-center justify-between text-[10px] font-bold px-3 py-2 rounded-xl border ${isLow ? 'bg-red-100/60 border-red-200/60 text-red-600' : 'bg-indigo-50/50 border-indigo-100/50 text-indigo-600'}`}>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span className="uppercase tracking-wider">Estimated</span>
          </div>
          <span className="text-xs">~{daysLeft} uses left</span>
        </div>
      </div>
    </div>
  )
}

function RefillButton({ item, deviceId, onRefill, onError }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAction = async (type) => {
    if (!deviceId) return onError('Device ID is required for refill.')
    
    setLoading(true)
    try {
      await handleRefill({
        device_id: deviceId,
        itemId: item.id,
        refill_type: type,
        quantity_input: type === 'reset' ? item.capacity : Number(amount)
      })
      setShowConfirm(false)
      setAmount('')
      onRefill(type === 'reset' ? `Reset ${item.name} to full capacity` : `Added ${amount}${item.unit || 'g'} to ${item.name}`)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="animate-in space-y-2">
        <div className="flex gap-2">
          <input 
            type="number" 
            placeholder="Qty"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-sage-200 rounded-xl text-sm focus:ring-4 focus:ring-sage-500/10 transition-all font-bold placeholder:font-normal"
          />
          <button 
            disabled={loading || !amount}
            onClick={() => handleAction('normal')}
            className="px-5 py-2 bg-sage-900 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-sage-950 transition-colors shadow-lg shadow-sage-900/10"
          >
            Add
          </button>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={loading}
            onClick={() => handleAction('reset')}
            className="flex-1 px-3 py-2 bg-sage-100 text-sage-900 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-sage-200 transition-colors"
          >
            Reset to Max
          </button>
          <button 
            disabled={loading}
            onClick={() => { setShowConfirm(false); setAmount(''); }}
            className="px-3 py-2 text-sage-400 text-[10px] font-bold uppercase tracking-wider hover:text-sage-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button 
      onClick={() => setShowConfirm(true)}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-sage-200 text-sage-600 font-bold text-xs hover:bg-sage-900 hover:text-cream-50 hover:border-sage-900 transition-all group shadow-sm bg-white"
    >
      <History className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
      Quick Refill
    </button>
  )
}

function AlertRow({ alert }) {
  const isExpiry = alert.type === 'EXPIRY'
  const Icon = isExpiry ? Clock : AlertTriangle

  return (
    <div className="card p-5 flex items-center gap-5 hover:shadow-md transition-shadow cursor-default group border-sage-100">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
        isExpiry ? 'bg-amber-100 text-amber-600' : 'bg-rust-100 text-rust-600'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isExpiry ? 'text-amber-600' : 'text-rust-600'}`}>
            {alert.type.replace('_', ' ')}
          </span>
          <span className="text-sage-300">/</span>
          <span className="text-sage-400 text-[10px] font-mono">{new Date(alert.created_at?.toDate() || Date.now()).toLocaleDateString()}</span>
        </div>
        <p className="text-sage-900 font-bold text-sm truncate font-body">{alert.message}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-48 bg-cream-200 rounded-xl" />
        <div className="h-6 w-96 bg-cream-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-64 bg-cream-100 rounded-[2rem] border border-cream-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-cream-100 rounded-2xl" />)}
        </div>
        <div className="h-56 bg-cream-100 rounded-[2rem]" />
      </div>
    </div>
  )
}

export function PlaceholderPage({ emoji, title, description, badge }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-24 h-24 rounded-[2.5rem] bg-sage-50 border border-sage-100
                      flex items-center justify-center text-5xl mb-6 shadow-soft">
        {emoji}
      </div>
      <span className="badge bg-cream-200 text-sage-600 mb-3">{badge}</span>
      <h2 className="text-3xl font-bold text-sage-950 mb-3">{title}</h2>
      <p className="text-sage-500/80 text-sm max-w-xs leading-relaxed font-body">
        {description}
      </p>
    </div>
  )
}

