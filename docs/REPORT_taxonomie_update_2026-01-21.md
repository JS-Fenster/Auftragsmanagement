# Report: Taxonomie-Update

**Datum:** 2026-01-21
**Ticket:** Taxonomie-Update (Alias + Briefe vereinheitlichen + neue Kategorien)

---

## 1. Zusammenfassung

| Aktion | Status |
|--------|--------|
| Neue Kategorien hinzugefuegt | ✅ |
| Brief-Kategorien vereinheitlicht | ✅ |
| Alias-Layer implementiert | ✅ |
| Backfill durchgefuehrt | ✅ |
| DB-Constraint aktualisiert | ✅ |
| Functions deployed | ✅ |

---

## 2. Geaenderte Dateien

### Shared Module (NEU)
| Datei | Beschreibung |
|-------|--------------|
| `supabase/functions/_shared/categories.ts` | Zentrale Kategorie-Definitionen + `canonicalizeKategorie()` |

### Backend (Edge Functions)
| Datei | Version | Aenderungen |
|-------|---------|-------------|
| `process-document/index.ts` | v21 | Import shared categories, canonicalize vor DB-Write |
| `process-document/prompts.ts` | - | Neue Kategorie-Beschreibungen + Abgrenzungen |
| `admin-review/index.ts` | v1.5.0 | Import shared categories, canonicalize bei Label-Update |

### DB-Migrationen
| Migration | Beschreibung |
|-----------|--------------|
| `taxonomy_update_add_categories` | Constraint erweitert um alle neuen Kategorien |
| `taxonomy_update_finalize` | Deprecated Kategorien aus Constraint entfernt |

---

## 3. Kategorie-Aenderungen

### Neue Kategorien
| Kategorie | Beschreibung |
|-----------|--------------|
| `Gutschrift` | Gutschrift/Stornorechnung (Korrektur einer Rechnung) |
| `Abnahmeprotokoll` | Protokoll zur Abnahme von Montage/Bauleistung |
| `Reklamation` | Reklamation/Beschwerde (Maengel, Schaden, Garantiefall) |
| `Vertrag` | Unterschriebene Vertraege, Vereinbarungen |
| `Brief_eingehend` | Eingehende Korrespondenz (ersetzt Brief_von_*) |
| `Brief_ausgehend` | Ausgehende Korrespondenz (ersetzt Brief_an_*) |

### Entfernte Kategorien (via Alias)
| Alt | Neu (Alias) |
|-----|-------------|
| `Angebotsanfrage` | → `Kundenanfrage` |
| `Brief_von_Kunde` | → `Brief_eingehend` |
| `Brief_von_Amt` | → `Brief_eingehend` |
| `Brief_an_Kunde` | → `Brief_ausgehend` |
| `Archiv` | → `Sonstiges_Dokument` |

### Beibehaltene Spezial-Kategorie
| Kategorie | Grund |
|-----------|-------|
| `Brief_von_Finanzamt` | Steuerliche Relevanz, bleibt eigenstaendig |

---

## 4. Backfill-Ergebnisse

| Aktion | Anzahl |
|--------|--------|
| `Brief_von_Kunde` → `Brief_eingehend` | 20 |
| `Brief_von_Amt` → `Brief_eingehend` | 34 |
| `Brief_an_Kunde` → `Brief_ausgehend` | 3 |
| **Gesamt migriert** | **57** |

### Aktueller Stand Brief-Kategorien
| Kategorie | Anzahl |
|-----------|--------|
| `Brief_eingehend` | 54 |
| `Brief_ausgehend` | 3 |
| `Brief_von_Finanzamt` | 4 |

---

## 5. Canonicalize-Funktion

```typescript
// _shared/categories.ts
const KATEGORIE_ALIASES: Record<string, string> = {
  "Angebotsanfrage": "Kundenanfrage",
  "Brief_von_Kunde": "Brief_eingehend",
  "Brief_von_Amt": "Brief_eingehend",
  "Brief_an_Kunde": "Brief_ausgehend",
  "Archiv": "Sonstiges_Dokument",
};

export function canonicalizeKategorie(kategorie: string | null): string | null {
  if (!kategorie) return null;
  return KATEGORIE_ALIASES[kategorie] || kategorie;
}
```

**Verwendung in:**
- `process-document`: `buildDatabaseRecord()` vor DB-Insert
- `admin-review`: `updateLabel()` vor Speichern von `kategorie_manual`

---

## 6. Versions-Check

```bash
# process-document
curl -s ".../process-document" | jq '.version'
# Erwartung: "21.0.0"

# admin-review
curl -s ".../admin-review?health=1" -H "x-api-key: ..." | jq '.version'
# Erwartung: "1.5.0"
```

---

## 7. Review Tool Verifikation

Nach Hard-Refresh (Ctrl+Shift+R) sollte das Dropdown folgende **neue** Kategorien zeigen:
- Abnahmeprotokoll
- Brief_ausgehend
- Brief_eingehend
- Gutschrift
- Reklamation
- Vertrag

**Nicht mehr sichtbar** (deprecated):
- Angebotsanfrage
- Archiv
- Brief_an_Kunde
- Brief_von_Amt
- Brief_von_Kunde

---

*Report erstellt: 2026-01-21*
