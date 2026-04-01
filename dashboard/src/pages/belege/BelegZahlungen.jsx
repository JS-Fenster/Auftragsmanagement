/**
 * BelegZahlungen — Zahlungseingaenge fuer einen Beleg
 *
 * Zeigt bestehende Zahlungen + Formular zum Erfassen neuer Zahlungen.
 * Restbetrag wird automatisch berechnet.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatEuro, ZAHLUNGSARTEN } from './constants'

export default function BelegZahlungen({ belegId, bruttoSumme, status }) {
  const [zahlungen, setZahlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    betrag: '',
    datum: new Date().toISOString().split('T')[0],
    zahlungsart: 'ueberweisung',
    referenz: '',
  })

  const loadZahlungen = useCallback(async () => {
    if (!belegId) return
    setLoading(true)
    const { data } = await supabase
      .from('beleg_zahlungen')
      .select('*')
      .eq('beleg_id', belegId)
      .order('datum', { ascending: false })
    setZahlungen(data || [])
    setLoading(false)
  }, [belegId])

  useEffect(() => { loadZahlungen() }, [loadZahlungen])

  const gezahlt = zahlungen.reduce((sum, z) => sum + (z.betrag || 0), 0)
  const restbetrag = (bruttoSumme || 0) - gezahlt

  const handleAdd = async () => {
    if (!form.betrag || parseFloat(form.betrag) <= 0) return
    setSaving(true)
    const { error } = await supabase.from('beleg_zahlungen').insert({
      beleg_id: belegId,
      betrag: parseFloat(form.betrag),
      datum: form.datum,
      zahlungsart: form.zahlungsart,
      referenz: form.referenz || null,
    })
    if (error) {
      console.error('Zahlung speichern Fehler:', error)
    } else {
      setForm({ betrag: '', datum: new Date().toISOString().split('T')[0], zahlungsart: 'ueberweisung', referenz: '' })
      setShowForm(false)
      await loadZahlungen()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('beleg_zahlungen').delete().eq('id', id)
    if (error) {
      console.error('Zahlung loeschen Fehler:', error)
    } else {
      await loadZahlungen()
    }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    try { return new Date(d).toLocaleDateString('de-DE') } catch { return '-' }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted py-4">
        <Loader2 size={16} className="animate-spin" /> Zahlungen laden...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-text-secondary">Brutto: <strong>{formatEuro(bruttoSumme)}</strong></span>
          <span className="text-text-secondary">Gezahlt: <strong className="text-green-600">{formatEuro(gezahlt)}</strong></span>
          <span className={restbetrag > 0.01 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
            Rest: {formatEuro(restbetrag)}
          </span>
        </div>
        {restbetrag > 0.01 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            <Plus size={14} /> Zahlung erfassen
          </button>
        )}
      </div>

      {/* Existing payments */}
      {zahlungen.length > 0 && (
        <div className="border border-border-default rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-main">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Datum</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Betrag</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Art</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Referenz</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zahlungen.map(z => (
                <tr key={z.id} className="hover:bg-surface-main transition-colors">
                  <td className="px-3 py-2 text-sm text-text-secondary">{formatDate(z.datum)}</td>
                  <td className="px-3 py-2 text-sm text-right font-medium text-green-600">{formatEuro(z.betrag)}</td>
                  <td className="px-3 py-2 text-sm text-text-secondary">
                    {ZAHLUNGSARTEN.find(a => a.value === z.zahlungsart)?.label || z.zahlungsart}
                  </td>
                  <td className="px-3 py-2 text-sm text-text-muted">{z.referenz || '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(z.id)}
                      className="p-1 text-text-muted hover:text-red-500 transition-colors"
                      title="Zahlung löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zahlungen.length === 0 && !showForm && (
        <p className="text-sm text-text-muted text-center py-3">Noch keine Zahlungen erfasst</p>
      )}

      {/* Add payment form */}
      {showForm && (
        <div className="border border-brand/30 rounded-lg p-4 bg-brand-light/10">
          <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <CreditCard size={16} /> Zahlung erfassen
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Betrag *</label>
              <input
                type="number"
                value={form.betrag}
                onChange={e => setForm(prev => ({ ...prev, betrag: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder={restbetrag > 0 ? restbetrag.toFixed(2) : '0.00'}
                step="0.01"
                min="0.01"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Datum *</label>
              <input
                type="date"
                value={form.datum}
                onChange={e => setForm(prev => ({ ...prev, datum: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Zahlungsart</label>
              <select
                value={form.zahlungsart}
                onChange={e => setForm(prev => ({ ...prev, zahlungsart: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {ZAHLUNGSARTEN.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Referenz</label>
              <input
                type="text"
                value={form.referenz}
                onChange={e => setForm(prev => ({ ...prev, referenz: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="z.B. Bank-Ref"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={saving || !form.betrag}
              className="flex items-center gap-1 px-4 py-2 bg-btn-primary text-white text-sm font-medium rounded-lg hover:bg-btn-primary-hover disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Speichern
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
