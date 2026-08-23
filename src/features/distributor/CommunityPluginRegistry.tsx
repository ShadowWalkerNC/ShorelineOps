import { useState } from 'react'

export interface CommunityConnector {
  id: string
  name: string
  version: string
  author: string
  type: 'Broadline' | 'Produce' | 'Dairy' | 'Regional'
  status: 'INSTALLED' | 'AVAILABLE' | 'ACTIVE'
  description: string
  supportedFormats: string[]
  apiProtocol: 'REST / JSON' | 'EDI 850 / 810' | 'CSV / FTP'
  contractPricingSupported: boolean
}

const INITIAL_CONNECTORS: CommunityConnector[] = [
  {
    id: 'conn-dennis',
    name: 'Dennis Food Service',
    version: '2.4.0',
    author: 'Shoreline Core Team',
    type: 'Broadline',
    status: 'ACTIVE',
    description: 'Reference broadline adapter supporting order guides, par calculations, contract rates, and electronic PO export.',
    supportedFormats: ['CSV Order Guide', 'EDI 850 PO', 'Restock Alerts'],
    apiProtocol: 'CSV / FTP',
    contractPricingSupported: true,
  },
  {
    id: 'conn-sysco',
    name: 'Sysco Broadline Connector',
    version: '1.8.2',
    author: 'Community Contributor',
    type: 'Broadline',
    status: 'ACTIVE',
    description: 'National Sysco broadline SKU catalog synchronization with direct custom order format export.',
    supportedFormats: ['Sysco CSV Guide', 'Order Sync'],
    apiProtocol: 'REST / JSON',
    contractPricingSupported: true,
  },
  {
    id: 'conn-usfoods',
    name: 'US Foods Direct',
    version: '1.5.0',
    author: 'Community Contributor',
    type: 'Broadline',
    status: 'ACTIVE',
    description: 'US Foods catalog integration supporting stock availability queries and electronic ordering.',
    supportedFormats: ['US Foods CSV', 'Pack Size Mapping'],
    apiProtocol: 'REST / JSON',
    contractPricingSupported: true,
  },
  {
    id: 'conn-gfs',
    name: 'Gordon Food Service (GFS)',
    version: '1.2.0',
    author: 'Healthcare Dietary Alliance',
    type: 'Broadline',
    status: 'AVAILABLE',
    description: 'GFS Experience integration for Midwest and Eastern healthcare and senior living communities.',
    supportedFormats: ['GFS Order Guide', 'Nutrition Spec Sheets'],
    apiProtocol: 'EDI 850 / 810',
    contractPricingSupported: true,
  },
  {
    id: 'conn-pfg',
    name: 'Performance Food Group (PFG)',
    version: '1.1.0',
    author: 'CulinaryOS Community',
    type: 'Broadline',
    status: 'AVAILABLE',
    description: 'PFG broadline catalog parser and suggested replenishment order generator.',
    supportedFormats: ['PFG CSV Export', 'Par Alignment'],
    apiProtocol: 'CSV / FTP',
    contractPricingSupported: false,
  },
  {
    id: 'conn-dairy-local',
    name: 'Regional Direct Dairy & Bakery',
    version: '1.0.0',
    author: 'Independent Farm Cooperative',
    type: 'Dairy',
    status: 'AVAILABLE',
    description: 'Direct farm-to-table and local dairy delivery standing standing par manager.',
    supportedFormats: ['Standing Order Sheet', 'Invoice Verification'],
    apiProtocol: 'REST / JSON',
    contractPricingSupported: false,
  },
]

export default function CommunityPluginRegistry() {
  const [connectors, setConnectors] = useState<CommunityConnector[]>(INITIAL_CONNECTORS)
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'AVAILABLE'>('ALL')
  const [toast, setToast] = useState<string | null>(null)

  const toggleStatus = (id: string) => {
    setConnectors(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'ACTIVE' ? 'INSTALLED' : 'ACTIVE'
        return { ...c, status: nextStatus }
      }
      return c
    }))
    setToast('Connector status updated successfully.')
    setTimeout(() => setToast(null), 3000)
  }

  const installConnector = (id: string) => {
    setConnectors(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: 'ACTIVE' }
      }
      return c
    }))
    setToast('Community connector installed and activated!')
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = connectors.filter(c => {
    if (filter === 'ACTIVE') return c.status === 'ACTIVE'
    if (filter === 'AVAILABLE') return c.status === 'AVAILABLE'
    return true
  })

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            🔌 Community Distributor Connector Marketplace
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Open-source pluggable distributor adapters allowing zero vendor lock-in for regional and broadline foodservice suppliers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(['ALL', 'ACTIVE', 'AVAILABLE'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${filter === f ? 'var(--color-primary)' : 'var(--border-color)'}`,
                background: filter === f ? 'var(--color-primary)' : 'var(--bg-card)',
                color: filter === f ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          ✅ {toast}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filtered.map(c => (
          <div
            key={c.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {c.name}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    v{c.version} by {c.author}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: c.status === 'ACTIVE' ? '#dcfce7' : c.status === 'INSTALLED' ? '#e0e7ff' : '#f3f4f6',
                    color: c.status === 'ACTIVE' ? '#166534' : c.status === 'INSTALLED' ? '#3730a3' : '#4b5563',
                  }}
                >
                  {c.status}
                </span>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>
                {c.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <span style={{ padding: '2px 8px', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  📡 {c.apiProtocol}
                </span>
                {c.contractPricingSupported && (
                  <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                    💲 Contract Pricing
                  </span>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                <strong>Formats:</strong> {c.supportedFormats.join(', ')}
              </div>
            </div>

            <div>
              {c.status === 'AVAILABLE' ? (
                <button
                  onClick={() => installConnector(c.id)}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Install Connector
                </button>
              ) : (
                <button
                  onClick={() => toggleStatus(c.id)}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    background: c.status === 'ACTIVE' ? '#fee2e2' : '#dcfce7',
                    color: c.status === 'ACTIVE' ? '#991b1b' : '#166534',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {c.status === 'ACTIVE' ? '⏸️ Deactivate' : '▶️ Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
