import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Minimize2, Loader2, Trash2, StopCircle } from 'lucide-react'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import ActionConfirmDialog from './ActionConfirmDialog'

const LLM_CHAT_URL = `${supabaseUrl}/functions/v1/llm-chat`
const ASSISTANT_NAME = 'Jess'
const ASSISTANT_AVATAR = '/jess-avatar.png'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // LLM-011
  const abortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cancelRequest = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }

  const callLLM = async (text, confirmAction = null) => {
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const body = { message: text, history }
    if (confirmAction) body.confirm_action = confirmAction

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

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await callLLM(text)

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${data.error}`, isError: true }])
      } else if (data.pending_actions && data.pending_actions.length > 0) {
        // LLM-011: Action requires confirmation
        const action = data.pending_actions[0]
        setPendingAction({
          originalMessage: text,
          toolCallId: action.tool_call_id,
          name: action.name,
          args: action.args,
          description: formatActionDescription(action.name, action.args),
          details: formatActionDetails(action.name, action.args),
          readToolCalls: data.tool_calls,
        })
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          toolCalls: data.tool_calls,
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
          content: data.answer || 'Aktion ausgefuehrt.',
          toolCalls: data.tool_calls,
        }])
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

  // Floating Button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-md flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg border-2 border-brand bg-surface-card"
        title={`${ASSISTANT_NAME} oeffnen`}
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

  // Chat Panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-surface-card rounded-xl shadow-2xl border border-border-default flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-3 border-b-brand" style={{ backgroundColor: '#9E9E9E' }}>
        <div className="flex items-center gap-2.5">
          <img src={ASSISTANT_AVATAR} alt={ASSISTANT_NAME} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <span className="font-semibold text-sm text-white drop-shadow-sm">{ASSISTANT_NAME}</span>
            <span className="text-xs ml-1.5 font-medium text-brand">Beta</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearChat} className="p-1.5 text-text-muted hover:text-white hover:bg-gray-600 rounded transition-colors" title="Chat leeren">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-text-muted hover:text-white hover:bg-gray-600 rounded transition-colors" title="Minimieren">
            <Minimize2 size={14} />
          </button>
          <button onClick={() => { setIsOpen(false); setMessages([]) }} className="p-1.5 text-text-muted hover:text-white hover:bg-gray-600 rounded transition-colors" title="Schliessen">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-text-muted text-sm mt-8">
            <img src={ASSISTANT_AVATAR} alt={ASSISTANT_NAME} className="w-16 h-16 rounded-full mx-auto mb-3" />
            <p className="font-medium text-text-secondary">Hallo! Ich bin {ASSISTANT_NAME}. Wie kann ich helfen?</p>
            <p className="mt-2 text-xs">Beispiele:</p>
            <div className="mt-2 space-y-1">
              {[
                'Kontaktdaten von Mueller',
                'Offene Projekte mit hoher Prioritaet',
                'Rechnungen von letzter Woche',
              ].map(example => (
                <button
                  key={example}
                  onClick={() => { setInput(example); inputRef.current?.focus() }}
                  className="block mx-auto text-xs hover:underline text-text-primary"
                >
                  &quot;{example}&quot;
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
              {msg.role === 'assistant' ? (
                <FormattedMessage content={msg.content} />
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

      {/* LLM-011: Action Confirmation Dialog */}
      {pendingAction && (
        <ActionConfirmDialog
          action={pendingAction}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}

      {/* Input */}
      <div className="border-t border-border-default px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage eingeben..."
            rows={1}
            className="flex-1 resize-none border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand max-h-20"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
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
      return `Kategorie aendern auf "${(args.neue_kategorie || '').replace(/_/g, ' ')}"`
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
    default:
      return Object.entries(args || {}).map(([k, v]) => ({
        label: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
      }))
  }
}

// Inline formatting: bold, inline code
function formatInline(text, keyPrefix = '') {
  // Split by **bold** and `code` patterns
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

// Simple markdown-like formatting for assistant messages
function FormattedMessage({ content }) {
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
      elements.push(<SimpleTable key={`table-${i}`} rows={tableRows} />)
      inTable = false
      tableRows = []
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-semibold text-text-primary mt-1.5">{formatInline(line.slice(4), i)}</p>)
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-semibold text-text-primary mt-2">{formatInline(line.slice(3), i)}</p>)
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="font-bold text-text-primary mt-2">{formatInline(line.slice(2), i)}</p>)
    }
    // Numbered lists
    else if (/^\d+[\.\)] /.test(line)) {
      const match = line.match(/^(\d+[\.\)] )(.*)/)
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-text-muted flex-shrink-0">{match[1]}</span>
          <span>{formatInline(match[2], i)}</span>
        </div>
      )
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-text-muted">•</span>
          <span>{formatInline(line.slice(2), i)}</span>
        </div>
      )
    }
    // Indented bullet lists
    else if (line.match(/^\s{2,}[-•] /)) {
      const text = line.replace(/^\s+[-•] /, '')
      elements.push(
        <div key={i} className="flex gap-1.5 ml-4">
          <span className="text-text-muted">◦</span>
          <span>{formatInline(text, i)}</span>
        </div>
      )
    }
    // Empty line
    else if (line === '') {
      elements.push(<div key={i} className="h-1" />)
    }
    // Regular text with inline formatting
    else {
      elements.push(<p key={i} className="whitespace-pre-wrap">{formatInline(line, i)}</p>)
    }
  }

  // Flush remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(<SimpleTable key="table-end" rows={tableRows} />)
  }

  return <div className="space-y-0.5">{elements}</div>
}

function SimpleTable({ rows }) {
  if (rows.length === 0) return null
  const [header, ...body] = rows

  return (
    <div className="overflow-x-auto my-1">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border border-border-default bg-surface-main px-2 py-1 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-border-default px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
