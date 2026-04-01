// Projekt-Lifecycle: 11 lineare Phasen + 3 Sonder-Status
export const PROJEKT_STATUS = {
  // Linearer Flow
  anfrage:           { label: 'Anfrage',         color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  angebot:           { label: 'Angebot',         color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  auftrag:           { label: 'Auftrag',         color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  bestellt:          { label: 'Bestellt',        color: '#F97316', bg: '#FFF7ED', text: '#9A3412' },
  ab_erhalten:       { label: 'AB erhalten',     color: '#14B8A6', bg: '#F0FDFA', text: '#115E59' },
  lieferung_geplant: { label: 'Lieferung gepl.', color: '#06B6D4', bg: '#ECFEFF', text: '#155E75' },
  montagebereit:     { label: 'Montagebereit',   color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  abnahme:           { label: 'Abnahme',         color: '#059669', bg: '#D1FAE5', text: '#064E3B' },
  rechnung:          { label: 'Rechnung',        color: '#7C3AED', bg: '#EDE9FE', text: '#4C1D95' },
  bezahlt:           { label: 'Bezahlt',         color: '#16A34A', bg: '#DCFCE7', text: '#14532D' },
  erledigt:          { label: 'Erledigt',        color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  // Sonder-Status
  reklamation:       { label: 'Reklamation',     color: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
  storniert:         { label: 'Storniert',       color: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280' },
  pausiert:          { label: 'Pausiert',        color: '#D97706', bg: '#FEF3C7', text: '#92400E' },
}

// Linearer Phasen-Flow (ohne Sonder-Status)
export const PHASE_FLOW = [
  'anfrage', 'angebot', 'auftrag', 'bestellt', 'ab_erhalten',
  'lieferung_geplant', 'montagebereit', 'abnahme', 'rechnung', 'bezahlt', 'erledigt',
]

// Sonder-Status (kann jederzeit gesetzt werden, speichert vorheriger_status)
export const SONDER_STATUS = ['reklamation', 'storniert', 'pausiert']

export const PROJEKT_PRIORITAETEN = {
  niedrig:  { label: 'Niedrig',  color: '#6B7280', bg: '#F3F4F6' },
  normal:   { label: 'Normal',   color: '#3B82F6', bg: '#EFF6FF' },
  hoch:     { label: 'Hoch',     color: '#F59E0B', bg: '#FFFBEB' },
  dringend: { label: 'Dringend', color: '#DC2626', bg: '#FEF2F2' },
}

export const MONTAGE_TEAMS = [
  { value: 'mariusz_manfred', label: 'Mariusz & Manfred' },
  { value: 'christian_michael', label: 'Christian & Michael' },
  { value: 'stefan', label: 'Stefan' },
]

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

// Synchronized with supabase/functions/_shared/categories.ts v4.1.0
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
  'Bescheinigung',
  'Bestellung_Ausgehend',
  'Bestellung_Eingehend',
  'Bild',
  'Brief_ausgehend',
  'Brief_eingehend',
  'Brief_von_Finanzamt',
  'Buchhaltungsunterlagen',
  'Fahrzeugdokument',
  'Finanzierung',
  'Foerderantrag',
  'Formular',
  'Garantie',
  'Gutschein',
  'Gutschrift_Ausgehend',
  'Gutschrift_Eingehend',
  'Kassenbeleg_Ausgehend',
  'Kassenbeleg_Eingehend',
  'Katalog',
  'Kundenunterlage',
  'Leasing',
  'Lieferschein_Ausgehend',
  'Lieferschein_Eingehend',
  'Mahnung_Ausgehend',
  'Mahnung_Eingehend',
  'Montageauftrag',
  'Notiz',
  'Office_Dokument',
  'Personalunterlagen',
  'Preisliste',
  'Privat',
  'Produktdatenblatt',
  'Rechnung_Ausgehend',
  'Rechnung_Eingehend',
  'Reiseunterlagen',
  'Reklamation',
  'Retoure_Ausgehend',
  'Retoure_Eingehend',
  'Schliessanlage',
  'Serviceauftrag',
  'Skizze',
  'Sonstiges_Dokument',
  'Spam',
  'Steuer_Bescheid',
  'Veranstaltung',
  'Versicherung',
  'Vertrag',
  'Video',
  'Vorlage',
  'Zahlungsavis',
  'Zeichnung',
]

// Synchronized with supabase/functions/_shared/categories.ts v3.2.0
export const EMAIL_KATEGORIEN = [
  'Anforderung_Unterlagen',
  'Anfrage_Ausgehend',
  'Angebot_Ausgehend',
  'Angebot_Eingehend',
  'Antwort_oder_Weiterleitung',
  'Auftragsbestaetigung_Ausgehend',
  'Auftragsbestaetigung_Eingehend',
  'Automatische_Benachrichtigung',
  'BAFA_Foerderung',
  'Bestellung_Ausgehend',
  'Bestellung_Eingehend',
  'Bewerbung',
  'Intern',
  'Kundenanfrage',
  'Lead_Anfrage',
  'Lieferschein_Eingehend',
  'Lieferstatus_Update',
  'Mahnung_Ausgehend',
  'Mahnung_Eingehend',
  'Marktplatz_Anfrage',
  'Nachverfolgung',
  'Newsletter_Werbung',
  'Rechnung_Ausgehend',
  'Rechnung_Eingehend',
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

// A-002: Projekt-Typen
export const PROJEKT_TYPEN = {
  auftrag:       { label: 'Auftrag',       icon: 'FileText',  color: '#3B82F6', bg: '#EFF6FF' },
  reparatur:     { label: 'Reparatur',     icon: 'Wrench',    color: '#F59E0B', bg: '#FFFBEB' },
  versicherung:  { label: 'Versicherung',  icon: 'Shield',    color: '#8B5CF6', bg: '#F5F3FF' },
  intern:        { label: 'Intern',        icon: 'Building',  color: '#6B7280', bg: '#F3F4F6' },
  wartung:       { label: 'Wartung',       icon: 'Settings',  color: '#14B8A6', bg: '#F0FDFA' },
}

// A-003: Dokument-Typen fuer projekt_dokumente
export const PROJEKT_DOKUMENT_TYPEN = {
  vollangebot:           { label: 'Vollangebot' },
  auftragsbestaetigung:  { label: 'Auftragsbestätigung' },
  ab_unterschrieben:     { label: 'AB unterschrieben' },
  bestellung:            { label: 'Bestellung' },
  ab_eingehend:          { label: 'AB eingehend' },
  lieferschein:          { label: 'Lieferschein' },
  rechnung:              { label: 'Rechnung' },
  gutschrift:            { label: 'Gutschrift' },
  abtretungserklaerung:  { label: 'Abtretungserklärung' },
  sonstiges:             { label: 'Sonstiges' },
}

// A-003: Pflicht-Gates (Status-Transition → benoetigte Dokument-Typen)
export const PFLICHT_GATES = {
  auftrag:  ['ab_unterschrieben'],                    // Kein Auftrag ohne unterschriebene AB
  bestellt: [],                                        // Frei (Bestellung impliziert Auftrag)
}

// Versicherungs-spezifische Gates (zusaetzlich zu Standard-Gates)
export const VERSICHERUNG_GATES = {
  bestellt: ['abtretungserklaerung'],                  // Versicherung: Abtretung vor Bestellung
}

// A-004: Positions-Einheiten
export const POSITIONS_EINHEITEN = {
  stueck:   { label: 'Stück',   short: 'Stk' },
  lfm:      { label: 'Laufmeter', short: 'lfm' },
  m2:       { label: 'Quadratmeter', short: 'm²' },
  pauschal: { label: 'Pauschal', short: 'psch' },
}

// A-005: Beleg-Typen (Angebot → Rechnung Workflow)
export const BELEG_TYPEN = {
  angebot:               { label: 'Angebot',               prefix: 'A',  color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  auftragsbestaetigung:  { label: 'Auftragsbestätigung',   prefix: 'AB', color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  lieferschein:          { label: 'Lieferschein',          prefix: 'LS', color: '#14B8A6', bg: '#F0FDFA', text: '#115E59' },
  rechnung:              { label: 'Rechnung',              prefix: 'R',  color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  abschlagsrechnung:     { label: 'Abschlagsrechnung',     prefix: 'AR', color: '#F97316', bg: '#FFF7ED', text: '#9A3412' },
  schlussrechnung:       { label: 'Schlussrechnung',       prefix: 'SR', color: '#059669', bg: '#D1FAE5', text: '#064E3B' },
  gutschrift:            { label: 'Gutschrift',            prefix: 'GS', color: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
}

// A-005: Beleg-Status
export const BELEG_STATUS = {
  entwurf:      { label: 'Entwurf',      color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  freigegeben:  { label: 'Freigegeben',  color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  versendet:    { label: 'Versendet',    color: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  angenommen:   { label: 'Angenommen',   color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  abgelehnt:    { label: 'Abgelehnt',    color: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
  bezahlt:      { label: 'Bezahlt',      color: '#059669', bg: '#D1FAE5', text: '#064E3B' },
  teilbezahlt:  { label: 'Teilbezahlt',  color: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  storniert:    { label: 'Storniert',    color: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280' },
}

// A-005: Beleg-Einheiten
export const BELEG_EINHEITEN = {
  Stk:      { label: 'Stück',        short: 'Stk' },
  lfm:      { label: 'Laufmeter',    short: 'lfm' },
  m2:       { label: 'Quadratmeter', short: 'm2' },
  pauschal: { label: 'Pauschal',     short: 'psch' },
  Std:      { label: 'Stunden',      short: 'Std' },
  kg:       { label: 'Kilogramm',    short: 'kg' },
}

// Termin-Arten (synced with termin_arten table)
export const TERMIN_ARTEN = {
  montage:    { label: 'Montage',                 farbe: '#3B82F6', icon: 'Wrench' },
  reparatur:  { label: 'Reparatur',               farbe: '#EF4444', icon: 'AlertTriangle' },
  aufmass:    { label: 'Aufmaß',                   farbe: '#8B5CF6', icon: 'Ruler' },
  lieferung:  { label: 'Lieferung / Abholung',    farbe: '#F59E0B', icon: 'Truck' },
  beratung:   { label: 'Kundenbesuch / Beratung',  farbe: '#10B981', icon: 'Users' },
  intern:     { label: 'Intern / Büro',            farbe: '#6B7280', icon: 'Building' },
  lieferant:  { label: 'Lieferanten-Termin',       farbe: '#EC4899', icon: 'Factory' },
}

export const TERMIN_STATUS = {
  geplant:       { label: 'Geplant',       color: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  bestaetigt:    { label: 'Bestätigt',     color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  abgesagt:      { label: 'Abgesagt',      color: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
}

export const RESSOURCE_TYPEN = {
  fahrzeug:    { label: 'Fahrzeug' },
  monteur:     { label: 'Monteur' },
  hilfsmittel: { label: 'Hilfsmittel' },
}

export const ABWESENHEIT_TYPEN = {
  urlaub:    { label: 'Urlaub',    color: '#F59E0B' },
  krank:     { label: 'Krank',     color: '#EF4444' },
  frei:      { label: 'Frei',      color: '#6B7280' },
  sonstiges: { label: 'Sonstiges', color: '#9CA3AF' },
}

// API base URL for Edge Functions
export const API_BASE = 'https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1'
