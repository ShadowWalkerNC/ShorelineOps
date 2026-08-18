export interface Vendor {
  id: string
  name: string
  code: string
  phone?: string
  email?: string
  website?: string
  notes?: string
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface VendorItem {
  id: string
  vendor_id: string
  vendor_sku: string
  name: string
  brand?: string
  pack_size?: string
  uom?: string
  category?: string
  unit_cost?: number
  active: boolean
  vendor_name?: string
  vendor_code?: string
  created_at?: string
  updated_at?: string
}

export interface FacilityItemMap {
  id: string
  facility_id?: string
  ingredient_name: string
  vendor_item_id: string
  preferred: boolean
  conversion_factor?: number
  notes?: string
}

export interface OrderGuideEntry {
  id: string
  facility_id?: string
  vendor_id: string
  vendor_item_id: string
  par_level: number
  on_hand: number
  avg_usage?: number
  sort_group?: string
  item_name?: string
  vendor_sku?: string
  pack_size?: string
  uom?: string
  unit_cost?: number
  category?: string
  vendor_name?: string
  vendor_code?: string
}

export interface SuggestedOrderLine {
  vendorItemId: string
  vendorSku: string
  itemName: string
  vendor: string
  packSize: string
  uom: string
  unitCost: number
  parLevel: number
  onHand: number
  suggestedQty: number
  category: string
}

export interface PurchaseOrder {
  id: string
  facility_id?: string
  vendor_id: string
  vendor_name?: string
  vendor_code?: string
  status: 'draft' | 'submitted' | 'received' | 'cancelled'
  order_date: string
  expected_date?: string
  notes?: string
  created_by?: string
  created_by_name?: string
  created_at?: string
  lines?: PurchaseOrderLine[]
}

export interface PurchaseOrderLine {
  id?: string
  purchase_order_id?: string
  vendor_item_id: string
  qty_ordered: number
  qty_received?: number
  unit_cost?: number
  notes?: string
  item_name?: string
  vendor_sku?: string
  pack_size?: string
  uom?: string
}
