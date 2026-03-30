import { useState, useEffect } from 'react'

// Placeholder — will be replaced by full implementation (Task #2)
export default function TerminForm() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e) => setOpen(true)
    window.addEventListener('termin-create-open', handler)
    return () => window.removeEventListener('termin-create-open', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={() => setOpen(false)}
    >
      <div
        className="rounded-lg bg-surface-card p-6 shadow-xl border border-border-default max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-text-primary font-medium">Termin-Formular wird noch implementiert.</p>
        <button
          onClick={() => setOpen(false)}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Schliessen
        </button>
      </div>
    </div>
  )
}
