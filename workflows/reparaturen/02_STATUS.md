# Status: Reparatur-Workflow

> Letzte Aktualisierung: 2026-03-09 (M7 Commit+Push ABGESCHLOSSEN)
> Aktualisiert von: Projektleiter

---

## Aktueller Stand

**Phase:** G-052 Pipeline-Split + G-033 Duplikat-Erkennung
**Ziel:** process-document aufsplitten in 2 Stages (OCR → Kategorisierung)

---

## SPRINT: G-052 + G-033 Pipeline-Split

| Meilenstein | Beschreibung | Status |
|-------------|-------------|--------|
| **M1** | DB Migration: pending_categorize + error_ocr + error_gpt | **FERTIG** |
| **M2** | process-document-ocr (Stage 1: OCR + Duplikat) | **FERTIG** |
| **M3** | process-document-categorize (Stage 2: GPT + Storage) | **FERTIG** |
| **M4** | batch-process-pending v2 (zwei Schleifen) | **FERTIG** |
| **M5** | process-document Wrapper v40 | **FERTIG** |
| **M6** | Deploy + Testen aller Functions | **FERTIG** |
| **M7** | Commit + Push + MD-Pflege | **FERTIG** |

---

## Architektur (neu)

```
Scanner/Email → process-document (Wrapper v40)
                    ├→ process-document-ocr (Stage 1)
                    │   - Download + File-Hash + Duplikat-Check
                    │   - Mistral OCR / Office-Extraktion
                    │   - Upload in inbox/
                    │   - Status: pending_categorize
                    │
                    └→ process-document-categorize (Stage 2)
                        - ocr_text aus DB lesen
                        - GPT Kategorisierung + Extraktion
                        - Storage: inbox/ → Kategorie-Ordner
                        - Status: done

batch-process-pending v2:
  Schleife 1: pending_ocr → process-document-ocr
  Schleife 2: pending_categorize → process-document-categorize
```

---

## Log-Referenz

- [R-055] PL: G-052 + G-033 Pipeline-Split gestartet (2026-03-09)
- [R-056] PROG: M2 process-document-ocr v1.0.0 erstellt (2026-03-09)
- [R-057] PROG: M5 process-document Wrapper v40.0.0 (2026-03-09)
- [R-058] TEST: M6 Deploy + Tests 5/5 BESTANDEN (2026-03-09)
- [R-059] PL: M7 Race-Condition Fix + Commit+Push (2026-03-09)

---

*Vorheriger Sprint: Kontakt-Management (R-048 bis R-054) - ABGESCHLOSSEN*
