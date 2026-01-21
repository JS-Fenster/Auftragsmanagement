# Report: Taxonomie + Heuristik-Regeln

**Datum:** 2026-01-21
**Ticket:** Taxonomie + Heuristik-Regeln (Bestellung/Auftragsbestaetigung) + Neue Kategorien

---

## 1. Zusammenfassung

| Komponente | Version | Status |
|------------|---------|--------|
| `process-document` | **22.0.0** | ✅ deployed |
| `admin-review` | **1.6.0** | ✅ deployed |
| `_shared/categories.ts` | **2.0.0** | ✅ deployed |
| DB-Constraint | erweitert | ✅ migriert |

---

## 2. Neue Kategorien

| Kategorie | Beschreibung | Heuristik-Keywords |
|-----------|--------------|-------------------|
| `Produktdatenblatt` | Technische Datenblaetter, Specs | datenblatt, technische daten, produktspezifikation |
| `Finanzierung` | Kreditvertraege, Ratenzahlung | finanzierung, jahreszins, kreditbetrag, darlehen |
| `Leasing` | Leasingvertraege | leasing, leasingrate, restwert |

---

## 3. Heuristik-System

### Konzept
- Keyword-basierte Klassifizierung VOR GPT-Aufruf
- Bei **high confidence** Match: GPT-Kategorie wird ueberschrieben
- Bei **medium confidence**: GPT verifiziert, Heuristik als Hinweis

### Implementierte Regeln

| Kategorie | Priority | Keywords (Auszug) |
|-----------|----------|-------------------|
| `Auftragsbestaetigung` | 100 | auftragsbestaetigung, order confirmation, wir bestaetigen |
| `Bestellung` | 90 | bestellung, purchase order, wir bestellen |
| `Mahnung` | 85 | mahnung, verzugszinsen, inkasso |
| `Finanzierung` | 85 | finanzierung, jahreszins, kreditbetrag |
| `Leasing` | 85 | leasing, leasingrate, restwert |
| `Gutschrift` | 80 | gutschrift, stornorechnung |
| `Produktdatenblatt` | 80 | datenblatt, technische daten |
| `Eingangsrechnung` | 75 | rechnung, rechnungsnummer |
| `Lieferantenangebot` | 70 | unser angebot, angebotsnummer |

### Konflikt-Aufloesung
- Auftragsbestaetigung (100) > Bestellung (90): Bei "bestaetigung" + "bestellung" gewinnt AB
- Gutschrift (80) > Eingangsrechnung (75): "gutschrift" ueberschreibt "rechnung"

### Observability
- `extraktions_hinweise` enthaelt: `Kategorisiert von: rule/gpt`
- API Response enthaelt: `kategorisiert_von: "rule" | "gpt"`

---

## 4. Bestellung vs Auftragsbestaetigung

### Fachliche Abgrenzung (im Prompt)
- **Bestellung** = WIR bestellen bei Lieferant (ausgehend, PO/Bestellauftrag)
- **Auftragsbestaetigung** = Lieferant BESTAETIGT unsere Bestellung (eingehend)
  - ODER: Kunde schickt unterschriebene AB zurueck

### Heuristik-Logik
1. Wenn "auftragsbestaetigung", "order confirmation", "wir bestaetigen" → AB
2. Wenn "bestellung", "wir bestellen", "purchase order" (ohne AB-Keywords) → Bestellung

---

## 5. Geaenderte Dateien

| Datei | Aenderungen |
|-------|-------------|
| `_shared/categories.ts` | v2.0 - Neue Kategorien + `applyHeuristicRules()` |
| `process-document/index.ts` | v22 - Heuristik VOR GPT, `kategorisiert_von` |
| `process-document/prompts.ts` | 30 Kategorien + Abgrenzungen |
| `admin-review/index.ts` | v1.6 - Verwendet shared categories |

---

## 6. DB-Migration

```sql
-- Migration: add_kategorien_produktdatenblatt_finanzierung_leasing
ALTER TABLE public.documents ADD CONSTRAINT documents_kategorie_check CHECK (
  kategorie = ANY (ARRAY[
    ...,
    'Finanzierung'::text,
    'Leasing'::text,
    'Produktdatenblatt'::text,
    ...
  ])
);
```

---

## 7. Audit-Ergebnisse

### Aktuelle Kategorie-Verteilung (Top 10)

| Kategorie | Anzahl | Anteil |
|-----------|--------|--------|
| Montageauftrag | 299 | 19.95% |
| Sonstiges_Dokument | 241 | 16.08% |
| Email_Eingehend | 180 | 12.01% |
| Eingangslieferschein | 157 | 10.47% |
| Skizze | 149 | 9.94% |
| Auftragsbestaetigung | 147 | 9.81% |
| Notiz | 83 | 5.54% |
| Email_Anhang | 67 | 4.47% |
| Brief_eingehend | 54 | 3.60% |
| Angebot | 42 | 2.80% |

### Sonstiges_Dokument (48h)
- 27 von 184 Dokumenten (14.67%)

### Potenzielle Kandidaten fuer neue Kategorien

| Kategorie | Matches (Keyword-Suche) |
|-----------|------------------------|
| Produktdatenblatt | 16 Dokumente |
| Finanzierung | 20 Dokumente |
| Leasing | 6 Dokumente |

*Hinweis: Diese Dokumente wurden vor Heuristik-Einfuehrung kategorisiert und koennten Backfill-Kandidaten sein.*

---

## 8. Verifikations-Checklist

### API Health-Checks
```bash
# process-document
curl -s ".../process-document" | jq '.version'
# Erwartung: "22.0.0"

# admin-review
curl -s ".../admin-review?health=1" -H "x-api-key: ..." | jq '.version'
# Erwartung: "1.6.0"
```

### Review Tool
- [ ] Hard Refresh (Ctrl+Shift+R)
- [ ] Dropdown enthaelt: Produktdatenblatt, Finanzierung, Leasing
- [ ] Kategorie setzen + speichern + reload → bleibt

### Heuristik-Test
- [ ] Dokument mit "Auftragsbestaetigung" hochladen → `kategorisiert_von: "rule"`
- [ ] Dokument mit "Bestellung" hochladen → `kategorisiert_von: "rule"`
- [ ] Generisches Dokument → `kategorisiert_von: "gpt"`

---

## 9. Optionaler Backfill

Falls gewuenscht, koennen die 42 identifizierten Dokumente mit Keyword-Matches manuell ueberprueft und neu kategorisiert werden:

```sql
-- Dry Run: Kandidaten anzeigen
SELECT id, kategorie,
  CASE
    WHEN LOWER(ocr_text) LIKE '%datenblatt%' THEN 'Produktdatenblatt'
    WHEN LOWER(ocr_text) LIKE '%finanzierung%' THEN 'Finanzierung'
    WHEN LOWER(ocr_text) LIKE '%leasing%' THEN 'Leasing'
  END as suggested
FROM documents
WHERE (LOWER(ocr_text) LIKE '%datenblatt%'
    OR LOWER(ocr_text) LIKE '%finanzierung%'
    OR LOWER(ocr_text) LIKE '%leasing%')
  AND kategorie = 'Sonstiges_Dokument';
```

---

*Report erstellt: 2026-01-21*
