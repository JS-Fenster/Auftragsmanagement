/**
 * MitarbeiterDetail — Eigene Seite pro Mitarbeiter mit Tabs
 * Route: /mitarbeiter/:id
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, FileText, Calendar, Clock, Shield, Briefcase, CreditCard, Phone, MapPin, Wrench, X, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AbwesenheitenSection from '../components/AbwesenheitenSection'

const ABTEILUNG_LABELS = {
  monteur: 'Montage', buero: 'Verwaltung', geschaeftsfuehrung: 'Geschäftsführung',
  lager: 'Lager', vertrieb: 'Vertrieb',
}
const BESCHAEFTIGUNGSART_OPTIONS = {
  vollzeit: 'Vollzeit', teilzeit: 'Teilzeit', minijob: 'Minijob',
  azubi: 'Azubi', praktikant: 'Praktikant', werkstudent: 'Werkstudent',
}
const STEUERKLASSE_OPTIONS = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' }
const KONFESSION_OPTIONS = { ev: 'Evangelisch', rk: 'Römisch-Katholisch', keine: 'Keine' }
const SKILL_PRESETS = ['Fenster', 'Türen', 'Raffstore', 'Markise', 'Haustür', 'Reparatur', 'Service', 'Rollläden', 'Elektro', 'Glas']
const SKILL_LEVELS = { lehrling: 'Lehrling', junior: 'Junior', standard: 'Standard', senior: 'Senior', meister: 'Meister' }
const SKILL_LEVEL_COLORS = {
  lehrling: '#F3F4F6', junior: '#DBEAFE', standard: '#D1FAE5', senior: '#FDE68A', meister: '#C4B5FD',
}
const STATUS_STYLES = {
  aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv' },
  inaktiv: { bg: '#FEF3C7', text: '#92400E', label: 'Inaktiv' },
  ausgeschieden: { bg: '#F3F4F6', text: '#374151', label: 'Ausgeschieden' },
  elternzeit: { bg: '#EDE9FE', text: '#5B21B6', label: 'Elternzeit' },
}
const TABS = [
  { key: 'stamm', label: 'Stammdaten', icon: User },
  { key: 'vertrag', label: 'Vertrag & Arbeitszeit', icon: Briefcase },
  { key: 'urlaub', label: 'Urlaub & Abwesenheiten', icon: Calendar },
  { key: 'personal', label: 'Persönliches & Finanzen', icon: CreditCard },
]

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

function calcPause(brutto) {
  if (brutto > 9) return 0.75  // 45min bei ueber 9h
  if (brutto > 6) return 0.5   // 30min bei ueber 6h
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

function VertragSection({ mitarbeiterId }) {
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

  // Check overlap with existing periods
  const hasOverlap = form.gueltig_ab && vertraege.some(v => {
    if (!v.gueltig_bis) return false // open period will be auto-closed
    return form.gueltig_ab <= v.gueltig_bis && (!form.gueltig_bis || form.gueltig_bis >= v.gueltig_ab)
  })

  const save = async () => {
    // Validate: new start must be after latest start
    const latestVertrag = vertraege[0] // sorted by gueltig_ab DESC
    if (latestVertrag && form.gueltig_ab <= latestVertrag.gueltig_ab) {
      alert('Neue Periode muss nach der letzten beginnen (' + formatDate(latestVertrag.gueltig_ab) + ')')
      return
    }
    if (hasOverlap) {
      if (!confirm('Achtung: Diese Periode überlappt mit einer bestehenden. Trotzdem anlegen?')) return
    }
    // Close previous open period
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
      </div>

      {showForm && (
        <div className="p-4 rounded-lg bg-surface-main border border-border-default space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Gültig ab *" value={form.gueltig_ab} type="date" onChange={v => setForm(f => ({ ...f, gueltig_ab: v }))} />
            <Field label="Urlaubstage/Jahr" value={form.urlaubstage_jahr} type="number" onChange={v => setForm(f => ({ ...f, urlaubstage_jahr: v }))} />
            <div className="flex items-end pb-1">
              <div className="text-xs text-text-muted">
                <span className="font-semibold text-text-primary">{formatStunden(wochenstundenNetto)} netto</span>
                {' '}({formatStunden(wochenstundenBrutto)} brutto) / Woche · {arbeitstage} Tage
              </div>
            </div>
          </div>

          {/* Wochentag-Grid */}
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

      {/* Bestehende Verträge */}
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
          {[['Anspruch', konto.anspruch], ['Übertrag', konto.uebertrag], ['Genommen', konto.genommen], ['Rest', konto.rest]].map(([l, v], i) => (
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
          <Wrench className="w-4 h-4 text-text-muted" /> Fähigkeiten
        </h3>
        {editing && (
          <button onClick={() => setAdding(!adding)} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Skill hinzufügen
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
          <button onClick={addSkill} disabled={!newSkill.trim()} className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg disabled:opacity-50">Hinzufügen</button>
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

const BLOCKED_ZEICHEN = new Set(['SS', 'SA', 'HH', 'KZ', 'NS', 'SD', 'AH', 'HJ'])

function generateZeichen(vorname, nachname) {
  if (!vorname || !nachname) return ''
  const v = vorname.charAt(0).toUpperCase()
  const n = nachname.charAt(0).toUpperCase()
  const candidate = v + n
  if (BLOCKED_ZEICHEN.has(candidate)) {
    // Alternative: Vorname 1. + Nachname 1.+2.
    return (v + nachname.substring(0, 2)).toUpperCase()
  }
  return candidate
}

function generateZeichenAlternativen(vorname, nachname) {
  if (!vorname || !nachname) return []
  const v = vorname.toUpperCase(), n = nachname.toUpperCase()
  const candidates = [
    v.charAt(0) + n.charAt(0),                        // CS
    v.charAt(0) + n.substring(0, 2),                  // CSC
    v.substring(0, 2) + n.charAt(0),                  // CHS
    v.charAt(0) + n.charAt(0) + v.charAt(1),          // CSH
    v.charAt(0) + n.charAt(n.length - 1),             // CD (letzter Buchstabe Nachname)
  ]
  return candidates
    .filter((z, i, arr) => z.length >= 2 && arr.indexOf(z) === i && !BLOCKED_ZEICHEN.has(z))
}

export default function MitarbeiterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ma, setMa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stamm')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [zeichenConflict, setZeichenConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState({})

  useEffect(() => {
    const loadSuggestions = async () => {
      const fields = ['abteilung', 'funktion', 'krankenkasse', 'bank']
      const result = {}
      for (const f of fields) {
        const { data } = await supabase.from('mitarbeiter').select(f).not(f, 'is', null).not(f, 'eq', '')
        result[f] = [...new Set((data || []).map(d => d[f]).filter(Boolean))]
      }
      setSuggestions(result)
    }
    loadSuggestions()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('mitarbeiter').select('*').eq('id', id).single()
    if (data) { setMa(data); setForm(data) }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const save = async () => {
    if (zeichenConflict) { alert('Zeichen ist bereits vergeben. Bitte ändern.'); return }
    setSaving(true)
    const update = { ...form }
    delete update.id; delete update.created_at; delete update.updated_at
    // Clean empty strings to null
    for (const k of Object.keys(update)) {
      if (update[k] === '') update[k] = null
    }
    await supabase.from('mitarbeiter').update(update).eq('id', id)
    setSaving(false)
    setEditing(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-text-muted">Laden...</div>
  if (!ma) return <div className="flex items-center justify-center h-64 text-text-muted">Mitarbeiter nicht gefunden</div>

  const st = STATUS_STYLES[ma.status] || STATUS_STYLES.aktiv

  return (
    <div className="min-h-screen bg-surface-main p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mitarbeiter')} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{ma.vorname} {ma.nachname}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-text-muted">Nr. {ma.personalnummer || '-'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
              <span className="text-sm text-text-secondary">{ABTEILUNG_LABELS[ma.rolle] || ma.rolle}</span>
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
              <button onClick={() => { setEditing(false); setForm(ma) }}
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
                <Field label="Anrede" value={form.anrede} onChange={v => set('anrede', v)} disabled={!editing}
                  options={{ herr: 'Herr', frau: 'Frau', divers: 'Divers' }} />
                <Field label="Vorname *" value={form.vorname} onChange={v => set('vorname', v)} disabled={!editing} />
                <Field label="Nachname *" value={form.nachname} onChange={v => set('nachname', v)} disabled={!editing} />
                <Field label="Geburtsdatum" value={form.geburtsdatum} type="date" onChange={v => set('geburtsdatum', v)} disabled={!editing} />
                <div>
                  <Field label="Zeichen (Kürzel)" value={form.zeichen} disabled={!editing}
                    placeholder={generateZeichen(form.vorname, form.nachname) || 'z.B. ANST'}
                    onChange={async (v) => {
                      const upper = v.toUpperCase()
                      set('zeichen', upper)
                      if (upper.length >= 2) {
                        const { data } = await supabase.from('mitarbeiter').select('id').eq('zeichen', upper).neq('id', id).limit(1)
                        setZeichenConflict(data && data.length > 0)
                      } else {
                        setZeichenConflict(false)
                      }
                    }} />
                  {zeichenConflict && (
                    <p className="text-[10px] text-red-600 mt-0.5">Bereits vergeben! Alternativen: {generateZeichenAlternativen(form.vorname, form.nachname).join(', ')}</p>
                  )}
                </div>
                <Field label="Personalnummer" value={form.personalnummer} onChange={v => set('personalnummer', v)} disabled={!editing} />
              </div>
            </div>

            {/* Beschäftigung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Beschäftigung</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Bereich" value={form.rolle} onChange={v => set('rolle', v)} disabled={!editing}
                  options={ABTEILUNG_LABELS} />
                <Field label="Abteilung" value={form.abteilung} onChange={v => set('abteilung', v)} disabled={!editing}
                  placeholder="z.B. Werkstatt, Verwaltung" suggestions={suggestions.abteilung} />
                <Field label="Funktion / Position" value={form.funktion} onChange={v => set('funktion', v)} disabled={!editing}
                  placeholder="z.B. Vorarbeiter, Büroleitung" suggestions={suggestions.funktion} />
                <Field label="Beschäftigungsart" value={form.beschaeftigungsart} onChange={v => set('beschaeftigungsart', v)} disabled={!editing}
                  options={BESCHAEFTIGUNGSART_OPTIONS} />
                <Field label="Vergütung" value={form.verguetungsart} onChange={v => set('verguetungsart', v)} disabled={!editing}
                  options={{ gehalt: 'Gehalt', stundenlohn: 'Stundenlohn' }} />
                <Field label="Status" value={form.status} onChange={v => set('status', v)} disabled={!editing}
                  options={{ aktiv: 'Aktiv', inaktiv: 'Inaktiv', ausgeschieden: 'Ausgeschieden', gekuendigt: 'Gekündigt' }} />
              </div>
            </div>

            {/* Daten */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Termine & Daten</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Eintrittsdatum *" value={form.eintrittsdatum} type="date" onChange={v => set('eintrittsdatum', v)} disabled={!editing} />
                <Field label="Austrittsdatum" value={form.austrittsdatum} type="date" onChange={v => set('austrittsdatum', v)} disabled={!editing} />
                <Field label="Probezeit bis" value={form.probezeit_ende} type="date" onChange={v => set('probezeit_ende', v)} disabled={!editing} />
              </div>
            </div>

            {/* Kontakt (Firma) */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Kontakt (Firma)</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="E-Mail" value={form.email} type="email" onChange={v => set('email', v)} disabled={!editing} />
                <Field label="Telefon" value={form.telefon} onChange={v => set('telefon', v)} disabled={!editing} />
              </div>
            </div>

            {/* Notizen */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Notizen</h3>
              <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={3}
                className={inputCls + ' resize-none'} disabled={!editing} placeholder="Freitext-Notizen zum Mitarbeiter..." />
            </div>
            <div className="border-t border-border-default pt-4">
              <SkillsSection mitarbeiterId={id} editing={editing} />
            </div>
          </div>
        )}

        {tab === 'vertrag' && (
          <div className="space-y-6">
            <VertragSection mitarbeiterId={id} />
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Zeiterfassung-Einstellungen</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Frühester Beginn" value={form.fruehester_beginn} type="time" onChange={v => set('fruehester_beginn', v)} disabled={!editing} />
                <Field label="Rundung Taktung (Min)" value={form.rundung_taktung} type="number" onChange={v => set('rundung_taktung', v)} disabled={!editing} />
                <Field label="Rundung Kommen" value={form.rundung_kommen} onChange={v => set('rundung_kommen', v)} disabled={!editing}
                  options={{ aufrunden: 'Aufrunden', abrunden: 'Abrunden', auf_ab: 'Auf-/Abrunden' }} />
              </div>
            </div>
          </div>
        )}

        {tab === 'urlaub' && (
          <div className="space-y-6">
            <UrlaubSection mitarbeiterId={id} />
            <div className="border-t border-border-default pt-4">
              <AbwesenheitenSection mitarbeiterId={id} mitarbeiterName={`${ma.vorname} ${ma.nachname}`} />
            </div>
          </div>
        )}

        {tab === 'personal' && (
          <div className="space-y-6">
            {/* Privatadresse */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <MapPin className="w-4 h-4 text-text-muted" /> Privatadresse
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Straße" value={form.priv_strasse} onChange={v => set('priv_strasse', v)} disabled={!editing} />
                <Field label="PLZ" value={form.priv_plz} onChange={v => set('priv_plz', v)} disabled={!editing} />
                <Field label="Ort" value={form.priv_ort} onChange={v => set('priv_ort', v)} disabled={!editing} />
                <Field label="Privat-Telefon" value={form.priv_telefon} onChange={v => set('priv_telefon', v)} disabled={!editing} />
                <Field label="Privat-Mobil" value={form.priv_mobil} onChange={v => set('priv_mobil', v)} disabled={!editing} />
                <Field label="Privat-Email" value={form.priv_email} type="email" onChange={v => set('priv_email', v)} disabled={!editing} />
                <Field label="Staatsangehörigkeit" value={form.staatsangehoerigkeit} onChange={v => set('staatsangehoerigkeit', v)} disabled={!editing} />
              </div>
            </div>

            {/* Notfallkontakt */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Phone className="w-4 h-4 text-text-muted" /> Notfallkontakt
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Name" value={form.notfall_name} onChange={v => set('notfall_name', v)} disabled={!editing} />
                <Field label="Telefon" value={form.notfall_telefon} onChange={v => set('notfall_telefon', v)} disabled={!editing} />
              </div>
            </div>

            {/* Bankverbindung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <CreditCard className="w-4 h-4 text-text-muted" /> Bankverbindung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Bank" value={form.bank} onChange={v => set('bank', v)} disabled={!editing} suggestions={suggestions.bank} />
                <Field label="IBAN" value={form.iban} onChange={v => set('iban', v)} disabled={!editing} />
                <Field label="BIC" value={form.bic} onChange={v => set('bic', v)} disabled={!editing} />
              </div>
            </div>

            {/* Steuer */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Shield className="w-4 h-4 text-text-muted" /> Steuer
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Steuer-ID" value={form.steuer_id} onChange={v => set('steuer_id', v)} disabled={!editing} placeholder="11-stellig" />
                <Field label="Steuerklasse" value={form.steuerklasse} onChange={v => set('steuerklasse', v)} disabled={!editing}
                  options={STEUERKLASSE_OPTIONS} />
                <Field label="Kinderfreibeträge" value={form.kinderfreibetraege} type="number" onChange={v => set('kinderfreibetraege', v)} disabled={!editing} />
                <Field label="Konfession (KiSt)" value={form.konfession} onChange={v => set('konfession', v)} disabled={!editing}
                  options={KONFESSION_OPTIONS} />
              </div>
            </div>

            {/* Sozialversicherung */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Shield className="w-4 h-4 text-text-muted" /> Sozialversicherung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="SV-Nummer" value={form.sv_nummer} onChange={v => set('sv_nummer', v)} disabled={!editing} />
                <Field label="RV-Nummer" value={form.rv_nummer} onChange={v => set('rv_nummer', v)} disabled={!editing} />
                <Field label="Krankenkasse" value={form.krankenkasse} onChange={v => set('krankenkasse', v)} disabled={!editing} suggestions={suggestions.krankenkasse} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
