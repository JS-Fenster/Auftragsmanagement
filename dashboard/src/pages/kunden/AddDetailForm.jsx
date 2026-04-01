import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Check, X } from 'lucide-react'

export default function AddDetailForm({ personId, onSaved, onCancel }) {
  const [typ, setTyp] = useState('telefon')
  const [label, setLabel] = useState('')
  const [wert, setWert] = useState('')
  const [saving, setSaving] = useState(false)

  const defaultLabels = { telefon: 'Telefon', email: 'E-Mail', fax: 'Fax', website: 'Website' }

  const handleSave = async () => {
    if (!wert.trim()) return
    setSaving(true)
    const { error } = await supabase.from('kontakt_details').insert({
      kontakt_person_id: personId,
      typ,
      label: label.trim() || defaultLabels[typ] || typ,
      wert: wert.trim(),
      ist_primaer: false,
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-surface-main rounded-lg">
      <select value={typ} onChange={e => setTyp(e.target.value)}
        className="text-xs border border-border-default rounded px-2 py-1.5 bg-surface-card">
        <option value="telefon">Telefon</option>
        <option value="email">E-Mail</option>
        <option value="fax">Fax</option>
        <option value="website">Website</option>
      </select>
      <input value={label} onChange={e => setLabel(e.target.value)}
        placeholder="Label (z.B. Mobil privat)"
        className="text-xs border border-border-default rounded px-2 py-1.5 w-32" />
      <input value={wert} onChange={e => setWert(e.target.value)}
        placeholder="Wert"
        className="text-xs border border-border-default rounded px-2 py-1.5 flex-1" />
      <button onClick={handleSave} disabled={saving || !wert.trim()}
        className="p-1.5 rounded bg-brand-light0 text-white hover:bg-btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded hover:bg-surface-hover">
        <X className="w-3.5 h-3.5 text-text-secondary" />
      </button>
    </div>
  )
}
