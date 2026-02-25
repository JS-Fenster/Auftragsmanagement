import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { DOKUMENT_KATEGORIEN, DOKUMENT_QUELLEN, PROCESSING_STATUS } from '../lib/constants'
import { format, subDays, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { Search, FileText, ChevronDown, ChevronRight, Eye, Download, X, Loader2, Mail, Paperclip } from 'lucide-react'

const PAGE_SIZE = 50

const STATUS_DOT = {
  done: '#10B981',
  processing: '#3B82F6',
  queued: '#9CA3AF',
  pending_ocr: '#F59E0B',
  error: '#EF4444',
}

const KATEGORIE_COLORS = {
  Eingangsrechnung: { bg: '#FEF2F2', text: '#991B1B' },
  Ausgangsrechnung: { bg: '#ECFDF5', text: '#065F46' },
  Angebot: { bg: '#EFF6FF', text: '#1E40AF' },
  Auftragsbestaetigung: { bg: '#EFF6FF', text: '#1E40AF' },
  Reklamation: { bg: '#FEF2F2', text: '#991B1B' },
  Vertrag: { bg: '#FFFBEB', text: '#92400E' },
  Montageauftrag: { bg: '#ECFDF5', text: '#065F46' },
  Email_Eingehend: { bg: '#F3F4F6', text: '#374151' },
  Email_Anhang: { bg: '#F3F4F6', text: '#374151' },
}
const DEFAULT_BADGE = { bg: '#F3F4F6', text: '#374151' }

function getBadgeStyle(kategorie) {
  return KATEGORIE_COLORS[kategorie] || DEFAULT_BADGE
}

export default function Dokumente() {
  const [documents, setDocuments] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [quelle, setQuelle] = useState('')
  const [status, setStatus] = useState('')
  const [zeitraum, setZeitraum] = useState('')

  // Selection & Preview
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Expandable sections
  const [expandedSections, setExpandedSections] = useState({
    aussteller: true,
    empfaenger: false,
    finanzen: false,
    bezuege: false,
    ocr: false,
    meta: false,
  })
  const [ocrExpanded, setOcrExpanded] = useState(false)
  const [emailBodyExpanded, setEmailBodyExpanded] = useState(false)

  const debounceRef = useRef(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchTerm])

  // Reset list when filters change
  useEffect(() => {
    setDocuments([])
    setOffset(0)
    setHasMore(true)
    setSelectedId(null)
    setSelectedDoc(null)
    setPreviewUrl(null)
  }, [debouncedSearch, kategorie, quelle, status, zeitraum])

  // Fetch documents
  const fetchDocuments = useCallback(async (currentOffset, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)

    try {
      let query = supabase
        .from('documents')
        .select('id, kategorie, kategorie_manual, betreff, email_betreff, aussteller_firma, created_at, processing_status, source, dokument_url, email_von_email, email_von_name', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`
        query = query.or(`betreff.ilike.${s},email_betreff.ilike.${s},aussteller_firma.ilike.${s},inhalt_zusammenfassung.ilike.${s}`)
      }
      if (kategorie) query = query.or(`kategorie_manual.eq.${kategorie},and(kategorie_manual.is.null,kategorie.eq.${kategorie})`)
      if (quelle) query = query.eq('source', quelle)
      if (status) query = query.eq('processing_status', status)
      if (zeitraum) {
        const now = new Date()
        let from
        if (zeitraum === 'heute') from = startOfDay(now)
        else if (zeitraum === '7') from = startOfDay(subDays(now, 7))
        else if (zeitraum === '30') from = startOfDay(subDays(now, 30))
        if (from) query = query.gte('created_at', from.toISOString())
      }

      const { data, error, count } = await query
      if (error) throw error

      if (append) {
        setDocuments(prev => [...prev, ...data])
      } else {
        setDocuments(data || [])
      }
      setTotalCount(count || 0)
      setHasMore((data?.length || 0) === PAGE_SIZE)
    } catch (err) {
      console.error('Dokumente laden fehlgeschlagen:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, kategorie, quelle, status, zeitraum])

  useEffect(() => {
    fetchDocuments(0, false)
  }, [fetchDocuments])

  const loadMore = () => {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    fetchDocuments(newOffset, true)
  }

  // Fetch detail
  useEffect(() => {
    if (!selectedId) {
      setSelectedDoc(null)
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    const fetchDetail = async () => {
      setLoadingDetail(true)
      setPreviewUrl(null)
      setOcrExpanded(false)
      setEmailBodyExpanded(false)
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', selectedId)
          .single()
        if (error) throw error
        if (!cancelled) setSelectedDoc(data)

        // Only create signed URL for real storage paths (not email:// pseudo-URLs)
        if (data?.dokument_url && !data.dokument_url.startsWith('email://')) {
          setLoadingPreview(true)
          try {
            const { data: signedData, error: signErr } = await supabase.storage
              .from('documents')
              .createSignedUrl(data.dokument_url, 300, { download: false })
            if (!cancelled && !signErr) {
              setPreviewUrl(signedData.signedUrl)
            }
          } catch (e) {
            console.error('Preview URL fehlgeschlagen:', e)
          } finally {
            if (!cancelled) setLoadingPreview(false)
          }
        }
      } catch (err) {
        console.error('Detail laden fehlgeschlagen:', err)
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    fetchDetail()
    return () => { cancelled = true }
  }, [selectedId])

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|tiff|tif|webp)(\?|$)/i.test(url || '')
  const isPdfUrl = (url) => /\.pdf(\?|$)/i.test(url || '')

  const renderDetailField = (label, value) => {
    if (!value) return null
    return (
      <div key={label} className="flex justify-between py-1">
        <span className="text-gray-500 text-sm">{label}</span>
        <span className="text-gray-900 text-sm text-right max-w-[60%] break-words">{value}</span>
      </div>
    )
  }

  const Section = ({ title, sectionKey, children }) => {
    const open = expandedSections[sectionKey]
    return (
      <div className="border-b border-gray-100 last:border-0">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full py-3 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {title}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {open && <div className="pb-3">{children}</div>}
      </div>
    )
  }

  const zeitraumButtons = [
    { label: 'Heute', value: 'heute' },
    { label: '7 Tage', value: '7' },
    { label: '30 Tage', value: '30' },
    { label: 'Alle', value: '' },
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white">
      {/* Left Panel */}
      <div className="w-[60%] flex flex-col border-r border-gray-200">
        {/* Search */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Dokumente durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={kategorie}
              onChange={(e) => setKategorie(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Alle Kategorien</option>
              {DOKUMENT_KATEGORIEN.map(k => (
                <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <select
              value={quelle}
              onChange={(e) => setQuelle(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Alle Quellen</option>
              {DOKUMENT_QUELLEN.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              {PROCESSING_STATUS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Zeitraum */}
          <div className="flex gap-1.5">
            {zeitraumButtons.map(z => (
              <button
                key={z.value}
                onClick={() => setZeitraum(z.value)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  zeitraum === z.value
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {z.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400 self-center">
              {totalCount.toLocaleString('de-DE')} Dokumente
            </span>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FileText className="w-10 h-10 mb-2" />
              <p className="text-sm">Keine Dokumente gefunden</p>
            </div>
          ) : (
            <>
              {documents.map(doc => {
                const selected = doc.id === selectedId
                const effKategorie = doc.kategorie_manual || doc.kategorie
                const badge = getBadgeStyle(effKategorie)
                const title = doc.betreff || doc.email_betreff || 'Ohne Titel'
                const subtitle = doc.aussteller_firma || doc.email_von_name || doc.email_von_email || doc.source || ''
                const statusColor = STATUS_DOT[doc.processing_status] || '#9CA3AF'

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {effKategorie && (
                            <span
                              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                              style={{ backgroundColor: badge.bg, color: badge.text }}
                            >
                              {effKategorie.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusColor }}
                            title={doc.processing_status}
                          />
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {doc.created_at ? format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm', { locale: de }) : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
              {hasMore && (
                <div className="p-4 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Laden...
                      </span>
                    ) : 'Weitere laden'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="w-[40%] overflow-y-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Dokument auswaehlen</p>
            <p className="text-sm mt-1">Klicken Sie links auf ein Dokument</p>
          </div>
        ) : loadingDetail ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : selectedDoc ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {(selectedDoc.kategorie_manual || selectedDoc.kategorie) && (
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: getBadgeStyle(selectedDoc.kategorie_manual || selectedDoc.kategorie).bg,
                      color: getBadgeStyle(selectedDoc.kategorie_manual || selectedDoc.kategorie).text,
                    }}
                  >
                    {(selectedDoc.kategorie_manual || selectedDoc.kategorie).replace(/_/g, ' ')}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {selectedDoc.created_at
                    ? format(new Date(selectedDoc.created_at), 'dd.MM.yyyy HH:mm', { locale: de })
                    : ''}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedDoc.betreff || selectedDoc.email_betreff || 'Ohne Titel'}
              </h2>
              {selectedDoc.inhalt_zusammenfassung && (
                <p className="text-sm text-gray-600 mt-1">{selectedDoc.inhalt_zusammenfassung}</p>
              )}
            </div>

            {/* Email Meta */}
            {selectedDoc.source === 'email' && (selectedDoc.email_von_name || selectedDoc.email_von_email || selectedDoc.email_an_email) && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-1.5">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">E-Mail Details</span>
                </div>
                {(selectedDoc.email_von_name || selectedDoc.email_von_email) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Von</span>
                    <span className="text-gray-900 text-right">
                      {selectedDoc.email_von_name && <span className="font-medium">{selectedDoc.email_von_name}</span>}
                      {selectedDoc.email_von_name && selectedDoc.email_von_email && ' '}
                      {selectedDoc.email_von_email && <span className="text-gray-500">&lt;{selectedDoc.email_von_email}&gt;</span>}
                    </span>
                  </div>
                )}
                {selectedDoc.email_an_email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">An</span>
                    <span className="text-gray-900 text-right">{selectedDoc.email_an_email}</span>
                  </div>
                )}
                {selectedDoc.email_betreff && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Betreff</span>
                    <span className="text-gray-900 text-right max-w-[60%] break-words">{selectedDoc.email_betreff}</span>
                  </div>
                )}
                {selectedDoc.email_kategorie && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">E-Mail Kategorie</span>
                    <span className="text-gray-900">{selectedDoc.email_kategorie.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Email Body */}
            {selectedDoc.email_body_text && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">E-Mail Inhalt</span>
                </div>
                <div className="p-4">
                  <pre className={`text-sm text-gray-700 whitespace-pre-wrap font-sans ${!emailBodyExpanded ? 'max-h-[300px] overflow-y-auto' : ''}`}>
                    {emailBodyExpanded ? selectedDoc.email_body_text : selectedDoc.email_body_text.slice(0, 2000)}
                    {!emailBodyExpanded && selectedDoc.email_body_text.length > 2000 && '...'}
                  </pre>
                  {selectedDoc.email_body_text.length > 2000 && (
                    <button
                      onClick={() => setEmailBodyExpanded(!emailBodyExpanded)}
                      className="text-xs text-blue-600 hover:underline mt-2"
                    >
                      {emailBodyExpanded ? 'Weniger anzeigen' : 'Vollstaendig anzeigen'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Email Attachments */}
            {selectedDoc.email_anhaenge_meta && selectedDoc.email_anhaenge_meta.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Anhaenge ({selectedDoc.email_anhaenge_meta.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedDoc.email_anhaenge_meta.map((att, idx) => (
                    <button
                      key={att.id || idx}
                      onClick={async () => {
                        if (!att.storagePath) return
                        try {
                          const { data: signedData, error: signErr } = await supabase.storage
                            .from('documents')
                            .createSignedUrl(att.storagePath, 300)
                          if (!signErr && signedData?.signedUrl) {
                            window.open(signedData.signedUrl, '_blank')
                          }
                        } catch (e) {
                          console.error('Anhang-URL fehlgeschlagen:', e)
                        }
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{att.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {att.size ? (att.size < 1024 * 1024
                            ? `${Math.round(att.size / 1024)} KB`
                            : `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                          ) : ''}
                        </span>
                        <Download className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {selectedDoc.dokument_url && !selectedDoc.dokument_url.startsWith('email://') && (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {loadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : previewUrl ? (
                  <>
                    {isPdfUrl(selectedDoc.dokument_url) ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-[500px]"
                        title="Dokument-Vorschau"
                      />
                    ) : isImageUrl(selectedDoc.dokument_url) ? (
                      <img
                        src={previewUrl}
                        alt="Dokument-Vorschau"
                        className="w-full h-auto max-h-[500px] object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <Eye className="w-8 h-8 mb-2" />
                        <p className="text-sm">Vorschau nicht verfuegbar</p>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-1 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Herunterladen
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-40 text-gray-400">
                    <p className="text-sm">Vorschau konnte nicht geladen werden</p>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Details */}
            <div className="border border-gray-200 rounded-lg px-4">
              <Section title="Aussteller" sectionKey="aussteller">
                {renderDetailField('Firma', selectedDoc.aussteller_firma)}
                {renderDetailField('Name', selectedDoc.aussteller_name)}
                {renderDetailField('Strasse', selectedDoc.aussteller_strasse)}
                {renderDetailField('PLZ / Ort', [selectedDoc.aussteller_plz, selectedDoc.aussteller_ort].filter(Boolean).join(' '))}
                {renderDetailField('Telefon', selectedDoc.aussteller_telefon)}
                {renderDetailField('E-Mail', selectedDoc.aussteller_email)}
              </Section>

              <Section title="Empfaenger" sectionKey="empfaenger">
                {renderDetailField('Firma', selectedDoc.empfaenger_firma)}
                {renderDetailField('Name', selectedDoc.empfaenger_name)}
                {renderDetailField('Strasse', selectedDoc.empfaenger_strasse)}
                {renderDetailField('PLZ / Ort', [selectedDoc.empfaenger_plz, selectedDoc.empfaenger_ort].filter(Boolean).join(' '))}
              </Section>

              <Section title="Finanzen" sectionKey="finanzen">
                {renderDetailField('Netto', selectedDoc.summe_netto ? `${Number(selectedDoc.summe_netto).toFixed(2)} EUR` : null)}
                {renderDetailField('Brutto', selectedDoc.summe_brutto ? `${Number(selectedDoc.summe_brutto).toFixed(2)} EUR` : null)}
                {renderDetailField('MwSt', selectedDoc.mwst_betrag ? `${Number(selectedDoc.mwst_betrag).toFixed(2)} EUR` : null)}
              </Section>

              <Section title="Bezuege" sectionKey="bezuege">
                {renderDetailField('Rechnungsnummer', selectedDoc.bezug_rechnungsnummer)}
                {renderDetailField('Bestellnummer', selectedDoc.bezug_bestellnummer)}
                {renderDetailField('Kundennummer', selectedDoc.bezug_kundennummer)}
                {renderDetailField('Lieferscheinnummer', selectedDoc.bezug_lieferscheinnummer)}
                {renderDetailField('Auftragsnummer', selectedDoc.bezug_auftragsnummer)}
                {renderDetailField('Vertragsnummer', selectedDoc.bezug_vertragsnummer)}
                {renderDetailField('Projektnummer', selectedDoc.bezug_projektnummer)}
                {renderDetailField('Kommissionsnummer', selectedDoc.bezug_kommissionsnummer)}
              </Section>
            </div>

            {/* OCR Text */}
            {selectedDoc.ocr_text && (
              <div className="border border-gray-200 rounded-lg px-4">
                <Section title="OCR-Text" sectionKey="ocr">
                  <div className={`text-xs text-gray-700 font-mono whitespace-pre-wrap ${!ocrExpanded ? 'max-h-60 overflow-y-auto' : ''}`}>
                    {ocrExpanded ? selectedDoc.ocr_text : selectedDoc.ocr_text.slice(0, 500)}
                    {!ocrExpanded && selectedDoc.ocr_text.length > 500 && '...'}
                  </div>
                  {selectedDoc.ocr_text.length > 500 && (
                    <button
                      onClick={() => setOcrExpanded(!ocrExpanded)}
                      className="text-xs text-blue-600 hover:underline mt-2"
                    >
                      {ocrExpanded ? 'Weniger anzeigen' : 'Vollstaendig anzeigen'}
                    </button>
                  )}
                </Section>
              </div>
            )}

            {/* Meta */}
            <div className="border border-gray-200 rounded-lg px-4">
              <Section title="Meta-Informationen" sectionKey="meta">
                {renderDetailField('Quelle', selectedDoc.source)}
                {renderDetailField('Status', selectedDoc.processing_status)}
                {renderDetailField('Review', selectedDoc.review_status)}
                {renderDetailField('File Hash', selectedDoc.file_hash ? selectedDoc.file_hash.slice(0, 16) + '...' : null)}
                {renderDetailField('ID', selectedDoc.id)}
              </Section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
