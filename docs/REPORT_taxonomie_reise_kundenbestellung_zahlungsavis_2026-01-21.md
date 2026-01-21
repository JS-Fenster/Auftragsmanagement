# Taxonomie-Erweiterung Report

> Datum: 2026-01-21 | Ticket: Reiseunterlagen + Kundenbestellung + Zahlungsavis

---

## 1. Zusammenfassung

### Neue Kategorien

| Kategorie | Beschreibung | Heuristik-Prio |
|-----------|--------------|----------------|
| **Reiseunterlagen** | Hotel, Flug, Bahn, Mietwagen, Buchungsbestaetigungen | 70 |
| **Kundenbestellung** | PO vom Kunden an uns (J.S. Fenster ist Lieferant) | 95 |
| **Zahlungsavis** | Belastungsanzeige, Lastschrift, Sammelabbuchung | 78 |

### Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `_shared/categories.ts` | 3 neue Kategorien + 3 Heuristik-Regeln, Bestellung-Regel verfeinert |
| `process-document/index.ts` | EXTRACTION_SCHEMA enum erweitert, Version 23 |
| `process-document/prompts.ts` | 3 neue Kategorie-Beschreibungen + 4 Abgrenzungen |
| `migrations/20260121_*.sql` | CHECK Constraint erweitert (39 Kategorien) |

---

## 2. Heuristik-Regeln (Detail)

### 2.1 Reiseunterlagen (Priority 70)

**Keywords:**
- buchungsbestätigung, buchungsbestaetigung
- reservierungsbestätigung, hotelreservierung, zimmerreservierung
- check-in, check-out, übernachtung
- flugnummer, flugticket, boarding pass
- bahnticket, zugticket, ice ticket
- mietwagen, rental car, autovermietung
- reiseversicherung, reisekosten, hotelvoucher

### 2.2 Kundenbestellung (Priority 95)

**Keywords:**
- bitte auf lieferschein und rechnung angeben
- lieferant: j.s. fenster, lieferant: js fenster
- ihre bestellnummer (aus Kundensicht)
- einkaufsbestellung, materialbestellung, abrufbestellung

**Abgrenzung zu Bestellung:**
- Kundenbestellung: Kunde bestellt bei UNS → eingehend, wir sind Lieferant
- Bestellung: WIR bestellen bei Lieferant → ausgehend

### 2.3 Zahlungsavis (Priority 78)

**Keywords:**
- belastungsanzeige, zahlungsavis
- lastschrift, lastschrifteinzug, sepa-lastschrift
- sammelabbuchung, sammellastschrift
- zahlungslauf, abbuchung erfolgt
- kontobelastung, einzug vom

**Abgrenzung:**
- Zahlungsavis: Info über AUSGEFUEHRTE Abbuchung (Vergangenheit)
- Zahlungserinnerung/Mahnung: Aufforderung ZU ZAHLEN (Zukunft)
- Eingangsrechnung: Die Rechnung selbst (Forderung)

---

## 3. Prioritaeten-Uebersicht (alle Regeln)

| Kategorie | Priority | Anmerkung |
|-----------|----------|-----------|
| Auftragsbestaetigung | 100 | Hoechste - Lieferant bestaetigt |
| Kundenbestellung | 95 | Knapp darunter - PO vom Kunden |
| Bestellung | 90 | Von uns an Lieferant |
| Finanzierung | 85 | |
| Leasing | 85 | |
| Mahnung | 85 | |
| Gutschrift | 80 | Ueber Eingangsrechnung |
| Produktdatenblatt | 80 | |
| Zahlungsavis | 78 | Ueber Eingangsrechnung |
| Eingangsrechnung | 75 | |
| Lieferantenangebot | 70 | |
| Reiseunterlagen | 70 | |

---

## 4. Audit-Queries

### 4.1 Dokumente pro Kategorie zaehlen

```sql
SELECT
    kategorie,
    COUNT(*) as anzahl,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as prozent
FROM documents
WHERE kategorie IS NOT NULL
GROUP BY kategorie
ORDER BY anzahl DESC;
```

### 4.2 Backfill-Kandidaten: Reiseunterlagen

```sql
-- Dokumente die vermutlich Reiseunterlagen sind
SELECT
    id,
    created_at,
    kategorie,
    LEFT(email_betreff, 80) as betreff,
    LEFT(inhalt_zusammenfassung, 100) as zusammenfassung
FROM documents
WHERE
    kategorie != 'Reiseunterlagen'  -- noch nicht korrekt kategorisiert
    AND (
        LOWER(ocr_text) LIKE '%hotelreservierung%'
        OR LOWER(ocr_text) LIKE '%buchungsbestätigung%'
        OR LOWER(ocr_text) LIKE '%buchungsbestaetigung%'
        OR LOWER(ocr_text) LIKE '%zimmerreservierung%'
        OR LOWER(ocr_text) LIKE '%flugnummer%'
        OR LOWER(ocr_text) LIKE '%bahnticket%'
        OR LOWER(ocr_text) LIKE '%mietwagen%'
        OR LOWER(ocr_text) LIKE '%check-in%'
        OR LOWER(ocr_text) LIKE '%übernachtung%'
    )
ORDER BY created_at DESC
LIMIT 20;
```

### 4.3 Backfill-Kandidaten: Kundenbestellung

```sql
-- Dokumente die vermutlich Kundenbestellungen sind
-- (haben "Bestellung" aber "J.S. Fenster" ist Lieferant/Empfaenger)
SELECT
    id,
    created_at,
    kategorie,
    aussteller_firma,
    empfaenger_firma,
    LEFT(email_betreff, 80) as betreff
FROM documents
WHERE
    kategorie = 'Bestellung'  -- aktuell als Bestellung kategorisiert
    AND (
        -- Hinweise dass WIR der Lieferant sind
        LOWER(ocr_text) LIKE '%bitte auf lieferschein%angeben%'
        OR LOWER(ocr_text) LIKE '%lieferant:%j%s%fenster%'
        OR (empfaenger_firma IS NOT NULL AND LOWER(empfaenger_firma) LIKE '%j.s.%fenster%')
        OR (empfaenger_firma IS NOT NULL AND LOWER(empfaenger_firma) LIKE '%js%fenster%')
    )
ORDER BY created_at DESC
LIMIT 20;
```

### 4.4 Backfill-Kandidaten: Zahlungsavis

```sql
-- Dokumente die vermutlich Zahlungsavis sind
SELECT
    id,
    created_at,
    kategorie,
    LEFT(email_betreff, 80) as betreff,
    LEFT(inhalt_zusammenfassung, 100) as zusammenfassung
FROM documents
WHERE
    kategorie NOT IN ('Zahlungsavis')
    AND (
        LOWER(ocr_text) LIKE '%belastungsanzeige%'
        OR LOWER(ocr_text) LIKE '%zahlungsavis%'
        OR LOWER(ocr_text) LIKE '%lastschrift%'
        OR LOWER(ocr_text) LIKE '%sammelabbuchung%'
        OR LOWER(ocr_text) LIKE '%zahlungslauf%'
        OR LOWER(ocr_text) LIKE '%abbuchung erfolgt%'
    )
ORDER BY created_at DESC
LIMIT 20;
```

---

## 5. Backfill-SQL (NICHT AUTOMATISCH AUSFUEHREN)

> **WARNUNG:** Diese Queries nur nach manuellem Review der Kandidaten ausfuehren!

```sql
-- Reiseunterlagen Backfill (nach Review)
-- UPDATE documents
-- SET kategorie = 'Reiseunterlagen',
--     kategorisiert_von = 'backfill',
--     updated_at = NOW()
-- WHERE id IN ( <IDs aus Kandidaten-Query> );

-- Kundenbestellung Backfill (nach Review)
-- UPDATE documents
-- SET kategorie = 'Kundenbestellung',
--     kategorisiert_von = 'backfill',
--     updated_at = NOW()
-- WHERE id IN ( <IDs aus Kandidaten-Query> );

-- Zahlungsavis Backfill (nach Review)
-- UPDATE documents
-- SET kategorie = 'Zahlungsavis',
--     kategorisiert_von = 'backfill',
--     updated_at = NOW()
-- WHERE id IN ( <IDs aus Kandidaten-Query> );
```

---

## 6. Deployment Checklist

```bash
# 1. Migration anwenden
npx supabase db push --project-ref rsmjgdujlpnydbsfuiek

# 2. Edge Functions deployen
npx supabase functions deploy process-document --project-ref rsmjgdujlpnydbsfuiek
npx supabase functions deploy admin-review --project-ref rsmjgdujlpnydbsfuiek

# 3. Health Check
curl -s https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/process-document | jq .version
# Erwartete Ausgabe: "23.0.0"

# 4. Categories Endpoint pruefen
curl -s -H "x-api-key: $INTERNAL_API_KEY" \
  https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/admin-review/categories | jq .dokument_kategorien

# 5. Review Tool Hard Refresh (Ctrl+Shift+R)
```

---

## 7. Testfaelle

| Test | Input | Erwartete Kategorie | Erwartete Quelle |
|------|-------|---------------------|------------------|
| Hotel-Buchung | "Buchungsbestätigung Hotel Maritim" | Reiseunterlagen | rule |
| Apleona Bestellung | "Bestellung ... bitte auf Lieferschein angeben" | Kundenbestellung | rule |
| WERU AB | "Auftragsbestätigung ... Lieferwoche 12" | Auftragsbestaetigung | rule |
| Belastungsanzeige | "Belastungsanzeige Nr. 12345" | Zahlungsavis | rule |

---

*Report erstellt: 2026-01-21 | Claude Code*
