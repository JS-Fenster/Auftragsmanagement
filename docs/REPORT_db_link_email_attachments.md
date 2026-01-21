# DB-Audit: Verlinkung E-Mail ↔ E-Mail-Anhang

**Datum:** 2026-01-21
**Projekt:** Auftragsmanagement (Supabase: `rsmjgdujlpnydbsfuiek`)
**Status:** ✅ **Verlinkung bereits vollstaendig implementiert**

---

## 1. Schema-Check

### 1.1 Relevante Spalten in `documents`

| Spalte | Datentyp | Nullable | Zweck |
|--------|----------|----------|-------|
| `bezug_email_id` | uuid | YES | **Parent-Link zu E-Mail** |
| `email_message_id` | text | YES | MS Graph Message ID |
| `email_postfach` | text | YES | Postfach-Identifier |
| `email_conversation_id` | text | YES | Konversations-ID |
| `email_internet_message_id` | text | YES | Internet Message-ID |
| `email_attachment_hashes` | jsonb | YES | Hashes der Anhaenge (in Parent-E-Mail) |

### 1.2 Constraints

| Constraint | Definition |
|------------|------------|
| `fk_documents_bezug_email` | `FOREIGN KEY (bezug_email_id) REFERENCES documents(id) ON DELETE SET NULL` |
| `documents_email_unique` | `UNIQUE (email_postfach, email_message_id)` |
| `documents_kategorie_check` | Erlaubt u.a. `Email_Eingehend`, `Email_Ausgehend`, `Email_Anhang` |

### 1.3 Separate Tabelle `email_attachment_hashes`

**Existiert nicht** als eigenstaendige Tabelle. Das Feld `email_attachment_hashes` ist eine JSONB-Spalte in `documents` (speichert Attachment-Hashes in der Parent-E-Mail).

---

## 2. Daten-Check

### 2.1 Grundzahlen

| Metrik | Wert |
|--------|------|
| Total Documents | 1.471 |
| Parent-Emails (`Email_Eingehend` + `Email_Ausgehend`) | 165 |
| Attachments (`kategorie='Email_Anhang'`) | 59 |
| Attachments (`source='email_attachment'`) | 50 |

### 2.2 Source-Verteilung aller Dokumente

| Source | Anzahl |
|--------|--------|
| `upload` | 1.152 |
| `email` | 165 |
| `scanner` | 95 |
| `email_attachment` | 50 |
| `backfill_migration` | 9 |

### 2.3 Attachment-Kategorisierung

| Kategorie | Source | Link-Status | Anzahl |
|-----------|--------|-------------|--------|
| `Email_Anhang` | `email_attachment` | linked | 50 |
| `Email_Anhang` | `backfill_migration` | linked | 9 |

### 2.4 Linkability-Analyse

| Metrik | Wert |
|--------|------|
| Attachments total | 59 |
| Mit `bezug_email_id` gesetzt | **59 (100%)** |
| Ohne `bezug_email_id` | **0 (0%)** |
| `bezug_email_id` verweist auf gueltige Email | **59 (100%)** |
| `bezug_email_id` verweist auf Nicht-Email | **0 (0%)** |

### 2.5 Key-basierter Join (message_id + postfach)

| Metrik | Wert |
|--------|------|
| Attachments mit `email_message_id` + `email_postfach` | 0 |
| Join moeglich via Keys | 0 |

**Erklaerung:** Attachments haben keine eigene `email_message_id`/`email_postfach`, da sie keine E-Mails sind. Die Verlinkung erfolgt korrekt ueber `bezug_email_id`.

---

## 3. Beispieldaten

### 3.1 Linked Attachments (10 Beispiele)

| Attachment-ID | Created | Datei | Parent-Betreff | Parent-Von |
|---------------|---------|-------|----------------|------------|
| `5ead0df3-...` | 2026-01-21 10:33 | `Auftragsbestaetigung_259399.pdf` | Scoop Auftragsbestätigung 259399 | Bestellung@scoop-tec.de |
| `ebf3dcf7-...` | 2026-01-21 06:49 | `Wuerth_Lieferschein_8140785239.pdf` | Würth \| Ihr digitaler Lieferschein... | serviceteam@email.wuerth.com |
| `c4a3c59c-...` | 2026-01-21 02:02 | `6415004497-2026-01-21.PDF` | Rechnungs-Nr.:6415004497, Kunde:129583 | rechnung@ammon.de |
| `874b493f-...` | 2026-01-20 14:24 | `Batch100b7cf4728c8.PDF` | 26100307/1 Lämmermann GmbH... | haendler@laemmermann.de |
| `13dee2f6-...` | 2026-01-20 13:34 | `Liefer-und_Zahlungsbedingungen.pdf` | Auftragsbestätigung für... | Bestellung-Vei@mueller-veitshoechheim.de |
| `9f61c6e6-...` | 2026-01-20 13:34 | `Viktor_Mueller_Auftragsbestaetigung...` | Auftragsbestätigung für... | Bestellung-Vei@mueller-veitshoechheim.de |
| `07ae8cc9-...` | 2026-01-20 12:35 | `Bestellung_260024.pdf` | Bestellung 260024 zu Angebot 10491 | andreas.stolarczyk@js-fenster.de |
| `2c21108d-...` | 2026-01-20 11:05 | `Allgemeine_Geschaeftsbedingungen.pdf` | Rechnung 250394 \| DKF \| ISS | andreas.stolarczyk@js-fenster.de |
| `85deb60c-...` | 2026-01-20 11:05 | `Rechnung_250394.pdf` | Rechnung 250394 \| DKF \| ISS | andreas.stolarczyk@js-fenster.de |
| `c68dfe57-...` | 2026-01-20 10:20 | `Freistellungsbescheinigung_zum_...` | Apleona / Lieferantenauskunft... | susann.zielinski@js-fenster.de |

### 3.2 Unlinked Attachments

**Keine vorhanden.** Alle 59 Attachments sind korrekt verknuepft.

---

## 4. Fazit

### 4.1 Status: ✅ Verlinkung vollstaendig implementiert

Die Architektur ist korrekt und die Daten sind sauber:

1. **FK-Constraint vorhanden:** `fk_documents_bezug_email` sichert referenzielle Integritaet
2. **100% Verlinkungsquote:** Alle 59 Attachments haben eine gueltige `bezug_email_id`
3. **Korrekte Ziel-Kategorie:** Alle `bezug_email_id` verweisen auf `Email_Eingehend` oder `Email_Ausgehend`
4. **URL-Struktur konsistent:** `email-attachments/{parent_email_id}/filename.pdf`

### 4.2 Warum kein Join via message_id/postfach?

Attachments sind keine E-Mails und haben daher keine eigene `email_message_id`/`email_postfach`. Das ist **korrekt** - sie nutzen stattdessen den direkten FK `bezug_email_id`.

### 4.3 Kein Backfill erforderlich

Da alle bestehenden Attachments bereits korrekt verlinkt sind, ist kein Backfill noetig.

### 4.4 Empfehlung: Kategorie beibehalten

Die aktuelle Struktur ist optimal:
- `kategorie='Email_Anhang'` → Dokumententyp fuer UI/Filter
- `source='email_attachment'` → Herkunft (wie Dokument entstanden ist)
- `bezug_email_id` → Parent-Link

**Keine Aenderung empfohlen.**

---

## 5. Referenz: Verwendete SQL-Queries

```sql
-- Schema-Check: Relevante Spalten
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='documents'
  AND (column_name ILIKE '%parent%' OR column_name ILIKE '%email_%'
       OR column_name ILIKE '%conversation%' OR column_name ILIKE '%thread%')
ORDER BY column_name;

-- Constraints
SELECT conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.conrelid = 'public.documents'::regclass
ORDER BY conname;

-- Counts
SELECT
  COUNT(*) FILTER (WHERE kategorie IN ('Email_Eingehend','Email_Ausgehend')) AS parent_emails,
  COUNT(*) FILTER (WHERE kategorie='Email_Anhang') AS attachments
FROM public.documents;

-- Linkability
SELECT
  COUNT(*) AS attachments_total,
  COUNT(*) FILTER (WHERE bezug_email_id IS NOT NULL) AS with_link,
  COUNT(*) FILTER (WHERE bezug_email_id IS NULL) AS without_link
FROM public.documents
WHERE kategorie='Email_Anhang';

-- Validierung: Alle Links gueltig?
SELECT
  COUNT(*) FILTER (WHERE p.id IS NOT NULL) AS valid_link,
  COUNT(*) FILTER (WHERE p.kategorie IN ('Email_Eingehend','Email_Ausgehend')) AS links_to_email
FROM public.documents a
LEFT JOIN public.documents p ON a.bezug_email_id = p.id
WHERE a.kategorie='Email_Anhang';
```

---

*Report erstellt: 2026-01-21 | Audit durchgefuehrt mit Supabase MCP*
