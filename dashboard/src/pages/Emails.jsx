import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { EMAIL_KATEGORIEN } from '../lib/constants'
import { format, formatDistanceToNow, isToday, subDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { Search, Mail, Paperclip, Clock, Inbox, Filter, ChevronDown, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react'

const PAGE_SIZE = 50

const STATUS_COLORS = {
  done: { dot: 'bg-green-500', text: 'text-green-700' },
  queued: { dot: 'bg-gray-400', text: 'text-gray-600' },
  processing: { dot: 'bg-blue-400', text: 'text-blue-700' },
  pending_ocr: { dot: 'bg-amber-400', text: 'text-amber-700' },
  error: { dot: 'bg-red-500', text: 'text-red-700' },
}

const KATEGORIE_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-amber-100 text-amber-800',
  'bg-red-100 text-red-800',
  'bg-gray-200 text-gray-800',
]

function kategorieColor(kat) {
  if (!kat) return 'bg-gray-100 text-gray-600'
  let hash = 0
  for (let i = 0; i < kat.length; i++) hash = kat.charCodeAt(i) + ((hash << 5) - hash)
  return KATEGORIE_COLORS[Math.abs(hash) % KATEGORIE_COLORS.length]
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 1) return formatDistanceToNow(d, { addSuffix: true, locale: de })
  if (diffDays < 7) return formatDistanceToNow(d, { addSuffix: true, locale: de })
  return format(d, 'dd.MM.yyyy HH:mm', { locale: de })
}

export default function Emails() {
  const [emails, setEmails] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  // Filters
  const [postfaecher, setPostfaecher] = useState([])
  const [filterPostfach, setFilterPostfach] = useState('')
  const [filterKategorie, setFilterKategorie] = useState('')
  const [filterZeitraum, setFilterZeitraum] = useState('alle')
  const [searchTerm, setSearchTerm] = useState('')

  // Pipeline stats
  const [stats, setStats] = useState({ done: 0, queued: 0, error: 0 })

  // Load postfaecher
  useEffect(() => {
    async function loadPostfaecher() {
      const { data } = await supabase
        .from('documents')
        .select('email_postfach')
        .eq('source', 'email')
        .not('email_postfach', 'is', null)
      if (data) {
        const unique = [...new Set(data.map(d => d.email_postfach).filter(Boolean))]
        setPostfaecher(unique.sort())
      }
    }
    loadPostfaecher()
  }, [])

  // Load pipeline stats
  useEffect(() => {
    async function loadStats() {
      const [doneRes, queuedRes, errorRes] = await Promise.all([
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('source', 'email').eq('processing_status', 'done'),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('source', 'email').in('processing_status', ['queued', 'processing', 'pending_ocr']),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('source', 'email').eq('processing_status', 'error'),
      ])
      setStats({
        done: doneRes.count || 0,
        queued: queuedRes.count || 0,
        error: errorRes.count || 0,
      })
    }
    loadStats()
  }, [emails])

  // Load emails
  useEffect(() => {
    loadEmails(true)
  }, [filterPostfach, filterKategorie, filterZeitraum, searchTerm])

  async function loadEmails(reset = false) {
    setLoading(true)
    const newOffset = reset ? 0 : offset

    let query = supabase
      .from('documents')
      .select('id, email_betreff, email_von_email, email_von_name, email_empfangen_am, email_kategorie, email_hat_anhaenge, email_anhaenge_count, email_postfach, processing_status, kategorie')
      .eq('source', 'email')
      .order('email_empfangen_am', { ascending: false })
      .range(newOffset, newOffset + PAGE_SIZE - 1)

    if (filterPostfach) query = query.eq('email_postfach', filterPostfach)
    if (filterKategorie) query = query.eq('email_kategorie', filterKategorie)

    if (filterZeitraum === 'heute') {
      query = query.gte('email_empfangen_am', subDays(new Date(), 1).toISOString())
    } else if (filterZeitraum === '7tage') {
      query = query.gte('email_empfangen_am', subDays(new Date(), 7).toISOString())
    } else if (filterZeitraum === '30tage') {
      query = query.gte('email_empfangen_am', subDays(new Date(), 30).toISOString())
    }

    if (searchTerm.trim()) {
      query = query.or(`email_betreff.ilike.%${searchTerm}%,email_von_email.ilike.%${searchTerm}%,email_von_name.ilike.%${searchTerm}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('Fehler beim Laden der E-Mails:', error)
      setLoading(false)
      return
    }

    if (reset) {
      setEmails(data || [])
      setOffset(PAGE_SIZE)
    } else {
      setEmails(prev => [...prev, ...(data || [])])
      setOffset(newOffset + PAGE_SIZE)
    }
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
  }

  // Load detail
  useEffect(() => {
    if (!selectedId) {
      setSelectedEmail(null)
      setAttachments([])
      return
    }
    async function loadDetail() {
      setLoadingDetail(true)
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', selectedId)
        .single()
      setSelectedEmail(data)

      if (data?.email_hat_anhaenge) {
        const { data: att } = await supabase
          .from('documents')
          .select('id, betreff, kategorie, dokument_url, processing_status')
          .eq('bezug_email_id', selectedId)
        setAttachments(att || [])
      } else {
        setAttachments([])
      }
      setLoadingDetail(false)
    }
    loadDetail()
  }, [selectedId])

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(debouncedSearch), 300)
    return () => clearTimeout(t)
  }, [debouncedSearch])

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline Status Bar */}
      <div className="flex items-center gap-4 px-6 py-2 bg-gray-50 border-b border-gray-200 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-green-700 font-medium">{stats.done}</span>
          <span className="text-gray-500">verarbeitet</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <Loader className="w-4 h-4 text-yellow-600" />
          <span className="text-yellow-700 font-medium">{stats.queued}</span>
          <span className="text-gray-500">in Warteschlange</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-700 font-medium">{stats.error}</span>
          <span className="text-gray-500">Fehler</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
        {/* Postfach */}
        <select
          value={filterPostfach}
          onChange={e => setFilterPostfach(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Alle Postfächer</option>
          {postfaecher.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Kategorie */}
        <select
          value={filterKategorie}
          onChange={e => setFilterKategorie(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Alle Kategorien</option>
          {EMAIL_KATEGORIEN.map(k => (
            <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Zeitraum */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {[
            { key: 'heute', label: 'Heute' },
            { key: '7tage', label: '7 Tage' },
            { key: '30tage', label: '30 Tage' },
            { key: 'alle', label: 'Alle' },
          ].map(z => (
            <button
              key={z.key}
              onClick={() => setFilterZeitraum(z.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filterZeitraum === z.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              } ${z.key !== 'heute' ? 'border-l border-gray-300' : ''}`}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Betreff, Absender durchsuchen..."
            value={debouncedSearch}
            onChange={e => setDebouncedSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {debouncedSearch && (
            <button onClick={() => setDebouncedSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Email List (55%) */}
        <div className="w-[55%] border-r border-gray-200 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {loading && emails.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" />
                <span>E-Mails werden geladen...</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Inbox className="w-10 h-10 mb-2" />
                <span>Keine E-Mails gefunden</span>
              </div>
            ) : (
              <>
                {emails.map(email => (
                  <button
                    key={email.id}
                    onClick={() => setSelectedId(email.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                      selectedId === email.id ? 'bg-blue-50 border-l-3 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {email.email_von_name || email.email_von_email || 'Unbekannt'}
                          </span>
                          {email.email_hat_anhaenge && (
                            <span className="flex items-center gap-0.5 text-gray-400">
                              <Paperclip className="w-3.5 h-3.5" />
                              {email.email_anhaenge_count > 0 && (
                                <span className="text-xs">{email.email_anhaenge_count}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 truncate">
                          {email.email_betreff
                            ? email.email_betreff.length > 80
                              ? email.email_betreff.slice(0, 80) + '...'
                              : email.email_betreff
                            : '(Kein Betreff)'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {email.email_kategorie && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${kategorieColor(email.email_kategorie)}`}>
                              {email.email_kategorie.replace(/_/g, ' ')}
                            </span>
                          )}
                          {email.email_postfach && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              {email.email_postfach}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                        {formatDate(email.email_empfangen_am)}
                      </div>
                    </div>
                  </button>
                ))}

                {hasMore && (
                  <div className="p-4 text-center">
                    <button
                      onClick={() => loadEmails(false)}
                      disabled={loading}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-1">
                          <Loader className="w-4 h-4 animate-spin" /> Laden...
                        </span>
                      ) : (
                        'Weitere laden'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Email Detail (45%) */}
        <div className="w-[45%] flex flex-col min-h-0 overflow-y-auto bg-white">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              <span>Laden...</span>
            </div>
          ) : !selectedEmail ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Mail className="w-12 h-12 mb-3" />
              <span className="text-lg">E-Mail auswaehlen</span>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Header */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedEmail.email_betreff || '(Kein Betreff)'}
                </h2>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Von:</span>
                    <span>{selectedEmail.email_von_name}</span>
                    {selectedEmail.email_von_email && (
                      <span className="text-gray-400">&lt;{selectedEmail.email_von_email}&gt;</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Empfangen:</span>
                    <span>
                      {selectedEmail.email_empfangen_am
                        ? format(new Date(selectedEmail.email_empfangen_am), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Postfach:</span>
                    <span>{selectedEmail.email_postfach || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {selectedEmail.email_kategorie && (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${kategorieColor(selectedEmail.email_kategorie)}`}>
                      {selectedEmail.email_kategorie.replace(/_/g, ' ')}
                    </span>
                  )}
                  {selectedEmail.kategorie && selectedEmail.kategorie !== selectedEmail.email_kategorie && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {selectedEmail.kategorie}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Inhalt</h3>
                {selectedEmail.email_body_text ? (
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border border-gray-200">
                    {selectedEmail.email_body_text}
                  </pre>
                ) : selectedEmail.email_body_html ? (
                  <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-4 border border-amber-200">
                    HTML-Body vorhanden (Text nicht extrahiert)
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 italic">Kein Inhalt verfuegbar</div>
                )}
              </div>

              {/* Attachments */}
              {selectedEmail.email_hat_anhaenge && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4" />
                    Anhaenge ({attachments.length})
                  </h3>
                  {attachments.length > 0 ? (
                    <div className="space-y-1.5">
                      {attachments.map(att => (
                        <div
                          key={att.id}
                          className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                          onClick={() => att.dokument_url && window.open(att.dokument_url, '_blank')}
                        >
                          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-800 truncate">{att.betreff || 'Unbenannt'}</div>
                          </div>
                          {att.kategorie && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${kategorieColor(att.kategorie)}`}>
                              {att.kategorie.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[att.processing_status]?.dot || 'bg-gray-300'}`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">Keine Anhaenge zugeordnet</div>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>
                    <span className="font-medium text-gray-600">Status:</span>{' '}
                    <span className={STATUS_COLORS[selectedEmail.processing_status]?.text || ''}>
                      {selectedEmail.processing_status || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Postfach:</span>{' '}
                    {selectedEmail.email_postfach || '—'}
                  </div>
                  {selectedEmail.email_message_id && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-600">Message-ID:</span>{' '}
                      <span className="font-mono break-all">
                        {selectedEmail.email_message_id.length > 60
                          ? selectedEmail.email_message_id.slice(0, 60) + '...'
                          : selectedEmail.email_message_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
