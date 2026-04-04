/**
 * MitarbeiterDetail — Eigene Seite pro Mitarbeiter mit Tabs
 * Route: /mitarbeiter/:id
 *
 * Datenmodell (neu):
 *   personen (vorname, nachname, anrede, geburtsdatum, zeichen, foto_url, notizen)
 *   mitarbeiter_daten (person_id, personalnummer, beschaeftigungsart, abteilung, funktion, ...)
 *   person_kontaktdaten (person_id, typ, wert, label, ist_primaer)
 *   person_adressen (person_id, typ, strasse, plz, ort, land, ist_primaer)
 *
 * Legacy tables (arbeitsvertraege, mitarbeiter_skills, abwesenheiten) still use mitarbeiter_id (old table).
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, FileText, Calendar, Shield, Briefcase, CreditCard, Phone, MapPin, Wrench, X, Plus, Trash2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

// HARDCODE: Spaeter aus DB/Einstellungen — Backlog AM-149
const ABTEILUNG_LABELS = {
  monteur: 'Montage', buero: 'Verwaltung', geschaeftsfuehrung: 'Geschäftsführung',
  lager: 'Lager', vertrieb: 'Vertrieb',
}
// HARDCODE: Spaeter aus DB/Einstellungen — Backlog AM-149
const BESCHAEFTIGUNGSART_OPTIONS = {
  vollzeit: 'Vollzeit', teilzeit: 'Teilzeit', minijob: 'Minijob',
  azubi: 'Azubi', praktikant: 'Praktikant', werkstudent: 'Werkstudent',
}
// OK: Steuerklassen 1-6 sind gesetzlich fest
const STEUERKLASSE_OPTIONS = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' }
// OK: Konfessionen sind fest (ev/rk/keine)
const KONFESSION_OPTIONS = { ev: 'Evangelisch', rk: 'Römisch-Katholisch', keine: 'Keine' }
// HARDCODE: Spaeter aus DB (DISTINCT oder eigene Tabelle) — Backlog AM-149
const SKILL_PRESETS = ['Fenster', 'Türen', 'Raffstore', 'Markise', 'Haustür', 'Reparatur', 'Service', 'Rollläden', 'Elektro', 'Glas']
// HARDCODE: Spaeter aus DB/Einstellungen — Backlog AM-149
const SKILL_LEVELS = { lehrling: 'Lehrling', junior: 'Junior', standard: 'Standard', senior: 'Senior', meister: 'Meister' }
// OK: Design-Tokens (Layout-Farben)
const SKILL_LEVEL_COLORS = {
  lehrling: '#F3F4F6', junior: '#DBEAFE', standard: '#D1FAE5', senior: '#FDE68A', meister: '#C4B5FD',
}
const STATUS_STYLES = {
  aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv' },
  inaktiv: { bg: '#FEF3C7', text: '#92400E', label: 'Inaktiv' },
  ausgeschieden: { bg: '#F3F4F6', text: '#374151', label: 'Ausgeschieden' },
  gekuendigt: { bg: '#FEE2E2', text: '#991B1B', label: 'Gekündigt' },
}
const TABS = [
  { key: 'stamm', label: 'Stammdaten', icon: User },
  { key: 'vertrag', label: 'Vertrag & Arbeitszeit', icon: Briefcase },
  { key: 'skills', label: 'Skills & Qualifikationen', icon: Wrench },
  { key: 'personal', label: 'Persönliches & Finanzen', icon: CreditCard },
]

const KONTAKT_TYP_OPTIONS = {
  telefon_fest: 'Telefon (Festnetz)',
  telefon_mobil: 'Telefon (Mobil)',
  email: 'E-Mail',
  whatsapp: 'WhatsApp',
  fax: 'Fax',
  sonstiges: 'Sonstiges',
}

const ADRESS_TYP_OPTIONS = {
  privat: 'Privat',
  arbeit: 'Arbeit',
  lieferung: 'Lieferadresse',
  rechnungsadresse: 'Rechnungsadresse',
}

const inputCls = "w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none focus:ring-2 focus:ring-brand/30"
const labelCls = "block text-xs font-medium text-text-secondary mb-1"

function formatDate(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

let fieldIdCounter = 0
function Field({ label, value, type = 'text', onChange, options, placeholder, disabled, suggestions }) {
  const [listId] = useState(() => `dl-${++fieldIdCounter}`)
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} disabled={disabled}>
          <option value="">—</option>
          {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      ) : (
        <>
          <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} className={inputCls} disabled={disabled}
            list={suggestions?.length ? listId : undefined} />
          {suggestions?.length > 0 && (
            <datalist id={listId}>
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          )}
        </>
      )}
    </div>
  )
}

const WOCHENTAGE = [
  { key: 'mo', label: 'Mo' }, { key: 'di', label: 'Di' }, { key: 'mi', label: 'Mi' },
  { key: 'do', label: 'Do' }, { key: 'fr', label: 'Fr' },
]
const DEFAULT_TAG = { start: '07:00', ende: '16:00' }

function calcBruttoTag(tag) {
  if (!tag) return 0
  const [sh, sm] = tag.start.split(':').map(Number)
  const [eh, em] = tag.ende.split(':').map(Number)
  return (eh + em / 60) - (sh + sm / 60)
}

// HARDCODE: Pausenregel gesetzlich (>6h=30min, >9h=45min). Spaeter aus mitarbeiter_daten.pausenregel — Backlog AM-155
function calcPause(brutto) {
  if (brutto > 9) return 0.75
  if (brutto > 6) return 0.5
  return 0
}

function formatStunden(dezimal) {
  const h = Math.floor(dezimal)
  const m = Math.round((dezimal - h) * 60)
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} h` : `${h} h`
}

function calcWochenstunden(tagesarbeitszeit, mitPause = true) {
  if (!tagesarbeitszeit) return 0
  return WOCHENTAGE.reduce((sum, { key }) => {
    const tag = tagesarbeitszeit[key]
    if (!tag) return sum
    let brutto = calcBruttoTag(tag)
    if (mitPause) brutto -= calcPause(brutto)
    return sum + brutto
  }, 0)
}

function countArbeitstage(tagesarbeitszeit) {
  if (!tagesarbeitszeit) return 0
  return WOCHENTAGE.filter(({ key }) => tagesarbeitszeit[key]).length
}

function VertragDetail({ az }) {
  if (!az) return <p className="text-[10px] text-text-muted mt-2">Keine Tageszeiten hinterlegt</p>
  return (
    <div className="grid grid-cols-5 gap-2 mt-2">
      {WOCHENTAGE.map(({ key, label }) => {
        const tag = az[key]
        return (
          <div key={key} className={`rounded-lg border p-2 text-center text-[10px] ${tag ? 'border-brand/20 bg-brand/5' : 'border-border-default bg-surface-card opacity-50'}`}>
            <div className={`font-bold ${tag ? 'text-brand' : 'text-text-muted'}`}>{label}</div>
            {tag ? (
              <>
                <div className="text-text-secondary mt-1">{tag.start} – {tag.ende}</div>
                <div className="text-text-muted">{(() => { const b = calcBruttoTag(tag); const p = calcPause(b); return p > 0 ? `${formatStunden(b - p)} netto` : formatStunden(b) })()}</div>
              </>
            ) : (
              <div className="text-text-muted mt-1">frei</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function VertragSection({ mitarbeiterId, editing }) {
  const [vertraege, setVertraege] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [expandedVertragId, setExpandedVertragId] = useState(null)
  const [form, setForm] = useState({
    gueltig_ab: '', urlaubstage_jahr: '30', notiz: '',
    tagesarbeitszeit: { mo: { ...DEFAULT_TAG }, di: { ...DEFAULT_TAG }, mi: { ...DEFAULT_TAG }, do: { ...DEFAULT_TAG }, fr: { ...DEFAULT_TAG } },
  })

  const loadVertraege = useCallback(async () => {
    const { data } = await supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', mitarbeiterId).order('gueltig_ab', { ascending: false })
    setVertraege(data || [])
  }, [mitarbeiterId])

  useEffect(() => { loadVertraege() }, [loadVertraege])

  const setTag = (key, field, value) => {
    setForm(f => ({
      ...f,
      tagesarbeitszeit: { ...f.tagesarbeitszeit, [key]: f.tagesarbeitszeit[key] ? { ...f.tagesarbeitszeit[key], [field]: value } : { start: '07:00', ende: '16:00', [field]: value } }
    }))
  }
  const toggleTag = (key) => {
    setForm(f => ({
      ...f,
      tagesarbeitszeit: { ...f.tagesarbeitszeit, [key]: f.tagesarbeitszeit[key] ? null : { ...DEFAULT_TAG } }
    }))
  }

  const wochenstundenNetto = calcWochenstunden(form.tagesarbeitszeit, true)
  const wochenstundenBrutto = calcWochenstunden(form.tagesarbeitszeit, false)
  const wochenstunden = wochenstundenNetto
  const arbeitstage = countArbeitstage(form.tagesarbeitszeit)

  const hasOverlap = form.gueltig_ab && vertraege.some(v => {
    if (!v.gueltig_bis) return false
    return form.gueltig_ab <= v.gueltig_bis && (!form.gueltig_bis || form.gueltig_bis >= v.gueltig_ab)
  })

  const save = async () => {
    const latestVertrag = vertraege[0]
    if (latestVertrag && form.gueltig_ab <= latestVertrag.gueltig_ab) {
      alert('Neue Periode muss nach der letzten beginnen (' + formatDate(latestVertrag.gueltig_ab) + ')')
      return
    }
    if (hasOverlap) {
      if (!confirm('Achtung: Diese Periode überschneidet sich mit einer bestehenden. Trotzdem anlegen?')) return
    }
    const openVertrag = vertraege.find(v => !v.gueltig_bis)
    if (openVertrag && form.gueltig_ab) {
      const bisDate = new Date(form.gueltig_ab + 'T00:00:00')
      bisDate.setDate(bisDate.getDate() - 1)
      await supabase.from('arbeitsvertraege').update({ gueltig_bis: bisDate.toISOString().slice(0, 10) }).eq('id', openVertrag.id)
    }

    await supabase.from('arbeitsvertraege').insert({
      mitarbeiter_id: mitarbeiterId, gueltig_ab: form.gueltig_ab,
      wochenstunden: Math.round(wochenstunden * 10) / 10,
      arbeitstage_pro_woche: arbeitstage,
      urlaubstage_jahr: parseInt(form.urlaubstage_jahr),
      tagesarbeitszeit: form.tagesarbeitszeit,
      notiz: form.notiz || null,
    })
    setShowForm(false)
    loadVertraege()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Arbeitsverträge</h3>
        {editing && (
          <button onClick={() => {
            const current = vertraege.find(v => !v.gueltig_bis) || vertraege[0]
            if (current) {
              setForm({
                gueltig_ab: '',
                urlaubstage_jahr: String(current.urlaubstage_jahr || 30),
                notiz: '',
                tagesarbeitszeit: current.tagesarbeitszeit || { mo: {...DEFAULT_TAG}, di: {...DEFAULT_TAG}, mi: {...DEFAULT_TAG}, do: {...DEFAULT_TAG}, fr: {...DEFAULT_TAG} },
              })
            }
            setShowForm(!showForm)
          }} className="text-xs text-brand hover:underline">+ Neue Periode</button>
        )}
      </div>

      {showForm && (
        <div className="p-4 rounded-lg bg-surface-main border border-border-default space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Gueltig ab *" value={form.gueltig_ab} type="date" onChange={v => setForm(f => ({ ...f, gueltig_ab: v }))} />
            <Field label="Urlaubstage/Jahr" value={form.urlaubstage_jahr} type="number" onChange={v => setForm(f => ({ ...f, urlaubstage_jahr: v }))} />
            <div className="flex items-end pb-1">
              <div className="text-xs text-text-muted">
                <span className="font-semibold text-text-primary">{formatStunden(wochenstundenNetto)} netto</span>
                {' '}({formatStunden(wochenstundenBrutto)} brutto) / Woche · {arbeitstage} Tage
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Arbeitszeiten pro Tag</label>
            <div className="grid grid-cols-5 gap-2">
              {WOCHENTAGE.map(({ key, label }) => {
                const tag = form.tagesarbeitszeit[key]
                const aktiv = !!tag
                return (
                  <div key={key} className={`rounded-lg border p-2 text-center transition-colors ${aktiv ? 'border-brand/30 bg-brand/5' : 'border-border-default bg-surface-card opacity-50'}`}>
                    <button onClick={() => toggleTag(key)} className="w-full">
                      <span className={`text-xs font-bold ${aktiv ? 'text-brand' : 'text-text-muted'}`}>{label}</span>
                    </button>
                    {aktiv && (
                      <div className="mt-2 space-y-1">
                        <input type="time" value={tag.start} onChange={e => setTag(key, 'start', e.target.value)}
                          className="w-full px-1 py-0.5 text-[11px] border border-border-default rounded bg-surface-card text-center outline-none" />
                        <input type="time" value={tag.ende} onChange={e => setTag(key, 'ende', e.target.value)}
                          className="w-full px-1 py-0.5 text-[11px] border border-border-default rounded bg-surface-card text-center outline-none" />
                        <div className="text-[10px] text-text-muted">
                          {(() => { const b = calcBruttoTag(tag); const p = calcPause(b); const n = b - p; return p > 0 ? `${formatStunden(n)} (${formatStunden(b)} brutto)` : formatStunden(b) })()}
                        </div>
                      </div>
                    )}
                    {!aktiv && <div className="mt-2 text-[10px] text-text-muted">frei</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={!form.gueltig_ab} className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg disabled:opacity-50">Speichern</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      {vertraege.map(v => {
        const az = v.tagesarbeitszeit
        return (
          <div key={v.id} className="p-3 rounded-lg bg-surface-main border border-border-default text-xs space-y-2 cursor-pointer hover:border-brand/30 transition-colors"
            onClick={() => setExpandedVertragId(expandedVertragId === v.id ? null : v.id)}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{formatStunden(v.wochenstunden)}/Woche</span>
                <span className="text-text-muted ml-2">{v.arbeitstage_pro_woche} Tage</span>
                <span className="text-text-muted ml-2">{v.urlaubstage_jahr} Urlaubstage</span>
              </div>
              <div className="text-text-muted">
                {formatDate(v.gueltig_ab)} – {v.gueltig_bis ? formatDate(v.gueltig_bis) : 'heute'}
                {!v.gueltig_bis && <span className="ml-1 text-emerald-600 font-medium">aktuell</span>}
              </div>
            </div>
            {expandedVertragId === v.id ? (
              <VertragDetail az={az} />
            ) : az && (
              <div className="flex gap-1">
                {WOCHENTAGE.map(({ key, label }) => {
                  const tag = az[key]
                  return (
                    <span key={key} className={`px-1.5 py-0.5 rounded text-[10px] ${tag ? 'bg-brand/10 text-brand font-medium' : 'bg-surface-card text-text-muted'}`}>
                      {label}{tag ? ` ${tag.start}–${tag.ende}` : ' frei'}
                    </span>
                  )
                })}
              </div>
            )}
            {v.notiz && <div className="text-text-muted">{v.notiz}</div>}
          </div>
        )
      })}
    </div>
  )
}

function UrlaubSection({ mitarbeiterId }) {
  const [konto, setKonto] = useState(null)
  const jahr = new Date().getFullYear()
  useEffect(() => {
    supabase.rpc('berechne_urlaubskonto', { p_mitarbeiter_id: mitarbeiterId, p_jahr: jahr })
      .then(({ data }) => { if (data?.[0]) setKonto(data[0]) })
  }, [mitarbeiterId, jahr])

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Urlaubskonto {jahr}</h3>
      {!konto ? <p className="text-xs text-text-muted">Wird berechnet...</p> : (
        <div className="grid grid-cols-4 gap-3">
          {[['Anspruch', konto.anspruch], ['Uebertrag', konto.uebertrag], ['Genommen', konto.genommen], ['Rest', konto.rest]].map(([l, v], i) => (
            <div key={i} className={`rounded-lg p-3 text-center ${i === 3 ? 'bg-brand/5 border border-brand/20' : 'bg-surface-main'}`}>
              <p className={`text-xs ${i === 3 ? 'text-brand' : 'text-text-muted'}`}>{l}</p>
              <p className={`text-xl font-bold ${i === 3 ? 'text-brand' : 'text-text-primary'}`}>{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillsSection({ mitarbeiterId, editing }) {
  const [skills, setSkills] = useState([])
  const [adding, setAdding] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [newLevel, setNewLevel] = useState('standard')

  const loadSkills = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_skills').select('*').eq('mitarbeiter_id', mitarbeiterId).order('skill')
    setSkills(data || [])
  }, [mitarbeiterId])

  useEffect(() => { loadSkills() }, [loadSkills])

  const addSkill = async () => {
    if (!newSkill.trim()) return
    await supabase.from('mitarbeiter_skills').insert({ mitarbeiter_id: mitarbeiterId, skill: newSkill.trim(), level: newLevel })
    setNewSkill('')
    setNewLevel('standard')
    setAdding(false)
    loadSkills()
  }

  const removeSkill = async (skillId) => {
    await supabase.from('mitarbeiter_skills').delete().eq('id', skillId)
    loadSkills()
  }

  const updateLevel = async (skillId, level) => {
    await supabase.from('mitarbeiter_skills').update({ level }).eq('id', skillId)
    loadSkills()
  }

  const availablePresets = SKILL_PRESETS.filter(s => !skills.some(sk => sk.skill === s))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-text-muted" /> Faehigkeiten
        </h3>
        {editing && (
          <button onClick={() => setAdding(!adding)} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Skill hinzufuegen
          </button>
        )}
      </div>
      {adding && editing && (
        <div className="flex items-end gap-2 p-3 rounded-lg bg-surface-main border border-border-default">
          <div className="flex-1">
            <label className={labelCls}>Skill</label>
            <input list="skill-presets" value={newSkill} onChange={e => setNewSkill(e.target.value)}
              placeholder="Skill eingeben..." className={inputCls} />
            <datalist id="skill-presets">
              {availablePresets.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Level</label>
            <select value={newLevel} onChange={e => setNewLevel(e.target.value)} className={inputCls}>
              {Object.entries(SKILL_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={addSkill} disabled={!newSkill.trim()} className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg disabled:opacity-50">Hinzufuegen</button>
          <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {skills.length === 0 && <p className="text-xs text-text-muted">Keine Skills hinterlegt</p>}
        {skills.map(sk => (
          <div key={sk.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-default text-xs">
            <span className="font-medium text-text-primary">{sk.skill}</span>
            {editing ? (
              <select value={sk.level} onChange={e => updateLevel(sk.id, e.target.value)}
                className="text-xs border-none bg-transparent outline-none cursor-pointer px-1 py-0 rounded"
                style={{ backgroundColor: SKILL_LEVEL_COLORS[sk.level] || '#F3F4F6' }}>
                {Object.entries(SKILL_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: SKILL_LEVEL_COLORS[sk.level] || '#F3F4F6' }}>
                {SKILL_LEVELS[sk.level] || sk.level}
              </span>
            )}
            {editing && (
              <button onClick={() => removeSkill(sk.id)} className="text-text-muted hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Kontaktdaten Section (dynamic list) ---

function KontaktdatenSection({ kontaktdaten, setKontaktdaten, editing, personId }) {
  const addRow = () => {
    setKontaktdaten([...kontaktdaten, { _new: true, person_id: personId, typ: 'email', wert: '', label: '', ist_primaer: false }])
  }

  const updateRow = (idx, field, value) => {
    setKontaktdaten(kontaktdaten.map((k, i) => i === idx ? { ...k, [field]: value } : k))
  }

  const removeRow = (idx) => {
    const item = kontaktdaten[idx]
    if (item.id) {
      // Mark existing row for deletion
      setKontaktdaten(kontaktdaten.map((k, i) => i === idx ? { ...k, _deleted: true } : k))
    } else {
      // Remove unsaved new row
      setKontaktdaten(kontaktdaten.filter((_, i) => i !== idx))
    }
  }

  const visibleRows = kontaktdaten.filter(k => !k._deleted)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-1 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-text-muted" /> Kontaktdaten
        </h3>
        {editing && (
          <button onClick={addRow} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Kontaktdaten hinzufuegen
          </button>
        )}
      </div>

      {visibleRows.length === 0 && (
        <p className="text-xs text-text-muted">Keine Kontaktdaten hinterlegt</p>
      )}

      <div className="space-y-2">
        {kontaktdaten.map((k, idx) => {
          if (k._deleted) return null
          return (
            <div key={k.id || `new-${idx}`} className="flex items-center gap-2">
              {editing ? (
                <>
                  <select value={k.typ} onChange={e => updateRow(idx, 'typ', e.target.value)}
                    className={inputCls + ' w-40 flex-shrink-0'}>
                    {Object.entries(KONTAKT_TYP_OPTIONS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                  <input value={k.wert} onChange={e => updateRow(idx, 'wert', e.target.value)}
                    placeholder="Wert (z.B. +49...)" className={inputCls + ' flex-1'} />
                  <input value={k.label || ''} onChange={e => updateRow(idx, 'label', e.target.value)}
                    placeholder="z.B. Privat, Arbeit" className={inputCls + ' w-32 flex-shrink-0'} />
                  <label className="flex items-center gap-1 text-xs text-text-secondary flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={k.ist_primaer || false}
                      onChange={e => updateRow(idx, 'ist_primaer', e.target.checked)}
                      className="rounded border-border-default" />
                    Primaer
                  </label>
                  <button onClick={() => removeRow(idx)} className="text-text-muted hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-text-secondary w-32 flex-shrink-0">
                    {KONTAKT_TYP_OPTIONS[k.typ] || k.typ}
                    {k.label ? ` (${k.label})` : ''}
                  </span>
                  <span className="text-sm text-text-primary">{k.wert}</span>
                  {k.ist_primaer && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium flex-shrink-0">Primaer</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Adressen Section (dynamic list) ---

function AdressenSection({ adressen, setAdressen, editing, personId }) {
  const addRow = () => {
    setAdressen([...adressen, { _new: true, person_id: personId, typ: 'privat', strasse: '', plz: '', ort: '', land: 'DE', ist_primaer: false }])
  }

  const updateRow = (idx, field, value) => {
    setAdressen(adressen.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const removeRow = (idx) => {
    const item = adressen[idx]
    if (item.id) {
      setAdressen(adressen.map((a, i) => i === idx ? { ...a, _deleted: true } : a))
    } else {
      setAdressen(adressen.filter((_, i) => i !== idx))
    }
  }

  const visibleRows = adressen.filter(a => !a._deleted)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-1 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-text-muted" /> Adressen
        </h3>
        {editing && (
          <button onClick={addRow} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Adresse hinzufuegen
          </button>
        )}
      </div>

      {visibleRows.length === 0 && (
        <p className="text-xs text-text-muted">Keine Adressen hinterlegt</p>
      )}

      <div className="space-y-3">
        {adressen.map((a, idx) => {
          if (a._deleted) return null
          return (
            <div key={a.id || `new-${idx}`} className="p-3 rounded-lg bg-surface-main border border-border-default">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={a.typ} onChange={e => updateRow(idx, 'typ', e.target.value)}
                      className={inputCls + ' w-40'}>
                      {Object.entries(ADRESS_TYP_OPTIONS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
                      <input type="checkbox" checked={a.ist_primaer || false}
                        onChange={e => updateRow(idx, 'ist_primaer', e.target.checked)}
                        className="rounded border-border-default" />
                      Primaer
                    </label>
                    <div className="flex-1" />
                    <button onClick={() => removeRow(idx)} className="text-text-muted hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <input value={a.strasse || ''} onChange={e => updateRow(idx, 'strasse', e.target.value)}
                        placeholder="Strasse" className={inputCls} />
                    </div>
                    <input value={a.plz || ''} onChange={e => updateRow(idx, 'plz', e.target.value)}
                      placeholder="PLZ" className={inputCls} />
                    <input value={a.ort || ''} onChange={e => updateRow(idx, 'ort', e.target.value)}
                      placeholder="Ort" className={inputCls} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-secondary w-28 flex-shrink-0">
                    {ADRESS_TYP_OPTIONS[a.typ] || a.typ}
                  </span>
                  <span className="text-sm text-text-primary">
                    {[a.strasse, a.plz, a.ort].filter(Boolean).join(', ') || '-'}
                  </span>
                  {a.ist_primaer && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium flex-shrink-0">Primaer</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Zeichen helpers ---

// HARDCODE: Spaeter aus DB/Einstellungen — Backlog AM-149
const BLOCKED_ZEICHEN = new Set(['SS', 'SA', 'HH', 'KZ', 'NS', 'SD', 'AH', 'HJ'])

function generateZeichen(vorname, nachname) {
  if (!vorname || !nachname) return ''
  const v = vorname.charAt(0).toUpperCase()
  const n = nachname.charAt(0).toUpperCase()
  const candidate = v + n
  if (BLOCKED_ZEICHEN.has(candidate)) {
    return (v + nachname.substring(0, 2)).toUpperCase()
  }
  return candidate
}

function generateZeichenAlternativen(vorname, nachname) {
  if (!vorname || !nachname) return []
  const v = vorname.toUpperCase(), n = nachname.toUpperCase()
  const candidates = [
    v.charAt(0) + n.charAt(0),
    v.charAt(0) + n.substring(0, 2),
    v.substring(0, 2) + n.charAt(0),
    v.charAt(0) + n.charAt(0) + v.charAt(1),
    v.charAt(0) + n.charAt(n.length - 1),
  ]
  return candidates
    .filter((z, i, arr) => z.length >= 2 && arr.indexOf(z) === i && !BLOCKED_ZEICHEN.has(z))
}

// =============================================================================
// Main component
// =============================================================================

export default function MitarbeiterDetail() {
  const { id } = useParams() // This is the old mitarbeiter.id
  const navigate = useNavigate()

  // Data from new tables
  const [person, setPerson] = useState(null)
  const [maDaten, setMaDaten] = useState(null)
  const [kontaktdaten, setKontaktdaten] = useState([])
  const [adressen, setAdressen] = useState([])

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stamm')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zeichenConflict, setZeichenConflict] = useState(false)

  // Edit forms — separate for person fields and ma fields
  const [personForm, setPersonForm] = useState({})
  const [maForm, setMaForm] = useState({})

  // Suggestions for autocomplete fields
  const [suggestions, setSuggestions] = useState({})

  useEffect(() => {
    const loadSuggestions = async () => {
      const fields = ['abteilung', 'funktion', 'krankenkasse', 'bank']
      const result = {}
      for (const f of fields) {
        const { data } = await supabase.from('mitarbeiter_daten').select(f).not(f, 'is', null).not(f, 'eq', '')
        result[f] = [...new Set((data || []).map(d => d[f]).filter(Boolean))]
      }
      setSuggestions(result)
    }
    loadSuggestions()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)

    // Load person and mitarbeiter_daten in parallel via mitarbeiter_alt_id
    const [personResult, maResult] = await Promise.all([
      supabase.from('personen').select('*').eq('mitarbeiter_alt_id', id).single(),
      supabase.from('mitarbeiter_daten').select('*').eq('mitarbeiter_alt_id', id).single(),
    ])

    const personData = personResult.data
    const maData = maResult.data

    if (personData) {
      setPerson(personData)
      setPersonForm(personData)

      // Load kontaktdaten and adressen using person_id
      const [kontaktResult, adressenResult] = await Promise.all([
        supabase.from('person_kontaktdaten').select('*').eq('person_id', personData.id).order('ist_primaer', { ascending: false }),
        supabase.from('person_adressen').select('*').eq('person_id', personData.id).order('ist_primaer', { ascending: false }),
      ])
      setKontaktdaten(kontaktResult.data || [])
      setAdressen(adressenResult.data || [])
    }

    if (maData) {
      setMaDaten(maData)
      setMaForm(maData)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const setPF = (key, val) => setPersonForm(f => ({ ...f, [key]: val }))
  const setMF = (key, val) => setMaForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    if (zeichenConflict) { alert('Zeichen ist bereits vergeben. Bitte aendern.'); return }
    setSaving(true)

    try {
      // 1. Update personen
      const personUpdate = { ...personForm }
      delete personUpdate.id; delete personUpdate.created_at; delete personUpdate.updated_at
      delete personUpdate.mitarbeiter_alt_id; delete personUpdate.w4a_kontakt_person_id
      for (const k of Object.keys(personUpdate)) {
        if (personUpdate[k] === '') personUpdate[k] = null
      }
      await supabase.from('personen').update(personUpdate).eq('id', person.id)

      // 2. Update mitarbeiter_daten
      const maUpdate = { ...maForm }
      delete maUpdate.id; delete maUpdate.created_at; delete maUpdate.updated_at
      delete maUpdate.person_id; delete maUpdate.mitarbeiter_alt_id
      delete maUpdate.ressource_id; delete maUpdate.auth_user_id
      delete maUpdate.vorgesetzter_id; delete maUpdate.urlaubsgenehmiger_id
      for (const k of Object.keys(maUpdate)) {
        if (maUpdate[k] === '') maUpdate[k] = null
      }
      await supabase.from('mitarbeiter_daten').update(maUpdate).eq('id', maDaten.id)

      // 3. Save kontaktdaten (insert new, update existing, delete marked)
      const kontaktOps = []
      for (const k of kontaktdaten) {
        if (k._deleted && k.id) {
          kontaktOps.push(supabase.from('person_kontaktdaten').delete().eq('id', k.id))
        } else if (k._new && !k._deleted) {
          const { _new, ...row } = k
          kontaktOps.push(supabase.from('person_kontaktdaten').insert({ ...row, person_id: person.id }))
        } else if (k.id && !k._deleted) {
          const { _new, _deleted, ...row } = k
          delete row.created_at
          kontaktOps.push(supabase.from('person_kontaktdaten').update(row).eq('id', k.id))
        }
      }
      await Promise.all(kontaktOps)

      // 4. Save adressen (insert new, update existing, delete marked)
      const adressenOps = []
      for (const a of adressen) {
        if (a._deleted && a.id) {
          adressenOps.push(supabase.from('person_adressen').delete().eq('id', a.id))
        } else if (a._new && !a._deleted) {
          const { _new, ...row } = a
          adressenOps.push(supabase.from('person_adressen').insert({ ...row, person_id: person.id }))
        } else if (a.id && !a._deleted) {
          const { _new, _deleted, ...row } = a
          delete row.created_at
          adressenOps.push(supabase.from('person_adressen').update(row).eq('id', a.id))
        }
      }
      await Promise.all(adressenOps)
    } finally {
      setSaving(false)
    }

    setEditing(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Laden...</div>
  if (!person || !maDaten) return <div className="flex items-center justify-center h-64 text-text-muted">Mitarbeiter nicht gefunden</div>

  const st = STATUS_STYLES[maDaten.status] || STATUS_STYLES.aktiv

  return (
    <div className="min-h-screen bg-surface-main p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mitarbeiter')} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{person.vorname} {person.nachname}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-text-muted">Nr. {maDaten.personalnummer || '-'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
              <span className="text-sm text-text-secondary">{ABTEILUNG_LABELS[maDaten.abteilung] || maDaten.abteilung || '-'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button onClick={() => { setEditing(false); setPersonForm(person); setMaForm(maDaten); load() }}
                className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">
                Abbrechen
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:opacity-90">
              <FileText className="w-4 h-4" /> Bearbeiten
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-default">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg bg-surface-card border border-border-default p-5">
        {tab === 'stamm' && (
          <div className="space-y-6">
            {/* Person */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Person</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Anrede" value={personForm.anrede} onChange={v => setPF('anrede', v)} disabled={!editing}
                  options={{ herr: 'Herr', frau: 'Frau', divers: 'Divers' }} />
                <Field label="Vorname *" value={personForm.vorname} onChange={v => setPF('vorname', v)} disabled={!editing} />
                <Field label="Nachname *" value={personForm.nachname} onChange={v => setPF('nachname', v)} disabled={!editing} />
                <Field label="Geburtsdatum" value={personForm.geburtsdatum} type="date" onChange={v => setPF('geburtsdatum', v)} disabled={!editing} />
                <div>
                  <Field label="Zeichen (Kuerzel)" value={personForm.zeichen} disabled={!editing}
                    placeholder={generateZeichen(personForm.vorname, personForm.nachname) || 'z.B. ANST'}
                    onChange={async (v) => {
                      const upper = v.toUpperCase()
                      setPF('zeichen', upper)
                      if (upper.length >= 2) {
                        const { data } = await supabase.from('personen').select('id').eq('zeichen', upper).neq('id', person.id).limit(1)
                        setZeichenConflict(data && data.length > 0)
                      } else {
                        setZeichenConflict(false)
                      }
                    }} />
                  {zeichenConflict && (
                    <p className="text-[10px] text-red-600 mt-0.5">Bereits vergeben! Alternativen: {generateZeichenAlternativen(personForm.vorname, personForm.nachname).join(', ')}</p>
                  )}
                </div>
                <Field label="Personalnummer" value={maForm.personalnummer} onChange={v => setMF('personalnummer', v)} disabled={!editing} />
              </div>
            </div>

            {/* Beschaeftigung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Beschaeftigung</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Abteilung" value={maForm.abteilung} onChange={v => setMF('abteilung', v)} disabled={!editing}
                  placeholder="z.B. Werkstatt, Verwaltung" suggestions={suggestions.abteilung} />
                <Field label="Funktion / Position" value={maForm.funktion} onChange={v => setMF('funktion', v)} disabled={!editing}
                  placeholder="z.B. Vorarbeiter, Bueroleitung" suggestions={suggestions.funktion} />
                <Field label="Beschaeftigungsart" value={maForm.beschaeftigungsart} onChange={v => setMF('beschaeftigungsart', v)} disabled={!editing}
                  options={BESCHAEFTIGUNGSART_OPTIONS} />
                <Field label="Verguetung" value={maForm.verguetungsart} onChange={v => setMF('verguetungsart', v)} disabled={!editing}
                  options={{ gehalt: 'Gehalt', stundenlohn: 'Stundenlohn' }} />
                <Field label="Status" value={maForm.status} onChange={v => setMF('status', v)} disabled={!editing}
                  options={{ aktiv: 'Aktiv', inaktiv: 'Inaktiv', ausgeschieden: 'Ausgeschieden', gekuendigt: 'Gekuendigt' }} />
              </div>
            </div>

            {/* Termine & Daten */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Termine & Daten</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Eintrittsdatum *" value={maForm.eintrittsdatum} type="date" onChange={v => setMF('eintrittsdatum', v)} disabled={!editing} />
                <Field label="Austrittsdatum" value={maForm.austrittsdatum} type="date" onChange={v => setMF('austrittsdatum', v)} disabled={!editing} />
              </div>
            </div>

            {/* Kontaktdaten (dynamic) */}
            <KontaktdatenSection
              kontaktdaten={kontaktdaten}
              setKontaktdaten={setKontaktdaten}
              editing={editing}
              personId={person?.id}
            />

            {/* Notizen */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Notizen</h3>
              <textarea value={personForm.notizen || ''} onChange={e => setPF('notizen', e.target.value)} rows={3}
                className={inputCls + ' resize-none'} disabled={!editing} placeholder="Freitext-Notizen zum Mitarbeiter..." />
            </div>
          </div>
        )}

        {tab === 'vertrag' && (
          <div className="space-y-6">
            <VertragSection mitarbeiterId={id} editing={editing} />
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Zeiterfassung-Einstellungen</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Frühester Beginn" value={maForm.fruehester_beginn} type="time" onChange={v => setMF('fruehester_beginn', v)} disabled={!editing} />
                <Field label="Rundung Taktung (Min)" value={maForm.rundung_taktung} type="number" onChange={v => setMF('rundung_taktung', v)} disabled={!editing} />
                <Field label="Rundung (Kommen/Gehen)" value={maForm.rundung_kommen} onChange={v => { setMF('rundung_kommen', v); setMF('rundung_gehen', v) }} disabled={!editing}
                  options={{ aufrunden: 'Aufrunden', abrunden: 'Abrunden', auf_ab: 'Auf-/Abrunden' }} />
              </div>
            </div>
            <div className="border-t border-border-default pt-4">
              <UrlaubSection mitarbeiterId={id} />
            </div>
            <div className="border-t border-border-default pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Abwesenheiten</h3>
                <Link to="/zeiterfassung" className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <Clock className="w-3 h-3" /> In Zeiterfassung anzeigen
                </Link>
              </div>
              <p className="text-xs text-text-muted mt-1">Abwesenheiten werden jetzt zentral unter Zeiterfassung verwaltet.</p>
            </div>
          </div>
        )}

        {tab === 'skills' && (
          <div className="space-y-6">
            {/* Hauptmonteur Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-main border border-border-default">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-text-muted" />
                <div>
                  <span className="text-sm font-medium text-text-primary">Hauptmonteur-Befähigung</span>
                  <p className="text-xs text-text-muted">Darf als Teamleiter auf Baustellen eingesetzt werden</p>
                </div>
              </div>
              <button
                onClick={() => editing && setMF('hauptmonteur_befaehigt', !maForm.hauptmonteur_befaehigt)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  maForm.hauptmonteur_befaehigt ? 'bg-brand' : 'bg-gray-300'
                } ${editing ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  maForm.hauptmonteur_befaehigt ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
            <SkillsSection mitarbeiterId={id} editing={editing} />
          </div>
        )}

        {tab === 'personal' && (
          <div className="space-y-6">
            {/* Adressen (dynamic) */}
            <AdressenSection
              adressen={adressen}
              setAdressen={setAdressen}
              editing={editing}
              personId={person?.id}
            />

            {/* Notfallkontakt — stays in mitarbeiter_daten for now */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Phone className="w-4 h-4 text-text-muted" /> Notfallkontakt
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {/* Notfallkontakt fields are not in mitarbeiter_daten schema yet — show as read-only hint */}
                <p className="text-xs text-text-muted col-span-3">Notfallkontakt wird kuenftig ueber Kontaktdaten abgebildet.</p>
              </div>
            </div>

            {/* Bankverbindung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <CreditCard className="w-4 h-4 text-text-muted" /> Bankverbindung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Bank" value={maForm.bank} onChange={v => setMF('bank', v)} disabled={!editing} suggestions={suggestions.bank} />
                <Field label="IBAN" value={maForm.iban} onChange={v => setMF('iban', v)} disabled={!editing} />
                <Field label="BIC" value={maForm.bic} onChange={v => setMF('bic', v)} disabled={!editing} />
              </div>
            </div>

            {/* Steuer */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Shield className="w-4 h-4 text-text-muted" /> Steuer
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Steuer-ID" value={maForm.steuer_id} onChange={v => setMF('steuer_id', v)} disabled={!editing} placeholder="11-stellig" />
                <Field label="Steuerklasse" value={maForm.steuerklasse} onChange={v => setMF('steuerklasse', v)} disabled={!editing}
                  options={STEUERKLASSE_OPTIONS} />
                <Field label="Kinderfreibetraege" value={maForm.kinderfreibetraege} type="number" onChange={v => setMF('kinderfreibetraege', v)} disabled={!editing} />
                <Field label="Konfession (KiSt)" value={maForm.konfession} onChange={v => setMF('konfession', v)} disabled={!editing}
                  options={KONFESSION_OPTIONS} />
              </div>
            </div>

            {/* Sozialversicherung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Shield className="w-4 h-4 text-text-muted" /> Sozialversicherung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="SV-Nummer" value={maForm.sv_nummer} onChange={v => setMF('sv_nummer', v)} disabled={!editing} />
                <Field label="RV-Nummer" value={maForm.rv_nummer} onChange={v => setMF('rv_nummer', v)} disabled={!editing} />
                <Field label="Krankenkasse" value={maForm.krankenkasse} onChange={v => setMF('krankenkasse', v)} disabled={!editing} suggestions={suggestions.krankenkasse} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
