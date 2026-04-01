import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PROJEKT_STATUS } from '../lib/constants'
import {
  Search, Zap, FolderKanban, CalendarDays, Calculator, History,
  ClipboardList, FileText, Users, Mail, Settings, FolderPlus, ArrowRight
} from 'lucide-react'

const ACTIONS = [
  { id: 'new-project', label: 'Neues Projekt anlegen', icon: FolderPlus, path: '/projekte', action: 'new-project' },
  { id: 'cockpit', label: 'Cockpit', icon: Zap, path: '/' },
  { id: 'projekte', label: 'Projekte', icon: FolderKanban, path: '/projekte' },
  { id: 'kalender', label: 'Kalender / Montageplanung', icon: CalendarDays, path: '/kalender' },
  { id: 'budgetangebot', label: 'Budgetangebot erstellen', icon: Calculator, path: '/budgetangebot' },
  { id: 'verlauf', label: 'Angebotsverlauf', icon: History, path: '/budgetangebot-verlauf' },
  { id: 'auftraege', label: 'Aufträge / Reparaturen', icon: ClipboardList, path: '/auftraege' },
  { id: 'dokumente', label: 'Dokumente', icon: FileText, path: '/dokumente' },
  { id: 'kunden', label: 'Kunden', icon: Users, path: '/kunden' },
  { id: 'emails', label: 'E-Mails', icon: Mail, path: '/emails' },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings, path: '/einstellungen' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ actions: ACTIONS, projekte: [], kontakte: [] })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  // Global keyboard listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opening, reset state
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults({ actions: ACTIONS, projekte: [], kontakte: [] })
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return

    if (query.length < 2) {
      setResults({ actions: ACTIONS, projekte: [], kontakte: [] })
      setSelectedIndex(0)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      const q = query.trim()

      // Filter static actions
      const filteredActions = ACTIONS.filter(a =>
        a.label.toLowerCase().includes(q.toLowerCase())
      )

      // Search projekte + kontakte in parallel
      const [projektRes, kontaktRes] = await Promise.all([
        supabase
          .from('projekte')
          .select('id, projekt_nummer, titel, status')
          .or(`titel.ilike.%${q}%,projekt_nummer.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('kontakte')
          .select('id, firma1, firma2, ort')
          .or(`firma1.ilike.%${q}%,firma2.ilike.%${q}%`)
          .limit(5),
      ])

      setResults({
        actions: filteredActions,
        projekte: projektRes.data || [],
        kontakte: kontaktRes.data || [],
      })
      setSelectedIndex(0)
      setLoading(false)
    }, 200)

    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [query, open])

  // Build flat list for keyboard navigation
  const allItems = useMemo(() => [
    ...results.projekte.map(p => ({ type: 'projekt', ...p })),
    ...results.kontakte.map(k => ({ type: 'kontakt', ...k })),
    ...results.actions.map(a => ({ type: 'action', ...a })),
  ], [results])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (item) => {
    setOpen(false)
    if (item.type === 'action') {
      navigate(item.path)
    } else if (item.type === 'projekt') {
      navigate(`/projekte/${item.id}`)
    } else if (item.type === 'kontakt') {
      navigate(`/kunden?search=${encodeURIComponent(item.firma1 || item.firma2)}`)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault()
      handleSelect(allItems[selectedIndex])
    }
  }

  if (!open) return null

  // Compute section boundaries for rendering groups
  const projekteStart = 0
  const projekteEnd = results.projekte.length
  const kontakteStart = projekteEnd
  const kontakteEnd = kontakteStart + results.kontakte.length
  const actionsStart = kontakteEnd

  const hasResults = allItems.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-surface-card rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suche oder Aktion..."
            className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-text-muted bg-surface-hover rounded border border-border-default">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
          {loading && (
            <div className="px-4 py-3 text-xs text-text-muted">Suche...</div>
          )}

          {!loading && !hasResults && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              Keine Ergebnisse gefunden
            </div>
          )}

          {/* Projekte section */}
          {results.projekte.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Projekte
              </div>
              {results.projekte.map((p, i) => {
                const idx = projekteStart + i
                const isSelected = idx === selectedIndex
                const statusConf = PROJEKT_STATUS[p.status]
                return (
                  <div
                    key={`p-${p.id}`}
                    data-selected={isSelected}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${isSelected ? 'bg-brand-light' : 'hover:bg-surface-main'}`}
                    onClick={() => handleSelect({ type: 'projekt', ...p })}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <FolderKanban size={16} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-text-primary truncate">
                        {p.projekt_nummer && (
                          <span className="font-medium text-text-secondary mr-1.5">{p.projekt_nummer}</span>
                        )}
                        {p.titel || 'Ohne Titel'}
                      </span>
                    </div>
                    {statusConf && (
                      <span
                        className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: statusConf.bg,
                          color: statusConf.text,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    )}
                    <ArrowRight size={14} className="text-text-muted shrink-0" />
                  </div>
                )
              })}
            </>
          )}

          {/* Kontakte section */}
          {results.kontakte.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Kunden
              </div>
              {results.kontakte.map((k, i) => {
                const idx = kontakteStart + i
                const isSelected = idx === selectedIndex
                const displayName = [k.firma1, k.firma2].filter(Boolean).join(' - ')
                return (
                  <div
                    key={`k-${k.id}`}
                    data-selected={isSelected}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${isSelected ? 'bg-brand-light' : 'hover:bg-surface-main'}`}
                    onClick={() => handleSelect({ type: 'kontakt', ...k })}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Users size={16} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0 text-sm text-text-primary truncate">
                      {displayName || 'Unbenannt'}
                      {k.ort && <span className="text-text-muted ml-1.5">- {k.ort}</span>}
                    </div>
                    <ArrowRight size={14} className="text-text-muted shrink-0" />
                  </div>
                )
              })}
            </>
          )}

          {/* Actions section */}
          {results.actions.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Aktionen
              </div>
              {results.actions.map((a, i) => {
                const idx = actionsStart + i
                const isSelected = idx === selectedIndex
                const Icon = a.icon
                return (
                  <div
                    key={`a-${a.id}`}
                    data-selected={isSelected}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${isSelected ? 'bg-brand-light' : 'hover:bg-surface-main'}`}
                    onClick={() => handleSelect({ type: 'action', ...a })}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Icon size={16} className="text-text-muted shrink-0" />
                    <span className="flex-1 text-sm text-text-primary">{a.label}</span>
                    <ArrowRight size={14} className="text-text-muted shrink-0" />
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border-light text-[11px] text-text-muted">
          <span><kbd className="font-medium">↑↓</kbd> Navigation</span>
          <span><kbd className="font-medium">↵</kbd> Oeffnen</span>
          <span><kbd className="font-medium">Esc</kbd> Schliessen</span>
        </div>
      </div>
    </div>
  )
}

// Integration: In App.jsx einfuegen: import CommandPalette from './components/CommandPalette'
// Dann <CommandPalette /> als letztes Kind von <div className="flex h-screen..."> rendern
