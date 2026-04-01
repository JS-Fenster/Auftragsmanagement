/**
 * Mitarbeiter — Stammdaten-Verwaltung mit Tabs
 *
 * Datenquelle: mitarbeiter + arbeitsvertraege + abwesenheiten + zeitstempel
 * Tabs: Allgemeines, Personaldaten, Arbeitszeiten, Vertrag, Urlaub
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Users, Search, X, Plus, Clock, Calendar, FileText, Briefcase, UserCheck, Shield, Phone, CreditCard, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLLEN_LABELS = {
  monteur: 'Monteur', buero: 'Büro', geschaeftsfuehrung: 'Geschäftsführung',
  azubi: 'Azubi', teilzeit: 'Teilzeit', minijob: 'Minijob',
}
const STATUS_STYLES = {
  aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv' },
  inaktiv: { bg: '#FEF3C7', text: '#92400E', label: 'Inaktiv' },
  ausgeschieden: { bg: '#F3F4F6', text: '#374151', label: 'Ausgeschieden' },
  elternzeit: { bg: '#EDE9FE', text: '#5B21B6', label: 'Elternzeit' },
  mutterschutz: { bg: '#FCE7F3', text: '#9D174D', label: 'Mutterschutz' },
  kurzarbeit: { bg: '#FEF3C7', text: '#92400E', label: 'Kurzarbeit' },
}
const ANREDEN = { herr: 'Herr', frau: 'Frau', divers: 'Divers' }
const VERGUETUNG = { gehalt: 'Gehalt', stundenlohn: 'Stundenlohn' }
const RUNDUNG_MODI = { aufrunden: 'Aufrunden', abrunden: 'Abrunden', auf_ab: 'Auf-/Abrunden' }

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const inputCls = "w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
const labelCls = "block text-xs font-medium text-text-secondary mb-1"
const sectionCls = "text-sm font-semibold text-text-primary mb-2 pb-1 border-b border-border-default"

function Input({ label, value, onChange, type = 'text', placeholder, required, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}{required && ' *'}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputCls} />
    </div>
  )
}

function Select({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="">--</option>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.aktiv
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

// =========================================================
// MITARBEITER FORM — Tabbed
// =========================================================
function MitarbeiterForm({ mitarbeiter, allMitarbeiter = [], onSave, onCancel }) {
  const isEdit = !!mitarbeiter?.id
  const [tab, setTab] = useState('allgemeines')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const m = mitarbeiter || {}
    setForm({
      // Allgemeines
      anrede: m.anrede || '', vorname: m.vorname || '', nachname: m.nachname || '',
      personalnummer: m.personalnummer || '', zeichen: m.zeichen || '',
      email: m.email || '', telefon: m.telefon || '',
      abteilung: m.abteilung || '', funktion: m.funktion || '',
      rolle: m.rolle || 'monteur', status: m.status || 'aktiv',
      verguetungsart: m.verguetungsart || 'gehalt',
      vorgesetzter_id: m.vorgesetzter_id || '', urlaubsgenehmiger_id: m.urlaubsgenehmiger_id || '',
      eintrittsdatum: m.eintrittsdatum || '', austrittsdatum: m.austrittsdatum || '',
      probezeit_monate: m.probezeit_monate ?? 6, notizen: m.notizen || '',
      // Personaldaten
      geburtsdatum: m.geburtsdatum || '', geburtsort: m.geburtsort || '',
      staatsangehoerigkeit: m.staatsangehoerigkeit || 'Deutsch',
      sv_nummer: m.sv_nummer || '', krankenkasse: m.krankenkasse || '',
      bank: m.bank || '', iban: m.iban || '', bic: m.bic || '',
      lohnsatz_1: m.lohnsatz_1 || '', lohnsatz_2: m.lohnsatz_2 || '', lohnsatz_3: m.lohnsatz_3 || '',
      // Privatadresse
      priv_strasse: m.priv_strasse || '', priv_plz: m.priv_plz || '',
      priv_ort: m.priv_ort || '', priv_land: m.priv_land || '',
      priv_telefon: m.priv_telefon || '', priv_email: m.priv_email || '', priv_mobil: m.priv_mobil || '',
      // Notfallkontakt
      notfall_name: m.notfall_name || '', notfall_telefon: m.notfall_telefon || '',
      // Zeiterfassung
      pausenregel: JSON.stringify(m.pausenregel || { "6": 30, "9": 45 }),
      rundung_taktung: m.rundung_taktung ?? 5,
      rundung_kommen: m.rundung_kommen || 'aufrunden',
      rundung_gehen: m.rundung_gehen || 'abrunden',
      fruehester_beginn: m.fruehester_beginn || '',
    })
  }, [mitarbeiter])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.vorname || !form.nachname || !form.eintrittsdatum) return
    setSaving(true)
    const data = { ...form }
    // Cleanup nullables
    data.probezeit_monate = parseInt(data.probezeit_monate) || 6
    // Auto-calculate probezeit_ende from eintrittsdatum + monate
    if (data.eintrittsdatum && data.probezeit_monate) {
      const d = new Date(data.eintrittsdatum)
      d.setMonth(d.getMonth() + data.probezeit_monate)
      data.probezeit_ende = d.toISOString().slice(0, 10)
    }
    for (const k of ['geburtsdatum', 'austrittsdatum', 'probezeit_ende', 'personalnummer', 'vorgesetzter_id', 'urlaubsgenehmiger_id', 'fruehester_beginn']) {
      if (!data[k]) data[k] = null
    }
    // Parse numeric
    for (const k of ['lohnsatz_1', 'lohnsatz_2', 'lohnsatz_3']) {
      data[k] = data[k] ? parseFloat(data[k]) : 0
    }
    data.rundung_taktung = parseInt(data.rundung_taktung) || 5
    try { data.pausenregel = JSON.parse(data.pausenregel) } catch { data.pausenregel = { "6": 30, "9": 45 } }

    try {
      if (isEdit) {
        const { error } = await supabase.from('mitarbeiter').update(data).eq('id', mitarbeiter.id)
        if (error) { console.error('Update error:', error); setSaving(false); return }
      } else {
        const { error } = await supabase.from('mitarbeiter').insert(data)
        if (error) { console.error('Insert error:', error); setSaving(false); return }
      }
      onSave()
    } finally { setSaving(false) }
  }

  const vorgesetzteOptions = Object.fromEntries(
    allMitarbeiter.filter(m => m.id !== mitarbeiter?.id).map(m => [m.id, `${m.vorname} ${m.nachname}`])
  )

  const TABS = [
    { key: 'allgemeines', label: 'Allgemeines', icon: FileText },
    { key: 'personal', label: 'Personaldaten', icon: Shield },
    { key: 'privat', label: 'Privat / Notfall', icon: Phone },
    { key: 'arbeitszeit', label: 'Arbeitszeiten', icon: Clock },
  ]

  return (
    <div className="bg-surface-card rounded-lg border border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <h3 className="text-base font-semibold text-text-primary">
          {isEdit ? `${form.vorname} ${form.nachname} bearbeiten` : 'Neuer Mitarbeiter'}
        </h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.vorname || !form.nachname || !form.eintrittsdatum}
            className="px-4 py-1.5 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default px-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {tab === 'allgemeines' && (<>
          <div className="grid grid-cols-4 gap-3">
            <Select label="Anrede" value={form.anrede} onChange={v => set('anrede', v)} options={ANREDEN} />
            <Input label="Vorname" value={form.vorname} onChange={v => set('vorname', v)} required />
            <Input label="Nachname" value={form.nachname} onChange={v => set('nachname', v)} required />
            <div>
              <label className={labelCls}>Zeichen</label>
              <div className="flex gap-1">
                <input type="text" value={form.zeichen} onChange={e => set('zeichen', e.target.value)}
                  placeholder="z.B. ANST" className={inputCls} />
                <button type="button" onClick={() => {
                  const v = (form.vorname || '').slice(0, 2).toUpperCase()
                  const n = (form.nachname || '').slice(0, 2).toUpperCase()
                  set('zeichen', v + n)
                }} className="px-2 py-1 text-[10px] text-brand hover:bg-brand/10 rounded shrink-0" title="Auto-generieren">Auto</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Personalnummer" value={form.personalnummer} onChange={v => set('personalnummer', v)} placeholder="z.B. 3" />
            <Select label="Rolle" value={form.rolle} onChange={v => set('rolle', v)} options={ROLLEN_LABELS} />
            <Input label="Abteilung" value={form.abteilung} onChange={v => set('abteilung', v)} placeholder="z.B. Montage" />
            <Input label="Funktion" value={form.funktion} onChange={v => set('funktion', v)} placeholder="z.B. Servicetechniker" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={form.status} onChange={v => set('status', v)}
              options={Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.label]))} />
            <Select label="Verguetungsart" value={form.verguetungsart} onChange={v => set('verguetungsart', v)} options={VERGUETUNG} />
            <Input label="Email (Firma)" value={form.email} onChange={v => set('email', v)} type="email" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Telefon (Firma)" value={form.telefon} onChange={v => set('telefon', v)} />
            <Select label="Vorgesetzter" value={form.vorgesetzter_id} onChange={v => set('vorgesetzter_id', v)} options={vorgesetzteOptions} />
            <Select label="Urlaubsgenehmiger" value={form.urlaubsgenehmiger_id} onChange={v => set('urlaubsgenehmiger_id', v)} options={vorgesetzteOptions} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Eintrittsdatum" value={form.eintrittsdatum} onChange={v => set('eintrittsdatum', v)} type="date" required />
            <div>
              <label className={labelCls}>Probezeit (Monate)</label>
              <input type="number" value={form.probezeit_monate} onChange={e => set('probezeit_monate', e.target.value)}
                min="0" max="12" className={inputCls} />
              {form.eintrittsdatum && form.probezeit_monate > 0 && (
                <p className="text-[10px] text-text-muted mt-0.5">
                  Endet: {(() => { const d = new Date(form.eintrittsdatum); d.setMonth(d.getMonth() + parseInt(form.probezeit_monate || 0)); return formatDate(d) })()}
                </p>
              )}
            </div>
            <Input label="Austrittsdatum" value={form.austrittsdatum} onChange={v => set('austrittsdatum', v)} type="date" />
          </div>
          <div>
            <label className={labelCls}>Notizen</label>
            <textarea value={form.notizen} onChange={e => set('notizen', e.target.value)} rows={2} className={inputCls + ' resize-none'} />
          </div>
        </>)}

        {tab === 'personal' && (<>
          <p className={sectionCls}>Allgemeine Personaldaten</p>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Geburtsdatum" value={form.geburtsdatum} onChange={v => set('geburtsdatum', v)} type="date" />
            <Input label="Geburtsort" value={form.geburtsort} onChange={v => set('geburtsort', v)} />
            <Input label="Staatsangehörigkeit" value={form.staatsangehoerigkeit} onChange={v => set('staatsangehoerigkeit', v)} />
            <Input label="Sozialversicherungsnr." value={form.sv_nummer} onChange={v => set('sv_nummer', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Krankenkasse" value={form.krankenkasse} onChange={v => set('krankenkasse', v)} />
          </div>
          <p className={sectionCls}>Bankverbindung</p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bank" value={form.bank} onChange={v => set('bank', v)} />
            <Input label="IBAN" value={form.iban} onChange={v => set('iban', v)} />
            <Input label="BIC" value={form.bic} onChange={v => set('bic', v)} />
          </div>
          <p className={sectionCls}>Lohnsaetze</p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Lohnsatz 1" value={form.lohnsatz_1} onChange={v => set('lohnsatz_1', v)} type="number" />
            <Input label="Lohnsatz 2" value={form.lohnsatz_2} onChange={v => set('lohnsatz_2', v)} type="number" />
            <Input label="Lohnsatz 3" value={form.lohnsatz_3} onChange={v => set('lohnsatz_3', v)} type="number" />
          </div>
        </>)}

        {tab === 'privat' && (<>
          <p className={sectionCls}>Privatadresse</p>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Straße" value={form.priv_strasse} onChange={v => set('priv_strasse', v)} className="col-span-2" />
            <Input label="PLZ" value={form.priv_plz} onChange={v => set('priv_plz', v)} />
            <Input label="Ort" value={form.priv_ort} onChange={v => set('priv_ort', v)} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Land" value={form.priv_land} onChange={v => set('priv_land', v)} />
          </div>
          <p className={sectionCls}>Private Kontaktdaten</p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Privat-Telefon" value={form.priv_telefon} onChange={v => set('priv_telefon', v)} />
            <Input label="Privat-Email" value={form.priv_email} onChange={v => set('priv_email', v)} type="email" />
            <Input label="Privat-Mobil" value={form.priv_mobil} onChange={v => set('priv_mobil', v)} />
          </div>
          <p className={sectionCls}>Notfallkontakt</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Notfall: Name" value={form.notfall_name} onChange={v => set('notfall_name', v)} placeholder="Name der Kontaktperson" />
            <Input label="Notfall: Telefon" value={form.notfall_telefon} onChange={v => set('notfall_telefon', v)} placeholder="Telefonnummer" />
          </div>
        </>)}

        {tab === 'arbeitszeit' && (<>
          <p className={sectionCls}>Pausenregel</p>
          <div>
            <label className={labelCls}>Regel (JSON: "ab_stunden": minuten_pause)</label>
            <input type="text" value={form.pausenregel} onChange={e => set('pausenregel', e.target.value)}
              placeholder='{"6":30,"9":45}' className={inputCls} />
            <p className="text-[10px] text-text-muted mt-1">Standard: Ab 6h = 30 Min, ab 9h = 45 Min (ArbZG)</p>
          </div>
          <p className={sectionCls}>Rundung</p>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Taktung (Minuten)</label>
              <input type="number" value={form.rundung_taktung} onChange={e => set('rundung_taktung', e.target.value)}
                min="1" max="30" className={inputCls} />
            </div>
            <Select label="Kommen-Rundung" value={form.rundung_kommen} onChange={v => set('rundung_kommen', v)} options={RUNDUNG_MODI} />
            <Select label="Gehen-Rundung" value={form.rundung_gehen} onChange={v => set('rundung_gehen', v)} options={RUNDUNG_MODI} />
            <Input label="Fruehester Beginn" value={form.fruehester_beginn} onChange={v => set('fruehester_beginn', v)} type="time" />
          </div>
        </>)}
      </div>
    </div>
  )
}

// =========================================================
// VERTRAG SECTION
// =========================================================
function VertragSection({ mitarbeiterId }) {
  const [vertraege, setVertraege] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ gueltig_ab: '', wochenstunden: '40', arbeitstage_pro_woche: '5', urlaubstage_jahr: '30', notiz: '' })

  useEffect(() => {
    if (!mitarbeiterId) return
    supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', mitarbeiterId)
      .order('gueltig_ab', { ascending: false }).then(({ data }) => setVertraege(data || []))
  }, [mitarbeiterId])

  const handleSave = async () => {
    if (!form.gueltig_ab) return
    const current = vertraege.find(v => !v.gueltig_bis)
    if (current) {
      const prevEnd = new Date(form.gueltig_ab); prevEnd.setDate(prevEnd.getDate() - 1)
      await supabase.from('arbeitsvertraege').update({ gueltig_bis: prevEnd.toISOString().slice(0, 10) }).eq('id', current.id)
    }
    await supabase.from('arbeitsvertraege').insert({
      mitarbeiter_id: mitarbeiterId, gueltig_ab: form.gueltig_ab,
      wochenstunden: parseFloat(form.wochenstunden), arbeitstage_pro_woche: parseInt(form.arbeitstage_pro_woche),
      urlaubstage_jahr: parseInt(form.urlaubstage_jahr), notiz: form.notiz || null,
    })
    setShowForm(false)
    const { data } = await supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', mitarbeiterId).order('gueltig_ab', { ascending: false })
    setVertraege(data || [])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-text-muted" /> Arbeitsvertraege</h4>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Neue Periode
        </button>
      </div>
      {showForm && (
        <div className="p-3 bg-surface-main rounded-lg border border-border-default space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div><label className="block text-[10px] text-text-muted mb-0.5">Gueltig ab *</label>
              <input type="date" value={form.gueltig_ab} onChange={e => setForm(f => ({ ...f, gueltig_ab: e.target.value }))} className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" /></div>
            <div><label className="block text-[10px] text-text-muted mb-0.5">Wochenstunden</label>
              <input type="number" value={form.wochenstunden} onChange={e => setForm(f => ({ ...f, wochenstunden: e.target.value }))} className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" /></div>
            <div><label className="block text-[10px] text-text-muted mb-0.5">Tage/Woche</label>
              <input type="number" value={form.arbeitstage_pro_woche} onChange={e => setForm(f => ({ ...f, arbeitstage_pro_woche: e.target.value }))} className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" /></div>
            <div><label className="block text-[10px] text-text-muted mb-0.5">Urlaubstage/Jahr</label>
              <input type="number" value={form.urlaubstage_jahr} onChange={e => setForm(f => ({ ...f, urlaubstage_jahr: e.target.value }))} className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover rounded">Abbrechen</button>
            <button onClick={handleSave} disabled={!form.gueltig_ab} className="px-3 py-1 text-xs font-medium bg-[var(--brand)] text-[#1f2937] rounded hover:opacity-90 disabled:opacity-50">Speichern</button>
          </div>
        </div>
      )}
      {vertraege.length === 0 ? <p className="text-xs text-text-muted">Kein Arbeitsvertrag hinterlegt</p> : (
        <div className="space-y-1.5">
          {vertraege.map(v => (
            <div key={v.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${!v.gueltig_bis ? 'bg-brand/5 border border-brand/20' : 'bg-surface-main border border-border-default'}`}>
              <div>
                <span className="font-medium text-text-primary">{v.wochenstunden}h/Woche</span>
                <span className="text-text-muted ml-2">{v.arbeitstage_pro_woche} Tage</span>
                <span className="text-text-muted ml-2">{v.urlaubstage_jahr} Urlaubstage</span>
              </div>
              <div className="text-text-muted">
                {formatDate(v.gueltig_ab)} – {v.gueltig_bis ? formatDate(v.gueltig_bis) : 'heute'}
                {!v.gueltig_bis && <span className="ml-1.5 text-brand font-medium">aktuell</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UrlaubSection({ mitarbeiterId }) {
  const [konto, setKonto] = useState(null)
  const jahr = new Date().getFullYear()
  useEffect(() => {
    if (!mitarbeiterId) return
    supabase.rpc('berechne_urlaubskonto', { p_mitarbeiter_id: mitarbeiterId, p_jahr: jahr })
      .then(({ data }) => { if (data?.[0]) setKonto(data[0]) })
  }, [mitarbeiterId, jahr])

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Calendar className="w-4 h-4 text-text-muted" /> Urlaubskonto {jahr}</h4>
      {!konto ? <p className="text-xs text-text-muted">Wird berechnet...</p> : (
        <div className="grid grid-cols-4 gap-3">
          {[['Anspruch', konto.anspruch, ''], ['Uebertrag', konto.uebertrag, 'Vorjahr'], ['Genommen', konto.genommen, ''], ['Rest', konto.rest, '']].map(([l, v, sub], i) => (
            <div key={i} className={`rounded-lg p-3 text-center ${i === 3 ? 'bg-brand/5 border border-brand/20' : 'bg-surface-main'}`}>
              <p className={`text-xs ${i === 3 ? 'text-brand' : 'text-text-muted'}`}>{l}</p>
              <p className={`text-xl font-bold ${i === 3 ? 'text-brand' : 'text-text-primary'}`}>{v}</p>
              {sub && <p className="text-[10px] text-text-muted">{sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =========================================================
// MAIN PAGE
// =========================================================
export default function Mitarbeiter() {
  const navigate = useNavigate()
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('aktiv')
  const [showCreate, setShowCreate] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('mitarbeiter').select('*, arbeitsvertraege(*)').order('nachname')
    setMitarbeiter(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let list = mitarbeiter
    if (filterStatus && filterStatus !== 'alle') list = list.filter(m => m.status === filterStatus)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(m => m.vorname?.toLowerCase().includes(q) || m.nachname?.toLowerCase().includes(q) || m.personalnummer?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
    }
    return list
  }, [mitarbeiter, filterStatus, searchTerm])

  const kpis = useMemo(() => ({
    aktiv: mitarbeiter.filter(m => m.status === 'aktiv').length,
    monteure: mitarbeiter.filter(m => m.rolle === 'monteur' && m.status === 'aktiv').length,
    buero: mitarbeiter.filter(m => ['buero', 'teilzeit', 'minijob'].includes(m.rolle) && m.status === 'aktiv').length,
    gf: mitarbeiter.filter(m => m.rolle === 'geschaeftsfuehrung' && m.status === 'aktiv').length,
  }), [mitarbeiter])

  const getVertrag = (ma) => ma.arbeitsvertraege?.find(v => !v.gueltig_bis) || ma.arbeitsvertraege?.[0]

  return (
    <div className="min-h-screen bg-surface-main p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Mitarbeiter</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> Neuer Mitarbeiter
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Aktive Mitarbeiter" value={kpis.aktiv} icon={UserCheck} color="#10B981" />
        <KpiCard label="Monteure" value={kpis.monteure} icon={Users} color="#3B82F6" />
        <KpiCard label="Büro / Teilzeit" value={kpis.buero} icon={Briefcase} color="#8B5CF6" />
        <KpiCard label="Geschäftsführung" value={kpis.gf} icon={UserCheck} color="#F59E0B" />
      </div>

      {showCreate && (
        <div className="mb-6">
          <MitarbeiterForm
            mitarbeiter={null}
            allMitarbeiter={mitarbeiter}
            onSave={() => { setShowCreate(false); loadData() }}
            onCancel={() => setShowCreate(false)} />
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Name, Nr. oder Email suchen..." className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-card outline-none" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-text-muted" /></button>}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-card outline-none">
          <option value="alle">Alle Status</option>
          <option value="aktiv">Aktiv</option>
          <option value="ausgeschieden">Ausgeschieden</option>
          <option value="elternzeit">Elternzeit</option>
          <option value="inaktiv">Inaktiv</option>
        </select>
      </div>

      {loading ? <div className="flex items-center justify-center h-40 text-text-muted">Laden...</div>
      : filtered.length === 0 ? <div className="flex items-center justify-center h-40 text-text-muted text-sm">{mitarbeiter.length === 0 ? 'Noch keine Mitarbeiter angelegt' : 'Keine Treffer'}</div>
      : (
        <div className="bg-surface-card rounded-lg shadow-sm border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-main text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Nr.</th>
                <th className="px-4 py-2 text-left">Rolle</th>
                <th className="px-4 py-2 text-left">Funktion</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Eintritt</th>
                <th className="px-4 py-2 text-left">Vertrag</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ma => {
                const vertrag = getVertrag(ma)
                return (
                  <tr key={ma.id} className="border-b border-border-default last:border-b-0 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                    onClick={() => navigate(`/mitarbeiter/${ma.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{ma.vorname} {ma.nachname}</div>
                      {ma.email && <div className="text-xs text-text-muted">{ma.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{ma.personalnummer || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{ROLLEN_LABELS[ma.rolle] || ma.rolle}</td>
                    <td className="px-4 py-3 text-text-secondary">{ma.funktion || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={ma.status} /></td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(ma.eintrittsdatum)}</td>
                    <td className="px-4 py-3 text-text-secondary">{vertrag ? `${vertrag.wochenstunden}h / ${vertrag.urlaubstage_jahr}T` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-text-muted text-xs">→</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

        </div>
      )}
    </div>
  )
}
