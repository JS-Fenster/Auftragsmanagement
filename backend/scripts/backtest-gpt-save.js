/**
 * BACKTEST MIT GPT-EXTRAKTION + SPEICHERUNG IN SUPABASE
 * ======================================================
 * Extrahiert granulare Elementdaten und speichert sie in backtest_elements.
 *
 * Verwendung:
 *   node backtest-gpt-save.js [SAMPLE_SIZE]
 *
 * Beispiele:
 *   node backtest-gpt-save.js 10   # 10 Rechnungen
 *   node backtest-gpt-save.js 50   # 50 Rechnungen
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SAMPLE_SIZE = parseInt(process.argv[2]) || 10;

const CONFIG = {
    DATE_FROM: '2025-01-01',  // Ab 2025
    DATE_TO: '2025-12-31',
    MIN_BRUTTO: 1000,
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT', 'Fenster', 'Tuer'],
    DELAY_MS: 600,
};

// =============================================================================
// W4A Datenabfrage
// =============================================================================

async function fetchInvoices(pool, limit) {
    const keywordConditions = CONFIG.KEYWORDS.map(k => `Notiz LIKE '%${k}%'`).join(' OR ');

    const result = await pool.request().query(`
        SELECT TOP ${limit}
            Code,
            Nummer,
            Datum,
            Bruttowert,
            Notiz
        FROM dbo.Rechnung
        WHERE Datum >= '${CONFIG.DATE_FROM}'
          AND Datum <= '${CONFIG.DATE_TO}'
          AND Bruttowert >= ${CONFIG.MIN_BRUTTO}
          AND (${keywordConditions})
        ORDER BY NEWID()
    `);

    return result.recordset;
}

async function fetchPositions(pool, invoiceCode) {
    const result = await pool.request()
        .input('invoiceCode', sql.Int, invoiceCode)
        .query(`
            SELECT
                PozNr AS PosNr,
                Bezeichnung,
                CAST(Bemerkung AS NVARCHAR(MAX)) AS Langtext,
                Anzahl,
                EinzPreis,
                GesPreis AS GesamtPreis
            FROM dbo.Positionen
            WHERE BZObjType = 7 AND BZObjMemberCode = @invoiceCode
            ORDER BY Code
        `);

    return result.recordset;
}

// =============================================================================
// GPT Extraktion
// =============================================================================

async function extractWithGPT(positions, invoiceTotal) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-gpt-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions, invoice_total: invoiceTotal })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPT Fehler: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// =============================================================================
// Supabase Speicherung
// =============================================================================

async function saveElementsToSupabase(elements, invoiceNr, invoiceDate, invoiceBrutto, kontext, runId) {
    if (!elements || elements.length === 0) return 0;

    const rows = elements.map(e => ({
        invoice_nr: invoiceNr,
        invoice_date: invoiceDate ? invoiceDate.toISOString().split('T')[0] : null,
        invoice_brutto: invoiceBrutto,
        hersteller: kontext.hersteller || null,
        system: kontext.system || null,
        verglasung: kontext.verglasung || null,
        material: kontext.material || null,
        farbe_aussen: kontext.farbe_aussen || null,
        farbe_innen: kontext.farbe_innen || null,
        raum: e.raum || null,
        typ: e.typ || null,
        oeffnung: e.oeffnung || null,
        anzahl_fluegel: e.anzahl_fluegel || null,
        breite_mm: e.breite_mm || null,
        hoehe_mm: e.hoehe_mm || null,
        anzahl: e.anzahl || 1,
        einzelpreis: e.einzelpreis || null,
        gesamtpreis: e.gesamtpreis || null,
        backtest_run_id: runId
    }));

    const response = await fetch(`${SUPABASE_URL}/rest/v1/backtest_elements`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(rows)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase Insert Fehler: ${response.status} - ${errorText}`);
    }

    return rows.length;
}

// =============================================================================
// Hilfsfunktionen
// =============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRunId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// =============================================================================
// Hauptlogik
// =============================================================================

async function main() {
    const runId = generateRunId();

    console.log(`\n${'='.repeat(75)}`);
    console.log(`  GPT-BACKTEST MIT SPEICHERUNG`);
    console.log(`${'='.repeat(75)}`);
    console.log(`  Sample Size:    ${SAMPLE_SIZE} Rechnungen`);
    console.log(`  Run ID:         ${runId}`);
    console.log(`  Zeitraum:       ${CONFIG.DATE_FROM} bis ${CONFIG.DATE_TO}`);
    console.log(`${'='.repeat(75)}\n`);

    if (!SUPABASE_SERVICE_KEY) {
        console.error('FEHLER: SUPABASE_SERVICE_KEY nicht gesetzt in .env');
        process.exit(1);
    }

    const pool = await getW4APool();
    console.log('[W4A] Verbindung hergestellt\n');

    // 1. Rechnungen holen
    console.log('[1/3] Hole zufaellige Rechnungen...');
    const invoices = await fetchInvoices(pool, SAMPLE_SIZE);
    console.log(`      ${invoices.length} Rechnungen gefunden\n`);

    if (invoices.length === 0) {
        console.log('Keine passenden Rechnungen gefunden.');
        await closeW4APool();
        return;
    }

    // 2. Verarbeiten und speichern
    console.log('[2/3] Extrahiere und speichere...\n');

    let totalElements = 0;
    let totalTokens = 0;
    let successCount = 0;
    let errorCount = 0;

    const stats = {
        byHersteller: {},
        bySystem: {},
        byTyp: {},
        byFluegel: {}
    };

    for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const progress = `[${String(i + 1).padStart(2)}/${invoices.length}]`;

        process.stdout.write(`${progress} ${inv.Nummer}... `);

        try {
            const positions = await fetchPositions(pool, inv.Code);

            if (positions.length === 0) {
                console.log('keine Positionen');
                continue;
            }

            // GPT Extraktion
            const gptResult = await extractWithGPT(positions, inv.Bruttowert);
            const ext = gptResult.extraction;

            if (!ext || !ext.kontext) {
                console.log('GPT-Extraktion fehlgeschlagen');
                errorCount++;
                continue;
            }

            // Tokens zaehlen
            if (gptResult.meta?.tokens) {
                totalTokens += gptResult.meta.tokens.total_tokens || 0;
            }

            const elemente = ext.elemente || [];

            // In Supabase speichern
            const savedCount = await saveElementsToSupabase(
                elemente,
                inv.Nummer,
                inv.Datum,
                inv.Bruttowert,
                ext.kontext,
                runId
            );

            totalElements += savedCount;
            successCount++;

            // Statistiken sammeln
            const h = ext.kontext.hersteller || 'unknown';
            const s = ext.kontext.system || 'unknown';
            stats.byHersteller[h] = (stats.byHersteller[h] || 0) + elemente.length;
            stats.bySystem[`${h}/${s}`] = (stats.bySystem[`${h}/${s}`] || 0) + elemente.length;

            for (const e of elemente) {
                const typ = e.typ || 'unknown';
                const fluegel = e.anzahl_fluegel || 'unknown';
                stats.byTyp[typ] = (stats.byTyp[typ] || 0) + 1;
                stats.byFluegel[fluegel] = (stats.byFluegel[fluegel] || 0) + 1;
            }

            console.log(`${h}/${s}, ${elemente.length} El. gespeichert`);

            // Rate Limiting
            if (i < invoices.length - 1) {
                await sleep(CONFIG.DELAY_MS);
            }

        } catch (error) {
            console.log(`FEHLER: ${error.message}`);
            errorCount++;
        }
    }

    await closeW4APool();
    console.log('\n[W4A] Verbindung geschlossen\n');

    // 3. Auswertung
    console.log('[3/3] Zusammenfassung...\n');

    console.log(`${'='.repeat(75)}`);
    console.log(`  ERGEBNIS`);
    console.log(`${'='.repeat(75)}\n`);

    console.log(`  Rechnungen verarbeitet:  ${successCount}/${invoices.length}`);
    console.log(`  Fehler:                  ${errorCount}`);
    console.log(`  Elemente gespeichert:    ${totalElements}`);
    console.log(`  Tokens verbraucht:       ${totalTokens.toLocaleString()}`);
    console.log(`  Geschaetzte Kosten:      ~${(totalTokens * 0.00001).toFixed(2)} USD`);
    console.log(`  Run ID:                  ${runId}`);

    console.log(`\n  NACH HERSTELLER:`);
    for (const [h, count] of Object.entries(stats.byHersteller).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${h.padEnd(20)} ${count} Elemente`);
    }

    console.log(`\n  NACH TYP:`);
    for (const [t, count] of Object.entries(stats.byTyp).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${t.padEnd(15)} ${count} Elemente`);
    }

    console.log(`\n  NACH FLUEGEL-ANZAHL:`);
    for (const [f, count] of Object.entries(stats.byFluegel).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(f).padEnd(10)} ${count} Elemente`);
    }

    console.log(`\n${'='.repeat(75)}`);
    console.log(`  Daten gespeichert in: backtest_elements (Run ID: ${runId})`);
    console.log(`${'='.repeat(75)}\n`);
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    closeW4APool().catch(() => {});
    process.exit(1);
});
