import { useEffect, useState } from 'react'
import { ShoppingCart, RefreshCw, CheckCircle2, Package, Printer, Share2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchShoppingList, syncShoppingList } from '../services/shoppingService'

export default function ShoppingList() {
  const { profile } = useAuth()
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const deviceId = profile?.device_id

  useEffect(() => {
    if (deviceId) loadList()
  }, [deviceId])

  async function loadList() {
    setLoading(true)
    try {
      const data = await fetchShoppingList(deviceId)
      setList(data)
    } catch (err) {
      console.error('Failed to load shopping list:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const updated = await syncShoppingList(deviceId)
      setList(updated)
    } catch (err) {
      alert('Failed to sync: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="animate-pulse space-y-6">
    <div className="h-40 bg-sage-50 rounded-[2.5rem]" />
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-sage-50 rounded-2xl" />)}
    </div>
  </div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Stats */}
      <div className="glass-card p-10 flex flex-col items-center text-center overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <ShoppingCart className="w-40 h-40" />
        </div>
        
        <div className="w-16 h-16 rounded-[2rem] bg-sage-900 text-cream-50 flex items-center justify-center mb-6 shadow-xl shadow-sage-900/20">
          <ShoppingCart className="w-8 h-8" />
        </div>
        
        <h2 className="text-3xl font-bold text-sage-950 mb-2">Shopping List</h2>
        <p className="text-sage-500 max-w-sm font-body">
          {list?.items?.length > 0 
            ? `You have ${list.items.length} items that need restocking based on your inventory thresholds.`
            : 'Your pantry is fully stocked! Nothing needs to be purchased right now.'}
        </p>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary flex items-center gap-2 py-3 px-8"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Refresh List'}
          </button>
          {list?.items?.length > 0 && (
            <button className="btn-secondary flex items-center gap-2 py-3 px-6">
              <Share2 className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {list?.items?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-sm font-bold text-sage-400 uppercase tracking-widest">Items to Buy</h3>
            <span className="text-xs font-mono text-sage-400">Updated: {list.updated_at?.toDate().toLocaleTimeString()}</span>
          </div>

          <div className="card divide-y divide-cream-100 overflow-hidden">
            {list.items.map((item, idx) => (
              <div key={idx} className="p-5 flex items-center gap-4 hover:bg-sage-50/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-sage-100/50 flex items-center justify-center text-sage-600 group-hover:bg-sage-600 group-hover:text-white transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sage-900">{item.item_name}</h4>
                  <p className="text-xs text-sage-400 font-mono uppercase tracking-tighter">Current: {item.current_quantity} units</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-sage-400 uppercase mb-0.5">Required</p>
                  <p className="text-lg font-bold text-sage-900">+{item.required_quantity}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full py-6 border-2 border-dashed border-cream-200 rounded-[2rem] text-sage-400 font-bold flex items-center justify-center gap-2 hover:bg-sage-50 hover:border-sage-300 transition-all">
            <Printer className="w-5 h-5" />
            Print Checklist
          </button>
        </div>
      )}
    </div>
  )
}

