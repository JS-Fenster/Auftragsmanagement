/**
 * Zeiterfassung — Zentrale Seite fuer Stempelzeiten, Abwesenheiten und Auswertungen
 *
 * Tabs: Tagesuebersicht, Stempel-Protokoll, Abwesenheiten, Monats-Auswertung
 */
import { useState, useEffect } from 'react'
import { Clock, List, CalendarOff, BarChart3, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AbwesenheitenSection from '../components/AbwesenheitenSection'

const TABS = [
  { id: 'tagesuebersicht', label: 'Tagesübersicht', icon: Clock },
  { id: 'stempel', label: 'Stempel-Protokoll', icon: List },
  { id: 'abwesenheiten', label: 'Abwesenheiten', icon: CalendarOff },
  { id: 'auswertung', label: 'Monats-Auswertung', icon: BarChart3 },
]

function Placeholder({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
      <div className="text-lg font-medium mb-2">{title}</div>
      <div className="text-sm">{description}</div>
    </div>
  )
}

function AbwesenheitenTab() {
  const navigate = useNavigate()
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [selectedMa, setSelectedMa] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMa = async () => {
      const { data } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname, status')
        .eq('status', 'aktiv')
        .order('nachname')
      setMitarbeiter(data || [])
      if (data?.length > 0 && !selectedMa) {
        setSelectedMa(data[0].id)
      }
      setLoading(false)
    }
    loadMa()
  }, [])

  if (loading) return <div className="text-sm text-text-muted py-8 text-center">Laden...</div>

  const selected = mitarbeiter.find(m => m.id === selectedMa)

  return (
    <div>
      {/* MA Selector */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium text-text-secondary">Mitarbeiter:</label>
        <select
          value={selectedMa}
          onChange={e => setSelectedMa(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface-main text-text-primary outline-none min-w-[200px]"
        >
          {mitarbeiter.map(m => (
            <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>
          ))}
        </select>
        {selected && (
          <button
            onClick={() => navigate(`/mitarbeiter/${selectedMa}`)}
            className="flex items-center gap-1 text-xs text-brand hover:underline"
          >
            <ExternalLink size={12} /> Stammdaten
          </button>
        )}
      </div>

      {/* Abwesenheiten */}
      {selectedMa && (
        <AbwesenheitenSection
          key={selectedMa}
          mitarbeiterId={selectedMa}
          mitarbeiterName={selected ? `${selected.vorname} ${selected.nachname}` : ''}
        />
      )}
    </div>
  )
}

export default function Zeiterfassung() {
  const [activeTab, setActiveTab] = useState('tagesuebersicht')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-[var(--brand)]" size={24} />
        <h1 className="text-xl font-bold text-text-primary">Zeiterfassung</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-border-default">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[var(--brand)] text-[var(--brand)]'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'tagesuebersicht' && (
        <Placeholder
          title="Tagesübersicht"
          description="Live-Status aller Mitarbeiter — wird in Phase 2 implementiert."
        />
      )}
      {activeTab === 'stempel' && (
        <Placeholder
          title="Stempel-Protokoll"
          description="Chronologische Liste aller Stempelzeiten — wird in Phase 2 implementiert."
        />
      )}
      {activeTab === 'abwesenheiten' && <AbwesenheitenTab />}
      {activeTab === 'auswertung' && (
        <Placeholder
          title="Monats-Auswertung"
          description="Soll/Ist-Vergleich und Überstunden — wird in Phase 2 implementiert."
        />
      )}
    </div>
  )
}
