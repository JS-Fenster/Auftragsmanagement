/**
 * Debug: Einzelne Rechnung untersuchen
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

const INVOICE_NR = process.argv[2] || '250223';

async function debug() {
    const pool = await getW4APool();

    const invResult = await pool.request().query(`
        SELECT Code, Nummer, Bruttowert, Notiz FROM dbo.Rechnung WHERE Nummer = '${INVOICE_NR}'
    `);
    const inv = invResult.recordset[0];

    if (!inv) {
        console.log(`Rechnung ${INVOICE_NR} nicht gefunden!`);
        await closeW4APool();
        return;
    }

    console.log(`\nRECHNUNG ${INVOICE_NR}`);
    console.log(`Bruttowert: ${inv.Bruttowert} EUR`);
    console.log(`Notiz: ${inv.Notiz}`);

    const posResult = await pool.request()
        .input('code', sql.Int, inv.Code)
        .query(`
            SELECT
                PozNr AS PosNr,
                Bezeichnung,
                CAST(Bemerkung AS NVARCHAR(MAX)) AS Langtext,
                Anzahl,
                EinzPreis,
                GesPreis
            FROM dbo.Positionen
            WHERE BZObjType = 7 AND BZObjMemberCode = @code
            ORDER BY Code
        `);

    console.log(`\n${posResult.recordset.length} Positionen:\n`);

    for (const p of posResult.recordset) {
        const posNrStr = p.PosNr ? String(p.PosNr).trim() : 'NULL';
        console.log(`--- PosNr: ${posNrStr} ---`);
        console.log(`Bezeichnung: ${(p.Bezeichnung || '-')}`);
        if (p.Langtext && p.Langtext.trim()) {
            console.log(`Langtext: ${p.Langtext.replace(/\r\n/g, ' | ')}`);
        }
        console.log(`Anzahl: ${p.Anzahl}, EinzPreis: ${p.EinzPreis}, Gesamt: ${p.GesPreis}`);
        console.log('');
    }

    await closeW4APool();
}

debug().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
