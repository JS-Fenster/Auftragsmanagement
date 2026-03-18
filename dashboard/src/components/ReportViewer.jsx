import { X, Printer } from 'lucide-react'
import FinanzberichtTemplate from './reports/FinanzberichtTemplate'
import ProjektTemplate from './reports/ProjektTemplate'
import KundenHistorieTemplate from './reports/KundenHistorieTemplate'
import PipelineTemplate from './reports/PipelineTemplate'

const REPORT_TEMPLATES = {
  finanzbericht: FinanzberichtTemplate,
  projekt_zusammenfassung: ProjektTemplate,
  kunden_historie: KundenHistorieTemplate,
  pipeline_analyse: PipelineTemplate,
  // montage_uebersicht and offene_posten can reuse a generic table template
}

export default function ReportViewer({ report, onClose }) {
  if (!report) return null

  const Template = REPORT_TEMPLATES[report.report_type]

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default print:hidden">
          <h2 className="text-lg font-semibold text-text-primary">{report.titel}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="p-2 hover:bg-surface-hover rounded-lg transition-colors" title="Drucken">
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg transition-colors" title="Schliessen">
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Print header */}
        <div className="hidden print:block px-6 py-4">
          <h1 className="text-2xl font-bold">{report.titel}</h1>
          <p className="text-sm text-gray-500">JS Fenster & Tueren — Erstellt am {new Date().toLocaleDateString('de-DE')}</p>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Template ? (
            <Template data={report.data} />
          ) : (
            <GenericReportView data={report.data} />
          )}
        </div>
      </div>
    </div>
  )
}

function GenericReportView({ data }) {
  if (!data) return <p className="text-text-muted">Keine Daten verfuegbar.</p>
  return (
    <pre className="text-xs bg-surface-hover p-4 rounded-lg overflow-auto whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
