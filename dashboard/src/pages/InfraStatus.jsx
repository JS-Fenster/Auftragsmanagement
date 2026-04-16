import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Activity, Server, GitBranch, Database, Shield, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Pause, AlertCircle, Info } from 'lucide-react'

const INFRA_SOURCES = ['heartbeat_check', 'infra_health', 'backup_script']
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
  const warnThreshold = item.expected_interval_seconds * 1.0
  if (ageSec > threshold) return 'stale'
  if (ageSec > warnThreshold) return 'warning'
  if (item.last_status === 'error') return 'error'
  if (item.last_status === 'warning') return 'warning'
  return 'ok'
}

const STATUS_STYLES = {
  ok:      { bg: '#F0FDF4', border: '#22C55E', icon: CheckCircle,    iconColor: '#16A34A', label: 'OK' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', icon: AlertTriangle,  iconColor: '#D97706', label: 'Warnung' },
  error:   { bg: '#FEF2F2', border: '#EF4444', icon: XCircle,        iconColor: '#DC2626', label: 'Fehler' },
  stale:   { bg: '#FEF2F2', border: '#DC2626', icon: Clock,          iconColor: '#DC2626', label: 'Überfällig' },
  muted:   { bg: '#F3F4F6', border: '#9CA3AF', icon: Pause,          iconColor: '#6B7280', label: 'Pausiert' },
}

function HeartbeatCard({ item }) {
  const health = getHealthStatus(item)
  const style = STATUS_STYLES[health]
  const StatusIcon = style.icon

  return (
    <div
      className="rounded-lg p-3 transition-all hover:shadow-md"
      style={{ backgroundColor: style.bg, borderLeft: `4px solid ${style.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.display_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.name}</p>
        </div>
        <StatusIcon size={20} style={{ color: style.iconColor, flexShrink: 0 }} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
        <span>{formatAge(item.last_seen_at)}</span>
        {item.host && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{item.host}</span>}
      </div>
    </div>
  )
}

export default function InfraStatus() {
  const [heartbeats, setHeartbeats] = useState([])
  const [infraNotifs, setInfraNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [hbRes, notifRes] = await Promise.all([
        supabase.from('automation_heartbeats').select('*').order('category').order('display_name'),
        supabase.from('notifications').select('*').in('source', INFRA_SOURCES).order('created_at', { ascending: false }).limit(20),
      ])
      if (hbRes.error) throw hbRes.error
      setHeartbeats(hbRes.data || [])
      setInfraNotifs(notifRes.data || [])
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
    return () => clearInterval(interval)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-main">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Infrastruktur</h1>
            <p className="text-sm text-text-secondary mt-1">
              {summary.total} Automationen überwacht
              {lastRefresh && <span className="ml-2 text-text-muted">· Aktualisiert {formatAge(lastRefresh.toISOString())}</span>}
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border-default hover:bg-surface-card transition-colors text-text-secondary"
          >
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

        {/* Grouped Heartbeat Cards */}
        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
          const items = grouped[cat]
          if (!items || items.length === 0) return null
          const CatIcon = meta.icon
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <CatIcon size={18} style={{ color: meta.color }} />
                <h2 className="text-base font-semibold text-text-primary">{meta.label}</h2>
                <span className="text-xs text-text-muted">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map(item => <HeartbeatCard key={item.id} item={item} />)}
              </div>
            </section>
          )
        })}

        {/* Letzte Infra-Meldungen */}
        {infraNotifs.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-red-500" />
              <h2 className="text-base font-semibold text-text-primary">Letzte Meldungen</h2>
              <span className="text-xs text-text-muted">({infraNotifs.length})</span>
            </div>
            <div className="bg-surface-card rounded-lg border border-border-default divide-y divide-border-default">
              {infraNotifs.map(n => {
                const cfg = NOTIF_TYPE_CONFIG[n.type] || NOTIF_TYPE_CONFIG.info
                const NIcon = cfg.icon
                return (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 p-1.5 rounded-lg shrink-0" style={{ backgroundColor: cfg.bg }}>
                      <NIcon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{n.title}</p>
                      {n.body && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-muted">{formatAge(n.created_at)}</span>
                        <span className="text-xs text-text-muted">·</span>
                        <span className="text-xs text-text-muted">{n.source}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
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
