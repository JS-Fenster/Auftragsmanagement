import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, Plus, History, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { searchKontakte } from '../pages/budgetangebot/KundenSuche'

export default function TerminForm() {
  const [open, setOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [historie, setHistorie] = useState([])
  const [stornoGrund, setStornoGrund] = useState('')
  const [showStorno, setShowStorno] = useState(false)

  const [artId, setArtId] = useState('')
  const [titel, setTitel] = useState('')
  const [startDatum, setStartDatum] = useState('')
  const [startZeit, setStartZeit] = useState('08:00')
  const [endDatum, setEndDatum] = useState('')
  const [endZeit, setEndZeit] = useState('09:00')
  const [ganztaegig, setGanztaegig] = useState(false)
  const [fahrzeugId, setFahrzeugId] = useState('')
  const [selectedMonteure, setSelectedMonteure] = useState([])
  const [kontaktId, setKontaktId] = useState(null)
  const [kontaktName, setKontaktName] = useState('')
  const [projektId, setProjektId] = useState(null)
  const [status, setStatus] = useState('geplant')
  const [notizen, setNotizen] = useState('')

  const [terminArten, setTerminArten] = useState([])
  const [fahrzeuge, setFahrzeuge] = useState([])
  const [monteure, setMonteure] = useState([])
  const [kontaktSuche, setKontaktSuche] = useState('')
  const [kontaktResults, setKontaktResults] = useState([])
  const [showKontaktDD, setShowKontaktDD] = useState(false)
  const [projektSuche, setProjektSuche] = useState('')
  const [projektResults, setProjektResults] = useState([])
  const [showProjektDD, setShowProjektDD] = useState(false)
  const timerRef = useRef(null)
  const kontaktDDRef = useRef(null)
  const projektDDRef = useRef(null)
  const justSelectedRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const [a, f, m] = await Promise.all([
        supabase.from('termin_arten').select('*').eq('aktiv', true).order('sort_order'),
        supabase.from('ressourcen').select('*').eq('typ', 'fahrzeug').eq('aktiv', true).order('sort_order'),
        supabase.from('ressourcen').select('*').eq('typ', 'monteur').eq('aktiv', true).or('gruppe.eq.monteur,gruppe.is.null').order('sort_order'),
      ])
      if (a.data) setTerminArten(a.data)
      if (f.data) setFahrzeuge(f.data)
      if (m.data) setMonteure(m.data)
    }
    load()
  }, [])

  const reset = useCallback(() => {
    setArtId(''); setTitel(''); setStartDatum(''); setStartZeit('08:00')
    setEndDatum(''); setEndZeit('09:00'); setGanztaegig(false)
    setFahrzeugId(''); setSelectedMonteure([]); setKontaktId(null)
    setKontaktName(''); setKontaktSuche(''); setProjektId(null)
    setProjektSuche(''); setStatus('geplant'); setNotizen('')
    setEditMode(false); setEditId(null); setHistorie([]); setStornoGrund(''); setShowStorno(false)
  }, [])

  useEffect(() => {
    const onCreate = (e) => {
      reset()
      const { start, startTime, end, endTime, resourceId } = e.detail || {}
      const s = start || startTime
      const en = end || endTime
      if (s) {
        const d = new Date(s)
        setStartDatum(d.toISOString().slice(0, 10))
        setStartZeit(d.toTimeString().slice(0, 5))
      }
      if (en) {
        const d = new Date(en)
        setEndDatum(d.toISOString().slice(0, 10))
        setEndZeit(d.toTimeString().slice(0, 5))
      } else if (s) {
        setEndDatum(new Date(s).toISOString().slice(0, 10))
      }
      if (resourceId) setFahrzeugId(resourceId)
      setOpen(true)
    }
    const onEdit = (e) => {
      const { termin: t } = e.detail || {}
      if (!t) return
      reset()
      setEditMode(true)
      setEditId(t.id)
      setArtId(t.art_id || '')
      setTitel(t.titel || '')
      setStatus(t.status || 'geplant')
      setNotizen(t.notizen || '')
      setGanztaegig(t.ganztaegig || false)
      if (t.start_zeit) {
        const s = new Date(t.start_zeit)
        setStartDatum(s.toISOString().slice(0, 10))
        setStartZeit(s.toTimeString().slice(0, 5))
      }
      if (t.end_zeit) {
        const d = new Date(t.end_zeit)
        setEndDatum(d.toISOString().slice(0, 10))
        setEndZeit(d.toTimeString().slice(0, 5))
      }
      if (t.kontakte) {
        setKontaktId(t.kontakt_id)
        const kName = t.kontakte.firma1
          || (() => {
            const hp = t.kontakte.kontakt_personen?.find(p => p.ist_hauptkontakt) || t.kontakte.kontakt_personen?.[0]
            return hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : 'Unbekannt'
          })()
        setKontaktName(kName)
        setKontaktSuche(kName)
      }
      if (t.projekte) {
        setProjektId(t.projekt_id)
        setProjektSuche(t.projekte.projekt_nummer || '')
      }
      const fzg = t.termin_ressourcen?.find(r => r.ressourcen?.typ === 'fahrzeug')
      if (fzg) setFahrzeugId(fzg.ressourcen.id)
      const monts = t.termin_ressourcen?.filter(r => r.ressourcen?.typ === 'monteur') || []
      setSelectedMonteure(monts.map(m => m.ressourcen.id))
      setOpen(true)
      // Load historie
      if (t.id) {
        supabase.from('termin_historie').select('*').eq('termin_id', t.id)
          .order('created_at', { ascending: false }).limit(10)
          .then(({ data }) => setHistorie(data || []))
      }
    }
    window.addEventListener('termin-create-open', onCreate)
    window.addEventListener('termin-edit-open', onEdit)
    return () => {
      window.removeEventListener('termin-create-open', onCreate)
      window.removeEventListener('termin-edit-open', onEdit)
    }
  }, [reset])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (kontaktDDRef.current && !kontaktDDRef.current.contains(e.target)) setShowKontaktDD(false)
      if (projektDDRef.current && !projektDDRef.current.contains(e.target)) setShowProjektDD(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Kontakt search debounced — reuses searchKontakte from KundenSuche
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // Skip search immediately after selection (prevents dropdown from reopening)
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    if (!kontaktSuche || kontaktSuche.length < 2) { setKontaktResults([]); return }
    timerRef.current = setTimeout(async () => {
      const results = await searchKontakte(kontaktSuche)
      // Map to format used by this component
      setKontaktResults(results.map(r => ({
        id: r.kontakt_id,
        firma1: r.firma,
        firma2: r.firma2,
        ort: r.ort,
        display_name: r.display_name,
        kontakt_personen: r.personen.map(p => ({ vorname: p.vorname, nachname: p.nachname })),
      })))
      setShowKontaktDD(true)
    }, 300)
  }, [kontaktSuche])

  // Projekt search debounced
  useEffect(() => {
    if (!projektSuche || projektSuche.length < 2) { setProjektResults([]); return }
    const tm = setTimeout(async () => {
      const { data } = await supabase
        .from('projekte')
        .select('id, projekt_nummer, kontakte!projekte_kontakt_id_fkey(firma1)')
        .ilike('projekt_nummer', `%${projektSuche}%`)
        .limit(8)
      setProjektResults(data || [])
      setShowProjektDD(true)
    }, 300)
    return () => clearTimeout(tm)
  }, [projektSuche])

  const toggleMonteur = (id) => {
    setSelectedMonteure(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id])
  }

  // Monteur availability check (for ALL monteure, not just selected)
  const [monteurStatus, setMonteurStatus] = useState({}) // { monteurId: 'frei' | 'belegt' | 'teilweise' }

  useEffect(() => {
    if (!startDatum || !startZeit || monteure.length === 0) {
      setMonteurStatus({})
      return
    }
    const sISO = ganztaegig ? `${startDatum}T00:00:00` : `${startDatum}T${startZeit}:00`
    const eISO = ganztaegig ? `${endDatum || startDatum}T23:59:59` : `${endDatum || startDatum}T${endZeit}:00`

    const check = async () => {
      const allMonteurIds = monteure.map(m => m.id)
      const { data } = await supabase
        .from('termin_ressourcen')
        .select('ressource_id, termine!inner(id, start_zeit, end_zeit, status)')
        .in('ressource_id', allMonteurIds)
        .lt('termine.start_zeit', eISO)
        .gt('termine.end_zeit', sISO)
        .neq('termine.status', 'abgesagt')

      const status = {}
      for (const m of monteure) {
        const hits = (data || []).filter(d => d.ressource_id === m.id && d.termine && (!editId || d.termine.id !== editId))
        status[m.id] = hits.length > 0 ? 'belegt' : 'frei'
      }
      setMonteurStatus(status)
    }
    const tm = setTimeout(check, 400)
    return () => clearTimeout(tm)
  }, [startDatum, startZeit, endDatum, endZeit, ganztaegig, monteure, editId])

  // Overlap check state (for selected monteure — blocks save)
  const [overlaps, setOverlaps] = useState([])
  const [overlapConfirmed, setOverlapConfirmed] = useState(false)

  // Check for overlaps when monteure or time changes
  useEffect(() => {
    if (selectedMonteure.length === 0 || !startDatum || !startZeit) {
      setOverlaps([])
      return
    }
    const sISO = ganztaegig ? `${startDatum}T00:00:00` : `${startDatum}T${startZeit}:00`
    const eISO = ganztaegig ? `${endDatum || startDatum}T23:59:59` : `${endDatum || startDatum}T${endZeit}:00`

    const check = async () => {
      // Find termine that overlap with our time range AND have any of our monteure assigned
      const { data } = await supabase
        .from('termin_ressourcen')
        .select('ressource_id, termine!inner(id, titel, start_zeit, end_zeit, status)')
        .in('ressource_id', selectedMonteure)
        .lt('termine.start_zeit', eISO)
        .gt('termine.end_zeit', sISO)
        .neq('termine.status', 'abgesagt')

      if (!data) { setOverlaps([]); return }
      // Filter out current termin if editing
      const filtered = editId ? data.filter(d => d.termine?.id !== editId) : data
      // Map to readable format
      const monteurNames = new Map(monteure.map(m => [m.id, m.name]))
      const hits = filtered
        .filter(d => d.termine)
        .map(d => ({
          monteur: monteurNames.get(d.ressource_id) || d.ressource_id,
          termin: d.termine.titel,
          zeit: `${new Date(d.termine.start_zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}–${new Date(d.termine.end_zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
        }))
      setOverlaps(hits)
      setOverlapConfirmed(false)
    }
    const tm = setTimeout(check, 500)
    return () => clearTimeout(tm)
  }, [selectedMonteure, startDatum, startZeit, endDatum, endZeit, ganztaegig, editId, monteure])

  const handleSave = async () => {
    if (!artId || !titel || !startDatum) return

    // Block save if overlaps exist and not confirmed
    if (overlaps.length > 0 && !overlapConfirmed) return

    setSaving(true)

    const sISO = ganztaegig
      ? `${startDatum}T00:00:00`
      : `${startDatum}T${startZeit}:00`
    const eISO = ganztaegig
      ? `${endDatum || startDatum}T23:59:59`
      : `${endDatum || startDatum}T${endZeit}:00`

    const td = {
      art_id: artId, titel,
      start_zeit: sISO, end_zeit: eISO, ganztaegig,
      kontakt_id: kontaktId || null,
      projekt_id: projektId || null,
      status, notizen: notizen || null,
      bearbeitet_von: 'Dashboard', // TODO: replace with actual user (AS, RH, Jess, etc.)
    }

    let tId = editId
    if (editMode && editId) {
      const { error } = await supabase.from('termine').update(td).eq('id', editId)
      if (error) { console.error(error); setSaving(false); return }
      await supabase.from('termin_ressourcen').delete().eq('termin_id', editId)
    } else {
      const { data, error } = await supabase.from('termine').insert(td).select('id').single()
      if (error) { console.error(error); setSaving(false); return }
      tId = data.id
    }

    const asgn = []
    if (fahrzeugId) asgn.push({ termin_id: tId, ressource_id: fahrzeugId, rolle: 'fahrzeug' })
    selectedMonteure.forEach(mId => asgn.push({ termin_id: tId, ressource_id: mId, rolle: 'monteur' }))
    if (asgn.length) {
      const { error } = await supabase.from('termin_ressourcen').insert(asgn)
      if (error) console.error('Ressourcen-Zuweisung:', error)
    }

    setSaving(false)
    setOpen(false)
    setOverlaps([])
    setOverlapConfirmed(false)
    window.dispatchEvent(new CustomEvent('termin-saved'))
    window.dispatchEvent(new CustomEvent('termin-detail-close'))
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-surface-card rounded-xl shadow-2xl border border-border-default w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-default">
            <h2 className="text-lg font-semibold text-text-primary">
              {editMode ? 'Termin bearbeiten' : 'Neuer Termin'}
            </h2>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-4 space-y-4">
            {/* Termin-Art */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Termin-Art *</label>
              <div className="flex flex-wrap gap-2">
                {terminArten.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setArtId(a.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    style={artId === a.id
                      ? { backgroundColor: a.farbe + '20', borderColor: a.farbe, color: a.farbe }
                      : { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.farbe }} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Titel */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Titel *</label>
              <input
                type="text" value={titel} onChange={e => setTitel(e.target.value)}
                placeholder="z.B. Fenster-Montage Mueller"
                className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary focus:ring-2 focus:ring-[var(--brand)] outline-none"
              />
            </div>

            {/* Datum/Zeit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Start</label>
                <input type="date" value={startDatum}
                  onChange={e => { setStartDatum(e.target.value); if (!endDatum) setEndDatum(e.target.value) }}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
                />
                {!ganztaegig && (
                  <input type="time" value={startZeit} onChange={e => setStartZeit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary mt-1 outline-none"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Ende</label>
                <input type="date" value={endDatum} onChange={e => setEndDatum(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
                />
                {!ganztaegig && (
                  <input type="time" value={endZeit} onChange={e => setEndZeit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary mt-1 outline-none"
                  />
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ganztaegig} onChange={e => setGanztaegig(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--brand)]" />
              <span className="text-sm text-text-secondary">Ganztaegig</span>
            </label>

            {/* Fahrzeug */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Fahrzeug</label>
              <select value={fahrzeugId} onChange={e => setFahrzeugId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none">
                <option value="">-- Kein Fahrzeug --</option>
                {fahrzeuge.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Monteure Chips with availability */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                Monteure
                {Object.keys(monteurStatus).length > 0 && (
                  <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-text-muted">
                    (Verfuegbarkeit fuer {startZeit}–{endZeit})
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {monteure.map(m => {
                  const sel = selectedMonteure.includes(m.id)
                  const status = monteurStatus[m.id]
                  const isBelegt = status === 'belegt'

                  // Border color: selected=monteur color, belegt=red, frei=green, unknown=default
                  let borderColor = 'var(--border-default)'
                  let ringStyle = {}
                  if (sel) {
                    borderColor = m.farbe
                  } else if (status === 'belegt') {
                    borderColor = '#EF4444'
                    ringStyle = { boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.3)' }
                  } else if (status === 'frei') {
                    borderColor = '#10B981'
                    ringStyle = { boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }
                  }

                  return (
                    <button key={m.id} onClick={() => toggleMonteur(m.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all relative"
                      style={{
                        backgroundColor: sel ? m.farbe + '20' : isBelegt ? '#FEE2E220' : 'transparent',
                        borderColor,
                        color: sel ? m.farbe : isBelegt ? '#991B1B' : 'var(--text-secondary)',
                        ...ringStyle,
                      }}
                      title={isBelegt ? `${m.name} ist zur gewaehlten Zeit belegt` : status === 'frei' ? `${m.name} ist frei` : m.name}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: sel ? m.farbe : isBelegt ? '#EF4444' : status === 'frei' ? '#10B981' : '#D1D5DB' }}>
                        {m.kuerzel || m.name?.charAt(0)}
                      </span>
                      {m.name}
                      {isBelegt && !sel && (
                        <span className="text-[9px] text-red-500 font-semibold ml-0.5">belegt</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Kontakt-Suche */}
            <div className="relative" ref={kontaktDDRef}>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Kunde / Kontakt</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="text" value={kontaktSuche}
                  onChange={e => { setKontaktSuche(e.target.value); setKontaktId(null) }}
                  onFocus={() => kontaktResults.length > 0 && setShowKontaktDD(true)}
                  placeholder="Firma oder Name suchen..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
                />
                {kontaktId && (
                  <button onClick={() => { setKontaktId(null); setKontaktName(''); setKontaktSuche('') }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-hover rounded">
                    <X className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                )}
              </div>
              {showKontaktDD && kontaktResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {kontaktResults.map(k => {
                    const hp = k.kontakt_personen?.find(p => p.ist_hauptkontakt) || k.kontakt_personen?.[0]
                    const firma = k.firma1 || k.firma2
                    const person = hp ? [hp.vorname, hp.nachname].filter(Boolean).join(' ') : null
                    const displayName = firma || person || 'Unbekannt'
                    const subtitle = firma && person ? person : k.ort || null
                    return (
                      <button key={k.id}
                        onClick={() => { justSelectedRef.current = true; setKontaktId(k.id); setKontaktName(displayName); setKontaktSuche(displayName); setKontaktResults([]); setShowKontaktDD(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover">
                        <div className="font-medium text-text-primary">{displayName}</div>
                        {subtitle && <div className="text-xs text-text-muted">{subtitle}{firma && person && k.ort ? ` · ${k.ort}` : ''}</div>}
                      </button>
                    )
                  })}
                </div>
              )}
              {kontaktId && <div className="mt-1 text-xs text-green-600">Ausgewaehlt: {kontaktName}</div>}
            </div>

            {/* Projekt-Suche */}
            <div className="relative" ref={projektDDRef}>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Projekt (optional)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="text" value={projektSuche}
                  onChange={e => { setProjektSuche(e.target.value); setProjektId(null) }}
                  onFocus={() => projektResults.length > 0 && setShowProjektDD(true)}
                  placeholder="Projekt-Nr suchen..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
                />
              </div>
              {showProjektDD && projektResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {projektResults.map(p => (
                    <button key={p.id}
                      onClick={() => { setProjektId(p.id); setProjektSuche(p.projekt_nummer); setShowProjektDD(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover">
                      <span className="font-medium text-text-primary">{p.projekt_nummer}</span>
                      {p.kontakte?.firma1 && <span className="text-text-muted ml-2">{p.kontakte.firma1}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none">
                <option value="geplant">Geplant</option>
                <option value="bestaetigt">Bestaetigt</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
            </div>

            {/* Notizen */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Notizen</label>
              <textarea value={notizen} onChange={e => setNotizen(e.target.value)} rows={3}
                placeholder="Optionale Hinweise..."
                className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none resize-none"
              />
            </div>
            {/* Quick Actions (edit mode only) */}
            {editMode && (
              <div className="flex gap-2">
                {status !== 'abgeschlossen' && (
                  <button type="button"
                    onClick={async () => {
                      const { error } = await supabase.from('termine').update({ status: 'abgeschlossen', bearbeitet_von: 'Dashboard' }).eq('id', editId)
                      if (!error) { setOpen(false); window.dispatchEvent(new CustomEvent('termin-saved')) }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Abschliessen
                  </button>
                )}
                {status !== 'abgesagt' && !showStorno && (
                  <button type="button" onClick={() => setShowStorno(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />
                    Absagen
                  </button>
                )}
              </div>
            )}

            {/* Storno reason */}
            {showStorno && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                <p className="text-xs font-medium text-red-800">Storno-Grund (optional):</p>
                <textarea value={stornoGrund} onChange={e => setStornoGrund(e.target.value)} rows={2}
                  placeholder="Warum wird der Termin abgesagt?"
                  className="w-full px-2 py-1 text-xs border border-red-200 rounded bg-white text-text-primary outline-none resize-none" />
                <div className="flex gap-2">
                  <button type="button"
                    onClick={async () => {
                      const upd = { status: 'abgesagt', bearbeitet_von: 'Dashboard' }
                      if (stornoGrund) upd.storno_grund = stornoGrund
                      const { error } = await supabase.from('termine').update(upd).eq('id', editId)
                      if (!error) { setOpen(false); setShowStorno(false); window.dispatchEvent(new CustomEvent('termin-saved')) }
                    }}
                    className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">
                    Termin absagen
                  </button>
                  <button type="button" onClick={() => setShowStorno(false)}
                    className="px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover rounded">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Verlauf (edit mode only) */}
            {editMode && historie.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                  <History className="w-3.5 h-3.5" />
                  Verlauf
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {historie.map(h => {
                    const labels = { erstellt: 'Erstellt', bearbeitet: 'Bearbeitet', verschoben: 'Verschoben', storniert: 'Storniert', bestaetigt: 'Bestaetigt', abgeschlossen: 'Abgeschlossen' }
                    const zeit = new Date(h.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={h.id} className="text-[10px] text-text-muted">
                        <span className="font-medium text-text-secondary">{labels[h.aktion] || h.aktion}</span>
                        {h.erstellt_von && <span className="ml-1">von {h.erstellt_von}</span>}
                        <span className="ml-1">{zeit}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Overlap Warning */}
          {overlaps.length > 0 && (
            <div className="mx-4 mb-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-800 mb-1">Ueberschneidung erkannt!</p>
              <ul className="text-xs text-red-700 space-y-0.5 mb-2">
                {overlaps.map((o, i) => (
                  <li key={i}>{o.monteur}: {o.termin} ({o.zeit})</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overlapConfirmed}
                  onChange={e => setOverlapConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-600" />
                <span className="text-xs text-red-700 font-medium">Trotzdem anlegen (Doppelbelegung bestaetigen)</span>
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border-default">
            <button onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
              Abbrechen
            </button>
            <button onClick={handleSave}
              disabled={saving || !artId || !titel || !startDatum || (overlaps.length > 0 && !overlapConfirmed)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
              {saving
                ? <span className="w-4 h-4 border-2 border-[#1f2937] border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-4 h-4" />
              }
              {editMode ? 'Speichern' : 'Termin erstellen'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
