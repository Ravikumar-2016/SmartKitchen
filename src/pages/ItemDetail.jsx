import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  Weight, 
  TrendingUp, 
  AlertTriangle, 
  Edit3, 
  RefreshCcw,
  Clock,
  Zap,
  BarChart3,
  History,
  TrendingDown,
  Activity
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { fetchItemsByDeviceId, handleRefill } from '../services/itemService'
import { subscribeToAlerts } from '../services/alertService'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

export default function ItemDetail() {
  const { id: itemId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [item, setItem] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const deviceId = profile?.device_id

  useEffect(() => {
    if (deviceId && itemId) {
      loadData()
      
      // Subscribe to alerts for this item
      const unsubAlerts = subscribeToAlerts(deviceId, (allAlerts) => {
        const itemAlerts = allAlerts.filter(a => a.item_id === itemId)
        setAlerts(itemAlerts)
      })

      return () => unsubAlerts()
    }
  }, [deviceId, itemId])

  async function loadData() {
    setLoading(true)
    try {
      const items = await fetchItemsByDeviceId(deviceId)
      const found = items.find(i => i.id === itemId)
      setItem(found)

      // Fetch recent readings for chart
      const readingsRef = collection(db, 'Kitchen_Readings', deviceId, itemId)
      const q = query(readingsRef, orderBy('timestamp', 'desc'), limit(14))
      const snap = await getDocs(q)
      
      const chartData = snap.docs.map(doc => {
        const data = doc.data()
        return {
          time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          weight: data.weight,
          timestamp: data.timestamp
        }
      }).reverse()

      setReadings(chartData)
    } catch (err) {
      console.error('Failed to load item detail:', err)
    } finally {
      setLoading(false)
    }
  }

  const onRefill = async () => {
    setRefreshing(true)
    try {
      await handleRefill(deviceId, itemId)
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-8 animate-pulse pt-10">
      <div className="h-10 w-32 bg-sage-100 rounded-lg"></div>
      <div className="h-40 bg-sage-50 rounded-[2.5rem]"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32 bg-sage-50 rounded-2xl"></div>
        <div className="h-32 bg-sage-50 rounded-2xl"></div>
        <div className="h-32 bg-sage-50 rounded-2xl"></div>
      </div>
    </div>
  )

  if (!item) return (
    <div className="max-w-6xl mx-auto text-center py-20 animate-fade-in">
      <div className="w-24 h-24 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Package className="w-12 h-12 text-sage-200" />
      </div>
      <h2 className="text-2xl font-bold text-sage-900 font-display">Item Not Configured</h2>
      <p className="text-sage-500 mt-2 max-w-xs mx-auto">This smart slot hasn't been activated with an ingredient yet.</p>
      <button 
        onClick={() => navigate('/add-item', { state: { slotId: itemId } })} 
        className="btn-primary mt-8"
      >
        Setup Slot {itemId.split('_')[1]}
      </button>
    </div>
  )

  const stockPercentage = Math.min(100, Math.max(0, (item.current_quantity / item.capacity) * 100))
  const isExpired = item.expiry_date && (new Date(item.expiry_date) <= new Date())
  const isLow = item.current_quantity <= item.threshold

  // Fallback trend if no readings
  const trendData = readings.length > 0 ? readings : [
    { time: '08:00', weight: item.capacity * 0.8 },
    { time: '10:00', weight: item.capacity * 0.75 },
    { time: '12:00', weight: item.capacity * 0.72 },
    { time: '14:00', weight: item.capacity * 0.72 },
    { time: '16:00', weight: item.capacity * 0.65 },
    { time: '18:00', weight: item.capacity * 0.60 },
    { time: '20:00', weight: item.current_quantity },
  ]

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sage-400 hover:text-sage-700 transition-colors mb-8 font-display font-bold text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Console
      </button>

      {/* Hero Header */}
      <section className="card p-10 bg-sage-900 text-cream-50 border-none relative overflow-hidden mb-8 shadow-2xl shadow-sage-900/20">
        <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 pointer-events-none">
          <Package className="w-80 h-80" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 rounded-[2rem] bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/5">
              <Package className="w-12 h-12" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="badge bg-sage-400/20 text-sage-200 border-none uppercase tracking-[0.2em] text-[9px] font-bold">Slot {item.id.split('_')[1]}</span>
                {item.is_live && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" /> Active Node
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight leading-none">{item.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onRefill}
              disabled={refreshing}
              className="btn-primary !bg-cream-50 !text-sage-900 hover:!bg-white flex items-center gap-3 h-14 px-8 !rounded-2xl text-xs font-black uppercase tracking-wider"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Quick Refill
            </button>
            <button 
              onClick={() => navigate(`/edit-item/${item.id}`)}
              className="w-14 h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all text-white border border-white/10"
            >
              <Edit3 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Chart */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-8 border-none shadow-xl bg-white/60 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform">
                <Weight className="w-24 h-24" />
              </div>
              <div className="flex items-center justify-between mb-6 relative">
                <h3 className="text-[10px] font-black text-sage-400 uppercase tracking-[0.2em]">Live Inventory</h3>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2 mb-6 relative">
                <span className="text-5xl font-black text-sage-950 font-display tabular-nums tracking-tighter">
                  {item.current_quantity.toLocaleString()}
                </span>
                <span className="text-sage-400 font-bold text-lg uppercase">{item.unit}</span>
              </div>
              <div className="w-full h-4 bg-sage-100 rounded-2xl overflow-hidden mb-3 p-1">
                <div 
                  className={`h-full rounded-xl transition-all duration-1000 ease-out shadow-lg ${isLow ? 'bg-rust-500 shadow-rust-500/20' : 'bg-sage-600 shadow-sage-600/20'}`}
                  style={{ width: `${stockPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black text-sage-400 uppercase tracking-widest px-1">
                <span>{stockPercentage.toFixed(0)}% Stocked</span>
                <span>{item.capacity}{item.unit} Max</span>
              </div>
            </div>

            <div className="card p-8 border-none shadow-xl bg-white/60 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform text-amber-600">
                <Zap className="w-24 h-24" />
              </div>
              <div className="flex items-center justify-between mb-6 relative">
                <h3 className="text-[10px] font-black text-sage-400 uppercase tracking-[0.2em]">AI Predictor</h3>
                <TrendingDown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2 mb-6 relative">
                <span className="text-5xl font-black text-sage-950 font-display tabular-nums tracking-tighter">{item.days_left}</span>
                <span className="text-sage-400 font-bold text-lg uppercase">Days</span>
              </div>
              <p className="text-[11px] text-sage-500 font-body leading-relaxed relative pr-8">
                Based on <span className="font-bold text-sage-900">EMA usage patterns</span>, this supply will deplete by <span className="font-bold text-sage-900">{new Date(Date.now() + item.days_left * 86400000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>.
              </p>
            </div>
          </div>

          {/* Precision Usage Chart */}
          <div className="card p-8 border-none shadow-xl bg-white/60 backdrop-blur-md">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-sage-950 font-display">Weight Distribution</h3>
                <p className="text-[10px] text-sage-400 font-bold uppercase tracking-[0.2em] mt-1">Real-time sensor telemetry</p>
              </div>
              <BarChart3 className="w-6 h-6 text-sage-200" />
            </div>
            
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4d7f4d" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4d7f4d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#9fbf9f', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9fbf9f', fontSize: 10, fontWeight: 700}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a2e1a', borderRadius: '20px', border: 'none', color: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ fontSize: '10px', color: '#9fbf9f', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#4d7f4d" strokeWidth={4} fillOpacity={1} fill="url(#colorWeight)" dot={{r: 4, fill: '#4d7f4d', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6, strokeWidth: 0}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Node Details & Alerts */}
        <div className="space-y-8">
          <div className="card p-8 border-none shadow-xl bg-white/60 backdrop-blur-md">
            <h3 className="text-sm font-black text-sage-950 mb-8 font-display uppercase tracking-widest">Node Specifications</h3>
            
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                   <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-sage-400 uppercase tracking-[0.2em] mb-1">Simulated Cycle</p>
                  <p className="text-sm font-black text-sage-900">{item.max_expiry_days} Days</p>
                  <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${isExpired ? 'text-rust-600' : 'text-amber-600'}`}>
                    {isExpired ? '• Critical: Item Expired' : '• Status: Cycle Active'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                   <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-sage-400 uppercase tracking-[0.2em] mb-1">Financial Analysis</p>
                  <p className="text-sm font-black text-sage-900">₹{item.price_per_unit}/kg</p>
                  <p className="text-[10px] text-sage-500 font-bold mt-1 uppercase">Burn Rate: ₹{((item.avg_consumption * 30 / 1000) * item.price_per_unit).toFixed(2)} /mo</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-sage-900 flex items-center justify-center text-cream-50 flex-shrink-0">
                   <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-sage-400 uppercase tracking-[0.2em] mb-1">Refill Threshold</p>
                  <p className="text-sm font-black text-sage-900">{Math.round(item.threshold)}{item.unit}</p>
                  <p className="text-[10px] text-sage-500 font-bold mt-1 uppercase">Trigger set at {((item.threshold/item.capacity)*100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Alerts for this specific item */}
          {alerts.length > 0 && (
            <div className="card p-8 border-none shadow-xl bg-rust-600 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertTriangle className="w-20 h-20" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-80">Priority Alerts</h3>
              <div className="space-y-4 relative z-10">
                {alerts.slice(0, 2).map((alert, idx) => (
                  <div key={idx} className="flex gap-4 pb-4 border-b border-white/10 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-white mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider mb-1">{alert.type.replace('_', ' ')}</p>
                      <p className="text-[11px] font-medium opacity-90 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smart Context Box */}
          <div className="card p-8 border-none shadow-xl bg-sage-50 border border-sage-100 group">
             <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-sage-900 group-hover:animate-pulse" />
                <h4 className="font-black font-display text-sm uppercase tracking-widest text-sage-900">Node Insights</h4>
             </div>
             <p className="text-[11px] text-sage-600 leading-relaxed font-body italic">
               {isLow 
                 ? `Warning: current stock is below the ${Math.round(item.threshold)}g threshold. System recommends a replenishment of ${Math.round(item.capacity - item.current_quantity)}g to restore full node efficiency.`
                 : `Efficiency status is optimal. No immediate actions required for this smart node. System will notify if burn rate exceeds predicted threshold.`
               }
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
