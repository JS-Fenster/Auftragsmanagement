/**
 * Debug: System-Erkennung testen
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getW4APool, closeW4APool } = require('../config/w4a-database');

// Kopie von detectManufacturerAndSystem aus backtest-invoices.js
function detectManufacturerAndSystem(text) {
    if (!text) return { manufacturer: 'WERU', system: 'DEFAULT' };
    const t = text.toLowerCase();

    // WERU Systeme
    if (t.includes('castello')) return { manufacturer: 'WERU', system: 'CASTELLO' };
    if (t.includes('calido')) return { manufacturer: 'WERU', system: 'CALIDO' };
    if (t.includes('impreo')) return { manufacturer: 'WERU', system: 'IMPREO' };
    if (t.includes('afino')) return { manufacturer: 'WERU', system: 'AFINO' };
    if (t.includes('drutex')) return { manufacturer: 'DRUTEX', system: 'DEFAULT' };

    return { manufacturer: 'WERU', system: 'DEFAULT' };
}

async function debug() {
    const pool = await getW4APool();

    // Hole eine Rechnung
    const query = `
        SELECT
            p.PozNr,
            p.Bezeichnung,
            CAST(p.Bemerkung AS NVARCHAR(500)) as Langtext,
            p.Anzahl,
            p.EinzPreis,
            r.Nummer as RechnungsNr
        FROM dbo.Positionen p
        JOIN dbo.Rechnung r ON p.BZObjMemberCode = r.Code
        WHERE p.BZObjType = 7
          AND r.Nummer = '250255'
        ORDER BY p.PozNr
    `;

    const result = await pool.request().query(query);

    console.log('\\n=== DEBUG: System-Erkennung fuer Rechnung 250255 ===\\n');

    let currentContext = { manufacturer: 'WERU', system: 'DEFAULT' };

    for (const pos of result.recordset) {
        const text = `${pos.Bezeichnung || ''} ${pos.Langtext || ''}`;
        const posNrStr = pos.PozNr ? String(pos.PozNr).trim() : 'NULL';
        const isNullHeader = !pos.PozNr || pos.PozNr === null;
        const isIntHeader = posNrStr !== 'NULL' && !posNrStr.includes('.') && /^\d+$/.test(posNrStr);
        const isHeader = isNullHeader || isIntHeader || ((!pos.Anzahl || pos.Anzahl === 0) && (!pos.EinzPreis || pos.EinzPreis === 0));

        console.log(`PozNr=${posNrStr}, isNull=${isNullHeader}, isInt=${isIntHeader}, isHeader=${isHeader}`);

        if (isHeader) {
            const detected = detectManufacturerAndSystem(text);

            console.log('--- HEADER ---');
            console.log('PozNr:', posNrStr);
            console.log('Bezeichnung:', (pos.Bezeichnung || '').substring(0, 60));
            console.log('Text fuer Erkennung:', text.substring(0, 80));
            console.log('Erkannt:', detected);

            if (detected.system !== 'DEFAULT') {
                currentContext = detected;
                console.log('>>> KONTEXT GESETZT:', currentContext);
            }
            console.log('');
        }
    }

    console.log('\\n=== FINALER KONTEXT ===');
    console.log(currentContext);

    await closeW4APool();
}

debug().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
