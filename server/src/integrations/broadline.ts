/**
 * Multi-Distributor Adapters: Sysco & US Foods Connectors (V2 Implementation)
 *
 * Implements the DistributorConnector contract for major broadline food distributors.
 */

import {
  DistributorConnector,
  VendorItem,
  OrderGuideEntry,
  PurchaseOrder,
  ExportResult,
  CustomerPrice,
  ItemAvailability,
} from './distributor'

export class SyscoConnector implements DistributorConnector {
  public readonly vendorCode = 'sysco'
  public readonly vendorName = 'Sysco Food Services'

  async getCatalog(): Promise<VendorItem[]> {
    return [
      {
        vendorSku: 'SYS-2010',
        name: 'Whole Kernel Corn Fancy',
        brand: 'Sysco Classic',
        packSize: '6/#10 cans',
        uom: 'case',
        category: 'Canned Vegetables',
        unitCost: 38.25,
        active: true,
      },
      {
        vendorSku: 'SYS-2020',
        name: 'Ground Beef 80/20 Fresh Patty 4oz',
        brand: 'Sysco Imperial',
        packSize: '40/4oz',
        uom: 'case',
        category: 'Poultry & Meat',
        unitCost: 78.40,
        active: true,
      },
      {
        vendorSku: 'SYS-2030',
        name: 'Instant Thickener Nectar Consistency',
        brand: 'Sysco Reliance',
        packSize: '12/8oz',
        uom: 'case',
        category: 'Thickened Beverages',
        unitCost: 35.10,
        active: true,
      },
      {
        vendorSku: 'SYS-2040',
        name: 'Pureed Carrots Seasoned',
        brand: 'Sysco Classic',
        packSize: '24/4oz',
        uom: 'case',
        category: 'Pureed Foods',
        unitCost: 31.50,
        active: true,
      },
    ]
  }

  async importOrderGuide(fileContent: string | Buffer): Promise<OrderGuideEntry[]> {
    const text = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8')
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase().split(',')
    const skuIdx = header.findIndex(h => h.includes('sysco') || h.includes('item') || h.includes('sku') || h.includes('supc'))
    const nameIdx = header.findIndex(h => h.includes('description') || h.includes('name'))
    const parIdx = header.findIndex(h => h.includes('par'))
    const onHandIdx = header.findIndex(h => h.includes('onhand') || h.includes('hand') || h.includes('count'))

    const entries: OrderGuideEntry[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/^["']|["']$/g, '').trim())
      if (parts.length <= skuIdx || !parts[skuIdx]) continue

      entries.push({
        vendorSku: parts[skuIdx],
        itemName: nameIdx !== -1 ? parts[nameIdx] : 'Sysco Broadline Item',
        parLevel: parIdx !== -1 && !isNaN(Number(parts[parIdx])) ? Number(parts[parIdx]) : 0,
        onHand: onHandIdx !== -1 && !isNaN(Number(parts[onHandIdx])) ? Number(parts[onHandIdx]) : 0,
      })
    }

    return entries
  }

  async exportOrder(order: PurchaseOrder): Promise<ExportResult> {
    const header = 'CustID,SyscoSUPC,Description,Pack,UOM,QuantityOrdered\n'
    const rows = order.lines.map(line => {
      return `"CUST-SYSCO-01","${line.vendorSku}","${line.itemName}","${line.packSize || ''}","${line.uom || 'case'}",${line.qtyOrdered}`
    })

    const csvData = header + rows.join('\n')
    const dateStr = order.orderDate || new Date().toISOString().slice(0, 10)
    const filename = `sysco-order-export-${dateStr}.csv`

    return {
      type: 'csv',
      filename,
      data: csvData,
    }
  }

  async getCustomerPricing(accountId: string): Promise<CustomerPrice[]> {
    return [
      { vendorSku: 'SYS-2010', price: 36.50, effectiveDate: new Date().toISOString() },
      { vendorSku: 'SYS-2020', price: 74.90, effectiveDate: new Date().toISOString() },
      { vendorSku: 'SYS-2030', price: 33.20, effectiveDate: new Date().toISOString() },
    ]
  }

  async getAvailability(accountId: string): Promise<ItemAvailability[]> {
    return [
      { vendorSku: 'SYS-2010', inStock: true },
      { vendorSku: 'SYS-2020', inStock: true },
      { vendorSku: 'SYS-2030', inStock: true },
      { vendorSku: 'SYS-2040', inStock: false, estimatedRestock: '2 business days' },
    ]
  }
}

export class UsFoodsConnector implements DistributorConnector {
  public readonly vendorCode = 'usfoods'
  public readonly vendorName = 'US Foods'

  async getCatalog(): Promise<VendorItem[]> {
    return [
      {
        vendorSku: 'USF-3010',
        name: 'Green Beans Cut Blue Lake Fancy',
        brand: 'Monarch',
        packSize: '6/#10 cans',
        uom: 'case',
        category: 'Canned Vegetables',
        unitCost: 39.80,
        active: true,
      },
      {
        vendorSku: 'USF-3020',
        name: 'Turkey Breast Roast Boneless 10lb',
        brand: 'Patuxent Farms',
        packSize: '2/10lb',
        uom: 'case',
        category: 'Poultry & Meat',
        unitCost: 69.50,
        active: true,
      },
      {
        vendorSku: 'USF-3030',
        name: 'Thickened Honey Consistency Water',
        brand: 'Thick & Easy',
        packSize: '12/32oz',
        uom: 'case',
        category: 'Thickened Beverages',
        unitCost: 33.90,
        active: true,
      },
    ]
  }

  async importOrderGuide(fileContent: string | Buffer): Promise<OrderGuideEntry[]> {
    const text = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8')
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase().split(',')
    const skuIdx = header.findIndex(h => h.includes('usfoods') || h.includes('item') || h.includes('sku') || h.includes('product'))
    const nameIdx = header.findIndex(h => h.includes('description') || h.includes('name'))
    const parIdx = header.findIndex(h => h.includes('par'))
    const onHandIdx = header.findIndex(h => h.includes('onhand') || h.includes('hand') || h.includes('count'))

    const entries: OrderGuideEntry[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.replace(/^["']|["']$/g, '').trim())
      if (parts.length <= skuIdx || !parts[skuIdx]) continue

      entries.push({
        vendorSku: parts[skuIdx],
        itemName: nameIdx !== -1 ? parts[nameIdx] : 'US Foods Item',
        parLevel: parIdx !== -1 && !isNaN(Number(parts[parIdx])) ? Number(parts[parIdx]) : 0,
        onHand: onHandIdx !== -1 && !isNaN(Number(parts[onHandIdx])) ? Number(parts[onHandIdx]) : 0,
      })
    }

    return entries
  }

  async exportOrder(order: PurchaseOrder): Promise<ExportResult> {
    const header = 'Account,ProductNumber,Brand,Description,Pack,UOM,Quantity\n'
    const rows = order.lines.map(line => {
      return `"USF-ACCT-001","${line.vendorSku}","${line.packSize || 'US Foods'}","${line.itemName}","${line.packSize || ''}","${line.uom || 'case'}",${line.qtyOrdered}`
    })

    const csvData = header + rows.join('\n')
    const dateStr = order.orderDate || new Date().toISOString().slice(0, 10)
    const filename = `usfoods-order-export-${dateStr}.csv`

    return {
      type: 'csv',
      filename,
      data: csvData,
    }
  }

  async getCustomerPricing(accountId: string): Promise<CustomerPrice[]> {
    return [
      { vendorSku: 'USF-3010', price: 38.00, effectiveDate: new Date().toISOString() },
      { vendorSku: 'USF-3020', price: 67.20, effectiveDate: new Date().toISOString() },
    ]
  }

  async getAvailability(accountId: string): Promise<ItemAvailability[]> {
    return [
      { vendorSku: 'USF-3010', inStock: true },
      { vendorSku: 'USF-3020', inStock: true },
      { vendorSku: 'USF-3030', inStock: true },
    ]
  }
}
