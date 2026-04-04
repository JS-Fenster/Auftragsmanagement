/**
 * Zeiterfassung — Zentrale Seite fuer Stempelzeiten, Abwesenheiten und Auswertungen
 *
 * Tabs: Tagesuebersicht, Stempel-Protokoll, Abwesenheiten, Zeitkarte
 * W4A-inspiriert: Zeitkarte mit KW-Gruppierung + kumulativen Ueberstunden,
 *   Abwesenheiten-Matrix mit Abteilungs-Gruppierung + Urlaubskonto,
 *   Jahresuebersicht pro MA
 */
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { Clock, List, CalendarOff, BarChart3, ExternalLink, Plus, ChevronLeft, ChevronRight, Coffee, LogIn, LogOut, Play, FileText, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AbwesenheitenSection from '../components/AbwesenheitenSection'

const TABS = [
  { id: 'tagesuebersicht', label: 'Tagesübersicht', icon: Clock },
  { id: 'stempel', label: 'Stempel-Protokoll', icon: List },
  { id: 'abwesenheiten', label: 'Abwesenheiten', icon: CalendarOff },
  { id: 'zeitkarte', label: 'Zeitkarte', icon: FileText },
]

const TYP_LABELS = {
  kommen: 'Kommen', gehen: 'Gehen',
  pause_start: 'Pause Start', pause_ende: 'Pause Ende',
  rauchen_start: 'Raucherpause', rauchen_ende: 'Raucherpause Ende',
}
const TYP_ICONS = { kommen: LogIn, gehen: LogOut, pause_start: Coffee, pause_ende: Play, rauchen_start: Coffee, rauchen_ende: Play }
const TYP_COLORS = { kommen: '#065F46', gehen: '#991B1B', pause_start: '#92400E', pause_ende: '#065F46', rauchen_start: '#92400E', rauchen_ende: '#065F46' }
const QUELLE_LABELS = { tablet: 'Tablet', app: 'App', dashboard: 'Dashboard', manuell: 'Manuell', nachgetragen: 'Nachgetragen', mobile: 'Mobil', rfid: 'RFID', korrektur: 'Korrektur' }

const ROLLE_GRUPPEN = {
  geschaeftsfuehrung: { label: 'Geschäftsführung', order: 1 },
  buero: { label: 'Büro / Verwaltung', order: 2 },
  monteur: { label: 'Montage', order: 3 },
  teilzeit: { label: 'Büro / Verwaltung', order: 2 },
  minijob: { label: 'Büro / Verwaltung', order: 2 },
  azubi: { label: 'Montage', order: 3 },
}

const ABW_COLORS = {
  urlaub: { bg: '#DBEAFE', text: '#1E40AF', short: 'U' },
  krank: { bg: '#FEE2E2', text: '#991B1B', short: 'K' },
  krank_kind: { bg: '#FCE7F3', text: '#9D174D', short: 'KK' },
  elternzeit: { bg: '#EDE9FE', text: '#5B21B6', short: 'EZ' },
  mutterschutz: { bg: '#FCE7F3', text: '#9D174D', short: 'MS' },
  sonderurlaub: { bg: '#FEF3C7', text: '#92400E', short: 'SU' },
  fortbildung: { bg: '#ECFDF5', text: '#065F46', short: 'FB' },
  unbezahlt: { bg: '#F3F4F6', text: '#374151', short: 'UB' },
  feiertag: { bg: '#E0E7FF', text: '#3730A3', short: 'F' },
  weihnachten_silvester: { bg: '#FEF3C7', text: '#92400E', short: 'WS' },
  freistellung: { bg: '#D1FAE5', text: '#065F46', short: 'FS' },
  ausgestellt: { bg: '#FED7AA', text: '#9A3412', short: 'AU' },
  ueberstundenausgleich: { bg: '#CFFAFE', text: '#155E75', short: 'ÜA' },
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function formatTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) }
function toLocalDateStr(d) { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
function getKW(d) { const date = new Date(d); date.setHours(0,0,0,0); date.setDate(date.getDate()+3-(date.getDay()+6)%7); const w1=new Date(date.getFullYear(),0,4); return 1+Math.round(((date-w1)/86400000-3+(w1.getDay()+6)%7)/7) }

function calcHours(stempel) {
  let totalMs = 0, pauseMs = 0, kommenZeit = null, pauseStart = null
  for (const s of stempel) {
    const t = new Date(s.zeitpunkt).getTime()
    if (s.typ === 'kommen') kommenZeit = t
    if (s.typ === 'gehen' && kommenZeit) { totalMs += t - kommenZeit; kommenZeit = null }
    if (s.typ === 'pause_start' || s.typ === 'rauchen_start') pauseStart = t
    if ((s.typ === 'pause_ende' || s.typ === 'rauchen_ende') && pauseStart) { pauseMs += t - pauseStart; pauseStart = null }
  }
  return { brutto: totalMs / 3600000, pause: pauseMs / 3600000, netto: (totalMs - pauseMs) / 3600000 }
}

function fmtH(h) {
  if (!h || h === 0) return '-'
  const neg = h < 0
  const abs = Math.abs(h)
  return `${neg ? '-' : ''}${Math.floor(abs)}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`
}
function fmtHSigned(h) {
  if (!h || h === 0) return '-'
  const neg = h < 0
  const abs = Math.abs(h)
  return `${neg ? '-' : '+'}${Math.floor(abs)}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`
}

const selectCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
const inputCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"

// ─── Shared MA hook ───
function useMitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      supabase.from('mitarbeiter').select('id, vorname, nachname, status, rolle').eq('status', 'aktiv').order('nachname'),
      supabase.from('personen').select('mitarbeiter_alt_id, vorname, nachname'),
      supabase.from('mitarbeiter_daten').select('mitarbeiter_alt_id, personalnummer, status, funktion, abteilung, pausenregel, rundung_taktung, rundung_kommen, fruehester_beginn'),
    ]).then(([altRes, pRes, mdRes]) => {
      const personen = pRes.data || []
      const maDaten = mdRes.data || []
      const merged = (altRes.data || []).map(alt => {
        const p = personen.find(pp => pp.mitarbeiter_alt_id === alt.id)
        const md = maDaten.find(d => d.mitarbeiter_alt_id === alt.id)
        return { ...alt, vorname: p?.vorname || alt.vorname, nachname: p?.nachname || alt.nachname, status: md?.status || alt.status, abteilung: md?.abteilung, personalnummer: md?.personalnummer, pausenregel: md?.pausenregel, rundung_taktung: md?.rundung_taktung, rundung_kommen: md?.rundung_kommen, fruehester_beginn: md?.fruehester_beginn }
      })
      setMitarbeiter(merged)
      setLoading(false)
    })
  }, [])
  return { mitarbeiter, loading }
}

function groupByRolle(mitarbeiter) {
  const groups = {}
  for (const ma of mitarbeiter) {
    const grp = ROLLE_GRUPPEN[ma.rolle] || { label: ma.rolle, order: 99 }
    if (!groups[grp.label]) groups[grp.label] = { label: grp.label, order: grp.order, items: [] }
    groups[grp.label].items.push(ma)
  }
  return Object.values(groups).sort((a, b) => a.order - b.order)
}

// ═══════════════════════════════════════════════════════════════════
// Tagesuebersicht
// ═══════════════════════════════════════════════════════════════════
function TagesuebersichtTab() {
  const navigate = useNavigate()
  const { mitarbeiter, loading: maLoading } = useMitarbeiter()
  const [datum, setDatum] = useState(toLocalDateStr(new Date()))
  const [stempel, setStempel] = useState([])
  const [loading, setLoading] = useState(true)
  const [stamping, setStamping] = useState(null)
  const isToday = datum === toLocalDateStr(new Date())

  const loadStempel = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('zeitstempel').select('*')
      .gte('zeitpunkt', `${datum}T00:00:00`).lte('zeitpunkt', `${datum}T23:59:59`).order('zeitpunkt')
    setStempel(data || [])
    setLoading(false)
  }, [datum])

  useEffect(() => { loadStempel() }, [loadStempel])

  const handleStempel = async (maId, typ) => {
    setStamping(maId)
    await supabase.from('zeitstempel').insert({ mitarbeiter_id: maId, zeitpunkt: new Date().toISOString(), typ, quelle: 'dashboard' })
    await loadStempel()
    setStamping(null)
  }

  const getNextAction = (status) => {
    if (status === 'nicht_gestempelt' || status === 'ausgestempelt') return { typ: 'kommen', label: 'Einstempeln', color: '#065F46', bg: '#ECFDF5' }
    if (status === 'aktiv') return { typ: 'gehen', label: 'Ausstempeln', color: '#991B1B', bg: '#FEE2E2' }
    if (status === 'pause') return { typ: 'pause_ende', label: 'Pause beenden', color: '#065F46', bg: '#ECFDF5' }
    return null
  }

  const shiftDate = (days) => { const d = new Date(datum + 'T12:00:00'); d.setDate(d.getDate() + days); setDatum(toLocalDateStr(d)) }

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
  const grouped = groupByRolle(maStatus)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={18} /></button>
        <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inputCls} />
        <button onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={18} /></button>
        <button onClick={() => setDatum(toLocalDateStr(new Date()))} className="text-xs text-brand hover:underline ml-2">Heute</button>
        <span className="text-sm text-text-muted ml-auto">{formatDate(datum + 'T12:00:00')}</span>
      </div>

      <div className="flex gap-3 mb-5">
        {Object.entries(statusStyles).map(([key, style]) => (
          <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} /> {style.label}: {counts[key]}
          </div>
        ))}
      </div>

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
              {isToday && <th className="text-center px-4 py-2.5 font-medium">Aktion</th>}
            </tr>
          </thead>
          <tbody>
            {grouped.map(grp => (
              <Fragment key={grp.label}>
                <tr className="bg-surface-main/80">
                  <td colSpan={isToday ? 8 : 7} className="px-4 py-1.5 text-xs font-bold text-text-secondary uppercase tracking-wide">{grp.label}</td>
                </tr>
                {grp.items.map(ma => {
                  const st = statusStyles[ma.status]
                  const kommen = ma.stempel.find(s => s.typ === 'kommen')
                  const gehen = [...ma.stempel].reverse().find(s => s.typ === 'gehen')
                  const nextAction = getNextAction(ma.status)
                  return (
                    <tr key={ma.id} className="border-t border-border-default hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <button onClick={() => navigate(`/mitarbeiter/${ma.id}`)} className="font-medium text-text-primary hover:text-brand">{ma.vorname} {ma.nachname}</button>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatTime(kommen?.zeitpunkt)}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatTime(gehen?.zeitpunkt)}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{fmtH(ma.hours.pause)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-text-primary">{fmtH(ma.hours.netto)}</td>
                      <td className="px-4 py-2.5 text-xs text-text-muted">{ma.lastAction ? `${TYP_LABELS[ma.lastAction.typ] || ma.lastAction.typ} ${formatTime(ma.lastAction.zeitpunkt)}` : '-'}</td>
                      {isToday && nextAction && (
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => handleStempel(ma.id, nextAction.typ)} disabled={stamping === ma.id}
                            className="px-3 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
                            style={{ color: nextAction.color, backgroundColor: nextAction.bg, borderColor: nextAction.color + '30' }}>
                            {stamping === ma.id ? '...' : nextAction.label}
                          </button>
                          {ma.status === 'aktiv' && (
                            <button onClick={() => handleStempel(ma.id, 'pause_start')} disabled={stamping === ma.id}
                              className="ml-1 px-2 py-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50">Pause</button>
                          )}
                        </td>
                      )}
                      {isToday && !nextAction && <td />}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div className="text-xs text-text-muted text-center mt-2">Lade Stempel...</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Stempel-Protokoll
// ═══════════════════════════════════════════════════════════════════
function StempelProtokollTab() {
  const { mitarbeiter } = useMitarbeiter()
  const [filterMa, setFilterMa] = useState('')
  const [datumVon, setDatumVon] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return toLocalDateStr(d) })
  const [datumBis, setDatumBis] = useState(toLocalDateStr(new Date()))
  const [stempel, setStempel] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formMa, setFormMa] = useState('')
  const [formDatum, setFormDatum] = useState(toLocalDateStr(new Date()))
  const [formZeit, setFormZeit] = useState('07:00')
  const [formTyp, setFormTyp] = useState('kommen')
  const [formNotiz, setFormNotiz] = useState('')
  const [korrekturStempel, setKorrekturStempel] = useState(null)
  const [korrekturZeit, setKorrekturZeit] = useState('')
  const [korrekturTyp, setKorrekturTyp] = useState('')
  const [korrekturGrund, setKorrekturGrund] = useState('')
  const [korrekturSaving, setKorrekturSaving] = useState(false)
  const [korrekturen, setKorrekturen] = useState([])

  const loadKorrekturen = useCallback(async () => {
    const { data } = await supabase.from('zeit_korrekturen')
      .select('*, zeitstempel(zeitpunkt, typ, mitarbeiter(vorname, nachname))')
      .order('beantragt_am', { ascending: false }).limit(20)
    setKorrekturen(data || [])
  }, [])

  useEffect(() => { loadKorrekturen() }, [loadKorrekturen])

  const loadStempel = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('zeitstempel').select('*, mitarbeiter(vorname, nachname)')
      .gte('zeitpunkt', `${datumVon}T00:00:00`).lte('zeitpunkt', `${datumBis}T23:59:59`)
      .order('zeitpunkt', { ascending: false }).limit(200)
    if (filterMa) q = q.eq('mitarbeiter_id', filterMa)
    const { data } = await q
    setStempel(data || [])
    setLoading(false)
  }, [datumVon, datumBis, filterMa])

  useEffect(() => { loadStempel() }, [loadStempel])

  const handleNachtrag = async () => {
    if (!formMa || !formDatum || !formZeit || !formTyp) return
    setSaving(true)
    await supabase.from('zeitstempel').insert({ mitarbeiter_id: formMa, zeitpunkt: `${formDatum}T${formZeit}:00`, typ: formTyp, quelle: 'nachgetragen', notiz: formNotiz || null })
    setSaving(false); setShowForm(false); setFormNotiz(''); loadStempel()
  }

  const openKorrektur = (s) => { setKorrekturStempel(s); setKorrekturZeit(formatTime(s.zeitpunkt)); setKorrekturTyp(s.typ); setKorrekturGrund('') }

  const handleKorrektur = async () => {
    if (!korrekturGrund.trim() || !korrekturStempel) return
    setKorrekturSaving(true)
    const { data: gf } = await supabase.from('mitarbeiter').select('id').eq('vorname', 'Andreas').eq('nachname', 'Stolarczyk').single()
    await supabase.from('zeit_korrekturen').insert({
      zeitstempel_id: korrekturStempel.id, beantragt_von: gf?.id || korrekturStempel.mitarbeiter_id,
      grund: korrekturGrund.trim(), alter_zeitpunkt: korrekturStempel.zeitpunkt,
      neuer_zeitpunkt: `${toLocalDateStr(korrekturStempel.zeitpunkt)}T${korrekturZeit}:00`,
      alter_typ: korrekturStempel.typ, neuer_typ: korrekturTyp,
    })
    setKorrekturSaving(false); setKorrekturStempel(null); loadKorrekturen()
  }

  const handleKorrekturAction = async (korrekturId, action) => {
    const { data: gf } = await supabase.from('mitarbeiter').select('id').eq('vorname', 'Andreas').eq('nachname', 'Stolarczyk').single()
    await supabase.from('zeit_korrekturen').update({ status: action, genehmigt_von: gf?.id, genehmigt_am: new Date().toISOString() }).eq('id', korrekturId)
    if (action === 'genehmigt') {
      const k = korrekturen.find(k => k.id === korrekturId)
      if (k) {
        const upd = {}
        if (k.neuer_zeitpunkt) upd.zeitpunkt = k.neuer_zeitpunkt
        if (k.neuer_typ) upd.typ = k.neuer_typ
        if (Object.keys(upd).length) { upd.quelle = 'korrektur'; await supabase.from('zeitstempel').update(upd).eq('id', k.zeitstempel_id) }
      }
    }
    loadKorrekturen(); loadStempel()
  }

  const grouped = useMemo(() => {
    const groups = {}
    for (const s of stempel) { const day = toLocalDateStr(s.zeitpunkt); if (!groups[day]) groups[day] = []; groups[day].push(s) }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [stempel])

  return (
    <div>
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

      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-border-default bg-surface-card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Stempel nachtragen</h3>
          <div className="flex items-end gap-3 flex-wrap">
            <div><label className="block text-xs text-text-secondary mb-1">Mitarbeiter *</label>
              <select value={formMa} onChange={e => setFormMa(e.target.value)} className={selectCls + ' min-w-[180px]'}>
                <option value="">--</option>{mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
              </select></div>
            <div><label className="block text-xs text-text-secondary mb-1">Datum *</label><input type="date" value={formDatum} onChange={e => setFormDatum(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs text-text-secondary mb-1">Uhrzeit *</label><input type="time" value={formZeit} onChange={e => setFormZeit(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs text-text-secondary mb-1">Typ *</label>
              <select value={formTyp} onChange={e => setFormTyp(e.target.value)} className={selectCls}>
                <option value="kommen">Kommen</option><option value="gehen">Gehen</option><option value="pause_start">Pause Start</option><option value="pause_ende">Pause Ende</option>
              </select></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs text-text-secondary mb-1">Notiz</label>
              <input value={formNotiz} onChange={e => setFormNotiz(e.target.value)} placeholder="Grund für Nachtrag..." className={inputCls + ' w-full'} /></div>
            <button onClick={handleNachtrag} disabled={saving || !formMa} className="px-4 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">{saving ? '...' : 'Speichern'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-text-muted py-8 text-center">Laden...</div>
      : stempel.length === 0 ? <div className="text-sm text-text-muted py-8 text-center">Keine Stempel im gewählten Zeitraum</div>
      : (
        <div className="space-y-4">
          {grouped.map(([day, entries]) => (
            <div key={day}>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 sticky top-0 bg-surface-main py-1">{formatDate(day + 'T12:00:00')}</h3>
              <div className="rounded-lg border border-border-default overflow-hidden">
                <table className="w-full text-sm"><tbody>
                  {entries.map(s => {
                    const Icon = TYP_ICONS[s.typ] || Clock; const color = TYP_COLORS[s.typ] || '#6B7280'
                    return (
                      <tr key={s.id} className="border-t first:border-t-0 border-border-default hover:bg-surface-hover/50">
                        <td className="px-4 py-2 w-20 text-right font-mono font-medium" style={{ color }}>{formatTime(s.zeitpunkt)}</td>
                        <td className="px-3 py-2 w-8"><Icon size={14} style={{ color }} /></td>
                        <td className="px-2 py-2 font-medium text-text-primary w-36">{TYP_LABELS[s.typ] || s.typ}</td>
                        <td className="px-4 py-2 text-text-secondary">{s.mitarbeiter ? `${s.mitarbeiter.vorname} ${s.mitarbeiter.nachname}` : '-'}</td>
                        <td className="px-4 py-2 text-xs text-text-muted">
                          {QUELLE_LABELS[s.quelle] || s.quelle}
                          {s.quelle === 'nachgetragen' && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">Nachgetragen</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-text-muted truncate max-w-[200px]">{s.notiz || ''}</td>
                        <td className="px-2 py-2"><button onClick={() => openKorrektur(s)} className="text-[10px] text-text-muted hover:text-brand hover:underline">Korrektur</button></td>
                      </tr>
                    )
                  })}
                </tbody></table>
              </div>
            </div>
          ))}
        </div>
      )}

      {korrekturStempel && (
        <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Korrektur beantragen</h3>
          <p className="text-xs text-text-muted mb-3">Stempel: {korrekturStempel.mitarbeiter?.vorname} {korrekturStempel.mitarbeiter?.nachname} — {TYP_LABELS[korrekturStempel.typ]} um {formatTime(korrekturStempel.zeitpunkt)}</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div><label className="block text-xs text-text-secondary mb-1">Neue Uhrzeit</label><input type="time" value={korrekturZeit} onChange={e => setKorrekturZeit(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs text-text-secondary mb-1">Neuer Typ</label>
              <select value={korrekturTyp} onChange={e => setKorrekturTyp(e.target.value)} className={selectCls}>
                <option value="kommen">Kommen</option><option value="gehen">Gehen</option><option value="pause_start">Pause Start</option><option value="pause_ende">Pause Ende</option>
              </select></div>
            <div className="flex-1 min-w-[200px]"><label className="block text-xs text-text-secondary mb-1">Grund *</label>
              <input value={korrekturGrund} onChange={e => setKorrekturGrund(e.target.value)} placeholder="Warum muss korrigiert werden?" className={inputCls + ' w-full'} /></div>
            <button onClick={handleKorrektur} disabled={korrekturSaving || !korrekturGrund.trim()} className="px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">{korrekturSaving ? '...' : 'Beantragen'}</button>
            <button onClick={() => setKorrekturStempel(null)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      {korrekturen.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Korrekturen</h3>
          <div className="rounded-lg border border-border-default overflow-hidden">
            <table className="w-full text-sm"><thead>
              <tr className="bg-surface-card text-text-secondary text-xs">
                <th className="text-left px-4 py-2 font-medium">Mitarbeiter</th><th className="text-left px-4 py-2 font-medium">Original</th>
                <th className="text-left px-4 py-2 font-medium">Korrektur</th><th className="text-left px-4 py-2 font-medium">Grund</th>
                <th className="text-left px-4 py-2 font-medium">Status</th><th className="text-center px-4 py-2 font-medium">Aktion</th>
              </tr>
            </thead><tbody>
              {korrekturen.map(k => {
                const sts = k.status === 'beantragt' ? { bg: '#FEF3C7', text: '#92400E', label: 'Offen' }
                  : k.status === 'genehmigt' ? { bg: '#ECFDF5', text: '#065F46', label: 'Genehmigt' }
                  : { bg: '#FEE2E2', text: '#991B1B', label: 'Abgelehnt' }
                return (
                  <tr key={k.id} className="border-t border-border-default">
                    <td className="px-4 py-2 text-text-primary">{k.zeitstempel?.mitarbeiter ? `${k.zeitstempel.mitarbeiter.vorname} ${k.zeitstempel.mitarbeiter.nachname}` : '-'}</td>
                    <td className="px-4 py-2 text-text-muted text-xs">{TYP_LABELS[k.alter_typ]} {k.alter_zeitpunkt ? formatTime(k.alter_zeitpunkt) : ''}</td>
                    <td className="px-4 py-2 text-text-primary text-xs font-medium">{TYP_LABELS[k.neuer_typ]} {k.neuer_zeitpunkt ? formatTime(k.neuer_zeitpunkt) : ''}</td>
                    <td className="px-4 py-2 text-xs text-text-secondary truncate max-w-[200px]">{k.grund}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: sts.bg, color: sts.text }}>{sts.label}</span></td>
                    <td className="px-4 py-2 text-center">
                      {k.status === 'beantragt' && (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleKorrekturAction(k.id, 'genehmigt')} className="px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100">Genehmigen</button>
                          <button onClick={() => handleKorrekturAction(k.id, 'abgelehnt')} className="px-2 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100">Ablehnen</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Abwesenheiten — Matrix + Jahresuebersicht
// ═══════════════════════════════════════════════════════════════════
function AbwesenheitenTab() {
  const navigate = useNavigate()
  const { mitarbeiter, loading: maLoading } = useMitarbeiter()
  const [monat, setMonat] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMa, setSelectedMa] = useState('')
  const [ansicht, setAnsicht] = useState('gruppe') // 'gruppe' | 'einzel'
  const [urlaubskonten, setUrlaubskonten] = useState([])

  const [year, month] = monat.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const days = Array.from({ length: lastDay }, (_, i) => i + 1)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [abwRes, kontenRes] = await Promise.all([
      supabase.from('abwesenheiten').select('*, abwesenheitsarten(name, kuerzel, farbe)')
        .neq('status', 'storniert').neq('status', 'abgelehnt')
        .lte('datum', `${monat}-${lastDay}`)
        .or(`datum_bis.gte.${monat}-01,datum_bis.is.null`),
      supabase.from('arbeitsvertraege').select('mitarbeiter_id, urlaubstage_jahr').eq('ist_aktuell', true),
    ])
    setAbwesenheiten(abwRes.data || [])
    setUrlaubskonten(kontenRes.data || [])
    setLoading(false)
  }, [monat, lastDay])

  useEffect(() => { loadData() }, [loadData])

  const shiftMonth = (dir) => { const d = new Date(year, month-1+dir, 1); setMonat(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }

  const getAbwForDay = (maId, day) => {
    const dateStr = `${monat}-${String(day).padStart(2, '0')}`
    return abwesenheiten.find(a => a.mitarbeiter_id === maId && a.datum <= dateStr && (a.datum_bis ? a.datum_bis >= dateStr : a.datum >= dateStr))
  }

  const getUrlaubStats = (maId) => {
    const vertrag = urlaubskonten.find(v => v.mitarbeiter_id === maId)
    const anspruch = vertrag?.urlaubstage_jahr || 30
    const genommen = abwesenheiten.filter(a => a.mitarbeiter_id === maId && a.abwesenheitsarten?.kuerzel?.toLowerCase() === 'urlaub').reduce((sum, a) => {
      const von = new Date(a.datum + 'T00:00:00'); const bis = new Date((a.datum_bis || a.datum) + 'T00:00:00')
      let cnt = 0; const d = new Date(von); while (d <= bis) { if (d.getDay() !== 0 && d.getDay() !== 6) cnt++; d.setDate(d.getDate()+1) }
      return sum + cnt
    }, 0)
    return { anspruch, genommen, rest: anspruch - genommen }
  }

  if (maLoading) return <div className="text-sm text-text-muted py-8 text-center">Laden...</div>

  const monatLabel = new Date(year, month-1, 15).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const grouped = groupByRolle(mitarbeiter)

  // KW headers
  const kwMap = {}
  for (const d of days) { const kw = getKW(new Date(year, month-1, d)); if (!kwMap[kw]) kwMap[kw] = []; kwMap[kw].push(d) }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-surface-card border border-border-default rounded-lg p-0.5">
          <button onClick={() => setAnsicht('gruppe')} className={`px-3 py-1 text-xs font-medium rounded ${ansicht === 'gruppe' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Gruppenansicht</button>
          <button onClick={() => setAnsicht('einzel')} className={`px-3 py-1 text-xs font-medium rounded ${ansicht === 'einzel' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Einzelansicht</button>
        </div>
        <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={18} /></button>
        <input type="month" value={monat} onChange={e => setMonat(e.target.value)} className={inputCls} />
        <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={18} /></button>
        <span className="text-sm font-medium text-text-primary ml-2">{monatLabel}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(ABW_COLORS).slice(0, 8).map(([key, style]) => (
          <span key={key} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
            {style.short} = {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
          </span>
        ))}
      </div>

      {ansicht === 'gruppe' && !loading && (
        <div className="rounded-lg border border-border-default overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr className="bg-surface-card text-text-secondary">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-surface-card z-10 min-w-[140px]">Mitarbeiter</th>
                <th className="px-2 py-2 text-center font-medium text-[10px]">Ansp.</th>
                <th className="px-2 py-2 text-center font-medium text-[10px]">Gen.</th>
                <th className="px-2 py-2 text-center font-medium text-[10px] text-brand font-bold">Rest</th>
                {Object.entries(kwMap).map(([kw, kwDays]) => (
                  <th key={kw} colSpan={kwDays.length} className="text-center px-0 py-1 font-medium text-[10px] border-l border-border-default">KW {kw}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Tage</th>
              </tr>
              <tr className="bg-surface-card text-text-muted text-[10px]">
                <th className="sticky left-0 bg-surface-card z-10" />
                <th /><th /><th />
                {days.map(d => {
                  const dow = new Date(year, month-1, d).getDay()
                  const isWeekend = dow === 0 || dow === 6
                  return <th key={d} className={`px-0 py-0.5 text-center w-6 ${isWeekend ? 'bg-gray-100' : ''}`}>{d}</th>
                })}
                <th />
              </tr>
            </thead>
            <tbody>
              {grouped.map(grp => (
                <Fragment key={grp.label}>
                  <tr className="bg-surface-main/80">
                    <td colSpan={4 + days.length + 1} className="px-3 py-1 text-[10px] font-bold text-text-secondary uppercase tracking-wide sticky left-0 bg-surface-main/80 z-10">{grp.label}</td>
                  </tr>
                  {grp.items.map(ma => {
                    let totalDays = 0
                    const stats = getUrlaubStats(ma.id)
                    return (
                      <tr key={ma.id} className="border-t border-border-default hover:bg-surface-hover/30">
                        <td className="px-3 py-1.5 font-medium text-text-primary sticky left-0 bg-white z-10">
                          <button onClick={() => { setSelectedMa(selectedMa === ma.id ? '' : ma.id); setAnsicht('einzel') }} className="hover:text-brand">{ma.nachname} {ma.vorname}</button>
                        </td>
                        <td className="px-2 py-1.5 text-center text-text-secondary">{stats.anspruch}</td>
                        <td className="px-2 py-1.5 text-center text-text-secondary">{stats.genommen}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-brand">{stats.rest}</td>
                        {days.map(d => {
                          const dow = new Date(year, month-1, d).getDay()
                          const isWeekend = dow === 0 || dow === 6
                          const abw = getAbwForDay(ma.id, d)
                          if (abw && !isWeekend) totalDays++
                          const kuerzel = abw?.abwesenheitsarten?.kuerzel?.toLowerCase() || ''
                          const style = ABW_COLORS[kuerzel] || (abw ? { bg: '#E5E7EB', text: '#374151', short: '?' } : null)
                          return (
                            <td key={d} className={`px-0 py-1 text-center ${isWeekend ? 'bg-gray-50' : ''}`}>
                              {style && <span className="inline-block w-5 h-5 leading-5 rounded text-[9px] font-bold" style={{ backgroundColor: style.bg, color: style.text }}>{style.short}</span>}
                            </td>
                          )
                        })}
                        <td className="px-3 py-1.5 text-right text-text-secondary font-medium">{totalDays || '-'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ansicht === 'einzel' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select value={selectedMa} onChange={e => setSelectedMa(e.target.value)} className={selectCls + ' min-w-[200px]'}>
              <option value="">Mitarbeiter wählen...</option>
              {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
            </select>
            {selectedMa && <button onClick={() => navigate(`/mitarbeiter/${selectedMa}`)} className="flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink size={12} /> Stammdaten</button>}
          </div>

          {selectedMa ? (
            <div>
              {/* Year overview: 12 months */}
              <div className="rounded-lg border border-border-default overflow-x-auto mb-6">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-surface-card text-text-secondary">
                      <th className="px-2 py-2 text-left font-medium w-8"></th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className="px-1 py-2 text-center font-medium">{new Date(year, i, 1).toLocaleDateString('de-DE', { month: 'short' })}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, row) => row + 1).map(day => (
                      <tr key={day} className="border-t border-border-default">
                        <td className="px-2 py-0.5 text-text-muted font-mono text-right">{day}</td>
                        {Array.from({ length: 12 }, (_, mi) => {
                          const maxDay = new Date(year, mi + 1, 0).getDate()
                          if (day > maxDay) return <td key={mi} className="bg-gray-50" />
                          const dateStr = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                          const dow = new Date(year, mi, day).getDay()
                          const isWeekend = dow === 0 || dow === 6
                          const abw = abwesenheiten.find(a => a.mitarbeiter_id === selectedMa && a.datum <= dateStr && (a.datum_bis ? a.datum_bis >= dateStr : a.datum >= dateStr))
                          const kuerzel = abw?.abwesenheitsarten?.kuerzel?.toLowerCase() || ''
                          const style = ABW_COLORS[kuerzel] || (abw ? { bg: '#E5E7EB', text: '#374151', short: '?' } : null)
                          return (
                            <td key={mi} className={`px-0 py-0.5 text-center ${isWeekend ? 'bg-gray-100 text-text-muted' : ''}`}>
                              {style ? (
                                <span className="inline-block w-full text-[9px] font-bold rounded" style={{ backgroundColor: style.bg, color: style.text }}>{style.short}</span>
                              ) : (
                                <span className="text-[9px] text-text-muted">{WOCHENTAGE[dow]}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MA Abwesenheiten verwalten */}
              <div className="p-4 rounded-lg border border-border-default bg-surface-card">
                <AbwesenheitenSection key={selectedMa} mitarbeiterId={selectedMa}
                  mitarbeiterName={`${mitarbeiter.find(m => m.id === selectedMa)?.vorname || ''} ${mitarbeiter.find(m => m.id === selectedMa)?.nachname || ''}`} />
              </div>
            </div>
          ) : <div className="text-sm text-text-muted py-8 text-center">Mitarbeiter auswählen um Jahresübersicht anzuzeigen</div>}
        </div>
      )}

      {loading && <div className="text-xs text-text-muted text-center mt-2">Laden...</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Zeitkarte (W4A-Style)
// ═══════════════════════════════════════════════════════════════════
function ZeitkarteTab() {
  const navigate = useNavigate()
  const { mitarbeiter } = useMitarbeiter()
  const [selectedMa, setSelectedMa] = useState('')
  const [monat, setMonat] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [stempel, setStempel] = useState([])
  const [vertraege, setVertraege] = useState([])
  const [feiertage, setFeiertage] = useState([])
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (mitarbeiter.length > 0 && !selectedMa) setSelectedMa(mitarbeiter[0].id) }, [mitarbeiter, selectedMa])

  const [year, month] = monat.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const loadData = useCallback(async () => {
    if (!selectedMa) return
    setLoading(true)
    const [stRes, vtRes, ftRes, abwRes] = await Promise.all([
      supabase.from('zeitstempel').select('*').eq('mitarbeiter_id', selectedMa)
        .gte('zeitpunkt', `${monat}-01T00:00:00`).lte('zeitpunkt', `${monat}-${lastDay}T23:59:59`).order('zeitpunkt'),
      supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', selectedMa).eq('ist_aktuell', true).single(),
      supabase.from('feiertage').select('datum, name').gte('datum', `${monat}-01`).lte('datum', `${monat}-${lastDay}`),
      supabase.from('abwesenheiten').select('*, abwesenheitsarten(name, kuerzel)')
        .eq('mitarbeiter_id', selectedMa).neq('status', 'storniert').neq('status', 'abgelehnt')
        .lte('datum', `${monat}-${lastDay}`).or(`datum_bis.gte.${monat}-01,datum_bis.is.null`),
    ])
    setStempel(stRes.data || [])
    setVertraege(vtRes.data ? [vtRes.data] : [])
    setFeiertage(ftRes.data || [])
    setAbwesenheiten(abwRes.data || [])
    setLoading(false)
  }, [selectedMa, monat, lastDay])

  useEffect(() => { loadData() }, [loadData])

  const shiftMonth = (dir) => { const d = new Date(year, month-1+dir, 1); setMonat(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const shiftMa = (dir) => {
    const idx = mitarbeiter.findIndex(m => m.id === selectedMa)
    const next = mitarbeiter[idx + dir]
    if (next) setSelectedMa(next.id)
  }

  const vertrag = vertraege[0]
  const sollTag = vertrag ? (vertrag.wochenstunden || 40) / (vertrag.arbeitstage_pro_woche || 5) : 8
  const ma = mitarbeiter.find(m => m.id === selectedMa)
  const monatLabel = new Date(year, month-1, 15).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  // Build daily data
  const dailyData = useMemo(() => {
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    let ueberstundenKum = 0
    const rows = []

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${monat}-${String(d).padStart(2, '0')}`
      const dow = new Date(year, month - 1, d).getDay()
      const isWeekend = dow === 0 || dow === 6
      const feiertag = feiertage.find(f => f.datum === dateStr)
      const abw = abwesenheiten.find(a => a.datum <= dateStr && (a.datum_bis ? a.datum_bis >= dateStr : a.datum >= dateStr))
      const isFuture = isCurrentMonth && d > today.getDate()

      const dayStempel = stempel.filter(s => toLocalDateStr(s.zeitpunkt) === dateStr).sort((a, b) => new Date(a.zeitpunkt) - new Date(b.zeitpunkt))
      const hours = calcHours(dayStempel)
      const kommen = dayStempel.find(s => s.typ === 'kommen')
      const gehen = [...dayStempel].reverse().find(s => s.typ === 'gehen')

      let soll = 0
      let bemerkung = ''

      if (isWeekend) {
        bemerkung = ''
      } else if (feiertag) {
        bemerkung = feiertag.name
        soll = 0
      } else if (abw) {
        bemerkung = `${abw.abwesenheitsarten?.name || 'Abwesend'}`
        soll = 0
      } else if (!isFuture) {
        soll = sollTag
      }

      const tag = !isWeekend && !feiertag && !abw && !isFuture ? hours.netto - soll : 0
      if (!isWeekend && !isFuture) ueberstundenKum += tag

      rows.push({
        day: d, dateStr, dow, isWeekend, feiertag, abw, isFuture,
        kommen: kommen?.zeitpunkt, gehen: gehen?.zeitpunkt,
        pause: hours.pause, soll, ist: hours.netto, tag, ueberstunden: ueberstundenKum,
        bemerkung, kw: getKW(new Date(year, month - 1, d)),
      })
    }
    return rows
  }, [stempel, feiertage, abwesenheiten, monat, year, month, lastDay, sollTag])

  // Totals
  const totals = useMemo(() => {
    const sollTotal = dailyData.reduce((s, r) => s + r.soll, 0)
    const istTotal = dailyData.reduce((s, r) => s + r.ist, 0)
    const abwTage = dailyData.filter(r => r.abw && !r.isWeekend).length
    const feiertageTage = dailyData.filter(r => r.feiertag && !r.isWeekend).length
    return { sollTotal, istTotal, diff: istTotal - sollTotal, abwTage, feiertageTage }
  }, [dailyData])

  // Group by KW for visual separators
  let lastKW = null

  return (
    <div>
      {/* Header like W4A */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMa(-1)} className="p-1 rounded hover:bg-surface-hover text-text-muted"><ChevronLeft size={16} /></button>
          <select value={selectedMa} onChange={e => setSelectedMa(e.target.value)} className={selectCls + ' min-w-[200px] font-medium'}>
            {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.nachname} {m.vorname}</option>)}
          </select>
          <button onClick={() => shiftMa(1)} className="p-1 rounded hover:bg-surface-hover text-text-muted"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-surface-hover text-text-muted"><ChevronLeft size={16} /></button>
          <input type="month" value={monat} onChange={e => setMonat(e.target.value)} className={inputCls} />
          <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-surface-hover text-text-muted"><ChevronRight size={16} /></button>
        </div>
        {ma && <button onClick={() => navigate(`/mitarbeiter/${selectedMa}`)} className="flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink size={12} /> Stammdaten</button>}
      </div>

      {/* MA Info Header */}
      {ma && (
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-surface-card border border-border-default text-xs">
          <div><span className="text-text-muted">Mitarbeiter:</span> <span className="font-medium text-text-primary">{ma.vorname} {ma.nachname}</span></div>
          <div><span className="text-text-muted">Taktung:</span> <span className="font-medium">{ma.rundung_taktung || 5} Min</span></div>
          <div><span className="text-text-muted">Zeitraum:</span> <span className="font-medium">{monatLabel}</span></div>
          <div><span className="text-text-muted">Pers.Nr.:</span> <span className="font-medium">{ma.personalnummer || '-'}</span></div>
          <div><span className="text-text-muted">Rundung:</span> <span className="font-medium">{ma.rundung_kommen || 'Standard'}</span></div>
          <div><span className="text-text-muted">Frühester Beginn:</span> <span className="font-medium">{ma.fruehester_beginn || '-'}</span></div>
          <div><span className="text-text-muted">Pausenregel:</span> <span className="font-medium">Standard</span></div>
          <div><span className="text-text-muted">Soll/Tag:</span> <span className="font-medium">{fmtH(sollTag)}</span></div>
        </div>
      )}

      {loading ? <div className="text-sm text-text-muted py-8 text-center">Laden...</div> : (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-card text-text-secondary">
                <th className="px-2 py-2 text-left font-medium w-8"></th>
                <th className="px-2 py-2 text-left font-medium">Datum</th>
                <th className="px-3 py-2 text-right font-medium">Kommt</th>
                <th className="px-3 py-2 text-right font-medium">Geht</th>
                <th className="px-3 py-2 text-right font-medium">Pause</th>
                <th className="px-3 py-2 text-right font-medium">Soll</th>
                <th className="px-3 py-2 text-right font-medium">Ist</th>
                <th className="px-3 py-2 text-right font-medium">Tag</th>
                <th className="px-3 py-2 text-right font-medium">Ü</th>
                <th className="px-4 py-2 text-left font-medium">Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(row => {
                const showKWSep = row.kw !== lastKW && lastKW !== null
                lastKW = row.kw
                return (
                  <Fragment key={row.day}>
                    {showKWSep && <tr><td colSpan={10} className="h-1 bg-border-default" /></tr>}
                    <tr className={`${row.isWeekend ? 'bg-gray-50 text-text-muted' : row.feiertag ? 'bg-blue-50/50' : row.abw ? 'bg-amber-50/30' : row.isFuture ? 'text-text-muted' : ''} border-t border-border-default`}>
                      <td className="px-2 py-1.5 text-text-muted">{WOCHENTAGE[row.dow]}</td>
                      <td className="px-2 py-1.5 text-text-secondary font-mono">{String(row.day).padStart(2, '0')}.{String(month).padStart(2, '0')}.{year}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatTime(row.kommen)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatTime(row.gehen)}</td>
                      <td className="px-3 py-1.5 text-right text-text-muted">{row.pause > 0 ? fmtH(row.pause) : ''}</td>
                      <td className="px-3 py-1.5 text-right text-text-secondary">{row.soll > 0 ? fmtH(row.soll) : ''}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-text-primary">{row.ist > 0 ? fmtH(row.ist) : ''}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${row.tag >= 0 ? 'text-text-secondary' : 'text-red-600'}`}>
                        {!row.isWeekend && !row.isFuture && row.soll > 0 ? fmtHSigned(row.tag) : ''}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-bold ${row.ueberstunden >= 0 ? 'text-text-primary' : 'text-red-600'}`}>
                        {!row.isWeekend && !row.isFuture ? fmtHSigned(row.ueberstunden) : ''}
                      </td>
                      <td className="px-4 py-1.5 text-text-muted">{row.bemerkung}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-card border-t-2 border-border-default font-medium">
                <td colSpan={5} className="px-3 py-2 text-right text-text-secondary">Summe</td>
                <td className="px-3 py-2 text-right">{fmtH(totals.sollTotal)}</td>
                <td className="px-3 py-2 text-right font-bold text-text-primary">{fmtH(totals.istTotal)}</td>
                <td className={`px-3 py-2 text-right font-bold ${totals.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtHSigned(totals.diff)}</td>
                <td />
                <td className="px-4 py-2 text-xs text-text-muted">
                  {totals.abwTage > 0 && `${totals.abwTage} Abw.`}
                  {totals.feiertageTage > 0 && ` ${totals.feiertageTage} Feiert.`}
                </td>
              </tr>
            </tfoot>
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

      <div className="flex gap-1 mb-6 border-b border-border-default">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}>
              <Icon size={16} /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'tagesuebersicht' && <TagesuebersichtTab />}
      {activeTab === 'stempel' && <StempelProtokollTab />}
      {activeTab === 'abwesenheiten' && <AbwesenheitenTab />}
      {activeTab === 'zeitkarte' && <ZeitkarteTab />}
    </div>
  )
}
