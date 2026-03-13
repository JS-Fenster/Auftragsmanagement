import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, Check, CheckCheck, AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const panelRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

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
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-4 py-2.5 mx-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full text-left relative cursor-pointer"
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
        <div className="fixed w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col max-h-[calc(100vh-72px)]" style={{ left: '232px', bottom: '56px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Meldungen</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  title="Alle als gelesen markieren"
                >
                  <CheckCheck size={14} />
                  Alle gelesen
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Laden...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Keine Meldungen</div>
            ) : (
              notifications.map(n => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
                const Icon = config.icon

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${
                      n.read
                        ? 'opacity-50'
                        : 'bg-blue-50/30 hover:bg-blue-50/50 cursor-pointer'
                    }`}
                  >
                    <div
                      className="mt-0.5 p-1.5 rounded-lg shrink-0"
                      style={{ backgroundColor: config.bg }}
                    >
                      <Icon size={14} style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs text-gray-400">{n.source}</span>
                        {n.metadata?.run_url && (
                          <a
                            href={n.metadata.run_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={10} />
                            Details
                          </a>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead(n.id) }}
                        className="mt-1 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors shrink-0 cursor-pointer"
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
