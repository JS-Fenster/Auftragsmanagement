# TODO: Scanner Webhook Problem beheben

> **Erstellt:** 2026-01-24
> **Aktualisiert:** 2026-01-28
> **Status:** TEILWEISE ERLEDIGT
> **Prioritaet:** MITTEL

## ✅ Erledigt am 28.01.2026

- **Problem:** Edge Function hatte JWT-Verifikation aktiviert → blockierte API-Key Requests
- **Fix:** `process-document` mit `--no-verify-jwt` neu deployed
- **Fix:** `SCANNER_API_KEY` in Supabase Secrets korrekt gesetzt
- **Ergebnis:** Scanner Watcher laeuft wieder, neue Dateien werden verarbeitet

## ⏳ Noch offen

- Fehlende Dateien vom 22.-23.01. aus W4A nachholen (ca. 40+ Dateien)

---

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

## Fehlgeschlagene Dateien (22.-23.01.2026)

Aus dem Log `scanner_webhook.log` extrahiert - diese Dateien wurden NICHT verarbeitet:

### 22.01.2026 (ab ~13:07 Uhr)
```
39303.jpg
39300.jpg
Gurtführung.pdf
20260122144419.pdf
IMG-20260122-WA0005.jpg
IMG-20260122-WA0003.jpg
DFK Schimmel_Schlosser.pdf
R18531 - P17150 - Schlosser - DKF - 2018.11.rtf
20260122154617.pdf
20260122154634.pdf
```

### 23.01.2026 (ganzer Tag)
```
LS Kadeco LV.pdf
LS Steinau.pdf
20260123093047.pdf
1.jpg, 2.jpg, 3.jpg, 4.jpg (Bildserie bis 16.jpg)
DKF Mittelverschluss_Melczer.pdf
20260123095707.pdf
20260123104533.pdf
Kindergarten.pdf
20260123111941.pdf
20260123112036.pdf
20260123113429.pdf
Skizze_HT_Spörl.pdf
20260123120336.pdf
20260123120550.pdf
20260123122832.pdf
Rechnung UTA.pdf
20260123153418.pdf
20260123154435.pdf
RP Götz.pdf
20260123155312.pdf
20260123162551.pdf
20260123162742.pdf
PDF_1_0001.pdf
PDF_1_0002.pdf
```

**WICHTIG:** Der Scanner-Ordner wird nach Verarbeitung geleert!
Die Dateien wurden ins W4A verschoben: `\\appserver\Work4all`

---

## Naechste Schritte

### 1. W4A-Ordner durchsuchen (PRIORITAET!)

Die Originaldateien liegen vermutlich im W4A-Archiv:

```powershell
# Auf appserver oder mit Netzwerkzugriff ausfuehren
# Dateien vom 22./23. Januar im W4A suchen
Get-ChildItem "\\appserver\Work4all" -Recurse -File |
    Where-Object { $_.LastWriteTime -ge "2026-01-22" -and $_.LastWriteTime -lt "2026-01-24" } |
    Select-Object FullName, LastWriteTime, Length |
    Sort-Object LastWriteTime |
    Export-Csv "C:\temp\w4a_dateien_22-23jan.csv" -NoTypeInformation -Encoding UTF8

# Alternativ: Nach spezifischen Dateinamen suchen
$suchbegriffe = @("Gurtführung", "Kadeco", "Steinau", "Kindergarten", "Rechnung UTA", "RP Götz", "Skizze_HT")
Get-ChildItem "\\appserver\Work4all" -Recurse -File |
    Where-Object { $name = $_.Name; $suchbegriffe | Where-Object { $name -like "*$_*" } } |
    Select-Object FullName, LastWriteTime
```

### 2. Gefundene Dateien erneut senden

```powershell
# Dateien in Scanner-Ordner kopieren (triggert Watcher)
$quelldateien = Get-Content "C:\temp\gefundene_dateien.txt"
$zielordner = "D:\Daten\Dokumente\Scanner"

foreach ($datei in $quelldateien) {
    Copy-Item $datei $zielordner -Verbose
    Start-Sleep -Seconds 3  # Watcher Zeit geben
}
```

### 3. Server-Logs pruefen (auf dc per RDP)
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
