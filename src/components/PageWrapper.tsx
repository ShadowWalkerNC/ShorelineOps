/**
 * PageWrapper — Uniform page shell for all Layout-wrapped feature pages.
 *
 * Usage:
 *   <PageWrapper
 *     title="Residents"
 *     subtitle="Manage resident profiles and care preferences."
 *     actions={<button>Add Resident</button>}
 *   >
 *     {content}
 *   </PageWrapper>
 *
 * The wrapper enforces the global sl-page max-width/centering already defined
 * in index.css, and provides a consistent page-header structure. Passing no
 * title is fine — the header section is omitted when both title and subtitle
 * are absent and no actions are provided.
 */
import React from 'react'

interface PageWrapperProps {
  /** Primary page heading (h1) */
  title?: React.ReactNode
  /** Optional subtitle below the title */
  subtitle?: React.ReactNode
  /** Right-side action elements (buttons, dropdowns, etc.) */
  actions?: React.ReactNode
  /** Page body content */
  children: React.ReactNode
  /** Extra CSS class names forwarded to the inner .sl-page div */
  className?: string
}

export default function PageWrapper({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: PageWrapperProps) {
  const hasHeader = title || subtitle || actions

  return (
    <div className={`sl-page ${className}`.trim()}>
      {hasHeader && (
        <div
          className="sl-page-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {(title || subtitle) && (
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && <h1 className="sl-page-title">{title}</h1>}
              {subtitle && <p className="sl-page-subtitle" style={{ marginTop: 4 }}>{subtitle}</p>}
            </div>
          )}
          {actions && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
                flexWrap: 'wrap',
              }}
            >
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
