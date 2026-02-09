/**
 * Zeigt Header-Positionen aus Rechnungen
 * Dient zur Analyse warum System-Erkennung nicht greift
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getW4APool, closeW4APool } = require('../config/w4a-database');

async function showHeaders() {
    const pool = await getW4APool();

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
          AND r.Code IN (
              SELECT Code FROM dbo.Rechnung
              WHERE Datum >= '2024-01-01' AND Bruttowert > 500
              AND (Notiz LIKE '%DKF%' OR Notiz LIKE '%HT%')
              ORDER BY Datum DESC
              OFFSET 100 ROWS FETCH NEXT 5 ROWS ONLY
          )
        ORDER BY r.Nummer, p.PozNr
    `;

    const result = await pool.request().query(query);

    console.log('\n=== HEADER-POSITIONEN IN RECHNUNGEN ===\n');

    let currentRechnung = '';
    for (const row of result.recordset) {
        if (row.RechnungsNr !== currentRechnung) {
            console.log('\n' + '='.repeat(80));
            console.log('RECHNUNG ' + row.RechnungsNr);
            console.log('='.repeat(80));
            currentRechnung = row.RechnungsNr;
        }

        const pozNrStr = row.PozNr ? String(row.PozNr).trim() : 'NULL';
        const isHeader = !row.PozNr || !pozNrStr.includes('.');
        const marker = isHeader ? '[HEADER]' : '[ITEM]  ';

        console.log('\n' + marker + ' PozNr: ' + pozNrStr);
        console.log('Bezeichnung: ' + (row.Bezeichnung || '-'));
        if (row.Langtext && row.Langtext.trim()) {
            console.log('Langtext: ' + row.Langtext.replace(/\r\n/g, ' | ').substring(0, 150));
        }
        console.log('Anzahl: ' + row.Anzahl + ', Preis: ' + row.EinzPreis);
    }

    await closeW4APool();
}

showHeaders().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
