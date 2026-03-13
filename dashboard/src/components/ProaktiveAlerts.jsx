import { AlertTriangle, Clock, Truck, Wrench, CheckCircle } from 'lucide-react'

const ALERT_ICONS = {
  angebot_offen: Clock,
  ab_fehlt: AlertTriangle,
  liefertermin_ueberschritten: Truck,
  montage_ohne_material: Wrench,
}

const SEVERITY_STYLES = {
  warning: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', iconColor: '#F59E0B' },
  danger:  { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B', iconColor: '#DC2626' },
  info:    { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', iconColor: '#3B82F6' },
}

export default function ProaktiveAlerts({ alerts = [], onClickAlert }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg p-3 bg-success-light text-success-dark">
        <CheckCircle size={18} className="text-success" />
        <span className="text-sm font-medium">Alles im Griff - keine offenen Warnungen</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
      {alerts.map((alert) => {
        const severity = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
        const Icon = ALERT_ICONS[alert.alertType] || AlertTriangle

        return (
          <button
            key={alert.id}
            type="button"
            onClick={() => onClickAlert?.(alert)}
            className="flex items-start gap-3 rounded-lg p-3 text-left w-full transition-opacity hover:opacity-80"
            style={{
              backgroundColor: severity.bg,
              border: `1px solid ${severity.border}30`,
            }}
          >
            <Icon
              size={18}
              className="mt-0.5 shrink-0"
              style={{ color: severity.iconColor }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: severity.text }}>
                {alert.message}
              </p>
              {alert.projekt?.projekt_nummer && (
                <p className="text-xs mt-0.5" style={{ color: `${severity.text}99` }}>
                  {alert.projekt.projekt_nummer}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
