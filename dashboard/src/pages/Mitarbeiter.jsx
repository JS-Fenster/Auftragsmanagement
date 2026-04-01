/**
 * Mitarbeiter — Stammdaten-Verwaltung
 *
 * Datenquelle: mitarbeiter + arbeitsvertraege + abwesenheiten
 * Pattern: KPI-Cards + Suche + Liste + Inline-Detail mit Tabs
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Users, Search, X, Plus, ChevronDown, ChevronUp, Clock, Calendar, FileText, Briefcase, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ROLLEN_LABELS = {
  monteur: 'Monteur',
  buero: 'Buero',
  geschaeftsfuehrung: 'Geschaeftsfuehrung',
  azubi: 'Azubi',
  teilzeit: 'Teilzeit',
  minijob: 'Minijob',
}

const STATUS_STYLES = {
  aktiv: { bg: '#ECFDF5', text: '#065F46', label: 'Aktiv' },
  inaktiv: { bg: '#FEF3C7', text: '#92400E', label: 'Inaktiv' },
  ausgeschieden: { bg: '#F3F4F6', text: '#374151', label: 'Ausgeschieden' },
  elternzeit: { bg: '#EDE9FE', text: '#5B21B6', label: 'Elternzeit' },
  mutterschutz: { bg: '#FCE7F3', text: '#9D174D', label: 'Mutterschutz' },
  kurzarbeit: { bg: '#FEF3C7', text: '#92400E', label: 'Kurzarbeit' },
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function KpiCard({ label, value, subtitle, icon: Icon, color }) {
  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  )
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.aktiv
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function MitarbeiterForm({ mitarbeiter, onSave, onCancel }) {
  const isEdit = !!mitarbeiter?.id
  const [form, setForm] = useState({
    vorname: '', nachname: '', personalnummer: '', email: '', telefon: '',
    geburtsdatum: '', eintrittsdatum: '', austrittsdatum: '', probezeit_ende: '',
    status: 'aktiv', rolle: 'monteur', notizen: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mitarbeiter) {
      setForm({
        vorname: mitarbeiter.vorname || '',
        nachname: mitarbeiter.nachname || '',
        personalnummer: mitarbeiter.personalnummer || '',
        email: mitarbeiter.email || '',
        telefon: mitarbeiter.telefon || '',
        geburtsdatum: mitarbeiter.geburtsdatum || '',
        eintrittsdatum: mitarbeiter.eintrittsdatum || '',
        austrittsdatum: mitarbeiter.austrittsdatum || '',
        probezeit_ende: mitarbeiter.probezeit_ende || '',
        status: mitarbeiter.status || 'aktiv',
        rolle: mitarbeiter.rolle || 'monteur',
        notizen: mitarbeiter.notizen || '',
      })
    }
  }, [mitarbeiter])

  const handleSave = async () => {
    if (!form.vorname || !form.nachname || !form.eintrittsdatum) return
    setSaving(true)
    const data = {
      ...form,
      geburtsdatum: form.geburtsdatum || null,
      austrittsdatum: form.austrittsdatum || null,
      probezeit_ende: form.probezeit_ende || null,
      personalnummer: form.personalnummer || null,
    }
    try {
      if (isEdit) {
        await supabase.from('mitarbeiter').update(data).eq('id', mitarbeiter.id)
      } else {
        await supabase.from('mitarbeiter').insert(data)
      }
      onSave()
    } catch (err) {
      console.error('Mitarbeiter save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="bg-surface-card rounded-lg border border-border-default p-5 space-y-4">
      <h3 className="text-base font-semibold text-text-primary">
        {isEdit ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Vorname *</label>
          <input type="text" value={form.vorname} onChange={e => set('vorname', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Nachname *</label>
          <input type="text" value={form.nachname} onChange={e => set('nachname', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Personalnummer</label>
          <input type="text" value={form.personalnummer} onChange={e => set('personalnummer', e.target.value)}
            placeholder="z.B. MA-001"
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Rolle</label>
          <select value={form.rolle} onChange={e => set('rolle', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none">
            {Object.entries(ROLLEN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none">
            {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Telefon</label>
          <input type="text" value={form.telefon} onChange={e => set('telefon', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Geburtsdatum</label>
          <input type="date" value={form.geburtsdatum} onChange={e => set('geburtsdatum', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Eintrittsdatum *</label>
          <input type="date" value={form.eintrittsdatum} onChange={e => set('eintrittsdatum', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Probezeit bis</label>
          <input type="date" value={form.probezeit_ende} onChange={e => set('probezeit_ende', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Austrittsdatum</label>
          <input type="date" value={form.austrittsdatum} onChange={e => set('austrittsdatum', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Notizen</label>
        <textarea value={form.notizen} onChange={e => set('notizen', e.target.value)} rows={2}
          className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none resize-none" />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">
          Abbrechen
        </button>
        <button onClick={handleSave}
          disabled={saving || !form.vorname || !form.nachname || !form.eintrittsdatum}
          className="px-4 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? 'Speichern...' : isEdit ? 'Speichern' : 'Anlegen'}
        </button>
      </div>
    </div>
  )
}

function VertragSection({ mitarbeiterId }) {
  const [vertraege, setVertraege] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    gueltig_ab: '', wochenstunden: '40', arbeitstage_pro_woche: '5', urlaubstage_jahr: '30', notiz: '',
  })

  useEffect(() => {
    if (!mitarbeiterId) return
    supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', mitarbeiterId)
      .order('gueltig_ab', { ascending: false })
      .then(({ data }) => setVertraege(data || []))
  }, [mitarbeiterId])

  const handleSave = async () => {
    if (!form.gueltig_ab) return
    // Close previous contract
    const current = vertraege.find(v => !v.gueltig_bis)
    if (current) {
      const prevEnd = new Date(form.gueltig_ab)
      prevEnd.setDate(prevEnd.getDate() - 1)
      await supabase.from('arbeitsvertraege').update({ gueltig_bis: prevEnd.toISOString().slice(0, 10) }).eq('id', current.id)
    }
    await supabase.from('arbeitsvertraege').insert({
      mitarbeiter_id: mitarbeiterId,
      gueltig_ab: form.gueltig_ab,
      wochenstunden: parseFloat(form.wochenstunden),
      arbeitstage_pro_woche: parseInt(form.arbeitstage_pro_woche),
      urlaubstage_jahr: parseInt(form.urlaubstage_jahr),
      notiz: form.notiz || null,
    })
    setShowForm(false)
    const { data } = await supabase.from('arbeitsvertraege').select('*').eq('mitarbeiter_id', mitarbeiterId).order('gueltig_ab', { ascending: false })
    setVertraege(data || [])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-text-muted" />
          Arbeitsvertraege
        </h4>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Neue Periode
        </button>
      </div>

      {showForm && (
        <div className="p-3 bg-surface-main rounded-lg border border-border-default space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Gueltig ab *</label>
              <input type="date" value={form.gueltig_ab} onChange={e => setForm(f => ({ ...f, gueltig_ab: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Wochenstunden</label>
              <input type="number" value={form.wochenstunden} onChange={e => setForm(f => ({ ...f, wochenstunden: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Arbeitstage/Woche</label>
              <input type="number" value={form.arbeitstage_pro_woche} onChange={e => setForm(f => ({ ...f, arbeitstage_pro_woche: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Urlaubstage/Jahr</label>
              <input type="number" value={form.urlaubstage_jahr} onChange={e => setForm(f => ({ ...f, urlaubstage_jahr: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover rounded">Abbrechen</button>
            <button onClick={handleSave} disabled={!form.gueltig_ab}
              className="px-3 py-1 text-xs font-medium bg-[var(--brand)] text-[#1f2937] rounded hover:opacity-90 disabled:opacity-50">Speichern</button>
          </div>
        </div>
      )}

      {vertraege.length === 0 ? (
        <p className="text-xs text-text-muted">Kein Arbeitsvertrag hinterlegt</p>
      ) : (
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
      .then(({ data, error }) => {
        if (data && data.length > 0) setKonto(data[0])
        else if (error) console.error('Urlaubskonto error:', error)
      })
  }, [mitarbeiterId, jahr])

  if (!konto) return <p className="text-xs text-text-muted">Urlaubskonto wird berechnet...</p>

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-text-muted" />
        Urlaubskonto {jahr}
      </h4>
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface-main rounded-lg p-3 text-center">
          <p className="text-xs text-text-muted">Anspruch</p>
          <p className="text-xl font-bold text-text-primary">{konto.anspruch}</p>
          <p className="text-[10px] text-text-muted">Tage</p>
        </div>
        <div className="bg-surface-main rounded-lg p-3 text-center">
          <p className="text-xs text-text-muted">Uebertrag</p>
          <p className="text-xl font-bold text-text-primary">{konto.uebertrag}</p>
          <p className="text-[10px] text-text-muted">Vorjahr</p>
        </div>
        <div className="bg-surface-main rounded-lg p-3 text-center">
          <p className="text-xs text-text-muted">Genommen</p>
          <p className="text-xl font-bold text-text-primary">{konto.genommen}</p>
          <p className="text-[10px] text-text-muted">Tage</p>
        </div>
        <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 text-center">
          <p className="text-xs text-brand">Restanspruch</p>
          <p className="text-xl font-bold text-brand">{konto.rest}</p>
          <p className="text-[10px] text-text-muted">Tage</p>
        </div>
      </div>
    </div>
  )
}

export default function Mitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('aktiv')
  const [expandedId, setExpandedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('mitarbeiter')
      .select('*, arbeitsvertraege(*)')
      .order('nachname')
    if (error) console.error('Mitarbeiter load error:', error)
    setMitarbeiter(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let list = mitarbeiter
    if (filterStatus && filterStatus !== 'alle') {
      list = list.filter(m => m.status === filterStatus)
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(m =>
        m.vorname?.toLowerCase().includes(q) ||
        m.nachname?.toLowerCase().includes(q) ||
        m.personalnummer?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [mitarbeiter, filterStatus, searchTerm])

  const kpis = useMemo(() => {
    const aktiv = mitarbeiter.filter(m => m.status === 'aktiv').length
    const monteure = mitarbeiter.filter(m => m.rolle === 'monteur' && m.status === 'aktiv').length
    const buero = mitarbeiter.filter(m => m.rolle === 'buero' && m.status === 'aktiv').length
    const gf = mitarbeiter.filter(m => m.rolle === 'geschaeftsfuehrung' && m.status === 'aktiv').length
    return { aktiv, monteure, buero, gf }
  }, [mitarbeiter])

  const getCurrentVertrag = (ma) => {
    return ma.arbeitsvertraege?.find(v => !v.gueltig_bis) || ma.arbeitsvertraege?.[0]
  }

  return (
    <div className="min-h-screen bg-surface-main p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Mitarbeiter</h1>
        </div>
        <button onClick={() => { setShowCreate(true); setEditId(null) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-[#1f2937] rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> Neuer Mitarbeiter
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Aktive Mitarbeiter" value={kpis.aktiv} icon={UserCheck} color="#10B981" />
        <KpiCard label="Monteure" value={kpis.monteure} icon={Users} color="#3B82F6" />
        <KpiCard label="Buero" value={kpis.buero} icon={Briefcase} color="#8B5CF6" />
        <KpiCard label="Geschaeftsfuehrung" value={kpis.gf} icon={UserCheck} color="#F59E0B" />
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6">
          <MitarbeiterForm onSave={() => { setShowCreate(false); loadData() }} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {/* Search + Filter */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Name, Personalnummer oder Email suchen..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-card outline-none" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-text-muted">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-text-muted text-sm">
          {mitarbeiter.length === 0 ? 'Noch keine Mitarbeiter angelegt' : 'Keine Treffer'}
        </div>
      ) : (
        <div className="bg-surface-card rounded-lg shadow-sm border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-main text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Nr.</th>
                <th className="px-4 py-2 text-left">Rolle</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Eintritt</th>
                <th className="px-4 py-2 text-left">Vertrag</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ma => {
                const expanded = expandedId === ma.id
                const vertrag = getCurrentVertrag(ma)
                return (
                  <tr key={ma.id} className="border-b border-border-default last:border-b-0 group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{ma.vorname} {ma.nachname}</div>
                      {ma.email && <div className="text-xs text-text-muted">{ma.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{ma.personalnummer || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{ROLLEN_LABELS[ma.rolle] || ma.rolle}</td>
                    <td className="px-4 py-3"><StatusBadge status={ma.status} /></td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(ma.eintrittsdatum)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {vertrag ? `${vertrag.wochenstunden}h / ${vertrag.urlaubstage_jahr}T` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(expanded ? null : ma.id)}
                        className="p-1 hover:bg-surface-hover rounded transition-colors">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Expanded Detail */}
          {expandedId && (() => {
            const ma = filtered.find(m => m.id === expandedId)
            if (!ma) return null
            return (
              <div className="border-t border-border-default bg-surface-main p-5 space-y-6">
                {editId === ma.id ? (
                  <MitarbeiterForm mitarbeiter={ma}
                    onSave={() => { setEditId(null); loadData() }}
                    onCancel={() => setEditId(null)} />
                ) : (
                  <>
                    <div className="flex justify-end">
                      <button onClick={() => setEditId(ma.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg">
                        <FileText className="w-3.5 h-3.5" /> Stammdaten bearbeiten
                      </button>
                    </div>
                    <VertragSection mitarbeiterId={ma.id} />
                    <UrlaubSection mitarbeiterId={ma.id} />
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
