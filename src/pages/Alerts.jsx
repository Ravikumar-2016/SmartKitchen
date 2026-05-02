import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, Calendar, Search, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchAlerts, evaluateInventory } from '../services/alertService'

export default function Alerts() {
  const { profile } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const deviceId = profile?.device_id

  useEffect(() => {
    if (deviceId) {
      loadAlerts()
    } else {
      setLoading(false)
    }
  }, [deviceId])

  async function loadAlerts() {
    setLoading(true)
    try {
      const data = await fetchAlerts(deviceId)
      const sorted = data.sort((a, b) => (b.created_at?.toDate() || 0) - (a.created_at?.toDate() || 0))
      setAlerts(sorted)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await evaluateInventory(deviceId)
      await loadAlerts()
    } catch (err) {
      console.error('Failed to sync alerts:', err)
    } finally {
      setSyncing(false)
    }
  }

  const filteredAlerts = alerts.filter(a => filter === 'ALL' || a.type === filter)

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-4 animate-pulse pt-10">
      <div className="h-10 bg-sage-100 rounded-xl w-1/3 mb-10"></div>
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-sage-50 rounded-[2rem]"></div>)}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold text-sage-950 font-display">Alerts Center</h2>
          <p className="text-sage-500 mt-2 font-body">Manage your stock warnings and product expiration dates.</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary flex items-center gap-2 h-[44px] px-6 !rounded-xl text-xs shadow-lg shadow-sage-900/10"
        >
          {syncing ? 'Syncing...' : 'Sync Alerts'}
        </button>
      </header>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-10">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" />
          <input 
            type="text" 
            placeholder="Search notifications..." 
            className="input-field pl-11 py-3 bg-white/50 backdrop-blur-sm border-none shadow-sm"
          />
        </div>
        
        <div className="flex bg-sage-100/50 p-1.5 rounded-[2rem] w-full md:w-auto backdrop-blur-sm">
          {['ALL', 'LOW_STOCK', 'EXPIRY'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-[1.5rem] text-xs font-bold transition-all ${
                filter === type 
                  ? 'bg-sage-900 text-cream-50 shadow-lg' 
                  : 'text-sage-500 hover:text-sage-900'
              }`}
            >
              {type === 'ALL' ? 'Everything' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  )
}

function AlertCard({ alert }) {
  const isExpiry = alert.type === 'EXPIRY'
  const Icon = isExpiry ? Clock : AlertTriangle
  const date = alert.created_at?.toDate()

  return (
    <div className="card p-6 flex flex-col sm:flex-row items-start gap-6 hover:shadow-xl hover:translate-y-[-2px] transition-all border-none bg-white/70 backdrop-blur-md group">
      <div className={`w-14 h-14 rounded-[2rem] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
        isExpiry 
          ? 'bg-amber-100 text-amber-600 shadow-inner' 
          : 'bg-rust-50 text-rust-600 shadow-inner'
      }`}>
        <Icon className="w-7 h-7" />
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`badge uppercase tracking-[0.15em] text-[9px] font-black px-3 py-1.5 rounded-full ${
            isExpiry ? 'bg-amber-100 text-amber-700' : 'bg-rust-100 text-rust-700'
          }`}>
            {alert.type.replace('_', ' ')}
          </span>
          <span className="text-sage-300 text-[10px] uppercase font-mono tracking-tighter">
            • {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <h4 className="text-xl font-bold text-sage-950 font-display leading-tight">{alert.message}</h4>
        <p className="text-sage-500 font-body text-sm leading-relaxed max-w-xl">
          System alert generated based on your kitchen inventory status. Re-stocking is recommended to avoid stockouts.
        </p>
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <button className="flex-1 sm:flex-none btn-secondary h-[44px] px-6 !rounded-xl text-xs whitespace-nowrap bg-white hover:bg-sage-900 hover:text-white transition-all">
          Dismiss
        </button>
        <button className="flex-1 sm:flex-none btn-primary h-[44px] px-6 !rounded-xl text-xs whitespace-nowrap shadow-lg shadow-sage-900/10">
          Sync Status
        </button>
      </div>
    </div>
  )
}

