const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

// Pfad zum Sync-Script (relativ zum Backend-Ordner)
const SYNC_SCRIPT_PATH = path.join(__dirname, '..', '..', 'sync', 'sync_to_supabase.py');

// Aktiver Sync-Prozess (nur einer gleichzeitig)
let activeSyncProcess = null;
let lastSyncResult = null;

/**
 * POST /api/sync
 * Startet den ERP -> Supabase Sync
 */
router.post('/', async (req, res) => {
    // Pruefen ob bereits ein Sync laeuft
    if (activeSyncProcess) {
        return res.status(409).json({
            success: false,
            message: 'Ein Sync-Prozess laeuft bereits',
            status: 'running'
        });
    }

    console.log('Starte ERP -> Supabase Sync...');

    const startTime = Date.now();
    let output = '';
    let errorOutput = '';

    try {
        // Python-Script starten
        activeSyncProcess = spawn('python', [SYNC_SCRIPT_PATH], {
            cwd: path.dirname(SYNC_SCRIPT_PATH),
            env: { ...process.env }
        });

        // Stdout sammeln
        activeSyncProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log('[SYNC]', text.trim());
        });

        // Stderr sammeln
        activeSyncProcess.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error('[SYNC ERROR]', text.trim());
        });

        // Warten bis Prozess beendet
        const exitCode = await new Promise((resolve) => {
            activeSyncProcess.on('close', (code) => {
                resolve(code);
            });
            activeSyncProcess.on('error', (err) => {
                console.error('[SYNC] Prozess-Fehler:', err);
                resolve(-1);
            });
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Ergebnis speichern
        lastSyncResult = {
            success: exitCode === 0,
            exitCode,
            duration: `${duration}s`,
            timestamp: new Date().toISOString(),
            output: output.slice(-2000), // Letzte 2000 Zeichen
            errorOutput: errorOutput.slice(-500)
        };

        activeSyncProcess = null;

        if (exitCode === 0) {
            console.log(`Sync erfolgreich abgeschlossen in ${duration}s`);
            res.json({
                success: true,
                message: 'Sync erfolgreich abgeschlossen',
                duration: lastSyncResult.duration,
                timestamp: lastSyncResult.timestamp
            });
        } else {
            console.error(`Sync fehlgeschlagen mit Exit-Code ${exitCode}`);
            res.status(500).json({
                success: false,
                message: 'Sync fehlgeschlagen',
                exitCode,
                error: errorOutput.slice(-500) || 'Unbekannter Fehler'
            });
        }

    } catch (error) {
        activeSyncProcess = null;
        console.error('Sync Fehler:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Starten des Sync',
            error: error.message
        });
    }
});

/**
 * GET /api/sync/status
 * Gibt den aktuellen Sync-Status zurueck
 */
router.get('/status', (req, res) => {
    if (activeSyncProcess) {
        res.json({
            status: 'running',
            message: 'Sync laeuft...'
        });
    } else if (lastSyncResult) {
        res.json({
            status: lastSyncResult.success ? 'success' : 'failed',
            lastSync: lastSyncResult.timestamp,
            duration: lastSyncResult.duration,
            message: lastSyncResult.success ? 'Letzter Sync erfolgreich' : 'Letzter Sync fehlgeschlagen'
        });
    } else {
        res.json({
            status: 'idle',
            message: 'Noch kein Sync durchgefuehrt'
        });
    }
});

/**
 * GET /api/sync/last
 * Gibt Details des letzten Syncs zurueck
 */
router.get('/last', (req, res) => {
    if (!lastSyncResult) {
        return res.status(404).json({
            success: false,
            message: 'Noch kein Sync durchgefuehrt'
        });
    }
    res.json(lastSyncResult);
});

module.exports = router;
