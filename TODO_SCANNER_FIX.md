# TODO: Scanner Webhook Problem beheben

> **Erstellt:** 2026-01-24
> **Status:** OFFEN
> **Prioritaet:** HOCH

---

## Problem-Zusammenfassung

Seit dem **22.01.2026** kommen keine neuen Scanner-Dokumente mehr in der Datenbank an.

### Ursache (behoben)
- `process-document` Edge Function hatte 500-Fehler wegen `imagescript` npm-Import
- **Fix v27 deployed** am 24.01.2026 - Edge Function laeuft wieder

### Noch offen
- **Dokumente seit 22.01. fehlen** - wurden gescannt aber nicht verarbeitet
- ScannerWatcher hat 3x Retry gemacht, dann aufgegeben
- Dateien liegen vermutlich noch im Scanner-Ordner auf Server "dc"

---

## Server-Zugriff

| Info | Wert |
|------|------|
| Server | `dc` |
| Scanner-Ordner | `D:\Daten\Dokumente\Scanner` |
| Watcher-Script | `C:\Scripts\Scanner_Webhook\ScannerWatcher.ps1` |
| Log-Datei | `C:\Scripts\Scanner_Webhook\scanner_webhook.log` |
| Processed-Liste | `C:\Scripts\Scanner_Webhook\processed_files.txt` |

### Netzwerk-Problem (24.01.2026)
- RDP-Verbindung zum Server "dc" extrem langsam
- SMB/Admin-Shares nicht erreichbar (Fehler 1702 - RPC-Problem)
- Ping und RDP-Port 3389 sind OK

---

## Naechste Schritte

### 1. Server-Logs pruefen (auf dc per RDP)
```powershell
# Scanner-Webhook Log (zeigt 500er Fehler)
Get-Content C:\Scripts\Scanner_Webhook\scanner_webhook.log -Tail 100

# Dateien im Scanner-Ordner (nicht verarbeitete Scans)
Get-ChildItem D:\Daten\Dokumente\Scanner | Sort-Object LastWriteTime -Descending | Select-Object -First 30

# Verarbeitete Dateien (sollten NICHT die fehlenden enthalten)
Get-Content C:\Scripts\Scanner_Webhook\processed_files.txt -Tail 20
```

### 2. Fehlende Dateien erneut senden
Option A: ScannerWatcher neu starten (verarbeitet nur NEUE Dateien)
```powershell
Stop-ScheduledTask -TaskName 'ScannerWebhookWatcher'
Start-ScheduledTask -TaskName 'ScannerWebhookWatcher'
```

Option B: Dateien manuell erneut triggern (touch/copy)
```powershell
# Alle PDFs im Scanner-Ordner "anfassen" um Watcher zu triggern
Get-ChildItem D:\Daten\Dokumente\Scanner\*.pdf | ForEach-Object {
    Copy-Item $_.FullName "$($_.FullName).tmp"
    Move-Item "$($_.FullName).tmp" $_.FullName -Force
}
```

Option C: Script erweitern um Retry-Queue (langfristig)

### 3. Verifizieren
```sql
-- Neue Scanner-Dokumente nach dem Fix pruefen
SELECT id, kategorie, created_at, processing_status
FROM documents
WHERE source = 'scanner'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Technische Details

### Edge Function Fix (erledigt)
- **Problem:** `npm:imagescript@1.3.0` nicht kompatibel mit Deno/Edge Functions
- **Fix:** Import entfernt, Komprimierung deaktiviert (v27)
- **Commit:** `c5afcad` am 24.01.2026

### ScannerWatcher Architektur
```
Scanner-Ordner (D:\Daten\Dokumente\Scanner)
    |
    v
ScannerWatcher.ps1 (FileSystemWatcher)
    |
    | POST multipart/form-data + x-api-key
    v
process-document Edge Function (Supabase)
    |
    v
Supabase Storage + PostgreSQL
```

### Retry-Logik im Watcher
- 3 HTTP-Versuche mit Exponential Backoff (2s, 4s, 8s)
- Bei 401 (Auth): Sofort abbrechen
- Bei 500: Alle Retries, dann FEHLER loggen
- Datei wird NICHT in processed_files.txt geschrieben bei Fehler
- ABER: Watcher reagiert nur auf NEUE Dateien (Created-Event)

---

## Kontext-Dateien

| Datei | Pfad |
|-------|------|
| Edge Function | `Auftragsmanagement/supabase/functions/process-document/index.ts` |
| Watcher Script | `KI_Automation/tools/Scanner_Webhook/ScannerWatcher.ps1` |
| Watcher README | `KI_Automation/tools/Scanner_Webhook/README.md` |

---

*Beim naechsten Session-Start: "Scanner-Problem fixen" oder "TODO Scanner" sagen*
