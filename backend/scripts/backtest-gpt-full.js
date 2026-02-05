/**
 * BACKTEST MIT GPT-5.2 EXTRAKTION (VOLLSTAENDIG)
 * ==============================================
 * Sendet alle Positionen einer Rechnung an GPT zur strukturierten Analyse.
 * GPT extrahiert: Hersteller, System, Elemente mit Massen/Preisen, Zubehoer, Montage.
 *
 * Verwendung:
 *   node backtest-gpt-full.js [SAMPLE_SIZE] [--save]
 *
 * Beispiele:
 *   node backtest-gpt-full.js           # 10 Rechnungen testen
 *   node backtest-gpt-full.js 50        # 50 Rechnungen testen
 *   node backtest-gpt-full.js 20 --save # 20 Rechnungen, Ergebnisse in Supabase speichern
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const SAMPLE_SIZE = parseInt(process.argv[2]) || 10;
const SAVE_TO_DB = process.argv.includes('--save');

const CONFIG = {
    DATE_FROM: '2024-01-01',
    DATE_TO: '2025-12-31',
    MIN_BRUTTO: 1000,  // Mind. 1000 EUR (kleine Rechnungen ausschliessen)
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT', 'Fenster', 'Tuer'],  // Fenster/Tueren Keywords
    DELAY_MS: 500,  // Pause zwischen GPT-Anfragen (Rate Limiting)
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
// GPT Extraktion via Edge Function
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
// Hilsfunktionen
// =============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatEuro(value) {
    return value.toFixed(2).padStart(10) + ' EUR';
}

function calculateEuroProQm(elemente) {
    if (!elemente || elemente.length === 0) return [];

    return elemente.map(e => {
        const qm = (e.breite_mm * e.hoehe_mm) / 1_000_000;
        const euroProQm = qm > 0 ? e.einzelpreis / qm : 0;
        return {
            ...e,
            qm: qm.toFixed(2),
            euroProQm: euroProQm.toFixed(0)
        };
    });
}

// =============================================================================
// Hauptlogik
// =============================================================================

async function main() {
    console.log(`\n${'='.repeat(75)}`);
    console.log(`  GPT-BACKTEST VOLLSTAENDIG`);
    console.log(`${'='.repeat(75)}`);
    console.log(`  Sample Size:    ${SAMPLE_SIZE} Rechnungen`);
    console.log(`  Speichern:      ${SAVE_TO_DB ? 'Ja (Supabase)' : 'Nein (nur Ausgabe)'}`);
    console.log(`  Zeitraum:       ${CONFIG.DATE_FROM} bis ${CONFIG.DATE_TO}`);
    console.log(`  Min. Brutto:    ${CONFIG.MIN_BRUTTO} EUR`);
    console.log(`${'='.repeat(75)}\n`);

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

    // 2. Jede Rechnung durch GPT analysieren
    console.log('[2/3] Analysiere mit GPT-5.2...\n');

    const results = [];
    let totalTokens = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const progress = `[${String(i + 1).padStart(2)}/${invoices.length}]`;

        process.stdout.write(`${progress} ${inv.Nummer}... `);

        try {
            const positions = await fetchPositions(pool, inv.Code);

            if (positions.length === 0) {
                console.log('keine Positionen (uebersprungen)');
                continue;
            }

            // GPT Extraktion
            const gptResult = await extractWithGPT(positions, inv.Bruttowert);
            const ext = gptResult.extraction;

            if (!ext || !ext.kontext) {
                console.log('GPT konnte nicht extrahieren');
                errorCount++;
                continue;
            }

            // Tokens zaehlen
            if (gptResult.meta && gptResult.meta.tokens) {
                totalTokens += gptResult.meta.tokens.total_tokens || 0;
            }

            // Abweichung berechnen
            const nettoGPT = ext.summen?.netto_berechnet || 0;
            const bruttoCalc = nettoGPT * 1.19;
            const bruttoActual = inv.Bruttowert;
            const deviation = bruttoActual > 0
                ? ((bruttoCalc - bruttoActual) / bruttoActual * 100)
                : 0;

            // Euro/qm berechnen
            const elementeMitQm = calculateEuroProQm(ext.elemente || []);
            const avgEuroProQm = elementeMitQm.length > 0
                ? elementeMitQm.reduce((sum, e) => sum + parseFloat(e.euroProQm), 0) / elementeMitQm.length
                : 0;

            const result = {
                nummer: inv.Nummer,
                datum: inv.Datum,
                notiz: inv.Notiz,
                hersteller: ext.kontext.hersteller || 'unknown',
                system: ext.kontext.system || 'unknown',
                verglasung: ext.kontext.verglasung || 'unknown',
                material: ext.kontext.material || 'unknown',
                elemente: ext.elemente?.length || 0,
                zubehoer: {
                    rollladen: ext.zubehoer?.rollladen_anzahl || 0,
                    afb: ext.zubehoer?.aussenfensterbank_lfm || 0,
                    ifb: ext.zubehoer?.innenfensterbank_lfm || 0
                },
                montage: {
                    stunden: ext.montage?.stunden || 0,
                    stundensatz: ext.montage?.stundensatz || 0
                },
                preise: {
                    nettoGPT,
                    bruttoCalc,
                    bruttoActual,
                    deviation,
                    avgEuroProQm
                },
                raw: ext
            };

            results.push(result);
            successCount++;

            // Status ausgeben
            const devStr = deviation >= 0 ? `+${deviation.toFixed(1)}%` : `${deviation.toFixed(1)}%`;
            console.log(`${result.hersteller}/${result.system}, ${result.elemente} El., ${devStr}`);

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
    console.log('[3/3] Auswertung...\n');

    if (results.length === 0) {
        console.log('Keine Ergebnisse zum Auswerten.');
        return;
    }

    console.log(`${'='.repeat(75)}`);
    console.log(`  ERGEBNISSE`);
    console.log(`${'='.repeat(75)}\n`);

    // Grundstatistiken
    const deviations = results.map(r => r.preise.deviation);
    const absDeviations = deviations.map(d => Math.abs(d));
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const avgAbsDeviation = absDeviations.reduce((a, b) => a + b, 0) / absDeviations.length;
    const sortedDev = [...deviations].sort((a, b) => a - b);
    const medianDeviation = sortedDev[Math.floor(sortedDev.length / 2)];

    const treffer20 = results.filter(r => Math.abs(r.preise.deviation) <= 20).length;
    const treffer10 = results.filter(r => Math.abs(r.preise.deviation) <= 10).length;
    const treffer5 = results.filter(r => Math.abs(r.preise.deviation) <= 5).length;

    console.log(`  ZUSAMMENFASSUNG:`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Erfolgreich analysiert:  ${successCount}/${invoices.length}`);
    console.log(`  Fehler:                  ${errorCount}`);
    console.log(`  GPT Tokens gesamt:       ${totalTokens.toLocaleString()}`);
    console.log(`  Geschaetzte Kosten:      ~${(totalTokens * 0.00001).toFixed(2)} USD`);
    console.log();
    console.log(`  Treffer (+/- 5%):        ${treffer5} (${(treffer5/results.length*100).toFixed(1)}%)`);
    console.log(`  Treffer (+/- 10%):       ${treffer10} (${(treffer10/results.length*100).toFixed(1)}%)`);
    console.log(`  Treffer (+/- 20%):       ${treffer20} (${(treffer20/results.length*100).toFixed(1)}%)`);
    console.log();
    console.log(`  Median Abweichung:       ${medianDeviation >= 0 ? '+' : ''}${medianDeviation.toFixed(1)}%`);
    console.log(`  Durchschnitt:            ${avgDeviation >= 0 ? '+' : ''}${avgDeviation.toFixed(1)}%`);
    console.log(`  Durchschnitt (absolut):  ${avgAbsDeviation.toFixed(1)}%`);

    // Nach Hersteller/System
    console.log(`\n  NACH HERSTELLER/SYSTEM:`);
    console.log(`  ${'─'.repeat(50)}`);

    const byManufacturer = {};
    for (const r of results) {
        const key = `${r.hersteller}/${r.system}`;
        if (!byManufacturer[key]) {
            byManufacturer[key] = { count: 0, deviations: [], euroProQm: [] };
        }
        byManufacturer[key].count++;
        byManufacturer[key].deviations.push(r.preise.deviation);
        if (r.preise.avgEuroProQm > 0) {
            byManufacturer[key].euroProQm.push(r.preise.avgEuroProQm);
        }
    }

    const sortedManufacturers = Object.entries(byManufacturer)
        .sort((a, b) => b[1].count - a[1].count);

    for (const [key, stats] of sortedManufacturers) {
        const avgDev = stats.deviations.reduce((a, b) => a + b, 0) / stats.deviations.length;
        const avgEuroQm = stats.euroProQm.length > 0
            ? stats.euroProQm.reduce((a, b) => a + b, 0) / stats.euroProQm.length
            : 0;

        const devStr = avgDev >= 0 ? `+${avgDev.toFixed(1)}%` : `${avgDev.toFixed(1)}%`;
        const euroStr = avgEuroQm > 0 ? `${avgEuroQm.toFixed(0)} EUR/qm` : '-';

        console.log(`  ${key.padEnd(25)} ${String(stats.count).padStart(3)}x | Abw: ${devStr.padStart(7)} | ${euroStr}`);
    }

    // Euro/qm Analyse
    console.log(`\n  EURO/QM PREISSPANNEN:`);
    console.log(`  ${'─'.repeat(50)}`);

    for (const [key, stats] of sortedManufacturers) {
        if (stats.euroProQm.length > 0) {
            const sorted = [...stats.euroProQm].sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            console.log(`  ${key.padEnd(25)} ${min.toFixed(0)} - ${max.toFixed(0)} EUR/qm`);
        }
    }

    // Top 5 beste
    console.log(`\n  TOP 5 GENAUESTE:`);
    console.log(`  ${'─'.repeat(50)}`);
    const sortedByAccuracy = [...results].sort((a, b) =>
        Math.abs(a.preise.deviation) - Math.abs(b.preise.deviation)
    );

    for (let i = 0; i < Math.min(5, sortedByAccuracy.length); i++) {
        const r = sortedByAccuracy[i];
        const devStr = r.preise.deviation >= 0
            ? `+${r.preise.deviation.toFixed(1)}%`
            : `${r.preise.deviation.toFixed(1)}%`;
        console.log(`  ${r.nummer}: ${r.hersteller}/${r.system}, ${r.elemente} El., ${devStr}`);
    }

    // Top 5 schlechteste
    console.log(`\n  TOP 5 GROESSTE ABWEICHUNGEN:`);
    console.log(`  ${'─'.repeat(50)}`);
    const sortedByWorst = [...results].sort((a, b) =>
        Math.abs(b.preise.deviation) - Math.abs(a.preise.deviation)
    );

    for (let i = 0; i < Math.min(5, sortedByWorst.length); i++) {
        const r = sortedByWorst[i];
        const devStr = r.preise.deviation >= 0
            ? `+${r.preise.deviation.toFixed(1)}%`
            : `${r.preise.deviation.toFixed(1)}%`;
        console.log(`  ${r.nummer}: ${r.hersteller}/${r.system}, ${devStr}`);
        console.log(`       GPT: ${r.preise.bruttoCalc.toFixed(0)} EUR vs Actual: ${r.preise.bruttoActual.toFixed(0)} EUR`);
        console.log(`       Notiz: ${(r.notiz || '-').substring(0, 60)}`);
    }

    // Sonderfaelle
    console.log(`\n  SONDERFAELLE:`);
    console.log(`  ${'─'.repeat(50)}`);

    const noElements = results.filter(r => r.elemente === 0);
    const unknownManufacturer = results.filter(r =>
        r.hersteller === 'unknown' || r.hersteller === null || r.hersteller === 'andere'
    );

    console.log(`  Keine Elemente erkannt:    ${noElements.length}`);
    console.log(`  Hersteller unbekannt:      ${unknownManufacturer.length}`);

    if (noElements.length > 0) {
        console.log(`    -> ${noElements.map(r => r.nummer).join(', ')}`);
    }

    console.log(`\n${'='.repeat(75)}\n`);

    // Optional: In Supabase speichern
    if (SAVE_TO_DB) {
        console.log('[SAVE] Speichere Ergebnisse in Supabase...');
        // TODO: Implementieren wenn Tabelle definiert
        console.log('[SAVE] (noch nicht implementiert)\n');
    }
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    closeW4APool().catch(() => {});
    process.exit(1);
});
