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
import { ArrowLeft, User, FileText, Calendar, Shield, Briefcase, CreditCard, Phone, MapPin, Wrench, X, Plus, Trash2, Clock, Car, AlertTriangle, CheckCircle, Award, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

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
  { key: 'vertrag', label: 'Vertrag & Beschäftigung', icon: Briefcase },
  { key: 'skills', label: 'Skills & Qualifikationen', icon: Wrench },
  { key: 'akte', label: 'Personalakte & Ausstattung', icon: FileText },
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

const DEFAULT_PAUSENREGEL = { '6': 30, '9': 45 }

function calcPause(brutto, pausenregel) {
  const regel = pausenregel && Object.keys(pausenregel).length > 0 ? pausenregel : DEFAULT_PAUSENREGEL
  let pause = 0
  Object.entries(regel)
    .sort(([a], [b]) => Number(b) - Number(a))
    .forEach(([stunden, minuten]) => {
      if (brutto > Number(stunden) && pause === 0) pause = Number(minuten) / 60
    })
  return pause
}

function formatStunden(dezimal) {
  const h = Math.floor(dezimal)
  const m = Math.round((dezimal - h) * 60)
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} h` : `${h} h`
}

function calcWochenstunden(tagesarbeitszeit, mitPause = true, pausenregel) {
  if (!tagesarbeitszeit) return 0
  return WOCHENTAGE.reduce((sum, { key }) => {
    const tag = tagesarbeitszeit[key]
    if (!tag) return sum
    let brutto = calcBruttoTag(tag)
    if (mitPause) brutto -= calcPause(brutto, pausenregel)
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
                <div className="text-text-muted">{(() => { const b = calcBruttoTag(tag); const p = calcPause(b, pausenregel); return p > 0 ? `${formatStunden(b - p)} netto` : formatStunden(b) })()}</div>
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

function VertragSection({ mitarbeiterId, editing, pausenregel }) {
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

  const wochenstundenNetto = calcWochenstunden(form.tagesarbeitszeit, true, pausenregel)
  const wochenstundenBrutto = calcWochenstunden(form.tagesarbeitszeit, false, pausenregel)
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
                          {(() => { const b = calcBruttoTag(tag); const p = calcPause(b, pausenregel); const n = b - p; return p > 0 ? `${formatStunden(n)} (${formatStunden(b)} brutto)` : formatStunden(b) })()}
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

const KATEGORIE_LABELS = { montage: '🔧 Montage', verwaltung: '📋 Verwaltung', vertrieb: '💼 Vertrieb', allgemein: '🛡️ Allgemein' }
const KATEGORIE_ORDER = ['montage', 'verwaltung', 'vertrieb', 'allgemein']

function SkillsSection({ mitarbeiterId, editing }) {
  const [skills, setSkills] = useState([])
  const [katalog, setKatalog] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillKat, setNewSkillKat] = useState('allgemein')
  const [editKatalog, setEditKatalog] = useState(false)

  const loadSkills = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_skills').select('*, skill_katalog(id, name, kategorie)').eq('mitarbeiter_id', mitarbeiterId).order('skill')
    setSkills(data || [])
  }, [mitarbeiterId])

  const loadKatalog = useCallback(async () => {
    const { data } = await supabase.from('skill_katalog').select('*').order('kategorie').order('sort_order')
    setKatalog(data || [])
  }, [])

  useEffect(() => { loadSkills(); loadKatalog() }, [loadSkills, loadKatalog])

  const addSkillByKatalogId = async (katalogId, skillName) => {
    if (skills.some(s => s.skill_katalog_id === katalogId)) return
    await supabase.from('mitarbeiter_skills').insert({ mitarbeiter_id: mitarbeiterId, skill: skillName, skill_katalog_id: katalogId, level: 'standard' })
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

  const renameKatalogSkill = async (katalogId, newName) => {
    if (!newName.trim()) return
    await supabase.from('skill_katalog').update({ name: newName.trim() }).eq('id', katalogId)
    // Update all MA-Skills that reference this katalog entry
    await supabase.from('mitarbeiter_skills').update({ skill: newName.trim() }).eq('skill_katalog_id', katalogId)
    loadKatalog()
    loadSkills()
  }

  const addCustomSkill = async () => {
    if (!newSkillName.trim()) return
    // Add to katalog
    const { data: katalogEntry } = await supabase.from('skill_katalog').upsert({ name: newSkillName.trim(), kategorie: newSkillKat }, { onConflict: 'name' }).select().single()
    // Add to MA
    if (katalogEntry) await addSkillByKatalogId(katalogEntry.id, katalogEntry.name)
    setNewSkillName('')
    setNewSkillKat('allgemein')
    loadKatalog()
  }

  const groupedKatalog = KATEGORIE_ORDER.map(kat => ({
    key: kat,
    label: KATEGORIE_LABELS[kat] || kat,
    items: katalog.filter(k => k.kategorie === kat),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-text-muted" /> Fähigkeiten
        </h3>
        {editing && (
          <button onClick={() => setShowModal(true)} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Skills auswählen
          </button>
        )}
      </div>

      {/* Skill chips */}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-border-default p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Skills auswählen</h3>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-secondary"><X className="w-4 h-4" /></button>
            </div>

            {groupedKatalog.map(grp => (
              <div key={grp.key} className="mb-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2">{grp.label}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {grp.items.map(item => {
                    const isActive = skills.some(s => s.skill_katalog_id === item.id || s.skill === item.name)
                    return (
                      <div key={item.id} className="relative group">
                        {editKatalog ? (
                          <div className="flex items-center gap-1">
                            <input defaultValue={item.name}
                              onBlur={e => { if (e.target.value !== item.name) renameKatalogSkill(item.id, e.target.value) }}
                              onKeyDown={e => { if (e.key === 'Enter') { e.target.blur() } }}
                              className="px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 outline-none w-28 focus:border-brand" />
                            <button onClick={async () => { await supabase.from('skill_katalog').delete().eq('id', item.id); loadKatalog() }}
                              className="w-5 h-5 bg-red-500 text-white rounded text-[10px] leading-5 text-center hover:bg-red-600 shrink-0">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => {
                              if (isActive) {
                                const sk = skills.find(s => s.skill_katalog_id === item.id || s.skill === item.name)
                                if (sk) removeSkill(sk.id)
                              } else {
                                addSkillByKatalogId(item.id, item.name)
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isActive
                                ? 'bg-brand/10 border-brand/30 text-brand hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                                : 'bg-surface-main border-border-default text-text-secondary hover:bg-brand/5 hover:border-brand/20'
                            }`}>
                            {isActive && <span className="mr-1">✓</span>}
                            {item.name}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Custom skill */}
            <div className="border-t border-border-default pt-4 mt-4">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2">Eigenen Skill anlegen</h4>
              <div className="flex gap-2">
                <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                  placeholder="Neuer Skill..." className={inputCls + ' flex-[3] text-xs'} />
                <select value={newSkillKat} onChange={e => setNewSkillKat(e.target.value)} className={inputCls + ' flex-1 text-xs'}>
                  {KATEGORIE_ORDER.map(k => <option key={k} value={k}>{KATEGORIE_LABELS[k]?.replace(/^.+\s/, '') || k}</option>)}
                </select>
                <button onClick={addCustomSkill} disabled={!newSkillName.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0">
                  Hinzufügen
                </button>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={() => setEditKatalog(!editKatalog)}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${editKatalog ? 'bg-red-50 text-red-600 border border-red-200' : 'text-text-muted hover:bg-surface-hover'}`}>
                <Wrench className="w-3 h-3" /> {editKatalog ? 'Bearbeitung beenden' : 'Katalog bearbeiten'}
              </button>
              <button onClick={() => { setShowModal(false); setEditKatalog(false) }} className="px-4 py-2 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90">Fertig</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Personalakte Section ---

const DOKU_KATEGORIEN = {
  arbeitsvertrag: 'Arbeitsvertrag', au_bescheinigung: 'AU-Bescheinigung', fuehrerschein: 'Führerschein-Kopie',
  zeugnis: 'Zeugnis', abmahnung: 'Abmahnung', schulung: 'Schulungsnachweis',
  personalfragebogen: 'Personalfragebogen', sonstiges: 'Sonstiges',
}

function PersonalakteSection({ mitarbeiterId, editing }) {
  const [docs, setDocs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kategorie: 'sonstiges', bezeichnung: '', gueltig_bis: '', notiz: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_dokumente').select('*').eq('mitarbeiter_id', mitarbeiterId).order('created_at', { ascending: false })
    setDocs(data || [])
  }, [mitarbeiterId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.bezeichnung.trim()) return
    await supabase.from('mitarbeiter_dokumente').insert({ mitarbeiter_id: mitarbeiterId, ...form, bezeichnung: form.bezeichnung.trim(), gueltig_bis: form.gueltig_bis || null })
    setForm({ kategorie: 'sonstiges', bezeichnung: '', gueltig_bis: '', notiz: '' }); setShowForm(false); load()
  }
  const remove = async (id) => { await supabase.from('mitarbeiter_dokumente').delete().eq('id', id); load() }
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><FileText className="w-4 h-4 text-text-muted" /> Personalakte</h3>
        {editing && <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg"><Plus className="w-3.5 h-3.5" /> Dokument</button>}
      </div>
      {showForm && editing && (
        <div className="p-3 rounded-lg border border-border-default bg-surface-main space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>Kategorie</label><select value={form.kategorie} onChange={e => setForm(f => ({ ...f, kategorie: e.target.value }))} className={inputCls}>{Object.entries(DOKU_KATEGORIEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className={labelCls}>Bezeichnung *</label><input value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))} className={inputCls} placeholder="z.B. Arbeitsvertrag 2026" /></div>
            <div><label className={labelCls}>Gültig bis</label><input type="date" value={form.gueltig_bis} onChange={e => setForm(f => ({ ...f, gueltig_bis: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!form.bezeichnung.trim()} className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg disabled:opacity-50">Speichern</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {docs.length === 0 && <p className="text-xs text-text-muted">Keine Dokumente hinterlegt</p>}
        {docs.map(d => (
          <div key={d.id} className="flex items-center justify-between p-2 rounded-lg border border-border-default bg-surface-main text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-muted shrink-0" />
              <div>
                <span className="font-medium text-text-primary">{d.bezeichnung}</span>
                <span className="text-text-muted ml-2">({DOKU_KATEGORIEN[d.kategorie] || d.kategorie})</span>
                {d.gueltig_bis && <span className="text-text-secondary ml-2">bis {fmtDate(d.gueltig_bis)}</span>}
              </div>
            </div>
            {editing && <button onClick={() => remove(d.id)} className="p-1 text-text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Arbeitsmittel Section ---

const ARBEITSMITTEL_KAT = {
  schluessel: 'Schlüssel', werkzeug: 'Werkzeug', it: 'IT/Elektronik',
  kleidung: 'Arbeitskleidung', buero: 'Büroausstattung', fahrzeug: 'Fahrzeugzubehör', sonstiges: 'Sonstiges',
}

function ArbeitsmittelSection({ mitarbeiterId, editing }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kategorie: 'sonstiges', bezeichnung: '', seriennummer: '', ausgabe_datum: new Date().toISOString().slice(0, 10), notiz: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_arbeitsmittel').select('*').eq('mitarbeiter_id', mitarbeiterId).order('kategorie').order('bezeichnung')
    setItems(data || [])
  }, [mitarbeiterId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.bezeichnung.trim()) return
    await supabase.from('mitarbeiter_arbeitsmittel').insert({ mitarbeiter_id: mitarbeiterId, ...form, bezeichnung: form.bezeichnung.trim(), seriennummer: form.seriennummer || null })
    setForm({ kategorie: 'sonstiges', bezeichnung: '', seriennummer: '', ausgabe_datum: new Date().toISOString().slice(0, 10), notiz: '' }); setShowForm(false); load()
  }
  const toggleReturn = async (item) => {
    await supabase.from('mitarbeiter_arbeitsmittel').update({ rueckgabe_datum: item.rueckgabe_datum ? null : new Date().toISOString().slice(0, 10) }).eq('id', item.id)
    load()
  }
  const remove = async (id) => { await supabase.from('mitarbeiter_arbeitsmittel').delete().eq('id', id); load() }
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  const ausgegeben = items.filter(i => !i.rueckgabe_datum)
  const zurueck = items.filter(i => i.rueckgabe_datum)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Award className="w-4 h-4 text-text-muted" /> Arbeitsmittel</h3>
        {editing && <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg"><Plus className="w-3.5 h-3.5" /> Ausgeben</button>}
      </div>
      {showForm && editing && (
        <div className="p-3 rounded-lg border border-border-default bg-surface-main space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div><label className={labelCls}>Kategorie</label><select value={form.kategorie} onChange={e => setForm(f => ({ ...f, kategorie: e.target.value }))} className={inputCls}>{Object.entries(ARBEITSMITTEL_KAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className={labelCls}>Bezeichnung *</label><input value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))} className={inputCls} placeholder="z.B. Büroschlüssel" /></div>
            <div><label className={labelCls}>Seriennr./Details</label><input value={form.seriennummer} onChange={e => setForm(f => ({ ...f, seriennummer: e.target.value }))} className={inputCls} placeholder="Optional" /></div>
            <div><label className={labelCls}>Ausgabe</label><input type="date" value={form.ausgabe_datum} onChange={e => setForm(f => ({ ...f, ausgabe_datum: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!form.bezeichnung.trim()} className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg disabled:opacity-50">Ausgeben</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}
      {ausgegeben.length > 0 && (
        <div className="space-y-1">
          {ausgegeben.map(item => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-green-200 bg-green-50/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-card text-text-muted">{ARBEITSMITTEL_KAT[item.kategorie] || item.kategorie}</span>
                <span className="font-medium text-text-primary">{item.bezeichnung}</span>
                {item.seriennummer && <span className="text-text-muted">({item.seriennummer})</span>}
                <span className="text-text-muted">seit {fmtDate(item.ausgabe_datum)}</span>
              </div>
              <div className="flex gap-1">
                {editing && <button onClick={() => toggleReturn(item)} className="px-2 py-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100">Zurück</button>}
                {editing && <button onClick={() => remove(item.id)} className="p-1 text-text-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {zurueck.length > 0 && (
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Zurückgegeben</p>
          {zurueck.map(item => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-border-default bg-surface-main text-xs opacity-60">
              <span>{item.bezeichnung} — zurück am {fmtDate(item.rueckgabe_datum)}</span>
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && <p className="text-xs text-text-muted">Keine Arbeitsmittel zugewiesen</p>}
    </div>
  )
}

// --- Onboarding/Offboarding Section ---

function OnboardingSection({ mitarbeiterId }) {
  const [checklisten, setChecklisten] = useState([])
  const [vorlagen, setVorlagen] = useState([])
  const [maRolle, setMaRolle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedCl, setExpandedCl] = useState(null)

  const [maStatus, setMaStatus] = useState(null)
  const [eintrittsdatum, setEintrittsdatum] = useState(null)
  const [austrittsdatum, setAustrittsdatum] = useState(null)

  const load = useCallback(async () => {
    const [clRes, vlRes, maRes, mdRes] = await Promise.all([
      supabase.from('onboarding_checklisten').select('*').eq('mitarbeiter_id', mitarbeiterId).order('created_at', { ascending: false }),
      supabase.from('onboarding_vorlagen').select('*').order('name'),
      supabase.from('mitarbeiter').select('rolle, status').eq('id', mitarbeiterId).single(),
      supabase.from('mitarbeiter_daten').select('eintrittsdatum, austrittsdatum, status').eq('mitarbeiter_alt_id', mitarbeiterId).single(),
    ])
    setChecklisten(clRes.data || [])
    setVorlagen(vlRes.data || [])
    setMaRolle(maRes.data?.rolle)
    setMaStatus(mdRes.data?.status || maRes.data?.status)
    setEintrittsdatum(mdRes.data?.eintrittsdatum)
    setAustrittsdatum(mdRes.data?.austrittsdatum)
    setLoading(false)
  }, [mitarbeiterId])
  useEffect(() => { load() }, [load])

  const startChecklist = async (vorlage) => {
    const items = (vorlage.items || []).map(item => ({ ...item, erledigt: false, erledigt_am: null }))
    await supabase.from('onboarding_checklisten').insert({ mitarbeiter_id: mitarbeiterId, vorlage_id: vorlage.id, typ: vorlage.typ, items })
    load()
  }

  const toggleItem = async (checklistId, itemIdx) => {
    const cl = checklisten.find(c => c.id === checklistId)
    if (!cl) return
    const newItems = [...cl.items]
    newItems[itemIdx] = { ...newItems[itemIdx], erledigt: !newItems[itemIdx].erledigt, erledigt_am: !newItems[itemIdx].erledigt ? new Date().toISOString().slice(0, 10) : null }
    const allDone = newItems.every(i => i.erledigt || i.gruppe === i.titel) // skip group headers
    await supabase.from('onboarding_checklisten').update({ items: newItems, status: allDone ? 'abgeschlossen' : 'aktiv', abgeschlossen_am: allDone ? new Date().toISOString().slice(0, 10) : null }).eq('id', checklistId)
    load()
  }

  if (loading) return null

  const aktiveChecklisten = checklisten.filter(c => c.status === 'aktiv')
  const abgeschlossene = checklisten.filter(c => c.status === 'abgeschlossen')
  const passendVorlagen = vorlagen.filter(v => !v.rolle || v.rolle === maRolle)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-text-muted" /> On-/Offboarding</h3>
      </div>

      {/* Active checklists */}
      {aktiveChecklisten.map(cl => {
        const total = cl.items.filter(i => i.nr).length
        const done = cl.items.filter(i => i.nr && i.erledigt).length
        const gruppen = [...new Set(cl.items.map(i => i.gruppe))]
        return (
          <div key={cl.id} className="rounded-lg border border-border-default bg-surface-card">
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
              <button onClick={() => setExpandedCl(expandedCl === cl.id ? null : cl.id)}
                className="flex items-center gap-2 text-left hover:text-brand transition-colors flex-1">
                <span className={`text-xs text-text-muted transition-transform ${expandedCl === cl.id ? 'rotate-90' : ''}`}>▸</span>
                <span className="text-sm font-medium text-text-primary">{cl.typ === 'onboarding' ? 'Onboarding' : 'Offboarding'}</span>
                <span className="text-xs text-text-muted">Gestartet: {new Date(cl.gestartet_am + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text-secondary">{done}/{total}</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                </div>
                <button onClick={async () => { await supabase.from('onboarding_checklisten').delete().eq('id', cl.id); load() }}
                  className="p-1 text-text-muted hover:text-red-500" title="Checkliste entfernen"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {expandedCl === cl.id && <div className="p-3">
              {gruppen.map(gruppe => {
                const gruppeItems = cl.items.filter(i => i.gruppe === gruppe && i.nr)
                return (
                  <div key={gruppe} className="mb-3">
                    <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wide mb-1.5">{gruppe}</h4>
                    <div className="space-y-0.5">
                      {gruppeItems.map(item => {
                        const idx = cl.items.indexOf(item)
                        return (
                          <button key={idx} onClick={() => toggleItem(cl.id, idx)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${item.erledigt ? 'bg-green-50/50' : 'hover:bg-surface-hover'}`}>
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.erledigt ? 'bg-green-500 border-green-500 text-white' : 'border-border-default'}`}>
                              {item.erledigt && '✓'}
                            </span>
                            <span className="text-text-muted w-8">{item.nr}</span>
                            <span className={`flex-1 ${item.erledigt ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.titel}</span>
                            {item.bemerkung && <span className="text-text-muted text-[10px] truncate max-w-[200px]">{item.bemerkung}</span>}
                            <span className="text-[10px] text-text-muted">{item.verantwortlich}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>}
          </div>
        )
      })}

      {/* Auto-Suggest + Start buttons */}
      {(() => {
        const hatOnboarding = checklisten.some(c => c.typ === 'onboarding')
        const hatOffboarding = checklisten.some(c => c.typ === 'offboarding')
        const istNeu = eintrittsdatum && !hatOnboarding
        const istAustritt = (austrittsdatum || maStatus === 'gekuendigt' || maStatus === 'ausgeschieden') && !hatOffboarding
        const onboardingVorlagen = passendVorlagen.filter(v => v.typ === 'onboarding')
        const offboardingVorlagen = passendVorlagen.filter(v => v.typ === 'offboarding')

        return (
          <div className="space-y-2">
            {/* Auto-Suggest: Onboarding */}
            {istNeu && onboardingVorlagen.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Neuer Mitarbeiter — Onboarding starten?</span>
                </div>
                <div className="flex gap-2">
                  {onboardingVorlagen.map(v => (
                    <button key={v.id} onClick={() => startChecklist(v)}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Suggest: Offboarding */}
            {istAustritt && offboardingVorlagen.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">{austrittsdatum ? `Austritt am ${new Date(austrittsdatum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Mitarbeiter gekündigt/ausgeschieden'} — Offboarding starten?</span>
                </div>
                <div className="flex gap-2">
                  {offboardingVorlagen.map(v => (
                    <button key={v.id} onClick={() => startChecklist(v)}
                      className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manuelle Buttons (Fallback) */}
            {aktiveChecklisten.length === 0 && !istNeu && !istAustritt && (
              <div className="flex flex-wrap gap-2">
                {passendVorlagen.map(v => (
                  <button key={v.id} onClick={() => startChecklist(v)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-brand/10 text-brand border border-brand/20 rounded-lg hover:bg-brand/20">
                    <Plus className="w-3.5 h-3.5" />
                    {v.name} starten
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Completed */}
      {abgeschlossene.length > 0 && (
        <div className="text-xs text-text-muted">
          {abgeschlossene.map(cl => (
            <div key={cl.id} className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {cl.typ === 'onboarding' ? 'Onboarding' : 'Offboarding'} abgeschlossen am {cl.abgeschlossen_am ? new Date(cl.abgeschlossen_am + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Fahrzeug-Berechtigung Section ---

function FahrzeugBerechtigungSection({ mitarbeiterId, editing }) {
  const [berechtigungen, setBerechtigungen] = useState([])
  const [fahrzeuge, setFahrzeuge] = useState([])

  const load = useCallback(async () => {
    const [berRes, fzRes] = await Promise.all([
      supabase.from('mitarbeiter_fahrzeuge').select('*, ressourcen(name)').eq('mitarbeiter_id', mitarbeiterId),
      supabase.from('ressourcen').select('id, name').eq('typ', 'fahrzeug').eq('aktiv', true).order('name'),
    ])
    setBerechtigungen(berRes.data || [])
    setFahrzeuge(fzRes.data || [])
  }, [mitarbeiterId])

  useEffect(() => { load() }, [load])

  const toggle = async (ressourceId, isAllowed) => {
    if (isAllowed) {
      await supabase.from('mitarbeiter_fahrzeuge').delete().eq('mitarbeiter_id', mitarbeiterId).eq('ressource_id', ressourceId)
    } else {
      await supabase.from('mitarbeiter_fahrzeuge').insert({ mitarbeiter_id: mitarbeiterId, ressource_id: ressourceId, einweisung_datum: new Date().toISOString().slice(0, 10) })
    }
    load()
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
        <Truck className="w-4 h-4 text-text-muted" /> Fahrzeug-Berechtigungen
      </h3>
      <div className="flex flex-wrap gap-2">
        {fahrzeuge.map(fz => {
          const ber = berechtigungen.find(b => b.ressource_id === fz.id)
          const isAllowed = !!ber
          return (
            <button key={fz.id} onClick={() => editing && toggle(fz.id, isAllowed)} disabled={!editing}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                isAllowed
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-surface-main border-border-default text-text-muted'
              } ${editing ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}>
              <Car className="w-4 h-4" />
              {fz.name}
              {isAllowed && <CheckCircle className="w-3.5 h-3.5" />}
            </button>
          )
        })}
      </div>
      {berechtigungen.length === 0 && <p className="text-xs text-text-muted">Keine Fahrzeuge zugewiesen</p>}
    </div>
  )
}

// --- Qualifikationen/Zertifikate Section ---

const QUALI_TYPEN = [
  'Staplerschein', 'Ersthelfer', 'SCC', 'Schweißerschein', 'Kranschein',
  'Sicherheitsunterweisung', 'Asbestschein', 'Höhenrettung', 'Sonstiges',
]

function QualifikationenSection({ mitarbeiterId, editing }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ typ: 'Staplerschein', bezeichnung: '', erhalten_am: '', gueltig_bis: '', notiz: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_qualifikationen').select('*').eq('mitarbeiter_id', mitarbeiterId).order('typ')
    setItems(data || [])
  }, [mitarbeiterId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.typ) return
    await supabase.from('mitarbeiter_qualifikationen').insert({
      mitarbeiter_id: mitarbeiterId,
      ...form,
      bezeichnung: form.bezeichnung || form.typ,
      erhalten_am: form.erhalten_am || null,
      gueltig_bis: form.gueltig_bis || null,
    })
    setForm({ typ: 'Staplerschein', bezeichnung: '', erhalten_am: '', gueltig_bis: '', notiz: '' })
    setShowForm(false)
    load()
  }

  const remove = async (id) => {
    await supabase.from('mitarbeiter_qualifikationen').delete().eq('id', id)
    load()
  }

  const getStatus = (item) => {
    if (!item.gueltig_bis) return null
    const days = Math.ceil((new Date(item.gueltig_bis + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    if (days <= 0) return { label: 'Abgelaufen', color: 'text-red-600 bg-red-50', icon: AlertTriangle }
    if (days <= 30) return { label: `${days} Tage`, color: 'text-amber-600 bg-amber-50', icon: AlertTriangle }
    return { label: 'Gültig', color: 'text-green-600 bg-green-50', icon: CheckCircle }
  }

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Award className="w-4 h-4 text-text-muted" /> Qualifikationen & Zertifikate
        </h3>
        {editing && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </button>
        )}
      </div>

      {showForm && editing && (
        <div className="p-3 rounded-lg border border-border-default bg-surface-main space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Typ</label>
              <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className={inputCls}>
                {QUALI_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bezeichnung</label>
              <input value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))} className={inputCls} placeholder={form.typ} />
            </div>
            <div>
              <label className={labelCls}>Erhalten am</label>
              <input type="date" value={form.erhalten_am} onChange={e => setForm(f => ({ ...f, erhalten_am: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Gültig bis</label>
              <input type="date" value={form.gueltig_bis} onChange={e => setForm(f => ({ ...f, gueltig_bis: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90">Speichern</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-xs text-text-muted">Keine Qualifikationen hinterlegt</p>}
        {items.map(item => {
          const status = getStatus(item)
          return (
            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border-default bg-surface-main text-xs">
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-text-muted shrink-0" />
                <div>
                  <span className="font-medium text-text-primary">{item.bezeichnung || item.typ}</span>
                  <span className="text-text-muted ml-2">{item.typ !== item.bezeichnung ? `(${item.typ})` : ''}</span>
                  <div className="text-text-secondary mt-0.5">
                    {item.erhalten_am && <span>Erhalten: {fmtDate(item.erhalten_am)}</span>}
                    {item.gueltig_bis && <span className="ml-3">Gültig bis: {fmtDate(item.gueltig_bis)}</span>}
                  </div>
                </div>
                {status && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                    <status.icon className="w-3 h-3" /> {status.label}
                  </span>
                )}
              </div>
              {editing && (
                <button onClick={() => remove(item.id)} className="p-1 text-text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Fuehrerschein Section ---

const FS_KLASSEN = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'D', 'DE', 'D1', 'D1E', 'T', 'L', 'AM', 'A', 'A1', 'A2']

function FuehrerscheinSection({ mitarbeiterId, editing }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ klasse: 'B', erhalten_am: '', gueltig_bis: '', letzte_pruefung: '', pruef_turnus_monate: 6, notiz: '' })
  const [editId, setEditId] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('mitarbeiter_fuehrerscheine').select('*').eq('mitarbeiter_id', mitarbeiterId).order('klasse')
    setItems(data || [])
  }, [mitarbeiterId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    const row = { mitarbeiter_id: mitarbeiterId, ...form, pruef_turnus_monate: Number(form.pruef_turnus_monate) || 60 }
    for (const k of Object.keys(row)) { if (row[k] === '') row[k] = null }
    if (editId) {
      await supabase.from('mitarbeiter_fuehrerscheine').update(row).eq('id', editId)
    } else {
      await supabase.from('mitarbeiter_fuehrerscheine').insert(row)
    }
    setShowForm(false)
    setEditId(null)
    setForm({ klasse: 'B', erhalten_am: '', gueltig_bis: '', letzte_pruefung: '', pruef_turnus_monate: 6, notiz: '' })
    load()
  }

  const startEdit = (item) => {
    setForm({ klasse: item.klasse, erhalten_am: item.erhalten_am || '', gueltig_bis: item.gueltig_bis || '', letzte_pruefung: item.letzte_pruefung || '', pruef_turnus_monate: item.pruef_turnus_monate || 60, notiz: item.notiz || '' })
    setEditId(item.id)
    setShowForm(true)
  }

  const remove = async (id) => {
    await supabase.from('mitarbeiter_fuehrerscheine').delete().eq('id', id)
    load()
  }

  const getPruefStatus = (item) => {
    if (!item.naechste_pruefung) return null
    const diff = (new Date(item.naechste_pruefung) - new Date()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return { color: 'text-red-600 bg-red-50', label: 'Überfällig', icon: AlertTriangle }
    if (diff < 30) return { color: 'text-red-600 bg-red-50', label: `${Math.ceil(diff)} Tage`, icon: AlertTriangle }
    if (diff < 90) return { color: 'text-amber-600 bg-amber-50', label: `${Math.ceil(diff)} Tage`, icon: AlertTriangle }
    return { color: 'text-emerald-600 bg-emerald-50', label: 'OK', icon: CheckCircle }
  }

  const usedKlassen = items.map(i => i.klasse)
  const availableKlassen = editId ? FS_KLASSEN : FS_KLASSEN.filter(k => !usedKlassen.includes(k))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Führerscheine</h3>
        </div>
        {editing && !showForm && (
          <button onClick={() => { setEditId(null); setForm({ klasse: availableKlassen[0] || 'B', erhalten_am: '', gueltig_bis: '', letzte_pruefung: '', pruef_turnus_monate: 6, notiz: '' }); setShowForm(true) }}
            className="flex items-center gap-1 text-xs text-brand hover:underline"><Plus className="w-3 h-3" /> Hinzufügen</button>
        )}
      </div>

      {showForm && (
        <div className="p-3 rounded-lg border border-brand/30 bg-brand/5 mb-3 space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Klasse *</label>
              {editId ? (
                <input value={form.klasse} disabled className={inputCls + ' opacity-60'} />
              ) : (
                <select value={form.klasse} onChange={e => setForm(f => ({ ...f, klasse: e.target.value }))} className={inputCls}>
                  {availableKlassen.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={labelCls}>Erhalten am</label>
              <input type="date" value={form.erhalten_am} onChange={e => setForm(f => ({ ...f, erhalten_am: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Gültig bis</label>
              <input type="date" value={form.gueltig_bis} onChange={e => setForm(f => ({ ...f, gueltig_bis: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Letzte Prüfung</label>
              <input type="date" value={form.letzte_pruefung} onChange={e => setForm(f => ({ ...f, letzte_pruefung: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Prüf-Turnus (Monate)</label>
              <input type="number" min="1" max="120" value={form.pruef_turnus_monate} onChange={e => setForm(f => ({ ...f, pruef_turnus_monate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notiz</label>
              <input value={form.notiz} onChange={e => setForm(f => ({ ...f, notiz: e.target.value }))} className={inputCls} placeholder="z.B. Kopie liegt vor" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="px-3 py-1 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand/90">{editId ? 'Speichern' : 'Hinzufügen'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary">Abbrechen</button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <p className="text-xs text-text-muted">Keine Führerscheine hinterlegt.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const status = getPruefStatus(item)
            return (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border-default bg-surface-main text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-text-primary text-sm w-8">{item.klasse}</span>
                  <div className="text-text-secondary">
                    {item.erhalten_am && <span>Erhalten: {new Date(item.erhalten_am).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                    {item.gueltig_bis && <span className="ml-3">Gültig bis: {new Date(item.gueltig_bis).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                    {item.letzte_pruefung && <span className="ml-3">Letzte Prüfung: {new Date(item.letzte_pruefung).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                    {item.naechste_pruefung && <span className="ml-3">Nächste: {new Date(item.naechste_pruefung).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                  </div>
                  {status && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                      <status.icon className="w-3 h-3" /> {status.label}
                    </span>
                  )}
                </div>
                {editing && (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-brand" title="Bearbeiten"><Wrench className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(item.id)} className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-red-500" title="Löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
            <div key={k.id || `new-${idx}`} className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <select value={k.typ} onChange={e => updateRow(idx, 'typ', e.target.value)}
                    className={inputCls + ' w-40 flex-shrink-0'}>
                    {Object.entries(KONTAKT_TYP_OPTIONS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                  <input value={k.wert} onChange={e => updateRow(idx, 'wert', e.target.value)}
                    placeholder="Wert (z.B. +49...)" className={inputCls + ' flex-1 min-w-[180px]'} />
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

// Module-level Set. Initial mit System-Defaults (Fallback wenn DB offline).
// Wird beim Component-Mount aus public.zeichen_sperrliste befuellt
// (AM-197 MA-P1c, Single Source of Truth in DB).
const BLOCKED_ZEICHEN = new Set(['SS', 'SA', 'HH', 'KZ', 'NS', 'SD', 'AH', 'HJ'])

async function loadBlockedZeichenFromDB(supabaseClient) {
  try {
    const { data } = await supabaseClient.from('zeichen_sperrliste').select('zeichen')
    if (data) data.forEach(r => BLOCKED_ZEICHEN.add(r.zeichen))
  } catch (e) {
    console.warn('zeichen_sperrliste-Load fehlgeschlagen, nutze Default-Set:', e)
  }
}

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
    // AM-197 MA-P1c: Blocked-Zeichen aus DB laden (erweitert Module-Level Set)
    loadBlockedZeichenFromDB(supabase)
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

    // AM-197 MA-P1d: Zeichen-Aenderung -> Dialog "altes Zeichen fuer andere sperren?"
    const oldZeichen = person?.zeichen?.trim()
    const newZeichen = personForm?.zeichen?.trim()
    let sperreAlteszeichen = false
    if (oldZeichen && newZeichen && oldZeichen !== newZeichen) {
      sperreAlteszeichen = confirm(
        `Zeichen wird von '${oldZeichen}' auf '${newZeichen}' geaendert.\n\n` +
        `Soll '${oldZeichen}' fuer andere Mitarbeiter GESPERRT werden?\n\n` +
        `[OK] Ja, historisieren + sperren (empfohlen bei echter Namens-/Rollen-Aenderung)\n` +
        `[Abbrechen] Nein, nur Typo-Korrektur — '${oldZeichen}' bleibt frei vergebbar`
      )
    }

    setSaving(true)

    try {
      const zeichenSperre = (sperreAlteszeichen && oldZeichen) ? {
        zeichen: oldZeichen,
        grund: `Ehemaliges Zeichen von ${personForm.vorname} ${personForm.nachname}`,
        ex_mitarbeiter_id: ma?.id || null,
      } : null

      const { error } = await supabase.rpc('save_mitarbeiter_detail', {
        p_person_id: person.id,
        p_ma_daten_id: maDaten.id,
        p_person: personForm,
        p_ma_daten: maForm,
        p_kontaktdaten: kontaktdaten,
        p_adressen: adressen,
        p_zeichen_sperre: zeichenSperre,
      })

      if (error) throw error
      if (zeichenSperre) BLOCKED_ZEICHEN.add(oldZeichen)
      toast.success('Gespeichert')
      setEditing(false)
      load()
    } catch (err) {
      console.error('save failed:', err)
      toast.error('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
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
                <Field label="Geburtsort" value={personForm.geburtsort} onChange={v => setPF('geburtsort', v)} disabled={!editing} />
                <Field label="Staatsangehörigkeit" value={personForm.staatsangehoerigkeit} onChange={v => setPF('staatsangehoerigkeit', v)} disabled={!editing} />
                <Field label="Familienstand" value={personForm.familienstand} onChange={v => setPF('familienstand', v)} disabled={!editing} options={{ ledig: 'Ledig', verheiratet: 'Verheiratet', geschieden: 'Geschieden', verwitwet: 'Verwitwet', eingetragene_lp: 'Eingetragene Lebenspartnerschaft' }} />
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
              </div>
            </div>

            {/* Kontaktdaten (dynamic) */}
            <KontaktdatenSection
              kontaktdaten={kontaktdaten}
              setKontaktdaten={setKontaktdaten}
              editing={editing}
              personId={person?.id}
            />

            {/* Adressen */}
            <AdressenSection adressen={adressen} setAdressen={setAdressen} editing={editing} personId={person?.id} />

            {/* Notfallkontakt */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Phone className="w-4 h-4 text-text-muted" /> Notfallkontakt
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <p className="text-xs text-text-muted col-span-3">Notfallkontakt wird künftig über Kontaktdaten abgebildet.</p>
              </div>
            </div>

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
            {/* Beschäftigung (verschoben aus Stamm-Tab) */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Beschäftigung</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Personalnummer" value={maForm.personalnummer} onChange={v => setMF('personalnummer', v)} disabled={!editing} />
                <Field label="Abteilung" value={maForm.abteilung} onChange={v => setMF('abteilung', v)} disabled={!editing}
                  placeholder="z.B. Werkstatt, Verwaltung" suggestions={suggestions.abteilung} />
                <Field label="Funktion / Position" value={maForm.funktion} onChange={v => setMF('funktion', v)} disabled={!editing}
                  placeholder="z.B. Vorarbeiter, Bueroleitung" suggestions={suggestions.funktion} />
                <Field label="Beschäftigungsart" value={maForm.beschaeftigungsart} onChange={v => setMF('beschaeftigungsart', v)} disabled={!editing}
                  options={BESCHAEFTIGUNGSART_OPTIONS} />
                <Field label="Vergütung" value={maForm.verguetungsart} onChange={v => setMF('verguetungsart', v)} disabled={!editing}
                  options={{ gehalt: 'Gehalt', stundenlohn: 'Stundenlohn' }} />
                <Field label="Status" value={maForm.status} onChange={v => setMF('status', v)} disabled={!editing}
                  options={{ aktiv: 'Aktiv', inaktiv: 'Inaktiv', ausgeschieden: 'Ausgeschieden', gekuendigt: 'Gekündigt' }} />
                <Field label="Eintrittsdatum *" value={maForm.eintrittsdatum} type="date" onChange={v => setMF('eintrittsdatum', v)} disabled={!editing} />
                <Field label="Austrittsdatum" value={maForm.austrittsdatum} type="date" onChange={v => setMF('austrittsdatum', v)} disabled={!editing} />
                <Field label="Probezeit (Monate)" value={maForm.probezeit_monate} type="number" onChange={v => setMF('probezeit_monate', v)} disabled={!editing} placeholder="z.B. 6" />
                <Field label="Anzahl Kinder" value={maForm.anzahl_kinder} type="number" onChange={v => setMF('anzahl_kinder', v)} disabled={!editing} />
                <Field label="Urlaubsanspruch (Tage/Jahr)" value={maForm.urlaubsanspruch} type="number" onChange={v => setMF('urlaubsanspruch', v)} disabled={!editing} placeholder="z.B. 30" />
              </div>
            </div>

            {/* Bank / Steuer / SV — direkt nach Beschäftigung */}
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <CreditCard className="w-4 h-4 text-text-muted" /> Bankverbindung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Bank" value={maForm.bank} onChange={v => setMF('bank', v)} disabled={!editing} suggestions={suggestions.bank} />
                <Field label="IBAN" value={maForm.iban} onChange={v => setMF('iban', v)} disabled={!editing} />
                <Field label="BIC" value={maForm.bic} onChange={v => setMF('bic', v)} disabled={!editing} />
              </div>
            </div>
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <Shield className="w-4 h-4 text-text-muted" /> Steuer & Sozialversicherung
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Steuer-ID" value={maForm.steuer_id} onChange={v => setMF('steuer_id', v)} disabled={!editing} placeholder="11-stellig" />
                <Field label="Steuerklasse" value={maForm.steuerklasse} onChange={v => setMF('steuerklasse', v)} disabled={!editing} options={STEUERKLASSE_OPTIONS} />
                <Field label="Kinderfreibeträge" value={maForm.kinderfreibetraege} type="number" onChange={v => setMF('kinderfreibetraege', v)} disabled={!editing} />
                <Field label="Konfession (KiSt)" value={maForm.konfession} onChange={v => setMF('konfession', v)} disabled={!editing} options={KONFESSION_OPTIONS} />
                <Field label="SV-Nummer" value={maForm.sv_nummer} onChange={v => setMF('sv_nummer', v)} disabled={!editing} />
                <Field label="RV-Nummer" value={maForm.rv_nummer} onChange={v => setMF('rv_nummer', v)} disabled={!editing} />
                <Field label="Krankenkasse" value={maForm.krankenkasse} onChange={v => setMF('krankenkasse', v)} disabled={!editing} suggestions={suggestions.krankenkasse} />
              </div>
            </div>

            {/* Gehalt/Lohn */}
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-3 pb-1 border-b border-border-default">
                <CreditCard className="w-4 h-4 text-text-muted" /> Gehalt / Lohn
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {maForm.verguetungsart === 'stundenlohn' ? (
                  <Field label="Stundenlohn (€/h)" value={maForm.lohnsatz_1} type="number" onChange={v => setMF('lohnsatz_1', v)} disabled={!editing} placeholder="z.B. 18,50" />
                ) : (
                  <>
                    <Field label="Bruttogehalt (€/Monat)" value={maForm.lohnsatz_1} type="number" onChange={v => setMF('lohnsatz_1', v)} disabled={!editing} placeholder="z.B. 3200" />
                    <div>
                      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Stundenlohn (berechnet)</span>
                      <p className="mt-1 text-sm text-text-primary font-medium">
                        {(() => {
                          const brutto = Number(maForm.lohnsatz_1)
                          const wochenstunden = Number(maForm.wochenstunden) || 40
                          if (!brutto) return '-'
                          const stundenlohn = (brutto * 3) / 13 / wochenstunden
                          return `${stundenlohn.toFixed(2)} €/h`
                        })()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Arbeitsverträge */}
            <div className="border-t border-border-default pt-4">
              <VertragSection mitarbeiterId={id} editing={editing} pausenregel={maForm.pausenregel} />
            </div>
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Zeiterfassung-Einstellungen</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Frühester Beginn" value={maForm.fruehester_beginn} type="time" onChange={v => setMF('fruehester_beginn', v)} disabled={!editing} />
                <Field label="Rundung Taktung (Min)" value={maForm.rundung_taktung} type="number" onChange={v => setMF('rundung_taktung', v)} disabled={!editing} />
                <Field label="Rundung (Kommen/Gehen)" value={maForm.rundung_kommen} onChange={v => { setMF('rundung_kommen', v); setMF('rundung_gehen', v) }} disabled={!editing}
                  options={{ aufrunden: 'Aufrunden', abrunden: 'Abrunden', auf_ab: 'Auf-/Abrunden' }} />
              </div>
              <div className="mt-3">
                <label className={labelCls}>Pausenregel</label>
                <div className="flex items-center gap-3 text-xs">
                  {(() => {
                    const regel = maForm.pausenregel && typeof maForm.pausenregel === 'object' ? maForm.pausenregel : { '6': 30, '9': 45 }
                    const entries = Object.entries(regel).sort(([a], [b]) => Number(a) - Number(b))
                    return entries.map(([stunden, minuten]) => (
                      <div key={stunden} className="flex items-center gap-1.5 bg-surface-hover px-2.5 py-1.5 rounded-lg">
                        <span className="text-text-muted">Ab</span>
                        {editing ? (
                          <input type="number" min="1" max="12" value={stunden} className="w-10 px-1 py-0.5 text-center border border-border-default rounded bg-surface-main text-text-primary"
                            onChange={e => {
                              const newRegel = { ...regel }
                              delete newRegel[stunden]
                              newRegel[e.target.value] = minuten
                              setMF('pausenregel', newRegel)
                            }} />
                        ) : <span className="font-medium">{stunden}</span>}
                        <span className="text-text-muted">h →</span>
                        {editing ? (
                          <input type="number" min="0" max="120" step="5" value={minuten} className="w-12 px-1 py-0.5 text-center border border-border-default rounded bg-surface-main text-text-primary"
                            onChange={e => {
                              const newRegel = { ...regel }
                              newRegel[stunden] = Number(e.target.value)
                              setMF('pausenregel', newRegel)
                            }} />
                        ) : <span className="font-medium">{minuten}</span>}
                        <span className="text-text-muted">Min Pause</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
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
            <div className="border-t border-border-default pt-4">
              <FuehrerscheinSection mitarbeiterId={id} editing={editing} />
            </div>
            <div className="border-t border-border-default pt-4">
              <FahrzeugBerechtigungSection mitarbeiterId={id} editing={editing} />
            </div>
            <div className="border-t border-border-default pt-4">
              <QualifikationenSection mitarbeiterId={id} editing={editing} />
            </div>
          </div>
        )}


        {tab === 'akte' && (
          <div className="space-y-6">
            <PersonalakteSection mitarbeiterId={id} editing={editing} />
            {/* Kleidergrößen */}
            <div className="border-t border-border-default pt-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 pb-1 border-b border-border-default">Kleidergrößen</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Hose" value={maForm.kleidung_hose} onChange={v => setMF('kleidung_hose', v)} disabled={!editing} placeholder="z.B. 52" />
                <Field label="Jacke" value={maForm.kleidung_jacke} onChange={v => setMF('kleidung_jacke', v)} disabled={!editing} placeholder="z.B. L" />
                <Field label="Pullover" value={maForm.kleidung_pulli} onChange={v => setMF('kleidung_pulli', v)} disabled={!editing} placeholder="z.B. XL" />
                <Field label="T-Shirt" value={maForm.kleidung_tshirt} onChange={v => setMF('kleidung_tshirt', v)} disabled={!editing} placeholder="z.B. L" />
                <Field label="Schuhe" value={maForm.kleidung_schuhe} onChange={v => setMF('kleidung_schuhe', v)} disabled={!editing} placeholder="z.B. 43" />
                <Field label="Handschuhe" value={maForm.kleidung_handschuhe} onChange={v => setMF('kleidung_handschuhe', v)} disabled={!editing} placeholder="z.B. 9" />
              </div>
            </div>
            <div className="border-t border-border-default pt-4">
              <ArbeitsmittelSection mitarbeiterId={id} editing={editing} />
            </div>
            <div className="border-t border-border-default pt-4">
              <OnboardingSection mitarbeiterId={id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
