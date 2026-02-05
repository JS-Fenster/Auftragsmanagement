/**
 * Positions-Analyse Script: Klassifikation von Rechnungspositionen
 *
 * Analysiert 100 Rechnungen aus W4A (2024-2025, mit Fenster-Keywords)
 * und klassifiziert alle Positionen nach Mustern.
 *
 * Ausfuehrung: node backend/scripts/analyze-position-types.js
 *
 * Voraussetzungen:
 * - cloudflared muss laufen: cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433
 * - Backend .env muss W4A_DB_SERVER=localhost enthalten
 *
 * Log-Referenz: [LOG-022]
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
    // Anzahl Rechnungen fuer Analyse
    SAMPLE_SIZE: 100,

    // Zeitraum
    START_DATE: '2024-01-01',
    END_DATE: '2025-12-31',

    // Filter: Nur Rechnungen mit diesen Keywords in Notiz
    KEYWORDS: ['DKF', 'HT', 'HST', 'PSK', 'BT'],

    // BZObjType fuer Rechnungs-Positionen
    BZOBJTYPE_RECHNUNG: 7,

    // Mindestbetrag fuer Rechnungen
    MIN_INVOICE_VALUE: 500,

    // Anzahl Beispiele pro Kategorie
    EXAMPLES_PER_CATEGORY: 3
};

// ============================================================================
// KLASSIFIKATIONS-MUSTER
// ============================================================================

const PATTERNS = {
    // Erkennbare Masse (z.B. "1200x1400", "B=1200 H=1400")
    hasDimensions: (text) => {
        if (!text) return false;
        // 1230x1480 (mm)
        if (/\d{3,4}\s*[xX×]\s*\d{3,4}/.test(text)) return true;
        // 123 x 148 cm
        if (/\d{2,3}\s*[xX×]\s*\d{2,3}\s*cm/i.test(text)) return true;
        // B=1230 H=1480
        if (/B\s*[:=]\s*\d{3,4}.*H\s*[:=]\s*\d{3,4}/i.test(text)) return true;
        // 1,23 x 1,48 m
        if (/\d[,.]\d{2}\s*[xX×]\s*\d[,.]\d{2}\s*m/i.test(text)) return true;
        return false;
    },

    // Stunden/Regiearbeiten
    isHourlyWork: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('stunde') || t.includes(' std') || t.includes('std.') ||
               t.includes('regie') || t.includes('/std') || t.includes('stundenl');
    },

    // Anfahrt/Fahrt
    isTravel: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('anfahrt') || t.includes('fahrt') || t.includes('km-pauschale') ||
               t.includes('fahrkost') || t.includes('kilometer');
    },

    // Montage (ohne Fenster-Kontext)
    isMontageOnly: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        const hasMontage = t.includes('montage') || t.includes('einbau') || t.includes('demontage');
        const hasFenster = /fenster|tuer|hst|psk|element|flue?gel/i.test(t);
        return hasMontage && !hasFenster;
    },

    // Material (Konstruktionsholz, Winkel, Schrauben, etc.)
    isMaterial: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('konstruktionsholz') || t.includes('winkel') || t.includes('schraub') ||
               t.includes('duebel') || t.includes('silikon') || t.includes('kompriband') ||
               t.includes('montageschaum') || t.includes('fugendicht') || t.includes('abdeckleiste') ||
               t.includes('leiste') || t.includes('profil ') || t.includes('dichtung') ||
               t.includes('putz') || t.includes('gips') || t.includes('verblender');
    },

    // Eindeutige Fenster-Keywords
    isFensterElement: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('fenster') || t.includes('tuer') || t.includes('hst') ||
               t.includes('psk') || t.includes('haustuer') || t.includes('balkontuer') ||
               t.includes('dreh-kipp') || t.includes('drehkipp') || t.includes(' dk ') ||
               t.includes('dkf') || t.includes('festfeld') || t.includes('festver') ||
               t.includes('fluegel') || t.includes('flue') || /\bfix\b/i.test(t);
    },

    // Rollladen, Raffstore, Insektenschutz
    isAccessory: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('rollladen') || t.includes('rolladen') || t.includes('raffstore') ||
               t.includes('insektenschutz') || t.includes('fliegengitter') || t.includes('plissee') ||
               t.includes('motor') || t.includes('antrieb') || t.includes('steuerung') ||
               t.includes('afb') || t.includes('ifb') || t.includes('fensterbank') ||
               t.includes('aussenfensterbank') || t.includes('innenfensterbank');
    },

    // Header (Anzahl=0 UND EinzPreis=0)
    isHeader: (pos) => {
        const anzahlNull = !pos.Anzahl || pos.Anzahl === 0;
        const preisNull = !pos.EinzPreis || pos.EinzPreis === 0;
        return anzahlNull && preisNull;
    },

    // Rabatt/Nachlass
    isRabatt: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('rabatt') || t.includes('nachlass') || t.includes('skonto') ||
               t.includes('abzug') || t.includes('% auf') || t.includes('preisnachlass');
    },

    // Entsorgung
    isEntsorgung: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('entsorg') || t.includes('altfenster') || t.includes('muell') ||
               t.includes('abriss') || t.includes('ausbau alt');
    },

    // Verpackung/Lieferung
    isVerpackungLieferung: (text) => {
        if (!text) return false;
        const t = text.toLowerCase();
        return t.includes('verpackung') || t.includes('lieferung') || t.includes('transport') ||
               t.includes('fracht') || t.includes('versand');
    }
};

// ============================================================================
// KATEGORIEN DEFINITION
// ============================================================================

const CATEGORIES = {
    'HEADER': {
        test: (pos, text) => PATTERNS.isHeader(pos),
        description: 'Textzeilen ohne Menge und Preis (WERU CASTELLO etc.)',
        empfehlung: 'IGNORIEREN - Nur Kontext-Info'
    },
    'FENSTER_MIT_MASS': {
        test: (pos, text) => PATTERNS.isFensterElement(text) && PATTERNS.hasDimensions(text) && !PATTERNS.isHeader(pos),
        description: 'Fenster/Tueren mit erkennbaren Massen',
        empfehlung: 'RELEVANT - Hauptprodukt'
    },
    'FENSTER_OHNE_MASS': {
        test: (pos, text) => PATTERNS.isFensterElement(text) && !PATTERNS.hasDimensions(text) && !PATTERNS.isHeader(pos) && !PATTERNS.isAccessory(text),
        description: 'Fenster/Tueren ohne erkennbare Masse im Text',
        empfehlung: 'UNKLAR - Ggf. Masse aus Kontext oder Default'
    },
    'ZUBEHOER': {
        test: (pos, text) => PATTERNS.isAccessory(text) && !PATTERNS.isHeader(pos),
        description: 'Rollladen, Raffstore, Fensterbank, Insektenschutz etc.',
        empfehlung: 'RELEVANT - Zubehoer separat kalkulieren'
    },
    'STUNDEN_REGIE': {
        test: (pos, text) => PATTERNS.isHourlyWork(text) && !PATTERNS.isHeader(pos),
        description: 'Regiearbeiten, Stundenlohn',
        empfehlung: 'IGNORIEREN - Nicht kalkulierbar im Budget'
    },
    'ANFAHRT': {
        test: (pos, text) => PATTERNS.isTravel(text) && !PATTERNS.isHeader(pos),
        description: 'Anfahrtskosten, km-Pauschale',
        empfehlung: 'IGNORIEREN - Pauschal behandeln oder ignorieren'
    },
    'MONTAGE_PUR': {
        test: (pos, text) => PATTERNS.isMontageOnly(text) && !PATTERNS.isHeader(pos),
        description: 'Reine Montage-/Einbaupositionen ohne Fenster-Bezug',
        empfehlung: 'UNKLAR - Evtl. in Montage-Block aufnehmen'
    },
    'MATERIAL': {
        test: (pos, text) => PATTERNS.isMaterial(text) && !PATTERNS.isHeader(pos),
        description: 'Montagematerial (Holz, Schrauben, Silikon etc.)',
        empfehlung: 'IGNORIEREN - Bereits in Montage-Pauschale enthalten'
    },
    'ENTSORGUNG': {
        test: (pos, text) => PATTERNS.isEntsorgung(text) && !PATTERNS.isHeader(pos),
        description: 'Entsorgung, Altfenster-Abriss',
        empfehlung: 'RELEVANT - Im Montage-Block beruecksichtigen'
    },
    'RABATT': {
        test: (pos, text) => PATTERNS.isRabatt(text) && !PATTERNS.isHeader(pos),
        description: 'Rabatte, Nachlaesse',
        empfehlung: 'IGNORIEREN - Budget ist Brutto-Schaetzung'
    },
    'VERPACKUNG_LIEFERUNG': {
        test: (pos, text) => PATTERNS.isVerpackungLieferung(text) && !PATTERNS.isHeader(pos),
        description: 'Verpackung, Transport, Lieferung',
        empfehlung: 'IGNORIEREN - Nicht relevant fuer Budget'
    },
    'UNBEKANNT': {
        test: () => true, // Fallback
        description: 'Nicht eindeutig klassifizierbar',
        empfehlung: 'PRUEFEN - Manuell analysieren'
    }
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function classifyPosition(pos) {
    const text = `${pos.Bezeichnung || ''} ${pos.Bemerkung || ''}`;

    // Durchlaufe Kategorien in Reihenfolge (erste Uebereinstimmung gewinnt)
    for (const [catName, catDef] of Object.entries(CATEGORIES)) {
        if (catName === 'UNBEKANNT') continue; // Fallback am Ende
        if (catDef.test(pos, text)) {
            return catName;
        }
    }

    return 'UNBEKANNT';
}

function truncateText(text, maxLen = 80) {
    if (!text) return '-';
    text = text.replace(/[\r\n\t]+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

function formatCurrency(value) {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// HAUPT-LOGIK
// ============================================================================

async function fetchInvoices(pool) {
    console.log('\n[1/4] Hole Rechnungen aus W4A...');

    const keywordFilter = CONFIG.KEYWORDS
        .map(kw => `Notiz LIKE '%${kw}%'`)
        .join(' OR ');

    const query = `
        SELECT TOP ${CONFIG.SAMPLE_SIZE}
            Code,
            Nummer,
            Datum,
            Wert,
            Bruttowert,
            Notiz
        FROM dbo.Rechnung
        WHERE Datum >= '${CONFIG.START_DATE}'
          AND Datum <= '${CONFIG.END_DATE}'
          AND Bruttowert >= ${CONFIG.MIN_INVOICE_VALUE}
          AND (${keywordFilter})
        ORDER BY NEWID()
    `;

    const result = await pool.request().query(query);
    console.log(`   ${result.recordset.length} Rechnungen gefunden`);

    return result.recordset;
}

async function fetchAllPositions(pool, invoiceCodes) {
    console.log('\n[2/4] Hole alle Positionen...');

    // Hole Positionen in Batches
    const allPositions = [];
    const batchSize = 20;

    for (let i = 0; i < invoiceCodes.length; i += batchSize) {
        const batch = invoiceCodes.slice(i, i + batchSize);
        const codeList = batch.join(',');

        const query = `
            SELECT
                Code,
                BZObjMemberCode AS InvoiceCode,
                PozNr AS PosNr,
                Bezeichnung,
                Bemerkung,
                Anzahl,
                Einheit,
                EinzPreis,
                Rabatt,
                GesPreis AS GesamtPreis
            FROM dbo.Positionen
            WHERE BZObjType = ${CONFIG.BZOBJTYPE_RECHNUNG}
              AND BZObjMemberCode IN (${codeList})
            ORDER BY BZObjMemberCode, PozNr
        `;

        const result = await pool.request().query(query);
        allPositions.push(...result.recordset);

        process.stdout.write(`\r   Batch ${Math.ceil((i + batchSize) / batchSize)}/${Math.ceil(invoiceCodes.length / batchSize)} geladen... (${allPositions.length} Positionen)`);
    }

    console.log(`\n   ${allPositions.length} Positionen insgesamt`);
    return allPositions;
}

function analyzePositions(positions) {
    console.log('\n[3/4] Klassifiziere Positionen...');

    const results = {};

    // Initialisiere alle Kategorien
    for (const catName of Object.keys(CATEGORIES)) {
        results[catName] = {
            count: 0,
            examples: [],
            totalValue: 0
        };
    }

    // Klassifiziere jede Position
    for (const pos of positions) {
        const category = classifyPosition(pos);
        results[category].count++;
        results[category].totalValue += pos.GesamtPreis || 0;

        // Sammle Beispiele
        if (results[category].examples.length < CONFIG.EXAMPLES_PER_CATEGORY) {
            results[category].examples.push({
                anzahl: pos.Anzahl,
                einzPreis: pos.EinzPreis,
                gesamtPreis: pos.GesamtPreis,
                bezeichnung: pos.Bezeichnung,
                bemerkung: pos.Bemerkung
            });
        }
    }

    return results;
}

function printResults(results, totalPositions) {
    console.log('\n[4/4] Ergebnisse...\n');

    console.log('================================================================================');
    console.log('  POSITIONS-KLASSIFIKATION: ' + totalPositions + ' Positionen aus ' + CONFIG.SAMPLE_SIZE + ' Rechnungen');
    console.log('================================================================================\n');

    // Sortiere nach Anzahl (absteigend)
    const sortedCategories = Object.entries(results)
        .sort((a, b) => b[1].count - a[1].count);

    // Tabellen-Header
    console.log('| Kategorie              | Anzahl | %     | Empfehlung | Beschreibung');
    console.log('|------------------------|--------|-------|------------|--------------------------------------------------');

    for (const [catName, data] of sortedCategories) {
        if (data.count === 0) continue;

        const pct = ((data.count / totalPositions) * 100).toFixed(1);
        const empfehlung = CATEGORIES[catName].empfehlung.split(' ')[0]; // Nur erstes Wort

        console.log(
            `| ${catName.padEnd(22)} | ${String(data.count).padStart(6)} | ${pct.padStart(5)}% | ${empfehlung.padEnd(10)} | ${CATEGORIES[catName].description.substring(0, 50)}`
        );
    }

    console.log('\n');

    // Detaillierte Beispiele pro Kategorie
    console.log('================================================================================');
    console.log('  BEISPIELE PRO KATEGORIE');
    console.log('================================================================================\n');

    for (const [catName, data] of sortedCategories) {
        if (data.count === 0) continue;

        console.log(`\n--- ${catName} (${data.count} Positionen, ${formatCurrency(data.totalValue)} EUR Gesamtwert) ---`);
        console.log(`Empfehlung: ${CATEGORIES[catName].empfehlung}`);
        console.log('');

        for (const ex of data.examples) {
            const anzahlStr = ex.anzahl !== null && ex.anzahl !== undefined ? ex.anzahl : '-';
            const preisStr = formatCurrency(ex.einzPreis);
            const text = truncateText(ex.bezeichnung, 80);

            console.log(`  [${anzahlStr}] x [${preisStr}] | ${text}`);

            // Zeige auch Bemerkung wenn vorhanden und anders als Bezeichnung
            if (ex.bemerkung && ex.bemerkung !== ex.bezeichnung) {
                const bemerkungShort = truncateText(ex.bemerkung, 60);
                console.log(`                         -> ${bemerkungShort}`);
            }
        }
    }

    // Zusammenfassung und Empfehlungen
    console.log('\n');
    console.log('================================================================================');
    console.log('  ZUSAMMENFASSUNG & EMPFEHLUNGEN FUER BUDGET-KALKULATION');
    console.log('================================================================================\n');

    const relevant = [];
    const ignorieren = [];
    const unklar = [];

    for (const [catName, data] of sortedCategories) {
        if (data.count === 0) continue;

        const empfehlung = CATEGORIES[catName].empfehlung;
        const entry = `${catName} (${data.count} = ${((data.count / totalPositions) * 100).toFixed(1)}%)`;

        if (empfehlung.startsWith('RELEVANT')) {
            relevant.push(entry);
        } else if (empfehlung.startsWith('IGNORIEREN')) {
            ignorieren.push(entry);
        } else {
            unklar.push(entry + ' - ' + empfehlung);
        }
    }

    console.log('RELEVANT fuer Budget-Kalkulation:');
    for (const r of relevant) {
        console.log('  + ' + r);
    }

    console.log('\nIGNORIEREN (nicht in Budget aufnehmen):');
    for (const i of ignorieren) {
        console.log('  - ' + i);
    }

    console.log('\nUNKLAR (weitere Analyse noetig):');
    for (const u of unklar) {
        console.log('  ? ' + u);
    }

    // Konkrete Handlungsempfehlungen
    console.log('\n');
    console.log('================================================================================');
    console.log('  KONKRETE HANDLUNGSEMPFEHLUNGEN');
    console.log('================================================================================\n');

    const fensterMitMass = results['FENSTER_MIT_MASS']?.count || 0;
    const fensterOhneMass = results['FENSTER_OHNE_MASS']?.count || 0;
    const stunden = results['STUNDEN_REGIE']?.count || 0;
    const material = results['MATERIAL']?.count || 0;

    console.log('1. POSITIONS-FILTER implementieren:');
    console.log('   - NUR Positionen mit Anzahl > 0 und GesamtPreis > 0 beruecksichtigen');
    console.log('   - Stunden/Regie AUSFILTERN (Keywords: "Stunde", "Std", "Regie")');
    console.log('   - Material AUSFILTERN (Keywords: "Konstruktionsholz", "Winkel", "Schraub")');
    console.log('   - Anfahrt AUSFILTERN (Keywords: "Anfahrt", "Fahrt", "km")');

    if (fensterOhneMass > fensterMitMass * 0.5) {
        console.log('\n2. MASS-ERKENNUNG verbessern:');
        console.log('   - ' + fensterOhneMass + ' Fenster-Positionen haben KEINE erkennbaren Masse');
        console.log('   - Empfehlung: Default-Masse je nach Element-Typ verwenden');
        console.log('   - Oder: Confidence auf "low" setzen bei fehlenden Massen');
    }

    if (stunden > 0) {
        console.log('\n3. REGIEARBEITEN separat behandeln:');
        console.log('   - ' + stunden + ' Positionen sind Stunden-/Regiearbeiten');
        console.log('   - Diese NICHT als Fenster interpretieren!');
        console.log('   - Einheit "Std" oder "Stunde" pruefen');
    }

    console.log('\n');
}

// ============================================================================
// AUSFUEHRUNG
// ============================================================================

async function runAnalysis() {
    console.log('================================================================================');
    console.log('  POSITIONS-ANALYSE: Klassifikation fuer Budget-Kalkulation');
    console.log('================================================================================');
    console.log(`  Konfiguration:`);
    console.log(`  - Sample Size: ${CONFIG.SAMPLE_SIZE} Rechnungen`);
    console.log(`  - Zeitraum: ${CONFIG.START_DATE} bis ${CONFIG.END_DATE}`);
    console.log(`  - Keywords: ${CONFIG.KEYWORDS.join(', ')}`);
    console.log('================================================================================');

    const pool = await getW4APool();

    try {
        // 1. Rechnungen holen
        const invoices = await fetchInvoices(pool);

        if (invoices.length === 0) {
            console.log('\nKeine Rechnungen gefunden! Pruefe Filter-Kriterien.');
            return null;
        }

        // 2. Alle Positionen holen
        const invoiceCodes = invoices.map(inv => inv.Code);
        const positions = await fetchAllPositions(pool, invoiceCodes);

        if (positions.length === 0) {
            console.log('\nKeine Positionen gefunden!');
            return null;
        }

        // 3. Klassifizieren
        const results = analyzePositions(positions);

        // 4. Ergebnisse ausgeben
        printResults(results, positions.length);

        return {
            invoiceCount: invoices.length,
            positionCount: positions.length,
            results
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
