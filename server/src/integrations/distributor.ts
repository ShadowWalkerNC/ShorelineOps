/**
 * Distributor Integration Abstraction — Shoreline
 *
 * Defines the generic contract for distributor integrations (V2+).
 * Dennis Food Service is the first target implementation.
 */

export interface VendorItem {
  id?: string
  vendorId?: string
  vendorSku: string
  name: string
  brand?: string
  packSize?: string
  uom?: string
  category?: string
  unitCost?: number
  active?: boolean
}

export interface OrderGuideEntry {
  id?: string
  facilityId?: string
  vendorId?: string
  vendorItemId?: string
  vendorSku?: string
  itemName?: string
  parLevel: number
  onHand: number
  avgUsage?: number
  sortGroup?: string
}

export interface PurchaseOrderLine {
  vendorItemId: string
  vendorSku: string
  itemName: string
  packSize?: string
  uom?: string
  qtyOrdered: number
  unitCost?: number
}

export interface PurchaseOrder {
  id: string
  vendorId: string
  vendorName: string
  orderDate: string
  expectedDate?: string
  notes?: string
  lines: PurchaseOrderLine[]
}

export interface CustomerPrice {
  vendorSku: string
  price: number
  effectiveDate: string
}

export interface ItemAvailability {
  vendorSku: string
  inStock: boolean
  estimatedRestock?: string
}

export interface ExportResult {
  type: 'csv' | 'json' | 'pdf'
  filename: string
  data: string | Buffer
}

/**
 * Generic Distributor Connector Interface
 */
export interface DistributorConnector {
  vendorCode: string
  vendorName: string

  /** Get or parse the catalog items from distributor data or feed */
  getCatalog(): Promise<VendorItem[]>

  /** Import and parse order guide file/template from the distributor */
  importOrderGuide(fileContent: string | Buffer): Promise<OrderGuideEntry[]>

  /** Export purchase order formatted specifically for the distributor */
  exportOrder(order: PurchaseOrder): Promise<ExportResult>

  /** Optional live customer pricing fetch */
  getCustomerPricing?(accountId: string): Promise<CustomerPrice[]>

  /** Optional live availability check */
  getAvailability?(accountId: string): Promise<ItemAvailability[]>
}
