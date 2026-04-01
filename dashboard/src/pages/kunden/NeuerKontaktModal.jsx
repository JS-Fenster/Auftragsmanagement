import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

export default function NeuerKontaktModal({ onClose, onCreated }) {
  const [typ, setTyp] = useState('privat')
  const [firma1, setFirma1] = useState('')
  const [firma2, setFirma2] = useState('')
  const [strasse, setStrasse] = useState('')
  const [plz, setPlz] = useState('')
  const [ort, setOrt] = useState('')
  const [istKunde, setIstKunde] = useState(true)
  const [istLieferant, setIstLieferant] = useState(false)
  const [anrede, setAnrede] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [detailTyp, setDetailTyp] = useState('telefon')
  const [detailLabel, setDetailLabel] = useState('')
  const [detailWert, setDetailWert] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!firma1.trim() && !nachname.trim()) {
      setError('Firma oder Nachname muss ausgefüllt sein.')
      return
    }
    setSaving(true)
    setError(null)

    // 1. Create kontakt
    const { data: kontakt, error: kErr } = await supabase.from('kontakte').insert({
      typ,
      firma1: firma1.trim() || null,
      firma2: firma2.trim() || null,
      strasse: strasse.trim() || null,
      plz: plz.trim() || null,
      ort: ort.trim() || null,
      ist_kunde: istKunde,
      ist_lieferant: istLieferant,
    }).select().single()

    if (kErr) {
      setError(kErr.message)
      setSaving(false)
      return
    }

    // 2. Create person (if name given)
    if (nachname.trim()) {
      const { data: person, error: pErr } = await supabase.from('kontakt_personen').insert({
        kontakt_id: kontakt.id,
        anrede: anrede.trim() || null,
        vorname: vorname.trim() || null,
        nachname: nachname.trim(),
        ist_hauptkontakt: true,
        rolle: 'Eigentümer',
      }).select().single()

      if (pErr) {
        setError(pErr.message)
        setSaving(false)
        return
      }

      // 3. Create detail (if given)
      if (detailWert.trim() && person) {
        const defaultLabels = { telefon: 'Telefon', email: 'E-Mail', fax: 'Fax', website: 'Website' }
        await supabase.from('kontakt_details').insert({
          kontakt_person_id: person.id,
          typ: detailTyp,
          label: detailLabel.trim() || defaultLabels[detailTyp] || detailTyp,
          wert: detailWert.trim(),
          ist_primaer: true,
        })
      }
    }

    setSaving(false)
    onCreated(kontakt)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-surface-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface-card border-b border-border-light px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-text-primary">Neuer Kontakt</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover"><X className="w-5 h-5 text-text-muted" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Typ */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Typ</label>
            <select value={typ} onChange={e => setTyp(e.target.value)}
              className="w-full text-sm border border-border-default rounded-lg px-3 py-2 bg-surface-card">
              <option value="privat">Privat</option>
              <option value="gewerbe">Gewerbe</option>
              <option value="oeffentlich">Öffentlich</option>
            </select>
          </div>

          {/* Firma */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Firma 1</label>
              <input value={firma1} onChange={e => setFirma1(e.target.value)}
                className="w-full text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Firma 2</label>
              <input value={firma2} onChange={e => setFirma2(e.target.value)}
                className="w-full text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Straße</label>
            <input value={strasse} onChange={e => setStrasse(e.target.value)}
              className="w-full text-sm border border-border-default rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">PLZ</label>
              <input value={plz} onChange={e => setPlz(e.target.value)}
                className="w-full text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Ort</label>
              <input value={ort} onChange={e => setOrt(e.target.value)}
                className="w-full text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Checkboxen */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={istKunde} onChange={e => setIstKunde(e.target.checked)}
                className="rounded border-border-default" />
              Ist Kunde
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={istLieferant} onChange={e => setIstLieferant(e.target.checked)}
                className="rounded border-border-default" />
              Ist Lieferant
            </label>
          </div>

          {/* Erste Person */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-text-secondary mb-2">Erste Kontaktperson</p>
            <div className="grid grid-cols-3 gap-3">
              <select value={anrede} onChange={e => setAnrede(e.target.value)}
                className="text-sm border border-border-default rounded-lg px-3 py-2 bg-surface-card">
                <option value="">Anrede...</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
              <input value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Vorname"
                className="text-sm border border-border-default rounded-lg px-3 py-2" />
              <input value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Nachname"
                className="text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Erster Kontaktweg */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-text-secondary mb-2">Erster Kontaktweg</p>
            <div className="grid grid-cols-3 gap-3">
              <select value={detailTyp} onChange={e => setDetailTyp(e.target.value)}
                className="text-sm border border-border-default rounded-lg px-3 py-2 bg-surface-card">
                <option value="telefon">Telefon</option>
                <option value="email">E-Mail</option>
                <option value="fax">Fax</option>
                <option value="website">Website</option>
              </select>
              <input value={detailLabel} onChange={e => setDetailLabel(e.target.value)} placeholder="Label (optional)"
                className="text-sm border border-border-default rounded-lg px-3 py-2" />
              <input value={detailWert} onChange={e => setDetailWert(e.target.value)} placeholder="Wert (Nr./Adresse)"
                className="text-sm border border-border-default rounded-lg px-3 py-2" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}
        </div>

        <div className="sticky bottom-0 bg-surface-card border-t border-border-light px-6 py-3 flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-surface-hover text-text-primary">Abbrechen</button>
          <button onClick={handleCreate} disabled={saving}
            className="text-sm px-4 py-2 rounded-lg bg-btn-primary text-white hover:bg-btn-primary-hover disabled:opacity-50">
            {saving ? 'Erstelle...' : 'Kontakt anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
