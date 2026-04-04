/**
 * Objekte — Gebaeuderegister
 *
 * Eigenstaendige Entitaet: Das Gebaeude bleibt, Eigentuemer und Auftraege wechseln.
 * Zeigt die komplette Historie aller Auftraege/Projekte an einer Adresse.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Building2, Search, Plus, X, MapPin, ChevronRight, FolderKanban, Calendar, User, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GEBAEUDE_TYPEN = {
  einfamilienhaus: 'Einfamilienhaus',
  mehrfamilienhaus: 'Mehrfamilienhaus',
  doppelhaushaelfte: 'Doppelhaushälfte',
  reihenhaus: 'Reihenhaus',
  gewerbe: 'Gewerbe',
  oeffentlich: 'Öffentliches Gebäude',
  industrie: 'Industrie',
  sonstiges: 'Sonstiges',
}

const STATUS_COLORS = {
  anfrage: '#9CA3AF', angebot: '#3B82F6', auftrag: '#8B5CF6', bestellt: '#F59E0B',
  ab_erhalten: '#F59E0B', lieferung_geplant: '#F97316', montagebereit: '#10B981',
  abnahme: '#06B6D4', rechnung: '#6366F1', bezahlt: '#22C55E', erledigt: '#6B7280',
  storniert: '#EF4444', pausiert: '#F59E0B', reklamation: '#EF4444',
}

const STATUS_LABELS = {
  anfrage: 'Anfrage', angebot: 'Angebot', auftrag: 'Auftrag', bestellt: 'Bestellt',
  ab_erhalten: 'AB erhalten', lieferung_geplant: 'Lieferung geplant', montagebereit: 'Montagebereit',
  abnahme: 'Abnahme', rechnung: 'Rechnung', bezahlt: 'Bezahlt', erledigt: 'Erledigt',
  storniert: 'Storniert', pausiert: 'Pausiert', reklamation: 'Reklamation',
}

const inputCls = "w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"
const selectCls = "px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none"

function formatDate(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(v) {
  if (!v) return '-'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function Objekte() {
  const navigate = useNavigate()
  const [objekte, setObjekte] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedObjekt, setSelectedObjekt] = useState(null)
  const [projekte, setProjekte] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create form
  const [form, setForm] = useState({
    bezeichnung: '', adresse_strasse: '', adresse_plz: '', adresse_ort: '',
    gebaeude_typ: 'einfamilienhaus', einheiten: 1, baujahr: '', notizen: '',
  })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loadObjekte = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('objekte').select('*').order('adresse_ort').order('adresse_strasse')
    setObjekte(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadObjekte() }, [loadObjekte])

  const loadObjektDetail = useCallback(async (objektId) => {
    setLoadingDetail(true)
    const { data } = await supabase
      .from('projekte')
      .select('id, projekt_nummer, titel, status, typ, gewerk, bauart, auftragsart, angebots_wert, auftrags_wert, kontakt_id, created_at, updated_at, kontakte!projekte_kontakt_id_fkey(firma1, firma2)')
      .eq('objekt_id', objektId)
      .order('created_at', { ascending: false })
    setProjekte(data || [])
    setLoadingDetail(false)
  }, [])

  useEffect(() => {
    if (selectedObjekt) loadObjektDetail(selectedObjekt.id)
  }, [selectedObjekt, loadObjektDetail])

  const handleCreate = async () => {
    if (!form.adresse_strasse || !form.adresse_ort) return
    setSaving(true)
    const { data } = await supabase.from('objekte').insert({
      ...form,
      baujahr: form.baujahr ? parseInt(form.baujahr) : null,
      einheiten: parseInt(form.einheiten) || 1,
    }).select().single()
    setSaving(false)
    setShowCreate(false)
    setForm({ bezeichnung: '', adresse_strasse: '', adresse_plz: '', adresse_ort: '', gebaeude_typ: 'einfamilienhaus', einheiten: 1, baujahr: '', notizen: '' })
    loadObjekte()
    if (data) setSelectedObjekt(data)
  }

  const filtered = useMemo(() => {
    if (!searchTerm) return objekte
    const q = searchTerm.toLowerCase()
    return objekte.filter(o =>
      o.adresse_strasse?.toLowerCase().includes(q) ||
      o.adresse_ort?.toLowerCase().includes(q) ||
      o.adresse_plz?.includes(q) ||
      o.bezeichnung?.toLowerCase().includes(q)
    )
  }, [objekte, searchTerm])

  // Count active projects per objekt
  const projektCounts = useMemo(() => {
    // We'll load this lazily — for now just show the list
    return {}
  }, [])

  return (
    <div className="min-h-screen bg-surface-main p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-brand" />
          <h1 className="text-2xl font-bold text-text-primary">Objekte</h1>
          <span className="text-sm text-text-muted ml-2">{objekte.length} Gebäude</span>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-[#1f2937] rounded-lg hover:opacity-90">
          <Plus className="w-4 h-4" /> Neues Objekt
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 p-5 rounded-lg bg-surface-card border border-border-default">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Neues Objekt anlegen</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Straße + Nr. *</label>
              <input value={form.adresse_strasse} onChange={e => setF('adresse_strasse', e.target.value)} className={inputCls} placeholder="z.B. Hauptstraße 12" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">PLZ</label>
              <input value={form.adresse_plz} onChange={e => setF('adresse_plz', e.target.value)} className={inputCls} placeholder="z.B. 92224" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Ort *</label>
              <input value={form.adresse_ort} onChange={e => setF('adresse_ort', e.target.value)} className={inputCls} placeholder="z.B. Amberg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Bezeichnung</label>
              <input value={form.bezeichnung} onChange={e => setF('bezeichnung', e.target.value)} className={inputCls} placeholder="z.B. Wohnanlage Müller" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Gebäudetyp</label>
              <select value={form.gebaeude_typ} onChange={e => setF('gebaeude_typ', e.target.value)} className={inputCls}>
                {Object.entries(GEBAEUDE_TYPEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Einheiten</label>
                <input type="number" value={form.einheiten} onChange={e => setF('einheiten', e.target.value)} className={inputCls} min="1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Baujahr</label>
                <input type="number" value={form.baujahr} onChange={e => setF('baujahr', e.target.value)} className={inputCls} placeholder="z.B. 1985" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.adresse_strasse || !form.adresse_ort}
              className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Objekt anlegen'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">Abbrechen</button>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Object List */}
        <div className="w-1/3 min-w-[320px]">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Adresse, PLZ, Ort suchen..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-border-default rounded-lg bg-surface-card outline-none" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-text-muted" /></button>}
          </div>

          {loading ? <div className="text-sm text-text-muted py-8 text-center">Laden...</div> : (
            <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-sm text-text-muted py-8 text-center">{objekte.length === 0 ? 'Noch keine Objekte angelegt' : 'Keine Treffer'}</div>
              ) : filtered.map(obj => (
                <button key={obj.id}
                  onClick={() => setSelectedObjekt(obj)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedObjekt?.id === obj.id
                      ? 'bg-brand/5 border-brand/30'
                      : 'bg-surface-card border-border-default hover:bg-surface-hover'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-text-primary text-sm">{obj.adresse_strasse || 'Ohne Adresse'}</div>
                      <div className="text-xs text-text-muted">{obj.adresse_plz} {obj.adresse_ort}</div>
                      {obj.bezeichnung && <div className="text-xs text-text-secondary mt-0.5">{obj.bezeichnung}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      {obj.gebaeude_typ && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                          {GEBAEUDE_TYPEN[obj.gebaeude_typ] || obj.gebaeude_typ}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-text-muted" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Object Detail */}
        <div className="flex-1">
          {selectedObjekt ? (
            <div>
              {/* Object Header */}
              <div className="p-5 rounded-lg bg-surface-card border border-border-default mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-brand" />
                      {selectedObjekt.adresse_strasse}
                    </h2>
                    <p className="text-sm text-text-secondary">{selectedObjekt.adresse_plz} {selectedObjekt.adresse_ort}</p>
                    {selectedObjekt.bezeichnung && <p className="text-sm text-text-muted mt-0.5">{selectedObjekt.bezeichnung}</p>}
                  </div>
                  <div className="text-right text-xs text-text-muted space-y-0.5">
                    <div>{GEBAEUDE_TYPEN[selectedObjekt.gebaeude_typ] || '-'}</div>
                    {selectedObjekt.einheiten > 1 && <div>{selectedObjekt.einheiten} Einheiten</div>}
                    {selectedObjekt.baujahr && <div>Baujahr {selectedObjekt.baujahr}</div>}
                  </div>
                </div>
                {selectedObjekt.notizen && <p className="text-xs text-text-muted border-t border-border-default pt-2 mt-2">{selectedObjekt.notizen}</p>}
              </div>

              {/* Aufträge/Projekte am Objekt */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <FolderKanban size={16} className="text-text-muted" />
                  Aufträge an diesem Objekt
                  <span className="text-xs text-text-muted font-normal">({projekte.length})</span>
                </h3>
              </div>

              {loadingDetail ? <div className="text-sm text-text-muted py-8 text-center">Laden...</div> : projekte.length === 0 ? (
                <div className="text-sm text-text-muted py-12 text-center rounded-lg border border-dashed border-border-default">
                  Noch keine Aufträge an diesem Objekt.
                  <br />
                  <span className="text-xs">Verknüpfe bestehende Projekte über die Projekt-Detailseite.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {projekte.map(p => {
                    const statusColor = STATUS_COLORS[p.status] || '#6B7280'
                    return (
                      <div key={p.id}
                        onClick={() => navigate(`/projekte/${p.id}`)}
                        className="p-4 rounded-lg bg-surface-card border border-border-default hover:border-brand/30 hover:bg-brand/5 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-muted">{p.projekt_nummer}</span>
                            <span className="font-medium text-text-primary text-sm">{p.titel}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: statusColor }}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          {p.kontakte && <span className="flex items-center gap-1"><User size={11} /> {p.kontakte.firma1 || p.kontakte.firma2}</span>}
                          {p.auftragsart && <span className="capitalize">{p.auftragsart}</span>}
                          {p.gewerk?.length > 0 && <span>{p.gewerk.join(', ')}</span>}
                          {p.bauart && <span className="capitalize">{p.bauart}</span>}
                          {(p.auftrags_wert || p.angebots_wert) && <span>{formatCurrency(p.auftrags_wert || p.angebots_wert)}</span>}
                          <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(p.created_at?.slice(0, 10))}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Building2 size={48} className="mb-3 opacity-30" />
              <p className="text-sm">Objekt aus der Liste auswählen</p>
              <p className="text-xs mt-1">oder neues Objekt anlegen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
