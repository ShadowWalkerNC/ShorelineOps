export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 32,
      background: 'var(--bg-app)',
      textAlign: 'center',
    }}>
      <img src="/icon-192.png" alt="Shoreline" style={{ width: 72, height: 72, borderRadius: 16, opacity: 0.7 }} />

      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
          You're offline
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 10, maxWidth: 360, lineHeight: 1.6 }}>
          Shoreline needs a connection to load this page. Any cached content is still available — check your network and try again.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 28px',
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        Try again
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
        Cached routes like Dashboard, Menu, and Residents may still work.
      </p>
    </div>
  )
}
