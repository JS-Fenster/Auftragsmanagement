/**
 * Preisspannen-Analyse Script: Aufschlag EK -> VK bei Rechnungspositionen
 *
 * Analysiert 500 Positionen aus W4A (BZObjType=7) und gruppiert nach Aufschlag-Bereichen.
 *
 * Ausfuehrung: node backend/scripts/analyze-price-margins.js
 *
 * Voraussetzungen:
 * - cloudflared muss laufen: cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433
 * - Backend .env muss W4A_DB_SERVER=localhost enthalten
 *
 * Log-Referenz: [LOG-023]
 * Erstellt: 2026-02-04
 */

const path = require('path');

// Lade .env aus dem Backend-Ordner
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// ============================================================================
// KONFIGURATION
// ============================================================================

const CONFIG = {
    // Anzahl Positionen fuer Analyse
    SAMPLE_SIZE: 500,

    // BZObjType fuer Rechnungs-Positionen
    BZOBJTYPE_RECHNUNG: 7,

    // Aufschlag-Bereiche fuer Gruppierung
    MARGIN_RANGES: [
        { min: 0, max: 50, label: '0-50%' },
        { min: 50, max: 85, label: '50-85%' },
        { min: 85, max: 100, label: '85-100% (Standard)' },
        { min: 100, max: 150, label: '100-150%' },
        { min: 150, max: 200, label: '150-200%' },
        { min: 200, max: Infinity, label: '>200%' }
    ],

    // Anzahl Beispiele pro Bereich
    EXAMPLES_PER_RANGE: 3
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function truncateText(text, maxLen = 60) {
    if (!text) return '-';
    text = text.replace(/[\r\n\t]+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

function formatCurrency(value) {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    return value.toFixed(1) + '%';
}

function calculateMargin(ekPreis, vkPreis) {
    if (!ekPreis || ekPreis <= 0) return null;
    return ((vkPreis - ekPreis) / ekPreis) * 100;
}

function findRange(margin) {
    for (const range of CONFIG.MARGIN_RANGES) {
        if (margin >= range.min && margin < range.max) {
            return range.label;
        }
    }
    return '>200%';
}

function calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================================
// HAUPT-LOGIK
// ============================================================================

async function fetchPositions(pool) {
    console.log('\n[1/3] Hole Positionen aus W4A...');

    const query = `
        SELECT TOP ${CONFIG.SAMPLE_SIZE}
            p.Code,
            p.BZObjMemberCode,
            p.PozNr,
            p.Bezeichnung,
            p.Anzahl,
            p.Einheit,
            p.EKPreis,
            p.EinzPreis,
            p.GesPreis,
            p.Rabatt
        FROM dbo.Positionen p
        WHERE p.BZObjType = ${CONFIG.BZOBJTYPE_RECHNUNG}
          AND p.EKPreis > 0
          AND p.EinzPreis > 0
          AND p.EKPreis < p.EinzPreis  -- Nur Positionen mit positivem Aufschlag
        ORDER BY NEWID()
    `;

    const result = await pool.request().query(query);
    console.log(`   ${result.recordset.length} Positionen gefunden`);

    return result.recordset;
}

function analyzeMargins(positions) {
    console.log('\n[2/3] Analysiere Aufschlaege...');

    // Initialisiere Ergebnis-Struktur
    const results = {};
    for (const range of CONFIG.MARGIN_RANGES) {
        results[range.label] = {
            count: 0,
            examples: [],
            margins: []
        };
    }

    const allMargins = [];

    // Berechne Aufschlag fuer jede Position
    for (const pos of positions) {
        const margin = calculateMargin(pos.EKPreis, pos.EinzPreis);
        if (margin === null) continue;

        allMargins.push(margin);
        const rangeLabel = findRange(margin);

        results[rangeLabel].count++;
        results[rangeLabel].margins.push(margin);

        // Sammle Beispiele
        if (results[rangeLabel].examples.length < CONFIG.EXAMPLES_PER_RANGE) {
            results[rangeLabel].examples.push({
                bezeichnung: pos.Bezeichnung,
                ekPreis: pos.EKPreis,
                vkPreis: pos.EinzPreis,
                margin: margin,
                anzahl: pos.Anzahl,
                einheit: pos.Einheit
            });
        }
    }

    // Berechne Statistiken
    const stats = {
        total: allMargins.length,
        median: calculateMedian(allMargins),
        average: allMargins.length > 0 ? allMargins.reduce((a, b) => a + b, 0) / allMargins.length : 0,
        min: allMargins.length > 0 ? Math.min(...allMargins) : 0,
        max: allMargins.length > 0 ? Math.max(...allMargins) : 0
    };

    // Wie viel % liegen im 85%-Bereich (+/-10%)?
    const inStandardRange = allMargins.filter(m => m >= 75 && m <= 95).length;
    stats.percentInStandardRange = (inStandardRange / allMargins.length) * 100;

    return { results, stats, allMargins };
}

function printResults(data) {
    console.log('\n[3/3] Ergebnisse...\n');

    const { results, stats, allMargins } = data;

    console.log('================================================================================');
    console.log('  PREISSPANNEN-ANALYSE: Aufschlag EK -> VK bei Rechnungspositionen');
    console.log('================================================================================\n');

    // Uebersichts-Tabelle
    console.log('| Aufschlag-Bereich     | Anzahl | %      | Durchschnitt |');
    console.log('|-----------------------|--------|--------|--------------|');

    for (const range of CONFIG.MARGIN_RANGES) {
        const data = results[range.label];
        if (data.count === 0) {
            console.log(`| ${range.label.padEnd(21)} |      0 |   0.0% |            - |`);
            continue;
        }

        const pct = ((data.count / stats.total) * 100).toFixed(1);
        const avgMargin = data.margins.reduce((a, b) => a + b, 0) / data.margins.length;

        console.log(`| ${range.label.padEnd(21)} | ${String(data.count).padStart(6)} | ${pct.padStart(5)}% | ${formatPercent(avgMargin).padStart(12)} |`);
    }

    console.log('\n');

    // Beispiele pro Bereich
    console.log('================================================================================');
    console.log('  BEISPIELE PRO AUFSCHLAG-BEREICH');
    console.log('================================================================================\n');

    for (const range of CONFIG.MARGIN_RANGES) {
        const rangeData = results[range.label];
        if (rangeData.count === 0) continue;

        console.log(`\n--- ${range.label} (${rangeData.count} Positionen) ---`);
        console.log('');

        for (const ex of rangeData.examples) {
            const bezeichnung = truncateText(ex.bezeichnung, 60);
            console.log(`  ${bezeichnung}`);
            console.log(`    EK: ${formatCurrency(ex.ekPreis).padStart(10)} | VK: ${formatCurrency(ex.vkPreis).padStart(10)} | Aufschlag: ${formatPercent(ex.margin).padStart(8)}`);
        }
    }

    // Statistiken
    console.log('\n');
    console.log('================================================================================');
    console.log('  STATISTIKEN');
    console.log('================================================================================\n');

    console.log(`  Analysierte Positionen:          ${stats.total}`);
    console.log(`  `);
    console.log(`  Median-Aufschlag:                ${formatPercent(stats.median)}`);
    console.log(`  Durchschnitts-Aufschlag:         ${formatPercent(stats.average)}`);
    console.log(`  Minimum:                         ${formatPercent(stats.min)}`);
    console.log(`  Maximum:                         ${formatPercent(stats.max)}`);
    console.log(`  `);
    console.log(`  Positionen im 85%-Bereich (75-95%): ${formatPercent(stats.percentInStandardRange)} (${Math.round(stats.percentInStandardRange * stats.total / 100)} von ${stats.total})`);

    // Perzentile
    const sorted = [...allMargins].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p90 = sorted[Math.floor(sorted.length * 0.90)];

    console.log(`  `);
    console.log(`  Perzentile:`);
    console.log(`    25%: ${formatPercent(p25)}`);
    console.log(`    50% (Median): ${formatPercent(p50)}`);
    console.log(`    75%: ${formatPercent(p75)}`);
    console.log(`    90%: ${formatPercent(p90)}`);

    // Fazit
    console.log('\n');
    console.log('================================================================================');
    console.log('  FAZIT: Ist 85% ein guter Standard-Aufschlag?');
    console.log('================================================================================\n');

    if (stats.median >= 80 && stats.median <= 90) {
        console.log('  [OK] JA - Der Median liegt nahe bei 85%.');
        console.log(`        Median: ${formatPercent(stats.median)}, Durchschnitt: ${formatPercent(stats.average)}`);
    } else if (stats.median < 80) {
        console.log('  [!] NEIN - Der Median liegt UNTER 85%.');
        console.log(`        Median: ${formatPercent(stats.median)}`);
        console.log(`        Empfehlung: Standard-Aufschlag auf ${Math.round(stats.median)}% senken.`);
    } else {
        console.log('  [!] NEIN - Der Median liegt UEBER 85%.');
        console.log(`        Median: ${formatPercent(stats.median)}`);
        console.log(`        Empfehlung: Standard-Aufschlag auf ${Math.round(stats.median)}% erhoehen.`);
    }

    if (stats.percentInStandardRange < 30) {
        console.log(`\n  [WARNUNG] Nur ${formatPercent(stats.percentInStandardRange)} der Positionen liegen im 85%-Bereich.`);
        console.log(`            Die Aufschlaege variieren stark - Vorsicht bei Pauschalisierung!`);
    } else if (stats.percentInStandardRange < 50) {
        console.log(`\n  [INFO] ${formatPercent(stats.percentInStandardRange)} der Positionen liegen im 85%-Bereich.`);
        console.log(`         Akzeptable Streuung, 85% als Standard verwendbar.`);
    } else {
        console.log(`\n  [OK] ${formatPercent(stats.percentInStandardRange)} der Positionen liegen im 85%-Bereich.`);
        console.log(`       Gute Konsistenz, 85% ist ein solider Standard.`);
    }

    console.log('\n');

    return stats;
}

// ============================================================================
// AUSFUEHRUNG
// ============================================================================

async function runAnalysis() {
    console.log('================================================================================');
    console.log('  PREISSPANNEN-ANALYSE: Aufschlag EK -> VK');
    console.log('================================================================================');
    console.log(`  Konfiguration:`);
    console.log(`  - Sample Size: ${CONFIG.SAMPLE_SIZE} Positionen`);
    console.log(`  - BZObjType: ${CONFIG.BZOBJTYPE_RECHNUNG} (Rechnungen)`);
    console.log(`  - Filter: EKPreis > 0 AND EinzPreis > 0 AND EKPreis < EinzPreis`);
    console.log('================================================================================');

    const pool = await getW4APool();

    try {
        // 1. Positionen holen
        const positions = await fetchPositions(pool);

        if (positions.length === 0) {
            console.log('\nKeine Positionen gefunden! Pruefe Filter-Kriterien.');
            return null;
        }

        // 2. Analysieren
        const data = analyzeMargins(positions);

        // 3. Ergebnisse ausgeben
        const stats = printResults(data);

        return {
            positionCount: positions.length,
            stats,
            results: data.results
        };

    } finally {
        await closeW4APool();
    }
}

runAnalysis()
    .then(result => {
        if (result) {
            console.log('Analyse erfolgreich abgeschlossen.');
        }
    })
    .catch(err => {
        console.error('\nAnalyse fehlgeschlagen:', err);
        closeW4APool();
        process.exit(1);
    });
