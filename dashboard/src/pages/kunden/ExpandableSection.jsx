import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function ExpandableSection({ title, icon: Icon, count, color, defaultOpen, loading: extLoading, data: extData, renderItems }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div className="border-t border-border-light">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-main transition-colors">
        {open ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <Icon className="w-4 h-4 text-text-secondary" />
        <span className="font-medium text-sm text-text-primary">{title}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
          style={{ backgroundColor: (color || '#6B7280') + '18', color: color || '#6B7280' }}
        >
          {extLoading ? '...' : (count ?? extData?.length ?? 0)}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {extLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">Laden...</span>
            </div>
          ) : extData && extData.length > 0 ? (
            renderItems(extData)
          ) : (
            <p className="text-sm text-text-muted py-2">Keine Einträge</p>
          )}
        </div>
      )}
    </div>
  )
}
