/**
 * Debug: Backtest fuer eine einzelne Rechnung
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// Import aus backtest-invoices.js
const CONFIG = {
    BZOBJTYPE_RECHNUNG: 7,
    IGNORE_KEYWORDS: ['anfahrt', 'fahrt', 'km', 'schraube', 'winkel', 'dichtung', 'silikon', 'schaum', 'rabatt', 'nachlass', 'skonto', 'material', 'kleinmaterial', 'kleinteil', 'versand', 'fracht', 'porto']
};

function detectManufacturerAndSystem(text) {
    if (!text) return { manufacturer: 'WERU', system: 'DEFAULT' };
    const t = text.toLowerCase();

    if (t.includes('drutex')) return { manufacturer: 'DRUTEX', system: 'DEFAULT' };
    if (t.includes('castello')) return { manufacturer: 'WERU', system: 'CASTELLO' };
    if (t.includes('calido')) return { manufacturer: 'WERU', system: 'CALIDO' };
    if (t.includes('impreo')) return { manufacturer: 'WERU', system: 'IMPREO' };
    if (t.includes('afino')) return { manufacturer: 'WERU', system: 'AFINO' };
    if (t.includes('atris')) return { manufacturer: 'WERU', system: 'ATRIS' };

    if (t.includes('3-fach') || t.includes('3fach')) return { manufacturer: 'WERU', system: 'CALIDO' };
    if (t.includes('2-fach') || t.includes('2fach')) return { manufacturer: 'WERU', system: 'CASTELLO' };

    return { manufacturer: 'WERU', system: 'DEFAULT' };
}

function isHeader(pos) {
    if (!pos.PosNr || pos.PosNr === null) {
        return true;
    }
    const posNrStr = String(pos.PosNr).trim();
    if (!posNrStr.includes('.') && /^\d+$/.test(posNrStr)) {
        return true;
    }
    return (!pos.Anzahl || pos.Anzahl === 0) && (!pos.EinzPreis || pos.EinzPreis === 0);
}

function shouldIgnorePosition(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return CONFIG.IGNORE_KEYWORDS.some(kw => t.includes(kw));
}

async function debug() {
    const pool = await getW4APool();

    // Hole Rechnung 250255
    const invoiceResult = await pool.request().query(`
        SELECT Code, Nummer, Bruttowert FROM dbo.Rechnung WHERE Nummer = '250255'
    `);
    const invoice = invoiceResult.recordset[0];
    console.log('Rechnung:', invoice);

    // Hole Positionen
    const posResult = await pool.request()
        .input('invoiceCode', sql.Int, invoice.Code)
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
            ORDER BY PozNr
        `);

    const positions = posResult.recordset;
    console.log('\\nAnzahl Positionen:', positions.length);

    // Simuliere analyzePositions
    let currentHeaderContext = { system: 'DEFAULT', manufacturer: 'WERU' };
    let globalContext = { system: 'DEFAULT', manufacturer: 'WERU' };
    let elementsWithSystem = [];

    for (const pos of positions) {
        const text = `${pos.Bezeichnung || ''} ${pos.Langtext || ''}`;

        if (shouldIgnorePosition(text)) {
            continue;
        }

        if (isHeader(pos)) {
            const { manufacturer, system } = detectManufacturerAndSystem(text);

            console.log(`\\nHEADER: PosNr=${pos.PosNr || 'NULL'}`);
            console.log(`  Bezeichnung: ${(pos.Bezeichnung || '').substring(0, 50)}`);
            console.log(`  Detected: manufacturer=${manufacturer}, system=${system}`);

            if (system !== 'DEFAULT') {
                currentHeaderContext.system = system;
                globalContext.system = system;
                console.log(`  >>> KONTEXT GESETZT: ${system}`);
            }
            if (manufacturer !== 'WERU') {
                currentHeaderContext.manufacturer = manufacturer;
                globalContext.manufacturer = manufacturer;
            }
        } else {
            // Item - nur wenn es wie ein Fenster aussieht
            if (pos.Bezeichnung && pos.GesamtPreis > 100) {
                elementsWithSystem.push({
                    posNr: pos.PosNr,
                    bezeichnung: pos.Bezeichnung.substring(0, 30),
                    preis: pos.GesamtPreis,
                    inheritedSystem: currentHeaderContext.system
                });
            }
        }
    }

    console.log('\\n=== ERGEBNIS ===');
    console.log('Global Context:', globalContext);
    console.log('\\nElemente mit vererbtem System:');
    for (const e of elementsWithSystem) {
        console.log(`  ${e.posNr}: ${e.bezeichnung} -> ${e.inheritedSystem}`);
    }

    await closeW4APool();
}

debug().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
