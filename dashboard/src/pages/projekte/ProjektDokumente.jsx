/**
 * ProjektDokumente — Document upload, linking, and list with drag & drop
 */
import { useState, useRef } from 'react'
import { Link2, Plus, Upload, Download, FileText, Unlink, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PROJEKT_DOKUMENT_TYPEN } from '../../lib/constants'
import { PROJEKT_PHASEN } from '../../components/StatusBadge'

export default function ProjektDokumente({ projektId, dokumente, blockedGates, onReload }) {
  const [showLinkDokument, setShowLinkDokument] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const [linkDocSearch, setLinkDocSearch] = useState('')
  const [linkDocResults, setLinkDocResults] = useState([])
  const [linkDocTyp, setLinkDocTyp] = useState('sonstiges')

  const searchDocuments = async (term) => {
    if (term.length < 2) { setLinkDocResults([]); return }
    const { data } = await supabase
      .from('documents')
      .select('id, betreff, dokument_url, kategorie, created_at')
      .or(`betreff.ilike.%${term}%,dokument_url.ilike.%${term}%`)
      .limit(10)
    setLinkDocResults(data || [])
  }

  const handleFileUpload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress(`${i + 1}/${files.length}: ${file.name}`)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `projekte/${projektId}/${Date.now()}_${safeName}`
      const arrayBuf = await file.arrayBuffer()
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuf)
      const fileHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
      if (uploadError) { console.error('Upload failed:', uploadError.message); continue }
      const { data: doc } = await supabase.from('documents').insert({
        dokument_url: filePath,
        source: 'upload',
        kategorie: 'Sonstiges_Dokument',
        betreff: file.name,
        file_hash: fileHash,
      }).select('id').single()
      if (doc) {
        await supabase.from('projekt_dokumente').insert({
          projekt_id: projektId,
          document_id: doc.id,
          dokument_typ: 'sonstiges',
        })
      }
    }
    setUploading(false)
    setUploadProgress('')
    onReload()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounterRef.current++
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragOver(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleLinkDokument = async (documentId) => {
    const { error } = await supabase
      .from('projekt_dokumente')
      .insert({ projekt_id: projektId, document_id: documentId, dokument_typ: linkDocTyp })
    if (error) { console.error(error); return }
    setShowLinkDokument(false)
    setLinkDocSearch('')
    setLinkDocResults([])
    setLinkDocTyp('sonstiges')
    onReload()
  }

  const handleUnlinkDokument = async (projektDokumentId) => {
    const { error } = await supabase
      .from('projekt_dokumente')
      .delete()
      .eq('id', projektDokumentId)
    if (error) { console.error(error); return }
    onReload()
  }

  return (
    <div id="sektion-dokumente" className="bg-surface-card rounded-lg shadow-sm border border-border-default transition-all">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Link2 className="h-4 w-4 text-text-muted" /> Dokumente
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-brand hover:text-brand-dark flex items-center gap-1 cursor-pointer">
            <Upload className="h-4 w-4" /> Upload
            <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
          </label>
          <button onClick={() => setShowLinkDokument(true)} className="text-sm text-brand hover:text-brand-dark flex items-center gap-1">
            <Plus className="h-4 w-4" /> Verknuepfen
          </button>
        </div>
      </div>
      <div className="p-5"
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="mb-4 p-6 border-2 border-dashed border-brand rounded-lg bg-brand-light text-center">
            <Upload className="h-8 w-8 text-brand mx-auto mb-2" />
            <p className="text-sm text-brand font-medium">Dateien hier ablegen</p>
          </div>
        )}
        {uploading && (
          <div className="mb-4 p-3 bg-surface-hover rounded-lg flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">{uploadProgress}</span>
          </div>
        )}
        {Object.keys(blockedGates).length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Fehlende Pflicht-Dokumente
            </p>
            {Object.entries(blockedGates).map(([status, docs]) => (
              <div key={status} className="text-xs text-amber-700">
                <span className="font-medium">{PROJEKT_PHASEN[status]?.label || status}:</span>{' '}
                {docs.map(d => PROJEKT_DOKUMENT_TYPEN[d]?.label || d).join(', ')}
              </div>
            ))}
          </div>
        )}

        {showLinkDokument && (
          <div className="mb-4 p-4 bg-brand-light rounded-lg border border-blue-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary">Dokument suchen</label>
                <input
                  type="text" value={linkDocSearch}
                  onChange={e => { setLinkDocSearch(e.target.value); searchDocuments(e.target.value) }}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Dateiname eingeben..."
                />
                {linkDocResults.length > 0 && (
                  <ul className="mt-1 bg-surface-card border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {linkDocResults.map(doc => (
                      <li key={doc.id} onClick={() => handleLinkDokument(doc.id)}
                        className="px-3 py-2 text-sm hover:bg-brand-light cursor-pointer flex justify-between">
                        <span className="truncate">{doc.betreff || doc.dokument_url?.split('/').pop() || 'Dokument'}</span>
                        <span className="text-xs text-text-muted ml-2">{doc.kategorie}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Dokument-Typ</label>
                <select value={linkDocTyp} onChange={e => setLinkDocTyp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default px-3 py-1.5 text-sm bg-surface-card">
                  {Object.entries(PROJEKT_DOKUMENT_TYPEN).map(([key, typ]) => (
                    <option key={key} value={key}>{typ.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { setShowLinkDokument(false); setLinkDocSearch(''); setLinkDocResults([]) }}
                className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {dokumente.length === 0 && !showLinkDokument ? (
          <p className="text-sm text-text-muted">Keine Dokumente verknuepft.</p>
        ) : dokumente.length > 0 && (
          <div className="space-y-2">
            {dokumente.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-main group">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{d.documents?.betreff || d.documents?.dokument_url?.split('/').pop() || 'Unbekannt'}</p>
                    <p className="text-xs text-text-muted">
                      {PROJEKT_DOKUMENT_TYPEN[d.dokument_typ]?.label || d.dokument_typ}
                      {d.ist_pflicht && <span className="ml-1 text-amber-600 font-medium">Pflicht</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.documents?.dokument_url && (
                    <button onClick={async () => {
                      const { data } = await supabase.storage.from('documents').createSignedUrl(d.documents.dokument_url, 60)
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                    }} className="p-1 text-text-muted hover:text-brand" title="Herunterladen">
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleUnlinkDokument(d.id)}
                    className="p-1 text-text-muted hover:text-red-500"
                    title="Verknüpfung entfernen">
                    <Unlink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
