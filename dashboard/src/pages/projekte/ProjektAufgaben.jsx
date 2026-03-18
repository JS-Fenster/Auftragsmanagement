/**
 * ProjektAufgaben — Aufgaben/Todos pro Projekt
 *
 * Checkbox-Liste mit sofortigem DB-Update. Erledigte Aufgaben am Ende, abgeblendet.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, Calendar, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ProjektAufgaben({ projektId }) {
  const [aufgaben, setAufgaben] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titel: '', zustaendig: '', faellig_am: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!projektId) return
    setLoading(true)
    const { data } = await supabase
      .from('projekt_aufgaben')
      .select('*')
      .eq('projekt_id', projektId)
      .order('erledigt')
      .order('sort_order')
      .order('created_at')
    setAufgaben(data || [])
    setLoading(false)
  }, [projektId])

  useEffect(() => { load() }, [load])

  const toggleErledigt = async (aufgabe) => {
    const neu = !aufgabe.erledigt
    await supabase.from('projekt_aufgaben').update({
      erledigt: neu,
      erledigt_am: neu ? new Date().toISOString() : null,
    }).eq('id', aufgabe.id)
    load()
  }

  const handleAdd = async () => {
    if (!form.titel.trim()) return
    setSaving(true)
    await supabase.from('projekt_aufgaben').insert({
      projekt_id: projektId,
      titel: form.titel.trim(),
      zustaendig: form.zustaendig || null,
      faellig_am: form.faellig_am || null,
    })
    setForm({ titel: '', zustaendig: '', faellig_am: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const handleDelete = async (id) => {
    await supabase.from('projekt_aufgaben').delete().eq('id', id)
    load()
  }

  const offen = aufgaben.filter(a => !a.erledigt).length
  const gesamt = aufgaben.length
  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-text-muted py-2"><Loader2 size={16} className="animate-spin" /> Laden...</div>
  }

  return (
    <div className="space-y-2">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {gesamt === 0 ? 'Keine Aufgaben' : `${offen} offen / ${gesamt} gesamt`}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark"
        >
          <Plus size={14} /> Aufgabe
        </button>
      </div>

      {/* Task list */}
      {aufgaben.map(a => {
        const isOverdue = !a.erledigt && a.faellig_am && a.faellig_am < today
        return (
          <div
            key={a.id}
            className={`flex items-start gap-2 group rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-surface-main ${a.erledigt ? 'opacity-50' : ''}`}
          >
            <button
              onClick={() => toggleErledigt(a)}
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                a.erledigt
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-brand'
              }`}
            >
              {a.erledigt && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${a.erledigt ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                {a.titel}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {a.zustaendig && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <User size={10} /> {a.zustaendig}
                  </span>
                )}
                {a.faellig_am && (
                  <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-text-muted'}`}>
                    <Calendar size={10} /> {new Date(a.faellig_am).toLocaleDateString('de-DE')}
                    {isOverdue && ' (ueberfaellig)'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className="p-1 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      {/* Add form */}
      {showForm && (
        <div className="border border-brand/20 rounded-lg p-3 bg-surface-main/50 space-y-2">
          <input
            type="text"
            value={form.titel}
            onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
            placeholder="Was muss erledigt werden?"
            className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={form.zustaendig}
              onChange={e => setForm(p => ({ ...p, zustaendig: e.target.value }))}
              placeholder="Zustaendig (optional)"
              className="flex-1 rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="date"
              value={form.faellig_am}
              onChange={e => setForm(p => ({ ...p, faellig_am: e.target.value }))}
              className="rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.titel.trim()} className="px-3 py-1.5 bg-btn-primary text-white text-sm rounded-lg hover:bg-btn-primary-hover disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Hinzufuegen'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
