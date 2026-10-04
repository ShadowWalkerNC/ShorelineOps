import { Fragment, useState } from 'react'
import { AppleButton } from '@/apple-ui'
import { useDevice } from '@/hooks/useDevice'
import { useAuth } from '@/security/AuthContext'
import { iddsiChipLabel, type Resident } from '@/types/resident'
import { AlertOctagon, AlertTriangle, ChevronDown, LayoutGrid, List, MapPin, Trash2 } from 'lucide-react'

type Props = { residents: Resident[]; onEdit: (r: Resident) => void; onDelete: (id: string) => void }

function SafetyOrders({ resident: r }: { resident: Resident }) {
  return <div className="census-orders">
    {r.is_npo === true && <p className="census-npo"><AlertOctagon size={18} aria-hidden="true" /><span><strong>NPO HARD-BLOCK · No food or liquids</strong>{r.npo_reason && <span className="block">{r.npo_reason}</span>}</span></p>}
    <div className="census-order-line"><strong>{r.dietType}</strong><span>{iddsiChipLabel(r.texture)}</span></div>
    {r.fluidConsistency && <p className="census-secondary">Liquids: {r.fluidConsistency}</p>}
    {r.fluid_restriction_ml != null && <p className="census-restriction">Fluid restriction: {r.fluid_restriction_ml} mL/day</p>}
  </div>
}

function Allergies({ resident: r }: { resident: Resident }) {
  return r.allergies?.length > 0
    ? <p className="census-allergies"><AlertTriangle size={16} aria-hidden="true" /><span><strong>Food exclusions</strong><span className="block">{r.allergies.join(', ')}</span></span></p>
    : <span className="census-secondary">No food allergies recorded</span>
}

function ChartDetails({ resident: r }: { resident: Resident }) {
  const entries = [
    ['Portion size', r.portionSize],
    ['Birthday', r.birthdayMonth && r.birthdayDay ? ` ` : ''],
    ['Prescribed beverages', r.beverages?.join(', ')],
    ['Preferences', r.likes],
    ['Dislikes', r.dislikes],
    ['Special instructions', r.specialInstructions],
    ['Adaptive equipment', r.adaptiveEquipment?.join(', ')],
    ['Nutrition supplement', r.ensurePerDay > 0 ? `${r.ensurePerDay} Ensure/day` : ''],
  ].filter(([, value]) => value)
  return <dl className="census-chart-details">{entries.length ? entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>) : <div><dt>Additional chart details</dt><dd>No additional information recorded.</dd></div>}</dl>
}

export default function ResidentCardList({ residents, onEdit, onDelete }: Props) {
  const { hasCapability } = useAuth()
  const canEdit = hasCapability('residents.write') || hasCapability('residents.clinicalWrite')
  const canDelete = hasCapability('residents.delete')
  const { isMobile } = useDevice()
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleChart = (id: string) => setExpandedIds(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const chartButton = (r: Resident) => <button className="census-chart-toggle" aria-expanded={expandedIds.has(r.id)} aria-controls={`chart-${r.id}`} onClick={() => toggleChart(r.id)}><ChevronDown size={16} aria-hidden="true" className={expandedIds.has(r.id) ? 'rotate-180' : ''} />{expandedIds.has(r.id) ? 'Hide details' : 'Chart details'}<span className="sr-only"> for {r.name}</span></button>
  const actions = (r: Resident) => <div className="census-actions">
    {canEdit && <AppleButton variant="secondary" size="sm" onClick={() => onEdit(r)}>Edit order<span className="sr-only"> for {r.name}</span></AppleButton>}
    {canDelete && <button className="census-delete" onClick={() => onDelete(r.id)} aria-label={`Delete resident ${r.name}`}><Trash2 size={17} aria-hidden="true" /></button>}
    {!canEdit && !canDelete && <span className="census-secondary">View only</span>}
  </div>

  return <section className="census-roster" aria-label="Resident census">
    <div className="census-roster-heading">
      <div><h2>Clinical census</h2><p>{residents.length} {residents.length === 1 ? 'resident' : 'residents'} in this view</p></div>
      {!isMobile && <div className="census-view-switch" aria-label="Census display">
        <button aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><List size={16} aria-hidden="true" />List</button>
        <button aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={16} aria-hidden="true" />Cards</button>
      </div>}
    </div>
    {residents.length === 0 ? <div className="census-empty"><h3>No residents in this view</h3><p>Adjust the search or choose a different census filter.</p></div> : viewMode === 'grid' || isMobile ? <div className="census-card-grid">
      {residents.map(r => <article key={r.id} className={`census-resident-card ${r.is_npo === true ? 'has-npo' : ''}`}>
        <header><span className="census-room">Room {r.room || 'Unassigned'}</span><span className={`census-status ${r.status === 'Active' ? 'is-active' : ''}`}>{r.status}</span></header>
        <h3>{r.name}</h3>
        <SafetyOrders resident={r} /><Allergies resident={r} />
        <p className="census-location"><MapPin size={16} aria-hidden="true" />{r.servingLocation}{r.tableAssignment && ` · ${r.tableAssignment}`}</p>
        {expandedIds.has(r.id) && <div id={`chart-${r.id}`}><ChartDetails resident={r} /></div>}
        <footer>{chartButton(r)}{actions(r)}</footer>
      </article>)}
    </div> : <div className="census-table-scroll"><table className="census-table">
      <caption className="sr-only">Resident rooms, nutrition orders, allergies and delivery locations</caption>
      <thead><tr><th scope="col">Resident / room</th><th scope="col">Nutrition order</th><th scope="col">Food allergies</th><th scope="col">Delivery</th><th scope="col">Chart</th></tr></thead>
      <tbody>{residents.map(r => <Fragment key={r.id}>
        <tr className={r.is_npo === true ? 'has-npo' : ''}>
          <th scope="row"><span className="census-room">Room {r.room || 'Unassigned'}</span><span className="census-resident-name">{r.name}</span><span className={`census-status ${r.status === 'Active' ? 'is-active' : ''}`}>{r.status}</span></th>
          <td><SafetyOrders resident={r} /></td><td><Allergies resident={r} /></td>
          <td><span>{r.servingLocation}</span>{r.tableAssignment && <span className="census-secondary block">{r.tableAssignment}</span>}{r.ensurePerDay > 0 && <span className="census-secondary block">{r.ensurePerDay} Ensure/day</span>}</td>
          <td>{actions(r)}{chartButton(r)}</td>
        </tr>
        {expandedIds.has(r.id) && <tr className="census-detail-row"><td colSpan={5}><div id={`chart-${r.id}`}><ChartDetails resident={r} /></div></td></tr>}
      </Fragment>)}</tbody>
    </table></div>}
  </section>
}