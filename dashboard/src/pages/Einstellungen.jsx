import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, X, Save, Trash2, Settings2, Mail, Database, BookOpen, CheckCircle, XCircle, AlertCircle, Clock, Edit2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Reusable OptionEditor – CRUD for einstellungen_optionen with given kategorie
// ---------------------------------------------------------------------------
function OptionEditor({ kategorie, label }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('einstellungen_optionen')
      .select('*')
      .eq('kategorie', kategorie)
      .order('sortierung')
    if (!error) setItems(data || [])
    setLoading(false)
  }, [kategorie])

  useEffect(() => { load() }, [load])

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditValues({ wert: item.wert, sortierung: item.sortierung })
  }

  const saveEdit = async (id) => {
    setSaving(true)
    await supabase
      .from('einstellungen_optionen')
      .update({ wert: editValues.wert, sortierung: editValues.sortierung })
      .eq('id', id)
    setEditingId(null)
    setSaving(false)
    load()
  }

  const addItem = async () => {
    if (!newValue.trim()) return
    setSaving(true)
    const nextSort = items.length > 0 ? Math.max(...items.map(i => i.sortierung || 0)) + 1 : 1
    await supabase
      .from('einstellungen_optionen')
      .insert({ kategorie, wert: newValue.trim(), sortierung: nextSort })
    setNewValue('')
    setSaving(false)
    load()
  }

  const deleteItem = async (id) => {
    if (!confirm('Eintrag wirklich löschen?')) return
    await supabase.from('einstellungen_optionen').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Laden…</div>

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{label}</h3>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3 group">
            {editingId === item.id ? (
              <>
                <input
                  className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editValues.wert}
                  onChange={(e) => setEditValues(v => ({ ...v, wert: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                  autoFocus
                />
                <input
                  type="number"
                  className="w-20 border border-blue-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editValues.sortierung}
                  onChange={(e) => setEditValues(v => ({ ...v, sortierung: parseInt(e.target.value) || 0 }))}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                />
                <button
                  onClick={() => saveEdit(item.id)}
                  disabled={saving}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                >
                  <Save size={16} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800 cursor-pointer border border-transparent hover:border-dashed hover:border-gray-300 rounded px-2 py-1 -mx-2"
                  onClick={() => startEdit(item)}
                >
                  {item.wert}
                </span>
                <span className="text-xs text-gray-400 w-16 text-center cursor-pointer border border-transparent hover:border-dashed hover:border-gray-300 rounded px-2 py-1"
                  onClick={() => startEdit(item)}
                >
                  #{item.sortierung}
                </span>
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-500 rounded transition-opacity"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 rounded transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Keine Einträge vorhanden</div>
        )}
      </div>

      {/* Add new */}
      <div className="flex items-center gap-2 mt-4">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`Neuen ${label.replace(/en$/, '')} hinzufügen…`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          disabled={saving || !newValue.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={16} />
          Hinzufügen
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// E-Mail Subscriptions Tab
// ---------------------------------------------------------------------------
function EmailSubscriptions() {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('email_subscriptions')
        .select('*')
        .order('email_postfach')
      setSubs(data || [])
      setLoading(false)
    })()
  }, [])

  const getStatus = (sub) => {
    if (!sub.is_active) return { label: 'Inaktiv', color: 'bg-gray-100 text-gray-600' }
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) return { label: 'Abgelaufen', color: 'bg-red-100 text-red-700' }
    return { label: 'Aktiv', color: 'bg-green-100 text-green-700' }
  }

  const StatusIcon = ({ sub }) => {
    const s = getStatus(sub)
    if (s.label === 'Aktiv') return <CheckCircle size={14} className="text-green-600" />
    if (s.label === 'Abgelaufen') return <AlertCircle size={14} className="text-red-600" />
    return <XCircle size={14} className="text-gray-400" />
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Laden…</div>

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">E-Mail Subscriptions</h3>
      <p className="text-sm text-gray-500 mb-4">Subscriptions werden automatisch über Edge Functions verwaltet.</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Postfach</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Resource</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ablaufdatum</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Letzter Renewal</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Letzter Fehler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subs.map((sub) => {
              const status = getStatus(sub)
              return (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{sub.email_postfach}</td>
                  <td className="px-4 py-3 text-gray-600">{sub.resource}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon sub={sub} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {sub.expires_at ? format(new Date(sub.expires_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {sub.last_renewal_at ? (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Clock size={13} />
                        {formatDistanceToNow(new Date(sub.last_renewal_at), { locale: de, addSuffix: true })}
                      </span>
                    ) : '–'}
                  </td>
                  <td className="px-4 py-3">
                    {sub.last_error ? (
                      <span className="text-red-600 truncate block max-w-[200px]" title={sub.last_error}>
                        {sub.last_error}
                      </span>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {subs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keine Subscriptions vorhanden</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// System Tab
// ---------------------------------------------------------------------------
function SystemTab() {
  const [config, setConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const configRes = await supabase.from('app_config').select('*')
      setConfig(configRes.data || [])
      setLoading(false)
    })()
  }, [])

  const startEdit = (item) => {
    setEditingKey(item.key)
    setEditValue(item.value)
  }

  const saveConfig = async (key) => {
    setSaving(true)
    await supabase.from('app_config').update({ value: editValue }).eq('key', key)
    setConfig(prev => prev.map(c => c.key === key ? { ...c, value: editValue } : c))
    setEditingKey(null)
    setSaving(false)
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Laden…</div>

  return (
    <div className="space-y-8">
      {/* App Config */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">App-Konfiguration</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Key</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Value</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Aktualisiert</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {config.map((item) => (
                <tr key={item.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.key}</td>
                  <td className="px-4 py-3">
                    {editingKey === item.key ? (
                      <input
                        className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveConfig(item.key)}
                        onBlur={() => saveConfig(item.key)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-gray-800 cursor-pointer border border-transparent hover:border-dashed hover:border-gray-300 rounded px-2 py-1 -mx-2 block truncate max-w-md"
                        onClick={() => startEdit(item)}
                      >
                        {item.value || <span className="text-gray-300 italic">leer</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {item.updated_at ? format(new Date(item.updated_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '–'}
                  </td>
                  <td className="px-4 py-3">
                    {editingKey === item.key ? (
                      <button onClick={() => saveConfig(item.key)} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Save size={15} />
                      </button>
                    ) : (
                      <button onClick={() => startEdit(item)} className="p-1 text-gray-300 hover:text-blue-500 rounded">
                        <Edit2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {config.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Keine Konfiguration vorhanden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { key: 'auftragstypen', label: 'Auftragstypen', icon: BookOpen },
  { key: 'kundentypen', label: 'Kundentypen', icon: BookOpen },
  { key: 'email', label: 'E-Mail Subscriptions', icon: Mail },
  { key: 'system', label: 'System', icon: Database },
]

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Einstellungen() {
  const [activeTab, setActiveTab] = useState('auftragstypen')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings2 size={24} className="text-gray-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Einstellungen</h2>
          <p className="text-sm text-gray-500">Systemkonfiguration und Optionen verwalten</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'auftragstypen' && <OptionEditor kategorie="auftragstyp" label="Auftragstypen" />}
        {activeTab === 'kundentypen' && <OptionEditor kategorie="kundentyp" label="Kundentypen" />}
        {activeTab === 'email' && <EmailSubscriptions />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  )
}
