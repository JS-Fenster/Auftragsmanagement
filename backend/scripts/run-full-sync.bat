@echo off
REM ==============================================================================
REM W4A -> Supabase Full Sync
REM Laeuft auf dem Appserver — direkter DB-Zugriff, kein Tunnel.
REM Geplanter Task: Taeglich um 02:00
REM
REM Aufruf:
REM   run-full-sync.bat              # Normaler Sync
REM   run-full-sync.bat --force      # Alle neu synchen
REM   run-full-sync.bat --dry-run    # Nur anzeigen
REM ==============================================================================

setlocal
set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%..
set FLAGS=%*
set LOG_DIR=%SCRIPT_DIR%logs
set LOG_FILE=%LOG_DIR%\sync_%date:~6,4%-%date:~3,2%-%date:~0,2%.log

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ====================================================================== >> "%LOG_FILE%"
echo   W4A FULL SYNC                                                       >> "%LOG_FILE%"
echo   %date% %time%                                                       >> "%LOG_FILE%"
echo   Flags: %FLAGS%                                                      >> "%LOG_FILE%"
echo ====================================================================== >> "%LOG_FILE%"

cd /d "%BACKEND_DIR%"

echo [1/5] STAMMDATEN >> "%LOG_FILE%"
node scripts\sync-stammdaten.js %FLAGS% >> "%LOG_FILE%" 2>&1
if errorlevel 1 echo [FEHLER] Stammdaten-Sync fehlgeschlagen >> "%LOG_FILE%"

echo [2/5] RECHNUNGEN >> "%LOG_FILE%"
node scripts\sync-positions-to-supabase.js %FLAGS% >> "%LOG_FILE%" 2>&1
if errorlevel 1 echo [FEHLER] Rechnungs-Sync fehlgeschlagen >> "%LOG_FILE%"

echo [3/5] ANGEBOTE >> "%LOG_FILE%"
node scripts\sync-angebots-positionen.js %FLAGS% >> "%LOG_FILE%" 2>&1
if errorlevel 1 echo [FEHLER] Angebots-Sync fehlgeschlagen >> "%LOG_FILE%"

echo [4/5] LEISTUNGSVERZEICHNIS >> "%LOG_FILE%"
node scripts\build-leistungsverzeichnis.js %FLAGS% >> "%LOG_FILE%" 2>&1
if errorlevel 1 echo [FEHLER] LV-Build fehlgeschlagen >> "%LOG_FILE%"

echo [5/5] HEALTH CHECK >> "%LOG_FILE%"
node scripts\sync-healthcheck.js >> "%LOG_FILE%" 2>&1

echo ====================================================================== >> "%LOG_FILE%"
echo   SYNC ABGESCHLOSSEN - %date% %time%                                  >> "%LOG_FILE%"
echo ====================================================================== >> "%LOG_FILE%"

endlocal
