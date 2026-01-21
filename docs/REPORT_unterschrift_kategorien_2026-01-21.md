# Report: Unterschriftserkennung + Neue Kategorien

**Datum:** 2026-01-21
**Ticket:** Unterschriftserkennung aktivieren + Kategorien Lieferantenangebot/Bild

---

## 1. Geaenderte Dateien

### Backend (Supabase Edge Functions)

| Datei | Aenderungen |
|-------|-------------|
| `supabase/functions/process-document/index.ts` | v20: Unterschrift-Felder im Schema/Interface/Mapping, Business-Logik `unterschrift_erforderlich`, neue Kategorien |
| `supabase/functions/process-document/prompts.ts` | Unterschrift-Anweisungen im SYSTEM_PROMPT, Kategorien Lieferantenangebot/Bild |
| `supabase/functions/admin-review/index.ts` | v1.4.0: Unterschrift-Felder in Queue/Label Response, neue Kategorien in VALID_DOKUMENT_KATEGORIEN |

### Frontend (Review Tool)

| Datei | Aenderungen |
|-------|-------------|
| `apps/review-tool/src/lib/api.ts` | ReviewDocument + LabelUpdateRequest Interface erweitert |
| `apps/review-tool/src/components/DetailPanel.tsx` | Unterschrift-Abschnitt mit Toggle + Text-Input |

### Datenbank (Migration)

| Migration | Beschreibung |
|-----------|--------------|
| `add_kategorien_lieferantenangebot_bild` | DB-Constraint erweitert um alle neuen Kategorien |

---

## 2. Neue Funktionalitaet

### 2.1 Unterschriftserkennung

**Felder:**
- `empfang_unterschrift` (boolean): Ist eine handschriftliche Unterschrift/Signatur/Kuerzel sichtbar?
- `unterschrift` (text): Name bei/unter der Unterschrift (falls lesbar)
- `unterschrift_erforderlich` (boolean): Business-Logik basierend auf Kategorie

**Business-Logik `unterschrift_erforderlich`:**
```
true fuer: Auftragsbestaetigung, Serviceauftrag, Montageauftrag
false fuer: alle anderen Kategorien
```

**GPT-Erkennung:**
- Handschriftliche Kuerzel/Initialen/Paraphen zaehlen als Unterschrift
- Gedruckte Namen ohne Unterschrift zaehlen NICHT
- Unterschrift aendert NICHT die Kategorie (Angebot bleibt Angebot)

### 2.2 Neue Kategorien

| Kategorie | Beschreibung |
|-----------|--------------|
| `Lieferantenangebot` | Preisangebot VON Lieferanten (an J.S. Fenster) |
| `Bild` | Fotos (Baustelle, Fenster, Schaeden) - KEINE technischen Zeichnungen |

---

## 3. Deploy-Commands

```bash
# 1. process-document deployen
cd C:/Claude_Workspace/WORK/repos/Auftragsmanagement
npx supabase functions deploy process-document --project-ref rsmjgdujlpnydbsfuiek

# 2. admin-review deployen
npx supabase functions deploy admin-review --project-ref rsmjgdujlpnydbsfuiek

# 3. Review Tool bauen und deployen (falls hosted)
cd apps/review-tool
npm run build
# Deploy je nach Hosting (Netlify, Vercel, etc.)
```

---

## 4. Verifikations-Checklist (5 Minuten)

### 4.1 API Health-Checks

```bash
# process-document
curl -s "https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/process-document" | jq '.version'
# Erwartung: "20.0.0"

# admin-review
curl -s "https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/admin-review?health=1" -H "x-api-key: $API_KEY" | jq '.version'
# Erwartung: "1.4.0"
```

### 4.2 Kategorien pruefen

```bash
curl -s "https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/admin-review/categories" -H "x-api-key: $API_KEY" | jq '.dokument_kategorien | contains(["Lieferantenangebot", "Bild"])'
# Erwartung: true
```

### 4.3 Manuelle Tests

| Test | Erwartetes Ergebnis |
|------|---------------------|
| Scanner: Auftragsbestaetigung MIT Unterschrift | `kategorie=Auftragsbestaetigung`, `unterschrift_erforderlich=true`, `empfang_unterschrift=true` |
| Scanner: Angebot MIT Unterschrift | `kategorie=Angebot`, `unterschrift_erforderlich=false`, `empfang_unterschrift=true` |
| Scanner: Foto von Baustelle | `kategorie=Bild` |
| Review Tool: Unterschrift-Toggle sichtbar | Abschnitt "Unterschrift" bei non-email Dokumenten |

### 4.4 DB-Constraint pruefen

```sql
-- In Supabase Dashboard SQL Editor
SELECT conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.conrelid = 'public.documents'::regclass
  AND conname = 'documents_kategorie_check';
-- Muss "Lieferantenangebot" und "Bild" enthalten
```

---

## 5. Rollback (falls noetig)

```sql
-- Kategorien zuruecksetzen (VORSICHT: bestehende Daten pruefen!)
ALTER TABLE public.documents DROP CONSTRAINT documents_kategorie_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_kategorie_check CHECK (
  kategorie = ANY (ARRAY[
    -- Original-Liste ohne neue Kategorien
  ])
);
```

Fuer Edge Functions: Vorherige Version aus Git deployen.

---

*Report erstellt: 2026-01-21*
