import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TerminForm() {
  const [open, setOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    const load = async () => {
      const [a, f, m] = await Promise.all([
        supabase.from('termin_arten').select('*').eq('aktiv', true).order('sort_order'),
        supabase.from('ressourcen').select('*').eq('typ', 'fahrzeug').eq('aktiv', true).order('sort_order'),
        supabase.from('ressourcen').select('*').eq('typ', 'monteur').eq('aktiv', true).order('sort_order'),
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
    setEditMode(false); setEditId(null)
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
        setKontaktName(t.kontakte.firma1 || '')
        setKontaktSuche(t.kontakte.firma1 || '')
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
    }
    window.addEventListener('termin-create-open', onCreate)
    window.addEventListener('termin-edit-open', onEdit)
    return () => {
      window.removeEventListener('termin-create-open', onCreate)
      window.removeEventListener('termin-edit-open', onEdit)
    }
  }, [reset])

  // Kontakt search debounced
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!kontaktSuche || kontaktSuche.length < 2) { setKontaktResults([]); return }
    timerRef.current = setTimeout(async () => {
      const t = kontaktSuche.replace(/'/g, '')
      const { data } = await supabase
        .from('kontakte')
        .select('id, firma1, firma2, ort, kontakt_personen(vorname, nachname, ist_hauptkontakt)')
        .or(`firma1.ilike.%${t}%,firma2.ilike.%${t}%`)
        .limit(8)
      setKontaktResults(data || [])
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

  const handleSave = async () => {
    if (!artId || !titel || !startDatum) return
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

            {/* Monteure Chips */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Monteure</label>
              <div className="flex flex-wrap gap-2">
                {monteure.map(m => {
                  const sel = selectedMonteure.includes(m.id)
                  return (
                    <button key={m.id} onClick={() => toggleMonteur(m.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={sel
                        ? { backgroundColor: m.farbe + '20', borderColor: m.farbe, color: m.farbe }
                        : { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
                      }
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: sel ? m.farbe : '#D1D5DB' }}>
                        {m.kuerzel || m.name?.charAt(0)}
                      </span>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Kontakt-Suche */}
            <div className="relative">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Kunde / Kontakt</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="text" value={kontaktSuche}
                  onChange={e => { setKontaktSuche(e.target.value); setKontaktId(null) }}
                  onFocus={() => kontaktResults.length > 0 && setShowKontaktDD(true)}
                  placeholder="Firma oder Name suchen..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
                />
              </div>
              {showKontaktDD && kontaktResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {kontaktResults.map(k => {
                    const hp = k.kontakt_personen?.find(p => p.ist_hauptkontakt) || k.kontakt_personen?.[0]
                    const d = k.firma1 || [hp?.vorname, hp?.nachname].filter(Boolean).join(' ') || 'Unbekannt'
                    return (
                      <button key={k.id}
                        onClick={() => { setKontaktId(k.id); setKontaktName(d); setKontaktSuche(d); setShowKontaktDD(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover">
                        <div className="font-medium text-text-primary">{d}</div>
                        {k.ort && <div className="text-xs text-text-muted">{k.ort}</div>}
                      </button>
                    )
                  })}
                </div>
              )}
              {kontaktId && <div className="mt-1 text-xs text-green-600">Ausgewaehlt: {kontaktName}</div>}
            </div>

            {/* Projekt-Suche */}
            <div className="relative">
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
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border-default">
            <button onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
              Abbrechen
            </button>
            <button onClick={handleSave} disabled={saving || !artId || !titel || !startDatum}
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
