import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

/**
 * LLM-011: ActionConfirmDialog
 * Shows confirmation dialog when the LLM assistant wants to perform a write action.
 * User must explicitly confirm before any data modification happens.
 *
 * Props:
 *   action: { name, description, details: [{label, value}] }
 *   onConfirm: () => void
 *   onCancel: () => void
 */
export default function ActionConfirmDialog({ action, onConfirm, onCancel }) {
  const [executing, setExecuting] = useState(false)

  if (!action) return null

  const handleConfirm = async () => {
    setExecuting(true)
    try {
      await onConfirm()
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-5 max-w-sm m-4 w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFF3CD' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#FBBA00' }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Aktion ausfuehren?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {action.description}
            </p>
          </div>
        </div>

        {/* Details */}
        {action.details && action.details.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5">
            {action.details.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{d.label}</span>
                <span className="text-gray-800 font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={executing}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={executing}
            className="px-3 py-1.5 text-sm text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: executing ? '#9E9E9E' : '#FBBA00' }}
          >
            {executing ? (
              <>Wird ausgefuehrt...</>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Ausfuehren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
