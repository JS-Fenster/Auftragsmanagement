# G-044 (HEIC->JPEG) + G-045 (Upload-Filter) - Aenderungen fuer process-document

**Status:** Vorbereitet, NICHT deployed
**Datum:** 2026-03-03
**Betrifft:** `process-document` (aktuell v37 / Deploy 62)
**Geschuetzt:** Ja - Deploy NUR mit expliziter Freigabe von Andreas

---

## Uebersicht

| Feature | Beschreibung | Dateien |
|---------|-------------|---------|
| G-045 | Upload-Filter: Extension + Mindestgroesse vor Verarbeitung | `index.ts`, `utils.ts` |
| G-044 | HEIC/HEIF-Unterstuetzung: Mistral-OCR-Versuch + Fallback | `index.ts`, `utils.ts`, `extraction.ts` |

---

## Gewaehlter Ansatz fuer G-044 (HEIC)

**Recherche-Ergebnis:**
- GPT Vision API (OpenAI) unterstuetzt HEIC **NICHT** (nur JPEG, PNG, GIF, WEBP)
- Mistral OCR listet "and more..." - HEIC **moeglicherweise** unterstuetzt (LibreChat-Integration listet es)
- WASM-basierte Konvertierung (heic-convert, libheif) ist fuer Supabase Edge Functions zu riskant (Memory-Limits, Cold Start)

**Pragmatischer Ansatz (3-stufig):**
1. HEIC/HEIF in erlaubte Extensions aufnehmen
2. Mistral OCR damit fuettern (als `image/heic` / `image/heif`) - koennte funktionieren
3. Falls Mistral fehlschlaegt: Als "Bild" kategorisieren mit Hinweis statt Fehler

**Vorteile:**
- Kein externer Service, keine WASM-Dependency
- Zero-Risk: Wenn Mistral HEIC kann = volle Pipeline; wenn nicht = sauberer Fallback
- Kann spaeter um echte Konvertierung erweitert werden

---

## Aenderung 1: utils.ts - Extensions + HEIC MimeType + Upload-Validierung

### 1a: OCR_SUPPORTED_EXTENSIONS erweitern (Zeile 7)

**Alt:**
```typescript
export const OCR_SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"];
```

**Neu:**
```typescript
export const OCR_SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp", "heic", "heif"];
```

### 1b: getMimeType() erweitern (Zeile 15-41) - HEIC/HEIF MimeTypes

In der `mimeTypes` Record (Zeile 17-39) **hinzufuegen:**
```typescript
    heic: "image/heic",
    heif: "image/heif",
```

### 1c: NEUE Funktion validateUpload() (nach getMediaCategory, ca. Zeile 116)

```typescript
// =============================================================================
// G-045: Upload-Filter - Extension + Mindestgroesse Validierung
// =============================================================================

/**
 * Erlaubte Datei-Extensions fuer den Upload
 * Umfasst OCR-faehige, Office- und Medien-Formate
 */
const ALLOWED_EXTENSIONS = [
  // OCR-faehig (Mistral)
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp",
  // HEIC/HEIF (G-044: Mistral-OCR-Versuch + Fallback)
  "heic", "heif",
  // Office (native Text-Extraktion)
  "docx", "xlsx", "xls",
  // Medien (werden als Media-Kategorie gespeichert)
  "mp4", "mov", "avi", "mkv", "webm",
  "mp3", "wav", "ogg", "m4a",
  "doc", "ppt", "pptx",
  "zip", "rar", "7z", "tar", "gz",
];

/**
 * Mindestgroesse in Bytes - darunter wahrscheinlich Icon/Thumbnail/QR-Code
 */
const MIN_FILE_SIZE_BYTES = 5 * 1024; // 5 KB

/**
 * Bild-Extensions fuer Mindestgroessen-Check
 * (nur Bilder werden auf Mindestgroesse geprueft, nicht PDFs/Office)
 */
const IMAGE_EXTENSIONS_FOR_SIZE_CHECK = [
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "heic", "heif",
];

export interface UploadValidationResult {
  valid: boolean;
  reason?: string;
  autoKategorie?: string; // Falls automatisch kategorisiert (z.B. Mini-Bild -> "Bild")
  skipProcessing?: boolean; // Falls true: Nicht durch OCR+GPT Pipeline schicken
}

/**
 * G-045: Validiert einen Upload VOR der Verarbeitung.
 *
 * Prueft:
 * 1. Extension erlaubt?
 * 2. Bild zu klein? (< 5KB -> auto-"Bild", kein GPT)
 *
 * @param fileName - Originaler Dateiname
 * @param fileSize - Dateigroesse in Bytes
 * @returns Validierungsergebnis
 */
export function validateUpload(fileName: string, fileSize: number): UploadValidationResult {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Check 1: Extension erlaubt?
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      reason: `Extension .${ext} nicht unterstuetzt. Erlaubt: ${ALLOWED_EXTENSIONS.join(", ")}`
    };
  }

  // Check 2: Bild zu klein? (Icons, QR-Codes, Thumbnails)
  if (IMAGE_EXTENSIONS_FOR_SIZE_CHECK.includes(ext) && fileSize < MIN_FILE_SIZE_BYTES) {
    return {
      valid: true,
      autoKategorie: "Bild",
      skipProcessing: true,
      reason: `Bild unter ${MIN_FILE_SIZE_BYTES / 1024} KB - automatisch als Bild kategorisiert`
    };
  }

  return { valid: true };
}
```

### 1d: detectFileType() erweitern (Zeile 65-104) - HEIC Magic Bytes

In der `detectFileType()` Funktion **vor dem `return { type: "unknown"...}`** (ca. Zeile 102) hinzufuegen:

```typescript
  // HEIC/HEIF: starts with ftyp at offset 4 (ISO Base Media File Format)
  // Bytes 4-7 should be "ftyp" (0x66 0x74 0x79 0x70)
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { type: "heic", isOfficeDoc: false };
  }
```

---

## Aenderung 2: extraction.ts - isImage() erweitern

### 2a: isImage() HEIC/HEIF hinzufuegen (Zeile 47-50)

**Alt:**
```typescript
export function isImage(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"].includes(ext);
}
```

**Neu:**
```typescript
export function isImage(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp", "heic", "heif"].includes(ext);
}
```

### 2b: extractTextWithMistral() - HEIC-spezifisches Error-Handling (Zeile 136-191)

Nach dem bestehenden `if (!response.ok)` Block (Zeile 179-182) wird nichts geaendert.
Aber die `isImage()` Funktion wird bereits genutzt (Zeile 152), und da wir sie erweitert haben,
werden HEIC/HEIF-Dateien automatisch als `image_url` an Mistral geschickt statt als `document_url`.

---

## Aenderung 3: index.ts - Upload-Filter + HEIC-Fallback in Pipeline

### 3a: Import erweitern (ca. Zeile 138-147)

**Alt:**
```typescript
import {
  OCR_SUPPORTED_EXTENSIONS,
  OFFICE_EXTENSIONS,
  getMimeType,
  isOcrSupported,
  isOfficeDocument,
  detectFileType,
  getMediaCategory,
  sanitizeFileName,
  createApiKeyValidator,
} from "./utils.ts";
```

**Neu:**
```typescript
import {
  OCR_SUPPORTED_EXTENSIONS,
  OFFICE_EXTENSIONS,
  getMimeType,
  isOcrSupported,
  isOfficeDocument,
  detectFileType,
  getMediaCategory,
  sanitizeFileName,
  createApiKeyValidator,
  validateUpload,
} from "./utils.ts";
```

### 3b: Upload-Filter VOR der Verarbeitung (nach Zeile 356, vor Zeile 358)

Nach dem `if (!file)` Check und VOR dem `const fileExt = file.name.split(...)...` Block einfuegen:

```typescript
    // ========================================================================
    // G-045: Upload-Filter - Extension + Mindestgroesse
    // ========================================================================
    const uploadValidation = validateUpload(file.name, file.size);

    if (!uploadValidation.valid) {
      console.log(`[UPLOAD-FILTER] Abgelehnt: ${file.name} - ${uploadValidation.reason}`);
      return new Response(JSON.stringify({
        error: uploadValidation.reason,
        rejected: true,
        fileName: file.name,
        fileSize: file.size,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // G-045: Mini-Bilder automatisch als "Bild" kategorisieren (kein OCR/GPT)
    if (uploadValidation.skipProcessing && uploadValidation.autoKategorie) {
      console.log(`[UPLOAD-FILTER] Auto-Kategorie: ${file.name} -> ${uploadValidation.autoKategorie} (${uploadValidation.reason})`);

      const autoFileBuffer = await file.arrayBuffer();
      const autoFileHash = await calculateHash(autoFileBuffer);
      const autoMimeType = getMimeType(file.name);

      // Upload to Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeFileName = sanitizeFileName(file.name);
      const storagePath = `${uploadValidation.autoKategorie}/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, autoFileBuffer, {
          contentType: autoMimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const now = new Date().toISOString();
      const { data: insertData, error: insertError } = await supabase
        .from("documents")
        .insert({
          kategorie: uploadValidation.autoKategorie,
          dokument_url: storagePath,
          ocr_text: null,
          extraktions_zeitstempel: now,
          extraktions_qualitaet: "keine",
          extraktions_hinweise: [
            uploadValidation.reason || "Auto-kategorisiert",
            `Original: ${file.name}`,
            `Groesse: ${(file.size / 1024).toFixed(1)} KB`,
          ],
          file_hash: autoFileHash,
          text_hash: null,
          bemerkungen: `Mini-Bild: ${file.name}`,
          source: "scanner",
          processing_status: "done",
          processed_at: now,
          kategorisiert_von: "upload-filter",
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        id: insertData.id,
        kategorie: uploadValidation.autoKategorie,
        dokument_url: storagePath,
        extraktions_qualitaet: "keine",
        file_hash: autoFileHash,
        message: uploadValidation.reason,
        kategorisiert_von: "upload-filter",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
```

### 3c: HEIC-Fallback in der Media-File Sektion (ca. Zeile 479-619)

Die bestehende Logik behandelt bereits den Fall "kein Text extrahiert -> als Media speichern".
Fuer HEIC/HEIF-Dateien die bei Mistral OCR fehlschlagen, wird automatisch der bestehende
Media-Fallback-Pfad genutzt. Die `getMediaCategory()` Funktion gibt allerdings "Sonstiges_Dokument"
zurueck fuer HEIC - das muss geaendert werden.

In `utils.ts`, Funktion `getMediaCategory()` (Zeile 109-116):

**Alt:**
```typescript
export function getMediaCategory(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "Video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "Audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "Office_Dokument";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archiv";
  return "Sonstiges_Dokument";
}
```

**Neu:**
```typescript
export function getMediaCategory(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "Video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "Audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "Office_Dokument";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archiv";
  if (["heic", "heif"].includes(ext)) return "Bild";  // G-044: HEIC als Bild wenn OCR fehlschlaegt
  return "Sonstiges_Dokument";
}
```

### 3d: Version-Header und Health-Endpoint aktualisieren

**Version-Header (Zeile 3):**
```typescript
// Version: 38 - 2026-03-03 (G-044 HEIC + G-045 Upload-Filter)
```

**Health-Endpoint (ca. Zeile 293):**
```typescript
        version: "38.0.0",
```

Und im `supportedFormats` Block (ca. Zeile 301):
```typescript
        supportedFormats: {
          ocr: OCR_SUPPORTED_EXTENSIONS,
          office: OFFICE_EXTENSIONS,
          heic: ["heic", "heif"],  // G-044: Versucht OCR, Fallback auf Bild
        },
```

Im `features` Block (ca. Zeile 311) hinzufuegen:
```typescript
          uploadFilter: true,  // G-045: Extension + Mindestgroesse Validierung
          heicSupport: "ocr-attempt-with-fallback",  // G-044: Mistral OCR Versuch, Bild-Fallback
```

### 3e: COMPRESSIBLE_EXTENSIONS erweitern (Zeile 185)

**Alt:**
```typescript
const COMPRESSIBLE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];
```

**Neu:**
```typescript
const COMPRESSIBLE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "heic", "heif"];
```

(Hat aktuell keinen Effekt da Compression disabled ist, aber fuer Zukunft vorbereitet)

---

## Aenderung 4: Versionskommentar fuer index.ts

Am Anfang der Datei (nach Zeile 3) den neuen Versionsblock einfuegen:

```typescript
// Aenderungen v38 (G-044 + G-045):
// - G-045: Upload-Filter VOR der Pipeline (Extension + Mindestgroesse)
//   - Unbekannte Extensions werden abgelehnt (HTTP 400)
//   - Bilder < 5KB werden automatisch als "Bild" kategorisiert (kein OCR/GPT)
// - G-044: HEIC/HEIF Unterstuetzung
//   - HEIC/HEIF in erlaubte Extensions aufgenommen
//   - Mistral OCR wird damit gefuettert (unterstuetzt moeglicherweise HEIC)
//   - Falls OCR fehlschlaegt: Sauberer Fallback auf Kategorie "Bild"
//   - Kein WASM-Konverter (zu riskant fuer Edge Functions Memory)
//   - detectFileType() erkennt HEIC Magic Bytes
```

---

## Deploy-Checkliste

1. [ ] Code-Aenderungen in `utils.ts` umsetzen (1a, 1b, 1c, 1d)
2. [ ] Code-Aenderungen in `extraction.ts` umsetzen (2a)
3. [ ] Code-Aenderungen in `index.ts` umsetzen (3a-3e, 4)
4. [ ] Lokal testen mit:
   - Normaler PDF-Upload (unveraendert funktionieren)
   - Kleine PNG < 5KB (sollte auto "Bild" werden)
   - Unbekannte Extension .xyz (sollte HTTP 400 zurueckgeben)
   - HEIC-Bild (Mistral-Versuch, bei Fehler -> "Bild")
5. [ ] Freigabe von Andreas einholen
6. [ ] Deploy via CLI: `supabase functions deploy process-document`
7. [ ] Health-Check: `GET /process-document` -> Version 38.0.0 pruefen
8. [ ] Monitoring: Erste HEIC-Uploads in Logs pruefen

## Risiko-Bewertung

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| HEIC bei Mistral schlaegt fehl | Niedrig | Sauberer Fallback auf "Bild" Kategorie |
| Upload-Filter blockiert legitime Dateien | Niedrig | Alle gaengigen Formate sind erlaubt |
| Mini-Bild-Filter zu aggressiv | Niedrig | 5KB ist sehr klein, echte Scans sind >50KB |
| Bestehende Pipeline bricht | Sehr niedrig | Neue Logik ist VOR der Pipeline, kein Eingriff in OCR/GPT |

## Betroffene Dateien

| Datei | Aenderungstyp |
|-------|--------------|
| `supabase/functions/process-document/index.ts` | Import erweitert, Upload-Filter Block, Version-Header |
| `supabase/functions/process-document/utils.ts` | Extensions, MimeTypes, detectFileType, getMediaCategory, validateUpload |
| `supabase/functions/process-document/extraction.ts` | isImage() erweitert |
