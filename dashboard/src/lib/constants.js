// Reparatur-Status mit Farben (Tailwind v4 compatible - use inline styles for dynamic colors)
export const AUFTRAG_STATUS = {
  OFFEN: { label: 'Offen', color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  IN_BEARBEITUNG: { label: 'In Bearbeitung', color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  TERMIN_RESERVIERT: { label: 'Termin reserviert', color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  TERMIN_FIX: { label: 'Termin fix', color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  NICHT_BESTAETIGT: { label: 'Nicht bestätigt', color: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
  ERLEDIGT: { label: 'Erledigt', color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  NO_SHOW: { label: 'No-Show', color: '#DC2626', bg: '#FEF2F2', text: '#991B1B' },
  ARCHIVIERT: { label: 'Archiviert', color: '#9CA3AF', bg: '#F9FAFB', text: '#6B7280' },
}

export const ERLAUBTE_TRANSITIONS = {
  OFFEN: ['IN_BEARBEITUNG'],
  IN_BEARBEITUNG: ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
  TERMIN_RESERVIERT: ['TERMIN_FIX', 'NICHT_BESTAETIGT'],
  TERMIN_FIX: ['ERLEDIGT', 'NO_SHOW'],
  NO_SHOW: ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
  NICHT_BESTAETIGT: ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
}

export const PRIORITAETEN = {
  HOCH: { label: 'Hoch', color: '#DC2626' },
  MITTEL: { label: 'Mittel', color: '#F59E0B' },
  NORMAL: { label: 'Normal', color: '#6B7280' },
}

export const ZEITFENSTER = {
  FRUEH: { label: 'Früh (08:00–10:00)', zeit: '08:00-10:00' },
  VORMITTAG: { label: 'Vormittag (10:00–12:00)', zeit: '10:00-12:00' },
  NACHMITTAG: { label: 'Nachmittag (13:00–16:00)', zeit: '13:00-16:00' },
  SPAET: { label: 'Spät (16:00–18:00)', zeit: '16:00-18:00' },
}

export const DOKUMENT_KATEGORIEN = [
  'Angebot', 'Aufmassblatt', 'Auftragsbestaetigung', 'Ausgangsrechnung',
  'Bauplan', 'Bestellung', 'Bild', 'Brief_ausgehend', 'Brief_eingehend',
  'Brief_von_Finanzamt', 'Eingangslieferschein', 'Eingangsrechnung',
  'Email_Anhang', 'Email_Eingehend', 'Finanzierung', 'Formular',
  'Gutschrift', 'Kundenlieferschein', 'Leasing', 'Lieferschein',
  'Mahnung', 'Montageauftrag', 'Notiz', 'Preisanfrage', 'Produktdatenblatt',
  'Quittung', 'Rapport', 'Reiseunterlagen', 'Reklamation', 'Serviceauftrag',
  'Skizze', 'Sonstiges_Dokument', 'Stundenzettel', 'Technische_Zeichnung',
  'Versicherung', 'Vertrag', 'Werkstattauftrag', 'Zahlungsavis',
  'Zahlungserinnerung', 'Zeichnung', 'Zertifikat'
]

export const EMAIL_KATEGORIEN = [
  'Anfrage_Angebot', 'Auftragsbestaetigung', 'Baustelleninfo',
  'Interner_Vorgang', 'Lieferavis', 'Liefertermin_Verschiebung',
  'Mahnung_Zahlungserinnerung', 'Marketing_Newsletter', 'Montage_Koordination',
  'Preisliste_Katalog', 'Projektbesprechung', 'Qualitaet_Reklamation',
  'Rechnungsversand', 'Reparatur_Service', 'System_Automatisch',
  'Terminvereinbarung', 'Vertragswesen', 'Zahlungsavis'
]

export const DOKUMENT_QUELLEN = [
  { value: 'email', label: 'E-Mail' },
  { value: 'email_attachment', label: 'E-Mail-Anhang' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'upload', label: 'Upload' },
]

export const PROCESSING_STATUS = [
  { value: 'done', label: 'Fertig' },
  { value: 'queued', label: 'Warteschlange' },
  { value: 'processing', label: 'Verarbeitung' },
  { value: 'pending_ocr', label: 'OCR ausstehend' },
  { value: 'error', label: 'Fehler' },
]

// API base URL for Edge Functions
export const API_BASE = 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1'
