/**
 * Zeiterfassung — Zentrale Seite fuer Stempelzeiten, Abwesenheiten und Auswertungen
 *
 * Tabs: Tagesuebersicht, Stempel-Protokoll, Abwesenheiten, Monats-Auswertung
 * Datenquelle: zeitstempel, mitarbeiter, arbeitsvertraege, abwesenheiten
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, List, CalendarOff, BarChart3, ExternalLink, Plus, ChevronLeft, ChevronRight, Coffee, LogIn, LogOut, Pause, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AbwesenheitenSection from '../components/AbwesenheitenSection'

const TABS = [
  { id: 'tagesuebersicht', label: 'Tagesübersicht', icon: Clock },
  { id: 'stempel', label: 'Stempel-Protokoll', icon: List },
  { id: 'abwesenheiten', label: 'Abwesenheiten', icon: CalendarOff },
  { id: 'auswertung', label: 'Monats-Auswertung', icon: BarChart3 },
]

const TYP_LABELS = {
  kommen: 'Kommen', gehen: 'Gehen',
  pause_start: 'Pause Start', pause_ende: 'Pause Ende',
  rauchen_start: 'Raucherpause', rauchen_ende: 'Raucherpause Ende',
}
const TYP_ICONS = {
  kommen: LogIn, gehen: LogOut,
  pause_start: Coffee, pause_ende: Play,
  rauchen_start: Coffee, rauchen_ende: Play,
}
const TYP_COLORS = {
  kommen: '#065F46', gehen: '#991B1B',
  pause_start: '#92400E', pause_ende: '#065F46',
  rauchen_start: '#92400E', rauchen_ende: '#065F46',
}
const QUELLE_LABELS = {
  tablet: 'Tablet', app: 'App', dashboard: 'Dashboard',
  manuell: 'Manuell', nachgetragen: 'Nachgetragen',
  mobile: 'Mobil', rfid: 'RFID', korrektur: 'Korrektur',
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateShort(d) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function toLocalDateStr(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}
function calcHours(stempel) {
  let totalMs = 0, pauseMs = 0
  let kommenZeit = null, pauseStart = null
  for (const s of stempel) {
    const t = new Date(s.zeitpunkt).getTime()
    if (s.typ === 'kommen') kommenZeit = t
    if (s.typ === 'gehen' && kommenZeit) { totalMs += t - kommenZeit; kommenZeit = null }
    if (s.typ === 'pause_start' || s.typ === 'rauchen_start') pauseStart = t
    if ((s.typ === 'pause_ende' || s.typ === 'rauchen_ende') && pauseStart) { pauseMs += t - pauseStart; pauseStart = null }
  }
  const netMs = totalMs - pauseMs
  return { brutto: totalMs / 3600000, pause: pauseMs / 3600000, netto: netMs / 3600000 }
}
function fmtH(h) { return h > 0 ? `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : '-' }

const selectCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
const inputCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"

// ─── Shared MA hook ───
function useMitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('mitarbeiter').select('id, vorname, nachname, status, rolle')
      .eq('status', 'aktiv').order('nachname')
      .then(({ data }) => { setMitarbeiter(data || []); setLoading(false) })
  }, [])
  return { mitarbeiter, loading }
}

// ═══════════════════════════════════════════════════════════════════
// 2.2 Tagesuebersicht
// ═══════════════════════════════════════════════════════════════════
function TagesuebersichtTab() {
  const navigate = useNavigate()
  const { mitarbeiter, loading: maLoading } = useMitarbeiter()
  const [datum, setDatum] = useState(toLocalDateStr(new Date()))
  const [stempel, setStempel] = useState([])
  const [loading, setLoading] = useState(true)

  const loadStempel = useCallback(async () => {
    setLoading(true)
    const start = `${datum}T00:00:00`
    const end = `${datum}T23:59:59`
    const { data } = await supabase
      .from('zeitstempel')
      .select('*')
      .gte('zeitpunkt', start)
      .lte('zeitpunkt', end)
      .order('zeitpunkt')
    setStempel(data || [])
    setLoading(false)
  }, [datum])

  useEffect(() => { loadStempel() }, [loadStempel])

  const shiftDate = (days) => {
    const d = new Date(datum + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDatum(toLocalDateStr(d))
  }

  const maStatus = useMemo(() => {
    return mitarbeiter.map(ma => {
      const maStempel = stempel.filter(s => s.mitarbeiter_id === ma.id).sort((a, b) => new Date(a.zeitpunkt) - new Date(b.zeitpunkt))
      const last = maStempel[maStempel.length - 1]
      const hours = calcHours(maStempel)

      let status = 'nicht_gestempelt'
      if (last) {
        if (last.typ === 'kommen' || last.typ === 'pause_ende' || last.typ === 'rauchen_ende') status = 'aktiv'
        else if (last.typ === 'gehen') status = 'ausgestempelt'
        else if (last.typ === 'pause_start' || last.typ === 'rauchen_start') status = 'pause'
      }

      return { ...ma, stempel: maStempel, lastAction: last, status, hours }
    })
  }, [mitarbeiter, stempel])

  const statusStyles = {
    aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv', dot: '#10B981' },
    pause: { bg: '#FEF3C7', text: '#92400E', label: 'Pause', dot: '#F59E0B' },
    ausgestempelt: { bg: '#FEE2E2', text: '#991B1B', label: 'Feierabend', dot: '#EF4444' },
    nicht_gestempelt: { bg: '#F3F4F6', text: '#6B7280', label: 'Nicht gestempelt', dot: '#9CA3AF' },
  }

  if (maLoading) return <div className="text-sm text-text-muted py-8 text-center">Laden...</div>

  const counts = { aktiv: 0, pause: 0, ausgestempelt: 0, nicht_gestempelt: 0 }
  maStatus.forEach(m => counts[m.status]++)

  return (
    <div>
      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={18} /></button>
        <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inputCls} />
        <button onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={18} /></button>
        <button onClick={() => setDatum(toLocalDateStr(new Date()))} className="text-xs text-brand hover:underline ml-2">Heute</button>
        <span className="text-sm text-text-muted ml-auto">{formatDate(datum + 'T12:00:00')}</span>
      </div>

      {/* KPI chips */}
      <div className="flex gap-3 mb-5">
        {Object.entries(statusStyles).map(([key, style]) => (
          <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} />
            {style.label}: {counts[key]}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-default overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-card text-text-secondary text-xs">
              <th className="text-left px-4 py-2.5 font-medium">Mitarbeiter</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Kommen</th>
              <th className="text-left px-4 py-2.5 font-medium">Gehen</th>
              <th className="text-left px-4 py-2.5 font-medium">Pause</th>
              <th className="text-right px-4 py-2.5 font-medium">Netto</th>
              <th className="text-left px-4 py-2.5 font-medium">Letzte Aktion</th>
            </tr>
          </thead>
          <tbody>
            {maStatus.map(ma => {
              const st = statusStyles[ma.status]
              const kommen = ma.stempel.find(s => s.typ === 'kommen')
              const gehen = [...ma.stempel].reverse().find(s => s.typ === 'gehen')
              return (
                <tr key={ma.id} className="border-t border-border-default hover:bg-surface-hover/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <button onClick={() => navigate(`/mitarbeiter/${ma.id}`)} className="font-medium text-text-primary hover:text-brand">
                      {ma.vorname} {ma.nachname}
                    </button>
                    <span className="ml-2 text-xs text-text-muted">{ma.rolle === 'monteur' ? 'Monteur' : ma.rolle === 'buero' ? 'Büro' : 'GF'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{formatTime(kommen?.zeitpunkt)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{formatTime(gehen?.zeitpunkt)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{fmtH(ma.hours.pause)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-text-primary">{fmtH(ma.hours.netto)}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">
                    {ma.lastAction ? `${TYP_LABELS[ma.lastAction.typ] || ma.lastAction.typ} ${formatTime(ma.lastAction.zeitpunkt)}` : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {loading && <div className="text-xs text-text-muted text-center mt-2">Lade Stempel...</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 2.3 Stempel-Protokoll
// ═══════════════════════════════════════════════════════════════════
function StempelProtokollTab() {
  const { mitarbeiter } = useMitarbeiter()
  const [filterMa, setFilterMa] = useState('')
  const [datumVon, setDatumVon] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return toLocalDateStr(d)
  })
  const [datumBis, setDatumBis] = useState(toLocalDateStr(new Date()))
  const [stempel, setStempel] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Nachtrag form
  const [formMa, setFormMa] = useState('')
  const [formDatum, setFormDatum] = useState(toLocalDateStr(new Date()))
  const [formZeit, setFormZeit] = useState('07:00')
  const [formTyp, setFormTyp] = useState('kommen')
  const [formNotiz, setFormNotiz] = useState('')

  const loadStempel = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('zeitstempel')
      .select('*, mitarbeiter(vorname, nachname)')
      .gte('zeitpunkt', `${datumVon}T00:00:00`)
      .lte('zeitpunkt', `${datumBis}T23:59:59`)
      .order('zeitpunkt', { ascending: false })
      .limit(200)
    if (filterMa) q = q.eq('mitarbeiter_id', filterMa)
    const { data } = await q
    setStempel(data || [])
    setLoading(false)
  }, [datumVon, datumBis, filterMa])

  useEffect(() => { loadStempel() }, [loadStempel])

  const handleNachtrag = async () => {
    if (!formMa || !formDatum || !formZeit || !formTyp) return
    setSaving(true)
    await supabase.from('zeitstempel').insert({
      mitarbeiter_id: formMa,
      zeitpunkt: `${formDatum}T${formZeit}:00`,
      typ: formTyp,
      quelle: 'nachgetragen',
      notiz: formNotiz || null,
    })
    setSaving(false)
    setShowForm(false)
    setFormNotiz('')
    loadStempel()
  }

  // Group by date
  const grouped = useMemo(() => {
    const groups = {}
    for (const s of stempel) {
      const day = toLocalDateStr(s.zeitpunkt)
      if (!groups[day]) groups[day] = []
      groups[day].push(s)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [stempel])

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">Von:</label>
          <input type="date" value={datumVon} onChange={e => setDatumVon(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">Bis:</label>
          <input type="date" value={datumBis} onChange={e => setDatumBis(e.target.value)} className={inputCls} />
        </div>
        <select value={filterMa} onChange={e => setFilterMa(e.target.value)} className={selectCls + ' min-w-[180px]'}>
          <option value="">Alle Mitarbeiter</option>
          {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90">
          <Plus size={14} /> Nachtragen
        </button>
      </div>

      {/* Nachtrag form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-border-default bg-surface-card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Stempel nachtragen</h3>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Mitarbeiter *</label>
              <select value={formMa} onChange={e => setFormMa(e.target.value)} className={selectCls + ' min-w-[180px]'}>
                <option value="">--</option>
                {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Datum *</label>
              <input type="date" value={formDatum} onChange={e => setFormDatum(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Uhrzeit *</label>
              <input type="time" value={formZeit} onChange={e => setFormZeit(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Typ *</label>
              <select value={formTyp} onChange={e => setFormTyp(e.target.value)} className={selectCls}>
                <option value="kommen">Kommen</option>
                <option value="gehen">Gehen</option>
                <option value="pause_start">Pause Start</option>
                <option value="pause_ende">Pause Ende</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-text-secondary mb-1">Notiz</label>
              <input value={formNotiz} onChange={e => setFormNotiz(e.target.value)} placeholder="Grund für Nachtrag..." className={inputCls + ' w-full'} />
            </div>
            <button onClick={handleNachtrag} disabled={saving || !formMa}
              className="px-4 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Stempel list grouped by date */}
      {loading ? (
        <div className="text-sm text-text-muted py-8 text-center">Laden...</div>
      ) : stempel.length === 0 ? (
        <div className="text-sm text-text-muted py-8 text-center">Keine Stempel im gewählten Zeitraum</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, entries]) => (
            <div key={day}>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 sticky top-0 bg-surface-main py-1">{formatDate(day + 'T12:00:00')}</h3>
              <div className="rounded-lg border border-border-default overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {entries.map(s => {
                      const Icon = TYP_ICONS[s.typ] || Clock
                      const color = TYP_COLORS[s.typ] || '#6B7280'
                      return (
                        <tr key={s.id} className="border-t first:border-t-0 border-border-default hover:bg-surface-hover/50">
                          <td className="px-4 py-2 w-20 text-right font-mono font-medium" style={{ color }}>{formatTime(s.zeitpunkt)}</td>
                          <td className="px-3 py-2 w-8"><Icon size={14} style={{ color }} /></td>
                          <td className="px-2 py-2 font-medium text-text-primary w-36">{TYP_LABELS[s.typ] || s.typ}</td>
                          <td className="px-4 py-2 text-text-secondary">
                            {s.mitarbeiter ? `${s.mitarbeiter.vorname} ${s.mitarbeiter.nachname}` : '-'}
                          </td>
                          <td className="px-4 py-2 text-xs text-text-muted">
                            {QUELLE_LABELS[s.quelle] || s.quelle}
                            {s.quelle === 'nachgetragen' && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">Nachgetragen</span>}
                          </td>
                          <td className="px-4 py-2 text-xs text-text-muted truncate max-w-[200px]">{s.notiz || ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Abwesenheiten Tab (unchanged)
// ═══════════════════════════════════════════════════════════════════
function AbwesenheitenTab() {
  const navigate = useNavigate()
  const { mitarbeiter, loading } = useMitarbeiter()
  const [selectedMa, setSelectedMa] = useState('')

  useEffect(() => {
    if (mitarbeiter.length > 0 && !selectedMa) setSelectedMa(mitarbeiter[0].id)
  }, [mitarbeiter, selectedMa])

  if (loading) return <div className="text-sm text-text-muted py-8 text-center">Laden...</div>
  const selected = mitarbeiter.find(m => m.id === selectedMa)

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium text-text-secondary">Mitarbeiter:</label>
        <select value={selectedMa} onChange={e => setSelectedMa(e.target.value)} className={selectCls + ' min-w-[200px]'}>
          {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
        </select>
        {selected && (
          <button onClick={() => navigate(`/mitarbeiter/${selectedMa}`)} className="flex items-center gap-1 text-xs text-brand hover:underline">
            <ExternalLink size={12} /> Stammdaten
          </button>
        )}
      </div>
      {selectedMa && (
        <AbwesenheitenSection key={selectedMa} mitarbeiterId={selectedMa}
          mitarbeiterName={selected ? `${selected.vorname} ${selected.nachname}` : ''} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 2.4 Monats-Auswertung
// ═══════════════════════════════════════════════════════════════════
function MonatsAuswertungTab() {
  const navigate = useNavigate()
  const { mitarbeiter } = useMitarbeiter()
  const [monat, setMonat] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [stempel, setStempel] = useState([])
  const [vertraege, setVertraege] = useState([])
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [year, month] = monat.split('-').map(Number)
    const start = `${monat}-01T00:00:00`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${monat}-${lastDay}T23:59:59`

    const [stempelRes, vertraegeRes, abwRes] = await Promise.all([
      supabase.from('zeitstempel').select('*').gte('zeitpunkt', start).lte('zeitpunkt', end).order('zeitpunkt'),
      supabase.from('arbeitsvertraege').select('*').eq('ist_aktuell', true),
      supabase.from('abwesenheiten').select('*, abwesenheitsarten(name, kuerzel)')
        .neq('status', 'storniert').neq('status', 'abgelehnt')
        .or(`datum.gte.${monat}-01,datum_bis.gte.${monat}-01`)
        .lte('datum', `${monat}-${lastDay}`),
    ])
    setStempel(stempelRes.data || [])
    setVertraege(vertraegeRes.data || [])
    setAbwesenheiten(abwRes.data || [])
    setLoading(false)
  }, [monat])

  useEffect(() => { loadData() }, [loadData])

  const shiftMonth = (dir) => {
    const [y, m] = monat.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    setMonat(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const auswertung = useMemo(() => {
    const [year, month] = monat.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()

    // Count workdays in month
    let workdays = 0
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow !== 0 && dow !== 6) workdays++
    }

    return mitarbeiter.map(ma => {
      // Get contract
      const vertrag = vertraege.find(v => v.mitarbeiter_id === ma.id)
      const sollStundenTag = vertrag ? (vertrag.wochenstunden || 40) / (vertrag.arbeitstage_pro_woche || 5) : 8
      const sollStundenMonat = sollStundenTag * workdays

      // Calc actual hours from stempel
      const maStempel = stempel.filter(s => s.mitarbeiter_id === ma.id)
      // Group by date
      const byDay = {}
      for (const s of maStempel) {
        const day = toLocalDateStr(s.zeitpunkt)
        if (!byDay[day]) byDay[day] = []
        byDay[day].push(s)
      }
      let istStunden = 0
      let tageGearbeitet = 0
      for (const dayStempel of Object.values(byDay)) {
        dayStempel.sort((a, b) => new Date(a.zeitpunkt) - new Date(b.zeitpunkt))
        const h = calcHours(dayStempel)
        istStunden += h.netto
        if (h.netto > 0) tageGearbeitet++
      }

      // Abwesenheiten
      const maAbw = abwesenheiten.filter(a => a.mitarbeiter_id === ma.id)
      let abwTage = 0
      for (const a of maAbw) {
        const von = new Date(Math.max(new Date(a.datum + 'T00:00:00'), new Date(year, month - 1, 1)))
        const bis = new Date(Math.min(new Date((a.datum_bis || a.datum) + 'T00:00:00'), new Date(year, month - 1, lastDay)))
        let d = new Date(von)
        while (d <= bis) {
          const dow = d.getDay()
          if (dow !== 0 && dow !== 6) abwTage++
          d.setDate(d.getDate() + 1)
        }
      }

      const sollBereinigt = (workdays - abwTage) * sollStundenTag
      const diff = istStunden - sollBereinigt

      return { ...ma, sollStundenMonat, sollBereinigt, istStunden, diff, tageGearbeitet, abwTage, sollStundenTag }
    })
  }, [mitarbeiter, stempel, vertraege, abwesenheiten, monat])

  const monatLabel = new Date(monat + '-15').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={18} /></button>
        <input type="month" value={monat} onChange={e => setMonat(e.target.value)} className={inputCls} />
        <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={18} /></button>
        <span className="text-sm font-medium text-text-primary ml-2">{monatLabel}</span>
      </div>

      {loading ? (
        <div className="text-sm text-text-muted py-8 text-center">Laden...</div>
      ) : (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-card text-text-secondary text-xs">
                <th className="text-left px-4 py-2.5 font-medium">Mitarbeiter</th>
                <th className="text-right px-4 py-2.5 font-medium">Soll (h)</th>
                <th className="text-right px-4 py-2.5 font-medium">Ist (h)</th>
                <th className="text-right px-4 py-2.5 font-medium">+/- (h)</th>
                <th className="text-right px-4 py-2.5 font-medium">Tage gearbeitet</th>
                <th className="text-right px-4 py-2.5 font-medium">Abwesenheit</th>
                <th className="text-right px-4 py-2.5 font-medium">Soll/Tag</th>
              </tr>
            </thead>
            <tbody>
              {auswertung.map(ma => (
                <tr key={ma.id} className="border-t border-border-default hover:bg-surface-hover/50">
                  <td className="px-4 py-2.5">
                    <button onClick={() => navigate(`/mitarbeiter/${ma.id}`)} className="font-medium text-text-primary hover:text-brand">
                      {ma.vorname} {ma.nachname}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{fmtH(ma.sollBereinigt)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-text-primary">{fmtH(ma.istStunden)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${ma.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ma.diff >= 0 ? '+' : ''}{fmtH(Math.abs(ma.diff))}
                    {ma.diff < 0 && <span className="text-red-600">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{ma.tageGearbeitet}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{ma.abwTage > 0 ? `${ma.abwTage} Tage` : '-'}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{fmtH(ma.sollStundenTag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════
export default function Zeiterfassung() {
  const [activeTab, setActiveTab] = useState('tagesuebersicht')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-[var(--brand)]" size={24} />
        <h1 className="text-xl font-bold text-text-primary">Zeiterfassung</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-border-default">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[var(--brand)] text-[var(--brand)]'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'tagesuebersicht' && <TagesuebersichtTab />}
      {activeTab === 'stempel' && <StempelProtokollTab />}
      {activeTab === 'abwesenheiten' && <AbwesenheitenTab />}
      {activeTab === 'auswertung' && <MonatsAuswertungTab />}
    </div>
  )
}
