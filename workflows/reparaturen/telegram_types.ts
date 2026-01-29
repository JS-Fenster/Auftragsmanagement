/**
 * TypeScript Types fuer Telegram Bot API
 *
 * Autonome Entscheidungen (Nachtmodus):
 * - AD-007: Nur relevante Types fuer Reparatur-Workflow
 * - AD-008: Eine Datei fuer Einfachheit
 *
 * Basiert auf: https://core.telegram.org/bots/api
 * Version: Telegram Bot API 7.0+ (Stand 2026-01)
 */

// ═══════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Telegram User
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat
 */
export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram Photo Size
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram File (fuer Downloads)
 */
export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Telegram Message
 */
export interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;

  // Content types relevant fuer uns
  text?: string;
  photo?: TelegramPhotoSize[];
  caption?: string;

  // Reply info
  reply_to_message?: TelegramMessage;

  // Location (fuer Monteur-Standort)
  location?: TelegramLocation;

  // Contact (fuer Kunden-Verknuepfung)
  contact?: TelegramContact;
}

/**
 * Telegram Location
 */
export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
}

/**
 * Telegram Contact
 */
export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

// ═══════════════════════════════════════════════════════════════
// UPDATE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Telegram Update (Webhook Payload)
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Callback Query (Inline Button Click)
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

// ═══════════════════════════════════════════════════════════════
// KEYBOARD TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Inline Keyboard Button
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

/**
 * Inline Keyboard Markup
 */
export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * Reply Keyboard Button
 */
export interface TelegramKeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

/**
 * Reply Keyboard Markup
 */
export interface TelegramReplyKeyboardMarkup {
  keyboard: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

/**
 * Remove Keyboard
 */
export interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * sendMessage Request
 */
export interface SendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove;
  reply_to_message_id?: number;
}

/**
 * sendPhoto Request
 */
export interface SendPhotoRequest {
  chat_id: number | string;
  photo: string; // file_id oder URL
  caption?: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup;
}

/**
 * getFile Request
 */
export interface GetFileRequest {
  file_id: string;
}

/**
 * answerCallbackQuery Request
 */
export interface AnswerCallbackQueryRequest {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

/**
 * setWebhook Request
 */
export interface SetWebhookRequest {
  url: string;
  secret_token?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Generic API Response
 */
export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// ═══════════════════════════════════════════════════════════════
// DOMAIN-SPECIFIC TYPES (Reparatur-Workflow)
// ═══════════════════════════════════════════════════════════════

/**
 * Session State fuer Telegram Bot
 */
export type TelegramSessionState =
  | "idle"                    // Keine aktive Aktion
  | "awaiting_photo"          // Wartet auf Foto (Ersatzteil)
  | "awaiting_confirmation"   // Wartet auf Bestaetigung
  | "awaiting_input"          // Wartet auf Text-Eingabe
  | "processing";             // Verarbeitet gerade

/**
 * Bot Command Definition
 */
export interface BotCommand {
  command: string;        // Ohne /
  description: string;
  handler: string;        // Function name
}

/**
 * Vordefinierte Kommandos fuer unseren Bot
 */
export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Bot starten", handler: "handleStart" },
  { command: "help", description: "Hilfe anzeigen", handler: "handleHelp" },
  { command: "status", description: "Reparaturstatus abfragen", handler: "handleStatus" },
  { command: "foto", description: "Foto fuer Ersatzteil-ID hochladen", handler: "handleFoto" },
  { command: "standort", description: "Standort senden (Monteur)", handler: "handleStandort" },
];

/**
 * Telegram Session (korrespondiert mit DB-Tabelle)
 */
export interface TelegramSession {
  id: string;
  telegram_chat_id: number;
  telegram_user_id: number | null;
  telegram_username: string | null;
  erp_customer_id: number | null;
  document_id: string | null;
  state: TelegramSessionState;
  state_data: Record<string, unknown>;
  is_verified: boolean;
  is_monteur: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

// ═══════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Type Guard: Ist es eine Text-Nachricht?
 */
export function isTextMessage(msg: TelegramMessage): msg is TelegramMessage & { text: string } {
  return typeof msg.text === "string";
}

/**
 * Type Guard: Ist es eine Foto-Nachricht?
 */
export function isPhotoMessage(msg: TelegramMessage): msg is TelegramMessage & { photo: TelegramPhotoSize[] } {
  return Array.isArray(msg.photo) && msg.photo.length > 0;
}

/**
 * Type Guard: Ist es eine Location-Nachricht?
 */
export function isLocationMessage(msg: TelegramMessage): msg is TelegramMessage & { location: TelegramLocation } {
  return msg.location !== undefined;
}

/**
 * Holt das groesste Foto aus einer Foto-Nachricht
 */
export function getLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize {
  return photos.reduce((largest, current) =>
    (current.width * current.height) > (largest.width * largest.height) ? current : largest
  );
}
