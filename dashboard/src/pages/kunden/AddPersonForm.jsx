import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AddPersonForm({ kontaktId, onSaved, onCancel }) {
  const [anrede, setAnrede] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [rolle, setRolle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nachname.trim()) return
    setSaving(true)
    const { error } = await supabase.from('kontakt_personen').insert({
      kontakt_id: kontaktId,
      anrede: anrede.trim() || null,
      vorname: vorname.trim() || null,
      nachname: nachname.trim(),
      rolle: rolle.trim() || null,
      ist_hauptkontakt: false,
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="p-3 bg-brand-light rounded-lg mt-3">
      <p className="text-xs font-medium text-brand-dark mb-2">Neue Person hinzufügen</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={anrede} onChange={e => setAnrede(e.target.value)}
          className="text-xs border border-border-default rounded px-2 py-1.5 bg-surface-card">
          <option value="">Anrede...</option>
          <option value="Herr">Herr</option>
          <option value="Frau">Frau</option>
        </select>
        <input value={vorname} onChange={e => setVorname(e.target.value)}
          placeholder="Vorname"
          className="text-xs border border-border-default rounded px-2 py-1.5" />
        <input value={nachname} onChange={e => setNachname(e.target.value)}
          placeholder="Nachname *"
          className="text-xs border border-border-default rounded px-2 py-1.5" />
        <input value={rolle} onChange={e => setRolle(e.target.value)}
          placeholder="Rolle (z.B. Ehepartner)"
          className="text-xs border border-border-default rounded px-2 py-1.5" />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded hover:bg-brand-light text-brand-dark">Abbrechen</button>
        <button onClick={handleSave} disabled={saving || !nachname.trim()}
          className="text-xs px-3 py-1.5 rounded bg-btn-primary text-white hover:bg-btn-primary-hover disabled:opacity-50">
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
