import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Activity, Server, GitBranch, Database, Shield, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Pause, AlertCircle, Info, Check, CheckCheck, Archive, RotateCcw, CalendarClock, ChevronRight, ChevronDown, History, Zap } from 'lucide-react'

const INFRA_SOURCES = ['heartbeat_check', 'infra_health', 'backup_script', 'github_action', 'nas', 'edge_function']
const NOTIF_TYPE_CONFIG = {
  error:   { icon: AlertCircle,   color: '#DC2626', bg: '#FEF2F2' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' },
  info:    { icon: Info,          color: '#3B82F6', bg: '#EFF6FF' },
  success: { icon: CheckCircle,   color: '#10B981', bg: '#ECFDF5' },
}

const CATEGORY_META = {
  backup:        { label: 'Backups',         icon: Server,    color: '#DC2626' },
  monitoring:    { label: 'Monitoring',      icon: Shield,    color: '#7C3AED' },
  edge_function: { label: 'Edge Functions',  icon: Database,  color: '#2563EB' },
  github_action: { label: 'GitHub Actions',  icon: GitBranch, color: '#059669' },
  'data-input':  { label: 'Datenverarbeitung', icon: Activity, color: '#D97706' },
}

function formatAge(lastSeenAt) {
  if (!lastSeenAt) return 'nie'
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std`
  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`
}

function getHealthStatus(item) {
  if (item.muted_until && new Date(item.muted_until) > new Date()) return 'muted'
  if (!item.last_seen_at) return 'stale'
  const ageSec = (Date.now() - new Date(item.last_seen_at).getTime()) / 1000
  const threshold = item.expected_interval_seconds * item.stale_factor
  if (ageSec > threshold) return 'stale'
  if (item.last_status === 'error') return 'error'
  if (item.last_status === 'warning') return 'warning'
  // Zwischenfenster (interval < age < interval*factor) = OK, nicht Warnung.
  // Jobs laufen exakt am Intervall, kurz vor naechstem Lauf immer "alt".
  return 'ok'
}

const STATUS_STYLES = {
  ok:      { bg: '#F0FDF4', border: '#22C55E', icon: CheckCircle,    iconColor: '#16A34A' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', icon: AlertTriangle,  iconColor: '#D97706' },
  error:   { bg: '#FEF2F2', border: '#EF4444', icon: XCircle,        iconColor: '#DC2626' },
  stale:   { bg: '#FEF2F2', border: '#DC2626', icon: Clock,          iconColor: '#DC2626' },
  muted:   { bg: '#F3F4F6', border: '#9CA3AF', icon: Pause,          iconColor: '#6B7280' },
}

function HeartbeatRow({ item }) {
  const health = getHealthStatus(item)
  const style = STATUS_STYLES[health]
  const StatusIcon = style.icon

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md h-10" style={{ backgroundColor: style.bg, borderLeft: `3px solid ${style.border}` }}>
      <StatusIcon size={16} style={{ color: style.iconColor }} className="shrink-0" />
      <span className="text-sm font-medium text-gray-900 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.display_name}</span>
      <span className="text-xs text-gray-500 shrink-0">{formatAge(item.last_seen_at)}</span>
      {item.host && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 shrink-0">{item.host}</span>}
    </div>
  )
}

export default function InfraStatus() {
  const [heartbeats, setHeartbeats] = useState([])
  const [infraNotifs, setInfraNotifs] = useState([])
  const [expiringItems, setExpiringItems] = useState([])
  const [incidents, setIncidents] = useState([])
  const [showIncidentHistory, setShowIncidentHistory] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [expandedCats, setExpandedCats] = useState(new Set())

  function toggleCat(cat) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const loadData = useCallback(async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const [hbRes, notifRes, expRes, incRes] = await Promise.all([
        supabase.from('automation_heartbeats').select('*').order('category').order('display_name'),
        supabase.from('notifications').select('*').in('source', INFRA_SOURCES).order('created_at', { ascending: false }).limit(50),
        supabase.from('expiring_items').select('*').order('expires_at'),
        supabase.from('infra_incidents').select('*').gte('started_at', sevenDaysAgo).order('started_at', { ascending: false }).limit(100),
      ])
      if (hbRes.error) throw hbRes.error
      setHeartbeats(hbRes.data || [])
      setInfraNotifs(notifRes.data || [])
      setExpiringItems(expRes.data || [])
      setIncidents(incRes.data || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('InfraStatus loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    const channel = supabase
      .channel('infra-notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (INFRA_SOURCES.includes(payload.new.source)) {
          setInfraNotifs(prev => [payload.new, ...prev].slice(0, 50))
        }
      })
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const grouped = useMemo(() => {
    const groups = {}
    for (const hb of heartbeats) {
      const cat = hb.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(hb)
    }
    return groups
  }, [heartbeats])

  const incidentStats = useMemo(() => {
    const now = Date.now()
    const openIncidents = incidents.filter(i => !i.ended_at)
    const closed = incidents.filter(i => i.ended_at)

    // Top 5 by duration (closed incidents sorted by duration_seconds)
    const topByDuration = [...closed].sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0)).slice(0, 5)

    // Flapping: count incidents per service in last 24h/7d, flag if >= threshold
    const byService = {}
    for (const inc of incidents) {
      const age = now - new Date(inc.started_at).getTime()
      if (age > 7 * 24 * 3600 * 1000) continue
      if (!byService[inc.service_name]) byService[inc.service_name] = { count: 0, category: inc.category, latest: inc.started_at }
      byService[inc.service_name].count += 1
    }
    const flapping = Object.entries(byService)
      .filter(([, v]) => v.count >= 3)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)

    // Total downtime last 7d per service (closed only; open incidents count time-to-now)
    const downtimeByService = {}
    for (const inc of incidents) {
      const start = new Date(inc.started_at).getTime()
      const end = inc.ended_at ? new Date(inc.ended_at).getTime() : now
      const durSec = Math.floor((end - start) / 1000)
      downtimeByService[inc.service_name] = (downtimeByService[inc.service_name] || 0) + durSec
    }
    const topDowntime = Object.entries(downtimeByService)
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5)

    return { openIncidents, closed, topByDuration, flapping, topDowntime }
  }, [incidents])

  function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${Math.max(0, seconds)}s`
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins} Min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ${mins % 60}m`
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  const summary = useMemo(() => {
    let ok = 0, warn = 0, stale = 0, muted = 0
    for (const hb of heartbeats) {
      const s = getHealthStatus(hb)
      if (s === 'ok') ok++
      else if (s === 'warning') warn++
      else if (s === 'muted') muted++
      else stale++
    }
    return { ok, warn, stale, muted, total: heartbeats.length }
  }, [heartbeats])

  const visibleNotifs = infraNotifs.filter(n => showArchive ? n.archived : !n.archived)
  const unreadCount = infraNotifs.filter(n => !n.read && !n.archived).length
  const readCount = infraNotifs.filter(n => n.read && !n.archived).length

  async function markAsRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setInfraNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllAsRead() {
    const ids = infraNotifs.filter(n => !n.read && !n.archived).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setInfraNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
  }

  async function archiveRead() {
    const ids = infraNotifs.filter(n => n.read && !n.archived).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ archived: true }).in('id', ids)
    setInfraNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, archived: true } : n))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-main">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Infrastruktur</h1>
            <p className="text-sm text-text-secondary mt-1">
              {summary.total} Automationen überwacht
              {lastRefresh && <span className="ml-2 text-text-muted">· Aktualisiert {formatAge(lastRefresh.toISOString())}</span>}
            </p>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border-default hover:bg-surface-card transition-colors text-text-secondary">
            <RefreshCw size={14} />
            Aktualisieren
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Gesund" value={summary.ok} color="#16A34A" icon={CheckCircle} />
          <SummaryCard label="Warnung" value={summary.warn} color="#D97706" icon={AlertTriangle} />
          <SummaryCard label="Überfällig" value={summary.stale} color="#DC2626" icon={XCircle} />
          <SummaryCard label="Pausiert" value={summary.muted} color="#6B7280" icon={Pause} />
        </div>

        {/* Ablaufende Items */}
        {expiringItems.length > 0 && (() => {
          const soon = expiringItems.filter(e => !e.muted && (new Date(e.expires_at) - new Date()) / 86400000 <= e.warn_days_before)
          if (soon.length === 0) return null
          return (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock size={18} className="text-orange-500" />
                <h2 className="text-base font-semibold text-text-primary">Ablaufende Items</h2>
                <span className="text-xs text-text-muted">({soon.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {soon.map(e => {
                  const days = Math.ceil((new Date(e.expires_at) - new Date()) / 86400000)
                  const isExpired = days < 0
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-md h-10" style={{ backgroundColor: isExpired ? '#FEF2F2' : '#FFFBEB', borderLeft: `3px solid ${isExpired ? '#DC2626' : '#F59E0B'}` }}>
                      <CalendarClock size={16} style={{ color: isExpired ? '#DC2626' : '#D97706' }} className="shrink-0" />
                      <span className="text-sm font-medium text-gray-900 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{e.name.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-semibold shrink-0" style={{ color: isExpired ? '#DC2626' : '#D97706' }}>
                        {isExpired ? `${Math.abs(days)}d überfällig` : `${days}d`}
                      </span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 shrink-0">{e.category}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })()}

        {/* Incident-Historie (letzte 7 Tage) */}
        {(incidentStats.openIncidents.length > 0 || incidentStats.closed.length > 0) && (
          <section>
            <button
              onClick={() => setShowIncidentHistory(prev => !prev)}
              className="flex items-center gap-2 mb-2 w-full text-left hover:bg-surface-card rounded px-1 py-1 -mx-1 transition-colors cursor-pointer"
              title={showIncidentHistory ? 'Zuklappen' : 'Historie anzeigen'}
            >
              {showIncidentHistory ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
              <History size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-text-primary">Incident-Historie (7 Tage)</h2>
              <span className="text-xs text-text-muted">({incidents.length})</span>
              <span className="ml-auto flex items-center gap-1.5">
                {incidentStats.openIncidents.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                    <AlertCircle size={12} />{incidentStats.openIncidents.length} offen
                  </span>
                )}
                {incidentStats.flapping.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                    <Zap size={12} />{incidentStats.flapping.length} flappt
                  </span>
                )}
              </span>
            </button>

            {/* Offene Incidents immer sichtbar (Andreas soll aktive Probleme sehen) */}
            {incidentStats.openIncidents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mb-2">
                {incidentStats.openIncidents.map(inc => {
                  const runningSec = Math.floor((Date.now() - new Date(inc.started_at).getTime()) / 1000)
                  return (
                    <div key={inc.id} className="flex items-center gap-3 px-3 py-2 rounded-md h-10" style={{ backgroundColor: '#FEF2F2', borderLeft: '3px solid #DC2626' }}>
                      <AlertCircle size={16} className="text-red-600 shrink-0" />
                      <span className="text-sm font-medium text-gray-900 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{inc.service_name}</span>
                      <span className="text-xs font-semibold text-red-600 shrink-0">seit {formatDuration(runningSec)}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 shrink-0">{inc.category}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {showIncidentHistory && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 5 by Downtime */}
                {incidentStats.topDowntime.length > 0 && (
                  <div className="bg-surface-card rounded-lg border border-border-default p-3">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Top 5 Downtime (7 Tage)</h3>
                    <div className="space-y-1.5">
                      {incidentStats.topDowntime.map(s => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 truncate">{s.name}</span>
                          <span className="text-xs font-semibold text-red-600 shrink-0 ml-2">{formatDuration(s.sec)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flapping Services */}
                {incidentStats.flapping.length > 0 && (
                  <div className="bg-surface-card rounded-lg border border-border-default p-3">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Flapping (≥3 Incidents/7T)</h3>
                    <div className="space-y-1.5">
                      {incidentStats.flapping.map(s => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 truncate">{s.name}</span>
                          <span className="text-xs font-semibold text-orange-600 shrink-0 ml-2">{s.count}× Incidents</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Letzte geschlossene Incidents */}
                {incidentStats.closed.length > 0 && (
                  <div className="bg-surface-card rounded-lg border border-border-default p-3 lg:col-span-2">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Letzte abgeschlossene Incidents</h3>
                    <div className="divide-y divide-border-default">
                      {incidentStats.closed.slice(0, 10).map(inc => (
                        <div key={inc.id} className="flex items-center gap-2 py-1.5 text-sm">
                          <span className="font-medium text-gray-900 flex-1 truncate">{inc.service_name}</span>
                          <span className="text-xs text-text-muted">{inc.category}</span>
                          <span className="text-xs text-text-muted">·</span>
                          <span className="text-xs font-semibold text-text-secondary">{formatDuration(inc.duration_seconds)}</span>
                          <span className="text-xs text-text-muted">·</span>
                          <span className="text-xs text-text-muted shrink-0">{formatAge(inc.ended_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Meldungen — OBEN, mit gelesen/archiviert */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h2 className="text-base font-semibold text-text-primary">
                {showArchive ? 'Archiv' : 'Meldungen'}
              </h2>
              {!showArchive && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!showArchive && unreadCount > 0 && (
                <button onClick={markAllAsRead} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer">
                  <CheckCheck size={14} />
                  Alle gelesen
                </button>
              )}
              {!showArchive && readCount > 0 && (
                <button onClick={archiveRead} className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <Archive size={14} />
                  Archivieren
                </button>
              )}
              <button onClick={() => setShowArchive(prev => !prev)} className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${showArchive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {showArchive ? <RotateCcw size={14} /> : <Archive size={14} />}
                {showArchive ? 'Zurück' : 'Archiv'}
              </button>
            </div>
          </div>
          {visibleNotifs.length === 0 ? (
            <div className="bg-surface-card rounded-lg border border-border-default px-4 py-6 text-center text-sm text-text-muted">
              {showArchive ? 'Kein Archiv vorhanden' : 'Keine aktuellen Meldungen'}
            </div>
          ) : (
            <div className="bg-surface-card rounded-lg border border-border-default divide-y divide-border-default">
              {visibleNotifs.map(n => {
                const cfg = NOTIF_TYPE_CONFIG[n.type] || NOTIF_TYPE_CONFIG.info
                const NIcon = cfg.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${n.read ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'}`}
                  >
                    <div className="mt-0.5 p-1 rounded shrink-0" style={{ backgroundColor: cfg.bg }}>
                      <NIcon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-muted">{formatAge(n.created_at)}</span>
                        <span className="text-xs text-text-muted">·</span>
                        <span className="text-xs text-text-muted">{n.source}</span>
                      </div>
                    </div>
                    {!n.read && !showArchive && (
                      <button onClick={e => { e.stopPropagation(); markAsRead(n.id) }} className="mt-1 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors shrink-0 cursor-pointer" title="Als gelesen markieren">
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Heartbeat-Gruppen — Kategorien standardmäßig zugeklappt. Nur Probleme werden sichtbar. */}
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const items = grouped[cat]
          if (!items || items.length === 0) return null
          const CatIcon = meta.icon
          const isExpanded = expandedCats.has(cat)

          const withHealth = items.map(it => ({ ...it, _health: getHealthStatus(it) }))
          const problems = withHealth.filter(it => it._health === 'error' || it._health === 'stale' || it._health === 'warning')
          const okCount = withHealth.filter(it => it._health === 'ok').length
          const mutedCount = withHealth.filter(it => it._health === 'muted').length
          const staleCount = withHealth.filter(it => it._health === 'stale').length
          const warnCount = withHealth.filter(it => it._health === 'warning' || it._health === 'error').length
          const hasProblem = problems.length > 0

          const visibleItems = isExpanded ? withHealth : problems

          return (
            <section key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="flex items-center gap-2 mb-2 w-full text-left hover:bg-surface-card rounded px-1 py-1 -mx-1 transition-colors cursor-pointer"
                title={isExpanded ? 'Zuklappen' : 'Alle anzeigen'}
              >
                {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                <CatIcon size={16} style={{ color: meta.color }} />
                <h2 className="text-sm font-semibold text-text-primary">{meta.label}</h2>
                <span className="text-xs text-text-muted">({items.length})</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {staleCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                      <XCircle size={12} />{staleCount}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <AlertTriangle size={12} />{warnCount}
                    </span>
                  )}
                  {mutedCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Pause size={12} />{mutedCount}
                    </span>
                  )}
                  {!hasProblem && okCount > 0 && !isExpanded && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle size={12} />{okCount}
                    </span>
                  )}
                </span>
              </button>
              {visibleItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {visibleItems.map(item => <HeartbeatRow key={item.id} item={item} />)}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-surface-card rounded-lg border border-border-default p-3 flex items-center gap-3">
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </div>
  )
}
