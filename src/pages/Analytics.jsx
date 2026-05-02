import { useState, useEffect } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import { TrendingUp, Calendar, Info, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchMonthlyAnalytics, updateMonthlyAnalytics } from '../services/analyticsService'
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { fetchItemsByDeviceId } from '../services/itemService'

const CHART_COLORS = ['#4d7f4d', '#3b653b', '#6f9f6f', '#c8d9c8']

export default function Analytics() {
  const { profile } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [currentMonth, setCurrentMonth] = useState('')

  const deviceId = profile?.device_id

  useEffect(() => {
    if (deviceId) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [deviceId])

  async function loadData() {
    setLoading(true)
    try {
      const items = await fetchItemsByDeviceId(deviceId)
      const analyticsRecords = await fetchMonthlyAnalytics(deviceId)
      
      let currentData = null
      if (analyticsRecords && analyticsRecords.length > 0) {
        currentData = analyticsRecords[0]
      }

      if (currentData) {
        const d = new Date(currentData.month + '-01')
        setCurrentMonth(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase())
        
        const chartData = []
        let colorIdx = 0
        items.forEach(item => {
          const slotConsumption = currentData.consumption?.[item.id]?.total_consumed || 0
          chartData.push({
            name: item.name,
            consumed: slotConsumption,
            color: CHART_COLORS[colorIdx % CHART_COLORS.length]
          })
          colorIdx++
        })
        setData(chartData)
      } else {
        const d = new Date()
        setCurrentMonth(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase())
        setData([])
      }

    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await updateMonthlyAnalytics(deviceId)
      await loadData()
    } catch (err) {
      console.error('Failed to sync analytics:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleInjectReadings = async () => {
    if (!deviceId) return;
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const startTime = startOfDay.getTime();
      const endTime = now.getTime();
      const interval = 10 * 60 * 1000; // 10 minutes

      const slots = ['item_1', 'item_2', 'item_3', 'item_4'];
      const initialWeights = {
        item_1: 45000,
        item_2: 4500,
        item_3: 4800,
        item_4: 5500
      };

      // Define specific times for consumption (e.g., Breakfast, Lunch, Dinner, Snack)
      const consumptionHours = [8, 9, 13, 14, 19, 20, 21]; 

      for (const slotId of slots) {
        let currentWeight = initialWeights[slotId];
        const readingsRef = collection(db, 'Kitchen_Readings', deviceId, slotId);
        
        for (let time = startTime; time <= endTime; time += interval) {
          const dateObj = new Date(time);
          const hour = dateObj.getHours();
          const minutes = dateObj.getMinutes();

          // Only consume if the current hour is in our "usage" list and it's the top of the hour (roughly)
          if (consumptionHours.includes(hour) && minutes === 0) {
            const consumption = Math.floor(Math.random() * 150) + 50; 
            currentWeight -= consumption;
          }

          let refillData = {};
          // Simulate a refill at 11:00 AM IST
          if (hour === 11 && minutes === 0) {
            const added = 2500;
            currentWeight += added;
            refillData = {
              refill_detected: true,
              quantity_added: added,
              refill_time_ist: dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
          }

          if (currentWeight < 0) currentWeight = 0;

          const timestampIST = dateObj.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'medium'
          });

          await addDoc(readingsRef, {
            timestamp: time, // Kept for cron logic compatibility
            timestamp_ist: timestampIST,
            weight: currentWeight,
            ...refillData,
            created_at: serverTimestamp()
          });
        }
      }

      alert("Practical mock data (usage only during meals) injected! Refill added at 11:00 AM.");
    } catch (err) {
      console.error(err);
      alert("Failed to inject readings: " + err.message);
    }
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-10 animate-pulse pt-10">
      <div className="h-20 bg-sage-100 rounded-2xl w-1/2"></div>
      <div className="h-[400px] bg-sage-50 rounded-[2rem]"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-40 bg-sage-50 rounded-[2rem]"></div>
        <div className="h-40 bg-sage-50 rounded-[2rem]"></div>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-sage-900 text-cream-100 uppercase tracking-widest text-[10px]">Insights Engine</span>
          </div>
          <h2 className="text-4xl font-bold text-sage-950 font-display">Consumption Analytics</h2>
          <p className="text-sage-500 mt-2 font-body max-w-lg">
            Visualize your kitchen usage patterns and optimize your shopping cycles with real-time tracking data.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleInjectReadings}
            className="btn-secondary flex items-center gap-2 h-[44px] px-6 !rounded-xl text-xs shadow-lg"
          >
            Inject Today's Readings
          </button>
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary flex items-center gap-2 h-[44px] px-6 !rounded-xl text-xs shadow-lg shadow-sage-900/10"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </header>

      {/* Main Consumption Chart */}
      <section className="card p-8 min-h-[400px] border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-bold text-sage-950 font-display">Item Consumption (Current Month)</h3>
            <p className="text-sm text-sage-400 font-medium font-body">Total grams/units consumed per slot</p>
          </div>
          <div className="flex items-center gap-2 bg-sage-50 px-4 py-2 rounded-xl border border-sage-100">
             <Calendar className="w-4 h-4 text-sage-500" />
             <span className="text-xs font-bold text-sage-700 font-mono">{currentMonth || 'LOADING...'}</span>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9fbf9f', fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9fbf9f', fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: '#f4f7f4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-sage-900 p-4 rounded-2xl shadow-2xl border-none">
                        <p className="text-[10px] font-bold text-sage-300 uppercase tracking-widest mb-1">
                          {payload[0].payload.name}
                        </p>
                        <p className="text-xl font-bold text-cream-50">
                          {payload[0].value.toLocaleString()} <span className="text-xs text-sage-400 font-normal">g</span>
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="consumed" radius={[12, 12, 0, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Grid of secondary charts / stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="card p-8 bg-sage-900 border-none text-cream-50 overflow-hidden relative">
          <TrendingUp className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.03] text-white" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-sage-800 text-sage-300 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-lg font-bold font-display">Efficiency Score</h4>
              <p className="text-sm text-sage-400 font-body">Usage stability index</p>
            </div>
          </div>
          <div className="flex items-center gap-6 relative z-10">
             <div className="text-6xl font-bold font-display">84%</div>
             <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  +12.4% vs last month
                </p>
                <p className="text-xs text-sage-400 font-body">Lower waste detected in Slot 1</p>
             </div>
          </div>
        </section>

        <section className="card p-8 bg-white/50 border-none shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-sage-950 font-display">AI Forecast</h4>
              <p className="text-sm text-sage-400 font-body">Predicted grocery run</p>
            </div>
          </div>
          <div className="space-y-5">
             <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sage-700 font-body">Estimated Restock</span>
                <span className="text-sm font-bold text-sage-950 font-mono">In 4 Days</span>
             </div>
             <div className="h-2 bg-sage-100 rounded-full overflow-hidden">
                <div className="h-full bg-sage-500 w-[70%] transition-all duration-1000" />
             </div>
             <p className="text-[10px] text-sage-400 font-body italic">
               * Based on your consumption rate of Rice and Flour over the last 14 days.
             </p>
          </div>
        </section>
      </div>
    </div>
  )
}
