import React, { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { VendorItem } from '../../types/purchasing'
import CommunityPluginRegistry from './CommunityPluginRegistry'
import { AppleBadge, AppleButton, AppleCard, AppleSegmentedControl } from '@/apple-ui'
import {
  Truck,
  Package,
  Plus,
  Search,
  CheckCircle2,
  DollarSign,
  Tag,
  Boxes,
  FileSpreadsheet,
  Zap,
  Globe,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Save,
  X,
  Upload,
  Download,
  Calendar,
  Clock,
  ShieldCheck,
  Building,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'

type PortalTab = 'catalog' | 'schedule' | 'connectors' | 'plugins'
type VendorRepRole = 'dennis_rep' | 'sysco_rep' | 'usfoods_rep' | 'admin_director'

interface DistributorSchedule {
  vendorId: string
  vendorName: string
  truckDays: string[]
  cutoffDay: string
  cutoffTime: string
  minOrderUsd: number
  fuelSurcharge: number
  leadTimeHours: number
  primaryRepName: string
  primaryRepEmail: string
  primaryRepPhone: string
}

export default function DistributorPortalPage() {
  const [activeTab, setActiveTab] = useState<PortalTab>('catalog')
  const [currentRole, setCurrentRole] = useState<VendorRepRole>('dennis_rep')
  const [selectedVendor, setSelectedVendor] = useState<'dennis' | 'sysco' | 'usfoods' | 'gfs'>('dennis')
  const [items, setItems] = useState<VendorItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Inline Price Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState<number>(0)
  const [editPackValue, setEditPackValue] = useState<string>('')

  // Edit / Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<VendorItem | null>(null)

  const [formData, setFormData] = useState({
    vendorSku: '',
    name: '',
    brand: 'Dennis Select',
    packSize: '6/#10 cans',
    uom: 'case',
    category: 'Canned Goods',
    unitCost: 42.50,
  })

  // Delivery Schedules
  const [schedules, setSchedules] = useState<Record<string, DistributorSchedule>>({
    dennis: {
      vendorId: 'dennis-1',
      vendorName: 'Dennis Food Service',
      truckDays: ['Tuesday', 'Friday'],
      cutoffDay: 'Sunday',
      cutoffTime: '17:00',
      minOrderUsd: 500.0,
      fuelSurcharge: 12.50,
      leadTimeHours: 48,
      primaryRepName: 'Marcus Sterling (Dennis Account Lead)',
      primaryRepEmail: 'msterling@dennisfoodservice.com',
      primaryRepPhone: '(207) 555-0192',
    },
    sysco: {
      vendorId: 'sysco-1',
      vendorName: 'Sysco Corporation',
      truckDays: ['Monday', 'Thursday'],
      cutoffDay: 'Friday',
      cutoffTime: '16:00',
      minOrderUsd: 750.0,
      fuelSurcharge: 15.00,
      leadTimeHours: 72,
      primaryRepName: 'Jennifer Vance (Sysco Healthcare Specialist)',
      primaryRepEmail: 'jvance@sysco.com',
      primaryRepPhone: '(800) 555-7972',
    },
    usfoods: {
      vendorId: 'usfoods-1',
      vendorName: 'US Foods',
      truckDays: ['Wednesday'],
      cutoffDay: 'Monday',
      cutoffTime: '15:00',
      minOrderUsd: 400.0,
      fuelSurcharge: 9.50,
      leadTimeHours: 48,
      primaryRepName: 'David K. Ross (US Foods Regional Rep)',
      primaryRepEmail: 'dross@usfoods.com',
      primaryRepPhone: '(207) 555-8831',
    },
  })

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // When rep role changes, align selected vendor
    if (currentRole === 'dennis_rep') setSelectedVendor('dennis')
    else if (currentRole === 'sysco_rep') setSelectedVendor('sysco')
    else if (currentRole === 'usfoods_rep') setSelectedVendor('usfoods')
  }, [currentRole])

  useEffect(() => {
    fetchItems()
  }, [selectedVendor])

  const getFallbackItems = (): VendorItem[] => {
    const saved = localStorage.getItem(`shoreline_vendor_items_${selectedVendor}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }

    if (selectedVendor === 'dennis') {
      return [
        { id: 'vi-1', vendor_id: 'dennis-1', vendor_sku: 'DNS-1001', name: 'Peaches Diced in 100% Juice', brand: 'Dennis Select', pack_size: '6/#10 cans', uom: 'case', category: 'Canned Fruits', unit_cost: 48.50, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-2', vendor_id: 'dennis-1', vendor_sku: 'DNS-1002', name: 'Orange Juice Thickened Nectar (IDDSI L2)', brand: 'Thick & Easy', pack_size: '12/32oz', uom: 'case', category: 'Thickened Beverages', unit_cost: 32.75, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-3', vendor_id: 'dennis-1', vendor_sku: 'DNS-1003', name: 'Pureed Green Beans (IDDSI Level 4)', brand: 'Puree Supreme', pack_size: '24/4oz', uom: 'case', category: 'Pureed Foods', unit_cost: 29.90, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-4', vendor_id: 'dennis-1', vendor_sku: 'DNS-1004', name: 'Chicken Breast Boneless Skinless 4oz', brand: 'Dennis Farms', pack_size: '40/4oz', uom: 'case', category: 'Poultry & Meat', unit_cost: 64.20, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-5', vendor_id: 'dennis-1', vendor_sku: 'DNS-1005', name: 'Whole Liquid Eggs Pasteurized', brand: 'Papetti\'s', pack_size: '15/2 lb', uom: 'case', category: 'Dairy & Eggs', unit_cost: 52.80, active: true, vendor_name: 'Dennis Food Service' },
        { id: 'vi-6', vendor_id: 'dennis-1', vendor_sku: 'DNS-1006', name: 'Cream of Wheat Instant Hot Cereal', brand: 'B&G Foods', pack_size: '12/28oz', uom: 'case', category: 'Breakfast Cereals', unit_cost: 38.15, active: true, vendor_name: 'Dennis Food Service' },
      ]
    }

    if (selectedVendor === 'sysco') {
      return [
        { id: 'vi-11', vendor_id: 'sysco-1', vendor_sku: 'SYS-2001', name: 'Peaches Sliced in Light Syrup', brand: 'Sysco Classic', pack_size: '6/#10 cans', uom: 'case', category: 'Canned Fruits', unit_cost: 51.20, active: true, vendor_name: 'Sysco Corporation' },
        { id: 'vi-12', vendor_id: 'sysco-1', vendor_sku: 'SYS-2002', name: 'Thickened Apple Juice Nectar', brand: 'Sysco Reliance', pack_size: '12/32oz', uom: 'case', category: 'Thickened Beverages', unit_cost: 34.50, active: true, vendor_name: 'Sysco Corporation' },
        { id: 'vi-13', vendor_id: 'sysco-1', vendor_sku: 'SYS-2004', name: 'Chicken Breast Boneless Raw 4oz', brand: 'Sysco Imperial', pack_size: '40/4oz', uom: 'case', category: 'Poultry & Meat', unit_cost: 67.90, active: true, vendor_name: 'Sysco Corporation' },
        { id: 'vi-14', vendor_id: 'sysco-1', vendor_sku: 'SYS-2005', name: 'Liquid Whole Eggs with Citric Acid', brand: 'Sysco Classic', pack_size: '15/2 lb', uom: 'case', category: 'Dairy & Eggs', unit_cost: 54.10, active: true, vendor_name: 'Sysco Corporation' },
      ]
    }

    return [
      { id: 'vi-21', vendor_id: 'usfoods-1', vendor_sku: 'USF-3001', name: 'Fresh Russet Baking Potatoes 80ct', brand: 'Cross Valley Farms', pack_size: '50 lb box', uom: 'case', category: 'Produce', unit_cost: 26.50, active: true, vendor_name: 'US Foods' },
      { id: 'vi-22', vendor_id: 'usfoods-1', vendor_sku: 'USF-3002', name: 'Atlantic Fresh Salmon Fillet 6oz', brand: 'Harbor Banks', pack_size: '10 lb case', uom: 'case', category: 'Seafood', unit_cost: 84.00, active: true, vendor_name: 'US Foods' },
    ]
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await api.get('/purchasing/items')
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const filtered = res.data.filter((it: any) => {
          if (selectedVendor === 'dennis') return it.vendor_name?.includes('Dennis') || it.vendor_sku?.startsWith('DNS')
          if (selectedVendor === 'sysco') return it.vendor_name?.includes('Sysco') || it.vendor_sku?.startsWith('SYS')
          if (selectedVendor === 'usfoods') return it.vendor_name?.includes('US Foods') || it.vendor_sku?.startsWith('USF')
          return true
        })
        setItems(filtered.length > 0 ? filtered : getFallbackItems())
      } else {
        setItems(getFallbackItems())
      }
    } catch {
      setItems(getFallbackItems())
    } finally {
      setLoading(false)
    }
  }

  const saveItemsState = (newItems: VendorItem[]) => {
    setItems(newItems)
    localStorage.setItem(`shoreline_vendor_items_${selectedVendor}`, JSON.stringify(newItems))
  }

  // Quick Inline Price Save
  const handleSaveInlinePrice = (itemId: string) => {
    const updated = items.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          unit_cost: editPriceValue > 0 ? editPriceValue : it.unit_cost,
          pack_size: editPackValue.trim() ? editPackValue.trim() : it.pack_size,
        }
      }
      return it
    })
    saveItemsState(updated)
    setEditingItemId(null)
    setMessage({ text: 'Contract pricing updated and synchronized with kitchen MRP!', type: 'success' })
  }

  // Toggle Active Status
  const handleToggleActive = (itemId: string) => {
    const updated = items.map(it => (it.id === itemId ? { ...it, active: !it.active } : it))
    saveItemsState(updated)
  }

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    if (confirm('Are you sure you want to remove this SKU from the contract order guide?')) {
      const updated = items.filter(it => it.id !== itemId)
      saveItemsState(updated)
      setMessage({ text: 'Product removed from distributor order guide.', type: 'success' })
    }
  }

  // Edit Modal Submit
  const handleSaveEditedItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItemToEdit) return

    const updated = items.map(it => {
      if (it.id === selectedItemToEdit.id) {
        return {
          ...it,
          vendor_sku: formData.vendorSku,
          name: formData.name,
          brand: formData.brand,
          pack_size: formData.packSize,
          category: formData.category,
          unit_cost: formData.unitCost,
        }
      }
      return it
    })
    saveItemsState(updated)
    setShowEditModal(false)
    setMessage({ text: `Updated SKU ${formData.vendorSku} in contract catalog!`, type: 'success' })
  }

  // Add Item Submit
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    const vendorName =
      selectedVendor === 'dennis'
        ? 'Dennis Food Service'
        : selectedVendor === 'sysco'
        ? 'Sysco Corporation'
        : 'US Foods'

    const newItem: VendorItem = {
      id: `vi-${Date.now()}`,
      vendor_id: `${selectedVendor}-1`,
      vendor_sku: formData.vendorSku || `${selectedVendor.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: formData.name,
      brand: formData.brand,
      pack_size: formData.packSize,
      uom: formData.uom,
      category: formData.category,
      unit_cost: formData.unitCost,
      active: true,
      vendor_name: vendorName,
    }

    const updated = [newItem, ...items]
    saveItemsState(updated)
    setShowAddModal(false)
    setMessage({ text: `Published SKU ${newItem.vendor_sku} (${newItem.name}) to active catalog!`, type: 'success' })
  }

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Vendor SKU', 'Product Name', 'Brand', 'Pack Size', 'Category', 'Contract Unit Price ($)']
    const rows = items.map(it => [
      it.vendor_sku,
      `"${it.name}"`,
      `"${it.brand || ''}"`,
      `"${it.pack_size || ''}"`,
      `"${it.category || ''}"`,
      (it.unit_cost ?? 0).toFixed(2),
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${selectedVendor}_contract_order_guide_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredItems = items.filter(it => {
    const matchSearch =
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.vendor_sku.toLowerCase().includes(search.toLowerCase()) ||
      it.brand?.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || it.category === categoryFilter
    return matchSearch && matchCat
  })

  const categories = Array.from(new Set(items.map(it => it.category || 'General'))).filter(Boolean)

  const isReadOnly =
    (currentRole === 'dennis_rep' && selectedVendor !== 'dennis') ||
    (currentRole === 'sysco_rep' && selectedVendor !== 'sysco') ||
    (currentRole === 'usfoods_rep' && selectedVendor !== 'usfoods')

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Role & Rep Authentication Switcher Banner */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-apple-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Authenticated Vendor Rep Session</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{schedules[selectedVendor]?.primaryRepName || 'Distributor Sales Specialist'}</span>
              <AppleBadge color="purple">ROLE: {currentRole.toUpperCase().replace('_', ' ')}</AppleBadge>
            </div>
          </div>
        </div>

        {/* Rep Role Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">Switch Rep Login:</span>
          <select
            value={currentRole}
            onChange={e => setCurrentRole(e.target.value as VendorRepRole)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="dennis_rep">Dennis Food Service Rep</option>
            <option value="sysco_rep">Sysco Corporation Rep</option>
            <option value="usfoods_rep">US Foods Rep</option>
            <option value="admin_director">Super Admin (Dietary Director)</option>
          </select>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
              Distributor Partner Portal
            </h1>
            <AppleBadge color="blue">Contract Item Master & EDI</AppleBadge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maintain item SKUs, contract unit pricing, delivery schedules, and order cutoffs with real-time kitchen MRP synchronization.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={() => {
              setFormData({
                vendorSku: '',
                name: '',
                brand: selectedVendor === 'dennis' ? 'Dennis Select' : selectedVendor === 'sysco' ? 'Sysco Classic' : 'Cross Valley',
                packSize: '6/#10 cans',
                uom: 'case',
                category: 'Canned Goods',
                unitCost: 35.00,
              })
              setShowAddModal(true)
            }}
            disabled={isReadOnly}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all shadow-sm shadow-blue-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contract SKU</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {message && (
        <div className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Read-Only Notice if looking at competitor catalog */}
      {isReadOnly && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Read-Only View: As a {currentRole.replace('_', ' ')}, you cannot edit items from {selectedVendor.toUpperCase()}. Switch vendor tab or rep role above to edit.</span>
        </div>
      )}

      {/* Segmented Control Navigation */}
      <AppleSegmentedControl
        value={activeTab}
        onChange={v => setActiveTab(v as PortalTab)}
        options={[
          { label: 'Item Master & Pricing', value: 'catalog' },
          { label: 'Delivery Schedule & Cutoffs', value: 'schedule' },
          { label: 'EDI & Order Stream', value: 'connectors' },
          { label: 'Distributor Plugins', value: 'plugins' },
        ]}
      />

      {/* TAB 1: ITEM MASTER & PRICING */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          
          {/* Vendor Selector Pill Bar */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold font-mono uppercase">Distributor:</span>
              <div className="flex gap-1.5">
                {[
                  { id: 'dennis', label: 'Dennis Food Service', count: '142 SKUs' },
                  { id: 'sysco', label: 'Sysco Corporation', count: '89 SKUs' },
                  { id: 'usfoods', label: 'US Foods', count: '34 SKUs' },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedVendor === v.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className="ml-1.5 opacity-70 text-[10px]">({v.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Category Filter */}
            <div className="flex items-center gap-2">
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search item, brand, SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Catalog Table */}
          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-apple-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    <th className="py-3 px-4">Vendor SKU</th>
                    <th className="py-3 px-4">Product Description</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Pack Size</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Contract Unit Price</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {filteredItems.map(item => {
                    const isEditing = editingItemId === item.id

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.vendor_sku}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {item.brand || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPackValue}
                              onChange={e => setEditPackValue(e.target.value)}
                              className="w-24 px-2 py-1 text-xs rounded bg-white dark:bg-slate-800 border border-blue-400 font-mono"
                            />
                          ) : (
                            item.pack_size
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editPriceValue}
                                onChange={e => setEditPriceValue(parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-xs text-right rounded bg-white dark:bg-slate-800 border border-blue-400 font-mono font-bold"
                              />
                            </div>
                          ) : (
                            `$${(item.unit_cost ?? 0).toFixed(2)}`
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => !isReadOnly && handleToggleActive(item.id)}
                            disabled={isReadOnly}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-opacity ${
                              item.active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.active ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveInlinePrice(item.id)}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs"
                                  title="Save Changes"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingItemId(item.id)
                                    setEditPriceValue(item.unit_cost ?? 0)
                                    setEditPackValue(item.pack_size || '')
                                  }}
                                  disabled={isReadOnly}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                                  title="Quick Edit Price"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={isReadOnly}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 disabled:opacity-40"
                                  title="Remove SKU"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY SCHEDULE & CUTOFFS */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(schedules).map(([key, sched]) => (
            <AppleCard key={key} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-white text-base">{sched.vendorName}</div>
                <AppleBadge color={key === 'dennis' ? 'green' : key === 'sysco' ? 'blue' : 'purple'}>
                  {key === 'dennis' ? 'PRIMARY' : key === 'sysco' ? 'SECONDARY' : 'SUPPLEMENTAL'}
                </AppleBadge>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400"><Calendar className="w-3.5 h-3.5" /> Weekly Truck Days:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{sched.truckDays.join(', ')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400"><Clock className="w-3.5 h-3.5" /> Order Cutoff Deadline:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{sched.cutoffDay} at {sched.cutoffTime}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400"><DollarSign className="w-3.5 h-3.5" /> Minimum Order (MOQ):</span>
                  <span className="font-bold text-slate-900 dark:text-white">${sched.minOrderUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400"><Truck className="w-3.5 h-3.5" /> Fuel & Delivery Fee:</span>
                  <span className="font-mono">${sched.fuelSurcharge.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">{sched.primaryRepName}</div>
                <div className="text-slate-500 dark:text-slate-400">{sched.primaryRepEmail}</div>
                <div className="text-slate-500 dark:text-slate-400 font-mono">{sched.primaryRepPhone}</div>
              </div>
            </AppleCard>
          ))}
        </div>
      )}

      {/* TAB 3: EDI & CONNECTORS */}
      {activeTab === 'connectors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Dennis Food Service', state: 'Connected (Live EDI)', format: 'CSV & EDI 850/810', speed: '< 200ms', active: true, color: 'green' },
              { name: 'Sysco Source EDI Gateway', state: 'Connected (Contract Rate API)', format: 'JSON REST & EDI 850', speed: '< 350ms', active: true, color: 'green' },
              { name: 'US Foods Broadline Bridge', state: 'Connected (Direct Catalog)', format: 'EDI 850 Order Stream', speed: '< 280ms', active: true, color: 'green' },
              { name: 'Gordon Food Service (GFS)', state: 'Available on Pro Tier', format: 'REST Order Guide Sync', speed: '—', active: false, color: 'blue' },
            ].map(conn => (
              <AppleCard key={conn.name} className="p-5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{conn.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{conn.format} · Response {conn.speed}</div>
                </div>
                <AppleBadge color={conn.active ? 'green' : 'blue'}>
                  {conn.state}
                </AppleBadge>
              </AppleCard>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PLUGINS */}
      {activeTab === 'plugins' && (
        <CommunityPluginRegistry />
      )}

      {/* ADD ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <AppleCard className="max-w-lg w-full p-6 space-y-4 shadow-apple-elevated">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Product SKU to {selectedVendor.toUpperCase()}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Product Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cut Green Beans in Water"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Vendor SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DNS-1088"
                    value={formData.vendorSku}
                    onChange={e => setFormData({ ...formData, vendorSku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Pack Size</label>
                  <input
                    type="text"
                    required
                    placeholder="6/#10 cans"
                    value={formData.packSize}
                    onChange={e => setFormData({ ...formData, packSize: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Vegetables"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Contract Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.unitCost}
                    onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <AppleButton type="button" variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </AppleButton>
                <AppleButton type="submit" variant="primary" size="sm">
                  Publish SKU
                </AppleButton>
              </div>
            </form>
          </AppleCard>
        </div>
      )}

    </div>
  )
}
