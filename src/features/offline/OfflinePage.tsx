export default function OfflinePage() {
  return (
    <div className="stitch-standalone stitch-offline" style={{
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
      <img src={`${import.meta.env.BASE_URL}brand/shorelineops-icon.svg`} alt="ShorelineOps" style={{ width: 64, height: 64 }} />

      <div>
        <p className="sl-eyebrow">Connection required</p>
        <h1 className="sl-page-title">
          You're offline
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 10, maxWidth: 360, lineHeight: 1.6 }}>
          Connect to your facility server to load current records and save work. A local server can operate without internet while your device remains connected to it.
        </p>
      </div>

      <button
        className="btn btn-primary"
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
          fontFamily: 'var(--font-body)',
        }}
      >
        Try again
      </button>

      <p className="stitch-offline-guidance" style={{ maxWidth: 520 }}>
        A cached screen does not confirm current dietary orders or a saved action. Hold unverified trays and follow your facility's documented downtime procedure. Reconnect and check recorded outcomes before retrying.
      </p>
    </div>
  )
}
