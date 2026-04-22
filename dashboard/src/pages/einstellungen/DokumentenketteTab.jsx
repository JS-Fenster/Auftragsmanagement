/**
 * DokumentenketteTab — Admin-UI für Nummernkreise, Steuertatbestände, Bankverbindungen
 *
 * Welle 2 Etappe 7 (2026-04-22):
 *   - Nummernkreise: pro Belegtyp editieren (prefix, stellen, max_nummer, aktuelle Laufnummer)
 *   - Steuertatbestände: pro Code editieren (Satz, Bagatellgrenze, PDF-Hinweis)
 *   - Eigene Bankverbindungen: CRUD (Volksbank + weitere)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Edit2, Save, X, Hash, Percent, Landmark } from 'lucide-react'

const SUBTABS = [
  { key: 'nummernkreise',       label: 'Nummernkreise',      icon: Hash },
  { key: 'steuer_tatbestaende', label: 'Steuertatbestände',  icon: Percent },
  { key: 'bankverbindungen',    label: 'Bankverbindungen',   icon: Landmark },
]

// ============================================================
// Nummernkreise-Panel
// ============================================================
function NummernkreisePanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('nummernkreise').select('*').order('typ')
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (row) => {
    setEditingId(row.typ)
    setEditForm({
      bezeichnung: row.bezeichnung,
      prefix: row.prefix,
      stellen: row.stellen,
      jahr_format: row.jahr_format,
      jahr_reset: row.jahr_reset,
      start_nummer: row.start_nummer,
      max_nummer: row.max_nummer,
      aktuelle_laufnummer: row.aktuelle_laufnummer,
      aktiv: row.aktiv,
    })
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('nummernkreise').update(editForm).eq('typ', editingId)
    setSaving(false)
    setEditingId(null)
    load()
  }

  if (loading) return <p className="text-sm text-text-muted">Lädt…</p>

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">
        Format: <code className="text-xs">Prefix-YYYY-NNNN</code>. Jahr-Reset automatisch am 01.01.
        Stellen = Minimum-Breite — Überlauf (10000+) wird länger, kein Crash.
      </p>
      <table className="w-full text-sm">
        <thead className="border-b border-border-default">
          <tr className="text-left text-xs text-text-muted uppercase">
            <th className="pb-2 pr-3">Typ</th>
            <th className="pb-2 pr-3">Bezeichnung</th>
            <th className="pb-2 pr-3">Prefix</th>
            <th className="pb-2 pr-3">Stellen</th>
            <th className="pb-2 pr-3">Jahr-Format</th>
            <th className="pb-2 pr-3">Jahr-Reset</th>
            <th className="pb-2 pr-3 text-right">Start</th>
            <th className="pb-2 pr-3 text-right">Max</th>
            <th className="pb-2 pr-3 text-right">Aktuell</th>
            <th className="pb-2 pr-3">Aktiv</th>
            <th className="pb-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const editing = editingId === r.typ
            return (
              <tr key={r.typ} className="border-b border-border-light hover:bg-surface-main">
                <td className="py-2 pr-3"><code className="text-xs">{r.typ}</code></td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input value={editForm.bezeichnung} onChange={e => setEditForm({ ...editForm, bezeichnung: e.target.value })} className="px-2 py-1 border rounded text-sm w-full" />
                    : r.bezeichnung}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input value={editForm.prefix} onChange={e => setEditForm({ ...editForm, prefix: e.target.value })} className="px-2 py-1 border rounded text-sm w-16" />
                    : <code>{r.prefix}</code>}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input type="number" min="3" max="8" value={editForm.stellen} onChange={e => setEditForm({ ...editForm, stellen: parseInt(e.target.value) || 4 })} className="px-2 py-1 border rounded text-sm w-16" />
                    : r.stellen}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <select value={editForm.jahr_format} onChange={e => setEditForm({ ...editForm, jahr_format: e.target.value })} className="px-2 py-1 border rounded text-sm"><option value="YYYY">YYYY</option><option value="YY">YY</option></select>
                    : r.jahr_format}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input type="checkbox" checked={editForm.jahr_reset} onChange={e => setEditForm({ ...editForm, jahr_reset: e.target.checked })} />
                    : (r.jahr_reset ? '✓' : '–')}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editing
                    ? <input type="number" value={editForm.start_nummer} onChange={e => setEditForm({ ...editForm, start_nummer: parseInt(e.target.value) || 1 })} className="px-2 py-1 border rounded text-sm w-20" />
                    : r.start_nummer}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editing
                    ? <input type="number" value={editForm.max_nummer || ''} onChange={e => setEditForm({ ...editForm, max_nummer: e.target.value ? parseInt(e.target.value) : null })} placeholder="–" className="px-2 py-1 border rounded text-sm w-24" />
                    : (r.max_nummer || '–')}
                </td>
                <td className="py-2 pr-3 text-right font-semibold">
                  {editing
                    ? <input type="number" value={editForm.aktuelle_laufnummer} onChange={e => setEditForm({ ...editForm, aktuelle_laufnummer: parseInt(e.target.value) || 0 })} className="px-2 py-1 border rounded text-sm w-20" />
                    : r.aktuelle_laufnummer}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input type="checkbox" checked={editForm.aktiv} onChange={e => setEditForm({ ...editForm, aktiv: e.target.checked })} />
                    : (r.aktiv ? '✓' : '–')}
                </td>
                <td className="py-2 text-right">
                  {editing ? (
                    <div className="flex gap-1 justify-end">
                      <button onClick={save} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Speichern"><Save className="h-4 w-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-text-muted hover:bg-surface-hover rounded" title="Abbrechen"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(r)} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded" title="Bearbeiten"><Edit2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-text-muted mt-4">
        ⚠ Laufnummer-Änderung mit Vorsicht — schaffe nie Konflikte zu bereits vergebenen Belegnummern.
      </p>
    </div>
  )
}

// ============================================================
// Steuertatbestände-Panel
// ============================================================
function SteuerTatbestaendePanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('steuer_tatbestaende').select('*').order('sort_order')
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditForm({
      bezeichnung: row.bezeichnung,
      satz_prozent: row.satz_prozent,
      bagatellgrenze_netto: row.bagatellgrenze_netto,
      pdf_hinweis: row.pdf_hinweis,
      aktiv: row.aktiv,
    })
  }

  const save = async () => {
    await supabase.from('steuer_tatbestaende').update(editForm).eq('id', editingId)
    setEditingId(null)
    load()
  }

  if (loading) return <p className="text-sm text-text-muted">Lädt…</p>

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">
        Steuer-Tatbestände für Beleg-Positionen. Standard 19%, reduziert 7%, §13b Bau, §4 Nr. 1 EU-Lieferung, §4 Nr. 7 NATO.
        Seed-Daten sollten nicht geändert werden (Code + erfordert_bescheinigung sind read-only);
        hier editierbar sind nur Bezeichnung, Satz, Bagatellgrenze, PDF-Hinweis.
      </p>
      <table className="w-full text-sm">
        <thead className="border-b border-border-default">
          <tr className="text-left text-xs text-text-muted uppercase">
            <th className="pb-2 pr-3">Code</th>
            <th className="pb-2 pr-3">Bezeichnung</th>
            <th className="pb-2 pr-3 text-right">Satz %</th>
            <th className="pb-2 pr-3">Anwendung</th>
            <th className="pb-2 pr-3 text-right">Bagatell €</th>
            <th className="pb-2 pr-3">Bescheinigung</th>
            <th className="pb-2 pr-3">B2B only</th>
            <th className="pb-2 pr-3">PDF-Hinweis</th>
            <th className="pb-2 pr-3">Aktiv</th>
            <th className="pb-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const editing = editingId === r.id
            return (
              <tr key={r.id} className="border-b border-border-light hover:bg-surface-main">
                <td className="py-2 pr-3"><code className="text-xs">{r.code}</code></td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input value={editForm.bezeichnung} onChange={e => setEditForm({ ...editForm, bezeichnung: e.target.value })} className="px-2 py-1 border rounded text-sm w-full" />
                    : r.bezeichnung}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editing
                    ? <input type="number" step="0.01" value={editForm.satz_prozent} onChange={e => setEditForm({ ...editForm, satz_prozent: parseFloat(e.target.value) || 0 })} className="px-2 py-1 border rounded text-sm w-20 text-right" />
                    : `${r.satz_prozent}%`}
                </td>
                <td className="py-2 pr-3 text-xs">{(r.anwendungsbereich || []).join(', ') || 'alle'}</td>
                <td className="py-2 pr-3 text-right">
                  {editing
                    ? <input type="number" step="0.01" value={editForm.bagatellgrenze_netto || ''} onChange={e => setEditForm({ ...editForm, bagatellgrenze_netto: e.target.value ? parseFloat(e.target.value) : null })} placeholder="–" className="px-2 py-1 border rounded text-sm w-24 text-right" />
                    : (r.bagatellgrenze_netto ? `${r.bagatellgrenze_netto}€` : '–')}
                </td>
                <td className="py-2 pr-3 text-xs">{r.erfordert_bescheinigung || '–'}</td>
                <td className="py-2 pr-3">{r.nur_fuer_geschaeftskunden ? '✓' : '–'}</td>
                <td className="py-2 pr-3 text-xs max-w-xs">
                  {editing
                    ? <input value={editForm.pdf_hinweis || ''} onChange={e => setEditForm({ ...editForm, pdf_hinweis: e.target.value })} className="px-2 py-1 border rounded text-sm w-full" />
                    : (r.pdf_hinweis ? <span className="line-clamp-2" title={r.pdf_hinweis}>{r.pdf_hinweis}</span> : '–')}
                </td>
                <td className="py-2 pr-3">
                  {editing
                    ? <input type="checkbox" checked={editForm.aktiv} onChange={e => setEditForm({ ...editForm, aktiv: e.target.checked })} />
                    : (r.aktiv ? '✓' : '–')}
                </td>
                <td className="py-2 text-right">
                  {editing ? (
                    <div className="flex gap-1 justify-end">
                      <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save className="h-4 w-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-text-muted hover:bg-surface-hover rounded"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(r)} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded"><Edit2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// Eigene Bankverbindungen-Panel
// ============================================================
function BankverbindungenPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('eigene_bankverbindungen').select('*').order('sort_order')
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditForm({ ...row })
  }
  const newRow = () => {
    setEditingId('new')
    setEditForm({ bezeichnung: '', bank_name: '', iban: '', bic: '', kontoinhaber: 'JS Fenster & Tueren GmbH', aktiv: true, ist_default: false, sort_order: (rows.length + 1) * 10 })
  }
  const save = async () => {
    if (editingId === 'new') {
      await supabase.from('eigene_bankverbindungen').insert(editForm)
    } else {
      await supabase.from('eigene_bankverbindungen').update(editForm).eq('id', editingId)
    }
    setEditingId(null)
    load()
  }
  const del = async (id) => {
    if (!window.confirm('Bankverbindung wirklich löschen?')) return
    await supabase.from('eigene_bankverbindungen').delete().eq('id', id)
    load()
  }

  if (loading) return <p className="text-sm text-text-muted">Lädt…</p>

  const editRow = editingId === 'new' ? null : editingId
  const renderEditForm = () => (
    <tr className="bg-blue-50 border-b border-border-default">
      <td className="py-2 pr-3"><input value={editForm.bezeichnung} onChange={e => setEditForm({ ...editForm, bezeichnung: e.target.value })} placeholder="z.B. Volksbank Amberg" className="px-2 py-1 border rounded text-sm w-full" /></td>
      <td className="py-2 pr-3"><input value={editForm.bank_name} onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })} className="px-2 py-1 border rounded text-sm w-full" /></td>
      <td className="py-2 pr-3"><input value={editForm.iban || ''} onChange={e => setEditForm({ ...editForm, iban: e.target.value })} placeholder="DE…" className="px-2 py-1 border rounded text-sm w-full font-mono" /></td>
      <td className="py-2 pr-3"><input value={editForm.bic || ''} onChange={e => setEditForm({ ...editForm, bic: e.target.value })} className="px-2 py-1 border rounded text-sm w-full font-mono" /></td>
      <td className="py-2 pr-3"><input value={editForm.kontoinhaber} onChange={e => setEditForm({ ...editForm, kontoinhaber: e.target.value })} className="px-2 py-1 border rounded text-sm w-full" /></td>
      <td className="py-2 pr-3 text-center"><input type="checkbox" checked={editForm.ist_default} onChange={e => setEditForm({ ...editForm, ist_default: e.target.checked })} /></td>
      <td className="py-2 pr-3 text-center"><input type="checkbox" checked={editForm.aktiv} onChange={e => setEditForm({ ...editForm, aktiv: e.target.checked })} /></td>
      <td className="py-2 text-right">
        <div className="flex gap-1 justify-end">
          <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save className="h-4 w-4" /></button>
          <button onClick={() => setEditingId(null)} className="p-1.5 text-text-muted hover:bg-surface-hover rounded"><X className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  )

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">
        JS-eigene Bankkonten. Auf Rechnung erscheint die als "Default" markierte (max. 1). Weitere Konten können pro Beleg manuell gewählt werden.
      </p>
      <table className="w-full text-sm">
        <thead className="border-b border-border-default">
          <tr className="text-left text-xs text-text-muted uppercase">
            <th className="pb-2 pr-3">Bezeichnung</th>
            <th className="pb-2 pr-3">Bank</th>
            <th className="pb-2 pr-3">IBAN</th>
            <th className="pb-2 pr-3">BIC</th>
            <th className="pb-2 pr-3">Inhaber</th>
            <th className="pb-2 pr-3 text-center">Default</th>
            <th className="pb-2 pr-3 text-center">Aktiv</th>
            <th className="pb-2 w-32"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            if (editRow === r.id) return renderEditForm()
            return (
              <tr key={r.id} className="border-b border-border-light hover:bg-surface-main">
                <td className="py-2 pr-3 font-medium">{r.bezeichnung}</td>
                <td className="py-2 pr-3">{r.bank_name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.iban || <span className="text-red-500 italic">fehlt</span>}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.bic || <span className="text-red-500 italic">fehlt</span>}</td>
                <td className="py-2 pr-3">{r.kontoinhaber}</td>
                <td className="py-2 pr-3 text-center">{r.ist_default && <span className="text-green-600 font-bold">✓</span>}</td>
                <td className="py-2 pr-3 text-center">{r.aktiv ? '✓' : '–'}</td>
                <td className="py-2 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => startEdit(r)} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => del(r.id)} className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            )
          })}
          {editingId === 'new' && renderEditForm()}
        </tbody>
      </table>
      {editingId !== 'new' && (
        <button onClick={newRow} className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark">
          <Plus className="h-4 w-4" /> Neue Bankverbindung
        </button>
      )}
    </div>
  )
}

// ============================================================
// Main Export
// ============================================================
export default function DokumentenketteTab() {
  const [subTab, setSubTab] = useState('nummernkreise')

  return (
    <div>
      <div className="border-b border-border-light mb-4 flex gap-0">
        {SUBTABS.map(t => {
          const Icon = t.icon
          const active = subTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                active ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'nummernkreise'       && <NummernkreisePanel />}
      {subTab === 'steuer_tatbestaende' && <SteuerTatbestaendePanel />}
      {subTab === 'bankverbindungen'    && <BankverbindungenPanel />}
    </div>
  )
}
