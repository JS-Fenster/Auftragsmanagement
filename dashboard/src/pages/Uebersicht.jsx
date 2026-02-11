import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AUFTRAG_STATUS } from '../lib/constants'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { ClipboardList, FileText, Mail, Users, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

function KpiCard({ icon: Icon, label, value, loading, color = 'text-blue-600', bgColor = 'bg-blue-50' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`${bgColor} rounded-lg p-3`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ active }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
  )
}

function ProcessingBadge({ label, count, color }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span
        className="text-sm font-semibold px-2.5 py-0.5 rounded-full"
        style={{ backgroundColor: color + '20', color }}
      >
        {count}
      </span>
    </div>
  )
}

export default function Uebersicht() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [kpis, setKpis] = useState({ offeneAuftraege: 0, dokumente: 0, emailsHeute: 0, kunden: 0 })
  const [subscriptions, setSubscriptions] = useState([])
  const [processingStats, setProcessingStats] = useState({})
  const [agingAuftraege, setAgingAuftraege] = useState([])
  const [aktivitaeten, setAktivitaeten] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [
        offeneRes,
        dokuRes,
        emailHeuteRes,
        kundenRes,
        subsRes,
        processingRes,
        agingRes,
        letzteAuftraegeRes,
        letzteEmailsRes,
      ] = await Promise.all([
        // Offene Aufträge
        supabase
          .from('auftraege')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '("ERLEDIGT","ARCHIVIERT")'),
        // Dokumente gesamt
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true }),
        // E-Mails heute
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'email')
          .gte('created_at', todayStart.toISOString()),
        // Kunden gesamt
        supabase
          .from('erp_kunden')
          .select('code', { count: 'exact', head: true }),
        // E-Mail Subscriptions
        supabase
          .from('email_subscriptions')
          .select('*'),
        // Processing Status counts - individual count queries
        Promise.all([
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'done'),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'queued'),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'processing'),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'pending_ocr'),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('processing_status', 'error'),
        ]).then(results => ({
          data: { done: results[0].count||0, queued: results[1].count||0, processing: results[2].count||0, pending_ocr: results[3].count||0, error: results[4].count||0 },
          error: results.find(r => r.error)?.error || null,
        })),
        // Aging-Warnungen
        supabase
          .from('auftraege')
          .select('id, beschreibung, neukunde_name, adresse_ort, erstellt_am')
          .eq('ist_zu_lange_offen', true)
          .order('erstellt_am', { ascending: true }),
        // Letzte 5 Aufträge
        supabase
          .from('auftraege')
          .select('id, beschreibung, neukunde_name, status, erstellt_am')
          .order('erstellt_am', { ascending: false })
          .limit(5),
        // Letzte 5 E-Mails
        supabase
          .from('documents')
          .select('id, email_betreff, source, created_at')
          .eq('source', 'email')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Check for errors
      const results = [offeneRes, dokuRes, emailHeuteRes, kundenRes, subsRes, processingRes, agingRes, letzteAuftraegeRes, letzteEmailsRes]
      const firstError = results.find(r => r.error)
      if (firstError?.error) {
        throw new Error(firstError.error.message)
      }

      // KPIs
      setKpis({
        offeneAuftraege: offeneRes.count ?? 0,
        dokumente: dokuRes.count ?? 0,
        emailsHeute: emailHeuteRes.count ?? 0,
        kunden: kundenRes.count ?? 0,
      })

      // Subscriptions
      setSubscriptions(subsRes.data ?? [])

      // Processing stats
      setProcessingStats(processingRes.data ?? {})

      // Aging
      setAgingAuftraege(agingRes.data ?? [])

      // Letzte Aktivitäten - merge and sort
      const auftraege = (letzteAuftraegeRes.data ?? []).map(a => ({
        typ: 'auftrag',
        beschreibung: `${a.beschreibung || 'Auftrag'} – ${a.neukunde_name || 'Kunde'}`,
        datum: a.erstellt_am,
        status: a.status,
      }))
      const emails = (letzteEmailsRes.data ?? []).map(d => ({
        typ: 'email',
        beschreibung: d.email_betreff || 'E-Mail',
        datum: d.created_at,
      }))
      const merged = [...auftraege, ...emails]
        .sort((a, b) => new Date(b.datum) - new Date(a.datum))
        .slice(0, 10)
      setAktivitaeten(merged)

    } catch (err) {
      console.error('Uebersicht load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const processingConfig = {
    done: { label: 'Fertig', color: '#10B981' },
    queued: { label: 'Warteschlange', color: '#9CA3AF' },
    processing: { label: 'Verarbeitung', color: '#3B82F6' },
    pending_ocr: { label: 'OCR ausstehend', color: '#F59E0B' },
    error: { label: 'Fehler', color: '#EF4444' },
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Übersicht</h2>
        <p className="text-gray-500 mt-1">Dashboard &amp; Systemstatus</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Fehler beim Laden: {error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={ClipboardList} label="Offene Aufträge" value={kpis.offeneAuftraege} loading={loading} color="text-gray-600" bgColor="bg-gray-100" />
        <KpiCard icon={FileText} label="Dokumente gesamt" value={kpis.dokumente} loading={loading} color="text-gray-600" bgColor="bg-gray-100" />
        <KpiCard icon={Mail} label="E-Mails heute" value={kpis.emailsHeute} loading={loading} color="text-gray-600" bgColor="bg-gray-100" />
        <KpiCard icon={Users} label="Kunden gesamt" value={kpis.kunden} loading={loading} color="text-gray-600" bgColor="bg-gray-100" />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-2 gap-4">
        {/* E-Mail Pipeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">E-Mail Pipeline</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500">Keine E-Mail-Subscriptions konfiguriert.</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map(sub => {
                const now = new Date()
                const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null
                const isHealthy = sub.is_active && (!expiresAt || expiresAt > now)
                return (
                  <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <StatusDot active={isHealthy} />
                      <span className="text-sm font-medium text-gray-700">{sub.email_postfach || 'Unbekannt'}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {expiresAt ? (
                        <>Läuft ab: {formatDistanceToNow(expiresAt, { locale: de, addSuffix: true })}</>
                      ) : (
                        'Kein Ablauf'
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Verarbeitung */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verarbeitung</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(processingConfig).map(([key, cfg]) => (
                <ProcessingBadge key={key} label={cfg.label} count={processingStats[key] || 0} color={cfg.color} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aging-Warnungen */}
      {!loading && agingAuftraege.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-800">Überfällige Aufträge</h3>
          </div>
          <div className="space-y-2">
            {agingAuftraege.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 bg-yellow-100/50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-yellow-900">{a.beschreibung || 'Auftrag'}</span>
                  <span className="text-sm text-yellow-700 ml-2">– {a.neukunde_name || a.adresse_ort || 'Unbekannt'}</span>
                </div>
                <span className="text-xs text-yellow-600">
                  Offen seit {formatDistanceToNow(new Date(a.erstellt_am), { locale: de })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letzte Aktivitäten */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Letzte Aktivitäten</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : aktivitaeten.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Aktivitäten vorhanden.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pb-3 pr-4 w-12">Typ</th>
                <th className="pb-3 pr-4">Beschreibung</th>
                <th className="pb-3 text-right">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aktivitaeten.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    {item.typ === 'auftrag' ? (
                      <ClipboardList className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Mail className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm text-gray-900">{item.beschreibung}</span>
                    {item.status && AUFTRAG_STATUS[item.status] && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: AUFTRAG_STATUS[item.status].bg,
                          color: AUFTRAG_STATUS[item.status].text,
                        }}
                      >
                        {AUFTRAG_STATUS[item.status].label}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right text-sm text-gray-500">
                    {formatDistanceToNow(new Date(item.datum), { locale: de, addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
