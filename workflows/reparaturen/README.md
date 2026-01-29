# Reparatur-Workflow Automation

> Automatisierte Verarbeitung von Reparaturanfragen aus dem Datenherz (Supabase)

---

## Ziel

Eingehende Dokumente (E-Mails, Scans) mit Reparaturbezug automatisch:
1. Erkennen und klassifizieren
2. Mit ERP-Daten verknuepfen (Kunde, Projekt, Auftrag)
3. Workflow-Aktionen ausloesen (Termin, Benachrichtigung, etc.)

---

## Datenquellen

| Quelle | Tabelle | Beschreibung |
|--------|---------|--------------|
| Datenherz | `documents` | Kategorisierte Dokumente (1.559+) |
| ERP-Cache | `erp_kunden` | Kundenstamm (8.687) |
| ERP-Cache | `erp_projekte` | Projekte (2.486) |
| ERP-Cache | `erp_angebote` | Angebote (4.744) |

---

## Status

| Phase | Status | Beschreibung |
|-------|--------|--------------|
| Setup | In Arbeit | Ordnerstruktur, Grundlagen |
| Analyse | Offen | Relevante Kategorien identifizieren |
| Matching | Offen | Dokument <-> ERP Verknuepfung |
| Actions | Offen | Workflow-Aktionen definieren |

---

*Erstellt: 2026-01-23*
