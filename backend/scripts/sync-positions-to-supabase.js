/**
 * SYNC W4A RECHNUNGS-POSITIONEN NACH SUPABASE
 * ============================================
 *
 * Synchronisiert Rechnungen ab 2025-01-01 aus Work4All nach Supabase.
 * Holt die zugehoerigen Positionen (Fenster/Tueren) und speichert sie in:
 *   - erp_rechnungen (mit notiz-Feld)
 *   - erp_rechnungs_positionen
 *
 * Verwendet:
 *   - W4A SQL Server via Cloudflare Tunnel (backend/config/w4a-database.js)
 *   - Supabase REST API (SUPABASE_URL, SUPABASE_SERVICE_KEY aus .env)
 *
 * Verwendung:
 *   node sync-positions-to-supabase.js           # Normaler Sync
 *   node sync-positions-to-supabase.js --force   # Alle neu synchen (auch bereits vorhandene)
 *   node sync-positions-to-supabase.js --dry-run # Nur anzeigen, nichts speichern
 *
 * Erstellt: 2026-02-05 (LOG-030)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// =============================================================================
// KONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('FEHLER: SUPABASE_URL und SUPABASE_SERVICE_KEY muessen in .env gesetzt sein');
    process.exit(1);
}

const CONFIG = {
    DATE_FROM: '2023-01-01',        // Ab diesem Datum synchen (erweitert P014)
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT'],  // Fenster/Tueren Keywords
    BATCH_SIZE: 50,                  // Rechnungen pro Batch
    DRY_RUN: process.argv.includes('--dry-run'),
    FORCE: process.argv.includes('--force'),
};

// =============================================================================
// SUPABASE HELPER
// =============================================================================

async function supabaseRequest(endpoint, method = 'GET', body = null, headers = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
            ...headers
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase ${method} ${endpoint}: ${response.status} - ${errorText}`);
    }

    // Bei 204 No Content oder return=minimal kein Body
    if (response.status === 204 || (options.headers.Prefer && options.headers.Prefer.includes('return=minimal'))) {
        return null;
    }

    return await response.json();
}

async function getExistingInvoiceCodes() {
    // Hole alle rechnung_code die bereits Positionen haben
    const data = await supabaseRequest(
        'erp_rechnungs_positionen?select=rechnung_code',
        'GET',
        null,
        { 'Prefer': 'return=representation' }
    );

    return new Set(data.map(r => r.rechnung_code));
}

async function upsertInvoice(invoice) {
    await supabaseRequest('erp_rechnungen', 'POST', invoice, {
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    });
}

async function insertPositions(positions) {
    if (positions.length === 0) return;

    // Bulk insert
    await supabaseRequest('erp_rechnungs_positionen', 'POST', positions);
}

// =============================================================================
// W4A QUERIES
// =============================================================================

async function fetchInvoicesFromW4A(pool) {
    // Baue Keyword-Filter: Notiz enthaelt mindestens eines der Keywords
    const keywordConditions = CONFIG.KEYWORDS.map(k => `Notiz LIKE '%${k}%'`).join(' OR ');

    const result = await pool.request().query(`
        SELECT
            Code,
            Nummer,
            Datum,
            ProjektCode,
            SDObjMemberCode AS KundenCode,
            Wert,
            Bruttowert,
            Notiz,
            InsertTime,
            UpdateTime,
            ZahlbarBis,
            Zahlungsfrist
        FROM dbo.Rechnung
        WHERE Datum >= '${CONFIG.DATE_FROM}'
          AND (${keywordConditions})
        ORDER BY Datum DESC
    `);

    return result.recordset;
}

async function fetchPositionsForInvoice(pool, invoiceCode) {
    const result = await pool.request()
        .input('invoiceCode', sql.Int, invoiceCode)
        .query(`
            SELECT
                PozNr,
                Bezeichnung,
                CAST(Bemerkung AS NVARCHAR(MAX)) AS Langtext,
                Anzahl,
                EinzPreis,
                GesPreis
            FROM dbo.Positionen
            WHERE BZObjType = 7 AND BZObjMemberCode = @invoiceCode
            ORDER BY Code
        `);

    return result.recordset;
}

// =============================================================================
// SYNC LOGIK
// =============================================================================

async function syncInvoice(pool, invoice, existingCodes) {
    // Skip wenn bereits vorhanden und nicht --force
    if (!CONFIG.FORCE && existingCodes.has(invoice.Code)) {
        return { status: 'skipped', reason: 'already_synced' };
    }

    // Positionen holen
    const positions = await fetchPositionsForInvoice(pool, invoice.Code);

    if (positions.length === 0) {
        return { status: 'skipped', reason: 'no_positions' };
    }

    // Fenster-relevante Positionen filtern (Keywords in Bezeichnung oder Langtext)
    const relevantPositions = positions.filter(p => {
        const text = `${p.Bezeichnung || ''} ${p.Langtext || ''}`.toUpperCase();
        return CONFIG.KEYWORDS.some(kw => text.includes(kw));
    });

    if (relevantPositions.length === 0 && positions.length > 0) {
        // Hat Positionen, aber keine Fenster-relevanten - trotzdem speichern
        // da Notiz ja Keywords enthaelt
    }

    if (CONFIG.DRY_RUN) {
        return {
            status: 'dry_run',
            positions: positions.length,
            relevant: relevantPositions.length
        };
    }

    // 1. Rechnung in erp_rechnungen upserten
    const invoiceData = {
        code: invoice.Code,
        nummer: invoice.Nummer,
        datum: invoice.Datum ? invoice.Datum.toISOString().split('T')[0] : null,
        projekt_code: invoice.ProjektCode,
        kunden_code: invoice.KundenCode,
        wert: invoice.Wert,
        bruttowert: invoice.Bruttowert,
        notiz: invoice.Notiz,
        zahlbar_bis: invoice.ZahlbarBis ? invoice.ZahlbarBis.toISOString().split('T')[0] : null,
        zahlungsfrist: invoice.Zahlungsfrist,
        erp_insert_time: invoice.InsertTime,
        erp_update_time: invoice.UpdateTime,
        synced_at: new Date().toISOString()
    };

    await upsertInvoice(invoiceData);

    // 2. Positionen in erp_rechnungs_positionen speichern
    const positionData = positions.map(p => ({
        rechnung_code: invoice.Code,
        rechnung_nummer: String(invoice.Nummer),
        pos_nr: String(p.PozNr || ''),
        bezeichnung: p.Bezeichnung,
        langtext: p.Langtext,
        anzahl: p.Anzahl,
        einz_preis: p.EinzPreis,
        ges_preis: p.GesPreis,
        synced_at: new Date().toISOString()
    }));

    // Alte Positionen erst loeschen (falls --force)
    if (CONFIG.FORCE && existingCodes.has(invoice.Code)) {
        await supabaseRequest(
            `erp_rechnungs_positionen?rechnung_code=eq.${invoice.Code}`,
            'DELETE'
        );
    }

    await insertPositions(positionData);

    return {
        status: 'synced',
        positions: positions.length,
        relevant: relevantPositions.length
    };
}

// =============================================================================
// HAUPTPROGRAMM
// =============================================================================

async function main() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  SYNC W4A RECHNUNGS-POSITIONEN NACH SUPABASE`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Datum ab:      ${CONFIG.DATE_FROM}`);
    console.log(`  Keywords:      ${CONFIG.KEYWORDS.join(', ')}`);
    console.log(`  Force-Mode:    ${CONFIG.FORCE ? 'Ja (alle neu synchen)' : 'Nein (nur neue)'}`);
    console.log(`  Dry-Run:       ${CONFIG.DRY_RUN ? 'Ja (nichts speichern)' : 'Nein'}`);
    console.log(`${'='.repeat(70)}\n`);

    // Verbindungen aufbauen
    console.log('[1/4] Verbinde mit W4A...');
    const pool = await getW4APool();
    console.log('      W4A verbunden\n');

    console.log('[2/4] Pruefe bereits synchronisierte Rechnungen in Supabase...');
    const existingCodes = await getExistingInvoiceCodes();
    console.log(`      ${existingCodes.size} Rechnungen bereits in Supabase\n`);

    // Rechnungen aus W4A holen
    console.log('[3/4] Hole Rechnungen aus W4A ab ' + CONFIG.DATE_FROM + '...');
    const invoices = await fetchInvoicesFromW4A(pool);
    console.log(`      ${invoices.length} Rechnungen mit Keywords gefunden\n`);

    if (invoices.length === 0) {
        console.log('Keine passenden Rechnungen gefunden.');
        await closeW4APool();
        return;
    }

    // Sync durchfuehren
    console.log('[4/4] Synchronisiere...\n');

    const stats = {
        total: invoices.length,
        synced: 0,
        skipped_existing: 0,
        skipped_no_positions: 0,
        dry_run: 0,
        errors: 0,
        positions_total: 0
    };

    for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const progress = `[${String(i + 1).padStart(4)}/${invoices.length}]`;

        process.stdout.write(`${progress} Rg ${inv.Nummer}... `);

        try {
            const result = await syncInvoice(pool, inv, existingCodes);

            switch (result.status) {
                case 'synced':
                    console.log(`${result.positions} Pos. synced (${result.relevant} relevant)`);
                    stats.synced++;
                    stats.positions_total += result.positions;
                    break;
                case 'skipped':
                    if (result.reason === 'already_synced') {
                        console.log('bereits vorhanden (skip)');
                        stats.skipped_existing++;
                    } else if (result.reason === 'no_positions') {
                        console.log('keine Positionen (skip)');
                        stats.skipped_no_positions++;
                    }
                    break;
                case 'dry_run':
                    console.log(`${result.positions} Pos. (dry-run, ${result.relevant} relevant)`);
                    stats.dry_run++;
                    stats.positions_total += result.positions;
                    break;
            }

        } catch (error) {
            console.log(`FEHLER: ${error.message}`);
            stats.errors++;
        }
    }

    // Aufraumen
    await closeW4APool();

    // Zusammenfassung
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ZUSAMMENFASSUNG`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Rechnungen gesamt:        ${stats.total}`);
    console.log(`  Erfolgreich synced:       ${stats.synced}`);
    console.log(`  Uebersprungen (existing): ${stats.skipped_existing}`);
    console.log(`  Uebersprungen (no pos):   ${stats.skipped_no_positions}`);
    if (CONFIG.DRY_RUN) {
        console.log(`  Dry-Run (wuerde syncen):  ${stats.dry_run}`);
    }
    console.log(`  Fehler:                   ${stats.errors}`);
    console.log(`  Positionen gesamt:        ${stats.positions_total}`);
    console.log(`${'='.repeat(70)}\n`);

    if (CONFIG.DRY_RUN) {
        console.log('DRY-RUN: Keine Daten wurden gespeichert.');
        console.log('Fuehre ohne --dry-run aus um zu synchronisieren.\n');
    }
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    closeW4APool().catch(() => {});
    process.exit(1);
});
