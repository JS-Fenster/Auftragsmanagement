/**
 * SYNC W4A ANGEBOTS-POSITIONEN NACH SUPABASE
 * ============================================
 *
 * Synchronisiert Angebote + Positionen aus Work4All nach Supabase.
 * Ergaenzt das bestehende sync-positions-to-supabase.js (Rechnungen)
 * um Angebotspositionen fuer das Leistungsverzeichnis.
 *
 * Ziel-Tabelle: erp_angebots_positionen
 *
 * Verwendung:
 *   node sync-angebots-positionen.js           # Normaler Sync
 *   node sync-angebots-positionen.js --force   # Alle neu synchen
 *   node sync-angebots-positionen.js --dry-run # Nur anzeigen
 *
 * Erstellt: 2026-02-05
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
    DATE_FROM: '2024-01-01',        // Ab diesem Datum (breiter als Rechnungen)
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT', 'Fenster', 'Tuer', 'Tür', 'Haustür', 'Haustuer'],
    BATCH_SIZE: 50,
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

    if (response.status === 204 || (options.headers.Prefer && options.headers.Prefer.includes('return=minimal'))) {
        return null;
    }

    return await response.json();
}

async function getExistingQuoteCodes() {
    const data = await supabaseRequest(
        'erp_angebots_positionen?select=angebot_code',
        'GET',
        null,
        { 'Prefer': 'return=representation' }
    );

    return new Set(data.map(r => r.angebot_code));
}

// =============================================================================
// W4A QUERIES
// =============================================================================

async function fetchQuotesFromW4A(pool) {
    const keywordConditions = CONFIG.KEYWORDS.map(k => `Notiz LIKE '%${k}%'`).join(' OR ');

    const result = await pool.request().query(`
        SELECT
            Code,
            Nummer,
            Datum,
            ProjektCode,
            SDObjMemberCode AS KundenCode,
            Wert,
            AuftragsDatum,
            AuftragsNummer,
            CAST(Notiz AS NVARCHAR(500)) AS Notiz,
            InsertTime,
            UpdateTime
        FROM dbo.Angebot
        WHERE Datum >= '${CONFIG.DATE_FROM}'
          AND (${keywordConditions})
        ORDER BY Datum DESC
    `);

    return result.recordset;
}

async function fetchPositionsForQuote(pool, quoteCode) {
    const result = await pool.request()
        .input('quoteCode', sql.Int, quoteCode)
        .query(`
            SELECT
                PozNr,
                Bezeichnung,
                CAST(Bemerkung AS NVARCHAR(MAX)) AS Langtext,
                Anzahl,
                EinzPreis,
                GesPreis
            FROM dbo.Positionen
            WHERE BZObjType = 6 AND BZObjMemberCode = @quoteCode
            ORDER BY Code
        `);

    return result.recordset;
}

// =============================================================================
// SYNC LOGIK
// =============================================================================

async function syncQuote(pool, quote, existingCodes) {
    if (!CONFIG.FORCE && existingCodes.has(quote.Code)) {
        return { status: 'skipped', reason: 'already_synced' };
    }

    const positions = await fetchPositionsForQuote(pool, quote.Code);

    if (positions.length === 0) {
        return { status: 'skipped', reason: 'no_positions' };
    }

    if (CONFIG.DRY_RUN) {
        return {
            status: 'dry_run',
            positions: positions.length
        };
    }

    // Angebot in erp_angebote upserten (notiz hinzufuegen)
    const quoteData = {
        code: quote.Code,
        nummer: quote.Nummer,
        datum: quote.Datum ? quote.Datum.toISOString().split('T')[0] : null,
        projekt_code: quote.ProjektCode,
        kunden_code: quote.KundenCode,
        wert: quote.Wert,
        auftrags_datum: quote.AuftragsDatum ? quote.AuftragsDatum.toISOString().split('T')[0] : null,
        auftrags_nummer: quote.AuftragsNummer,
        notiz: quote.Notiz,
        erp_insert_time: quote.InsertTime,
        erp_update_time: quote.UpdateTime,
    };

    await supabaseRequest('erp_angebote', 'POST', quoteData, {
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    });

    // Positionen speichern
    const positionData = positions.map(p => ({
        angebot_code: quote.Code,
        angebot_nummer: String(quote.Nummer),
        pos_nr: String(p.PozNr || ''),
        bezeichnung: p.Bezeichnung,
        langtext: p.Langtext,
        anzahl: p.Anzahl,
        einz_preis: p.EinzPreis,
        ges_preis: p.GesPreis,
        synced_at: new Date().toISOString()
    }));

    // Alte Positionen loeschen bei --force
    if (CONFIG.FORCE && existingCodes.has(quote.Code)) {
        await supabaseRequest(
            `erp_angebots_positionen?angebot_code=eq.${quote.Code}`,
            'DELETE'
        );
    }

    // Batch insert
    for (let i = 0; i < positionData.length; i += 100) {
        const batch = positionData.slice(i, i + 100);
        await supabaseRequest('erp_angebots_positionen', 'POST', batch);
    }

    return {
        status: 'synced',
        positions: positions.length
    };
}

// =============================================================================
// HAUPTPROGRAMM
// =============================================================================

async function main() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  SYNC W4A ANGEBOTS-POSITIONEN NACH SUPABASE`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Datum ab:      ${CONFIG.DATE_FROM}`);
    console.log(`  Keywords:      ${CONFIG.KEYWORDS.join(', ')}`);
    console.log(`  Force-Mode:    ${CONFIG.FORCE ? 'Ja' : 'Nein'}`);
    console.log(`  Dry-Run:       ${CONFIG.DRY_RUN ? 'Ja' : 'Nein'}`);
    console.log(`${'='.repeat(70)}\n`);

    console.log('[1/4] Verbinde mit W4A...');
    const pool = await getW4APool();
    console.log('      W4A verbunden\n');

    console.log('[2/4] Pruefe bereits synchronisierte Angebote...');
    const existingCodes = await getExistingQuoteCodes();
    console.log(`      ${existingCodes.size} Angebote bereits in Supabase\n`);

    console.log('[3/4] Hole Angebote aus W4A ab ' + CONFIG.DATE_FROM + '...');
    const quotes = await fetchQuotesFromW4A(pool);
    console.log(`      ${quotes.length} Angebote mit Keywords gefunden\n`);

    if (quotes.length === 0) {
        console.log('Keine passenden Angebote gefunden.');
        await closeW4APool();
        return;
    }

    console.log('[4/4] Synchronisiere...\n');

    const stats = {
        total: quotes.length,
        synced: 0,
        skipped_existing: 0,
        skipped_no_positions: 0,
        dry_run: 0,
        errors: 0,
        positions_total: 0
    };

    for (let i = 0; i < quotes.length; i++) {
        const q = quotes[i];
        const progress = `[${String(i + 1).padStart(4)}/${quotes.length}]`;

        process.stdout.write(`${progress} Ang ${q.Nummer}... `);

        try {
            const result = await syncQuote(pool, q, existingCodes);

            switch (result.status) {
                case 'synced':
                    console.log(`${result.positions} Pos. synced`);
                    stats.synced++;
                    stats.positions_total += result.positions;
                    break;
                case 'skipped':
                    if (result.reason === 'already_synced') {
                        console.log('bereits vorhanden');
                        stats.skipped_existing++;
                    } else {
                        console.log('keine Positionen');
                        stats.skipped_no_positions++;
                    }
                    break;
                case 'dry_run':
                    console.log(`${result.positions} Pos. (dry-run)`);
                    stats.dry_run++;
                    stats.positions_total += result.positions;
                    break;
            }
        } catch (error) {
            console.log(`FEHLER: ${error.message}`);
            stats.errors++;
        }
    }

    await closeW4APool();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ZUSAMMENFASSUNG`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Angebote gesamt:          ${stats.total}`);
    console.log(`  Erfolgreich synced:       ${stats.synced}`);
    console.log(`  Uebersprungen (existing): ${stats.skipped_existing}`);
    console.log(`  Uebersprungen (no pos):   ${stats.skipped_no_positions}`);
    if (CONFIG.DRY_RUN) {
        console.log(`  Dry-Run (wuerde syncen):  ${stats.dry_run}`);
    }
    console.log(`  Fehler:                   ${stats.errors}`);
    console.log(`  Positionen gesamt:        ${stats.positions_total}`);
    console.log(`${'='.repeat(70)}\n`);
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    closeW4APool().catch(() => {});
    process.exit(1);
});
