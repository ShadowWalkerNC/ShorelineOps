/**
 * Dennis Food Service Distributor Connector Adapter (V1/V2 implementation)
 *
 * Dennis Food Service is the primary broadline reference implementation.
 * Supports catalog item parsing, order guide import parsing, and standard order CSV export.
 */

import {
  DistributorConnector,
  VendorItem,
  OrderGuideEntry,
  PurchaseOrder,
  ExportResult,
} from './distributor'

export class DennisConnector implements DistributorConnector {
  public readonly vendorCode = 'dennis'
  public readonly vendorName = 'Dennis Food Service'
  public readonly catalogPortalUrl = 'https://dennisfoodservice.pepr.app/'
  public readonly homeUrl = 'https://dennisfoodservice.com/'
  public readonly orderingPlatform = 'Pepper (pepr.app)'
  public readonly supportPhone = '1-800-439-2727'

  /**
   * Parse Dennis catalog data / sample feed
   */
  async getCatalog(): Promise<VendorItem[]> {
    // Reference Dennis catalog items
    return [
      {
        vendorSku: 'DNS-1001',
        name: 'Peaches Diced in 100% Juice',
        brand: 'Dennis Select',
        packSize: '6/#10 cans',
        uom: 'case',
        category: 'Canned Fruits',
        unitCost: 48.50,
        active: true,
      },
      {
        vendorSku: 'DNS-1002',
        name: 'Orange Juice Thickened Nectar',
        brand: 'Thick & Easy',
        packSize: '12/32oz',
        uom: 'case',
        category: 'Thickened Beverages',
        unitCost: 32.75,
        active: true,
      },
      {
        vendorSku: 'DNS-1003',
        name: 'Pureed Green Beans',
        brand: 'Puree Supreme',
        packSize: '24/4oz',
        uom: 'case',
        category: 'Pureed Foods',
        unitCost: 29.90,
        active: true,
      },
      {
        vendorSku: 'DNS-1004',
        name: 'Chicken Breast Boneless Skinless 4oz',
        brand: 'Dennis Farms',
        packSize: '40/4oz',
        uom: 'case',
        category: 'Poultry & Meat',
        unitCost: 64.20,
        active: true,
      },
      {
        vendorSku: 'DNS-1005',
        name: 'Apple Sauce Unsweetened',
        brand: 'Dennis Select',
        packSize: '6/#10 cans',
        uom: 'case',
        category: 'Canned Fruits',
        unitCost: 36.10,
        active: true,
      },
    ]
  }

  /**
   * Parse uploaded Dennis CSV order guide file
   */
  async importOrderGuide(fileContent: string | Buffer): Promise<OrderGuideEntry[]> {
    const text = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8')
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase().split(',')
    const skuIdx = header.findIndex(h => h.includes('sku') || h.includes('item'))
    const nameIdx = header.findIndex(h => h.includes('name') || h.includes('description'))
    const parIdx = header.findIndex(h => h.includes('par'))
    const onHandIdx = header.findIndex(h => h.includes('hand') || h.includes('count'))

    const entries: OrderGuideEntry[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/^["']|["']$/g, '').trim())
      if (parts.length <= skuIdx || !parts[skuIdx]) continue

      entries.push({
        vendorSku: parts[skuIdx],
        itemName: nameIdx !== -1 ? parts[nameIdx] : 'Imported Item',
        parLevel: parIdx !== -1 && !isNaN(Number(parts[parIdx])) ? Number(parts[parIdx]) : 0,
        onHand: onHandIdx !== -1 && !isNaN(Number(parts[onHandIdx])) ? Number(parts[onHandIdx]) : 0,
      })
    }

    return entries
  }

  /**
   * Format and export order to Dennis Food Service CSV specification
   */
  async exportOrder(order: PurchaseOrder): Promise<ExportResult> {
    const header = 'vendor,name,sku,pack,uom,qty\n'
    const rows = order.lines.map(line => {
      return `"${this.vendorName}","${line.itemName}","${line.vendorSku}","${line.packSize || ''}","${line.uom || 'case'}",${line.qtyOrdered}`
    })

    const csvData = header + rows.join('\n')
    const dateStr = order.orderDate || new Date().toISOString().slice(0, 10)
    const filename = `dennis-order-export-${dateStr}.csv`

    return {
      type: 'csv',
      filename,
      data: csvData,
    }
  }
}
