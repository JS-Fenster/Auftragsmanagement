/**
 * Backtest mit Supabase Edge Function fuer System-Erkennung
 * ==========================================================
 * Nutzt eine dedizierte Edge Function die GPT-5.2 fuer
 * System-Erkennung verwendet (hat OPENAI_API_KEY konfiguriert)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// =============================================================================
// Konfiguration
// =============================================================================

const CONFIG = {
    SAMPLE_SIZE: 20,
    DATE_FROM: '2024-01-01',
    DATE_TO: '2025-12-31',
    OFFSET: 100,
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT'],
    BZOBJTYPE_RECHNUNG: 7,
    TREFFER_TOLERANZ: 0.20,

    // Preismodell V1
    PREISMODELL: {
        WERU: {
            CASTELLO: { basis: 450, proQm: 180 },
            CALIDO: { basis: 550, proQm: 220 },
            IMPREO: { basis: 650, proQm: 280 },
            AFINO: { basis: 500, proQm: 200 },
            ATRIS: { basis: 1200, proQm: 350 },
            DEFAULT: { basis: 500, proQm: 200 }
        },
        DRUTEX: {
            DEFAULT: { basis: 350, proQm: 150 }
        },
        INTERNORM: {
            DEFAULT: { basis: 600, proQm: 250 }
        },
        DEFAULT: {
            DEFAULT: { basis: 500, proQm: 200 }
        }
    }
};

// =============================================================================
// Lokale System-Erkennung (verbesserter Regex als Fallback)
// =============================================================================

function detectSystemLocal(positions) {
    // Alle Texte zusammenfuehren
    const allText = positions.map(p =>
        `${p.Bezeichnung || ''} ${p.Langtext || ''}`
    ).join(' ').toLowerCase();

    // Hersteller erkennen
    let hersteller = 'WERU';
    if (allText.includes('drutex')) hersteller = 'DRUTEX';
    else if (allText.includes('internorm')) hersteller = 'INTERNORM';
    else if (allText.includes('schüco') || allText.includes('schueco')) hersteller = 'SCHUCO';
    else if (allText.includes('heroal')) hersteller = 'HEROAL';

    // System erkennen (nur fuer WERU relevant)
    let system = 'DEFAULT';
    let confidence = 'low';
    let erkennungsgrund = 'Keine Systemhinweise gefunden';

    if (hersteller === 'WERU') {
        // Explizite System-Namen
        if (allText.includes('castello')) {
            system = 'CASTELLO';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Castello" im Text';
        } else if (allText.includes('calido')) {
            system = 'CALIDO';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Calido" im Text';
        } else if (allText.includes('impreo')) {
            system = 'IMPREO';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Impreo" im Text';
        } else if (allText.includes('afino')) {
            system = 'AFINO';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Afino" im Text';
        } else if (allText.includes('atris')) {
            system = 'ATRIS';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Atris" im Text';
        } else if (allText.includes('avida')) {
            system = 'AVIDA';
            confidence = 'high';
            erkennungsgrund = 'Explizit "Avida" im Text';
        }
        // Verglasung als Indikator
        else if (allText.includes('3-fach') || allText.includes('3fach') || allText.includes('dreifach')) {
            system = 'CALIDO';
            confidence = 'medium';
            erkennungsgrund = '3-fach Verglasung -> CALIDO';
        } else if (allText.includes('2-fach') || allText.includes('2fach') || allText.includes('zweifach')) {
            system = 'CASTELLO';
            confidence = 'medium';
            erkennungsgrund = '2-fach Verglasung -> CASTELLO';
        }
        // WERU-spezifische Hinweise
        else if (allText.includes('weru')) {
            system = 'DEFAULT';
            confidence = 'low';
            erkennungsgrund = 'WERU erkannt, aber kein spezifisches System';
        }
    }

    return { hersteller, system, confidence, erkennungsgrund };
}

// =============================================================================
// W4A Datenabfrage
// =============================================================================

async function fetchInvoices(pool, limit, offset) {
    const keywordConditions = CONFIG.KEYWORDS.map(k => `Notiz LIKE '%${k}%'`).join(' OR ');

    const result = await pool.request().query(`
        SELECT
            Code,
            Nummer,
            Datum,
            Bruttowert,
            Notiz
        FROM dbo.Rechnung
        WHERE Datum >= '${CONFIG.DATE_FROM}'
          AND Datum <= '${CONFIG.DATE_TO}'
          AND Bruttowert > 500
          AND (${keywordConditions})
        ORDER BY Datum DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
    `);

    return result.recordset;
}

async function fetchPositions(pool, invoiceCode) {
    const result = await pool.request()
        .input('invoiceCode', sql.Int, invoiceCode)
        .query(`
            SELECT
                Code,
                PozNr AS PosNr,
                Bezeichnung,
                CAST(Bemerkung AS NVARCHAR(500)) AS Langtext,
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
// Preisberechnung
// =============================================================================

function extractDimensions(positions) {
    const elements = [];

    for (const pos of positions) {
        const text = `${pos.Bezeichnung || ''} ${pos.Langtext || ''}`;

        let width = 0, height = 0;

        // 1a. Format: "Breite: 700 mm, Höhe: 975 mm" (mit Komma)
        const breiteKommaMatch = text.match(/[Bb]reite[:\s]*(\d+)\s*mm\s*,\s*[Hh](?:oe|ö)he[:\s]*(\d+)\s*mm/);

        // 1b. Format: "Breite 1040mm x Höhe 2455mm" oder "Breite: 1040 mm x Höhe: 2455 mm" (mit x)
        const breiteHoeheMatch = text.match(/[Bb]reite[:\s]*(\d+)\s*mm?\s*[xX×*]\s*[Hh](?:oe|ö)he[:\s]*(\d+)\s*mm?/);

        // 2. Format: "Maße: 985 mm x 2180 mm" oder "Masse: 985mm x 2180mm"
        const masseMatch = text.match(/[Mm]a(?:ss|ß)e?[:\s]*(\d+)\s*mm?\s*[xX×*]\s*(\d+)\s*mm?/);

        // 3. Format: "775 x 1225 mm" oder "775x1225mm" (Masse am Ende)
        const simpleMmMatch = text.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})\s*mm/);

        // 4. Format: "1230x1480" ohne Einheit (wahrscheinlich mm)
        const noUnitMatch = text.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})(?!\s*mm)/);

        // 5. Format: "123x148" (wahrscheinlich cm)
        const cmMatch = text.match(/\b(\d{2,3})\s*[xX×*]\s*(\d{2,3})\b/);

        // 6. Format: "B=1230 H=1480" oder "B: 1230 H: 1480"
        const bxhMatch = text.match(/[Bb]\s*[=:]\s*(\d+).*?[Hh]\s*[=:]\s*(\d+)/);

        if (breiteKommaMatch) {
            width = parseInt(breiteKommaMatch[1]);
            height = parseInt(breiteKommaMatch[2]);
        } else if (breiteHoeheMatch) {
            width = parseInt(breiteHoeheMatch[1]);
            height = parseInt(breiteHoeheMatch[2]);
        } else if (masseMatch) {
            width = parseInt(masseMatch[1]);
            height = parseInt(masseMatch[2]);
        } else if (simpleMmMatch) {
            width = parseInt(simpleMmMatch[1]);
            height = parseInt(simpleMmMatch[2]);
        } else if (noUnitMatch) {
            width = parseInt(noUnitMatch[1]);
            height = parseInt(noUnitMatch[2]);
            // Falls zu klein, evtl. cm
            if (width < 300 && height < 300) {
                width *= 10;
                height *= 10;
            }
        } else if (cmMatch) {
            width = parseInt(cmMatch[1]) * 10;
            height = parseInt(cmMatch[2]) * 10;
        } else if (bxhMatch) {
            width = parseInt(bxhMatch[1]);
            height = parseInt(bxhMatch[2]);
        }

        // Nur gueltige Fenster/Tueren
        if (width >= 300 && width <= 5000 && height >= 300 && height <= 5000) {
            elements.push({
                posNr: pos.PosNr,
                bezeichnung: (pos.Bezeichnung || '').substring(0, 50),
                width,
                height,
                anzahl: pos.Anzahl || 1,
                preis: pos.GesamtPreis || 0
            });
        }
    }

    return elements;
}

function calculateBudget(elements, hersteller, system) {
    const preismodell = CONFIG.PREISMODELL[hersteller] || CONFIG.PREISMODELL.DEFAULT;
    const systemPreis = preismodell[system] || preismodell.DEFAULT;

    let total = 0;

    for (const elem of elements) {
        const qm = (elem.width / 1000) * (elem.height / 1000);
        const elemPreis = (systemPreis.basis + systemPreis.proQm * qm) * elem.anzahl;
        total += elemPreis;
    }

    if (elements.length > 0) {
        total += Math.max(500, elements.length * 100);
    }

    return Math.round(total * 100) / 100;
}

// =============================================================================
// Hauptlogik
// =============================================================================

async function main() {
    console.log('═'.repeat(65));
    console.log('  BACKTEST MIT VERBESSERTER SYSTEM-ERKENNUNG');
    console.log('═'.repeat(65));
    console.log(`  Sample Size: ${CONFIG.SAMPLE_SIZE}`);
    console.log(`  Methode: Lokale Regex (optimiert)`);
    console.log('═'.repeat(65));

    const pool = await getW4APool();
    console.log('[W4A] Verbindung hergestellt\n');

    // 1. Rechnungen holen
    console.log('[1/3] Hole Rechnungen...');
    const invoices = await fetchInvoices(pool, CONFIG.SAMPLE_SIZE, CONFIG.OFFSET);
    console.log(`   ${invoices.length} Rechnungen gefunden\n`);

    if (invoices.length === 0) {
        console.log('Keine Rechnungen gefunden.');
        await closeW4APool();
        return;
    }

    // 2. Jede Rechnung analysieren
    console.log('[2/3] Analysiere...');
    const results = [];

    for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        process.stdout.write(`   ${i+1}/${invoices.length}: ${inv.Nummer}... `);

        try {
            const positions = await fetchPositions(pool, inv.Code);

            if (positions.length === 0) {
                console.log('keine Positionen');
                continue;
            }

            // Lokale Erkennung
            const detection = detectSystemLocal(positions);
            const elements = extractDimensions(positions);
            const budgetPreis = calculateBudget(elements, detection.hersteller, detection.system);

            const actualPreis = inv.Bruttowert;
            const deviation = actualPreis > 0
                ? ((budgetPreis - actualPreis) / actualPreis * 100)
                : 0;

            const isTreffer = Math.abs(deviation) <= CONFIG.TREFFER_TOLERANZ * 100;

            results.push({
                nummer: inv.Nummer,
                notiz: inv.Notiz,
                hersteller: detection.hersteller,
                system: detection.system,
                confidence: detection.confidence,
                erkennungsgrund: detection.erkennungsgrund,
                elemente: elements.length,
                actualPreis,
                budgetPreis,
                deviation,
                isTreffer
            });

            console.log(`${detection.hersteller}/${detection.system} (${detection.confidence}), ${elements.length} El., ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`);

        } catch (error) {
            console.log(`Fehler: ${error.message}`);
        }
    }

    // 3. Auswertung
    console.log('\n[3/3] Auswertung...\n');

    console.log('═'.repeat(65));
    console.log('  ERGEBNISSE');
    console.log('═'.repeat(65));

    const treffer = results.filter(r => r.isTreffer).length;
    const trefferRate = (treffer / results.length * 100).toFixed(1);

    const deviations = results.map(r => r.deviation);
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const sortedDev = [...deviations].sort((a, b) => a - b);
    const medianDeviation = sortedDev[Math.floor(sortedDev.length / 2)];

    console.log(`\n  ZUSAMMENFASSUNG:`);
    console.log(`  - Analysiert: ${results.length} Rechnungen`);
    console.log(`  - Treffer (+/- 20%): ${treffer} (${trefferRate}%)`);
    console.log(`  - Median Abweichung: ${medianDeviation.toFixed(1)}%`);
    console.log(`  - Durchschnitt: ${avgDeviation.toFixed(1)}%`);

    // System-Verteilung
    const systemStats = {};
    for (const r of results) {
        const key = `${r.hersteller}/${r.system}`;
        if (!systemStats[key]) systemStats[key] = { count: 0, deviations: [] };
        systemStats[key].count++;
        systemStats[key].deviations.push(r.deviation);
    }

    console.log(`\n  NACH SYSTEM:`);
    for (const [key, stats] of Object.entries(systemStats)) {
        const avgDev = stats.deviations.reduce((a, b) => a + b, 0) / stats.deviations.length;
        console.log(`  - ${key}: ${stats.count} Rechnungen, Avg ${avgDev.toFixed(1)}%`);
    }

    // Confidence-Verteilung
    const confStats = { high: 0, medium: 0, low: 0 };
    for (const r of results) {
        confStats[r.confidence]++;
    }
    console.log(`\n  CONFIDENCE:`);
    console.log(`  - High: ${confStats.high}, Medium: ${confStats.medium}, Low: ${confStats.low}`);

    // Details zu den erkannten Systemen
    console.log(`\n  ERKENNUNGSGRUENDE:`);
    const reasons = {};
    for (const r of results) {
        reasons[r.erkennungsgrund] = (reasons[r.erkennungsgrund] || 0) + 1;
    }
    for (const [reason, count] of Object.entries(reasons)) {
        console.log(`  - ${reason}: ${count}x`);
    }

    // Top 5 beste
    console.log(`\n  TOP 5 BESTE TREFFER:`);
    const sorted = [...results].sort((a, b) => Math.abs(a.deviation) - Math.abs(b.deviation));
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
        const r = sorted[i];
        console.log(`  - ${r.nummer}: ${r.hersteller}/${r.system}, Budget ${r.budgetPreis.toFixed(0)}€ vs Actual ${r.actualPreis.toFixed(0)}€ (${r.deviation >= 0 ? '+' : ''}${r.deviation.toFixed(1)}%)`);
    }

    // Top 5 schlechteste
    console.log(`\n  TOP 5 GROESSTE ABWEICHUNGEN:`);
    const sortedWorst = [...results].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    for (let i = 0; i < Math.min(5, sortedWorst.length); i++) {
        const r = sortedWorst[i];
        console.log(`  - ${r.nummer}: ${r.hersteller}/${r.system}, Budget ${r.budgetPreis.toFixed(0)}€ vs Actual ${r.actualPreis.toFixed(0)}€ (${r.deviation >= 0 ? '+' : ''}${r.deviation.toFixed(1)}%)`);
        console.log(`      Notiz: ${(r.notiz || '-').substring(0, 50)}`);
    }

    console.log('\n' + '═'.repeat(65));

    await closeW4APool();
    console.log('\n[W4A] Verbindung geschlossen');
}

main().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
