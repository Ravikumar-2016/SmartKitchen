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
        if (currentData.month.startsWith('Cycle')) {
          setCurrentMonth(currentData.month.toUpperCase())
        } else {
          const d = new Date(currentData.month + '-01')
          setCurrentMonth(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase())
        }
        
        const chartData = []
        let colorIdx = 0
        items.forEach(item => {
          // Assuming 10x avg consumption = item consumption for simulation/initial view
          const slotConsumption = (item.avg_consumption * 10) || currentData.consumption?.[item.id]?.total_consumed || 0
          const pricePerKg = item.price_per_unit || 0
          
          // Convert consumption to KG if unit is 'g' (standard in this app)
          const consumptionInKg = (item.unit === 'kg' || item.unit === 'pcs') ? slotConsumption : slotConsumption / 1000
          
          const isExpired = item.expiry_date && (new Date(item.expiry_date) <= new Date())
          const waste = isExpired ? (item.current_quantity || 0) : 0
          const wasteInKg = (item.unit === 'kg' || item.unit === 'pcs') ? waste : waste / 1000
          const wasteCost = wasteInKg * pricePerKg

          chartData.push({
            name: item.name,
            consumed: Math.round(slotConsumption),
            cost: consumptionInKg * pricePerKg,
            waste: Math.round(waste),
            waste_cost: wasteCost,
            unit: item.unit || 'g',
            price_per_kg: pricePerKg,
            color: CHART_COLORS[colorIdx % CHART_COLORS.length]
          })
          colorIdx++
        })
        setData(chartData)
      } else {
        const d = new Date()
        setCurrentMonth(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase())
        
        // Show simulated data even if no analytics record exists yet
        const chartData = items.map((item, idx) => {
          const consumption = Math.round(item.avg_consumption * 10)
          const pricePerKg = item.price_per_unit || 0
          const consumptionInKg = (item.unit === 'kg' || item.unit === 'pcs') ? consumption : consumption / 1000
          
          const isExpired = item.expiry_date && (new Date(item.expiry_date) <= new Date())
          const waste = isExpired ? (item.current_quantity || 0) : 0
          const wasteInKg = (item.unit === 'kg' || item.unit === 'pcs') ? waste : waste / 1000
          const wasteCost = wasteInKg * pricePerKg

          return {
            name: item.name,
            consumed: consumption,
            cost: consumptionInKg * pricePerKg,
            waste: Math.round(waste),
            waste_cost: wasteCost,
            unit: item.unit || 'g',
            price_per_kg: pricePerKg,
            color: CHART_COLORS[idx % CHART_COLORS.length]
          }
        })
        setData(chartData)
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
            <h3 className="text-xl font-bold text-sage-950 font-display">Monthly Consumption</h3>
            <p className="text-sm text-sage-400 font-medium font-body">Current cycle usage metrics</p>
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
                          {payload[0].value.toLocaleString()} <span className="text-xs text-sage-400 font-normal">{payload[0].payload.unit || 'g'}</span>
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

      {/* Monthly Cost Chart */}
      <section className="card p-8 min-h-[400px] border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-bold text-sage-950 font-display">Monthly Cost (Estimated)</h3>
            <p className="text-sm text-sage-400 font-medium font-body">Spending based on consumption and unit price</p>
          </div>
          <div className="flex items-center gap-2 bg-cream-50 px-4 py-2 rounded-xl border border-cream-100">
             <span className="text-xs font-bold text-sage-700">TOTAL: ₹{data.reduce((acc, curr) => acc + (curr.cost || 0), 0).toFixed(2)}</span>
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
                          ₹{payload[0].value.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-sage-400 mt-1">
                          Rate: ₹{payload[0].payload.price_per_kg}/kg
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="cost" radius={[12, 12, 0, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#d97706" /> // Amber for cost
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Waste Analysis Chart */}
      <section className="card p-8 min-h-[400px] border-none shadow-xl bg-rust-50/30 backdrop-blur-sm border border-rust-100/20">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-bold text-rust-950 font-display">Waste Analysis</h3>
            <p className="text-sm text-rust-400 font-medium font-body">Financial impact of expired items</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 bg-rust-50 px-4 py-2 rounded-xl border border-rust-100">
               <span className="text-[10px] font-bold text-rust-700 uppercase tracking-widest">Total Loss: ₹{data.reduce((acc, curr) => acc + (curr.waste_cost || 0), 0).toFixed(2)}</span>
            </div>
            <span className="text-[9px] text-rust-400 mr-2">Total Qty: {data.reduce((acc, curr) => acc + (curr.waste || 0), 0)}g</span>
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
                tick={{ fill: '#bf9f9f', fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#bf9f9f', fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: '#f7f4f4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-rust-900 p-4 rounded-2xl shadow-2xl border-none">
                        <p className="text-[10px] font-bold text-rust-300 uppercase tracking-widest mb-1">
                          {payload[0].payload.name}
                        </p>
                        <p className="text-xl font-bold text-cream-50">
                          ₹{payload[0].payload.waste_cost?.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-rust-300 mt-1 font-medium">
                          {payload[0].value.toLocaleString()} {payload[0].payload.unit || 'g'} lost
                        </p>
                        <p className="text-[10px] text-rust-400 mt-1 italic">
                          * Expired while in stock
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="waste" radius={[12, 12, 0, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#991b1b" /> // Deep red for waste
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>


    </div>
  )
}
