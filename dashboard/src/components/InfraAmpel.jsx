import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  ok:      '#16A34A',
  warning: '#F59E0B',
  stale:   '#DC2626',
}

function getWorstStatus(heartbeats) {
  let hasStale = false, hasWarn = false
  for (const hb of heartbeats) {
    if (hb.muted_until && new Date(hb.muted_until) > new Date()) continue
    if (!hb.last_seen_at) { hasStale = true; continue }
    const ageSec = (Date.now() - new Date(hb.last_seen_at).getTime()) / 1000
    const threshold = hb.expected_interval_seconds * hb.stale_factor
    if (ageSec > threshold || hb.last_status === 'error') hasStale = true
    else if (ageSec > hb.expected_interval_seconds || hb.last_status === 'warning') hasWarn = true
  }
  if (hasStale) return 'stale'
  if (hasWarn) return 'warning'
  return 'ok'
}

export default function InfraAmpel() {
  const [status, setStatus] = useState('ok')
  const [count, setCount] = useState(0)
  const navigate = useNavigate()

  const check = useCallback(async () => {
    const { data } = await supabase.from('automation_heartbeats').select('*')
    if (data) {
      setStatus(getWorstStatus(data))
      setCount(data.length)
    }
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [check])

  const color = STATUS_COLORS[status]
  const label = status === 'ok' ? `${count} Systeme OK` : status === 'warning' ? 'Warnung' : 'Störung'

  return (
    <button
      onClick={() => navigate('/infrastruktur')}
      className="flex items-center gap-2 px-4 py-2.5 mx-2 text-sm text-text-muted hover:text-text-secondary hover:bg-nav-hover-bg rounded-lg transition-colors w-full text-left cursor-pointer"
      title={label}
    >
      <div className="relative">
        <Activity size={18} style={{ color }} />
        {status !== 'ok' && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <span>Infrastruktur</span>
      <span
        className="ml-auto w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
    </button>
  )
}
