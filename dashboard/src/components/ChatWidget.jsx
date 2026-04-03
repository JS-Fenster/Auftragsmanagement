import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, Send, X, Minimize2, Loader2, Trash2, StopCircle, User, FolderKanban, FileText, Mail, Receipt, Mic, MicOff, Image } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { useChatContext } from '../lib/chatContext'
import { getEntityRoute } from '../lib/entityRoutes'
import ActionConfirmDialog from './ActionConfirmDialog'
import ReportViewer from './ReportViewer' // LLM-012

const LLM_CHAT_URL = `${supabaseUrl}/functions/v1/llm-chat`
const ASSISTANT_NAME = 'Jess'
const ASSISTANT_AVATAR = '/jess-avatar.png'
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

const QUICK_ACTIONS = [
  { label: 'Heutige Termine', prompt: 'Was sind meine heutigen Termine?' },
  { label: 'Offene Aufträge', prompt: 'Zeige mir offene Aufträge' },
  { label: 'Überfällige Rechnungen', prompt: 'Gibt es überfällige Rechnungen?' },
  { label: 'Neuer Termin', prompt: 'Ich möchte einen neuen Termin anlegen' },
]

// Deep-link icon map for entity chips
const DEEP_LINK_ICONS = {
  kontakt: User,
  projekt: FolderKanban,
  document: FileText,
  email: Mail,
  beleg: Receipt,
}

export default function ChatWidget({ embedded = false, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(embedded)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // LLM-011
  const [activeReport, setActiveReport] = useState(null) // LLM-012
  const [isListening, setIsListening] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const { context: chatContext } = useChatContext()
  const abortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mobile keyboard: lock the chat to the visual viewport using top+height
  // This prevents the keyboard from pushing content up
  const [vpStyle, setVpStyle] = useState({})
  useEffect(() => {
    if (!embedded) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setVpStyle({
        position: 'fixed',
        top: vv.offsetTop + 'px',
        left: 0,
        width: '100%',
        height: vv.height + 'px',
      })
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [embedded])

  // Lock body scroll when embedded (mobile fullscreen)
  useEffect(() => {
    if (!embedded || !isOpen) return
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [embedded, isOpen])

  // Speech Recognition init
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'de-DE'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('')
      setInput(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
  }, [])

  // Greeting when chat opens with no messages
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Morgen' : hour < 17 ? 'Tag' : 'Abend'
      setMessages([{
        role: 'assistant',
        content: `Guten ${greeting}! Ich bin Jess, deine Assistentin. Wie kann ich dir helfen?`
      }])
    }
  }, [isOpen])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // Staged image: uploaded but not sent yet — user adds text then presses send
  const [stagedImage, setStagedImage] = useState(null) // { url, filename }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)

    try {
      const filename = `jess-feedback/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabaseClient
        .storage.from('documents').upload(filename, file, { contentType: file.type })

      if (uploadError) { console.error(uploadError); setUploadingImage(false); return }

      const { data: urlData } = supabaseClient.storage.from('documents').getPublicUrl(filename)
      setStagedImage({ url: urlData?.publicUrl, filename: file.name })
      setUploadingImage(false)
      if (inputRef.current) inputRef.current.focus()
    } catch (err) {
      console.error('Image upload failed:', err)
      setUploadingImage(false)
    }
  }

  const cancelRequest = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }

  const callLLM = async (text, confirmAction = null, imageUrl = null) => {
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const body = { message: text, history, context: chatContext, page_context: location.pathname }
    if (confirmAction) body.confirm_action = confirmAction
    if (imageUrl) body.image_url = imageUrl

    const controller = new AbortController()
    abortRef.current = controller

    const resp = await fetch(LLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    return await resp.json()
  }

  const sendMessage = async (overrideText = null, imageUrl = null) => {
    const text = overrideText || input.trim()
    if (!text || loading) return

    // Use staged image if no explicit imageUrl
    const imgUrl = imageUrl || stagedImage?.url || null
    const imgName = stagedImage?.filename

    if (!overrideText) {
      const userMsg = { role: 'user', content: text, imageUrl: imgUrl }
      setMessages(prev => [...prev, userMsg])
      setInput('')
      setStagedImage(null)
      if (inputRef.current) inputRef.current.style.height = 'auto'
    }
    setLoading(true)

    const msgToSend = imgUrl ? `${text}\n[Bild: ${imgName || 'Anhang'}]` : text

    try {
      const data = await callLLM(msgToSend, null, imgUrl)

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${data.error}`, isError: true }])
      } else if (data.pending_actions && data.pending_actions.length > 0) {
        // LLM-011: Action requires confirmation — enrich args with context display name
        const action = data.pending_actions[0]
        const enrichedArgs = { ...action.args }
        if (chatContext?.entity_name && (enrichedArgs.projekt_id || enrichedArgs.kontakt_id || enrichedArgs.document_id)) {
          enrichedArgs._display_name = chatContext.entity_name
        }
        setPendingAction({
          originalMessage: text,
          toolCallId: action.tool_call_id,
          name: action.name,
          args: enrichedArgs,
          description: formatActionDescription(action.name, enrichedArgs),
          details: formatActionDetails(action.name, enrichedArgs),
          readToolCalls: data.tool_calls,
        })
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          toolCalls: data.tool_calls,
          report: data.report || null, // LLM-012
        }])
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Anfrage abgebrochen.',
          isError: true,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Verbindungsfehler: ${err.message}`,
          isError: true,
        }])
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  // LLM-011: Handle action confirmation
  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setLoading(true)

    try {
      const data = await callLLM(pendingAction.originalMessage, {
        tool_call_id: pendingAction.toolCallId,
        confirmed: true,
      })

      setPendingAction(null)

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${data.error}`, isError: true }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer || 'Aktion ausgeführt.',
          toolCalls: data.tool_calls,
        }])
        // Refresh current page data after successful action
        window.dispatchEvent(new CustomEvent('jess-action-completed'))
      }
    } catch (err) {
      setPendingAction(null)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Fehler bei Ausfuehrung: ${err.message}`,
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAction = () => {
    setPendingAction(null)
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Aktion abgebrochen.',
      isError: true,
    }])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  // Floating Button (only in non-embedded mode)
  if (!isOpen && !embedded) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-md flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg border-2 border-brand bg-[#C4C7C7] dark:bg-[#9E9E9E]"
        title={`${ASSISTANT_NAME} öffnen`}
      >
        <img src={ASSISTANT_AVATAR} alt={ASSISTANT_NAME} className="w-12 h-12 rounded-full object-cover" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 text-btn-primary-text text-xs rounded-full flex items-center justify-center bg-brand">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>
    )
  }

  if (!isOpen) return null

  // Chat Panel
  return (
    <div
      className={embedded
        ? "flex flex-col bg-surface-card overflow-hidden z-50 touch-none"
        : "fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-surface-card rounded-xl shadow-2xl border border-border-default flex flex-col overflow-hidden"
      }
      style={embedded ? vpStyle : undefined}
      onTouchMove={embedded ? (e) => {
        // Only allow scroll inside the messages area, block everywhere else
        if (!e.target.closest('[data-messages]')) e.preventDefault()
      } : undefined}
    >
      {/* Header — fixed height, never scrolls */}
      <div className="flex items-center justify-between px-4 py-3 border-b-3 border-b-brand shrink-0" style={{ backgroundColor: '#9E9E9E' }}>
        <div className="flex items-center gap-2.5">
          <img src={ASSISTANT_AVATAR} alt={ASSISTANT_NAME} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <span className="font-semibold text-sm text-white drop-shadow-sm">{ASSISTANT_NAME}</span>
            <span className="text-xs ml-1.5 font-medium text-brand">Beta</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearChat} className="p-1.5 text-white/70 hover:text-white hover:bg-gray-600 rounded transition-colors" title="Chat leeren">
              <Trash2 size={14} />
            </button>
          )}
          {!embedded && (
            <button onClick={() => setIsOpen(false)} className="p-1.5 text-white/70 hover:text-white hover:bg-gray-600 rounded transition-colors" title="Minimieren">
              <Minimize2 size={14} />
            </button>
          )}
          <button onClick={() => { if (embedded && onClose) onClose(); else { setIsOpen(false); setMessages([]) } }} className="p-1.5 text-white/70 hover:text-white hover:bg-gray-600 rounded transition-colors" title="Schließen">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div data-messages="true" className="flex-1 overflow-y-auto px-4 py-3 space-y-3 touch-auto overscroll-contain">
        {messages.length <= 1 && (
          <div className="text-center text-text-muted text-sm mt-8">
            <img src={ASSISTANT_AVATAR} alt={ASSISTANT_NAME} className="w-16 h-16 rounded-full mx-auto mb-3" />
            <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
              {QUICK_ACTIONS.map((qa, i) => (
                <button key={i} onClick={() => { setInput(qa.prompt); sendMessage(qa.prompt) }}
                  className="px-3 py-1.5 text-xs rounded-full border border-brand/30 text-brand hover:bg-brand/10 transition-colors">
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-btn-primary text-white'
                  : msg.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-surface-hover text-text-primary'
              }`}
            >
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Hochgeladen" className="max-w-full rounded mb-1 max-h-40 object-contain" />
              )}
              {msg.role === 'assistant' ? (
                <FormattedMessage content={msg.content} navigate={navigate} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-default">
                  <span className="text-xs text-text-muted">
                    {msg.toolCalls.map(tc => tc.name).join(', ')} abgefragt
                  </span>
                </div>
              )}
              {msg.report && (
                <div className="mt-2 pt-2 border-t border-border-default">
                  <button
                    onClick={() => setActiveReport(msg.report)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors bg-brand text-btn-primary-text hover:bg-brand-hover"
                  >
                    Report anzeigen
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-hover rounded-lg px-3 py-2 text-sm text-text-secondary flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Suche und analysiere...
              <button
                onClick={cancelRequest}
                className="ml-2 text-red-400 hover:text-red-600 transition-colors"
                title="Anfrage abbrechen"
              >
                <StopCircle size={16} />
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* LLM-012: Report Viewer */}
      {activeReport && (
        <ReportViewer report={activeReport} onClose={() => setActiveReport(null)} />
      )}

      {/* LLM-011: Action Confirmation Dialog */}
      {pendingAction && (
        <ActionConfirmDialog
          action={pendingAction}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}

      {/* Staged image preview */}
      {stagedImage && (
        <div className="px-3 py-2 border-t border-border-default bg-surface-main shrink-0 flex items-center gap-2">
          <img src={stagedImage.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border-default" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{stagedImage.filename}</p>
            <p className="text-[10px] text-text-muted">Text eingeben und Senden drücken</p>
          </div>
          <button onClick={() => setStagedImage(null)} className="p-1 text-text-muted hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input — fixed at bottom, never scrolls */}
      <div className="border-t border-border-default px-3 py-2 shrink-0 bg-surface-card">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              // Auto-resize: reset then grow to scrollHeight, cap at max
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Frage eingeben..."
            rows={1}
            className="flex-1 resize-none border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand overflow-y-auto"
            style={{ maxHeight: '160px' }}
            disabled={loading}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2 rounded-lg text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
            title="Bild hochladen"
          >
            <Image size={18} />
          </button>
          <button
            onClick={toggleListening}
            className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-text-muted hover:text-text-secondary'}`}
            title={isListening ? 'Aufnahme stoppen' : 'Spracheingabe'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2 text-btn-primary-text rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-brand hover:bg-brand-hover"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// LLM-011: Format action descriptions for confirmation dialog
function formatActionDescription(name, args) {
  switch (name) {
    case 'update_document_kategorie':
      return `Kategorie ändern auf "${(args.neue_kategorie || '').replace(/_/g, ' ')}"`
    case 'add_project_note':
      return `Notiz zum Projekt hinzufügen`
    case 'update_project_status':
      return `Projekt-Status ändern auf "${(args.neuer_status || '').replace(/_/g, ' ')}"`
    case 'update_contact_data':
      return `Kontaktdaten aktualisieren: ${(args.field || '').replace(/_/g, ' ')}`
    case 'assign_document_to_project':
      return `Dokument einem Projekt zuordnen`
    default:
      return `Aktion: ${name}`
  }
}

function formatActionDetails(name, args) {
  switch (name) {
    case 'update_document_kategorie':
      return [
        { label: 'Dokument-ID', value: (args.document_id || '').substring(0, 8) + '...' },
        { label: 'Neue Kategorie', value: (args.neue_kategorie || '').replace(/_/g, ' ') },
        { label: 'Grund', value: args.grund || '—' },
      ]
    case 'add_project_note':
      return [
        { label: 'Projekt', value: args._display_name || (args.projekt_id || '').substring(0, 8) + '...' },
        { label: 'Typ', value: args.typ || 'notiz' },
        { label: 'Text', value: args.text || '—' },
      ]
    case 'update_project_status':
      return [
        { label: 'Projekt', value: args._display_name || (args.projekt_id || '').substring(0, 8) + '...' },
        { label: 'Neuer Status', value: (args.neuer_status || '').replace(/_/g, ' ') },
        ...(args.kommentar ? [{ label: 'Kommentar', value: args.kommentar }] : []),
      ]
    case 'update_contact_data':
      return [
        { label: 'Kontakt', value: args._display_name || (args.kontakt_id || '').substring(0, 8) + '...' },
        { label: 'Feld', value: (args.field || '').replace(/_/g, ' ') },
        { label: 'Neuer Wert', value: args.value || '—' },
      ]
    case 'assign_document_to_project':
      return [
        { label: 'Dokument-ID', value: (args.document_id || '').substring(0, 8) + '...' },
        { label: 'Projekt-ID', value: (args.projekt_id || '').substring(0, 8) + '...' },
      ]
    default:
      return Object.entries(args || {}).map(([k, v]) => ({
        label: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
      }))
  }
}

// Inline formatting: bold, inline code
function formatInlineText(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${j}`}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${keyPrefix}-${j}`} className="bg-surface-hover text-text-primary px-1 rounded text-xs">{part.slice(1, -1)}</code>
    }
    return part
  })
}

// Inline formatting with deep-link support: [[link:type:uuid:Name]]
function formatInline(text, keyPrefix = '', navigate) {
  const deepLinkParts = []
  let lastIndex = 0
  const regex = /\[\[link:(kontakt|projekt|document|email|beleg):([a-f0-9-]+):(.+?)\]\]/g
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      deepLinkParts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    deepLinkParts.push({
      type: 'link',
      entityType: match[1],
      entityId: match[2],
      displayName: match[3],
    })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    deepLinkParts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  // No deep links found — fall through to original logic
  if (deepLinkParts.length === 1 && deepLinkParts[0].type === 'text') {
    return formatInlineText(text, keyPrefix)
  }

  return deepLinkParts.map((part, i) => {
    if (part.type === 'link') {
      const Icon = DEEP_LINK_ICONS[part.entityType]
      const route = getEntityRoute(part.entityType, part.entityId)
      return (
        <button
          key={`${keyPrefix}dl${i}`}
          onClick={() => route && navigate(route)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 text-xs font-medium cursor-pointer transition-colors"
          title={`${part.displayName} öffnen`}
        >
          {Icon && <Icon size={12} />}
          {part.displayName}
        </button>
      )
    }
    return formatInlineText(part.value, `${keyPrefix}t${i}`)
  })
}

// Simple markdown-like formatting for assistant messages
function FormattedMessage({ content, navigate }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let inTable = false
  let tableRows = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Table detection
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true
        tableRows = []
      }
      if (!/^\|[\s-:|]+\|$/.test(line)) {
        tableRows.push(line.split('|').filter(Boolean).map(c => c.trim()))
      }
      continue
    }

    // End of table
    if (inTable) {
      elements.push(<SimpleTable key={`table-${i}`} rows={tableRows} navigate={navigate} />)
      inTable = false
      tableRows = []
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-semibold text-text-primary mt-1.5">{formatInline(line.slice(4), i, navigate)}</p>)
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-semibold text-text-primary mt-2">{formatInline(line.slice(3), i, navigate)}</p>)
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="font-bold text-text-primary mt-2">{formatInline(line.slice(2), i, navigate)}</p>)
    }
    // Numbered lists
    else if (/^\d+[\.\)] /.test(line)) {
      const match = line.match(/^(\d+[\.\)] )(.*)/)
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-text-muted flex-shrink-0">{match[1]}</span>
          <span>{formatInline(match[2], i, navigate)}</span>
        </div>
      )
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-text-muted">•</span>
          <span>{formatInline(line.slice(2), i, navigate)}</span>
        </div>
      )
    }
    // Indented bullet lists
    else if (line.match(/^\s{2,}[-•] /)) {
      const text = line.replace(/^\s+[-•] /, '')
      elements.push(
        <div key={i} className="flex gap-1.5 ml-4">
          <span className="text-text-muted">◦</span>
          <span>{formatInline(text, i, navigate)}</span>
        </div>
      )
    }
    // Empty line
    else if (line === '') {
      elements.push(<div key={i} className="h-1" />)
    }
    // Regular text with inline formatting
    else {
      elements.push(<p key={i} className="whitespace-pre-wrap">{formatInline(line, i, navigate)}</p>)
    }
  }

  // Flush remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(<SimpleTable key="table-end" rows={tableRows} navigate={navigate} />)
  }

  return <div className="space-y-0.5">{elements}</div>
}

function SimpleTable({ rows, navigate }) {
  if (rows.length === 0) return null
  const [header, ...body] = rows

  return (
    <div className="overflow-x-auto my-1">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border border-border-default bg-surface-main px-2 py-1 text-left font-medium">
                {formatInline(cell, `th${i}`, navigate)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-border-default px-2 py-1 whitespace-nowrap">
                  {formatInline(cell, `r${i}c${j}`, navigate)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
