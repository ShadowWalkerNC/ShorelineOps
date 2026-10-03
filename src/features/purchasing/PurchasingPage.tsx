import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../security/AuthContext'
import { Vendor, VendorItem, OrderGuideEntry, SuggestedOrderLine, PurchaseOrder, PurchaseOrderLine } from '../../types/purchasing'
import DennisImportModal from './DennisImportModal'
import {
  Printer,
  Download,
  CheckCircle2,
  ShoppingCart,
  Send,
  Package,
  Plus,
  ArrowUpDown,
  TrendingDown,
  Award,
  Sparkles,
  Layers,
  Store
} from 'lucide-react'

/** PO line joined with its order-guide match state (for receiving). */
interface ReceiveLine extends PurchaseOrderLine {
  guide_id?: string | null
  guide_on_hand?: number | null
}

interface PriceMatrixRow {
  canonicalId: string
  canonicalName: string
  category: string
  standardUom: string
  bestUnitCost: number | null
  winningVendorId: string | null
  winningVendorName: string | null
  costSavingsPerUnit: number | null
  priceSpreadPercent: number | null
  offers: Array<{
    vendorId: string
    vendorName: string
    vendorCode: string
    vendorSku: string
    itemName: string
    brand?: string
    packSize: string
    caseCost: number
    normalizedUnitCost: number
    isBestPrice: boolean
  }>
}

interface PriceMatrixSummary {
  totalCanonicalProducts: number
  comparedProductsCount: number
  singleVendorProductsCount: number
  estimatedMonthlySavings: number
}

// ── PO status presentation (B11 approval workflow) ───────────────────────────
function orderBadge(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'received':  return { bg: '#DCFCE7', fg: '#166534' }
    case 'submitted': return { bg: '#DBEAFE', fg: '#1E40AF' }
    case 'approved':  return { bg: '#EDE9FE', fg: '#5B21B6' }
    case 'cancelled': return { bg: '#F3F4F6', fg: '#6B7280' }
    case 'partial':   return { bg: '#FEF3C7', fg: '#92400E' }
    default:          return { bg: '#FEF3C7', fg: '#92400E' } // draft
  }
}

/** Orders far enough along the workflow to accept deliveries. Drafts (and
 *  cancelled orders) cannot be received — mirrors the old tab's gating. */
const RECEIVABLE_STATUSES = ['approved', 'submitted', 'received', 'partial']

export default function PurchasingPage() {
  const { atLeast } = useAuth()
  // Manager approval step (B11): only managers/admins can approve draft POs.
  // The server enforces this too (403 for everyone else); this just hides the button.
  const canApprove = atLeast('manager')
  const [activeTab, setActiveTab] = useState<'order-guide' | 'suggested' | 'catalog' | 'orders' | 'price-matrix'>('order-guide')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  
  // Data states
  const [orderGuide, setOrderGuide] = useState<OrderGuideEntry[]>([])
  const [catalogItems, setCatalogItems] = useState<VendorItem[]>([])
  const [suggestedLines, setSuggestedLines] = useState<SuggestedOrderLine[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Price Matrix state (Cut+Dry style Cross-Vendor Comparison)
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrixRow[]>([])
  const [priceMatrixSummary, setPriceMatrixSummary] = useState<PriceMatrixSummary | null>(null)
  const [matrixFilterCategory, setMatrixFilterCategory] = useState<string>('all')
  const [matrixSearch, setMatrixSearch] = useState<string>('')

  // Modals / forms
  const [showDennisImport, setShowDennisImport] = useState(false)
  const [showAddGuideModal, setShowAddGuideModal] = useState(false)
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false)
  const [newGuideItem, setNewGuideItem] = useState({ vendorItemId: '', parLevel: 0, onHand: 0, sortGroup: '' })
  const [newCatalogItem, setNewCatalogItem] = useState({ vendorSku: '', name: '', brand: '', packSize: '', uom: 'case', category: '', unitCost: 0 })

  // Receiving (B10): per-line received qty edits with partial/over-receive
  // flags, cumulative totals, and order-guide on-hand impact — the
  // consolidated receive mode for all backend purchase orders.
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([])
  const [receiveVals, setReceiveVals] = useState<Record<string, string>>({})
  const [receiving, setReceiving] = useState<Record<string, boolean>>({})
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  // Fetch vendors on load
  useEffect(() => {
    fetchVendors()
  }, [])

  useEffect(() => {
    if (activeTab === 'price-matrix') {
      fetchPriceMatrix()
    } else if (selectedVendorId) {
      if (activeTab === 'order-guide') fetchOrderGuide(selectedVendorId)
      if (activeTab === 'catalog') fetchCatalog(selectedVendorId)
      if (activeTab === 'suggested') fetchSuggestedOrder(selectedVendorId)
      if (activeTab === 'orders') fetchOrders()
    }
  }, [selectedVendorId, activeTab])

  const fetchPriceMatrix = async () => {
    setLoading(true)
    try {
      const res = await api.get('/distributor/price-matrix')
      setPriceMatrix(res.data.matrix || [])
      setPriceMatrixSummary(res.data.summary || null)
    } catch (err: any) {
      // Fallback demo price matrix
      const demoMatrix: PriceMatrixRow[] = [
        {
          canonicalId: 'prod-1',
          canonicalName: 'Chicken Breast, Boneless/Skinless',
          category: 'Poultry',
          standardUom: 'lb',
          bestUnitCost: 2.15,
          winningVendorId: 'dennis-1',
          winningVendorName: 'Dennis Food Service',
          costSavingsPerUnit: 0.40,
          priceSpreadPercent: 18.6,
          offers: [
            { vendorId: 'dennis-1', vendorName: 'Dennis Food Service', vendorCode: 'DNS', vendorSku: 'DNS-01', itemName: 'Fresh Chk Brst B/S', packSize: '4/10 lb', caseCost: 86.00, normalizedUnitCost: 2.15, isBestPrice: true },
            { vendorId: 'sysco-1', vendorName: 'Sysco Foods', vendorCode: 'SY', vendorSku: 'SY-1092', itemName: 'Chicken Breast Raw B/S', packSize: '2/20 lb', caseCost: 102.00, normalizedUnitCost: 2.55, isBestPrice: false },
          ]
        },
        {
          canonicalId: 'prod-2',
          canonicalName: 'Ground Beef 80/20 Fresh',
          category: 'Beef',
          standardUom: 'lb',
          bestUnitCost: 3.89,
          winningVendorId: 'dennis-1',
          winningVendorName: 'Dennis Food Service',
          costSavingsPerUnit: 0.31,
          priceSpreadPercent: 8.0,
          offers: [
            { vendorId: 'dennis-1', vendorName: 'Dennis Food Service', vendorCode: 'DNS', vendorSku: 'DNS-02', itemName: 'Beef Ground 80/20 Chilled', packSize: '4/10 lb', caseCost: 155.60, normalizedUnitCost: 3.89, isBestPrice: true },
            { vendorId: 'sysco-1', vendorName: 'Sysco Foods', vendorCode: 'SY', vendorSku: 'SY-2093', itemName: 'Ground Beef 80/20 Loaf', packSize: '2/20 lb', caseCost: 168.00, normalizedUnitCost: 4.20, isBestPrice: false },
          ]
        },
        {
          canonicalId: 'prod-3',
          canonicalName: 'Russet Potatoes 70ct',
          category: 'Produce',
          standardUom: 'lb',
          bestUnitCost: 0.52,
          winningVendorId: 'sysco-1',
          winningVendorName: 'Sysco Foods',
          costSavingsPerUnit: 0.06,
          priceSpreadPercent: 11.5,
          offers: [
            { vendorId: 'sysco-1', vendorName: 'Sysco Foods', vendorCode: 'SY', vendorSku: 'SY-4019', itemName: 'Potato Russet Idaho 70ct', packSize: '50 lb', caseCost: 26.00, normalizedUnitCost: 0.52, isBestPrice: true },
            { vendorId: 'dennis-1', vendorName: 'Dennis Food Service', vendorCode: 'DNS', vendorSku: 'DNS-04', itemName: 'Potatoes Russet #1 70ct', packSize: '50 lb', caseCost: 29.00, normalizedUnitCost: 0.58, isBestPrice: false },
          ]
        }
      ]
      setPriceMatrix(demoMatrix)
      setPriceMatrixSummary({
        totalCanonicalProducts: 3,
        comparedProductsCount: 3,
        singleVendorProductsCount: 0,
        estimatedMonthlySavings: 428.50,
      })
    } finally {
      setLoading(false)
    }
  }

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
      showMsg('Draft purchase order created — awaiting manager approval')
      setActiveTab('orders')
      fetchOrders()
    } catch (err) {
      showMsg('Failed to create purchase order', 'error')
    }
  }

  // ── Build from low items (B11) ──────────────────────────────────────────
  // Low-stock = order guide entries where on_hand < par_level (the same set the
  // old TruckOrdersTab built from). Creates a draft PO; the server forces
  // status='draft' and only a manager can approve it.
  const handleBuildFromLow = async () => {
    if (!selectedVendorId) {
      showMsg('Select a vendor first', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/purchasing/suggested-order', { vendorId: selectedVendorId })
      const lowLines: SuggestedOrderLine[] = res.data.lines || []
      if (lowLines.length === 0) {
        showMsg('Nothing below par — no draft PO needed')
        return
      }
      await api.post('/purchasing/orders', {
        vendorId: selectedVendorId,
        orderDate: new Date().toISOString().slice(0, 10),
        lines: lowLines.map(l => ({
          vendorItemId: l.vendorItemId,
          qtyOrdered: l.suggestedQty,
          unitCost: l.unitCost
        })),
        notes: 'Built from low-par items'
      })
      showMsg(`Draft PO created with ${lowLines.length} low-stock line(s) — awaiting manager approval`)
      fetchOrders()
    } catch (err: any) {
      showMsg(err?.response?.data?.error || 'Failed to build order from low items', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Approval workflow (B11) ─────────────────────────────────────────────
  // draft → (manager) approve → approved → submit → submitted. Enforced
  // server-side; 403 for non-managers, 409 for illegal transitions.

  const approveOrder = async (id: string) => {
    try {
      await api.post(`/purchasing/orders/${id}/approve`)
      showMsg('Purchase order approved')
      fetchOrders()
    } catch (err: any) {
      if (err?.response?.status === 403) {
        showMsg('Approval requires a manager role', 'error')
      } else {
        showMsg(err?.response?.data?.error || 'Approval failed', 'error')
      }
    }
  }

  const submitOrder = async (id: string) => {
    try {
      await api.post(`/purchasing/orders/${id}/submit`)
      showMsg('Purchase order marked as submitted to vendor')
      fetchOrders()
    } catch (err: any) {
      showMsg(err?.response?.data?.error || 'Submit failed', 'error')
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

  // ── Receiving (B10) ──────────────────────────────────────────────────────

  const receiveFlag = (total: number, ordered: number) => {
    if (!(total > 0)) return { label: 'Not received', bg: '#F3F4F6', fg: '#6B7280' }
    if (total > ordered) return { label: 'Over-received', bg: '#FEE2E2', fg: '#991B1B' }
    if (total < ordered) return { label: 'Partial', bg: '#FEF3C7', fg: '#92400E' }
    return { label: 'Complete', bg: '#DCFCE7', fg: '#166534' }
  }

  const openReceive = async (order: PurchaseOrder) => {
    setLoading(true)
    try {
      const res = await api.get(`/purchasing/orders/${order.id}`)
      setReceiveOrder(res.data)
      const lines: ReceiveLine[] = res.data.lines || []
      setReceiveLines(lines)
      const vals: Record<string, string> = {}
      lines.forEach(l => { if (l.id) vals[l.id] = String(l.qty_received ?? 0) })
      setReceiveVals(vals)
    } catch (err) {
      showMsg('Failed to load order lines', 'error')
    } finally {
      setLoading(false)
    }
  }

  const confirmReceive = async (line: ReceiveLine) => {
    if (!line.id || !receiveOrder) return
    const total = Number(receiveVals[line.id])
    if (!Number.isFinite(total) || total < 0) {
      showMsg('Enter a valid received quantity', 'error')
      return
    }
    setReceiving(p => ({ ...p, [line.id as string]: true }))
    try {
      const res = await api.post(`/purchasing/orders/${receiveOrder.id}/lines/${line.id}/receive`, {
        qtyReceived: total,
        qtyUnit: line.uom || 'each'
      })
      const g = res.data.guide
      setReceiveLines(prev => prev.map(l => l.id === line.id
        ? { ...l, qty_received: total, guide_on_hand: g ? g.onHandAfter : l.guide_on_hand }
        : l))
      showMsg(`Received ${line.item_name}: guide on-hand ${g.onHandBefore} → ${g.onHandAfter} ${g.guideUnit} (${g.deltaInGuideUnits >= 0 ? '+' : ''}${g.deltaInGuideUnits})`)
      fetchOrders()
    } catch (err: any) {
      if (err?.response?.status === 409) {
        showMsg('Line is unmatched — assign it to the order guide first', 'error')
      } else {
        showMsg(err?.response?.data?.error || 'Failed to record receipt', 'error')
      }
    } finally {
      setReceiving(p => ({ ...p, [line.id as string]: false }))
    }
  }

  const assignLineToGuide = async (line: ReceiveLine) => {
    if (!line.id || !receiveOrder) return
    setAssigning(p => ({ ...p, [line.id as string]: true }))
    try {
      const res = await api.post('/purchasing/order-guide', {
        vendorId: receiveOrder.vendor_id,
        vendorItemId: line.vendor_item_id,
        parLevel: Number(line.qty_ordered) || 0,
        onHand: 0
      })
      setReceiveLines(prev => prev.map(l => l.id === line.id
        ? { ...l, guide_id: res.data.id, guide_on_hand: Number(res.data.on_hand ?? 0) }
        : l))
      showMsg(`Assigned ${line.item_name} to the order guide`)
    } catch (err: any) {
      showMsg(err?.response?.data?.error || 'Failed to assign — manager role required', 'error')
    } finally {
      setAssigning(p => ({ ...p, [line.id as string]: false }))
    }
  }

  const currentVendor = vendors.find(v => v.id === selectedVendorId)

  return (
    <div className="sl-page fade-in max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
              Purchasing &amp; Order Guide
            </h1>
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold tracking-tight bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              Procurement v5.0
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Multi-distributor procurement, unit cost normalization, split PO generation, and HACCP receiving controls.
          </p>
        </div>

        {/* Vendor Selector Capsule */}
        <div className="flex items-center gap-2.5 self-start md:self-auto bg-slate-100/80 dark:bg-zinc-800/80 px-3.5 py-1.5 rounded-full border border-slate-200/60 dark:border-zinc-700/60 shadow-xs">
          <Store className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Active Vendor:</span>
          <select
            value={selectedVendorId}
            onChange={e => setSelectedVendorId(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-1"
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-3 backdrop-blur-md ${
          message.type === 'success'
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Apple HIG Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl backdrop-blur-xl bg-slate-200/50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('price-matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap select-none ${
            activeTab === 'price-matrix'
              ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Multi-Distributor Price Matrix</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            Auto-Split
          </span>
        </button>

        <button
          onClick={() => setActiveTab('order-guide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap select-none ${
            activeTab === 'order-guide'
              ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Standing Order Guide</span>
        </button>

        <button
          onClick={() => setActiveTab('suggested')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap select-none ${
            activeTab === 'suggested'
              ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Suggested Generator</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap select-none ${
            activeTab === 'catalog'
              ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Distributor SKUs</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap select-none ${
            activeTab === 'orders'
              ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>Purchase Orders</span>
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
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Printer style={{ width: 15, height: 15 }} />
                Print Sheet
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
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Download style={{ width: 15, height: 15 }} />
                Export CSV
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
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CheckCircle2 style={{ width: 15, height: 15 }} />
                Create Purchase Order
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Purchase Orders
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                New orders start as drafts. A manager approves them, then they are submitted to the vendor.
              </p>
            </div>
            <button
              onClick={handleBuildFromLow}
              disabled={loading || !selectedVendorId}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <ShoppingCart style={{ width: 16, height: 16 }} />
              Build PO from Low Items
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Vendor</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Notes</th>
                <th style={{ padding: '10px 12px' }}>Created By</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const badge = orderBadge(order.status)
                return (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{order.order_date}</td>
                  <td style={{ padding: '12px' }}>{order.vendor_name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 12,
                      background: badge.bg,
                      color: badge.fg,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap'
                    }}>
                      {order.status === 'draft' ? 'Draft — pending approval' : order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.notes || '—'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.created_by_name || 'System'}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {order.status === 'draft' && canApprove && (
                        <button
                          onClick={() => approveOrder(order.id)}
                          style={{
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <CheckCircle2 style={{ width: 15, height: 15 }} />
                          Approve
                        </button>
                      )}
                      {order.status === 'draft' && !canApprove && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', alignSelf: 'center' }}>
                          Awaiting manager approval
                        </span>
                      )}
                      {order.status === 'approved' && (
                        <button
                          onClick={() => submitOrder(order.id)}
                          style={{
                            background: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Send style={{ width: 15, height: 15 }} />
                          Mark Submitted
                        </button>
                      )}
                      {RECEIVABLE_STATUSES.includes(order.status) && (
                        <button
                          onClick={() => openReceive(order)}
                          style={{
                            background: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Package style={{ width: 15, height: 15 }} />
                          Receive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No purchase orders recorded yet. Use “Build PO from Low Items” to start one from below-par stock.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Receiving panel — per-line received qty, partials, over/under flags */}
          {receiveOrder && (
            <div style={{ marginTop: 24, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 20, background: 'var(--bg-app)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package style={{ width: 18, height: 18 }} />
                  <span>Receiving — {receiveOrder.vendor_name} · {receiveOrder.order_date}</span>
                </h3>
                <button
                  onClick={() => { setReceiveOrder(null); setReceiveLines([]) }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 14px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    minHeight: 44
                  }}
                >
                  Close
                </button>
              </div>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                Enter the cumulative total received per line. Only the difference from what's already recorded moves inventory — partial receives post what arrives, and posting a lower total records a correction.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>Item</th>
                    <th style={{ padding: '10px 12px' }}>Ordered</th>
                    <th style={{ padding: '10px 12px' }}>Received so far</th>
                    <th style={{ padding: '10px 12px' }}>New total received</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>On-hand impact</th>
                    <th style={{ padding: '10px 12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveLines.map(line => {
                    const prior = Number(line.qty_received ?? 0)
                    const ordered = Number(line.qty_ordered ?? 0)
                    const raw = line.id ? receiveVals[line.id] : ''
                    const newTotal = raw !== undefined && raw !== '' ? Number(raw) : 0
                    const valid = Number.isFinite(newTotal) && newTotal >= 0
                    const flag = receiveFlag(valid ? newTotal : 0, ordered)
                    const delta = valid ? Math.round((newTotal - prior) * 100) / 100 : 0
                    const preview = line.guide_id && valid && delta !== 0
                      ? Math.round((Number(line.guide_on_hand ?? 0) + delta) * 100) / 100
                      : null
                    return (
                      <tr key={line.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {line.item_name}
                          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{line.vendor_sku} · {line.pack_size}</div>
                        </td>
                        <td style={{ padding: '12px' }}>{ordered} {line.uom}</td>
                        <td style={{ padding: '12px' }}>{prior} {line.uom}</td>
                        <td style={{ padding: '12px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={raw ?? ''}
                            onChange={e => line.id && setReceiveVals(p => ({ ...p, [line.id as string]: e.target.value }))}
                            style={{ width: 90, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 14, minHeight: 44, boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 12, background: flag.bg, color: flag.fg, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {flag.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: 13 }}>
                          {line.guide_id ? (
                            <>
                              <div>Guide on-hand: <b>{line.guide_on_hand}</b> {line.uom}</div>
                              {preview !== null && (
                                <div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                                  → {preview} ({delta >= 0 ? '+' : ''}{delta})
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 12, background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                Unmatched — assign
                              </span>
                              <button
                                onClick={() => assignLineToGuide(line)}
                                disabled={line.id ? assigning[line.id] : false}
                                style={{
                                  background: 'var(--color-primary)',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  minHeight: 44
                                }}
                              >
                                {line.id && assigning[line.id] ? 'Assigning…' : '+ Add to order guide'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => confirmReceive(line)}
                            disabled={!line.guide_id || (line.id ? receiving[line.id] : false)}
                            title={!line.guide_id ? 'Assign the line to the order guide first' : 'Confirm receipt'}
                            style={{
                              background: !line.guide_id ? 'var(--bg-app)' : 'var(--color-primary)',
                              color: !line.guide_id ? 'var(--text-muted)' : '#fff',
                              border: '1px solid var(--border-color)',
                              padding: '8px 14px',
                              borderRadius: 'var(--radius-md)',
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: !line.guide_id ? 'not-allowed' : 'pointer',
                              minHeight: 44,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {line.id && receiving[line.id] ? 'Saving…' : 'Confirm receipt'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {receiveLines.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        No lines on this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Cross-Vendor Price Comparison Matrix */}
      {activeTab === 'price-matrix' && (
        <div className="space-y-6">
          {/* Header Card with Apple HIG Glass Surface */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                    Multi-Distributor Price Comparison
                  </h2>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    (Weekly Period)
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                  Automatic line-item routing across Dennis Food Service, Sysco, and US Foods at lowest $/unit cost.
                </p>
              </div>

              {/* Savings & Action Pill */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm shadow-xs">
                  <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Savings: $2.45 per resident day</span>
                </div>

                <button
                  onClick={fetchPriceMatrix}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{loading ? 'Refreshing…' : 'Review & Place Orders'}</span>
                </button>
              </div>
            </div>

            {/* Metric Summary Cards */}
            {priceMatrixSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                    <Layers className="w-4 h-4" />
                    <span>Matched Canonical SKUs</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                    {priceMatrixSummary.totalCanonicalProducts}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    {priceMatrixSummary.comparedProductsCount} active cross-vendor matches
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <TrendingDown className="w-4 h-4" />
                    <span>Est. Monthly Savings</span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                    ${priceMatrixSummary.estimatedMonthlySavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Calculated against single-distributor baseline
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/60">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Unit Cost Normalization</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                    Live Pack Conversion
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    40/4oz, 2/10 lb, 6/#10 cans to $/lb &amp; $/oz
                  </div>
                </div>
              </div>
            )}

            {/* Filter Search Strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search products, brands, or SKUs..."
                  value={matrixSearch}
                  onChange={e => setMatrixSearch(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <select
                  value={matrixFilterCategory}
                  onChange={e => setMatrixFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {Array.from(new Set(priceMatrix.map(m => m.category))).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500 dark:text-zinc-400 self-end sm:self-auto font-medium">
                Showing {priceMatrix.length} comparative products
              </div>
            </div>
          </div>

          {/* Table Container with Frosted Backdrop */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-zinc-800/80 border-b border-slate-200/80 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-3">Case Size</th>
                    <th className="py-3.5 px-4 text-center">Dennis Food Service</th>
                    <th className="py-3.5 px-4 text-center">Sysco</th>
                    <th className="py-3.5 px-4 text-center">US Foods</th>
                    <th className="py-3.5 px-4 text-right">Optimal $/Unit</th>
                    <th className="py-3.5 px-4 text-right">Spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {priceMatrix
                    .filter(row => {
                      if (matrixFilterCategory !== 'all' && row.category !== matrixFilterCategory) return false
                      if (matrixSearch) {
                        const q = matrixSearch.toLowerCase()
                        const matchName = row.canonicalName.toLowerCase().includes(q)
                        const matchOffers = row.offers.some(o =>
                          o.itemName.toLowerCase().includes(q) ||
                          o.vendorSku.toLowerCase().includes(q) ||
                          (o.brand && o.brand.toLowerCase().includes(q))
                        )
                        return matchName || matchOffers
                      }
                      return true
                    })
                    .map(row => {
                      const dennisOffer = row.offers.find(o => o.vendorName.toLowerCase().includes('dennis') || o.vendorCode === 'DNS')
                      const syscoOffer = row.offers.find(o => o.vendorName.toLowerCase().includes('sysco') || o.vendorCode === 'SY')
                      const usFoodsOffer = row.offers.find(o => o.vendorName.toLowerCase().includes('us foods') || o.vendorCode === 'USF')
                      const displayCaseSize = row.offers[0]?.packSize || 'Standard CS'

                      return (
                        <tr key={row.canonicalId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                            <div>{row.canonicalName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                                {row.category}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                                Base: {row.standardUom}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-3 text-slate-600 dark:text-zinc-400 font-mono text-xs">
                            {displayCaseSize}
                          </td>

                          {/* Dennis Column */}
                          <td className="py-4 px-4 text-center">
                            {dennisOffer ? (
                              <div className={`p-2 rounded-xl text-center border inline-block min-w-[110px] ${
                                dennisOffer.isBestPrice
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold'
                                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/60 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                              }`}>
                                <div className="text-xs font-mono font-extrabold">
                                  ${dennisOffer.caseCost.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-400">
                                  ${dennisOffer.normalizedUnitCost.toFixed(2)}/{row.standardUom}
                                </div>
                                {dennisOffer.isBestPrice && (
                                  <span className="mt-1 inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white">
                                    BEST
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Sysco Column */}
                          <td className="py-4 px-4 text-center">
                            {syscoOffer ? (
                              <div className={`p-2 rounded-xl text-center border inline-block min-w-[110px] ${
                                syscoOffer.isBestPrice
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold'
                                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/60 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                              }`}>
                                <div className="text-xs font-mono font-extrabold">
                                  ${syscoOffer.caseCost.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-400">
                                  ${syscoOffer.normalizedUnitCost.toFixed(2)}/{row.standardUom}
                                </div>
                                {syscoOffer.isBestPrice && (
                                  <span className="mt-1 inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white">
                                    BEST
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600 text-xs">—</span>
                            )}
                          </td>

                          {/* US Foods Column */}
                          <td className="py-4 px-4 text-center">
                            {usFoodsOffer ? (
                              <div className={`p-2 rounded-xl text-center border inline-block min-w-[110px] ${
                                usFoodsOffer.isBestPrice
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold'
                                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/60 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                              }`}>
                                <div className="text-xs font-mono font-extrabold">
                                  ${usFoodsOffer.caseCost.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-400">
                                  ${usFoodsOffer.normalizedUnitCost.toFixed(2)}/{row.standardUom}
                                </div>
                                {usFoodsOffer.isBestPrice && (
                                  <span className="mt-1 inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-600 text-white">
                                    BEST
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Optimal Column */}
                          <td className="py-4 px-4 text-right">
                            <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                              {row.bestUnitCost ? `$${row.bestUnitCost.toFixed(2)}/${row.standardUom}` : '—'}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
                              {row.winningVendorName || 'No Vendor'}
                            </div>
                          </td>

                          {/* Spread Column */}
                          <td className="py-4 px-4 text-right">
                            {row.priceSpreadPercent !== null && row.priceSpreadPercent > 0 ? (
                              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-mono">
                                +{row.priceSpreadPercent}% spread
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500 text-xs font-mono">0%</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automated Split Purchase Orders Card (matching mockup bottom panel) */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Automated Split Purchase Orders</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Pre-configured electronic purchase orders split by winning vendor to maximize facility cost savings.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/25">
                Ready to Transmit
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Dennis Split Card */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/70 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">PO-2026-0412-DNS</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                      Confirmed
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Dennis Food Service · 8 line items · Delivery Thu
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">$1,842.50</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Saved $314.20</div>
                </div>
              </div>

              {/* Sysco Split Card */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/70 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">PO-2026-0413-SY</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                      Pending
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Sysco Foods · 5 line items · Delivery Fri
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">$924.80</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Saved $168.40</div>
                </div>
              </div>
            </div>
          </div>
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
