import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, Check, CheckCheck, AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink, Archive, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TYPE_CONFIG = {
  error:   { icon: AlertCircle,   color: '#DC2626', bg: '#FEF2F2', label: 'Fehler' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', label: 'Warnung' },
  info:    { icon: Info,          color: '#3B82F6', bg: '#EFF6FF', label: 'Info' },
  success: { icon: CheckCircle,   color: '#10B981', bg: '#ECFDF5', label: 'Erfolg' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length
  const readCount = notifications.filter(n => n.read && !n.archived).length

  const visibleNotifications = notifications.filter(n =>
    showArchive ? n.archived : !n.archived
  )

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAsRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read && !n.archived).map(n => n.id)
    if (!unreadIds.length) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read: true } : n))
  }

  async function archiveRead() {
    const readIds = notifications.filter(n => n.read && !n.archived).map(n => n.id)
    if (!readIds.length) return
    await supabase.from('notifications').update({ archived: true }).in('id', readIds)
    setNotifications(prev => prev.map(n => readIds.includes(n.id) ? { ...n, archived: true } : n))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-4 py-2.5 mx-2 text-sm text-text-muted hover:text-text-secondary hover:bg-nav-hover-bg rounded-lg transition-colors w-full text-left relative cursor-pointer"
      >
        <Bell size={18} />
        <span>Meldungen</span>
        {unreadCount > 0 && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="fixed w-96 bg-surface-card border border-border-default rounded-xl shadow-xl z-50 flex flex-col min-h-[200px]" style={{ left: '232px', top: '16px', maxHeight: 'calc(100vh - 32px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">
              {showArchive ? 'Archiv' : 'Meldungen'}
            </h3>
            <div className="flex items-center gap-3">
              {!showArchive && unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors cursor-pointer"
                  title="Alle als gelesen markieren"
                >
                  <CheckCheck size={14} />
                  Alle gelesen
                </button>
              )}
              {!showArchive && readCount > 0 && (
                <button
                  onClick={archiveRead}
                  className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  title="Gelesene archivieren"
                >
                  <Archive size={14} />
                  Archivieren
                </button>
              )}
              <button
                onClick={() => setShowArchive(prev => !prev)}
                className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
                  showArchive ? 'text-brand hover:text-brand-hover' : 'text-gray-400 hover:text-gray-600'
                }`}
                title={showArchive ? 'Aktuelle anzeigen' : 'Archiv anzeigen'}
              >
                {showArchive ? <RotateCcw size={14} /> : <Archive size={14} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-text-muted">Laden...</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-muted">
                {showArchive ? 'Kein Archiv vorhanden' : 'Keine Meldungen'}
              </div>
            ) : (
              visibleNotifications.map(n => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
                const Icon = config.icon

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border-light transition-colors ${
                      n.read
                        ? 'opacity-50'
                        : 'bg-brand-light/30 hover:bg-brand-light/50 cursor-pointer'
                    }`}
                  >
                    <div
                      className="mt-0.5 p-1.5 rounded-lg shrink-0"
                      style={{ backgroundColor: config.bg }}
                    >
                      <Icon size={14} style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-muted">{timeAgo(n.created_at)}</span>
                        <span className="text-xs text-border-default">|</span>
                        <span className="text-xs text-text-muted">{n.source}</span>
                        {n.metadata?.run_url && (
                          <a
                            href={n.metadata.run_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand hover:text-brand-hover flex items-center gap-0.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={10} />
                            Details
                          </a>
                        )}
                      </div>
                    </div>
                    {!n.read && !showArchive && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead(n.id) }}
                        className="mt-1 p-1.5 text-brand hover:text-brand-hover hover:bg-brand-light rounded-md transition-colors shrink-0 cursor-pointer"
                        title="Als gelesen markieren"
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
