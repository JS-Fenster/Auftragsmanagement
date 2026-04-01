/**
 * ProjektEmails — Customer emails list with expand/collapse (AM-094)
 */
import { useState } from 'react'
import { Mail, Paperclip, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRelativeTime } from './projektConstants'

export default function ProjektEmails({ projektEmails }) {
  const [expanded, setExpanded] = useState(false)

  if (projektEmails.length === 0) return null

  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Mail className="h-4 w-4 text-text-muted" /> Emails zum Kunden
          <span className="text-xs font-normal text-text-muted bg-surface-hover px-1.5 py-0.5 rounded-full">{projektEmails.length}</span>
        </h2>
        <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-secondary">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      <div className="p-5">
        <div className="space-y-2">
          {(expanded ? projektEmails : projektEmails.slice(0, 3)).map(email => (
            <div key={email.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-main group">
              <Mail className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">{email.email_betreff || '(Kein Betreff)'}</p>
                  {email.email_hat_anhaenge && <Paperclip className="h-3 w-3 text-text-muted flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-muted">{email.email_von_name || email.email_von_email}</span>
                  <span className="text-xs text-text-muted">&middot;</span>
                  <span className="text-xs text-text-muted">{formatRelativeTime(email.email_empfangen_am)}</span>
                  {email.email_kategorie && (
                    <>
                      <span className="text-xs text-text-muted">&middot;</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">{email.email_kategorie.replace(/_/g, ' ')}</span>
                    </>
                  )}
                </div>
                {expanded && email.email_body_text && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{email.email_body_text.slice(0, 200)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {projektEmails.length > 3 && !expanded && (
          <button onClick={() => setExpanded(true)}
            className="mt-2 text-xs text-brand hover:text-brand-hover cursor-pointer">
            + {projektEmails.length - 3} weitere Emails anzeigen
          </button>
        )}
      </div>
    </div>
  )
}
