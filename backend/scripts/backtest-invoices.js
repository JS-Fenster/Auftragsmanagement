/**
 * Backtest Script: Rechnungen gegen Budget-Preismodell validieren
 *
 * Holt 50 Rechnungen aus W4A (2024-2025), analysiert Fenster-Positionen
 * und vergleicht unser Budget-Preismodell mit dem tatsaechlichen Rechnungsbetrag.
 *
 * Ausfuehrung: node backend/scripts/backtest-invoices.js
 *
 * Voraussetzungen:
 * - cloudflared muss laufen: cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433
 * - Backend .env muss W4A_DB_SERVER=localhost enthalten
 *
 * Log-Referenz: [LOG-021]
 * Erstellt: 2026-02-04
 */

const path = require('path');

// Lade .env aus dem Backend-Ordner
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');
const {
    calculateWindowPrice,
    calculateAccessoryPrice,
    calculateWorkPrice,
    SYSTEM_PRICES,
    VAT_RATE
} = require('../services/budget/priceCalculator');

// ============================================================================
// KONFIGURATION
// ============================================================================

const CONFIG = {
    // Anzahl Rechnungen fuer Backtest
    SAMPLE_SIZE: 50,

    // Offset fuer verschiedene Sample-Sets (0 = erste 50, 50 = zweite 50, 100 = dritte 50)
    SAMPLE_OFFSET: 100,  // LOG-027: Neues Sample-Set fuer weitere Tests

    // Zeitraum
    START_DATE: '2024-01-01',
    END_DATE: '2025-12-31',

    // Filter: Nur Rechnungen mit diesen Keywords in Notiz
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT'],

    // BZObjType fuer Rechnungs-Positionen
    BZOBJTYPE_RECHNUNG: 7,

    // Toleranz fuer "Treffer" (innerhalb dieser Abweichung gilt als Treffer)
    HIT_TOLERANCE_PERCENT: 20,

    // Mindestbetrag fuer Rechnungen (filtert Kleinstauftraege)
    MIN_INVOICE_VALUE: 500,

    // Mass-Extraktion aus Positionstext
    DIMENSION_PATTERNS: [
        // 1230x1480 (mm)
        /(\d{3,4})\s*[xX×]\s*(\d{3,4})/,
        // 123 x 148 (cm, wird *10)
        /(\d{2,3})\s*[xX×]\s*(\d{2,3})\s*cm/i,
        // B=1230 H=1480
        /B\s*[:=]\s*(\d{3,4}).*H\s*[:=]\s*(\d{3,4})/i,
        // 1,23 x 1,48 (m, wird *1000)
        /(\d)[,.](\d{2})\s*[xX×]\s*(\d)[,.](\d{2})\s*m/i
    ],

    // Keywords fuer ignorierte Positionen (LOG-025)
    IGNORE_KEYWORDS: [
        'anfahrt', 'fahrt', 'km',
        'schraube', 'winkel', 'dichtung', 'silikon', 'schaum',
        'rabatt', 'nachlass', 'skonto',
        'material', 'kleinmaterial', 'kleinteil',
        'versand', 'fracht', 'porto'
    ]
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Extrahiert Masse aus Positionstext
 * LOG-027: Sucht im KOMPLETTEN Text, nicht nur erste Zeile!
 * W4A Format: "Breite: 1190 mm, Höhe: 1225 mm" steht oft am Ende des Textes
 *
 * @param {string} text - Bezeichnung oder Langtext
 * @returns {Object|null} - { width_mm, height_mm } oder null
 */
function extractDimensions(text) {
    if (!text) return null;

    // LOG-027: Normalisiere Text (mehrere Zeilen zu einem String, Zeilenumbrüche zu Spaces)
    const normalizedText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');

    // Pattern 1 (NEU - HOECHSTE PRIORITAET): "Breite: 1190 mm, Höhe: 1225 mm" (W4A Standard-Format)
    // LOG-027: Dieses Format steht oft in den Positionsdetails
    let match = normalizedText.match(/Breite\s*:\s*(\d{3,4})\s*mm.*?H[öo]he\s*:\s*(\d{3,4})\s*mm/i);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10),
            height_mm: parseInt(match[2], 10),
            unit: 'mm_labeled',
            confidence: 'high',
            pattern: 'w4a_labeled'
        };
    }

    // Pattern 2: 1230x1480 (mm) - klassisches Format
    match = normalizedText.match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10),
            height_mm: parseInt(match[2], 10),
            unit: 'mm',
            confidence: 'high',
            pattern: 'dimension_x'
        };
    }

    // Pattern 3: 123 x 148 cm
    match = normalizedText.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})\s*cm/i);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10) * 10,
            height_mm: parseInt(match[2], 10) * 10,
            unit: 'cm',
            confidence: 'medium',
            pattern: 'dimension_cm'
        };
    }

    // Pattern 4: B=1230 H=1480 oder B:1230 H:1480
    match = normalizedText.match(/B\s*[:=]\s*(\d{3,4}).*H\s*[:=]\s*(\d{3,4})/i);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10),
            height_mm: parseInt(match[2], 10),
            unit: 'explicit',
            confidence: 'high',
            pattern: 'b_h_explicit'
        };
    }

    // Pattern 5: 1,23 x 1,48 m (Meter-Format)
    match = normalizedText.match(/(\d)[,.](\d{2})\s*[xX×]\s*(\d)[,.](\d{2})\s*m/i);
    if (match) {
        return {
            width_mm: parseInt(match[1] + match[2], 10) * 10,
            height_mm: parseInt(match[3] + match[4], 10) * 10,
            unit: 'm',
            confidence: 'medium',
            pattern: 'dimension_m'
        };
    }

    // Pattern 6 (NEU): Einzelne Werte "B 1190" oder "H 1225" (nur wenn beide gefunden)
    const widthMatch = normalizedText.match(/(?:Breite|B)\s*[:=]?\s*(\d{3,4})/i);
    const heightMatch = normalizedText.match(/(?:H[öo]he|H)\s*[:=]?\s*(\d{3,4})/i);
    if (widthMatch && heightMatch) {
        return {
            width_mm: parseInt(widthMatch[1], 10),
            height_mm: parseInt(heightMatch[1], 10),
            unit: 'separate',
            confidence: 'medium',
            pattern: 'separate_b_h'
        };
    }

    return null;
}

/**
 * Erkennt Element-Typ aus Positionstext
 * @param {string} text
 * @returns {string} - fenster, tuer, hst, psk, haustuer, unknown
 */
function detectElementType(text) {
    if (!text) return 'unknown';
    const t = text.toLowerCase();

    if (t.includes('hst') || t.includes('hebe-schiebe') || t.includes('hebeschiebe')) return 'hst';
    if (t.includes('psk') || t.includes('parallel')) return 'psk';
    if (t.includes('haustuer') || t.includes('eingang')) return 'haustuer';
    if (t.includes('balkon') || t.includes('terrassen') || t.includes('tuer')) return 'tuer';
    if (t.includes('fenster') || t.includes('dkf') || t.includes('dreh')) return 'fenster';

    return 'fenster'; // Default
}

/**
 * Erkennt System aus Positionstext oder Header
 * @param {string} text
 * @returns {string} - CASTELLO, CALIDO, IMPREO, DEFAULT
 */
function detectSystem(text) {
    if (!text) return 'DEFAULT';
    const t = text.toLowerCase();

    if (t.includes('impreo')) return 'IMPREO';
    if (t.includes('calido')) return 'CALIDO';
    if (t.includes('castello')) return 'CASTELLO';
    if (t.includes('afino')) return 'AFINO';

    // Verglasung als Hinweis
    if (t.includes('3-fach') || t.includes('3fach') || t.includes('dreifach')) return 'CALIDO';
    if (t.includes('2-fach') || t.includes('2fach') || t.includes('zweifach')) return 'CASTELLO';

    return 'DEFAULT';
}

/**
 * Erkennt ob Position ein Header ist
 * LOG-025: Header = PozNr OHNE Punkt (1, 2, 3) ODER Anzahl=0 UND EinzPreis=0
 */
function isHeader(pos) {
    // Neue Logik: PozNr ohne Punkt = Header
    if (pos.PosNr) {
        const posNrStr = String(pos.PosNr).trim();
        // Wenn PozNr ein Integer ist (keine Dezimalstelle/Punkt), dann Header
        if (!posNrStr.includes('.') && /^\d+$/.test(posNrStr)) {
            return true;
        }
    }
    // Fallback: Alte Logik
    return (!pos.Anzahl || pos.Anzahl === 0) && (!pos.EinzPreis || pos.EinzPreis === 0);
}

/**
 * Prueft ob Position eine echte Produkt-Position ist (PozNr MIT Punkt)
 * LOG-025: Nur X.Y Positionen sind echte Produkte
 */
function isProductPosition(pos) {
    if (pos.PosNr) {
        const posNrStr = String(pos.PosNr).trim();
        // Hat Punkt und numerische Teile (z.B. 1.1, 2.3)
        return posNrStr.includes('.') && /^\d+\.\d+$/.test(posNrStr);
    }
    // Fallback: Hat Menge und Preis
    return pos.Anzahl > 0 && pos.EinzPreis > 0;
}

/**
 * Prueft ob Position ignoriert werden soll
 * LOG-025: Anfahrt, Kleinmaterial, Rabatt etc.
 */
function shouldIgnorePosition(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return CONFIG.IGNORE_KEYWORDS.some(kw => t.includes(kw));
}

/**
 * Prueft ob Position Regiestunden/Montage ist
 * LOG-025: Regiestunden = Montageleistung, NICHT ignorieren!
 */
function isRegiePosition(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return t.includes('regie') || t.includes('stunde') || t.includes('std') ||
           t.includes('arbeitszeit') || t.includes('lohn');
}

/**
 * Erkennt Zubehoer-Typ
 */
function detectAccessoryType(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    if (t.includes('rollladen') || t.includes('rolladen')) return 'rollladen';
    if (t.includes('raffstore') || t.includes('raff')) return 'raffstore';
    if (t.includes('motor') || t.includes('elektrisch')) return 'motor';
    if (t.includes('afb') || t.includes('aussenfensterbank') || t.includes('aussen-fensterbank')) return 'afb';
    if (t.includes('ifb') || t.includes('innenfensterbank') || t.includes('innen-fensterbank')) return 'ifb';
    if (t.includes('insekt') || t.includes('fliegengitter')) return 'insektenschutz';
    if (t.includes('plissee')) return 'plissee';

    return null;
}

/**
 * Erkennt Montage-Typ
 */
function detectWorkType(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    if (t.includes('demontage')) return 'demontage';
    if (t.includes('montage')) return 'montage';
    if (t.includes('entsorgung')) return 'entsorgung';

    return null;
}

/**
 * Berechnet Statistiken
 */
function calculateStats(values) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    // Median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Standardabweichung
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100
    };
}

// ============================================================================
// HAUPT-LOGIK
// ============================================================================

async function fetchInvoices(pool) {
    console.log('\n[1/4] Hole Rechnungen aus W4A...');
    console.log(`   OFFSET: ${CONFIG.SAMPLE_OFFSET}, LIMIT: ${CONFIG.SAMPLE_SIZE}`);

    // Baue Keyword-Filter
    const keywordFilter = CONFIG.KEYWORDS
        .map(kw => `Notiz LIKE '%${kw}%'`)
        .join(' OR ');

    // LOG-025: Mit OFFSET fuer verschiedene Sample-Sets
    const query = `
        SELECT
            Code,
            Nummer,
            Datum,
            Wert,
            Bruttowert,
            SDObjMemberCode AS KundenCode,
            ProjektCode,
            Notiz
        FROM dbo.Rechnung
        WHERE Datum >= '${CONFIG.START_DATE}'
          AND Datum <= '${CONFIG.END_DATE}'
          AND Bruttowert >= ${CONFIG.MIN_INVOICE_VALUE}
          AND (${keywordFilter})
        ORDER BY Datum DESC
        OFFSET ${CONFIG.SAMPLE_OFFSET} ROWS
        FETCH NEXT ${CONFIG.SAMPLE_SIZE} ROWS ONLY
    `;

    const result = await pool.request().query(query);
    console.log(`   ${result.recordset.length} Rechnungen gefunden (OFFSET ${CONFIG.SAMPLE_OFFSET})`);

    return result.recordset;
}

async function fetchPositions(pool, invoiceCode) {
    const query = `
        SELECT
            Code,
            PozNr AS PosNr,
            Bezeichnung,
            Bemerkung AS Langtext,
            Anzahl,
            Einheit,
            EinzPreis,
            Rabatt,
            GesPreis AS GesamtPreis,
            ArtikelCode
        FROM dbo.Positionen
        WHERE BZObjType = ${CONFIG.BZOBJTYPE_RECHNUNG}
          AND BZObjMemberCode = @invoiceCode
        ORDER BY PozNr
    `;

    const result = await pool.request()
        .input('invoiceCode', sql.Int, invoiceCode)
        .query(query);

    return result.recordset;
}

function analyzePositions(positions) {
    const analysis = {
        headers: [],
        elements: [],
        accessories: [],
        work: [],
        ignored: [],      // LOG-025: Ignorierte Positionen tracken
        unknown: [],
        context: {
            system: 'DEFAULT',
            manufacturer: 'WERU',
            glazing: null,
            refDimensions: null  // LOG-025: Referenzmasse aus Header
        }
    };

    // LOG-025: Aktueller Kontext vom letzten Header
    let currentHeaderContext = {
        system: 'DEFAULT',
        manufacturer: 'WERU',
        glazing: null
    };

    for (const pos of positions) {
        const text = `${pos.Bezeichnung || ''} ${pos.Langtext || ''}`;

        // LOG-025: Ignorierte Positionen (Anfahrt, Kleinmaterial, Rabatt)
        if (shouldIgnorePosition(text)) {
            analysis.ignored.push(pos);
            continue;
        }

        // Header erkennen (Kontext-Setter)
        if (isHeader(pos)) {
            analysis.headers.push(pos);

            // System aus Header extrahieren
            const system = detectSystem(text);
            if (system !== 'DEFAULT') {
                currentHeaderContext.system = system;
                analysis.context.system = system;
            }

            // Hersteller erkennen
            if (text.toLowerCase().includes('aluprof')) {
                currentHeaderContext.manufacturer = 'ALUPROF';
                analysis.context.manufacturer = 'ALUPROF';
            } else if (text.toLowerCase().includes('weru')) {
                currentHeaderContext.manufacturer = 'WERU';
                analysis.context.manufacturer = 'WERU';
            }

            // Verglasung
            if (text.includes('3-fach') || text.includes('3fach') || text.includes('dreifach')) {
                currentHeaderContext.glazing = '3-fach';
                analysis.context.glazing = '3-fach';
            } else if (text.includes('2-fach') || text.includes('2fach') || text.includes('zweifach')) {
                currentHeaderContext.glazing = '2-fach';
                analysis.context.glazing = '2-fach';
            }

            // LOG-025: Referenzmasse aus Header extrahieren
            const refDims = extractDimensions(text);
            if (refDims) {
                analysis.context.refDimensions = refDims;
            }

            continue;
        }

        // LOG-025: Regiestunden/Montagezeit = Montage-Block
        if (isRegiePosition(text)) {
            analysis.work.push({
                ...pos,
                work_type: 'montage',
                is_regie: true
            });
            continue;
        }

        // Montage/Demontage/Entsorgung
        const workType = detectWorkType(text);
        if (workType) {
            analysis.work.push({
                ...pos,
                work_type: workType
            });
            continue;
        }

        // LOG-025: Nur echte Produkt-Positionen weiter verarbeiten (X.Y Format)
        const isProdPos = isProductPosition(pos);

        // Zubehoer
        const accType = detectAccessoryType(text);
        if (accType) {
            analysis.accessories.push({
                ...pos,
                accessory_type: accType,
                // LOG-025: Kontext vom Header vererben
                inherited_context: { ...currentHeaderContext }
            });
            continue;
        }

        // Fenster-Elemente
        const dims = extractDimensions(text);
        if (dims) {
            analysis.elements.push({
                ...pos,
                dimensions: dims,
                element_type: detectElementType(text),
                qty: Math.round(pos.Anzahl) || 1,  // LOG-025: Ensure integer qty
                // LOG-025: Kontext vom Header vererben
                inherited_context: { ...currentHeaderContext }
            });
            continue;
        }

        // LOG-025: NUR echte Produkt-Positionen (X.Y Format) als Fenster werten
        // Wenn KEINE Masse erkannt wurde UND KEINE explizite Fenster-Bezeichnung
        // dann ist es KEIN Fenster (z.B. "Stk", "Psch" ohne Masse = Kleinteile)
        const elemType = detectElementType(text);

        // Strenge Pruefung: Fenster nur wenn:
        // 1. Expliziter Fenster-Typ (nicht 'fenster' als Default-Fallback)
        // 2. Es ist eine Produkt-Position (X.Y Format) ODER hat Referenzmasse
        // 3. Preis ist realistisch fuer ein Fenster (> 100 EUR)
        const isExplicitWindow = text.toLowerCase().match(/fenster|dkf|dreh.*kipp|psk|hst|hebe.*schiebe|balkon.*t|terrassen.*t/);

        if (isExplicitWindow && isProdPos && pos.GesamtPreis > 100) {
            // LOG-025: Verwende Referenzmasse aus Header wenn vorhanden
            const fallbackDims = analysis.context.refDimensions
                ? { ...analysis.context.refDimensions, unit: 'from_header', confidence: 'medium' }
                : { width_mm: 1000, height_mm: 1200, unit: 'assumed', confidence: 'low' };

            analysis.elements.push({
                ...pos,
                dimensions: fallbackDims,
                element_type: elemType,
                qty: Math.round(pos.Anzahl) || 1,  // LOG-025: Ensure integer qty
                // LOG-025: Kontext vom Header vererben
                inherited_context: { ...currentHeaderContext }
            });
            continue;
        }

        // Alles andere: Unknown (wird nicht als Fenster gezaehlt)
        analysis.unknown.push(pos);
    }

    return analysis;
}

function calculateBudgetPrice(analysis) {
    let fensterTotal = 0;
    let zubehoerTotal = 0;
    let montageTotal = 0;
    let elementCount = 0;

    const breakdown = {
        fenster_items: [],
        zubehoer_items: [],
        work_items: []
    };

    // Fenster-Elemente kalkulieren
    for (const elem of analysis.elements) {
        const { dimensions, element_type, qty } = elem;

        // LOG-025: System aus vererbtem Kontext oder Global-Kontext
        const effectiveSystem = (elem.inherited_context?.system !== 'DEFAULT')
            ? elem.inherited_context.system
            : analysis.context.system;

        const windowResult = calculateWindowPrice(
            {
                width_mm: dimensions.width_mm,
                height_mm: dimensions.height_mm,
                qty: qty
            },
            {
                system: effectiveSystem,
                color_inside: 'weiss',
                color_outside: 'weiss'
            }
        );

        fensterTotal += windowResult.price;
        elementCount += qty;

        breakdown.fenster_items.push({
            bezeichnung: elem.Bezeichnung?.substring(0, 40),
            dims: `${dimensions.width_mm}x${dimensions.height_mm}`,
            qty,
            budget_price: windowResult.price,
            actual_price: elem.GesamtPreis,
            system: effectiveSystem
        });
    }

    // Zubehoer kalkulieren (vereinfacht - basierend auf durchschnittlicher Breite)
    const avgWidth = analysis.elements.length > 0
        ? analysis.elements.reduce((sum, e) => sum + (e.dimensions?.width_mm || 1000), 0) / analysis.elements.length
        : 1000;

    for (const acc of analysis.accessories) {
        const type = acc.accessory_type;
        let price = 0;

        if (type === 'rollladen') {
            price = Math.max(120, (avgWidth / 1000) * 180);
        } else if (type === 'raffstore') {
            price = Math.max(200, (avgWidth / 1000) * 280);
        } else if (type === 'motor') {
            price = 150;
        } else if (type === 'afb') {
            price = Math.max(25, (avgWidth / 1000) * 35);
        } else if (type === 'ifb') {
            price = Math.max(30, (avgWidth / 1000) * 45);
        } else if (type === 'insektenschutz') {
            price = 80;
        } else if (type === 'plissee') {
            price = 120;
        }

        price = price * (acc.Anzahl || 1);
        zubehoerTotal += price;

        breakdown.zubehoer_items.push({
            type,
            qty: acc.Anzahl,
            budget_price: Math.round(price * 100) / 100,
            actual_price: acc.GesamtPreis
        });
    }

    // LOG-025: Montage-Block inkl. Regiestunden
    // Regiestunden werden jetzt auch als Montage gewertet
    const hasMontage = analysis.work.some(w => w.work_type === 'montage');
    const hasRegie = analysis.work.some(w => w.is_regie);
    const workResult = calculateWorkPrice(
        {
            montage: hasMontage || hasRegie,  // Regie = Montage
            demontage: analysis.work.some(w => w.work_type === 'demontage'),
            entsorgung: analysis.work.some(w => w.work_type === 'entsorgung') ? 'element' : false
        },
        elementCount || 1
    );

    montageTotal = workResult.total;

    for (const w of analysis.work) {
        breakdown.work_items.push({
            type: w.work_type,
            is_regie: w.is_regie || false,
            actual_price: w.GesamtPreis
        });
    }

    const netTotal = fensterTotal + zubehoerTotal + montageTotal;
    const grossTotal = netTotal * (1 + VAT_RATE / 100);

    return {
        net_total: Math.round(netTotal * 100) / 100,
        gross_total: Math.round(grossTotal * 100) / 100,
        breakdown: {
            fenster: Math.round(fensterTotal * 100) / 100,
            zubehoer: Math.round(zubehoerTotal * 100) / 100,
            montage: Math.round(montageTotal * 100) / 100
        },
        element_count: elementCount,
        context: analysis.context,
        ignored_count: analysis.ignored?.length || 0,  // LOG-025: Ignorierte tracken
        details: breakdown
    };
}

async function runBacktest() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  BACKTEST: Budget-Preismodell vs. W4A Rechnungen');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Konfiguration:`);
    console.log(`  - Sample Size: ${CONFIG.SAMPLE_SIZE}`);
    console.log(`  - Zeitraum: ${CONFIG.START_DATE} bis ${CONFIG.END_DATE}`);
    console.log(`  - Keywords: ${CONFIG.KEYWORDS.join(', ')}`);
    console.log(`  - Treffer-Toleranz: +/- ${CONFIG.HIT_TOLERANCE_PERCENT}%`);
    console.log('═══════════════════════════════════════════════════════════════');

    const pool = await getW4APool();

    // 1. Rechnungen holen
    const invoices = await fetchInvoices(pool);

    if (invoices.length === 0) {
        console.log('\nKeine Rechnungen gefunden! Pruefe Filter-Kriterien.');
        await closeW4APool();
        return;
    }

    // 2. Positionen analysieren
    console.log('\n[2/4] Analysiere Positionen...');

    const results = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const invoice of invoices) {
        processedCount++;
        process.stdout.write(`\r   ${processedCount}/${invoices.length} verarbeitet...`);

        try {
            const positions = await fetchPositions(pool, invoice.Code);

            if (positions.length === 0) {
                continue; // Keine Positionen, ueberspringe
            }

            const analysis = analyzePositions(positions);

            // Nur wenn Fenster-Elemente gefunden wurden
            if (analysis.elements.length === 0) {
                continue;
            }

            const budgetPrice = calculateBudgetPrice(analysis);
            const actualBrutto = invoice.Bruttowert || (invoice.Wert * 1.19);

            // Abweichung berechnen
            const deviation = ((budgetPrice.gross_total - actualBrutto) / actualBrutto) * 100;
            const absDeviation = Math.abs(deviation);
            const isHit = absDeviation <= CONFIG.HIT_TOLERANCE_PERCENT;

            results.push({
                invoice_code: invoice.Code,
                invoice_nummer: invoice.Nummer,
                invoice_datum: invoice.Datum,
                notiz: invoice.Notiz?.substring(0, 50),
                actual_brutto: Math.round(actualBrutto * 100) / 100,
                budget_brutto: budgetPrice.gross_total,
                deviation_percent: Math.round(deviation * 100) / 100,
                abs_deviation_percent: Math.round(absDeviation * 100) / 100,
                is_hit: isHit,
                element_count: budgetPrice.element_count,
                system: budgetPrice.context.system,
                breakdown: budgetPrice.breakdown
            });

        } catch (err) {
            errorCount++;
            console.error(`\n   Fehler bei Rechnung ${invoice.Code}: ${err.message}`);
        }
    }

    console.log(`\n   ${results.length} Rechnungen analysiert, ${errorCount} Fehler`);

    // 3. Statistiken berechnen
    console.log('\n[3/4] Berechne Statistiken...');

    const deviations = results.map(r => r.deviation_percent);
    const absDeviations = results.map(r => r.abs_deviation_percent);
    const hits = results.filter(r => r.is_hit);

    const stats = {
        total_analyzed: results.length,
        hits: hits.length,
        hit_rate: Math.round((hits.length / results.length) * 100),
        deviation: calculateStats(deviations),
        abs_deviation: calculateStats(absDeviations)
    };

    // Ausreisser (> 50% Abweichung)
    const outliers = results.filter(r => r.abs_deviation_percent > 50);

    // Top 5 mit groesster Abweichung
    const worstResults = [...results].sort((a, b) => b.abs_deviation_percent - a.abs_deviation_percent).slice(0, 5);

    // Top 5 beste Treffer
    const bestResults = [...results].sort((a, b) => a.abs_deviation_percent - b.abs_deviation_percent).slice(0, 5);

    // System-Analyse
    const systemStats = {};
    for (const r of results) {
        if (!systemStats[r.system]) {
            systemStats[r.system] = { count: 0, deviations: [] };
        }
        systemStats[r.system].count++;
        systemStats[r.system].deviations.push(r.deviation_percent);
    }

    for (const sys of Object.keys(systemStats)) {
        systemStats[sys].avg_deviation = calculateStats(systemStats[sys].deviations).avg;
        systemStats[sys].median_deviation = calculateStats(systemStats[sys].deviations).median;
    }

    // 4. Ergebnisse ausgeben
    console.log('\n[4/4] Ergebnisse...');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  BACKTEST ERGEBNISSE');
    console.log('═══════════════════════════════════════════════════════════════');

    console.log('\n  ZUSAMMENFASSUNG:');
    console.log(`  - Analysiert: ${stats.total_analyzed} Rechnungen`);
    console.log(`  - Treffer (± ${CONFIG.HIT_TOLERANCE_PERCENT}%): ${stats.hits} (${stats.hit_rate}%)`);
    console.log(`  - Ausreisser (> 50%): ${outliers.length} (${Math.round(outliers.length / results.length * 100)}%)`);

    console.log('\n  ABWEICHUNG (Preismodell vs. Rechnung):');
    console.log(`  - Median: ${stats.deviation.median > 0 ? '+' : ''}${stats.deviation.median}%`);
    console.log(`  - Durchschnitt: ${stats.deviation.avg > 0 ? '+' : ''}${stats.deviation.avg}%`);
    console.log(`  - Min: ${stats.deviation.min}%`);
    console.log(`  - Max: ${stats.deviation.max}%`);
    console.log(`  - StdDev: ${stats.deviation.stdDev}%`);

    console.log('\n  ABSOLUTE ABWEICHUNG:');
    console.log(`  - Median: ${stats.abs_deviation.median}%`);
    console.log(`  - Durchschnitt: ${stats.abs_deviation.avg}%`);

    console.log('\n  NACH SYSTEM:');
    for (const [sys, data] of Object.entries(systemStats)) {
        console.log(`  - ${sys}: ${data.count} Rechnungen, Median ${data.median_deviation}%, Avg ${data.avg_deviation}%`);
    }

    console.log('\n  TOP 5 BESTE TREFFER:');
    for (const r of bestResults) {
        console.log(`  - ${r.invoice_nummer}: Budget ${r.budget_brutto} EUR vs. Actual ${r.actual_brutto} EUR (${r.deviation_percent > 0 ? '+' : ''}${r.deviation_percent}%)`);
    }

    console.log('\n  TOP 5 GROESSTE ABWEICHUNGEN:');
    for (const r of worstResults) {
        console.log(`  - ${r.invoice_nummer}: Budget ${r.budget_brutto} EUR vs. Actual ${r.actual_brutto} EUR (${r.deviation_percent > 0 ? '+' : ''}${r.deviation_percent}%)`);
        console.log(`      Notiz: ${r.notiz || '-'}, System: ${r.system}, Elemente: ${r.element_count}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ERKENNTNISSE & EMPFEHLUNGEN');
    console.log('═══════════════════════════════════════════════════════════════');

    // Automatische Erkenntnisse
    if (stats.deviation.median > 10) {
        console.log('\n  [!] Preismodell ist ZU HOCH');
        console.log('      -> Empfehlung: Basispreise reduzieren');
    } else if (stats.deviation.median < -10) {
        console.log('\n  [!] Preismodell ist ZU NIEDRIG');
        console.log('      -> Empfehlung: Basispreise erhoehen');
    } else {
        console.log('\n  [OK] Median-Abweichung im akzeptablen Bereich');
    }

    if (stats.hit_rate < 50) {
        console.log('\n  [!] Trefferquote unter 50%');
        console.log('      -> Empfehlung: Preismodell ueberarbeiten');
    } else if (stats.hit_rate >= 80) {
        console.log('\n  [OK] Trefferquote ueber 80% - Modell ist brauchbar');
    }

    if (outliers.length / results.length > 0.1) {
        console.log('\n  [!] Mehr als 10% Ausreisser');
        console.log('      -> Empfehlung: Ausreisser analysieren, evtl. Sonderposten erkennen');
    }

    // System-spezifische Erkenntnisse
    for (const [sys, data] of Object.entries(systemStats)) {
        if (data.count >= 3 && Math.abs(data.median_deviation) > 15) {
            console.log(`\n  [!] System ${sys} hat hohe Abweichung (${data.median_deviation}%)`);
            console.log(`      -> Empfehlung: ${sys}-Basispreis anpassen`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    // Verbindung schliessen
    await closeW4APool();

    return {
        stats,
        systemStats,
        results: results.slice(0, 10), // Erste 10 fuer LOG
        worstResults,
        bestResults
    };
}

// ============================================================================
// AUSFUEHRUNG
// ============================================================================

runBacktest()
    .then(result => {
        if (result) {
            console.log('Backtest erfolgreich abgeschlossen.');
        }
    })
    .catch(err => {
        console.error('Backtest fehlgeschlagen:', err);
        closeW4APool();
        process.exit(1);
    });
