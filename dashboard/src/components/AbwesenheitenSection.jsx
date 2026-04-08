/**
 * AbwesenheitenSection — Abwesenheiten eines Mitarbeiters verwalten
 * Wird in Mitarbeiter.jsx eingebunden (pro Mitarbeiter)
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, Plus, Check, X, Clock, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_STYLES = {
  beantragt: { bg: '#FEF3C7', text: '#92400E', label: 'Beantragt' },
  genehmigt: { bg: '#ECFDF5', text: '#065F46', label: 'Genehmigt' },
  abgelehnt: { bg: '#FEE2E2', text: '#991B1B', label: 'Abgelehnt' },
  storniert: { bg: '#F3F4F6', text: '#6B7280', label: 'Storniert' },
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcWorkdays(start, end) {
  if (!start || !end) return 0
  let count = 0
  const d = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (d <= e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function AbwesenheitenSection({ mitarbeiterId, mitarbeiterName, onUpdate }) {
  const [abwesenheiten, setAbwesenheiten] = useState([])
  const [arten, setArten] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [artId, setArtId] = useState('')
  const [datumVon, setDatumVon] = useState('')
  const [datumBis, setDatumBis] = useState('')
  const [halbtag, setHalbtag] = useState('')
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [abwResult, artenResult] = await Promise.all([
      supabase
        .from('abwesenheiten')
        .select('*, abwesenheitsarten(*)')
        .eq('mitarbeiter_id', mitarbeiterId)
        .neq('status', 'storniert')
        .order('datum', { ascending: false })
        .limit(50),
      supabase
        .from('abwesenheitsarten')
        .select('*')
        .eq('aktiv', true)
        .order('sort_order'),
    ])
    setAbwesenheiten(abwResult.data || [])
    setArten(artenResult.data || [])
    setLoading(false)
  }, [mitarbeiterId])

  useEffect(() => { loadData() }, [loadData])

  const resetForm = () => {
    setArtId(''); setDatumVon(''); setDatumBis(''); setHalbtag(''); setNotiz('')
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!artId || !datumVon) return
    setSaving(true)

    // Get the ressource_id for this mitarbeiter (for calendar compatibility)
    const { data: ma } = await supabase
      .from('mitarbeiter')
      .select('ressource_id')
      .eq('id', mitarbeiterId)
      .single()

    const endDate = datumBis || datumVon
    const tage = halbtag ? 0.5 : calcWorkdays(datumVon, endDate)

    // Create one row per day (for calendar display)
    const rows = []
    const d = new Date(datumVon + 'T00:00:00')
    const e = new Date(endDate + 'T00:00:00')
    while (d <= e) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) {
        rows.push({
          mitarbeiter_id: mitarbeiterId,
          ressource_id: ma?.ressource_id || null,
          abwesenheitsart_id: artId,
          datum: d.toISOString().slice(0, 10),
          bis_datum: endDate,
          typ: arten.find(a => a.id === artId)?.kategorie || 'sonstiges',
          ganztaegig: !halbtag,
          halbtag: halbtag || null,
          stunden: halbtag ? 4 : null,
          status: 'beantragt',
          notiz: notiz || null,
        })
      }
      d.setDate(d.getDate() + 1)
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('abwesenheiten').insert(rows)
      if (error) {
        console.error('Abwesenheit speichern:', error)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    resetForm()
    await loadData()
    onUpdate?.()
  }

  const handleStatusChange = async (ids, newStatus) => {
    // Update all rows belonging to this group (one per day)
    const idList = Array.isArray(ids) ? ids : [ids]
    await supabase.from('abwesenheiten').update({
      status: newStatus,
      genehmigt_am: newStatus === 'genehmigt' ? new Date().toISOString() : null,
    }).in('id', idList)
    await loadData()
    onUpdate?.()
  }

  // Group by date range
  const grouped = useMemo(() => {
    const map = new Map()
    for (const a of abwesenheiten) {
      const key = `${a.abwesenheitsart_id}_${a.bis_datum || a.datum}_${a.status}`
      if (!map.has(key)) {
        map.set(key, {
          art: a.abwesenheitsarten,
          datumVon: a.datum,
          datumBis: a.bis_datum || a.datum,
          status: a.status,
          halbtag: a.halbtag,
          notiz: a.notiz,
          ids: [],
          tage: 0,
        })
      }
      const g = map.get(key)
      if (a.datum < g.datumVon) g.datumVon = a.datum
      g.ids.push(a.id)
      g.tage += a.halbtag ? 0.5 : 1
    }
    return Array.from(map.values()).sort((a, b) => b.datumVon.localeCompare(a.datumVon))
  }, [abwesenheiten])

  const selectedArt = arten.find(a => a.id === artId)
  const previewDays = datumVon ? (halbtag ? 0.5 : calcWorkdays(datumVon, datumBis || datumVon)) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-text-muted" /> Abwesenheiten
        </h4>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Neu
        </button>
      </div>

      {/* New absence form */}
      {showForm && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 space-y-3">
          <p className="text-xs font-semibold text-brand">Neue Abwesenheit</p>

          {/* Art selection */}
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Art</label>
            <div className="flex flex-wrap gap-1.5">
              {arten.map(a => (
                <button key={a.id} onClick={() => setArtId(a.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${
                    artId === a.id
                      ? 'text-white border-transparent'
                      : 'text-text-secondary border-border-default hover:bg-surface-hover'
                  }`}
                  style={artId === a.id ? { backgroundColor: a.farbe } : {}}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.farbe }} />
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Von *</label>
              <input type="date" value={datumVon}
                onChange={e => { setDatumVon(e.target.value); if (!datumBis) setDatumBis(e.target.value) }}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Bis</label>
              <input type="date" value={datumBis} onChange={e => setDatumBis(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Halbtag</label>
              <select value={halbtag} onChange={e => setHalbtag(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none">
                <option value="">Ganzer Tag</option>
                <option value="vm">Vormittags</option>
                <option value="nm">Nachmittags</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {previewDays > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-secondary">
                {previewDays} {previewDays === 1 ? 'Tag' : 'Tage'}
                {selectedArt?.reduziert_urlaub && <span className="text-amber-600 ml-1">(vom Urlaubskonto)</span>}
              </span>
            </div>
          )}

          {/* Notiz */}
          <div>
            <label className="block text-[10px] text-text-muted mb-1">Notiz (optional)</label>
            <input type="text" value={notiz} onChange={e => setNotiz(e.target.value)}
              placeholder="z.B. Arzttermin, Hochzeit..."
              className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-card outline-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !artId || !datumVon}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? '...' : 'Beantragen'}
            </button>
            <button onClick={resetForm}
              className="px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover rounded-lg">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-xs text-text-muted">Laden...</p>
      ) : grouped.length === 0 ? (
        <p className="text-xs text-text-muted">Keine Abwesenheiten eingetragen</p>
      ) : (
        <div className="space-y-1.5">
          {grouped.map((g, i) => {
            const st = STATUS_STYLES[g.status] || STATUS_STYLES.beantragt
            return (
              <div key={i} className={`flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 bg-surface-card ${g.status === 'abgelehnt' ? 'opacity-50' : ''}`}>
                {/* Color dot */}
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.art?.farbe || '#6B7280' }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-text-primary">{g.art?.name || 'Unbekannt'}</span>
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 font-medium"
                      style={{ backgroundColor: st.bg, color: st.text }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {formatDate(g.datumVon)}
                    {g.datumBis !== g.datumVon && ` – ${formatDate(g.datumBis)}`}
                    {g.halbtag && ` (${g.halbtag === 'vm' ? 'vormittags' : 'nachmittags'})`}
                    {' · '}{g.tage} {g.tage === 1 ? 'Tag' : 'Tage'}
                  </div>
                  {g.notiz && <div className="text-[10px] text-text-muted mt-0.5">{g.notiz}</div>}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  {g.status === 'beantragt' && (
                    <>
                      <button onClick={() => handleStatusChange(g.ids, 'genehmigt')}
                        className="p-1 rounded hover:bg-green-50 text-green-600" title="Genehmigen">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleStatusChange(g.ids, 'abgelehnt')}
                        className="p-1 rounded hover:bg-red-50 text-red-600" title="Ablehnen">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {g.status !== 'storniert' && (
                    <button onClick={() => handleStatusChange(g.ids, 'storniert')}
                      className="p-1 rounded hover:bg-gray-100 text-text-muted" title="Stornieren">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
