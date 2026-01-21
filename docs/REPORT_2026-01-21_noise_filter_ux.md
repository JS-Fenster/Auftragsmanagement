# Report: Noise-Email Filter + UX Verbesserungen + Neue Kategorien
**Datum:** 2026-01-21
**Version:** email-webhook v3.11, admin-review v1.3.1, process-document v2.x, Review Tool v0.5.0

---

## Zusammenfassung

Dieses Update adressiert mehrere Anforderungen:

1. **A) Email Ingest Filter** - Noise-Emails (FRITZ!, Tracking) werden beim Ingest gedroppt
2. **B) Cleanup Script** - Bestehende Noise-Eintraege loeschen (DB-only)
3. **C) Single-Button UX** - Ein Button statt zwei (Bestaetigen/Korrigieren)
4. **D) Preview Fix** - Scan-Dokumente werden korrekt angezeigt
5. **E) Neue Dok-Kategorien** - Kundenanfrage, Aufmassblatt, Formular, Serviceauftrag

---

## A) Email Ingest Filter

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `migrations/20260121_email_ingest_filters.sql` | DB Schema + Seed Data |
| (geaendert) `functions/email-webhook/index.ts` | Filter-Integration v3.11 |

### DB Schema

```sql
-- Konfigurierbare Filter-Regeln
CREATE TABLE email_ingest_filters (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- subject_prefix, subject_contains, from_domain, etc.
  pattern TEXT NOT NULL,
  action TEXT DEFAULT 'drop',
  reason TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  match_count INT DEFAULT 0
);

-- Log fuer gedropte Emails (Idempotenz + Debugging)
CREATE TABLE ignored_emails (
  id UUID PRIMARY KEY,
  email_postfach TEXT NOT NULL,
  email_message_id TEXT NOT NULL,
  matched_reason TEXT NOT NULL,
  subject TEXT,
  from_email TEXT,
  UNIQUE(email_postfach, email_message_id)
);
```

### Seed Filter-Regeln

| Name | Type | Pattern | Reason |
|------|------|---------|--------|
| FRITZ!Repeater | subject_prefix | FRITZ!Repeater-Info | Auto-Status |
| Versandbestaetigung | subject_contains | Versandbestätigung | Tracking |
| DHL Domain | from_domain | dhl.de | Carrier |
| GLS Domain | from_domain | gls-group.eu | Carrier |
| noreply | from_email | noreply@ | System-Mail |

### email-webhook Flow (v3.11)

```
Graph Notification
    ↓
fetchEmailDetails()
    ↓
checkEmailAgainstFilters() ← NEU
    ↓
[Match?] → YES → logIgnoredEmail() → STOP (kein DB Insert)
    ↓ NO
saveEmailToDatabase()
    ↓
triggerProcessEmail()
```

---

## B) Cleanup Script

### Datei

`migrations/20260121_cleanup_noise_emails.sql`

### Storage-Konsistenz: DB-only

| Was wird geloescht? | Automatisch? |
|---------------------|--------------|
| `documents` Rows | Ja |
| `email_attachment_hashes` Rows | Ja (CASCADE-aehnlich) |
| Storage-Files (Bucket) | **NEIN** - manuell! |

**Empfehlung:** Nach dem Cleanup die `storage_paths` aus dem Output nehmen und manuell im Supabase Dashboard loeschen.

### Verwendung

```sql
-- 1. DRY-RUN: Zeigt was geloescht wuerde
SELECT * FROM cleanup_noise_documents(TRUE);

-- 2. EXECUTE: Loescht tatsaechlich
SELECT * FROM cleanup_noise_documents(FALSE);
```

### Output

```json
{
  "action": "DELETED",
  "document_count": 42,
  "sample_ids": ["uuid1", "uuid2", ...],
  "storage_paths": ["path1", "path2", ...]
}
```

**Hinweis:** Storage-Files muessen manuell via Supabase Dashboard geloescht werden.

---

## C) Single-Button UX

### Vorher

```
[Bestaetigen] [Korrigieren]
   (gruen)      (blau)
```

### Nachher

```
[Speichern] - dynamisch
   - Gruen + "Bestaetigen" wenn KEINE Kategorie geaendert
   - Blau + "Korrigieren" wenn Kategorie geaendert
```

### Code-Aenderung (DetailPanel.tsx)

```tsx
// Single-button UX
const hasChanges = selectedEmailKategorie || selectedKategorie;
const isCorrection = hasChanges;

const handleSave = async () => {
  if (isCorrection) {
    await api.updateLabel(doc.id, {
      action: 'correct',
      email_kategorie_manual: selectedEmailKategorie || undefined,
      kategorie_manual: selectedKategorie || undefined,
    });
  } else {
    await api.updateLabel(doc.id, { action: 'approve' });
  }
};
```

### DB-Verhalten

| Dropdown | Action | review_status | kategorie_manual |
|----------|--------|---------------|------------------|
| (keine Aenderung) | approve | 'approved' | NULL (unveraendert) |
| Kategorie gewaehlt | correct | 'corrected' | neuer Wert |

---

## D) Preview Fix fuer Scans

### Problem

Scanned Dokumente zeigten "Keine Vorschau verfuegbar" weil:
- `hasPreview` prueft `doc.source !== 'email'`
- Fuer Scans kann `source` auch `null` oder `undefined` sein

### Fix (DetailPanel.tsx)

```tsx
// ALT
const hasPreview = (doc.primary_file && doc.source !== 'email') || ...;

// NEU
const isEmailSource = doc.source === 'email';
const hasPrimaryFile = doc.primary_file && doc.primary_file.storagePath;
const showPrimaryFilePreview = hasPrimaryFile && !isEmailSource;
```

---

## E) Neue Dok-Kategorien

### Hintergrund

Fehlende Kategorien wurden in mehreren Dateien hinzugefuegt:
- `Kundenanfrage` - Allgemeine Anfragen von Kunden (nicht Preis/Angebot)
- `Aufmassblatt` - Aufmass-Dokumentation, Masslisten, Vermessungsprotokolle
- `Formular` - Standardformulare, Antraege, Checklisten (leer/nicht unterschrieben)
- `Serviceauftrag` - Vom Kunden unterschriebener Auftrag fuer Reparatur, Wartung, Service

### Wo definiert?

| Datei | Array/Enum | Zweck |
|-------|------------|-------|
| `admin-review/index.ts` | `VALID_DOKUMENT_KATEGORIEN` | Server-Validierung |
| `process-document/index.ts` | `EXTRACTION_SCHEMA.kategorie.enum` | GPT JSON Schema |
| `process-document/prompts.ts` | `SYSTEM_PROMPT` | GPT Kategorie-Beschreibungen |

### Kein DB-Constraint

Die Kategorien werden **nur auf Application-Level** validiert. Es gibt keinen `CHECK` Constraint in PostgreSQL. Neue Kategorien erfordern daher:
1. Edge Functions Update (oben)
2. Kein DB-Migration noetig

---

## Deployment

### Voraussetzungen

```bash
# Supabase Login (falls abgelaufen)
npx supabase login
```

### Schritte

```bash
# 1. Migrations anwenden (Filter-Tabellen + Cleanup-Funktion)
npx supabase db push --project-ref rsmjgdujlpnydbsfuiek

# 2. Edge Functions deployen
npx supabase functions deploy email-webhook --project-ref rsmjgdujlpnydbsfuiek
npx supabase functions deploy admin-review --project-ref rsmjgdujlpnydbsfuiek
npx supabase functions deploy process-document --project-ref rsmjgdujlpnydbsfuiek

# 3. Review Tool bauen (falls deployed)
cd apps/review-tool && npm run build
```

---

## Validation Checklist

### A) Filter
- [ ] Neue FRITZ!/Tracking Mail → erscheint NICHT in documents
- [ ] ignored_emails Tabelle hat neuen Eintrag
- [ ] filter match_count wird inkrementiert

### B) Cleanup
- [ ] DRY-RUN zeigt korrekte Anzahl
- [ ] Nach DELETE sind Noise-Eintraege weg
- [ ] Storage-Pfade im Output dokumentiert

### C) UX
- [ ] Nur 1 Button sichtbar
- [ ] Button wechselt Farbe bei Dropdown-Aenderung
- [ ] Bestaetigen setzt review_status='approved'
- [ ] Korrigieren setzt review_status='corrected' + manual Felder

### D) Preview
- [ ] Scan-PDF/Bild wird angezeigt
- [ ] Email-Anhaenge werden weiterhin angezeigt

### E) Kategorien
- [ ] GPT klassifiziert neue Kategorien korrekt
- [ ] Review-Tool zeigt neue Kategorien im Dropdown
- [ ] admin-review akzeptiert neue Kategorien bei Korrektur

---

## Risiken

| Risiko | Mitigation |
|--------|------------|
| Filter zu aggressiv | Filter koennen via SQL deaktiviert werden |
| Cleanup loescht wichtige Docs | DRY-RUN vor DELETE, Transaction |
| Preview bricht fuer andere Sources | Explizite `isEmailSource` Pruefung |

---

## Rollback

```sql
-- Filter deaktivieren
UPDATE email_ingest_filters SET enabled = FALSE;

-- Cleanup rueckgaengig machen: NICHT MOEGLICH (daher DRY-RUN wichtig!)
```

---

## Dateien geaendert

| Datei | Aenderung |
|-------|-----------|
| `migrations/20260121_email_ingest_filters.sql` | NEU - Filter-Tabellen |
| `migrations/20260121_cleanup_noise_emails.sql` | NEU - Cleanup-Funktion |
| `functions/email-webhook/index.ts` | v3.11 - Filter-Integration |
| `functions/admin-review/index.ts` | v1.3.1 - Neue Kategorien |
| `functions/process-document/index.ts` | EXTRACTION_SCHEMA - Neue Kategorien |
| `functions/process-document/prompts.ts` | SYSTEM_PROMPT - 21 Kategorien |
| `apps/review-tool/src/components/DetailPanel.tsx` | Single-Button + Preview Fix |
| `apps/review-tool/src/App.tsx` | Version v0.5.0 |
