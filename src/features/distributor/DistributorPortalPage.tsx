import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import {
  Store,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  RefreshCw,
  Search,
  Package,
  Layers,
  Building2,
  DollarSign,
  Calendar,
  Clock,
  Send,
  Plus
} from 'lucide-react'

interface Vendor {
  id: string
  name: string
  code: string
  phone?: string
  email?: string
  website?: string
  catalog_count?: number
  matched_count?: number
  active_po_count?: number
}

interface VendorItem {
  id: string
  vendor_id: string
  vendor_sku: string
  name: string
  brand?: string
  pack_size?: string
  uom?: string
  category?: string
  unit_cost: number
  active: boolean
  match_id?: string
  canonical_product_id?: string
  canonical_product_name?: string
  canonical_standard_uom?: string
  normalized_unit_cost?: number
  match_confidence?: number
  match_status?: string
}

interface CanonicalProduct {
  id: string
  name: string
  category: string
  standard_uom: string
  match_count?: number
}

interface VendorOrder {
  id: string
  order_date: string
  expected_date?: string
  status: string
  notes?: string
  line_count: number
  total_amount: number
}

export default function DistributorPortalPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'catalog' | 'matching' | 'orders' | 'upload'>('catalog')
  const [items, setItems] = useState<VendorItem[]>([])
  const [canonicalProducts, setCanonicalProducts] = useState<CanonicalProduct[]>([])
  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // CSV Upload form state
  const [csvText, setCsvText] = useState('')
  const [uploading, setUploading] = useState(false)

  // Manual match modal
  const [matchingItem, setMatchingItem] = useState<VendorItem | null>(null)
  const [selectedCanonicalId, setSelectedCanonicalId] = useState('')

  useEffect(() => {
    fetchVendors()
    fetchCanonicalProducts()
  }, [])

  useEffect(() => {
    if (selectedVendorId) {
      if (activeTab === 'catalog' || activeTab === 'matching') {
        fetchCatalog(selectedVendorId)
      } else if (activeTab === 'orders') {
        fetchOrders(selectedVendorId)
      }
    }
  }, [selectedVendorId, activeTab])

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const fetchVendors = async () => {
    try {
      const res = await api.get('/distributor/vendors')
      setVendors(res.data)
      if (res.data.length > 0 && !selectedVendorId) {
        setSelectedVendorId(res.data[0].id)
      }
    } catch (e: any) {
      console.error(e)
    }
  }

  const fetchCanonicalProducts = async () => {
    try {
      const res = await api.get('/distributor/canonical-products')
      setCanonicalProducts(res.data)
    } catch (e: any) {
      console.error(e)
    }
  }

  const fetchCatalog = async (vId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/distributor/catalog?vendorId=${vId}`)
      setItems(res.data)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async (vId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/distributor/orders?vendorId=${vId}`)
      setOrders(res.data)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCsvUpload = async () => {
    if (!csvText.trim()) {
      showMsg('Please paste or upload CSV text before submitting', 'error')
      return
    }
    setUploading(true)
    try {
      const res = await api.post('/distributor/catalog-upload', {
        vendorId: selectedVendorId,
        csvContent: csvText,
      })
      showMsg(`Successfully processed ${res.data.totalImported} items (${res.data.candidateCount} need review)`, 'success')
      setCsvText('')
      setActiveTab('catalog')
      fetchCatalog(selectedVendorId)
      fetchVendors()
    } catch (e: any) {
      showMsg(e.response?.data?.error || 'Failed to upload catalog CSV', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmMatch = async (vendorItemId: string, canonicalProductId: string) => {
    try {
      await api.post('/distributor/match', {
        canonicalProductId,
        vendorItemId,
        matchStatus: 'confirmed',
      })
      showMsg('Product match confirmed', 'success')
      fetchCatalog(selectedVendorId)
    } catch (e: any) {
      showMsg('Failed to confirm match', 'error')
    }
  }

  const handleManualMatchSubmit = async () => {
    if (!matchingItem || !selectedCanonicalId) return
    try {
      await api.post('/distributor/match', {
        canonicalProductId: selectedCanonicalId,
        vendorItemId: matchingItem.id,
        matchStatus: 'confirmed',
      })
      showMsg(`Matched ${matchingItem.name} to canonical staple`, 'success')
      setMatchingItem(null)
      setSelectedCanonicalId('')
      fetchCatalog(selectedVendorId)
    } catch (e: any) {
      showMsg('Failed to update match', 'error')
    }
  }

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.put(`/distributor/orders/${orderId}/status`, {
        status,
        expectedDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      })
      showMsg(`Order status updated to ${status}`, 'success')
      fetchOrders(selectedVendorId)
    } catch (e: any) {
      showMsg('Failed to update order status', 'error')
    }
  }

  const currentVendor = vendors.find(v => v.id === selectedVendorId)

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const matchedCount = items.filter(i => i.canonical_product_id).length
  const matchPercentage = items.length > 0 ? Math.round((matchedCount / items.length) * 100) : 0

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Toast message */}
      {message && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            background: message.type === 'error' ? '#EF4444' : '#10B981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {message.type === 'error' ? <AlertCircle style={{ width: 18, height: 18 }} /> : <CheckCircle2 style={{ width: 18, height: 18 }} />}
          {message.text}
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#EDE9FE', color: '#6D28D9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
            <Store style={{ width: 14, height: 14 }} />
            <span>Distributor & Vendor Partner Ecosystem</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Distributor Operations & Product Matching Desk
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Manage supplier catalogs, upload price guides, and resolve cross-vendor product matches ("Match & Crush") for CulinaryOS.
          </p>
        </div>

        {/* Vendor Selector dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: '8px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <Building2 style={{ width: 18, height: 18, color: 'var(--color-primary)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Distributor</div>
            <select
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-2xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL CATALOG ITEMS</span>
            <Package style={{ width: 18, height: 18, color: '#3B82F6' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {items.length.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>SKUs</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Managed in {currentVendor?.name || 'vendor'} order guide
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-2xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>CROSS-VENDOR MATCH RATE</span>
            <Layers style={{ width: 18, height: 18, color: '#10B981' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>
            {matchPercentage}% <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>({matchedCount} matched)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Linked to canonical kitchen staples
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-2xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE PURCHASE ORDERS</span>
            <Truck style={{ width: 18, height: 18, color: '#F59E0B' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {currentVendor?.active_po_count || orders.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>orders</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Pending vendor acknowledgment
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'catalog' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'catalog' ? '#8B5CF6' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileSpreadsheet style={{ width: 16, height: 16 }} />
          Catalog & SKUs ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('matching')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'matching' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'matching' ? '#8B5CF6' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers style={{ width: 16, height: 16 }} />
          Product Match Desk ("Match & Crush")
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'upload' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'upload' ? '#8B5CF6' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Upload style={{ width: 16, height: 16 }} />
          Upload Price Sheet (CSV)
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'orders' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'orders' ? '#8B5CF6' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Truck style={{ width: 16, height: 16 }} />
          Inbound PO Desk ({orders.length})
        </button>
      </div>

      {/* ── TAB 1: CATALOG & SKUS ────────────────────────────────────────────── */}
      {activeTab === 'catalog' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, maxWidth: 600 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search style={{ position: 'absolute', left: 10, top: 10, width: 16, height: 16, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by SKU, product name, brand..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => setActiveTab('upload')}
              style={{
                background: '#8B5CF6',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Upload style={{ width: 15, height: 15 }} />
              Upload Price Sheet
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Product Description</th>
                <th style={{ padding: '10px 12px' }}>Brand</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Pack Size</th>
                <th style={{ padding: '10px 12px' }}>Case Cost</th>
                <th style={{ padding: '10px 12px' }}>Canonical Match</th>
                <th style={{ padding: '10px 12px' }}>Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 100).map(item => {
                const isMatched = Boolean(item.canonical_product_id)
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {item.vendor_sku}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.brand || '—'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.category || 'General'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.pack_size}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>
                      ${Number(item.unit_cost || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {isMatched ? (
                        <span style={{ padding: '3px 8px', borderRadius: 12, background: '#DCFCE7', color: '#166534', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 style={{ width: 12, height: 12 }} />
                          {item.canonical_product_name}
                        </span>
                      ) : (
                        <button
                          onClick={() => setMatchingItem(item)}
                          style={{
                            background: '#FEF3C7',
                            color: '#92400E',
                            border: '1px solid #FCD34D',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Match to Staple
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {item.normalized_unit_cost ? `$${Number(item.normalized_unit_cost).toFixed(2)} / ${item.canonical_standard_uom || 'lb'}` : '—'}
                    </td>
                  </tr>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No catalog items found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: PRODUCT MATCH DESK ("MATCH & CRUSH") ───────────────────────── */}
      {activeTab === 'matching' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Cross-Vendor Product Matching Desk ("Match & Crush")
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Map distributor-specific SKUs to universal kitchen staples to enable side-by-side price comparison and lowest-cost split MRP order optimization.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Distributor SKU</th>
                <th style={{ padding: '10px 12px' }}>Vendor Product Name</th>
                <th style={{ padding: '10px 12px' }}>Pack Size</th>
                <th style={{ padding: '10px 12px' }}>Target Canonical Staple</th>
                <th style={{ padding: '10px 12px' }}>Normalized Rate</th>
                <th style={{ padding: '10px 12px' }}>Name Similarity</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.vendor_sku}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.pack_size}</td>
                  <td style={{ padding: '12px' }}>
                    {item.canonical_product_name ? (
                      <span style={{ fontWeight: 700, color: '#6D28D9' }}>{item.canonical_product_name}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unlinked</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>
                    {item.normalized_unit_cost ? `$${Number(item.normalized_unit_cost).toFixed(2)} / ${item.canonical_standard_uom || 'lb'}` : '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {item.match_confidence ? (
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: item.match_confidence >= 85 ? '#DCFCE7' : '#FEF3C7', color: item.match_confidence >= 85 ? '#166534' : '#92400E', fontSize: 12, fontWeight: 700 }}>
                        {item.match_confidence}% similar
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {item.canonical_product_id ? (
                      <button
                        onClick={() => handleConfirmMatch(item.id, item.canonical_product_id!)}
                        style={{
                          background: item.match_status === 'confirmed' ? '#E0E7FF' : '#10B981',
                          color: item.match_status === 'confirmed' ? '#3730A3' : '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {item.match_status === 'confirmed' ? 'Confirmed' : 'Approve Match'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setMatchingItem(item)}
                        style={{
                          background: '#8B5CF6',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Link Product
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: UPLOAD PRICE SHEET (CSV) ─────────────────────────────────── */}
      {activeTab === 'upload' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 24, maxWidth: 900, margin: '0 auto', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D28D9' }}>
              <Upload style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Ingest Distributor Price Guide (CSV)
              </h2>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Target Vendor: <strong>{currentVendor?.name}</strong>. Auto-normalizes pack sizes and executes fuzzy SKU matching.
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              EXPECTED CSV HEADER FORMAT:
            </div>
            <code style={{ fontSize: 12, color: 'var(--color-primary)', fontFamily: 'monospace' }}>
              sku, name, brand, pack_size, uom, category, unit_cost
            </code>
          </div>

          <textarea
            rows={10}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`sku,name,brand,pack_size,uom,category,unit_cost\nDNS-1001,Peaches Diced 100% Juice,Dennis Select,6/#10 cans,case,Canned Fruits,48.50\nDNS-1002,Orange Juice Thickened Nectar,Thick & Easy,12/32oz,case,Thickened Beverages,32.75`}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-app)',
              fontFamily: 'monospace',
              fontSize: 13,
              marginBottom: 16,
              color: 'var(--text-primary)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              onClick={() => {
                setCsvText(
                  `sku,name,brand,pack_size,uom,category,unit_cost\n${currentVendor?.code?.toUpperCase() || 'VEN'}-2001,Chicken Breast Boneless Skinless 4oz,Chef Pride,40/4oz,case,Meat & Poultry,62.40\n${currentVendor?.code?.toUpperCase() || 'VEN'}-2002,Broccoli Florets Frozen IQF,Garden Fresh,12/2 lb,case,Produce & Fruits,28.50\n${currentVendor?.code?.toUpperCase() || 'VEN'}-2003,Russet Potatoes #1 Burbank,Valley Farm,50 lb,case,Produce & Fruits,22.00`
                )
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Load Sample Data
            </button>
            <button
              onClick={handleCsvUpload}
              disabled={uploading}
              style={{
                background: '#8B5CF6',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Upload style={{ width: 16, height: 16 }} />
              {uploading ? 'Processing & Matching...' : 'Upload & Auto-Match'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: INBOUND PURCHASE ORDER DESK ───────────────────────────────── */}
      {activeTab === 'orders' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Inbound Purchase Orders ({currentVendor?.name})
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Orders submitted by facility dietary directors for delivery fulfillment and line-item confirmation.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Order ID</th>
                <th style={{ padding: '10px 12px' }}>Order Date</th>
                <th style={{ padding: '10px 12px' }}>Expected Delivery</th>
                <th style={{ padding: '10px 12px' }}>Lines</th>
                <th style={{ padding: '10px 12px' }}>Total Amount</th>
                <th style={{ padding: '10px 12px' }}>Current Status</th>
                <th style={{ padding: '10px 12px' }}>Rep Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>
                    {order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.order_date}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.expected_date || 'Standard Truck Day'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{order.line_count} items</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${Number(order.total_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: order.status === 'received' ? '#DCFCE7' : '#DBEAFE', color: order.status === 'received' ? '#166534' : '#1E40AF' }}>
                      {order.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {order.status !== 'received' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'acknowledged')}
                        style={{
                          background: '#8B5CF6',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Acknowledge Order
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No purchase orders placed with this distributor yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Match Modal */}
      {matchingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              maxWidth: 500,
              width: '90%',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>
              Link SKU to Universal Kitchen Staple
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Select the Canonical Product that corresponds to <strong>{matchingItem.name}</strong> ({matchingItem.pack_size}).
            </p>

            <select
              value={selectedCanonicalId}
              onChange={e => setSelectedCanonicalId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: 14,
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                marginBottom: 20,
              }}
            >
              <option value="">-- Choose Canonical Staple --</option>
              {canonicalProducts.map(cp => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} ({cp.category} · {cp.standard_uom})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setMatchingItem(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualMatchSubmit}
                disabled={!selectedCanonicalId}
                style={{
                  background: '#8B5CF6',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
