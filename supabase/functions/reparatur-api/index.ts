// =============================================================================
// Auftrags-API - Auftragsverwaltung (ehemals Reparatur-API)
// Version: 2.3.0 - 2026-02-09
// =============================================================================
// CHANGES v2.3.0:
//   - Einsatzort-Felder: einsatzort_strasse, einsatzort_plz, einsatzort_ort
//   - UPDATE_WHITELIST erweitert, CreateAuftragBody erweitert, createAuftrag erweitert
// CHANGES v2.2.0:
//   - Neuer PATCH Endpoint: /reparatur/:id/update (genereller Update)
// CHANGES v2.1.0:
//   - createAuftrag gibt jetzt auftragsnummer zurueck
//   - getOffeneAuftraege gibt auftragsnummer zurueck
//   - getAuftragById gibt auftragsnummer zurueck
// =============================================================================
// Endpoints:
//   POST  /reparatur-api/reparatur                - Neuen Auftrag anlegen
//   GET   /reparatur-api/reparatur/:id            - Einzelnen Auftrag abrufen
//   GET   /reparatur-api/reparatur                - Alle offenen Auftraege
//   PATCH /reparatur-api/reparatur/:id/status     - Status-Transition
//   PATCH /reparatur-api/reparatur/:id/termin     - Termin SV1 setzen
//   PATCH /reparatur-api/reparatur/:id/outcome    - Outcome SV1 setzen
//   PATCH /reparatur-api/reparatur/:id/termin-sv2 - Termin SV2 setzen
//   PATCH /reparatur-api/reparatur/:id/mannstaerke - Mannstaerke setzen
//   PATCH /reparatur-api/reparatur/:id/update     - Genereller Update (Whitelist)
//   GET   /reparatur-api/kunden?q=suchbegriff     - Bestandskunden suchen
//   GET   /reparatur-api/optionen/:kategorie      - Dropdown-Optionen abrufen
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// Types
interface CreateAuftragBody {
  kunde_kategorie: "NEUKUNDE" | "BESTANDSKUNDE";
  prioritaet?: "HOCH" | "MITTEL" | "NORMAL";
  beschreibung?: string;
  adresse_strasse?: string;
  adresse_plz?: string;
  adresse_ort?: string;
  name?: string;
  telefon?: string;
  email?: string;
  erp_kunde_id?: number;
  manuelle_kunde_id?: string;
  document_id?: string;
  mannstaerke?: 1 | 2;
  zeitfenster?: "FRUEH" | "VORMITTAG" | "NACHMITTAG" | "SPAET";
  notizen?: string;
  metadata?: Record<string, unknown>;
  kundentyp_option?: string;
  auftragstyp?: string;
  erstellt_via?: "dashboard" | "telegram";
  telegram_chat_id?: number;
  telegram_message_id?: number;
  einsatzort_strasse?: string;
  einsatzort_plz?: string;
  einsatzort_ort?: string;
}

interface StatusTransitionBody { neuer_status: string; notiz?: string; }
interface TerminSetzenBody { termin_sv1: string; zeitfenster: "FRUEH" | "VORMITTAG" | "NACHMITTAG" | "SPAET"; notiz?: string; }
interface OutcomeSetzenBody { outcome_sv1: "A" | "B"; notiz?: string; set_erledigt?: boolean; }
interface TerminSv2SetzenBody { termin_sv2: string; zeitfenster: "FRUEH" | "VORMITTAG" | "NACHMITTAG" | "SPAET"; notiz?: string; }
interface MannstaerkeSetzenBody { mannstaerke: 1 | 2 | null; notiz?: string; }

// Status-Transition-Regeln
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'OFFEN': ['IN_BEARBEITUNG'],
  'IN_BEARBEITUNG': ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
  'TERMIN_RESERVIERT': ['TERMIN_FIX', 'NICHT_BESTAETIGT'],
  'TERMIN_FIX': ['ERLEDIGT', 'NO_SHOW'],
  'NO_SHOW': ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
  'NICHT_BESTAETIGT': ['TERMIN_RESERVIERT', 'ARCHIVIERT'],
};
const VALID_STATUS = ['OFFEN', 'IN_BEARBEITUNG', 'TERMIN_RESERVIERT', 'TERMIN_FIX', 'ERLEDIGT', 'NO_SHOW', 'NICHT_BESTAETIGT', 'ARCHIVIERT'];
const VALID_ZEITFENSTER = ['FRUEH', 'VORMITTAG', 'NACHMITTAG', 'SPAET'];

// Whitelist fuer generellen Update-Endpoint
const UPDATE_WHITELIST = new Set([
  'beschreibung',
  'prioritaet',
  'notizen',
  'auftragstyp',
  'adresse_strasse',
  'adresse_plz',
  'adresse_ort',
  'erp_kunde_id',
  'kunde_kategorie',
  'neukunde_name',
  'neukunde_telefon',
  'neukunde_email',
  'einsatzort_strasse',
  'einsatzort_plz',
  'einsatzort_ort',
]);

// Validation
function validateCreateBody(body: CreateAuftragBody): { valid: boolean; error?: string } {
  if (!body.kunde_kategorie) return { valid: false, error: "kunde_kategorie ist erforderlich (NEUKUNDE oder BESTANDSKUNDE)" };
  if (!['NEUKUNDE', 'BESTANDSKUNDE'].includes(body.kunde_kategorie)) return { valid: false, error: "kunde_kategorie muss NEUKUNDE oder BESTANDSKUNDE sein" };
  if (body.kunde_kategorie === 'NEUKUNDE') {
    if (!body.name || body.name.trim() === '') return { valid: false, error: "Bei NEUKUNDE ist 'name' ein Pflichtfeld" };
    if (!body.telefon || body.telefon.trim() === '') return { valid: false, error: "Bei NEUKUNDE ist 'telefon' ein Pflichtfeld" };
  }
  if (body.kunde_kategorie === 'BESTANDSKUNDE') {
    if (!body.erp_kunde_id && !body.manuelle_kunde_id) return { valid: false, error: "Bei BESTANDSKUNDE ist 'erp_kunde_id' oder 'manuelle_kunde_id' ein Pflichtfeld" };
  }
  if (body.prioritaet && !['HOCH', 'MITTEL', 'NORMAL'].includes(body.prioritaet)) return { valid: false, error: "prioritaet muss HOCH, MITTEL oder NORMAL sein" };
  if (body.mannstaerke !== undefined && ![1, 2].includes(body.mannstaerke)) return { valid: false, error: "mannstaerke muss 1 oder 2 sein" };
  if (body.zeitfenster && !VALID_ZEITFENSTER.includes(body.zeitfenster)) return { valid: false, error: "zeitfenster muss FRUEH, VORMITTAG, NACHMITTAG oder SPAET sein" };
  if (body.erstellt_via && !['dashboard', 'telegram'].includes(body.erstellt_via)) return { valid: false, error: "erstellt_via muss 'dashboard' oder 'telegram' sein" };
  return { valid: true };
}

function validateStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  if (!VALID_STATUS.includes(newStatus)) return { valid: false, error: `Ungueltiger Status '${newStatus}'. Erlaubt: ${VALID_STATUS.join(', ')}` };
  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedTargets.includes(newStatus)) return { valid: false, error: `Uebergang von ${currentStatus} nach ${newStatus} nicht erlaubt. Erlaubte Zielstatus: ${allowedTargets.length > 0 ? allowedTargets.join(', ') : 'keine (Endzustand)'}` };
  return { valid: true };
}

function validateTerminSetzen(body: TerminSetzenBody): { valid: boolean; error?: string } {
  if (!body.termin_sv1) return { valid: false, error: "'termin_sv1' ist ein Pflichtfeld (ISO 8601 Timestamp)" };
  if (!body.zeitfenster || !VALID_ZEITFENSTER.includes(body.zeitfenster)) return { valid: false, error: `Ungueltiges Zeitfenster` };
  if (isNaN(new Date(body.termin_sv1).getTime())) return { valid: false, error: "'termin_sv1' ist kein gueltiges Datum" };
  return { valid: true };
}

function validateOutcomeSetzen(body: OutcomeSetzenBody): { valid: boolean; error?: string } {
  if (!body.outcome_sv1 || !['A', 'B'].includes(body.outcome_sv1)) return { valid: false, error: "'outcome_sv1' muss A oder B sein" };
  if (body.set_erledigt && body.outcome_sv1 !== 'A') return { valid: false, error: "'set_erledigt' ist nur bei outcome_sv1='A' erlaubt" };
  return { valid: true };
}

function validateTerminSv2Setzen(body: TerminSv2SetzenBody): { valid: boolean; error?: string } {
  if (!body.termin_sv2) return { valid: false, error: "'termin_sv2' ist ein Pflichtfeld" };
  if (!body.zeitfenster || !VALID_ZEITFENSTER.includes(body.zeitfenster)) return { valid: false, error: "Ungueltiges zeitfenster" };
  if (isNaN(new Date(body.termin_sv2).getTime())) return { valid: false, error: "'termin_sv2' ist kein gueltiges Datum" };
  return { valid: true };
}

function validateMannstaerkeSetzen(body: MannstaerkeSetzenBody): { valid: boolean; error?: string } {
  if (body.mannstaerke !== null && body.mannstaerke !== 1 && body.mannstaerke !== 2) return { valid: false, error: "'mannstaerke' muss 1, 2 oder null sein" };
  return { valid: true };
}

// GET /optionen/:kategorie
async function getOptionen(kategorie: string): Promise<any[]> {
  const { data, error } = await supabase.from('einstellungen_optionen').select('id, kategorie, wert, sortierung, aktiv').eq('kategorie', kategorie).eq('aktiv', true).order('sortierung', { ascending: true });
  if (error) throw new Error(`Fehler beim Laden der Optionen: ${error.message}`);
  return data || [];
}

// GET /kunden?q=suchbegriff
async function searchKunden(suchbegriff: string): Promise<{ kunden: any[]; count: number }> {
  if (!suchbegriff || suchbegriff.trim().length < 2) throw new Error('Suchbegriff muss mindestens 2 Zeichen haben');
  const searchTerm = `%${suchbegriff.trim()}%`;
  const { data: erpKunden, error: erpError } = await supabase.from('erp_kunden').select('code, firma1, firma2, name, strasse, plz, ort, telefon, email').or(`firma1.ilike.${searchTerm},firma2.ilike.${searchTerm},name.ilike.${searchTerm},strasse.ilike.${searchTerm},ort.ilike.${searchTerm},telefon.ilike.${searchTerm},email.ilike.${searchTerm}`).limit(15);
  if (erpError) console.error('[KUNDEN-SUCHE] ERP Fehler:', erpError.message);
  const { data: manuelleKunden, error: manuelleError } = await supabase.from('manuelle_kunden').select('id, vorname, name, firma1, firma2, strasse, plz, ort, telefon, email, kundentyp').or(`firma1.ilike.${searchTerm},firma2.ilike.${searchTerm},name.ilike.${searchTerm},vorname.ilike.${searchTerm},strasse.ilike.${searchTerm},ort.ilike.${searchTerm}`).limit(5);
  if (manuelleError) console.error('[KUNDEN-SUCHE] Manuelle Fehler:', manuelleError.message);
  const ergebnisse = [
    ...(erpKunden || []).map(k => ({ ...k, quelle: 'erp', kunden_id: `erp_${k.code}` })),
    ...(manuelleKunden || []).map(k => ({ ...k, quelle: 'manuell', kunden_id: `man_${k.id}`, code: null })),
  ];
  return { kunden: ergebnisse, count: ergebnisse.length };
}

// POST /reparatur
async function createAuftrag(body: CreateAuftragBody): Promise<{ id: string; auftragsnummer: string; status: string; erstellt_am: string }> {
  const validation = validateCreateBody(body);
  if (!validation.valid) throw new Error(validation.error);
  const insertData: Record<string, unknown> = {
    status: 'OFFEN',
    kunde_kategorie: body.kunde_kategorie,
    prioritaet: body.prioritaet || 'NORMAL',
    beschreibung: body.beschreibung || null,
    adresse_strasse: body.adresse_strasse || null,
    adresse_plz: body.adresse_plz || null,
    adresse_ort: body.adresse_ort || null,
    erp_kunde_id: body.erp_kunde_id || null,
    manuelle_kunde_id: body.manuelle_kunde_id || null,
    document_id: body.document_id || null,
    mannstaerke: body.mannstaerke || null,
    zeitfenster: body.zeitfenster || null,
    notizen: body.notizen || null,
    metadata: body.metadata || {},
    kundentyp_option: body.kundentyp_option || 'Privat',
    auftragstyp: body.auftragstyp || 'Reparaturauftrag',
    erstellt_via: body.erstellt_via || 'dashboard',
    telegram_chat_id: body.telegram_chat_id || null,
    telegram_message_id: body.telegram_message_id || null,
    einsatzort_strasse: body.einsatzort_strasse || null,
    einsatzort_plz: body.einsatzort_plz || null,
    einsatzort_ort: body.einsatzort_ort || null,
  };
  if (body.kunde_kategorie === 'NEUKUNDE') {
    insertData.neukunde_name = body.name;
    insertData.neukunde_telefon = body.telefon;
    insertData.neukunde_email = body.email || null;
  }
  const { data, error } = await supabase.from('auftraege').insert(insertData).select('id, auftragsnummer, status, erstellt_am').single();
  if (error) throw new Error(`Auftrag konnte nicht erstellt werden: ${error.message}`);
  console.log(`[CREATE] Auftrag ${data.auftragsnummer} erstellt: id=${data.id}, typ=${body.auftragstyp}, via=${body.erstellt_via}`);
  return { id: data.id, auftragsnummer: data.auftragsnummer, status: data.status, erstellt_am: data.erstellt_am };
}

// GET /reparatur/:id
async function getAuftragById(id: string): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID (UUID erwartet)');
  const { data, error } = await supabase.from('auftraege').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`);
    throw new Error(`Datenbankfehler: ${error.message}`);
  }
  return data;
}

// GET /reparatur
async function getOffeneAuftraege(): Promise<{ auftraege: any[]; count: number }> {
  const { data, error } = await supabase.from('auftraege').select('*').not('status', 'in', '(ERLEDIGT,ARCHIVIERT)');
  if (error) throw new Error(`Datenbankfehler: ${error.message}`);
  const priorityOrder: Record<string, number> = { 'HOCH': 0, 'MITTEL': 1, 'NORMAL': 2 };
  const sortedData = (data || []).sort((a, b) => {
    const prioA = priorityOrder[a.prioritaet] ?? 2;
    const prioB = priorityOrder[b.prioritaet] ?? 2;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime();
  });
  return { auftraege: sortedData, count: sortedData.length };
}

// PATCH /reparatur/:id/status
async function updateAuftragStatus(id: string, body: StatusTransitionBody): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');
  if (!body.neuer_status) throw new Error("'neuer_status' ist Pflichtfeld");
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id, status, outcome_sv1, termin_sv1, auftragsnummer').eq('id', id).single();
  if (fetchError) { if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`); throw new Error(`Datenbankfehler: ${fetchError.message}`); }
  const validation = validateStatusTransition(current.status, body.neuer_status);
  if (!validation.valid) throw new Error(validation.error);
  if (body.neuer_status === 'TERMIN_FIX' && !current.termin_sv1) throw new Error('TERMIN_FIX erfordert termin_sv1');
  const updateData: Record<string, unknown> = { status: body.neuer_status, aktualisiert_am: new Date().toISOString() };
  if (body.neuer_status === 'IN_BEARBEITUNG') updateData.letzter_kontakt_am = new Date().toISOString();
  if (body.neuer_status === 'NO_SHOW') updateData.ist_no_show = true;
  const { data, error: updateError } = await supabase.from('auftraege').update(updateData).eq('id', id).select('id, auftragsnummer, status, aktualisiert_am').single();
  if (updateError) throw new Error(`Update fehlgeschlagen: ${updateError.message}`);
  console.log(`[STATUS] ${current.auftragsnummer}: ${current.status} -> ${body.neuer_status}`);
  return { id: data.id, auftragsnummer: data.auftragsnummer, alter_status: current.status, neuer_status: data.status, aktualisiert_am: data.aktualisiert_am };
}

// PATCH /reparatur/:id/termin
async function setAuftragTermin(id: string, body: TerminSetzenBody): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');
  const validation = validateTerminSetzen(body);
  if (!validation.valid) throw new Error(validation.error);
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id, status').eq('id', id).single();
  if (fetchError) { if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`); throw new Error(`Datenbankfehler: ${fetchError.message}`); }
  const erlaubt = ['IN_BEARBEITUNG', 'TERMIN_RESERVIERT', 'NICHT_BESTAETIGT', 'NO_SHOW'];
  if (!erlaubt.includes(current.status)) throw new Error(`Termin nicht erlaubt bei Status '${current.status}'`);
  const now = new Date().toISOString();
  const { data, error: updateError } = await supabase.from('auftraege').update({ termin_sv1: body.termin_sv1, zeitfenster: body.zeitfenster, letzter_kontakt_am: now, aktualisiert_am: now, status: 'TERMIN_RESERVIERT' }).eq('id', id).select('id, auftragsnummer, termin_sv1, zeitfenster, status, letzter_kontakt_am, aktualisiert_am').single();
  if (updateError) throw new Error(`Termin konnte nicht gesetzt werden: ${updateError.message}`);
  console.log(`[TERMIN] ${data.auftragsnummer}: ${body.termin_sv1} (${body.zeitfenster})`);
  return data;
}

// PATCH /reparatur/:id/outcome
async function setAuftragOutcome(id: string, body: OutcomeSetzenBody): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');
  const validation = validateOutcomeSetzen(body);
  if (!validation.valid) throw new Error(validation.error);
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id, status, outcome_sv1').eq('id', id).single();
  if (fetchError) { if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`); throw new Error(`Datenbankfehler: ${fetchError.message}`); }
  const erlaubt = ['TERMIN_FIX', 'ERLEDIGT'];
  if (!erlaubt.includes(current.status)) throw new Error(`Outcome nicht erlaubt bei Status '${current.status}'`);
  const updateData: Record<string, unknown> = { outcome_sv1: body.outcome_sv1, aktualisiert_am: new Date().toISOString() };
  if (body.outcome_sv1 === 'A' && body.set_erledigt) updateData.status = 'ERLEDIGT';
  const { data, error: updateError } = await supabase.from('auftraege').update(updateData).eq('id', id).select('id, auftragsnummer, outcome_sv1, status, aktualisiert_am').single();
  if (updateError) throw new Error(`Outcome konnte nicht gesetzt werden: ${updateError.message}`);
  console.log(`[OUTCOME] ${data.auftragsnummer}: ${body.outcome_sv1}`);
  return data;
}

// PATCH /reparatur/:id/termin-sv2
async function setAuftragTerminSv2(id: string, body: TerminSv2SetzenBody): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');
  const validation = validateTerminSv2Setzen(body);
  if (!validation.valid) throw new Error(validation.error);
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id, outcome_sv1').eq('id', id).single();
  if (fetchError) { if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`); throw new Error(`Datenbankfehler: ${fetchError.message}`); }
  if (current.outcome_sv1 !== 'B') throw new Error(`Termin SV2 nur bei outcome_sv1='B' erlaubt`);
  const now = new Date().toISOString();
  const { data, error: updateError } = await supabase.from('auftraege').update({ termin_sv2: body.termin_sv2, letzter_kontakt_am: now, aktualisiert_am: now }).eq('id', id).select('id, auftragsnummer, termin_sv2, letzter_kontakt_am, aktualisiert_am').single();
  if (updateError) throw new Error(`Termin SV2 konnte nicht gesetzt werden: ${updateError.message}`);
  console.log(`[TERMIN-SV2] ${data.auftragsnummer}: ${body.termin_sv2}`);
  return { ...data, zeitfenster: body.zeitfenster };
}

// PATCH /reparatur/:id/mannstaerke
async function setAuftragMannstaerke(id: string, body: MannstaerkeSetzenBody): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');
  const validation = validateMannstaerkeSetzen(body);
  if (!validation.valid) throw new Error(validation.error);
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id').eq('id', id).single();
  if (fetchError) { if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`); throw new Error(`Datenbankfehler: ${fetchError.message}`); }
  const { data, error: updateError } = await supabase.from('auftraege').update({ mannstaerke: body.mannstaerke, aktualisiert_am: new Date().toISOString() }).eq('id', id).select('id, auftragsnummer, mannstaerke, aktualisiert_am').single();
  if (updateError) throw new Error(`Mannstaerke konnte nicht gesetzt werden: ${updateError.message}`);
  console.log(`[MANNSTAERKE] ${data.auftragsnummer}: ${body.mannstaerke}`);
  return data;
}

// PATCH /reparatur/:id/update - Genereller Update mit Whitelist
async function updateAuftragFields(id: string, body: Record<string, unknown>): Promise<any> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new Error('Ungueltige Auftrags-ID');

  // Nur erlaubte Felder durchlassen
  const updateData: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (UPDATE_WHITELIST.has(key)) {
      updateData[key] = value;
    } else {
      ignoredFields.push(key);
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('Keine erlaubten Felder zum Aktualisieren gefunden. Erlaubte Felder: ' + Array.from(UPDATE_WHITELIST).join(', '));
  }

  // Validierung einzelner Felder
  if (updateData.prioritaet && !['HOCH', 'MITTEL', 'NORMAL'].includes(updateData.prioritaet as string)) {
    throw new Error("prioritaet muss HOCH, MITTEL oder NORMAL sein");
  }
  if (updateData.kunde_kategorie && !['NEUKUNDE', 'BESTANDSKUNDE'].includes(updateData.kunde_kategorie as string)) {
    throw new Error("kunde_kategorie muss NEUKUNDE oder BESTANDSKUNDE sein");
  }

  // Pruefen ob Auftrag existiert
  const { data: current, error: fetchError } = await supabase.from('auftraege').select('id, auftragsnummer').eq('id', id).single();
  if (fetchError) {
    if (fetchError.code === 'PGRST116') throw new Error(`Auftrag nicht gefunden: ${id}`);
    throw new Error(`Datenbankfehler: ${fetchError.message}`);
  }

  // aktualisiert_am automatisch setzen
  updateData.aktualisiert_am = new Date().toISOString();

  const { data, error: updateError } = await supabase
    .from('auftraege')
    .update(updateData)
    .eq('id', id)
    .select('id, auftragsnummer, aktualisiert_am')
    .single();

  if (updateError) throw new Error(`Update fehlgeschlagen: ${updateError.message}`);

  const updatedFields = Object.keys(updateData).filter(k => k !== 'aktualisiert_am');
  console.log(`[UPDATE] ${current.auftragsnummer}: ${updatedFields.join(', ')} aktualisiert`);

  return {
    id: data.id,
    auftragsnummer: data.auftragsnummer,
    aktualisiert_am: data.aktualisiert_am,
    aktualisierte_felder: updatedFields,
    ignorierte_felder: ignoredFields.length > 0 ? ignoredFields : undefined,
  };
}

// Main Handler
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.searchParams.get('health') === '1') {
      return new Response(JSON.stringify({ service: 'reparatur-api', version: '2.3.0', status: 'ready' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && pathParts[1] === 'optionen' && pathParts.length === 3) {
      const result = await getOptionen(pathParts[2]);
      return new Response(JSON.stringify({ kategorie: pathParts[2], optionen: result }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && pathParts[1] === 'kunden' && pathParts.length === 2) {
      const result = await searchKunden(url.searchParams.get('q') || '');
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'PATCH' && pathParts[1] === 'reparatur' && pathParts.length === 4) {
      const id = pathParts[2]; const action = pathParts[3]; const body = await req.json(); let result;
      switch (action) {
        case 'status': result = await updateAuftragStatus(id, body); break;
        case 'termin': result = await setAuftragTermin(id, body); break;
        case 'outcome': result = await setAuftragOutcome(id, body); break;
        case 'termin-sv2': result = await setAuftragTerminSv2(id, body); break;
        case 'mannstaerke': result = await setAuftragMannstaerke(id, body); break;
        case 'update': result = await updateAuftragFields(id, body); break;
        default: return new Response(JSON.stringify({ error: `Unbekannte Aktion: ${action}` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'POST' && pathParts[1] === 'reparatur' && pathParts.length === 2) {
      const body: CreateAuftragBody = await req.json();
      const result = await createAuftrag(body);
      return new Response(JSON.stringify(result), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && pathParts[1] === 'reparatur' && pathParts.length === 3) {
      const result = await getAuftragById(pathParts[2]);
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method === 'GET' && pathParts[1] === 'reparatur' && pathParts.length === 2) {
      const result = await getOffeneAuftraege();
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`[ERROR] ${error}`);
    const msg = error instanceof Error ? error.message : String(error);
    let status = 500;
    if (msg.includes('nicht gefunden')) status = 404;
    if (msg.includes('Pflicht') || msg.includes('muss') || msg.includes('Ungueltig') || msg.includes('nicht erlaubt') || msg.includes('Keine erlaubten')) status = 400;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
