import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { VendorItem } from '../../types/purchasing'
import CommunityPluginRegistry from './CommunityPluginRegistry'

export default function DistributorPortalPage() {
  const [items, setItems] = useState<VendorItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // New Item State
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    vendorSku: '',
    name: '',
    brand: 'Dennis Select',
    packSize: '6/#10 cans',
    uom: 'case',
    category: 'Canned Goods',
    unitCost: 0,
  })
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await api.get('/purchasing/items')
      setItems(res.data)
    } catch (err) {
      console.error(err)
      // Fallback demo data
      setItems([
        { id: 'vi-1', vendor_id: 'dennis-1', vendor_sku: 'DNS-1001', name: 'Peaches Diced in 100% Juice', brand: 'Dennis Select', pack_size: '6/#10 cans', uom: 'case', category: 'Canned Fruits', unit_cost: 48.50, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-2', vendor_id: 'dennis-1', vendor_sku: 'DNS-1002', name: 'Orange Juice Thickened Nectar', brand: 'Thick & Easy', pack_size: '12/32oz', uom: 'case', category: 'Thickened Beverages', unit_cost: 32.75, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-3', vendor_id: 'dennis-1', vendor_sku: 'DNS-1003', name: 'Pureed Green Beans', brand: 'Puree Supreme', pack_size: '24/4oz', uom: 'case', category: 'Pureed Foods', unit_cost: 29.90, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-4', vendor_id: 'dennis-1', vendor_sku: 'DNS-1004', name: 'Chicken Breast Boneless Skinless 4oz', brand: 'Dennis Farms', pack_size: '40/4oz', uom: 'case', category: 'Poultry & Meat', unit_cost: 64.20, active: true, vendor_name: 'Dennis Food Service' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Find default vendor (Dennis or first)
      const vendorsRes = await api.get('/purchasing/vendors')
      const vendorId = vendorsRes.data[0]?.id || 'dennis-1'

      await api.post('/purchasing/items', {
        ...formData,
        vendorId,
      })
      setMessage({ text: 'Item published to distributor catalog successfully!', type: 'success' })
      setShowAddModal(false)
      setFormData({
        vendorSku: '',
        name: '',
        brand: '',
        packSize: '',
        uom: 'case',
        category: '',
        unitCost: 0,
      })
      fetchItems()
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to publish item', type: 'error' })
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.vendor_sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(items.map(i => i.category || 'General')))

  return (
    <div className="sl-page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#DBEAFE', color: '#1E40AF', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            <span>🚚</span> Distributor Partner Portal
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            Product Catalog & Item Master
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Direct portal for food distributors (Dennis Food Service) to manage broadline SKUs, pack sizes, and contract unit pricing.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span>+</span> Add New Product SKU
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: message.type === 'success' ? '#065F46' : '#991B1B',
          border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          fontSize: 14,
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by SKU or item name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14 }}
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Catalog Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px' }}>Distributor SKU</th>
              <th style={{ padding: '12px' }}>Product Description</th>
              <th style={{ padding: '12px' }}>Brand</th>
              <th style={{ padding: '12px' }}>Category</th>
              <th style={{ padding: '12px' }}>Pack Size</th>
              <th style={{ padding: '12px' }}>UOM</th>
              <th style={{ padding: '12px' }}>Contract Price</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.vendor_sku}</td>
                <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.brand || '—'}</td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.category || 'General'}</td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.pack_size}</td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.uom}</td>
                <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  ${Number(item.unit_cost || 0).toFixed(2)}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#DCFCE7', color: '#166534', fontSize: 12, fontWeight: 700 }}>
                    Active
                  </span>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No catalog items found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Product SKU */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              Publish Product SKU to Catalog
            </h3>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Vendor SKU / Item #</label>
                <input
                  type="text"
                  placeholder="e.g. DNS-5482"
                  value={formData.vendorSku}
                  onChange={e => setFormData({ ...formData, vendorSku: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Product Description</label>
                <input
                  type="text"
                  placeholder="e.g. Whole Peeled Tomatoes in Juice"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Dennis Select"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Canned Vegetables"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Pack Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 6/#10 cans"
                    value={formData.packSize}
                    onChange={e => setFormData({ ...formData, packSize: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Unit of Measure (UOM)</label>
                  <input
                    type="text"
                    placeholder="case / lb / bag"
                    value={formData.uom}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Unit Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.unitCost}
                  onChange={e => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Publish SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Community Open Connector Marketplace */}
      <CommunityPluginRegistry />
    </div>
  )
}
