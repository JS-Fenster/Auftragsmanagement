// Reparatur-Status mit Farben (Tailwind v4 compatible - use inline styles for dynamic colors)
export const AUFTRAG_STATUS = {
  OFFEN: { label: 'Offen', color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  IN_BEARBEITUNG: { label: 'In Bearbeitung', color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  TERMIN_RESERVIERT: { label: 'Termin reserviert', color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  TERMIN_FIX: { label: 'Termin fix', color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  NICHT_BESTAETIGT: { label: 'Nicht bestätigt', color: '#F97316', bg: '#FFF7ED', text: '#9A3412' },
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

// Synchronized with supabase/functions/_shared/categories.ts v3.0.0
export const DOKUMENT_KATEGORIEN = [
  'Abnahmeprotokoll',
  'Anfrage_Ausgehend',
  'Anfrage_Eingehend',
  'Angebot_Ausgehend',
  'Angebot_Eingehend',
  'Anleitung',
  'Aufmassblatt',
  'Auftragsbestaetigung_Ausgehend',
  'Auftragsbestaetigung_Eingehend',
  'Audio',
  'Bauplan',
  'Bestellung_Ausgehend',
  'Bestellung_Eingehend',
  'Bild',
  'Brief_ausgehend',
  'Brief_eingehend',
  'Brief_von_Finanzamt',
  'Buchhaltungsunterlagen',
  'Fahrzeugdokument',
  'Finanzierung',
  'Formular',
  'Freistellungsbescheinigung',
  'Gutschrift',
  'Kassenbeleg',
  'Leasing',
  'Lieferschein_Ausgehend',
  'Lieferschein_Eingehend',
  'Mahnung',
  'Montageauftrag',
  'Notiz',
  'Office_Dokument',
  'Personalunterlagen',
  'Produktdatenblatt',
  'Rechnung_Ausgehend',
  'Rechnung_Eingehend',
  'Reiseunterlagen',
  'Reklamation',
  'Retoure_Ausgehend',
  'Retoure_Eingehend',
  'Serviceauftrag',
  'Skizze',
  'Sonstiges_Dokument',
  'Spam',
  'Steuer_Bescheid',
  'Vertrag',
  'Video',
  'Zahlungsavis',
  'Zeichnung',
]

// Synchronized with supabase/functions/_shared/categories.ts v3.0.0
export const EMAIL_KATEGORIEN = [
  'Anforderung_Unterlagen',
  'Angebot_Anforderung',
  'Antwort_oder_Weiterleitung',
  'Auftragserteilung',
  'Automatische_Benachrichtigung',
  'BAFA_Foerderung',
  'Bestellbestaetigung',
  'Bewerbung',
  'Intern',
  'Kundenanfrage',
  'Lead_Anfrage',
  'Lieferstatus_Update',
  'Marktplatz_Anfrage',
  'Nachverfolgung',
  'Newsletter_Werbung',
  'Rechnung_Eingang',
  'Rechnung_Gesendet',
  'Reklamation',
  'Serviceanfrage',
  'Sonstiges',
  'Terminanfrage',
  'Versicherung_Schaden',
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
