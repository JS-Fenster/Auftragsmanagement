/**
 * ProjektNotizen — Notes display and add-new-note form
 */
import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'

export default function ProjektNotizen({ projekt, onAddNotiz }) {
  const [newNotiz, setNewNotiz] = useState('')

  const handleAdd = async () => {
    if (!newNotiz.trim()) return
    await onAddNotiz(newNotiz.trim())
    setNewNotiz('')
  }

  return (
    <div className="bg-surface-card rounded-lg shadow-sm border border-border-default">
      <div className="px-5 py-3 border-b border-border-default">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-muted" /> Notizen
        </h2>
      </div>
      <div className="p-5 space-y-4">
        {projekt.notizen && (
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans bg-surface-main rounded-lg p-4">{projekt.notizen}</pre>
        )}
        <div className="flex gap-2">
          <textarea
            value={newNotiz}
            onChange={e => setNewNotiz(e.target.value)}
            placeholder="Neue Notiz..."
            rows={2}
            className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newNotiz.trim()}
            className="self-end px-3 py-2 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Hinzufuegen
          </button>
        </div>
      </div>
    </div>
  )
}
