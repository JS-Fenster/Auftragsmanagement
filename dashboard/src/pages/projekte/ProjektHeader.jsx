/**
 * ProjektHeader — Header with project number, status, tags, edit/delete buttons
 */
import { ArrowLeft, Save, Edit2, Trash2, ExternalLink, Tag } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import { PrioritaetBadge } from '../../components/StatusBadge'
import { PROJEKT_TYPEN } from '../../lib/constants'

export default function ProjektHeader({ projekt, editing, onStartEditing, onSave, onCancelEditing, onDelete, onNavigateBack }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onNavigateBack} className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{projekt.projekt_nummer}</h1>
          {projekt.titel && <p className="text-sm text-text-secondary mt-0.5">{projekt.titel}</p>}
        </div>
        <StatusBadge status={projekt.status} size="md" />
        {projekt.typ && projekt.typ !== 'auftrag' && PROJEKT_TYPEN[projekt.typ] && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: PROJEKT_TYPEN[projekt.typ].bg, color: PROJEKT_TYPEN[projekt.typ].color }}
          >
            {PROJEKT_TYPEN[projekt.typ].label}
          </span>
        )}
        {projekt.prioritaet && projekt.prioritaet !== 'normal' && (
          <PrioritaetBadge prioritaet={projekt.prioritaet} />
        )}
        {projekt.tags && projekt.tags.length > 0 && projekt.tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Tag className="h-3 w-3" /> {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <button onClick={onCancelEditing} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors">
              Abbrechen
            </button>
            <button onClick={onSave} className="px-3 py-1.5 text-sm bg-btn-primary text-white rounded-lg hover:bg-btn-primary-hover transition-colors flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Speichern
            </button>
          </>
        ) : (
          <>
            <button onClick={onStartEditing} className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-1.5">
              <Edit2 className="h-4 w-4" /> Bearbeiten
            </button>
            <button onClick={onDelete} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Löschen
            </button>
            <button
              onClick={() => window.open(`/projekte/${projekt.id}?standalone=1`, '_blank', 'width=1200,height=800')}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
              title="In neuem Fenster öffnen"
            >
              <ExternalLink size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
