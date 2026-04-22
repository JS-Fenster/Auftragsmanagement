/**
 * BescheinigungenBlock — CRUD für Steuer-Bescheinigungen pro Kontakt
 *
 * Welle 2 Etappe 4 (2026-04-22):
 *   - §48b EStG Freistellung (Handwerker-Freistellung)
 *   - USt 1 TG (§13b UStG Bauleister)
 *   - NATO (§4 Nr. 7 UStG)
 *
 * Features:
 *   - List: aktuelle + abgelaufene + widerrufene Bescheinigungen
 *   - Dynamischer Status: gueltig_bis < today → visuell "abgelaufen" (unabhängig
 *     vom DB-Status, der taeglich per pg_cron nachgefuehrt wird)
 *   - Ablaufs-Warning: 30 Tage vor Ablauf gelbes Badge
 *   - Add/Edit/Delete (Delete soft via status='widerrufen')
 *   - Trigger fn_auto_set_ist_bauleister setzt kontakte.ist_bauleister bei
 *     gueltiger USt-1-TG automatisch
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYP_LABEL = {
  '48b_freistellung': '§48b EStG Freistellung (Bauabzug)',
  'ust_1_tg':         'USt 1 TG (§13b Bauleister)',
  'nato':             'NATO (§4 Nr. 7 UStG)',
}

const STATUS_BADGE = {
  gueltig:     { label: 'Gültig',     color: 'bg-green-100 text-green-700 border-green-300',   icon: CheckCircle2 },
  abgelaufen:  { label: 'Abgelaufen', color: 'bg-gray-100  text-gray-600  border-gray-300',    icon: Clock },
  widerrufen:  { label: 'Widerrufen', color: 'bg-red-100   text-red-700   border-red-300',     icon: XCircle },
  angefordert: { label: 'Angefordert',color: 'bg-yellow-100 text-yellow-700 border-yellow-300',icon: Clock },
}

function computeEffectiveStatus(bescheinigung) {
  if (bescheinigung.status !== 'gueltig') return bescheinigung.status
  const today = new Date().toISOString().split('T')[0]
  if (bescheinigung.gueltig_bis < today) return 'abgelaufen'
  return 'gueltig'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function AddEditForm({ kontaktId, initial, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    typ: initial?.typ || '48b_freistellung',
    nummer: initial?.nummer || '',
    ausgestellt_von: initial?.ausgestellt_von || '',
    gueltig_von: initial?.gueltig_von || new Date().toISOString().split('T')[0],
    gueltig_bis: initial?.gueltig_bis || '',
    status: initial?.status || 'gueltig',
    bemerkung: initial?.bemerkung || '',
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const handleSave = async () => {
    if (!form.gueltig_von || !form.gueltig_bis) {
      setErr('Gültig-von und Gültig-bis sind Pflicht.')
      return
    }
    if (form.gueltig_bis < form.gueltig_von) {
      setErr('Gültig-bis muss nach Gültig-von liegen.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const payload = { ...form, kontakt_id: kontaktId }
      const { error } = initial?.id
        ? await supabase.from('bescheinigungen').update(payload).eq('id', initial.id)
        : await supabase.from('bescheinigungen').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-main border border-border-default rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary">Typ *</label>
          <select
            value={form.typ}
            onChange={e => setForm({ ...form, typ: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
          >
            {Object.entries(TYP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Sicherheitsnummer / Nummer</label>
          <input
            type="text"
            value={form.nummer}
            onChange={e => setForm({ ...form, nummer: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
            placeholder="z.B. 123/4567/89012"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Ausgestellt von (Finanzamt)</label>
          <input
            type="text"
            value={form.ausgestellt_von}
            onChange={e => setForm({ ...form, ausgestellt_von: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
            placeholder="z.B. FA Amberg"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Gültig von *</label>
          <input
            type="date"
            value={form.gueltig_von}
            onChange={e => setForm({ ...form, gueltig_von: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Gültig bis *</label>
          <input
            type="date"
            value={form.gueltig_bis}
            onChange={e => setForm({ ...form, gueltig_bis: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Status</label>
          <select
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm"
          >
            <option value="gueltig">Gültig</option>
            <option value="angefordert">Angefordert</option>
            <option value="widerrufen">Widerrufen</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary">Bemerkung</label>
        <textarea
          value={form.bemerkung}
          onChange={e => setForm({ ...form, bemerkung: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm resize-y"
        />
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-btn-primary text-white rounded hover:bg-btn-primary-hover disabled:opacity-50"
        >
          {saving ? 'Speichere…' : (initial?.id ? 'Aktualisieren' : 'Anlegen')}
        </button>
      </div>
    </div>
  )
}

function BescheinigungRow({ b, onEdit, onDelete }) {
  const effectiveStatus = computeEffectiveStatus(b)
  const badge = STATUS_BADGE[effectiveStatus] || STATUS_BADGE.gueltig
  const BadgeIcon = badge.icon
  const daysLeft = daysUntil(b.gueltig_bis)
  const isExpiringSoon = effectiveStatus === 'gueltig' && daysLeft !== null && daysLeft <= 30 && daysLeft >= 0

  return (
    <div className="bg-surface-main border border-border-default rounded-lg p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text-primary">{TYP_LABEL[b.typ] || b.typ}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${badge.color}`}>
            <BadgeIcon className="h-3 w-3" />
            {badge.label}
          </span>
          {isExpiringSoon && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-300">
              <AlertTriangle className="h-3 w-3" />
              läuft in {daysLeft} Tag{daysLeft === 1 ? '' : 'en'} ab
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-text-secondary">
          Gültig: {b.gueltig_von} bis {b.gueltig_bis}
          {b.nummer && <> · Nr. <code className="text-xs">{b.nummer}</code></>}
          {b.ausgestellt_von && <> · {b.ausgestellt_von}</>}
        </div>
        {b.bemerkung && (
          <div className="mt-1 text-xs text-text-muted italic">{b.bemerkung}</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(b)}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded"
          title="Bearbeiten"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(b)}
          className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function BescheinigungenBlock({ kontaktId }) {
  const [expanded, setExpanded] = useState(true)
  const [bescheinigungen, setBescheinigungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bescheinigungen')
      .select('*')
      .eq('kontakt_id', kontaktId)
      .order('gueltig_bis', { ascending: false })
    if (!error) setBescheinigungen(data || [])
    setLoading(false)
  }, [kontaktId])

  useEffect(() => { load() }, [load])

  const handleSaved = () => {
    setShowForm(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (b) => {
    if (!window.confirm(`Bescheinigung "${TYP_LABEL[b.typ]}" wirklich löschen? (Kann nicht wiederhergestellt werden)`)) return
    const { error } = await supabase.from('bescheinigungen').delete().eq('id', b.id)
    if (!error) load()
  }

  const activeBescheinigungen = bescheinigungen.filter(b => computeEffectiveStatus(b) === 'gueltig')
  const expiringSoon = activeBescheinigungen.filter(b => {
    const d = daysUntil(b.gueltig_bis)
    return d !== null && d <= 30 && d >= 0
  })

  return (
    <div className="px-6 py-4 border-t border-border-light">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Bescheinigungen
            {bescheinigungen.length > 0 && <span className="text-text-muted font-normal"> ({activeBescheinigungen.length} gültig / {bescheinigungen.length} gesamt)</span>}
          </h3>
          {expiringSoon.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-300">
              <AlertTriangle className="h-3 w-3" />
              {expiringSoon.length} läuft bald ab
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-sm text-text-muted">Lädt…</p>
          ) : bescheinigungen.length === 0 && !showForm ? (
            <p className="text-sm text-text-muted italic">Noch keine Bescheinigungen hinterlegt.</p>
          ) : (
            bescheinigungen.map(b => (
              <BescheinigungRow
                key={b.id}
                b={b}
                onEdit={() => { setEditing(b); setShowForm(true) }}
                onDelete={handleDelete}
              />
            ))
          )}

          {showForm ? (
            <AddEditForm
              kontaktId={kontaktId}
              initial={editing}
              onSaved={handleSaved}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          ) : (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark"
            >
              <Plus className="h-4 w-4" /> Neue Bescheinigung
            </button>
          )}

          <p className="text-xs text-text-muted mt-2">
            Gültige USt-1-TG-Bescheinigung setzt automatisch <code>ist_bauleister=true</code> am Kontakt (§13b-Vorschlag im Beleg).
            Abgelaufene Bescheinigungen werden täglich via <code>pg_cron</code> auto-markiert.
          </p>
        </div>
      )}
    </div>
  )
}
