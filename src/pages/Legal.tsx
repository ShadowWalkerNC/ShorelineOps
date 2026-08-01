import { useState } from 'react'

const DOCS = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    file: 'PRIVACY.md',
    icon: '🔒',
    description: 'How we collect, use, and protect staff and resident data across all U.S. states.',
  },
  {
    id: 'terms',
    title: 'Terms of Use',
    file: 'TERMS.md',
    icon: '📋',
    description: 'Rules governing authorized access and use of the Shoreline platform.',
  },
  {
    id: 'aup',
    title: 'Acceptable Use Policy',
    file: 'AUP.md',
    icon: '✅',
    description: 'Standards for responsible, ethical, and lawful platform use by staff.',
  },
  {
    id: 'hipaa',
    title: 'HIPAA Notice of Privacy Practices',
    file: 'HIPAA_NOTICE.md',
    icon: '🏥',
    description: 'How Protected Health Information (PHI) may be used and disclosed.',
  },
  {
    id: 'baa',
    title: 'Business Associate Agreement',
    file: 'BAA.md',
    icon: '🤝',
    description: 'Template BAA for vendors who process PHI on behalf of Shoreline Operations LLC.',
  },
]

export default function Legal() {
  const [active, setActive] = useState<string | null>(null)
  const activeDoc = DOCS.find((d) => d.id === active)

  return (
    <div className="sl-page">

      {/* ── Page header ── */}
      <div className="sl-page-header">
        <h1 className="sl-page-title">Legal &amp; Compliance</h1>
        <p className="sl-page-subtitle">Shoreline Operations LLC — Effective July 8, 2026</p>
      </div>

      {!active ? (
        /* ── Document index ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DOCS.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActive(doc.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '18px 20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                {doc.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  marginBottom: 4,
                }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-snug)' }}>
                  {doc.description}
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 20, alignSelf: 'center', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      ) : (
        /* ── Document view ── */
        <div>
          <button
            onClick={() => setActive(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semi)',
              color: 'var(--color-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: 20,
              textDecoration: 'none',
            }}
          >
            ‹ Back to Legal Documents
          </button>

          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}>
            {/* Doc header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--color-primary-light)',
            }}>
              <span style={{ fontSize: 28 }}>{activeDoc?.icon}</span>
              <div>
                <h2 style={{
                  fontSize: 'var(--text-xl)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: 'var(--tracking-tight)',
                }}>
                  {activeDoc?.title}
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 3 }}>
                  Shoreline Operations LLC · Effective July 8, 2026
                </p>
              </div>
            </div>

            {/* Doc body */}
            <div style={{ padding: '24px' }}>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginBottom: 12,
              }}>
                View the full document in the repository: <code style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--bg-app)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}>{activeDoc?.file}</code>
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)' }}>
                All legal documents are maintained in the project repository root. Contact the
                Privacy Officer at{' '}
                <span style={{
                  fontFamily: 'monospace',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--weight-semi)',
                }}>
                  [LEGAL_CONTACT_EMAIL_PLACEHOLDER]
                </span>{' '}
                with any questions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
