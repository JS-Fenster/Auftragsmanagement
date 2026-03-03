# G-033: Globale Duplikat-Erkennung fuer Email-Anhaenge

**Status:** Code vorbereitet, NICHT deployed
**Datum:** 2026-03-03
**Betrifft:** `process-email/index.ts` (aktuell v4.1.0, Version 45)

---

## 1. Analyse: Aktueller Zustand

### Wo werden Anhaenge verarbeitet?
- **Funktion `processAttachment()`** (Zeile 651-809): Hauptlogik fuer einzelne Anhaenge
- **Main Handler** (Zeile 1136-1177): Iteriert ueber alle Attachments einer Email

### Wo wird file_hash berechnet?
- **Funktion `calculateSHA256()`** (Zeile 815-819): Berechnet SHA-256 Hash
- **Aufgerufen in `processAttachment()`** (Zeile 714): `const hash = await calculateSHA256(binaryContent);`

### Wo wird das Dokument in die DB geschrieben?
- **Funktion `createAttachmentDocument()`** (Zeile 595-649): POST an `/rest/v1/documents`
- **Aufgerufen in `processAttachment()`** (Zeile 718-727): Nach Upload + Hash-Berechnung

### Aktueller Duplikat-Check
- **KEINER global!** Es gibt keinen Duplikat-Check gegen die DB.
- `email_attachment_hashes` (Zeile 916, 1192) sammelt nur die Hashes fuer Logging/Metadaten.
- Intra-Email-Duplikate kommen nicht vor (verifiziert per SQL-Abfrage).
- **Problem:** Dasselbe Attachment (z.B. AGB.pdf) wird bei jeder Email neu angelegt.

---

## 2. Duplikat-Statistik (Stand 2026-03-03)

| Metrik | Wert |
|--------|------|
| **Unique Hashes mit Duplikaten** | 22 |
| **Gesamte Duplikat-Dokumente** | 62 (22 Originale + 40 Kopien) |
| **Vermeidbare Kopien** | 40 |
| **Schlimmstes Duplikat** | 12x (AGB.pdf, Hash `b6b875c...`) |

### Nach Source aufgeschluesselt:
| Source | Duplikat-Docs | Unique Hashes |
|--------|--------------|---------------|
| email_attachment | 59 | 21 |
| scanner | 3 | 2 |

### Top-Duplikate:
| Hash (kurz) | Anzahl | Typisches Dokument |
|--------------|--------|--------------------|
| `b6b875c1...` | 12x | Allgemeine Geschaeftsbedingungen.pdf |
| `6d7d9bbd...` | 4x | (Email-Anhang) |
| `19a2cf06...` | 4x | (Email-Anhang) |
| `3027beea...` | 4x | (Email-Anhang) |
| Diverse | je 2-3x | (Email-Anhaenge) |

---

## 3. file_hash Index

**Index existiert bereits:**
```sql
CREATE INDEX idx_documents_file_hash ON public.documents USING btree (file_hash) WHERE (file_hash IS NOT NULL)
```
Kein Handlungsbedarf - der Index ist vorhanden und optimal (partiell, nur NOT NULL).

---

## 4. Code-Aenderungen

### 4.1 Neue Funktion: `checkGlobalDuplicate()` (nach Zeile 901 einfuegen)

```typescript
// =============================================================================
// v4.2: Global Duplicate Detection (G-033)
// =============================================================================

interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalDoc?: {
    id: string;
    kategorie: string;
    dokument_url: string;
    created_at: string;
  };
}

async function checkGlobalDuplicate(fileHash: string): Promise<DuplicateCheckResult> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/documents?file_hash=eq.${fileHash}&select=id,kategorie,dokument_url,created_at&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY!,
        },
      }
    );

    if (!response.ok) {
      console.error(`[DEDUP] DB query failed: ${response.status}`);
      return { isDuplicate: false }; // Bei Fehler: NICHT blockieren, normal weitermachen
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return { isDuplicate: true, originalDoc: data[0] };
    }
    return { isDuplicate: false };
  } catch (error) {
    console.error(`[DEDUP] Error checking duplicate: ${error}`);
    return { isDuplicate: false }; // Fail-open: Bei Fehler normal weitermachen
  }
}
```

### 4.2 Aenderung in `processAttachment()` (Zeile 714, NACH Hash-Berechnung, VOR createAttachmentDocument)

**Aktuell (Zeile 713-727):**
```typescript
  // v3.1: Calculate hash first (needed for document creation)
  const hash = await calculateSHA256(binaryContent);
  console.log(`[ATTACH]   hash: ${hash.substring(0, 16)}...`);

  // v3.1: Create document row for this attachment
  const attachmentDocId = await createAttachmentDocument(
    documentId,
    safeFileName,
    attachment.name,
    attachment.size,
    attachment.contentType,
    storagePath,
    hash,
    emailBetreff
  );
```

**Neu:**
```typescript
  // v3.1: Calculate hash first (needed for document creation)
  const hash = await calculateSHA256(binaryContent);
  console.log(`[ATTACH]   hash: ${hash.substring(0, 16)}...`);

  // v4.2 G-033: Global Duplicate Check BEFORE creating document
  const dupCheck = await checkGlobalDuplicate(hash);
  if (dupCheck.isDuplicate) {
    console.log(`[DEDUP] Duplikat erkannt! Anhang "${attachment.name}" hat gleichen Hash wie Dokument ${dupCheck.originalDoc!.id}`);
    console.log(`[DEDUP]   Original: kategorie=${dupCheck.originalDoc!.kategorie}, erstellt=${dupCheck.originalDoc!.created_at}`);
    console.log(`[DEDUP]   Ueberspringe Anlage eines neuen Dokuments.`);

    // Storage-Datei wieder loeschen (wurde bereits hochgeladen)
    const { error: deleteError } = await supabase.storage
      .from("documents")
      .remove([storagePath]);
    if (deleteError) {
      console.warn(`[DEDUP] Storage cleanup failed: ${deleteError.message}`);
    } else {
      console.log(`[DEDUP] Storage-Datei ${storagePath} geloescht (Duplikat)`);
    }

    // Return mit Original-Referenz (damit email_anhaenge_meta das Original referenziert)
    return {
      hash,
      attachmentDocId: dupCheck.originalDoc!.id,  // Referenz auf Original
      fileName: attachment.name,
      fileSize: attachment.size,
      contentType: attachment.contentType,
      storagePath: dupCheck.originalDoc!.dokument_url || storagePath,  // Original-Pfad
    } as AttachmentResult;
  }

  // v3.1: Create document row for this attachment (kein Duplikat)
  const attachmentDocId = await createAttachmentDocument(
    documentId,
    safeFileName,
    attachment.name,
    attachment.size,
    attachment.contentType,
    storagePath,
    hash,
    emailBetreff
  );
```

### 4.3 Aenderung: process-document Call ueberspringen bei Duplikat

Die Duplikat-Erkennung gibt das Original-`attachmentDocId` zurueck. Da das Original bereits verarbeitet ist (Kategorie steht fest), wird der `processAttachment()`-Aufruf mit einem fertigen `AttachmentResult` beendet. Der process-document Call (Zeile 745-796) wird nur ausgefuehrt wenn `attachmentDocId` von `createAttachmentDocument` kommt - bei Duplikaten ist das Original bereits kategorisiert. **Kein Code-Eingriff noetig** in der process-document-Aufruf-Logik, da die Funktion vorher returnt.

### 4.4 Version-Header aktualisieren

Zeile 1-3 aendern:
```typescript
// Process Email - GPT Categorization + Attachment Handling
// Version: 4.2.0 - 2026-03-03
```

Zeile 1017:
```typescript
        version: "4.2.0",
```

Zeile 1026-1028:
```typescript
        features: {
          gptReasoningEffort: "medium",
          attachmentUpdateMode: true,
          globalDuplicateDetection: true,  // v4.2 G-033
        },
```

---

## 5. Design-Entscheidungen

### Warum kein `document_duplicates` Tabelle?
- Die 40 existierenden Duplikate sind ueberschaubar
- Der Log-Eintrag (`[DEDUP]`) ist fuer Debugging ausreichend
- `email_anhaenge_meta` referenziert das Original-Dokument (Beziehung ist dokumentiert)
- Falls spaeter gewuenscht, kann die Tabelle nachtraeglich angelegt werden

### Fail-Open Strategie
- Bei DB-Fehlern im Duplikat-Check wird das Dokument NORMAL angelegt
- Lieber ein Duplikat als ein fehlendes Dokument
- Konsistent mit dem bisherigen Verhalten der Edge Function

### Storage Cleanup
- Bei erkanntem Duplikat wird die bereits hochgeladene Storage-Datei wieder geloescht
- Spart Speicherplatz (bei AGB.pdf: 11 ueberfluessige Kopien)
- Falls Storage-Loesch fehlschlaegt: nur Warning, kein Fehler

### Rueckgabe bei Duplikat
- `attachmentDocId` zeigt auf das ORIGINAL-Dokument
- `email_anhaenge_meta` der neuen Email referenziert damit korrekt das Original
- `email_attachment_hashes` enthaelt den Hash (unveraendert)
- Die Email "weiss" also trotzdem von ihrem Anhang, nur ohne Kopie

---

## 6. Deploy-Checkliste

1. **Code-Aenderungen in `index.ts`:**
   - [ ] Neue Funktion `checkGlobalDuplicate()` nach Zeile 901
   - [ ] Duplikat-Check in `processAttachment()` nach Hash-Berechnung (Zeile 714)
   - [ ] Version auf 4.2.0 aktualisieren (Zeile 3, 1017, 1026-1028)

2. **DB-Aenderungen:**
   - [x] `idx_documents_file_hash` Index - EXISTIERT BEREITS

3. **Test-Szenario:**
   - Email mit bekanntem Anhang (AGB.pdf) nochmal verarbeiten
   - Pruefen: Kein neues Dokument angelegt, Log zeigt `[DEDUP]`
   - Pruefen: `email_anhaenge_meta` der neuen Email referenziert Original-Dokument
   - Pruefen: Keine Storage-Datei fuer das Duplikat

4. **Risiken:**
   - GERING: Fail-open Strategie, bei Fehler normales Verhalten
   - BEACHTEN: Bereits existierende 40 Duplikate werden NICHT nachtraeglich bereinigt
   - BEACHTEN: Storage-Cleanup koennte fehlschlagen (nur Warning)

5. **NICHT deployen ohne Freigabe von Andreas!**
