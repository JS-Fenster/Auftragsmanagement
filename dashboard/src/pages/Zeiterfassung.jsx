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
  // Keys match DB slugs — 5 Grundfarben + Rahmen fuer Varianten
  // Blau = Urlaub
  urlaub_ganz:       { bg: '#DBEAFE', text: '#1E40AF', short: 'U' },
  urlaub_halbtag_vm: { bg: '#DBEAFE', text: '#1E40AF', short: 'U' },
  urlaub_halbtag_nm: { bg: '#DBEAFE', text: '#1E40AF', short: 'U' },
  // Rot = Krankheit
  krankheit:         { bg: '#FEE2E2', text: '#991B1B', short: 'K' },
  krankheit_ohne_au: { bg: '#FEE2E2', text: '#991B1B', short: 'K', dashed: true },
  kind_krank:        { bg: '#FEE2E2', text: '#991B1B', short: 'KK' },
  // Lila = Elternzeit / Mutterschutz
  elternzeit:        { bg: '#EDE9FE', text: '#5B21B6', short: 'EZ' },
  mutterschutz:      { bg: '#EDE9FE', text: '#5B21B6', short: 'MS', dashed: true },
  // Amber = Sonder- / Bildungsurlaub
  sonderurlaub:      { bg: '#FEF3C7', text: '#92400E', short: 'SU' },
  bildungsurlaub:    { bg: '#FEF3C7', text: '#92400E', short: 'BU', dashed: true },
  // Grau = Sonstiges (Freistellung, Unbezahlt, Kurzarbeit, Ueberstunden)
  freistellung:              { bg: '#F3F4F6', text: '#374151', short: 'FS' },
  unbezahlter_urlaub:        { bg: '#F3F4F6', text: '#374151', short: 'UB' },
  kurzarbeit:                { bg: '#F3F4F6', text: '#374151', short: 'KA', dashed: true },
  ueberstunden_ausgleich:    { bg: '#F3F4F6', text: '#374151', short: 'ÜA' },
  ueberstunden_halbtag_vm:   { bg: '#F3F4F6', text: '#374151', short: 'ÜA' },
  ueberstunden_halbtag_nm:   { bg: '#F3F4F6', text: '#374151', short: 'ÜA' },
  // Gruen = Feiertag (½F dashed wird separat im Rendering behandelt)
  feiertag: { bg: '#DCFCE7', text: '#166534', short: 'F' },
}
// Urlaub-Slugs for vacation stats calculation
const URLAUB_SLUGS = ['urlaub_ganz', 'urlaub_halbtag_vm', 'urlaub_halbtag_nm']

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

// ─── AZM helpers (pattern from MonteurAuslastung.jsx) ───
const AZM_DAY_KEYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

function getActiveAZM(azModelle, ressourceId, dateStr) {
  if (!ressourceId) return null
  return azModelle.find(m =>
    m.ressource_id === ressourceId &&
    m.gueltig_ab <= dateStr &&
    (!m.gueltig_bis || m.gueltig_bis >= dateStr)
  ) || null
}

function getAzmStunden(azm, dow) {
  if (!azm) return null
  const dayConfig = azm[AZM_DAY_KEYS[dow]]
  if (!dayConfig) return 0
  const [sh, sm] = dayConfig.start.split(':').map(Number)
  const [eh, em] = dayConfig.ende.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

function isFreierTag(azModelle, ressourceId, dateStr, dow) {
  if (dow === 0 || dow === 6) return true
  const azm = getActiveAZM(azModelle, ressourceId, dateStr)
  if (!azm) return false // no AZM = fallback to only Sa/So
  return !azm[AZM_DAY_KEYS[dow]]
}

function isHalbtagSlug(slug) {
  return slug?.endsWith('_vm') || slug?.endsWith('_nm')
}

function getHalbtagSeite(slug) {
  if (slug?.endsWith('_vm')) return 'vm'
  if (slug?.endsWith('_nm')) return 'nm'
  return null
}

const selectCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
const inputCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"

// ─── Shared MA hook ───
function useMitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      supabase.from('mitarbeiter').select('id, vorname, nachname, status, rolle, ressource_id').eq('status', 'aktiv').order('nachname'),
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

const SORT_PRESETS = {
  gf_first: { label: 'GF zuerst', order: { 'Geschäftsführung': 1, 'Büro / Verwaltung': 2, 'Montage': 3 } },
  montage_first: { label: 'Montage zuerst', order: { 'Montage': 1, 'Büro / Verwaltung': 2, 'Geschäftsführung': 3 } },
  buero_first: { label: 'Büro zuerst', order: { 'Büro / Verwaltung': 1, 'Geschäftsführung': 2, 'Montage': 3 } },
}

function groupByRolle(mitarbeiter, sortPreset = 'gf_first') {
  const groups = {}
  const presetOrder = SORT_PRESETS[sortPreset]?.order || SORT_PRESETS.gf_first.order
  for (const ma of mitarbeiter) {
    const grp = ROLLE_GRUPPEN[ma.rolle] || { label: ma.rolle, order: 99 }
    if (!groups[grp.label]) groups[grp.label] = { label: grp.label, order: presetOrder[grp.label] || 99, items: [] }
    groups[grp.label].items.push(ma)
  }
  return Object.values(groups).sort((a, b) => a.order - b.order)
}

// ═══════════════════════════════════════════════════════════════════
// Tagesuebersicht
// ═══════════════════════════════════════════════════════════════════
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(iv) }, [])
  return (
    <div className="text-right">
      <div className="text-3xl font-bold font-mono text-text-primary tracking-tight">
        {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-xs text-text-muted">{time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
  )
}

function TagesuebersichtTab() {
  const navigate = useNavigate()
  const { mitarbeiter, loading: maLoading } = useMitarbeiter()
  const [datum, setDatum] = useState(toLocalDateStr(new Date()))
  const [stempel, setStempel] = useState([])
  const [loading, setLoading] = useState(true)
  const [stamping, setStamping] = useState(null)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const [sortPreset, setSortPreset] = useState(() => localStorage.getItem('zeiterfassung_sort') || 'gf_first')
  const isToday = datum === toLocalDateStr(new Date())

  const handleSortChange = (preset) => { setSortPreset(preset); localStorage.setItem('zeiterfassung_sort', preset) }

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
    if (status === 'nicht_gestempelt' || status === 'ausgestempelt') return { typ: 'kommen', label: 'Einstempeln', color: '#065F46', bg: '#ECFDF5', border: '#10B981' }
    if (status === 'aktiv') return { typ: 'gehen', label: 'Ausstempeln', color: '#991B1B', bg: '#FEE2E2', border: '#EF4444' }
    if (status === 'pause') return { typ: 'pause_ende', label: 'Weiter', color: '#065F46', bg: '#ECFDF5', border: '#10B981' }
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
    aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv', dot: '#10B981', border: '#10B981', avatarBg: '#D1FAE5' },
    pause: { bg: '#FEF3C7', text: '#92400E', label: 'Pause', dot: '#F59E0B', border: '#F59E0B', avatarBg: '#FEF3C7' },
    ausgestempelt: { bg: '#FEE2E2', text: '#991B1B', label: 'Feierabend', dot: '#EF4444', border: '#EF4444', avatarBg: '#FECACA' },
    nicht_gestempelt: { bg: '#F9FAFB', text: '#6B7280', label: 'Nicht gestempelt', dot: '#9CA3AF', border: '#E5E7EB', avatarBg: '#F3F4F6' },
  }

  if (maLoading) return <div className="text-sm text-text-muted py-8 text-center">Laden...</div>

  const counts = { aktiv: 0, pause: 0, ausgestempelt: 0, nicht_gestempelt: 0 }
  maStatus.forEach(m => counts[m.status]++)
  const grouped = groupByRolle(maStatus, sortPreset)

  return (
    <div>
      {/* Header: Date nav + Live clock */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={18} /></button>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inputCls} />
          <button onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={18} /></button>
          <button onClick={() => setDatum(toLocalDateStr(new Date()))} className="text-xs text-brand hover:underline ml-2">Heute</button>
        </div>
        {isToday && <LiveClock />}
        {!isToday && <span className="text-sm text-text-muted">{formatDate(datum + 'T12:00:00')}</span>}
      </div>

      {/* KPI chips + view toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-3">
          {Object.entries(statusStyles).map(([key, style]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.dot }} /> {style.label}: {counts[key]}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select value={sortPreset} onChange={e => handleSortChange(e.target.value)}
            className="text-xs border border-border-default rounded-lg px-2 py-1 bg-surface-card text-text-secondary outline-none">
            {Object.entries(SORT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex gap-1 bg-surface-card border border-border-default rounded-lg p-0.5">
            <button onClick={() => setViewMode('cards')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'cards' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Karten</button>
            <button onClick={() => setViewMode('table')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'table' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Tabelle</button>
          </div>
        </div>
      </div>

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {grouped.map(grp => (
            <div key={grp.label}>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3 pb-2 border-b-2 border-border-default">{grp.label}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {grp.items.map(ma => {
                  const st = statusStyles[ma.status]
                  const kommen = ma.stempel.find(s => s.typ === 'kommen')
                  const gehen = [...ma.stempel].reverse().find(s => s.typ === 'gehen')
                  const nextAction = getNextAction(ma.status)
                  const initials = (ma.vorname?.[0] || '') + (ma.nachname?.[0] || '')

                  return (
                    <div key={ma.id}
                      className="rounded-xl border-2 p-4 transition-all hover:shadow-md"
                      style={{ borderColor: st.border, backgroundColor: st.bg + '40' }}>
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ backgroundColor: st.avatarBg, color: st.text, border: `2px solid ${st.border}` }}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => navigate(`/mitarbeiter/${ma.id}`)}
                            className="font-semibold text-sm text-text-primary hover:text-brand truncate block">
                            {ma.nachname}
                          </button>
                          <div className="text-xs text-text-muted">{ma.vorname}</div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.dot }} />
                        <span className="text-xs font-medium" style={{ color: st.text }}>{st.label}</span>
                      </div>

                      {/* Times */}
                      {(kommen || gehen) && (
                        <div className="flex items-center gap-3 mb-3 text-xs">
                          {kommen && <span className="flex items-center gap-1 text-green-700"><LogIn size={11} /> {formatTime(kommen.zeitpunkt)}</span>}
                          {gehen && <span className="flex items-center gap-1 text-red-700"><LogOut size={11} /> {formatTime(gehen.zeitpunkt)}</span>}
                          {ma.hours.netto > 0 && <span className="text-text-muted font-mono">{fmtH(ma.hours.netto)}</span>}
                        </div>
                      )}

                      {/* Action buttons */}
                      {isToday && nextAction && (
                        <div className="flex gap-2">
                          <button onClick={() => handleStempel(ma.id, nextAction.typ)} disabled={stamping === ma.id}
                            className="flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                            style={{ color: nextAction.color, backgroundColor: nextAction.bg, borderColor: nextAction.border }}>
                            {stamping === ma.id ? '...' : nextAction.label}
                          </button>
                          {ma.status === 'aktiv' && (
                            <button onClick={() => handleStempel(ma.id, 'pause_start')} disabled={stamping === ma.id}
                              className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-2 border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                              <Coffee size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View (compact fallback) */}
      {viewMode === 'table' && (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-card text-text-secondary text-xs">
                <th className="text-left px-4 py-2.5 font-medium">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Kommen</th>
                <th className="text-left px-4 py-2.5 font-medium">Gehen</th>
                <th className="text-right px-4 py-2.5 font-medium">Netto</th>
                {isToday && <th className="text-center px-4 py-2.5 font-medium">Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.map(grp => (
                <Fragment key={grp.label}>
                  <tr><td colSpan={isToday ? 6 : 5} className="px-4 py-2 text-xs font-bold text-text-secondary uppercase tracking-widest bg-surface-card border-t-2 border-border-default">{grp.label}</td></tr>
                  {grp.items.map(ma => {
                    const st = statusStyles[ma.status]
                    const kommen = ma.stempel.find(s => s.typ === 'kommen')
                    const gehen = [...ma.stempel].reverse().find(s => s.typ === 'gehen')
                    const nextAction = getNextAction(ma.status)
                    return (
                      <tr key={ma.id} className="border-t border-border-default hover:bg-surface-hover/50">
                        <td className="px-4 py-2.5 font-medium text-text-primary">{ma.vorname} {ma.nachname}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary">{formatTime(kommen?.zeitpunkt)}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{formatTime(gehen?.zeitpunkt)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-text-primary">{fmtH(ma.hours.netto)}</td>
                        {isToday && nextAction && (
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => handleStempel(ma.id, nextAction.typ)} disabled={stamping === ma.id}
                              className="px-3 py-1 text-xs font-medium rounded-lg border disabled:opacity-50"
                              style={{ color: nextAction.color, backgroundColor: nextAction.bg, borderColor: nextAction.border }}>
                              {stamping === ma.id ? '...' : nextAction.label}
                            </button>
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
      )}
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
  const [filterAbt, setFilterAbt] = useState('')
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
    let q = supabase.from('zeitstempel').select('*, mitarbeiter(vorname, nachname, rolle)')
      .gte('zeitpunkt', `${datumVon}T00:00:00`).lte('zeitpunkt', `${datumBis}T23:59:59`)
      .order('zeitpunkt', { ascending: false }).limit(200)
    if (filterMa) q = q.eq('mitarbeiter_id', filterMa)
    if (filterAbt) {
      const abtMaIds = mitarbeiter.filter(m => m.rolle === filterAbt).map(m => m.id)
      if (abtMaIds.length > 0) q = q.in('mitarbeiter_id', abtMaIds)
    }
    const { data } = await q
    setStempel(data || [])
    setLoading(false)
  }, [datumVon, datumBis, filterMa, filterAbt, mitarbeiter])

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
        <select value={filterAbt} onChange={e => setFilterAbt(e.target.value)} className={selectCls}>
          <option value="">Alle Abteilungen</option>
          <option value="geschaeftsfuehrung">Geschäftsführung</option>
          <option value="buero">Büro / Verwaltung</option>
          <option value="monteur">Montage</option>
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
  const [feiertage, setFeiertage] = useState([])
  const [arbeitszeitmodelle, setArbeitszeitmodelle] = useState([])
  // Drag selection for absence entry
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [showAbwModal, setShowAbwModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [abwArten, setAbwArten] = useState([])
  const [modalArtId, setModalArtId] = useState('')
  const [modalNotiz, setModalNotiz] = useState('')
  const [modalSaving, setModalSaving] = useState(false)

  const calcRange = (start, end, ressourceId) => {
    if (!start) return []
    const e2 = end || start
    const [s, e] = start <= e2 ? [start, e2] : [e2, start]
    const dates = []
    const d = new Date(s + 'T12:00:00')
    const last = new Date(e + 'T12:00:00')
    while (d <= last) {
      const dow = d.getDay()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      if (!isFreierTag(arbeitszeitmodelle, ressourceId, dateStr, dow)) {
        dates.push(dateStr)
      }
      d.setDate(d.getDate() + 1)
    }
    return dates
  }
  const maRessourceId = mitarbeiter.find(m => m.id === selectedMa)?.ressource_id
  const selectionRange = calcRange(dragStart, dragEnd, maRessourceId)


  // Load abwesenheitsarten for modal
  useEffect(() => {
    supabase.from('abwesenheitsarten').select('*').eq('aktiv', true).order('sort_order').then(({ data }) => setAbwArten(data || []))
  }, [])

  const handleModalSave = async () => {
    if (!modalArtId || selectionRange.length === 0 || !selectedMa) return
    setModalSaving(true)
    const { data: ma } = await supabase.from('mitarbeiter').select('ressource_id').eq('id', selectedMa).single()
    const art = abwArten.find(a => a.id === modalArtId)
    if (!ma?.ressource_id) { setModalSaving(false); return }
    const rows = selectionRange.map(datum => ({
      mitarbeiter_id: selectedMa,
      ressource_id: ma.ressource_id,
      abwesenheitsart_id: modalArtId,
      datum,
      bis_datum: selectionRange[selectionRange.length - 1],
      typ: art?.kategorie === 'krankheit' ? 'krank' : art?.kategorie === 'urlaub' ? 'urlaub' : 'sonstiges',
      ganztaegig: true,
      status: 'beantragt',
      notiz: modalNotiz || null,
    }))
    const { error } = await supabase.from('abwesenheiten').insert(rows)
    if (error) { console.error('Abwesenheit speichern fehlgeschlagen:', error); setModalSaving(false); return }
    setModalSaving(false)
    setShowAbwModal(false)
    setDragStart(null)
    setDragEnd(null)
    setModalArtId('')
    setModalNotiz('')
    await loadData()
    setRefreshKey(k => k + 1)
  }

  const closeModal = () => {
    setShowAbwModal(false)
    setDragStart(null)
    setDragEnd(null)
    setModalArtId('')
    setModalNotiz('')
  }

  const [year, month] = monat.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const days = Array.from({ length: lastDay }, (_, i) => i + 1)
  const todayStr = toLocalDateStr(new Date())

  const loadData = useCallback(async () => {
    setLoading(true)
    const [abwRes, kontenRes, ftRes, azmRes] = await Promise.all([
      supabase.from('abwesenheiten').select('*, abwesenheitsarten(name, slug, farbe)')
        .neq('status', 'storniert').neq('status', 'abgelehnt')
        .lte('datum', `${year}-12-31`)
        .or(`bis_datum.gte.${year}-01-01,bis_datum.is.null`),
      supabase.from('arbeitsvertraege').select('mitarbeiter_id, urlaubstage_jahr').eq('ist_aktuell', true),
      supabase.from('feiertage').select('datum, name, halbtag').gte('datum', `${year}-01-01`).lte('datum', `${year}-12-31`),
      supabase.from('arbeitszeitmodelle').select('*'),
    ])
    setAbwesenheiten(abwRes.data || [])
    setUrlaubskonten(kontenRes.data || [])
    setFeiertage(ftRes.data || [])
    setArbeitszeitmodelle(azmRes.data || [])
    setLoading(false)
  }, [monat, lastDay, year])

  useEffect(() => { loadData() }, [loadData])

  const shiftMonth = (dir) => { const d = new Date(year, month-1+dir, 1); setMonat(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }

  const getAbwForDay = (maId, day) => {
    const dateStr = `${monat}-${String(day).padStart(2, '0')}`
    return abwesenheiten.find(a => a.mitarbeiter_id === maId && a.datum <= dateStr && (a.bis_datum ? a.bis_datum >= dateStr : a.datum >= dateStr))
  }
  const getAllAbwForDay = (maId, day) => {
    const dateStr = `${monat}-${String(day).padStart(2, '0')}`
    return abwesenheiten.filter(a => a.mitarbeiter_id === maId && a.datum <= dateStr && (a.bis_datum ? a.bis_datum >= dateStr : a.datum >= dateStr))
  }

  const countWorkdays = (a, ressourceId) => {
    const von = new Date(a.datum + 'T00:00:00'); const bis = new Date((a.bis_datum || a.datum) + 'T00:00:00')
    let cnt = 0; const d = new Date(von)
    while (d <= bis) {
      const dow = d.getDay()
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!isFreierTag(arbeitszeitmodelle, ressourceId, dateStr, dow)) cnt++
      d.setDate(d.getDate()+1)
    }
    return cnt
  }

  const getUrlaubStats = (maId) => {
    const vertrag = urlaubskonten.find(v => v.mitarbeiter_id === maId)
    const anspruch = vertrag?.urlaubstage_jahr || 30
    const maResId = mitarbeiter.find(m => m.id === maId)?.ressource_id
    const urlaubEintraege = abwesenheiten.filter(a => a.mitarbeiter_id === maId && URLAUB_SLUGS.includes(a.abwesenheitsarten?.slug))
    const genommen = urlaubEintraege.filter(a => a.status === 'genehmigt').reduce((sum, a) => sum + countWorkdays(a, maResId), 0)
    const beantragt = urlaubEintraege.filter(a => a.status === 'beantragt').reduce((sum, a) => sum + countWorkdays(a, maResId), 0)
    return { anspruch, genommen, beantragt, rest: anspruch - genommen - beantragt }
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
        {ansicht === 'einzel' && (
          <>
            <select value={selectedMa} onChange={e => setSelectedMa(e.target.value)} className={selectCls + ' min-w-[200px] ml-4'}>
              <option value="">Mitarbeiter wählen...</option>
              {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
            </select>
            {selectedMa && <button onClick={() => navigate(`/mitarbeiter/${selectedMa}`)} className="flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink size={12} /> Stammdaten</button>}
          </>
        )}
      </div>

      {ansicht === 'gruppe' && !loading && (
        <div className="rounded-lg border border-border-default overflow-x-auto">
          <table className="text-xs border-collapse w-max">
            <thead>
              <tr className="bg-surface-card text-text-secondary border-b-2 border-border-default">
                <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-surface-card z-10 min-w-[150px]">Mitarbeiter</th>
                <th className="px-2 py-2.5 text-center font-semibold text-[10px] sticky left-[150px] bg-surface-card z-10">Ansp.</th>
                <th className="px-2 py-2.5 text-center font-semibold text-[10px] sticky left-[190px] bg-surface-card z-10">Gen.</th>
                <th className="px-2 py-2.5 text-center font-semibold text-[10px] text-amber-600 sticky left-[225px] bg-surface-card z-10">Bean.</th>
                <th className="px-2 py-2.5 text-center font-semibold text-[10px] text-brand sticky left-[265px] bg-surface-card z-10">Rest</th>
                {Object.entries(kwMap).map(([kw, kwDays]) => (
                  <th key={kw} colSpan={kwDays.length} className="text-center px-0 py-1.5 font-semibold text-[10px] border-l-2 border-border-default">KW {kw}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold">Tage</th>
              </tr>
              <tr className="bg-surface-card text-text-muted text-[10px] border-b border-border-default">
                <th className="sticky left-0 bg-surface-card z-10" />
                <th className="sticky left-[150px] bg-surface-card z-10" />
                <th className="sticky left-[190px] bg-surface-card z-10" />
                <th className="sticky left-[225px] bg-surface-card z-10" />
                <th className="sticky left-[265px] bg-surface-card z-10" />
                {days.map(d => {
                  const dow = new Date(year, month-1, d).getDay()
                  const isWeekend = dow === 0 || dow === 6
                  const dateStr = `${monat}-${String(d).padStart(2, '0')}`
                  const isToday = dateStr === todayStr
                  const ft = feiertage.find(f => f.datum === dateStr)
                  return (
                    <th key={d} className={`px-0 py-1 text-center min-w-[32px] w-8 ${isWeekend ? 'bg-gray-200/60' : ft ? 'bg-blue-100/60' : ''} ${isToday ? 'ring-2 ring-brand ring-inset rounded' : ''}`}
                      title={ft ? ft.name : isWeekend ? 'Wochenende' : ''}>
                      <span className={isToday ? 'font-bold text-brand' : ''}>{d}</span>
                    </th>
                  )
                })}
                <th />
              </tr>
            </thead>
            <tbody>
              {grouped.map(grp => {
                let rowIdx = 0
                return (
                <Fragment key={grp.label}>
                  <tr>
                    <td colSpan={5 + days.length + 1} className="px-3 py-2 text-[11px] font-bold text-text-primary uppercase tracking-widest bg-surface-card border-t-2 border-b border-border-default sticky left-0 z-10">
                      {grp.label}
                    </td>
                  </tr>
                  {grp.items.map(ma => {
                    let totalDays = 0
                    const stats = getUrlaubStats(ma.id)
                    const isEven = rowIdx++ % 2 === 0
                    const rowBg = isEven ? 'bg-white' : 'bg-gray-50/50'
                    return (
                      <tr key={ma.id} className={`border-t border-border-default hover:bg-brand/5 transition-colors ${rowBg}`}>
                        <td className={`px-3 py-2 font-medium text-text-primary sticky left-0 z-10 ${rowBg}`}>
                          <button onClick={() => { setSelectedMa(selectedMa === ma.id ? '' : ma.id); setAnsicht('einzel') }} className="hover:text-brand">{ma.nachname} {ma.vorname}</button>
                        </td>
                        <td className={`px-2 py-2 text-center text-text-secondary sticky left-[150px] z-10 ${rowBg}`}>{stats.anspruch}</td>
                        <td className={`px-2 py-2 text-center text-text-secondary sticky left-[190px] z-10 ${rowBg}`}>{stats.genommen || '-'}</td>
                        <td className={`px-2 py-2 text-center text-amber-600 sticky left-[225px] z-10 ${rowBg}`}>{stats.beantragt || '-'}</td>
                        <td className={`px-2 py-2 text-center font-bold text-brand sticky left-[265px] z-10 ${rowBg}`}>{stats.rest}</td>
                        {days.map(d => {
                          const dow = new Date(year, month-1, d).getDay()
                          const dateStr = `${monat}-${String(d).padStart(2, '0')}`
                          const isFrei = isFreierTag(arbeitszeitmodelle, ma.ressource_id, dateStr, dow)
                          const isToday = dateStr === todayStr
                          const ft = feiertage.find(f => f.datum === dateStr)
                          const dayAbws = getAllAbwForDay(ma.id, d)
                          const abw = dayAbws[0]
                          if (abw && !isFrei) totalDays++
                          const kuerzel = abw?.abwesenheitsarten?.slug?.toLowerCase() || ''
                          const style = ABW_COLORS[kuerzel] || (abw ? { bg: '#E5E7EB', text: '#374151', short: '?' } : null)
                          const anyHalbtagGrp = dayAbws.some(a => isHalbtagSlug(a.abwesenheitsarten?.slug))
                          const hasMultipleGrp = dayAbws.length > 1 || ft?.halbtag || anyHalbtagGrp
                          const abwTooltip = abw ? `${abw.abwesenheitsarten?.name || 'Abwesenheit'}${abw.status === 'beantragt' ? ' (beantragt)' : ''}` : ''
                          const ftTooltip = ft ? `${ft.name}${ft.halbtag ? ' (nachmittags frei)' : ''}` : ''
                          const cellTitle = abwTooltip || ftTooltip || (isFrei ? (dow === 0 || dow === 6 ? 'Wochenende' : 'Kein Arbeitstag') : '')
                          return (
                            <td key={d} className={`px-0 py-1 text-center ${isFrei ? 'bg-gray-200/40' : ft && !style ? 'bg-blue-50/60' : ''} ${isToday ? 'ring-1 ring-brand/30 ring-inset' : ''}`}
                              title={cellTitle}>
                              {hasMultipleGrp && !isFrei ? (() => {
                                let vmSlot = null, nmSlot = null
                                if (ft?.halbtag === 'nachmittag') nmSlot = { bg: '#DCFCE7', text: '#166534', short: 'F' }
                                if (ft?.halbtag === 'vormittag') vmSlot = { bg: '#DCFCE7', text: '#166534', short: 'F' }
                                dayAbws.forEach(a => {
                                  const slug = a.abwesenheitsarten?.slug || ''
                                  const s = ABW_COLORS[slug] || { bg: '#E5E7EB', text: '#374151', short: '?' }
                                  if (slug.endsWith('_vm')) vmSlot = s
                                  else if (slug.endsWith('_nm')) nmSlot = s
                                  else if (!vmSlot) vmSlot = s
                                  else nmSlot = s
                                })
                                return (
                                <span className="inline-flex w-5 h-5 text-[8px] font-bold rounded overflow-hidden">
                                  {vmSlot ? <span className="flex-1 leading-5" style={{ backgroundColor: vmSlot.bg, color: vmSlot.text }}>{vmSlot.short}</span> : <span className="flex-1 leading-5 text-text-muted">·</span>}
                                  {nmSlot ? <span className="flex-1 leading-5" style={{ backgroundColor: nmSlot.bg, color: nmSlot.text }}>{nmSlot.short}</span> : <span className="flex-1 leading-5 text-text-muted">·</span>}
                                </span>)
                              })() : style && !isFrei ? (
                                <span className={`inline-block w-5 h-5 leading-5 rounded text-[9px] font-bold ${style.dashed ? 'border border-dashed' : ''}`} style={{ backgroundColor: style.bg, color: style.text, borderColor: style.dashed ? style.text : undefined }}>{style.short}</span>
                              ) : ft && !isFrei ? (
                                <span className={`inline-block w-5 h-5 leading-5 rounded text-[9px] font-bold ${ft.halbtag ? 'border border-dashed' : ''}`} style={{ backgroundColor: '#DCFCE7', color: '#166534', borderColor: ft.halbtag ? '#166534' : undefined }}>{ft.halbtag ? '½F' : 'F'}</span>
                              ) : null}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right text-text-secondary font-medium">{totalDays || '-'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {ansicht === 'einzel' && (
        <div>
          {selectedMa ? (
            <div>
              {/* Urlaubsstatistik */}
              {(() => { const stats = getUrlaubStats(selectedMa); return (
                <div className="flex items-center gap-6 mb-4 px-1 text-xs">
                  <span className="text-text-secondary">Anspruch: <strong className="text-text-primary">{stats.anspruch}</strong></span>
                  <span className="text-text-secondary">Genommen: <strong className="text-text-primary">{stats.genommen || '-'}</strong></span>
                  <span className="text-text-secondary">Beantragt: <strong className="text-amber-600">{stats.beantragt || '-'}</strong></span>
                  <span className="text-text-secondary">Rest: <strong className="text-brand">{stats.rest}</strong></span>
                </div>
              )})()}
              {/* Year overview: 12 months */}
              {(() => { const today = new Date(); const todayDay = today.getDate(); const todayMonth = today.getMonth(); const todayYear = today.getFullYear(); return (
              <div className="rounded-lg border border-border-default overflow-x-auto mb-6">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-surface-card text-text-secondary">
                      <th className="px-2 py-2 text-left font-medium w-8"></th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className={`px-1 py-2 text-center font-medium ${year === todayYear && i === todayMonth ? 'bg-brand/5 text-brand font-semibold' : ''}`}>{new Date(year, i, 1).toLocaleDateString('de-DE', { month: 'short' })}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, row) => row + 1).map(day => {
                      const isRowToday = year === todayYear && day === todayDay
                      return (
                      <tr key={day} className="border-t border-border-default">
                        <td className={`px-2 py-1 font-mono text-right ${isRowToday ? 'bg-brand/5 text-brand font-bold' : 'text-text-muted'}`}>{day}</td>
                        {Array.from({ length: 12 }, (_, mi) => {
                          const maxDay = new Date(year, mi + 1, 0).getDate()
                          if (day > maxDay) return <td key={mi} className="bg-gray-50" />
                          const dateStr = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                          const dow = new Date(year, mi, day).getDay()
                          const selMaResId = mitarbeiter.find(m => m.id === selectedMa)?.ressource_id
                          const isFrei = isFreierTag(arbeitszeitmodelle, selMaResId, dateStr, dow)
                          const isToday = year === todayYear && mi === todayMonth && day === todayDay
                          const isColToday = year === todayYear && mi === todayMonth
                          const dayAbws = abwesenheiten.filter(a => a.mitarbeiter_id === selectedMa && a.datum <= dateStr && (a.bis_datum ? a.bis_datum >= dateStr : a.datum >= dateStr))
                          const abw = dayAbws[0]
                          const kuerzel = abw?.abwesenheitsarten?.slug?.toLowerCase() || ''
                          const style = ABW_COLORS[kuerzel] || (abw ? { bg: '#E5E7EB', text: '#374151', short: '?' } : null)
                          const ft = feiertage.find(f => f.datum === dateStr)
                          const anyHalbtag = dayAbws.some(a => isHalbtagSlug(a.abwesenheitsarten?.slug))
                          const hasMultiple = dayAbws.length > 1 || ft?.halbtag || anyHalbtag
                          // Day is fully occupied if: ganztag abw, or both vm+nm filled, or (halbtag abw + full feiertag)
                          const belegteSeiten = new Set()
                          dayAbws.forEach(a => {
                            const seite = getHalbtagSeite(a.abwesenheitsarten?.slug)
                            if (seite) belegteSeiten.add(seite)
                            else { belegteSeiten.add('vm'); belegteSeiten.add('nm') } // ganztag belegt beide
                          })
                          if (ft && !ft.halbtag) { belegteSeiten.add('vm'); belegteSeiten.add('nm') }
                          if (ft?.halbtag === 'nachmittag') belegteSeiten.add('nm')
                          if (ft?.halbtag === 'vormittag') belegteSeiten.add('vm')
                          const vollBelegt = belegteSeiten.has('vm') && belegteSeiten.has('nm')
                          const canSelect = !isFrei && !vollBelegt
                          const isSelected = selectionRange.includes(dateStr)
                          const colHighlight = isColToday && day < todayDay
                          const rowHighlight = isRowToday && mi < todayMonth
                          const crossHighlight = !isToday && !isFrei && !style && !ft && (colHighlight || rowHighlight)
                          return (
                            <td key={mi} className={`px-0 py-1 text-center select-none ${isToday ? 'ring-2 ring-brand ring-inset bg-brand/15 rounded' : ''} ${isFrei ? 'bg-gray-100 text-text-muted' : ft && !style ? 'bg-blue-50/60' : ''} ${crossHighlight ? 'bg-brand/[0.04]' : ''} ${canSelect ? 'cursor-pointer hover:bg-brand/10' : ''} ${isSelected ? 'bg-brand/20 ring-1 ring-brand/40 ring-inset' : ''}`}
                              title={(() => {
                                const parts = []
                                if (ft) parts.push(`${ft.name}${ft.halbtag ? ' (nachmittags frei)' : ''}`)
                                dayAbws.forEach(a => parts.push(`${a.abwesenheitsarten?.name || 'Abwesenheit'}${a.status === 'beantragt' ? ' (beantragt)' : ''}`))
                                return parts.join(' + ') || (canSelect ? 'Klicken um Abwesenheit einzutragen' : isFrei ? (dow === 0 || dow === 6 ? 'Wochenende' : 'Kein Arbeitstag') : '')
                              })()}
                              onClick={canSelect ? (e) => {
                                e.stopPropagation()
                                if (e.shiftKey && dragStart) {
                                  setDragEnd(dateStr)
                                } else {
                                  setDragStart(dateStr)
                                  setDragEnd(dateStr)
                                }
                                setShowAbwModal(true)
                              } : undefined}>
                              {hasMultiple ? (() => {
                                // Build slots: left = vormittag, right = nachmittag
                                let vmSlot = null, nmSlot = null
                                if (ft?.halbtag === 'nachmittag') nmSlot = { bg: '#DCFCE7', text: '#166534', short: 'F' }
                                if (ft?.halbtag === 'vormittag') vmSlot = { bg: '#DCFCE7', text: '#166534', short: 'F' }
                                dayAbws.forEach(a => {
                                  const slug = a.abwesenheitsarten?.slug || ''
                                  const s = ABW_COLORS[slug] || { bg: '#E5E7EB', text: '#374151', short: '?' }
                                  if (slug.endsWith('_vm')) vmSlot = s
                                  else if (slug.endsWith('_nm')) nmSlot = s
                                  else if (!vmSlot) vmSlot = s
                                  else nmSlot = s
                                })
                                return (
                                <span className="inline-flex w-full h-4 text-[9px] font-bold rounded overflow-hidden">
                                  {vmSlot ? <span className="flex-1 leading-4" style={{ backgroundColor: vmSlot.bg, color: vmSlot.text }}>{vmSlot.short}</span> : <span className="flex-1 leading-4 text-text-muted">·</span>}
                                  {nmSlot ? <span className="flex-1 leading-4" style={{ backgroundColor: nmSlot.bg, color: nmSlot.text }}>{nmSlot.short}</span> : <span className="flex-1 leading-4 text-text-muted">·</span>}
                                </span>)
                              })() : style ? (
                                <span className={`inline-block w-full h-4 leading-4 text-[9px] font-bold rounded ${style.dashed ? 'border border-dashed' : ''}`} style={{ backgroundColor: style.bg, color: style.text, borderColor: style.dashed ? style.text : undefined }}>{style.short}</span>
                              ) : ft && !isFrei ? (
                                <span className={`inline-block w-full h-4 leading-4 text-[9px] font-bold rounded ${ft.halbtag ? 'border border-dashed' : ''}`} style={{ backgroundColor: '#DCFCE7', color: '#166534', borderColor: ft.halbtag ? '#166534' : undefined }}>{ft.halbtag ? '½F' : 'F'}</span>
                              ) : (
                                <span className="inline-block h-4 leading-4 text-[9px] text-text-muted">{WOCHENTAGE[dow]}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )})()}

              {/* MA Abwesenheiten verwalten */}
              <div className="p-4 rounded-lg border border-border-default bg-surface-card">
                <AbwesenheitenSection key={`${selectedMa}-${refreshKey}`} mitarbeiterId={selectedMa}
                  mitarbeiterName={`${mitarbeiter.find(m => m.id === selectedMa)?.vorname || ''} ${mitarbeiter.find(m => m.id === selectedMa)?.nachname || ''}`}
                  onUpdate={() => { loadData(); setRefreshKey(k => k + 1) }} hideForm />
              </div>
            </div>
          ) : <div className="text-sm text-text-muted py-8 text-center">Mitarbeiter auswählen um Jahresübersicht anzuzeigen</div>}
        </div>
      )}

      {loading && <div className="text-xs text-text-muted text-center mt-2">Laden...</div>}

      {/* Abwesenheit-Modal */}
      {showAbwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl border border-border-default p-6 w-[400px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Abwesenheit eintragen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Zeitraum</label>
                <div className="text-sm font-medium text-text-primary">
                  {selectionRange.length > 0 && (
                    <>
                      {new Date(selectionRange[0] + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {selectionRange.length > 1 && ` – ${new Date(selectionRange[selectionRange.length - 1] + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                      <span className="text-text-muted ml-2">({selectionRange.length} Werktag{selectionRange.length !== 1 ? 'e' : ''})</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Art der Abwesenheit</label>
                <select value={modalArtId} onChange={e => setModalArtId(e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Bitte wählen...</option>
                  {abwArten.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Notiz <span className="text-text-muted">(optional)</span></label>
                <input value={modalNotiz} onChange={e => setModalNotiz(e.target.value)} placeholder="z.B. halber Tag, Grund..." className={inputCls + ' w-full'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeModal} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
              <button onClick={handleModalSave} disabled={!modalArtId || modalSaving} className="px-4 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {modalSaving ? 'Speichern...' : 'Eintragen'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [arbeitszeitmodelle, setArbeitszeitmodelle] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (mitarbeiter.length > 0 && !selectedMa) setSelectedMa(mitarbeiter[0].id) }, [mitarbeiter, selectedMa])

  const [year, month] = monat.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const maObj = mitarbeiter.find(m => m.id === selectedMa)

  const [vormonateUebertrag, setVormonateUebertrag] = useState(0)

  const loadData = useCallback(async () => {
    if (!selectedMa) return
    setLoading(true)
    const resId = maObj?.ressource_id
    // Previous months: load stempel from Jan 1 to end of previous month for carry-over
    const vormonatEnd = new Date(year, month - 1, 0) // last day of previous month
    const vormonatEndStr = vormonatEnd.getDate() > 0 ? `${year}-${String(month - 1).padStart(2, '0')}-${String(vormonatEnd.getDate()).padStart(2, '0')}` : null
    const loadVormonate = month > 1 && vormonatEndStr
      ? supabase.from('zeitstempel').select('zeitpunkt, typ').eq('mitarbeiter_id', selectedMa)
          .gte('zeitpunkt', `${year}-01-01T00:00:00`).lte('zeitpunkt', `${vormonatEndStr}T23:59:59`).order('zeitpunkt')
      : { data: [] }
    const loadVorFt = month > 1
      ? supabase.from('feiertage').select('datum, halbtag').gte('datum', `${year}-01-01`).lte('datum', vormonatEndStr)
      : { data: [] }
    const loadVorAbw = month > 1
      ? supabase.from('abwesenheiten').select('datum, bis_datum, ganztaegig, halbtag, status')
          .eq('mitarbeiter_id', selectedMa).neq('status', 'storniert').neq('status', 'abgelehnt')
          .gte('datum', `${year}-01-01`).lte('datum', vormonatEndStr)
      : { data: [] }

    const [stRes, vtRes, ftRes, abwRes, azmRes, vorStRes, vorFtRes, vorAbwRes] = await Promise.all([
      supabase.from('zeitstempel').select('*').eq('mitarbeiter_id', selectedMa)
        .gte('zeitpunkt', `${monat}-01T00:00:00`).lte('zeitpunkt', `${monat}-${lastDay}T23:59:59`).order('zeitpunkt'),
      supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', selectedMa).eq('ist_aktuell', true).single(),
      supabase.from('feiertage').select('datum, name, halbtag').gte('datum', `${monat}-01`).lte('datum', `${monat}-${lastDay}`),
      supabase.from('abwesenheiten').select('*, abwesenheitsarten(name, slug)')
        .eq('mitarbeiter_id', selectedMa).neq('status', 'storniert').neq('status', 'abgelehnt')
        .lte('datum', `${monat}-${lastDay}`).or(`bis_datum.gte.${monat}-01,bis_datum.is.null`),
      resId ? supabase.from('arbeitszeitmodelle').select('*').eq('ressource_id', resId) : { data: [] },
      loadVormonate, loadVorFt, loadVorAbw,
    ])
    setStempel(stRes.data || [])
    setVertraege(vtRes.data ? [vtRes.data] : [])
    setFeiertage(ftRes.data || [])
    setAbwesenheiten(abwRes.data || [])
    setArbeitszeitmodelle(azmRes.data || [])

    // Calculate carry-over from previous months
    if (month > 1 && vorStRes.data?.length > 0) {
      const vorStempel = vorStRes.data
      const vorFeiertage = vorFtRes.data || []
      const vorAbw = vorAbwRes.data || []
      const vt = vtRes.data
      const sollTag = vt ? (vt.wochenstunden || 40) / (vt.arbeitstage_pro_woche || 5) : 8
      const azm = azmRes.data || []

      let uebertrag = 0
      // iterate each day from Jan 1 to end of prev month
      const startDate = new Date(year, 0, 1)
      const endDate = vormonatEnd
      const d = new Date(startDate)
      while (d <= endDate) {
        const dateStr = toLocalDateStr(d)
        const dow = d.getDay()
        const isFrei = isFreierTag(azm, resId, dateStr, dow)
        const isFeiertag = vorFeiertage.some(f => f.datum === dateStr)
        const isAbw = vorAbw.some(a => a.datum <= dateStr && (a.bis_datum ? a.bis_datum >= dateStr : a.datum >= dateStr))

        if (!isFrei && !isFeiertag && !isAbw) {
          // Get stempel for this day
          const dayStempel = vorStempel.filter(s => toLocalDateStr(s.zeitpunkt) === dateStr).sort((a, b) => new Date(a.zeitpunkt) - new Date(b.zeitpunkt))
          const hours = calcHours(dayStempel)
          const azmDay = getActiveAZM(azm, resId, dateStr)
          const sollH = azmDay ? (getAzmStunden(azmDay, dow) || sollTag) : sollTag
          uebertrag += hours.netto - sollH
        }
        d.setDate(d.getDate() + 1)
      }
      setVormonateUebertrag(Math.round(uebertrag * 100) / 100)
    } else {
      setVormonateUebertrag(0)
    }

    setLoading(false)
  }, [selectedMa, monat, lastDay, maObj?.ressource_id, year, month])

  useEffect(() => { loadData() }, [loadData])

  const shiftMonth = (dir) => { const d = new Date(year, month-1+dir, 1); setMonat(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const shiftMa = (dir) => {
    const idx = mitarbeiter.findIndex(m => m.id === selectedMa)
    const next = mitarbeiter[idx + dir]
    if (next) setSelectedMa(next.id)
  }

  const vertrag = vertraege[0]
  const sollTagFallback = vertrag ? (vertrag.wochenstunden || 40) / (vertrag.arbeitstage_pro_woche || 5) : 8
  const ma = maObj
  const monatLabel = new Date(year, month-1, 15).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  // Derive Arbeitstage + Wochenstunden from AZM
  const azmHeader = useMemo(() => {
    const resId = ma?.ressource_id
    const todayStr = `${year}-${String(month).padStart(2,'0')}-01`
    const azm = getActiveAZM(arbeitszeitmodelle, resId, todayStr)
    if (!azm) return null
    const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr']
    const dayKeys = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag']
    const activeDays = dayKeys.map((k, i) => azm[k] ? dayLabels[i] : null).filter(Boolean)
    let wochenstunden = 0
    dayKeys.forEach(k => {
      const cfg = azm[k]
      if (cfg) {
        const [sh, sm] = cfg.start.split(':').map(Number)
        const [eh, em] = cfg.ende.split(':').map(Number)
        wochenstunden += (eh + em / 60) - (sh + sm / 60)
      }
    })
    // Format: consecutive = "Mo–Do", gaps = "Mo, Di, Do, Fr"
    let arbeitstageStr = ''
    if (activeDays.length === 0) {
      arbeitstageStr = '-'
    } else {
      const allDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr']
      const indices = activeDays.map(d => allDays.indexOf(d))
      const isConsecutive = indices.length > 1 && indices[indices.length - 1] - indices[0] === indices.length - 1
      arbeitstageStr = isConsecutive ? `${activeDays[0]}–${activeDays[activeDays.length - 1]}` : activeDays.join(', ')
    }
    return { arbeitstageStr, wochenstunden }
  }, [arbeitszeitmodelle, ma?.ressource_id, year, month])

  // Build daily data
  const dailyData = useMemo(() => {
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    let ueberstundenKum = 0
    const rows = []
    const resId = ma?.ressource_id

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${monat}-${String(d).padStart(2, '0')}`
      const dow = new Date(year, month - 1, d).getDay()
      const isFrei = isFreierTag(arbeitszeitmodelle, resId, dateStr, dow)
      const feiertag = feiertage.find(f => f.datum === dateStr)
      const abw = abwesenheiten.find(a => a.datum <= dateStr && (a.bis_datum ? a.bis_datum >= dateStr : a.datum >= dateStr))
      const isFuture = isCurrentMonth && d > today.getDate()

      const dayStempel = stempel.filter(s => toLocalDateStr(s.zeitpunkt) === dateStr).sort((a, b) => new Date(a.zeitpunkt) - new Date(b.zeitpunkt))
      const hours = calcHours(dayStempel)
      const kommen = dayStempel.find(s => s.typ === 'kommen')
      const gehen = [...dayStempel].reverse().find(s => s.typ === 'gehen')

      // Soll-Stunden: AZM-basiert pro Tag, Fallback auf Vertragspauschale
      const azmForDay = getActiveAZM(arbeitszeitmodelle, resId, dateStr)
      const azmStunden = azmForDay ? getAzmStunden(azmForDay, dow) : null

      let soll = 0
      let bemerkung = ''

      if (isFrei) {
        bemerkung = dow === 0 || dow === 6 ? '' : 'Kein Arbeitstag'
      } else if (feiertag) {
        bemerkung = feiertag.name
        soll = 0
      } else if (abw) {
        bemerkung = `${abw.abwesenheitsarten?.name || 'Abwesend'}`
        soll = 0
      } else if (!isFuture) {
        soll = azmStunden !== null ? azmStunden : sollTagFallback
      }

      const tag = !isFrei && !feiertag && !abw && !isFuture ? hours.netto - soll : 0
      if (!isFrei && !isFuture) ueberstundenKum += tag

      rows.push({
        day: d, dateStr, dow, isWeekend: isFrei, feiertag, abw, isFuture,
        kommen: kommen?.zeitpunkt, gehen: gehen?.zeitpunkt,
        pause: hours.pause, soll, ist: hours.netto, tag, ueberstunden: ueberstundenKum,
        bemerkung, kw: getKW(new Date(year, month - 1, d)),
      })
    }
    return rows
  }, [stempel, feiertage, abwesenheiten, arbeitszeitmodelle, monat, year, month, lastDay, sollTagFallback, ma?.ressource_id])

  // Totals
  const totals = useMemo(() => {
    const sollTotal = dailyData.reduce((s, r) => s + r.soll, 0)
    const istTotal = dailyData.reduce((s, r) => s + r.ist, 0)
    const abwTage = dailyData.filter(r => r.abw && !r.isWeekend).length
    const feiertageTage = dailyData.filter(r => r.feiertag && !r.isWeekend).length
    const tageGearbeitet = dailyData.filter(r => r.ist > 0).length
    return { sollTotal, istTotal, diff: istTotal - sollTotal, abwTage, feiertageTage, tageGearbeitet }
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
          <div><span className="text-text-muted">Wochenstunden:</span> <span className="font-medium">{azmHeader ? `${Math.round(azmHeader.wochenstunden)}h` : `${vertrag?.wochenstunden || 40}h`}</span></div>
          <div><span className="text-text-muted">Pers.Nr.:</span> <span className="font-medium">{ma.personalnummer || '-'}</span></div>
          <div><span className="text-text-muted">Rundung:</span> <span className="font-medium">{ma.rundung_kommen || 'Standard'}</span></div>
          <div><span className="text-text-muted">Arbeitstage:</span> <span className="font-medium">{azmHeader?.arbeitstageStr || 'Mo–Fr'}</span></div>
          <div><span className="text-text-muted">Frühester Beginn:</span> <span className="font-medium">{ma.fruehester_beginn || '-'}</span></div>
        </div>
      )}

      {loading ? <div className="text-sm text-text-muted py-8 text-center">Laden...</div> : (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-card text-text-secondary">
                <th className="px-1.5 py-2 text-left font-medium whitespace-nowrap"></th>
                <th className="px-1.5 py-2 text-left font-medium whitespace-nowrap">Datum</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Kommt</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Geht</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Pause</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Soll</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Ist</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap">Tag</th>
                <th className="px-1.5 py-2 text-right font-medium whitespace-nowrap" title="Überstunden kumulativ">Ü kum.</th>
                <th className="px-3 py-2 text-left font-medium w-full">Bemerkung</th>
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
                      <td className="px-1.5 py-1.5 text-text-muted whitespace-nowrap">{WOCHENTAGE[row.dow]}</td>
                      <td className="px-1.5 py-1.5 text-text-secondary font-mono whitespace-nowrap">{String(row.day).padStart(2, '0')}.{String(month).padStart(2, '0')}.{year}</td>
                      <td className="px-1.5 py-1.5 text-right font-mono whitespace-nowrap">{formatTime(row.kommen)}</td>
                      <td className="px-1.5 py-1.5 text-right font-mono whitespace-nowrap">{formatTime(row.gehen)}</td>
                      <td className="px-1.5 py-1.5 text-right text-text-muted whitespace-nowrap">{row.pause > 0 ? fmtH(row.pause) : ''}</td>
                      <td className="px-1.5 py-1.5 text-right text-text-secondary whitespace-nowrap">{row.soll > 0 ? fmtH(row.soll) : ''}</td>
                      <td className="px-1.5 py-1.5 text-right font-medium text-text-primary whitespace-nowrap">{row.ist > 0 ? fmtH(row.ist) : ''}</td>
                      <td className={`px-1.5 py-1.5 text-right font-medium whitespace-nowrap ${row.tag >= 0 ? 'text-text-secondary' : 'text-red-600'}`}>
                        {!row.isWeekend && !row.isFuture && row.soll > 0 ? fmtHSigned(row.tag) : ''}
                      </td>
                      <td className={`px-1.5 py-1.5 text-right font-bold whitespace-nowrap ${row.ueberstunden >= 0 ? 'text-text-primary' : 'text-red-600'}`}>
                        {!row.isWeekend && !row.isFuture ? fmtHSigned(row.ueberstunden) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-text-muted">{row.bemerkung}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-card border-t-2 border-border-default font-medium">
                <td colSpan={5} className="px-3 py-2 text-right text-text-secondary">Summe Monat</td>
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

          {/* Kontensalden (W4A-Style) */}
          <div className="mt-4 rounded-lg border border-border-default bg-surface-card p-4">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">Kontensalden {new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-surface-main">
                <div className="text-[10px] text-text-muted uppercase">Übertrag Vormonate</div>
                <div className={`text-lg font-bold ${vormonateUebertrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtHSigned(vormonateUebertrag)}</div>
                <div className="text-[10px] text-text-muted">01.01. – {new Date(year, month - 1, 0).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}.{year}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-main">
                <div className="text-[10px] text-text-muted uppercase">Monat {month < 10 ? '0' : ''}{month}/{year}</div>
                <div className={`text-lg font-bold ${totals.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtHSigned(totals.diff)}</div>
                <div className="text-[10px] text-text-muted">Soll {fmtH(totals.sollTotal)} / Ist {fmtH(totals.istTotal)}</div>
              </div>
              <div className="p-3 rounded-lg bg-brand/5 border border-brand/20">
                <div className="text-[10px] text-brand uppercase font-semibold">Zeitkonto Gesamt</div>
                <div className={`text-xl font-bold ${(vormonateUebertrag + totals.diff) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtHSigned(vormonateUebertrag + totals.diff)}
                </div>
                <div className="text-[10px] text-text-muted">Stand {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-main">
                <div className="text-[10px] text-text-muted uppercase">Details</div>
                <div className="text-xs text-text-secondary space-y-0.5 mt-1">
                  {totals.abwTage > 0 && <div>Abwesenheit: {totals.abwTage} Tage</div>}
                  {totals.feiertageTage > 0 && <div>Feiertage: {totals.feiertageTage} Tage</div>}
                  <div>Arbeitstage: {totals.tageGearbeitet}</div>
                </div>
              </div>
            </div>
          </div>
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
