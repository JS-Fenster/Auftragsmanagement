/**
 * Backtest mit GPT-5.2 System-Erkennung
 * =====================================
 * Verwendet GPT-5.2 statt Regex fuer Hersteller/System-Erkennung
 *
 * Vorteil: Viel genauer als Regex-Parser, versteht Kontext
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// OpenAI API Key aus .env ODER aus Supabase Secrets
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Supabase Config fuer Edge Function Fallback
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// =============================================================================
// Konfiguration
// =============================================================================

const CONFIG = {
    SAMPLE_SIZE: 10,  // Kleiner fuer GPT-Kosten
    DATE_FROM: '2024-01-01',
    DATE_TO: '2025-12-31',
    OFFSET: 100,
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT'],
    BZOBJTYPE_RECHNUNG: 7,
    TREFFER_TOLERANZ: 0.20,

    // Preismodell V1 (Basis)
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
        DEFAULT: {
            DEFAULT: { basis: 500, proQm: 200 }
        }
    }
};

// =============================================================================
// GPT-5.2 System-Erkennung
// =============================================================================

const SYSTEM_DETECTION_PROMPT = `Du bist ein Experte fuer Fenster und Tueren. Analysiere die folgenden Rechnungspositionen und erkenne:

1. HERSTELLER: WERU, DRUTEX, INTERNORM, SCHUCO, ALUPROF, HEROAL oder "Unbekannt"
2. SYSTEM: Fuer WERU: CASTELLO, CALIDO, IMPREO, AFINO, ATRIS, AVIDA, ALEGRA
   Fuer andere Hersteller: Das jeweilige Produktsystem

ERKENNUNGSREGELN:
- "Castello" im Text -> WERU/CASTELLO
- "Calido" im Text -> WERU/CALIDO
- "Impreo" im Text -> WERU/IMPREO (Alumix)
- "Afino" im Text -> WERU/AFINO (Legacy)
- "Atris" im Text -> WERU/ATRIS (Alu-Haustuer)
- "3-fach" oder "3fach" ohne Systemname -> WERU/CALIDO (3-fach Standard)
- "2-fach" oder "2fach" ohne Systemname -> WERU/CASTELLO (2-fach Standard)
- "Drutex" -> DRUTEX
- Keine Hinweise -> WERU/DEFAULT (Annahme)

Gib das Ergebnis als JSON zurueck:
{
  "hersteller": "WERU",
  "system": "CASTELLO",
  "confidence": "high|medium|low",
  "erkennungsgrund": "Kurze Begruendung"
}

WICHTIG:
- Gib NUR das JSON zurueck, keinen anderen Text
- Bei mehreren Systemen in einer Rechnung: Das dominante System waehlen
- Bei Unsicherheit: DEFAULT mit confidence=low`;

/**
 * Erkennt Hersteller und System via GPT-5.2
 */
async function detectSystemWithGPT(positions) {
    if (!OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY nicht gesetzt!');
        return { hersteller: 'WERU', system: 'DEFAULT', confidence: 'low', erkennungsgrund: 'Kein API Key' };
    }

    // Positionen als Text aufbereiten
    const positionsText = positions.map(p => {
        const parts = [];
        if (p.PosNr) parts.push(`Pos ${p.PosNr}`);
        if (p.Bezeichnung) parts.push(p.Bezeichnung);
        if (p.Langtext) parts.push(p.Langtext);
        if (p.GesamtPreis) parts.push(`Preis: ${p.GesamtPreis} EUR`);
        return parts.join(' | ');
    }).join('\n');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',  // Kosteneffizient fuer diese Aufgabe
                messages: [
                    { role: 'system', content: SYSTEM_DETECTION_PROMPT },
                    { role: 'user', content: `RECHNUNGSPOSITIONEN:\n\n${positionsText}` }
                ],
                temperature: 0.1,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content.trim();

        // JSON extrahieren (falls mit Markdown umgeben)
        let jsonStr = content;
        if (content.includes('```')) {
            const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) jsonStr = match[1].trim();
        }

        const parsed = JSON.parse(jsonStr);
        return {
            hersteller: parsed.hersteller || 'WERU',
            system: parsed.system || 'DEFAULT',
            confidence: parsed.confidence || 'medium',
            erkennungsgrund: parsed.erkennungsgrund || 'GPT-Analyse'
        };

    } catch (error) {
        console.error('GPT Fehler:', error.message);
        return {
            hersteller: 'WERU',
            system: 'DEFAULT',
            confidence: 'low',
            erkennungsgrund: `Fehler: ${error.message.substring(0, 50)}`
        };
    }
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
            WHERE BZObjType = @invoiceCode AND BZObjMemberCode = @invoiceCode
               OR (BZObjType = 7 AND BZObjMemberCode = @invoiceCode)
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

        // Masse extrahieren: 1230x1480 oder 123x148 (cm)
        const mmMatch = text.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})/);
        const cmMatch = text.match(/(\d{2,3})\s*[xX×*]\s*(\d{2,3})/);

        let width = 0, height = 0;

        if (mmMatch) {
            width = parseInt(mmMatch[1]);
            height = parseInt(mmMatch[2]);
            // Falls zu klein, evtl. cm
            if (width < 300 && height < 300) {
                width *= 10;
                height *= 10;
            }
        } else if (cmMatch) {
            width = parseInt(cmMatch[1]) * 10;
            height = parseInt(cmMatch[2]) * 10;
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

    // Montage-Pauschale
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
    console.log('  BACKTEST MIT GPT-5.2 SYSTEM-ERKENNUNG');
    console.log('═'.repeat(65));
    console.log(`  Sample Size: ${CONFIG.SAMPLE_SIZE}`);
    console.log(`  OPENAI_API_KEY: ${OPENAI_API_KEY ? 'Gesetzt' : 'FEHLT!'}`);
    console.log('═'.repeat(65));

    if (!OPENAI_API_KEY) {
        console.error('\nFEHLER: OPENAI_API_KEY nicht in .env gesetzt!');
        process.exit(1);
    }

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

    // 2. Jede Rechnung analysieren mit GPT
    console.log('[2/3] Analysiere mit GPT...');
    const results = [];

    for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        process.stdout.write(`   ${i+1}/${invoices.length}: ${inv.Nummer}... `);

        try {
            // Positionen holen
            const positions = await fetchPositions(pool, inv.Code);

            if (positions.length === 0) {
                console.log('keine Positionen');
                continue;
            }

            // GPT-Erkennung
            const detection = await detectSystemWithGPT(positions);

            // Elemente extrahieren
            const elements = extractDimensions(positions);

            // Budget berechnen
            const budgetPreis = calculateBudget(elements, detection.hersteller, detection.system);

            // Abweichung
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

            console.log(`${detection.hersteller}/${detection.system} (${detection.confidence}), ${elements.length} Elemente, Abw: ${deviation.toFixed(1)}%`);

            // Rate Limiting
            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.log(`Fehler: ${error.message}`);
        }
    }

    // 3. Auswertung
    console.log('\n[3/3] Auswertung...\n');

    console.log('═'.repeat(65));
    console.log('  ERGEBNISSE');
    console.log('═'.repeat(65));

    // Statistiken
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
    console.log(`  - Durchschnitt Abweichung: ${avgDeviation.toFixed(1)}%`);

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

    // Top 5 beste Treffer
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
        console.log(`      Grund: ${r.erkennungsgrund}`);
    }

    console.log('\n' + '═'.repeat(65));

    await closeW4APool();
    console.log('\n[W4A] Verbindung geschlossen');
}

main().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
