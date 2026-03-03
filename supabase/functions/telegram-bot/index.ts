import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Telegram Bot Edge Function - JS Fenster Fotobot
 * Version: 3.3.0 - 2026-02-09
 *
 * Changes v3.3.0:
 * - Score-based Kundensuche: Nicht mehr ALLE Woerter muessen matchen,
 *   sondern sortiert nach Trefferquote (match_count DESC)
 * - Nutzt DB-Funktion search_kunden_scored() statt Client-Side-Filtering
 * - "Kraus Horst Ammersricht" findet jetzt "Kraus Horst" (3/3 Match) als #1
 *
 * Changes v3.2.0:
 * - Persistent ReplyKeyboard (Neuer Auftrag / Neuer Kunde / Hilfe)
 * - Fuzzy-Suche: Woerter einzeln ueber alle Felder suchen
 * - Voice bei Beschreibung: Sprachnachricht wird transkribiert und als Text verwendet
 * - Auftragsnummer in Bestaetigungsmeldung statt UUID
 */

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ Persistent Keyboard ============

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "Neuer Auftrag" }, { text: "Neuer Kunde" }],
    [{ text: "Hilfe" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// ============ Types ============

interface TelegramUpdate { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery; }
interface TelegramMessage { message_id: number; from?: TelegramUser; chat: TelegramChat; date: number; text?: string; photo?: TelegramPhotoSize[]; voice?: TelegramVoice; caption?: string; }
interface TelegramUser { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string; }
interface TelegramChat { id: number; type: string; title?: string; username?: string; first_name?: string; last_name?: string; }
interface TelegramPhotoSize { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number; }
interface TelegramVoice { file_id: string; file_unique_id: string; duration: number; mime_type?: string; file_size?: number; }
interface TelegramCallbackQuery { id: string; from: TelegramUser; message?: TelegramMessage; data?: string; }
interface TelegramFile { file_id: string; file_unique_id: string; file_size: number; file_path: string; }
interface SessionState { state: string; pending_foto_id?: string; auftrag_data?: AuftragDraft; kunde_data?: KundeDraft; }
interface AuftragDraft { step: string; kunde_kategorie?: string; erp_kunde_id?: number; name?: string; telefon?: string; adresse?: string; beschreibung?: string; auftragstyp?: string; kundentyp_option?: string; }
interface KundeDraft { step: string; kundentyp?: string; vorname?: string; name?: string; firma?: string; telefon?: string; email?: string; strasse?: string; plz?: string; ort?: string; }

// ============ Telegram API Helpers ============

async function sendMessage(chatId: number, text: string, options?: { reply_markup?: object }): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  try { const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.ok; } catch { return false; }
}

async function sendWithMenu(chatId: number, text: string): Promise<boolean> {
  return sendMessage(chatId, text, { reply_markup: MAIN_KEYBOARD });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try { const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text }) }); return r.ok; } catch { return false; }
}

async function getFile(fileId: string): Promise<TelegramFile | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try { const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId }) }); if (!r.ok) return null; const d = await r.json(); return d.result; } catch { return null; }
}

async function downloadFile(filePath: string): Promise<Uint8Array | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try { const r = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); } catch { return null; }
}

// ============ OpenAI/GPT Integration ============

async function transcribeVoice(audioData: Uint8Array): Promise<string | null> {
  if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY nicht gesetzt"); return null; }
  const formData = new FormData();
  formData.append("file", new Blob([audioData], { type: "audio/ogg" }), "voice.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "de");
  try {
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` }, body: formData });
    if (!r.ok) { console.error("Whisper API error:", await r.text()); return null; }
    const result = await r.json(); return result.text;
  } catch (e) { console.error("Transcription error:", e); return null; }
}

// ============ Session Management ============

async function getSession(chatId: number): Promise<SessionState> {
  const { data } = await supabase.from("telegram_sessions").select("state, state_data").eq("telegram_chat_id", chatId).single();
  if (data) return { state: data.state || "idle", pending_foto_id: data.state_data?.pending_foto_id, auftrag_data: data.state_data?.auftrag_data, kunde_data: data.state_data?.kunde_data };
  return { state: "idle" };
}

async function setSession(chatId: number, userId: number | undefined, username: string | undefined, state: string, stateData?: Record<string, unknown>): Promise<void> {
  await supabase.from("telegram_sessions").upsert({ telegram_chat_id: chatId, telegram_user_id: userId, telegram_username: username, state, state_data: stateData || {}, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "telegram_chat_id" });
}

// ============ Dropdown Options ============

async function getOptionen(kategorie: string): Promise<string[]> {
  const { data } = await supabase.from("einstellungen_optionen").select("wert").eq("kategorie", kategorie).eq("aktiv", true).order("sortierung");
  return data?.map(d => d.wert) || [];
}

// ============ Score-based Customer Search ============

async function searchKundenFuzzy(suchbegriff: string): Promise<any[]> {
  const woerter = suchbegriff.trim().split(/\s+/).filter(w => w.length >= 2);
  if (woerter.length === 0) return [];

  const felder = ['firma1', 'firma2', 'name', 'strasse', 'plz', 'ort', 'telefon', 'email'];

  if (woerter.length === 1) {
    const term = `%${woerter[0]}%`;
    const orClauses = felder.map(f => `${f}.ilike.${term}`).join(',');
    const { data } = await supabase.from('erp_kunden').select('code, firma1, firma2, name, strasse, plz, ort, telefon, email').or(orClauses).limit(8);
    return data || [];
  }

  // Multiple words: Score-based search via DB function
  // Returns results sorted by match_count DESC - best matches first
  const { data, error } = await supabase.rpc('search_kunden_scored', { search_words: woerter });

  if (error) {
    console.error('[SEARCH] RPC error:', error.message);
    // Fallback: search first word only
    const term = `%${woerter[0]}%`;
    const orClauses = felder.map(f => `${f}.ilike.${term}`).join(',');
    const { data: fallbackData } = await supabase.from('erp_kunden').select('code, firma1, firma2, name, strasse, plz, ort, telefon, email').or(orClauses).limit(8);
    return fallbackData || [];
  }

  return data || [];
}

// ============ Auftrag Creation Flow ============

async function startNeuerAuftrag(chatId: number, user?: TelegramUser): Promise<void> {
  const auftragstypen = await getOptionen("auftragstyp");
  await setSession(chatId, user?.id, user?.username, "auftrag_typ", { auftrag_data: { step: "typ" } });
  const buttons = auftragstypen.map((typ, i) => [{ text: typ, callback_data: `atyp_${i}` }]);
  buttons.push([{ text: "Abbrechen", callback_data: "cancel" }]);
  await sendMessage(chatId, `<b>Neuer Auftrag</b>\n\nWelchen Auftragstyp moechtest du anlegen?`, { reply_markup: { inline_keyboard: buttons } });
}

async function handleAuftragCallback(chatId: number, user: TelegramUser, data: string, session: SessionState): Promise<void> {
  const auftragData = session.auftrag_data || { step: "" };

  if (data === "cancel") {
    await setSession(chatId, user.id, user.username, "idle");
    await sendWithMenu(chatId, "Auftrag abgebrochen. Was moechtest du tun?");
    return;
  }

  if (data.startsWith("atyp_")) {
    const auftragstypen = await getOptionen("auftragstyp");
    const idx = parseInt(data.replace("atyp_", ""));
    auftragData.auftragstyp = auftragstypen[idx];
    auftragData.step = "kunde_kategorie";
    await setSession(chatId, user.id, user.username, "auftrag_kunde", { auftrag_data: auftragData });
    await sendMessage(chatId, `Auftragstyp: <b>${auftragData.auftragstyp}</b>\n\nIst das ein Neukunde oder Bestandskunde?`, { reply_markup: { inline_keyboard: [[{ text: "Neukunde", callback_data: "kunde_NEU" }], [{ text: "Bestandskunde", callback_data: "kunde_BEST" }], [{ text: "Abbrechen", callback_data: "cancel" }]] } });
    return;
  }

  if (data.startsWith("kunde_")) {
    const kategorie = data.replace("kunde_", "");
    auftragData.kunde_kategorie = kategorie === "NEU" ? "NEUKUNDE" : "BESTANDSKUNDE";
    if (kategorie === "NEU") {
      const kundentypen = await getOptionen("kundentyp");
      auftragData.step = "kundentyp_option";
      await setSession(chatId, user.id, user.username, "auftrag_kundentyp", { auftrag_data: auftragData });
      const buttons = kundentypen.map((typ, i) => [{ text: typ, callback_data: `ktyp_${i}` }]);
      buttons.push([{ text: "Abbrechen", callback_data: "cancel" }]);
      await sendMessage(chatId, `Um welche Kundenart handelt es sich?`, { reply_markup: { inline_keyboard: buttons } });
    } else {
      auftragData.step = "suche_kunde";
      await setSession(chatId, user.id, user.username, "auftrag_suche", { auftrag_data: auftragData });
      await sendMessage(chatId, `Bitte gib einen Suchbegriff ein (Name, Adresse oder Telefon).\n\n<i>Tipp: Mehrere Woerter eingeben fuer bessere Treffer, z.B. "Kraus Ammersricht"</i>`);
    }
    return;
  }

  if (data.startsWith("ktyp_")) {
    const kundentypen = await getOptionen("kundentyp");
    const idx = parseInt(data.replace("ktyp_", ""));
    auftragData.kundentyp_option = kundentypen[idx];
    auftragData.step = "name";
    await setSession(chatId, user.id, user.username, "auftrag_name", { auftrag_data: auftragData });
    await sendMessage(chatId, `Bitte gib den <b>Namen</b> des Kunden ein:`);
    return;
  }

  if (data.startsWith("erp_")) {
    const erpCode = parseInt(data.replace("erp_", ""));
    auftragData.erp_kunde_id = erpCode;
    auftragData.step = "beschreibung";
    await setSession(chatId, user.id, user.username, "auftrag_beschreibung", { auftrag_data: auftragData });
    await sendMessage(chatId, `Kunde ausgewaehlt.\n\nBitte beschreibe den <b>Auftrag</b> (was soll gemacht werden?).\n\n<i>Du kannst einen Text tippen oder eine Sprachnachricht senden.</i>`);
    return;
  }
}

async function handleAuftragTextInput(chatId: number, user: TelegramUser, text: string, session: SessionState): Promise<void> {
  const auftragData = session.auftrag_data || { step: "" };

  switch (session.state) {
    case "auftrag_suche": {
      const kunden = await searchKundenFuzzy(text);
      if (kunden.length === 0) {
        await sendMessage(chatId, `Keine Kunden gefunden fuer "${text}".\n\nBitte erneut versuchen oder /abbrechen eingeben.\n\n<i>Tipp: Verwende mehrere Suchbegriffe, z.B. "Kraus Ammersricht"</i>`);
        return;
      }
      const buttons = kunden.map(k => {
        const label = `${k.firma1 || k.name || ''} ${k.firma2 || ''} | ${k.ort || ''}`.trim().substring(0, 60);
        const matchInfo = k.match_count ? ` (${k.match_count} Treffer)` : '';
        return [{
          text: (label + matchInfo).substring(0, 64),
          callback_data: `erp_${k.code}`
        }];
      });
      buttons.push([{ text: "Abbrechen", callback_data: "cancel" }]);
      await sendMessage(chatId, `${kunden.length} Treffer fuer "${text}":`, { reply_markup: { inline_keyboard: buttons } });
      break;
    }

    case "auftrag_name":
      auftragData.name = text;
      auftragData.step = "telefon";
      await setSession(chatId, user.id, user.username, "auftrag_telefon", { auftrag_data: auftragData });
      await sendMessage(chatId, `Name: <b>${text}</b>\n\nBitte gib die <b>Telefonnummer</b> ein:`);
      break;

    case "auftrag_telefon":
      auftragData.telefon = text;
      auftragData.step = "adresse";
      await setSession(chatId, user.id, user.username, "auftrag_adresse", { auftrag_data: auftragData });
      await sendMessage(chatId, `Telefon: <b>${text}</b>\n\nBitte gib die <b>Adresse</b> ein (Strasse, PLZ Ort):`);
      break;

    case "auftrag_adresse":
      auftragData.adresse = text;
      auftragData.step = "beschreibung";
      await setSession(chatId, user.id, user.username, "auftrag_beschreibung", { auftrag_data: auftragData });
      await sendMessage(chatId, `Adresse: <b>${text}</b>\n\nBitte beschreibe den <b>Auftrag</b>.\n\n<i>Du kannst einen Text tippen oder eine Sprachnachricht senden.</i>`);
      break;

    case "auftrag_beschreibung":
      await finishAuftrag(chatId, user, auftragData, text);
      break;
  }
}

async function finishAuftrag(chatId: number, user: TelegramUser, auftragData: AuftragDraft, beschreibung: string): Promise<void> {
  auftragData.beschreibung = beschreibung;

  const insertData: Record<string, unknown> = {
    status: "OFFEN",
    kunde_kategorie: auftragData.kunde_kategorie,
    prioritaet: "NORMAL",
    beschreibung: auftragData.beschreibung,
    auftragstyp: auftragData.auftragstyp || "Reparaturauftrag",
    kundentyp_option: auftragData.kundentyp_option || "Privat",
    erstellt_via: "telegram",
    telegram_chat_id: chatId
  };

  if (auftragData.kunde_kategorie === "NEUKUNDE") {
    insertData.neukunde_name = auftragData.name;
    insertData.neukunde_telefon = auftragData.telefon;
    insertData.adresse_strasse = auftragData.adresse;
  } else {
    insertData.erp_kunde_id = auftragData.erp_kunde_id;
  }

  const { data: newAuftrag, error } = await supabase.from("auftraege").insert(insertData).select("id, auftragsnummer").single();

  if (error) {
    console.error("Auftrag insert error:", error);
    await sendWithMenu(chatId, `Fehler beim Anlegen: ${error.message}`);
  } else {
    const kundeLabel = auftragData.kunde_kategorie === "NEUKUNDE" ? auftragData.name : "Bestandskunde";
    await sendWithMenu(chatId,
      `<b>Auftrag erfolgreich angelegt!</b>\n\n` +
      `Auftragsnummer: <b>${newAuftrag.auftragsnummer}</b>\n` +
      `Typ: ${auftragData.auftragstyp}\n` +
      `Kunde: ${kundeLabel}\n` +
      `Beschreibung: ${(auftragData.beschreibung || '').substring(0, 80)}${(auftragData.beschreibung || '').length > 80 ? '...' : ''}\n\n` +
      `Der Auftrag erscheint jetzt im Dashboard.`
    );
  }

  await setSession(chatId, user.id, user.username, "idle");
}

// ============ Kunde Creation Flow ============

async function startNeuerKunde(chatId: number, user?: TelegramUser): Promise<void> {
  const kundentypen = await getOptionen("kundentyp");
  await setSession(chatId, user?.id, user?.username, "kunde_typ", { kunde_data: { step: "typ" } });
  const buttons = kundentypen.map((typ, i) => [{ text: typ, callback_data: `nktyp_${i}` }]);
  buttons.push([{ text: "Abbrechen", callback_data: "cancel_kunde" }]);
  await sendMessage(chatId, `<b>Neuer Kunde anlegen</b>\n\nUm welche Art von Kunde handelt es sich?`, { reply_markup: { inline_keyboard: buttons } });
}

async function handleKundeCallback(chatId: number, user: TelegramUser, data: string, session: SessionState): Promise<void> {
  const kundeData = session.kunde_data || { step: "" };

  if (data === "cancel_kunde") {
    await setSession(chatId, user.id, user.username, "idle");
    await sendWithMenu(chatId, "Kundenanlage abgebrochen. Was moechtest du tun?");
    return;
  }

  if (data.startsWith("nktyp_")) {
    const kundentypen = await getOptionen("kundentyp");
    const idx = parseInt(data.replace("nktyp_", ""));
    kundeData.kundentyp = kundentypen[idx];
    kundeData.step = "name";
    await setSession(chatId, user.id, user.username, "kunde_name", { kunde_data: kundeData });
    if (kundeData.kundentyp === "Gewerbe" || kundeData.kundentyp === "Oeffentlich") {
      await sendMessage(chatId, `Kundentyp: <b>${kundeData.kundentyp}</b>\n\nBitte gib den <b>Firmennamen</b> ein:`);
    } else {
      await sendMessage(chatId, `Kundentyp: <b>${kundeData.kundentyp}</b>\n\nBitte gib <b>Vorname Nachname</b> ein:`);
    }
    return;
  }

  if (data === "kunde_save") {
    const insertData: Record<string, unknown> = { kundentyp: kundeData.kundentyp || "Privat", telefon: kundeData.telefon, email: kundeData.email, strasse: kundeData.strasse, plz: kundeData.plz, ort: kundeData.ort, erstellt_via: "telegram", telegram_chat_id: chatId };
    if (kundeData.kundentyp === "Gewerbe" || kundeData.kundentyp === "Oeffentlich") { insertData.firma = kundeData.firma; } else { insertData.vorname = kundeData.vorname; insertData.name = kundeData.name; }
    const { data: newKunde, error } = await supabase.from("manuelle_kunden").insert(insertData).select("id").single();
    if (error) { await sendWithMenu(chatId, `Fehler beim Anlegen: ${error.message}`); } else {
      const displayName = kundeData.firma || `${kundeData.vorname || ""} ${kundeData.name || ""}`.trim();
      await sendWithMenu(chatId, `<b>Kunde erfolgreich angelegt!</b>\n\nName: ${displayName}\nTyp: ${kundeData.kundentyp}\nTelefon: ${kundeData.telefon || "-"}\nAdresse: ${kundeData.strasse || "-"}, ${kundeData.plz || ""} ${kundeData.ort || ""}\n\nDer Kunde kann jetzt fuer Auftraege verwendet werden.`);
    }
    await setSession(chatId, user.id, user.username, "idle");
    return;
  }

  if (data === "kunde_edit") { await startNeuerKunde(chatId, user); return; }
}

async function handleKundeTextInput(chatId: number, user: TelegramUser, text: string, session: SessionState): Promise<void> {
  const kundeData = session.kunde_data || { step: "" };

  switch (session.state) {
    case "kunde_name":
      if (kundeData.kundentyp === "Gewerbe" || kundeData.kundentyp === "Oeffentlich") { kundeData.firma = text; } else {
        const parts = text.trim().split(/\s+/);
        if (parts.length >= 2) { kundeData.vorname = parts[0]; kundeData.name = parts.slice(1).join(" "); } else { kundeData.name = text; }
      }
      kundeData.step = "telefon";
      await setSession(chatId, user.id, user.username, "kunde_telefon", { kunde_data: kundeData });
      await sendMessage(chatId, `Name: <b>${text}</b>\n\nBitte gib die <b>Telefonnummer</b> ein:`);
      break;

    case "kunde_telefon":
      kundeData.telefon = text;
      kundeData.step = "email";
      await setSession(chatId, user.id, user.username, "kunde_email", { kunde_data: kundeData });
      await sendMessage(chatId, `Telefon: <b>${text}</b>\n\nBitte gib die <b>E-Mail</b> ein (oder /skip zum Ueberspringen):`);
      break;

    case "kunde_email":
      if (!text.startsWith("/")) kundeData.email = text;
      kundeData.step = "strasse";
      await setSession(chatId, user.id, user.username, "kunde_strasse", { kunde_data: kundeData });
      await sendMessage(chatId, `E-Mail: <b>${kundeData.email || "-"}</b>\n\nBitte gib die <b>Strasse</b> ein:`);
      break;

    case "kunde_strasse":
      kundeData.strasse = text;
      kundeData.step = "plz";
      await setSession(chatId, user.id, user.username, "kunde_plz", { kunde_data: kundeData });
      await sendMessage(chatId, `Strasse: <b>${text}</b>\n\nBitte gib die <b>PLZ</b> ein:`);
      break;

    case "kunde_plz":
      kundeData.plz = text;
      kundeData.step = "ort";
      await setSession(chatId, user.id, user.username, "kunde_ort", { kunde_data: kundeData });
      await sendMessage(chatId, `PLZ: <b>${text}</b>\n\nBitte gib den <b>Ort</b> ein:`);
      break;

    case "kunde_ort":
      kundeData.ort = text;
      kundeData.step = "confirm";
      await setSession(chatId, user.id, user.username, "kunde_confirm", { kunde_data: kundeData });
      const displayName = kundeData.firma || `${kundeData.vorname || ""} ${kundeData.name || ""}`.trim();
      await sendMessage(chatId, `<b>Zusammenfassung:</b>\n\nTyp: ${kundeData.kundentyp}\nName: ${displayName}\nTelefon: ${kundeData.telefon || "-"}\nE-Mail: ${kundeData.email || "-"}\nAdresse: ${kundeData.strasse}, ${kundeData.plz} ${kundeData.ort}\n\nStimmt das so?`, { reply_markup: { inline_keyboard: [[{ text: "Speichern", callback_data: "kunde_save" }], [{ text: "Nochmal eingeben", callback_data: "kunde_edit" }], [{ text: "Abbrechen", callback_data: "cancel_kunde" }]] } });
      break;
  }
}

// ============ Voice Message Handling ============

async function handleVoice(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const voice = message.voice!;
  const session = await getSession(chatId);

  if (session.state === "auftrag_beschreibung" && session.auftrag_data) {
    await sendMessage(chatId, "Sprachnachricht wird transkribiert...");
    const fileInfo = await getFile(voice.file_id);
    if (!fileInfo) { await sendMessage(chatId, "Fehler: Konnte Sprachnachricht nicht abrufen. Bitte nochmal versuchen oder Text tippen."); return; }
    const audioData = await downloadFile(fileInfo.file_path);
    if (!audioData) { await sendMessage(chatId, "Fehler: Download fehlgeschlagen. Bitte Text tippen."); return; }
    const transcript = await transcribeVoice(audioData);
    if (!transcript) { await sendMessage(chatId, "Fehler bei der Transkription. Bitte den Auftrag als Text eingeben."); return; }
    await sendMessage(chatId, `<b>Transkription:</b>\n<i>${transcript}</i>`);
    await finishAuftrag(chatId, message.from!, session.auftrag_data, transcript);
    return;
  }

  await sendMessage(chatId, "Sprachnachricht erkannt... wird transkribiert...");
  const fileInfo = await getFile(voice.file_id);
  if (!fileInfo) { await sendMessage(chatId, "Fehler: Konnte Sprachnachricht nicht abrufen."); return; }
  const audioData = await downloadFile(fileInfo.file_path);
  if (!audioData) { await sendMessage(chatId, "Fehler: Download fehlgeschlagen."); return; }
  const transcript = await transcribeVoice(audioData);
  if (!transcript) { await sendMessage(chatId, "Fehler bei der Transkription. Bitte erneut versuchen."); return; }
  await sendWithMenu(chatId, `<b>Transkription:</b>\n<i>${transcript}</i>\n\nUm einen Auftrag anzulegen, druecke <b>Neuer Auftrag</b>.`);
}

// ============ Photo Handling ============

async function handlePhoto(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const photos = message.photo!;
  const largestPhoto = photos[photos.length - 1];
  const fileInfo = await getFile(largestPhoto.file_id);
  if (!fileInfo) { await sendMessage(chatId, "Fehler: Konnte Foto nicht abrufen."); return; }
  const fileData = await downloadFile(fileInfo.file_path);
  if (!fileData) { await sendMessage(chatId, "Fehler: Download fehlgeschlagen."); return; }
  const timestamp = Date.now();
  const extension = fileInfo.file_path.split(".").pop() || "jpg";
  const storagePath = `${chatId}/${timestamp}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("monteur-fotos").upload(storagePath, fileData, { contentType: `image/${extension}` });
  if (uploadError) { await sendMessage(chatId, "Fehler beim Speichern."); return; }
  const { data: fotoRecord } = await supabase.from("telegram_fotos").insert({ telegram_chat_id: chatId, telegram_user_id: message.from?.id, telegram_username: message.from?.username, telegram_file_id: largestPhoto.file_id, telegram_file_unique_id: largestPhoto.file_unique_id, storage_path: storagePath, file_size: fileInfo.file_size, width: largestPhoto.width, height: largestPhoto.height, beschreibung: message.caption || null }).select("id").single();
  if (!fotoRecord) { await sendMessage(chatId, "Fehler beim Speichern."); return; }
  await setSession(chatId, message.from?.id, message.from?.username, "awaiting_address", { pending_foto_id: fotoRecord.id });
  await sendMessage(chatId, `Foto gespeichert (${largestPhoto.width}x${largestPhoto.height})\n\nBitte gib die <b>Adresse</b> ein oder /skip zum Ueberspringen.`);
}

// ============ Command Handlers ============

async function handleStart(chatId: number, user?: TelegramUser): Promise<void> {
  await setSession(chatId, user?.id, user?.username, "idle");
  await sendWithMenu(chatId,
    `<b>JS Fenster Bot v3.3</b>\n\n` +
    `Hallo${user?.first_name ? " " + user.first_name : ""}!\n\n` +
    `Nutze die Buttons unten oder diese Befehle:\n\n` +
    `<b>Neuer Auftrag</b> - Auftrag anlegen\n` +
    `<b>Neuer Kunde</b> - Kunde anlegen\n` +
    `<b>Hilfe</b> - Hilfe anzeigen\n\n` +
    `Du kannst auch Fotos oder Sprachnachrichten senden.`
  );
}

async function handleHelp(chatId: number): Promise<void> {
  await sendWithMenu(chatId,
    `<b>Hilfe</b>\n\n` +
    `<b>Neuer Auftrag</b>\nSchritt-fuer-Schritt Auftrag anlegen\n\n` +
    `<b>Neuer Kunde</b>\nNeuen Kunden erfassen\n\n` +
    `<b>Foto senden</b>\nWird gespeichert + Adresse zuordnen\n\n` +
    `<b>Sprachnachricht</b>\nWird transkribiert (auch im Auftragsformular nutzbar)\n\n` +
    `/abbrechen - Aktuelle Eingabe abbrechen\n` +
    `/skip - Optionales Feld ueberspringen`
  );
}

async function handleAbbrechen(chatId: number, user?: TelegramUser): Promise<void> {
  await setSession(chatId, user?.id, user?.username, "idle");
  await sendWithMenu(chatId, "Abgebrochen. Was moechtest du tun?");
}

async function handleSkip(chatId: number, user?: TelegramUser): Promise<void> {
  const session = await getSession(chatId);
  if (session.state === "awaiting_address" && session.pending_foto_id) {
    await setSession(chatId, user?.id, user?.username, "idle");
    await sendWithMenu(chatId, "Adresse uebersprungen. Foto gespeichert.");
    return;
  }
  if (session.state === "kunde_email") {
    const kundeData = session.kunde_data || { step: "" };
    kundeData.step = "strasse";
    await setSession(chatId, user?.id, user?.username, "kunde_strasse", { kunde_data: kundeData });
    await sendMessage(chatId, `E-Mail: <b>-</b>\n\nBitte gib die <b>Strasse</b> ein:`);
    return;
  }
  await sendMessage(chatId, "Nichts zum Ueberspringen.");
}

// ============ Main Handler ============

async function handleMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  const session = await getSession(chatId);

  if (message.voice) { await handleVoice(message); return; }
  if (message.photo && message.photo.length > 0) { await handlePhoto(message); return; }

  if (text === "Neuer Auftrag") { await startNeuerAuftrag(chatId, message.from); return; }
  if (text === "Neuer Kunde") { await startNeuerKunde(chatId, message.from); return; }
  if (text === "Hilfe") { await handleHelp(chatId); return; }

  if (text.startsWith("/start")) { await handleStart(chatId, message.from); return; }
  if (text.startsWith("/hilfe") || text.startsWith("/help")) { await handleHelp(chatId); return; }
  if (text.startsWith("/neuerAuftrag") || text.startsWith("/neuerauftrag")) { await startNeuerAuftrag(chatId, message.from); return; }
  if (text.startsWith("/neuerKunde") || text.startsWith("/neuerkunde")) { await startNeuerKunde(chatId, message.from); return; }
  if (text.startsWith("/abbrechen") || text.startsWith("/cancel")) { await handleAbbrechen(chatId, message.from); return; }
  if (text.startsWith("/skip")) { await handleSkip(chatId, message.from); return; }

  if (session.state.startsWith("auftrag_")) { await handleAuftragTextInput(chatId, message.from!, text, session); return; }
  if (session.state.startsWith("kunde_") && session.state !== "kunde_confirm") { await handleKundeTextInput(chatId, message.from!, text, session); return; }

  if (session.state === "awaiting_address") {
    if (session.pending_foto_id) {
      await supabase.from("telegram_fotos").update({ adresse: text }).eq("id", session.pending_foto_id);
      await setSession(chatId, message.from?.id, message.from?.username, "idle");
      await sendWithMenu(chatId, `Adresse gespeichert: <b>${text}</b>`);
    }
    return;
  }

  await sendWithMenu(chatId, `Ich habe das nicht verstanden. Nutze die Buttons unten oder sende ein Foto/Sprachnachricht.`);
}

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const data = query.data || "";
  const session = await getSession(chatId);
  await answerCallbackQuery(query.id);

  if (session.state.startsWith("auftrag_") || data.startsWith("atyp_") || data.startsWith("kunde_") || data.startsWith("ktyp_") || data.startsWith("erp_") || data === "cancel") {
    await handleAuftragCallback(chatId, query.from, data, session);
    return;
  }
  if (session.state.startsWith("kunde_") || data.startsWith("nktyp_") || data === "kunde_save" || data === "kunde_edit" || data === "cancel_kunde") {
    await handleKundeCallback(chatId, query.from, data, session);
    return;
  }
}

// ============ Webhook Handler ============

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get("health") === "1") {
    return new Response(JSON.stringify({ ok: true, version: "3.3.0", features: ["persistent_keyboard", "score_based_search", "voice_description", "auftragsnummer"] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  if (!TELEGRAM_BOT_TOKEN) return new Response(JSON.stringify({ error: "Bot not configured" }), { status: 500 });
  try {
    const update: TelegramUpdate = await req.json();
    console.log("Update:", update.update_id);
    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallbackQuery(update.callback_query);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
