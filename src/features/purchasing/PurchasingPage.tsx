import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { Vendor, VendorItem, OrderGuideEntry, SuggestedOrderLine, PurchaseOrder } from '../../types/purchasing'
import DennisImportModal from './DennisImportModal'

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<'order-guide' | 'suggested' | 'catalog' | 'orders'>('order-guide')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  
  // Data states
  const [orderGuide, setOrderGuide] = useState<OrderGuideEntry[]>([])
  const [catalogItems, setCatalogItems] = useState<VendorItem[]>([])
  const [suggestedLines, setSuggestedLines] = useState<SuggestedOrderLine[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modals / forms
  const [showDennisImport, setShowDennisImport] = useState(false)
  const [showAddGuideModal, setShowAddGuideModal] = useState(false)
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false)
  const [newGuideItem, setNewGuideItem] = useState({ vendorItemId: '', parLevel: 0, onHand: 0, sortGroup: '' })
  const [newCatalogItem, setNewCatalogItem] = useState({ vendorSku: '', name: '', brand: '', packSize: '', uom: 'case', category: '', unitCost: 0 })

  // Fetch vendors on load
  useEffect(() => {
    fetchVendors()
  }, [])

  useEffect(() => {
    if (selectedVendorId) {
      if (activeTab === 'order-guide') fetchOrderGuide(selectedVendorId)
      if (activeTab === 'catalog') fetchCatalog(selectedVendorId)
      if (activeTab === 'suggested') fetchSuggestedOrder(selectedVendorId)
      if (activeTab === 'orders') fetchOrders()
    }
  }, [selectedVendorId, activeTab])

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const fetchVendors = async () => {
    try {
      const res = await api.get('/purchasing/vendors')
      setVendors(res.data)
      if (res.data.length > 0 && !selectedVendorId) {
        setSelectedVendorId(res.data[0].id)
      }
    } catch (err: any) {
      console.error(err)
      // Fallback demo data if backend offline/local demo mode
      const demoVendors: Vendor[] = [
        { id: 'dennis-1', name: 'Dennis Food Service', code: 'dennis', active: true, website: 'https://dennisfoodservice.com' }
      ]
      setVendors(demoVendors)
      setSelectedVendorId(demoVendors[0].id)
    }
  }

  const fetchOrderGuide = async (vendorId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/purchasing/order-guide?vendorId=${vendorId}`)
      setOrderGuide(res.data)
    } catch (err) {
      console.error(err)
      // Fallback data
      setOrderGuide([
        { id: 'og-1', vendor_id: vendorId, vendor_item_id: 'vi-1', item_name: 'Peaches Diced in 100% Juice', vendor_sku: 'DNS-1001', pack_size: '6/#10 cans', uom: 'case', par_level: 5, on_hand: 2, unit_cost: 48.50, category: 'Canned Fruits' },
        { id: 'og-2', vendor_id: vendorId, vendor_item_id: 'vi-2', item_name: 'Orange Juice Thickened Nectar', vendor_sku: 'DNS-1002', pack_size: '12/32oz', uom: 'case', par_level: 4, on_hand: 2, unit_cost: 32.75, category: 'Thickened Beverages' },
        { id: 'og-3', vendor_id: vendorId, vendor_item_id: 'vi-3', item_name: 'Pureed Green Beans', vendor_sku: 'DNS-1003', pack_size: '24/4oz', uom: 'case', par_level: 3, on_hand: 2, unit_cost: 29.90, category: 'Pureed Foods' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchCatalog = async (vendorId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/purchasing/items?vendorId=${vendorId}`)
      setCatalogItems(res.data)
    } catch (err) {
      console.error(err)
      setCatalogItems([
        { id: 'vi-1', vendor_id: vendorId, vendor_sku: 'DNS-1001', name: 'Peaches Diced in 100% Juice', brand: 'Dennis Select', pack_size: '6/#10 cans', uom: 'case', category: 'Canned Fruits', unit_cost: 48.50, active: true },
        { id: 'vi-2', vendor_id: vendorId, vendor_sku: 'DNS-1002', name: 'Orange Juice Thickened Nectar', brand: 'Thick & Easy', pack_size: '12/32oz', uom: 'case', category: 'Thickened Beverages', unit_cost: 32.75, active: true },
        { id: 'vi-3', vendor_id: vendorId, vendor_sku: 'DNS-1003', name: 'Pureed Green Beans', brand: 'Puree Supreme', pack_size: '24/4oz', uom: 'case', category: 'Pureed Foods', unit_cost: 29.90, active: true },
        { id: 'vi-4', vendor_id: vendorId, vendor_sku: 'DNS-1004', name: 'Chicken Breast Boneless Skinless 4oz', brand: 'Dennis Farms', pack_size: '40/4oz', uom: 'case', category: 'Poultry & Meat', unit_cost: 64.20, active: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchSuggestedOrder = async (vendorId: string) => {
    setLoading(true)
    try {
      const res = await api.post('/purchasing/suggested-order', { vendorId })
      setSuggestedLines(res.data.lines)
    } catch (err) {
      console.error(err)
      setSuggestedLines([
        { vendorItemId: 'vi-1', vendorSku: 'DNS-1001', itemName: 'Peaches Diced in 100% Juice', vendor: 'Dennis Food Service', packSize: '6/#10 cans', uom: 'case', unitCost: 48.50, parLevel: 5, onHand: 2, suggestedQty: 3, category: 'Canned Fruits' },
        { vendorItemId: 'vi-2', vendorSku: 'DNS-1002', itemName: 'Orange Juice Thickened Nectar', vendor: 'Dennis Food Service', packSize: '12/32oz', uom: 'case', unitCost: 32.75, parLevel: 4, onHand: 2, suggestedQty: 2, category: 'Thickened Beverages' },
        { vendorItemId: 'vi-3', vendorSku: 'DNS-1003', itemName: 'Pureed Green Beans', vendor: 'Dennis Food Service', packSize: '24/4oz', uom: 'case', unitCost: 29.90, parLevel: 3, onHand: 2, suggestedQty: 1, category: 'Pureed Foods' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await api.get('/purchasing/orders')
      setOrders(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateGuideCounts = async (id: string, parLevel: number, onHand: number) => {
    try {
      await api.put(`/purchasing/order-guide/${id}`, { parLevel, onHand })
      setOrderGuide(prev => prev.map(g => g.id === id ? { ...g, par_level: parLevel, on_hand: onHand } : g))
      showMsg('Order guide updated')
    } catch (err) {
      showMsg('Failed to update order guide', 'error')
    }
  }

  const handleCreateOrderFromSuggested = async () => {
    if (suggestedLines.length === 0) return
    try {
      const lines = suggestedLines.map(l => ({
        vendorItemId: l.vendorItemId,
        qtyOrdered: l.suggestedQty,
        unitCost: l.unitCost
      }))
      await api.post('/purchasing/orders', {
        vendorId: selectedVendorId,
        orderDate: new Date().toISOString().slice(0, 10),
        lines,
        notes: 'Generated from Par & Suggested Purchasing'
      })
      showMsg('Purchase order created successfully!')
      setActiveTab('orders')
    } catch (err) {
      showMsg('Failed to create purchase order', 'error')
    }
  }

  const handleExportCSV = () => {
    const selectedVendor = vendors.find(v => v.id === selectedVendorId)
    const vendorName = selectedVendor ? selectedVendor.name : 'Dennis Food Service'
    const header = 'vendor,name,sku,pack,uom,qty\n'
    const rows = suggestedLines.map(l => `"${vendorName}","${l.itemName}","${l.vendorSku}","${l.packSize}","${l.uom}",${l.suggestedQty}`).join('\n')
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${vendorName.toLowerCase().replace(/\s+/g, '-')}-suggested-order-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showMsg('CSV order sheet exported')
  }

  const handlePrintSheet = () => {
    window.print()
  }

  const currentVendor = vendors.find(v => v.id === selectedVendorId)

  return (
    <div className="sl-page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            Purchasing & Order Guide
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Distributor-agnostic ordering, par levels, catalog mapping, and export sheets (Target: Dennis Food Service).
          </p>
        </div>

        {/* Vendor Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Vendor:</span>
          <select
            value={selectedVendorId}
            onChange={e => setSelectedVendorId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
            ))}
          </select>
        </div>
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

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 8 }}>
        <button
          onClick={() => setActiveTab('order-guide')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'order-guide' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'order-guide' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'order-guide' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Standing Order Guide
        </button>
        <button
          onClick={() => setActiveTab('suggested')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'suggested' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'suggested' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'suggested' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Suggested Order Generator
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'catalog' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'catalog' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'catalog' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Distributor Catalog & SKUs
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'orders' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'orders' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'orders' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Purchase Orders History
        </button>
      </div>

      {/* Tab: Standing Order Guide */}
      {activeTab === 'order-guide' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Par Levels & On-Hand Inventory
            </h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDennisImport(true)}
                style={{
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Import Dennis CSV Guide
              </button>
              <button
                onClick={() => setShowAddGuideModal(true)}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                + Add Item to Guide
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Item Name</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Pack Size / UOM</th>
                <th style={{ padding: '10px 12px' }}>Par Level</th>
                <th style={{ padding: '10px 12px' }}>On Hand</th>
                <th style={{ padding: '10px 12px' }}>Unit Cost</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orderGuide.map(item => {
                const needsOrder = Number(item.on_hand) < Number(item.par_level)
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{item.vendor_sku}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.item_name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.category || 'General'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.pack_size} ({item.uom})</td>
                    <td style={{ padding: '12px' }}>
                      <input
                        type="number"
                        defaultValue={item.par_level}
                        onBlur={e => updateGuideCounts(item.id, Number(e.target.value), Number(item.on_hand))}
                        style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <input
                        type="number"
                        defaultValue={item.on_hand}
                        onBlur={e => updateGuideCounts(item.id, Number(item.par_level), Number(e.target.value))}
                        style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>${Number(item.unit_cost || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px' }}>
                      {needsOrder ? (
                        <span style={{ padding: '3px 8px', borderRadius: 12, background: '#FEE2E2', color: '#991B1B', fontSize: 12, fontWeight: 700 }}>
                          Order {Math.ceil(Number(item.par_level) - Number(item.on_hand))}
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 12, background: '#DCFCE7', color: '#166534', fontSize: 12, fontWeight: 700 }}>
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {orderGuide.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No items in order guide. Add items from the catalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Suggested Order Generator */}
      {activeTab === 'suggested' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Suggested Purchase Order for {currentVendor?.name}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Items automatically calculated based on Par Level minus On-Hand inventory.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handlePrintSheet}
                style={{
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                🖨️ Print Sheet
              </button>
              <button
                onClick={handleExportCSV}
                style={{
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                📥 Export CSV
              </button>
              <button
                onClick={handleCreateOrderFromSuggested}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                ✅ Create Purchase Order
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Vendor</th>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Item Name</th>
                <th style={{ padding: '10px 12px' }}>Pack Size</th>
                <th style={{ padding: '10px 12px' }}>UOM</th>
                <th style={{ padding: '10px 12px' }}>Par</th>
                <th style={{ padding: '10px 12px' }}>On Hand</th>
                <th style={{ padding: '10px 12px' }}>Suggested Qty</th>
                <th style={{ padding: '10px 12px' }}>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {suggestedLines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{line.vendor}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{line.vendorSku}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{line.itemName}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{line.packSize}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{line.uom}</td>
                  <td style={{ padding: '12px' }}>{line.parLevel}</td>
                  <td style={{ padding: '12px' }}>{line.onHand}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {line.suggestedQty}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>
                    ${(line.suggestedQty * line.unitCost).toFixed(2)}
                  </td>
                </tr>
              ))}
              {suggestedLines.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    All items meet or exceed par levels. No suggested orders needed!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Catalog & SKUs */}
      {activeTab === 'catalog' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Distributor Catalog Items ({currentVendor?.name})
            </h2>
            <button
              onClick={() => setShowAddCatalogModal(true)}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              + Add Catalog Item
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Name</th>
                <th style={{ padding: '10px 12px' }}>Brand</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Pack Size</th>
                <th style={{ padding: '10px 12px' }}>UOM</th>
                <th style={{ padding: '10px 12px' }}>Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {catalogItems.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.vendor_sku}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.brand || '—'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.category || 'General'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.pack_size}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.uom}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>${Number(item.unit_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Purchase Orders History */}
      {activeTab === 'orders' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Recent Purchase Orders
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Vendor</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Notes</th>
                <th style={{ padding: '10px 12px' }}>Created By</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{order.order_date}</td>
                  <td style={{ padding: '12px' }}>{order.vendor_name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 12,
                      background: order.status === 'received' ? '#DCFCE7' : order.status === 'submitted' ? '#DBEAFE' : '#FEF3C7',
                      color: order.status === 'received' ? '#166534' : order.status === 'submitted' ? '#1E40AF' : '#92400E',
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.notes || '—'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.created_by_name || 'System'}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No purchase orders recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showDennisImport && (
        <DennisImportModal
          vendorId={selectedVendorId}
          vendorName={currentVendor?.name || 'Dennis Food Service'}
          onClose={() => setShowDennisImport(false)}
          onSuccess={() => {
            showMsg('Dennis Order Guide imported successfully!')
            fetchOrderGuide(selectedVendorId)
          }}
        />
      )}
    </div>
  )
}
