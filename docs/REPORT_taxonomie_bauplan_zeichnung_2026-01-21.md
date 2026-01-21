# Taxonomie-Erweiterung: Bauplan + Zeichnung

> Datum: 2026-01-21

---

## Zusammenfassung

| Kategorie | Beschreibung | Heuristik-Prio |
|-----------|--------------|----------------|
| **Bauplan** | Architektenplaene (Grundriss, Schnitt, Ansicht, Lageplan) | 88 |
| **Zeichnung** | Technische/CAD-Zeichnungen (digital) | 72 |
| **Skizze** | Handgezeichnet (bereits vorhanden) | - |

---

## Abgrenzung

| Kategorie | Merkmale |
|-----------|----------|
| **Bauplan** | Massstab (1:100, 1:50), Planstand, Architekt, Grundriss/Schnitt/Ansicht |
| **Zeichnung** | CAD, DWG, DXF, technische Zeichnung, Konstruktionszeichnung |
| **Skizze** | Handgezeichnet, handschriftlich |
| **Aufmassblatt** | Messprotokolle, Masslisten |

---

## Heuristik-Keywords

### Bauplan (Priority 88)
```
grundriss, schnitt, ansicht, lageplan, planstand, maßstab, m 1:,
1:100, 1:50, 1:200, architekt, bauplan, bauzeichnung, geschoss,
erdgeschoss, obergeschoss, kellergeschoss, dachgeschoss,
baugenehmigung, bauantrag, flurkarte, kataster
```

### Zeichnung (Priority 72)
```
technische zeichnung, detailzeichnung, cad, autocad, dwg, dxf,
konstruktionszeichnung, fertigungszeichnung, explosionszeichnung,
stückliste, bemaßung, iso-ansicht
```

---

## Commits

| Commit | Beschreibung |
|--------|--------------|
| `2f6b402` | feat: add category Bauplan |
| `88dcb45` | feat: add category Zeichnung |
| `519c9f1` | feat: add heuristic rule for Zeichnung |

---

## Audit-Queries

### Bauplan-Kandidaten finden
```sql
SELECT id, created_at, kategorie, LEFT(email_betreff, 60) as betreff
FROM documents
WHERE kategorie NOT IN ('Bauplan')
  AND (
    LOWER(ocr_text) LIKE '%grundriss%'
    OR LOWER(ocr_text) LIKE '%schnitt%'
    OR LOWER(ocr_text) LIKE '%lageplan%'
    OR LOWER(ocr_text) LIKE '%maßstab%'
    OR LOWER(ocr_text) LIKE '%1:100%'
    OR LOWER(ocr_text) LIKE '%architekt%'
  )
ORDER BY created_at DESC
LIMIT 20;
```

### Zeichnung-Kandidaten finden
```sql
SELECT id, created_at, kategorie, LEFT(email_betreff, 60) as betreff
FROM documents
WHERE kategorie NOT IN ('Zeichnung')
  AND (
    LOWER(ocr_text) LIKE '%technische zeichnung%'
    OR LOWER(ocr_text) LIKE '%cad%'
    OR LOWER(ocr_text) LIKE '%autocad%'
    OR LOWER(ocr_text) LIKE '%.dwg%'
    OR LOWER(ocr_text) LIKE '%konstruktionszeichnung%'
  )
ORDER BY created_at DESC
LIMIT 20;
```

### Kategorien zaehlen
```sql
SELECT kategorie, COUNT(*) as anzahl
FROM documents
WHERE kategorie IN ('Bauplan', 'Zeichnung', 'Skizze', 'Aufmassblatt')
GROUP BY kategorie
ORDER BY anzahl DESC;
```

---

## DB Constraint

41 Kategorien total (inkl. Bauplan + Zeichnung)

---

*Report erstellt: 2026-01-21 | Claude Code*
