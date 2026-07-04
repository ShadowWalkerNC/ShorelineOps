import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Resident } from '@/types/resident'

type Props = {
  residents: Resident[]
  onEdit: (r: Resident) => void
  onDelete: (id: string) => void
}

const STATUS_STYLE: Record<Resident['status'], { bg: string; color: string; border: string }> = {
  Active:       { bg: 'var(--color-success-light)',  color: 'var(--color-success-hover)',  border: 'rgba(74,163,104,.3)' },
  Hospital:     { bg: 'var(--color-warning-light)',  color: 'var(--color-warning-hover)',  border: 'rgba(201,146,88,.3)' },
  LOA:          { bg: 'var(--color-teal-light)',     color: 'var(--color-teal-hover)',     border: 'rgba(58,157,168,.3)' },
  'Passed Away':{ bg: 'var(--bg-app)',               color: 'var(--text-muted)',           border: 'var(--border-color)' },
}

const TEXTURE_STYLE = { bg: 'var(--color-warning-light)', color: 'var(--color-warning-hover)', border: 'rgba(201,146,88,.3)' }
const ALLERGY_STYLE = { bg: 'var(--color-danger-light)',  color: 'var(--color-danger-hover)',  border: 'rgba(188,106,88,.3)' }
const DIET_STYLE    = { bg: 'var(--color-primary-light)', color: 'var(--color-primary)',        border: 'rgba(var(--color-primary-rgb),.25)' }

function Pill({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', minWidth: 100, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{value}</span>
    </div>
  )
}

function ResidentCard({ r, onEdit, onDelete }: { r: Resident; onEdit: (r: Resident) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const statusStyle = STATUS_STYLE[r.status]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      transition: 'box-shadow 0.18s ease',
    }}>
      {/* ── Header row (always visible) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          background: open ? 'var(--color-primary-light)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
      >
        {/* Room badge */}
        <div style={{
          minWidth: 48, height: 40,
          background: 'var(--color-primary)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}>{r.room}</span>
        </div>

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
          <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: 20,
              fontSize: 10, fontWeight: 700,
              background: statusStyle.bg, color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
            }}>{r.status}</span>
            {r.texture !== 'Regular' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 20,
                fontSize: 10, fontWeight: 700,
                background: TEXTURE_STYLE.bg, color: TEXTURE_STYLE.color,
                border: `1px solid ${TEXTURE_STYLE.border}`,
              }}>{r.texture}</span>
            )}
            {r.allergies.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 20,
                fontSize: 10, fontWeight: 700,
                background: ALLERGY_STYLE.bg, color: ALLERGY_STYLE.color,
                border: `1px solid ${ALLERGY_STYLE.border}`,
              }}>{r.allergies.length} allerg{r.allergies.length === 1 ? 'y' : 'ies'}</span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="18" height="18" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" viewBox="0 0 24 24"
          style={{ flexShrink: 0, transition: 'transform 0.22s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>

      {/* ── Expanded detail panel ── */}
      {open && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          padding: '16px 16px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          background: 'var(--bg-app)',
          animation: 'sl-expand 0.18s ease',
        }}>
          <style>{`@keyframes sl-expand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Diet section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetailRow label="Diet" value={<Pill label={r.dietType} style={DIET_STYLE} />} />
            <DetailRow label="Texture" value={
              r.texture !== 'Regular'
                ? <Pill label={r.texture} style={TEXTURE_STYLE} />
                : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Regular</span>
            } />
            <DetailRow label="Portion" value={r.portionSize !== 'Regular' ? r.portionSize : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Regular</span>} />
            {r.allergies.length > 0 && (
              <DetailRow label="Allergies" value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {r.allergies.map(a => <Pill key={a} label={a} style={ALLERGY_STYLE} />)}
                </div>
              } />
            )}
            {r.ensurePerDay > 0 && <DetailRow label="Ensure/Day" value={`${r.ensurePerDay}`} />}
            {r.beverages.length > 0 && <DetailRow label="Beverages" value={r.beverages.join(', ')} />}
          </div>

          {/* Location / seating */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetailRow label="Location" value={r.servingLocation} />
            {r.tableAssignment && <DetailRow label="Table" value={r.tableAssignment} />}
            {r.birthdayMonth && r.birthdayDay && <DetailRow label="Birthday" value={`${r.birthdayMonth} ${r.birthdayDay}`} />}
          </div>

          {/* Preferences / notes */}
          {(r.likes || r.dislikes || r.specialInstructions) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.likes && <DetailRow label="Likes" value={r.likes} />}
              {r.dislikes && <DetailRow label="Dislikes" value={r.dislikes} />}
              {r.specialInstructions && <DetailRow label="Instructions" value={r.specialInstructions} />}
            </div>
          )}

          {/* Actions */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', gap: 10 }}>
            <button
              onClick={e => { e.stopPropagation(); navigate(`/residents/${r.id}`) }}
              style={{
                flex: 1, padding: '10px 0',
                background: 'var(--bg-card)', color: 'var(--color-primary)',
                border: '1.5px solid var(--color-primary)', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              👤 View Profile
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(r) }}
              style={{
                flex: 1, padding: '10px 0',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(r.id) }}
              style={{
                flex: 1, padding: '10px 0',
                background: 'var(--color-danger-light)', color: 'var(--color-danger-hover)',
                border: '1px solid rgba(188,106,88,.35)', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResidentCardList({ residents, onEdit, onDelete }: Props) {
  if (residents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No residents found</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Add your first resident to get started.</div>
      </div>
    )
  }

  const sorted = [...residents].sort((a, b) => {
    const an = parseInt(a.room) || 0
    const bn = parseInt(b.room) || 0
    return an !== bn ? an - bn : a.room.localeCompare(b.room)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map(r => (
        <ResidentCard key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
