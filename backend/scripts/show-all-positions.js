const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getW4APool, closeW4APool } = require('../config/w4a-database');

async function debug() {
    const pool = await getW4APool();

    const result = await pool.request().query(`
        SELECT
            Code,
            PozNr,
            Bezeichnung,
            Anzahl,
            EinzPreis
        FROM dbo.Positionen
        WHERE BZObjType = 7
          AND BZObjMemberCode = (SELECT Code FROM dbo.Rechnung WHERE Nummer = '250255')
        ORDER BY Code
    `);

    console.log('ALLE Positionen fuer Rechnung 250255 (sortiert nach Code):');
    console.log('-----------------------------------------------------------');
    for (const r of result.recordset) {
        const bez = (r.Bezeichnung || '').substring(0, 70);
        const hasCastello = bez.toLowerCase().includes('castello');
        const marker = hasCastello ? ' <<< CASTELLO!' : '';
        console.log(`PozNr=${r.PozNr || 'NULL'}, Anz=${r.Anzahl}, Preis=${r.EinzPreis}: ${bez}${marker}`);
    }

    await closeW4APool();
}
debug().catch(console.error);
