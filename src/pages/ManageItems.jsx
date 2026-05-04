import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlusCircle, 
  Settings2, 
  Trash2, 
  Edit3, 
  Package, 
  Weight, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchItemsByDeviceId, deleteItem } from '../services/itemService'

export default function ManageItems() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const deviceId = profile?.device_id

  useEffect(() => {
    if (deviceId) {
      loadItems()
    } else {
      setLoading(false)
    }
  }, [deviceId])

  async function loadItems() {
    setLoading(true)
    try {
      const data = await fetchItemsByDeviceId(deviceId)
      setItems(data)
    } catch (err) {
      console.error('Failed to load items:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"? This will clear all its history and alerts.`)) return
    
    setDeleting(itemId)
    try {
      await deleteItem(deviceId, itemId)
      await loadItems()
    } catch (err) {
      alert('Failed to delete item: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse pt-10">
      <div className="h-12 bg-sage-100 rounded-xl w-1/3"></div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-sage-50 rounded-[2rem]"></div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-4 h-4 text-sage-400" />
            <span className="text-[10px] font-bold text-sage-400 uppercase tracking-widest">Inventory Control</span>
          </div>
          <h2 className="text-4xl font-bold text-sage-950 font-display">Manage Items</h2>
          <p className="text-sage-500 mt-1 font-body">Configure slots, update pricing, or remove inventory.</p>
        </div>
        
        {items.length < 4 && (
          <button 
            onClick={() => navigate('/add-item')}
            className="btn-primary flex items-center gap-2 h-[52px] px-8 !rounded-2xl shadow-xl shadow-sage-900/10"
          >
            <PlusCircle className="w-5 h-5" />
            Add New Item
          </button>
        )}
      </header>

      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="card p-6 group hover:shadow-xl transition-all duration-300 relative overflow-hidden border-none bg-white/70 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-sage-900 text-cream-50 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold text-sage-400 uppercase tracking-widest bg-sage-50 px-2 py-0.5 rounded">Slot {item.id.split('_')[1]}</span>
                       <h3 className="text-xl font-bold text-sage-950">{item.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-sage-400 font-medium">
                       <span className="flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> {item.capacity}{item.unit} Cap.</span>
                       <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.max_expiry_days}d Cycle</span>
                       <span className="text-sage-900 font-bold">₹{item.price_per_unit}/kg</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => navigate(`/edit-item/${item.id}`)}
                    className="p-3 hover:bg-sage-100 rounded-xl text-sage-500 hover:text-sage-900 transition-colors"
                    title="Edit Item"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id, item.name)}
                    disabled={deleting === item.id}
                    className="p-3 hover:bg-rust-50 rounded-xl text-rust-400 hover:text-rust-600 transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className={`w-5 h-5 ${deleting === item.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <div className="w-px h-8 bg-sage-100 mx-2 hidden md:block" />
                  <button 
                    onClick={() => navigate(`/item/${item.id}`)}
                    className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center text-sage-400 hover:bg-sage-900 hover:text-white transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card p-20 text-center bg-sage-50/50 border-dashed border-2">
            <Package className="w-16 h-16 text-sage-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-sage-900">No Items Yet</h3>
            <p className="text-sage-500 mt-2">Start by adding your first ingredient to a smart slot.</p>
            <button 
              onClick={() => navigate('/add-item')}
              className="btn-primary mt-8 inline-flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Add Your First Item
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
