# Optimierung: ERP-System → Auftragsmanagement Migration

> **Ziel:** Das Auftragsmanagement-Tool wird das Hauptsystem. Dieses Dokument listet alle Features aus dem ERP-System, die noch fehlen oder uebernommen werden muessen.

**Erstellt:** 2026-02-06
**Status:** In Bearbeitung
**Fuer:** Marco Heer (Coaching/Implementierung)

---

## Uebersicht

Das **erp-system-vite** wird als deprecated markiert. Alle fehlenden Features sollen ins **Auftragsmanagement** uebernommen werden.

| Bereich | ERP-System | Auftragsmanagement | Delta |
|---------|------------|-------------------|-------|
| Frontend-Seiten | 9 | 12 | -3 (aber andere Features) |
| Backend-APIs | 0 (Frontend-only) | 25+ Endpunkte | ✅ AM besser |
| Edge Functions | 0 | 10 | ✅ AM besser |
| SQL Migrations | 0 | 6 | ✅ AM besser |
| RLS Policies | 0 | Ja | ✅ AM besser |

---

## 1. Fehlende Frontend-Features

### 1.1 Lieferanten-Verwaltung ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Hoch |
| **Komplexitaet** | Mittel |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/SuppliersPage.tsx` |
| **Geschaetzter Aufwand** | 4-6 Stunden |

**Funktionen:**
- Lieferanten-Liste mit Suche (Name, Firma, Stadt)
- Create/Edit Dialog mit Kontaktfeldern
- Kategorisierung (Fenster, Beschlaege, etc.)
- Portal-URL-Integration fuer direkten Zugriff

**Umsetzungsvorschlag:**
- Neue Seite `frontend/src/pages/Lieferanten.jsx`
- Daten aus `erp_lieferanten` (bereits vorhanden via Sync)
- Route `/lieferanten` in App.jsx

---

### 1.2 Bestellungen-Management ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Hoch |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/OrdersPage.tsx` |
| **Geschaetzter Aufwand** | 8-10 Stunden |

**Funktionen:**
- Bestellstatus: DRAFT, ORDERED, PARTIAL, DELIVERED, CANCELLED
- Lieferant-Zuordnung
- Erwartungsdaten und Gesamtwertberechnung
- Statistik-Karten: Entwuerfe, Bestellt, Teillieferung, Erwartet
- Konfirmationsnummer-Tracking
- Audit Log Integration

**Umsetzungsvorschlag:**
- Neue Seite `frontend/src/pages/Bestellungen.jsx`
- Daten aus `erp_bestellungen` (bereits vorhanden via Sync)
- Neuer API-Endpunkt `/api/bestellungen` im Backend

---

### 1.3 Kalender mit FullCalendar ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/CalendarPage.tsx` |
| **Geschaetzter Aufwand** | 6-8 Stunden |

**Funktionen:**
- 5 Ansichten: Monat, Woche, Tag, Liste, Team-Planung (ResourceTimeline)
- Farb-Kodierung nach Termintyp:
  - MEASUREMENT (Blau) - Aufmass
  - INSTALLATION (Lila) - Montage
  - REPAIR (Orange) - Reparatur
  - DELIVERY (Cyan) - Lieferung
  - MEETING (Gelb) - Besprechung
  - OTHER (Grau) - Sonstiges
- Ressourcen-Planung (Mitarbeiter/Team)
- Deutsche Lokalisierung
- Time Grid 06:00-20:00

**Umsetzungsvorschlag:**
- Package: `@fullcalendar/react` + Plugins
- Neue Seite `frontend/src/pages/Kalender.jsx`
- Neue Tabelle `appointments` in Supabase
- Integration mit `auftrag_status.montage_geplant`

---

### 1.4 Erweiterte Dokumente (Angebote/Rechnungen) ⚠️
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Mittel |
| **Komplexitaet** | Komplex |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/DocumentsPage.tsx`, `DocumentDetailPage.tsx` |
| **Geschaetzter Aufwand** | 10-12 Stunden |

**Funktionen im ERP:**
- Dokumenttypen: QUOTE (Angebot), ORDER (Auftrag), INVOICE (Rechnung)
- Status-Filter: DRAFT, SENT, ACCEPTED, PAID, CANCELLED
- Intelligente Kundensuche
- Intelligente Projektsuche (nur Projekte des gewaehlten Kunden)
- Steuersystem: Standard, Reverse Charge, Exempt
- Netto-, Steuer-, Bruttobetrag Verwaltung
- Positions-Management (Hinzufuegen/Loeschen)
- PDF-Export/Druck

**Status Auftragsmanagement:**
- `erp_angebote` und `erp_rechnungen` sind bereits als Cache vorhanden
- Dashboard hat eine einfache Dokumente-Seite
- Fehlt: Detailbearbeitung, Positionsverwaltung, PDF-Export

**Umsetzungsvorschlag:**
- Erweitern der bestehenden `dashboard/src/pages/Dokumente.jsx`
- Neue Detail-Seite mit Positionseditor
- Integration mit Budgetangebot-System fuer Preisberechnung

---

### 1.5 Einstellungen mit Datensicherung ❌
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Niedrig |
| **Komplexitaet** | Mittel |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/SettingsPage.tsx` |
| **Geschaetzter Aufwand** | 3-4 Stunden |

**Funktionen:**
- Backup-Export als JSON
- Backup-Import
- Testdaten einfuegen (Seed)
- Supabase-Verbindungsstatus anzeigen

**Umsetzungsvorschlag:**
- Erweitern der `dashboard/src/pages/Einstellungen.jsx`
- Neuer API-Endpunkt `/api/backup/export` und `/api/backup/import`

---

### 1.6 Kunden mit Besteuerung ⚠️
| Attribut | Wert |
|----------|------|
| **Prioritaet** | Niedrig |
| **Komplexitaet** | Einfach |
| **ERP Code-Pfad** | `erp-system-vite/src/pages/CustomersPage.tsx` |
| **Geschaetzter Aufwand** | 2-3 Stunden |

**Funktionen im ERP:**
- Steuertypverwaltung: STANDARD, REVERSE CHARGE, EXEMPT
- Freistellungsbescheinigung mit Nachweis und Gueltigkeitsdatum

**Status Auftragsmanagement:**
- Kunden-Seite existiert (aus `erp_kunden`)
- Fehlt: Steuertyp-Felder

**Umsetzungsvorschlag:**
- Felder `steuertyp`, `freistellung_nachweis`, `freistellung_gueltig_bis` zu `erp_kunden` hinzufuegen
- UI in Kunden-Detailansicht erweitern

---

## 2. Fehlende Datenbank-Tabellen

### 2.1 Reparatur-System ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `repairs` | Haupt-Reparaturtabelle mit Status und Prioritaet | Hoch |
| `repair_parts` | Ersatzteile fuer Reparaturen | Mittel |
| `repair_notes` | Notizen zu Reparaturen | Mittel |
| `repair_photos` | Fotos von Reparaturen (Supabase Storage) | Mittel |

**ERP Schema:**
```typescript
Repair {
  id, ticketNumber, customerId, projectId,
  description, status: RepairStatus,
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
}
```

**Hinweis:** Das Frontend hat bereits `Reparaturen.jsx` (94 KB!) - moeglicherweise teilweise implementiert.

---

### 2.2 Termin-System ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `appointments` | Termine (Aufmass, Montage, Reparatur, Lieferung) | Hoch |

**ERP Schema:**
```typescript
Appointment {
  id, type: AppointmentType,
  projectId, repairId,
  title, description,
  plannedStart, plannedEnd,
  actualStart, actualEnd,
  assignedToId, teamId,
  status: AppointmentStatus,
  customerNotified, reminderSent, notes
}
```

**Status Auftragsmanagement:**
- `auftrag_status` hat nur `montage_geplant` (Datum)
- Kein vollstaendiges Termin-Management

---

### 2.3 User-Management ❌
| Tabelle | Zweck | Prioritaet |
|---------|-------|------------|
| `users` | Benutzer mit Rollen | Niedrig |

**ERP Schema:**
```typescript
User {
  id, email, name,
  role: 'ADMIN' | 'OFFICE' | 'TECHNICIAN' | 'USER'
}
```

**Status Auftragsmanagement:**
- Keine Rollen-basierte Zugriffskontrolle
- Aktuell: Service Role fuer alle Operationen

---

### 2.4 Margin-Approval-System ❌
| Feature | Zweck | Prioritaet |
|---------|-------|------------|
| Margin-Kontrolle | Genehmigung bei niedrigen Margen | Niedrig |

**ERP Logik:**
- `MARGIN_TARGET = 30%`
- `MARGIN_CRITICAL = 10%`
- Genehmigungsworkflow bei Unterschreitung
- Felder: `marginApprovedPercent`, `marginApprovedBy`, `marginApprovedAt`

---

## 3. Technologie-Unterschiede

| Aspekt | ERP-System | Auftragsmanagement |
|--------|------------|-------------------|
| **Sprache** | TypeScript | JavaScript |
| **React Version** | React 18 | React 19 |
| **Vite Version** | Vite 5 | Vite 5/7 |
| **Backend** | Kein lokales Backend | Express.js |
| **Datenbank-Zugriff** | Direkt via Supabase Client | Backend-Proxy + Supabase |
| **Edge Functions** | Keine | 10 Functions |
| **SQL Migrations** | Keine (implizit in TypeScript) | 6 versionierte Migrations |
| **RLS Policies** | Keine | Implementiert |

**Empfehlung:**
- Auftragsmanagement-Architektur beibehalten (Backend + Edge Functions)
- Bei Bedarf: TypeScript Migration fuer bessere Typsicherheit

---

## 4. Priorisierte Roadmap

### Phase 1: Kern-Features (Hoch)
1. [ ] Lieferanten-Verwaltung
2. [ ] Bestellungen-Management
3. [ ] Reparatur-System (Tabellen + UI)
4. [ ] Termin-System (appointments Tabelle)

### Phase 2: Erweiterungen (Mittel)
5. [ ] Kalender mit FullCalendar
6. [ ] Erweiterte Dokumente mit Positionseditor
7. [ ] PDF-Export fuer Dokumente

### Phase 3: Nice-to-Have (Niedrig)
8. [ ] Datensicherung (Export/Import)
9. [ ] Kunden-Besteuerung
10. [ ] User-Management mit Rollen
11. [ ] Margin-Approval-System

---

## 5. Geschaetzter Gesamtaufwand

| Phase | Features | Stunden |
|-------|----------|---------|
| Phase 1 | 4 Features | 20-30 |
| Phase 2 | 3 Features | 18-25 |
| Phase 3 | 4 Features | 10-15 |
| **Gesamt** | 11 Features | **48-70 Stunden** |

---

## Anhang: ERP-System Code-Pfade

```
erp-system-vite/
├── src/
│   ├── pages/
│   │   ├── SuppliersPage.tsx      # Lieferanten
│   │   ├── OrdersPage.tsx         # Bestellungen
│   │   ├── CalendarPage.tsx       # Kalender
│   │   ├── DocumentsPage.tsx      # Dokumente
│   │   ├── DocumentDetailPage.tsx # Dokument-Detail
│   │   ├── CustomersPage.tsx      # Kunden
│   │   ├── SettingsPage.tsx       # Einstellungen
│   │   └── DashboardPage.tsx      # Dashboard
│   └── lib/
│       └── supabase.ts            # Schema-Definitionen
└── (kein Backend)
```

---

*Dokument erstellt von Claude Code am 2026-02-06*
