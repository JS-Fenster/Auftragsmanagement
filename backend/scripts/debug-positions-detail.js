/**
 * Debug: Zeigt Positions-Details um zu verstehen warum Masse nicht erkannt werden
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

async function debug() {
    const pool = await getW4APool();

    // Eine Rechnung mit "0 Elementen" untersuchen: 250256 (HT)
    const testInvoices = ['250256', '250242', '250255'];

    for (const invoiceNr of testInvoices) {
        console.log('\n' + '='.repeat(80));
        console.log(`RECHNUNG ${invoiceNr}`);
        console.log('='.repeat(80));

        // Hole Rechnung
        const invResult = await pool.request().query(`
            SELECT Code, Nummer, Bruttowert, Notiz FROM dbo.Rechnung WHERE Nummer = '${invoiceNr}'
        `);
        const inv = invResult.recordset[0];
        if (!inv) {
            console.log('Nicht gefunden!');
            continue;
        }
        console.log(`Bruttowert: ${inv.Bruttowert} EUR, Notiz: ${inv.Notiz}`);

        // Hole Positionen
        const posResult = await pool.request()
            .input('code', sql.Int, inv.Code)
            .query(`
                SELECT
                    Code,
                    PozNr AS PosNr,
                    Bezeichnung,
                    CAST(Bemerkung AS NVARCHAR(MAX)) AS Langtext,
                    Anzahl,
                    EinzPreis,
                    GesPreis AS GesamtPreis
                FROM dbo.Positionen
                WHERE BZObjType = 7 AND BZObjMemberCode = @code
                ORDER BY Code
            `);

        console.log(`\n${posResult.recordset.length} Positionen:`);
        console.log('-'.repeat(80));

        for (const pos of posResult.recordset) {
            const posNrStr = pos.PosNr ? String(pos.PosNr).trim() : 'NULL';
            const isHeader = !pos.PosNr || (!posNrStr.includes('.') && /^\d+$/.test(posNrStr));

            console.log(`\n[${isHeader ? 'HEADER' : 'ITEM'}] PosNr: ${posNrStr}`);
            console.log(`  Bezeichnung: ${(pos.Bezeichnung || '-').substring(0, 70)}`);

            if (pos.Langtext && pos.Langtext.trim()) {
                console.log(`  Langtext: ${pos.Langtext.replace(/\r\n/g, ' | ').substring(0, 150)}`);
            }

            console.log(`  Anzahl: ${pos.Anzahl}, EinzPreis: ${pos.EinzPreis}, Gesamt: ${pos.GesamtPreis}`);

            // Versuche Masse zu finden
            const text = `${pos.Bezeichnung || ''} ${pos.Langtext || ''}`;
            const mmMatch = text.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})/);
            const cmMatch = text.match(/(\d{2,3})\s*[xX×*]\s*(\d{2,3})/);
            const bxhMatch = text.match(/[Bb]\s*[=:]\s*(\d+).*?[Hh]\s*[=:]\s*(\d+)/);

            if (mmMatch) {
                console.log(`  >>> MASSE GEFUNDEN (mm): ${mmMatch[1]} x ${mmMatch[2]}`);
            } else if (cmMatch) {
                console.log(`  >>> MASSE GEFUNDEN (cm?): ${cmMatch[1]} x ${cmMatch[2]}`);
            } else if (bxhMatch) {
                console.log(`  >>> MASSE GEFUNDEN (B=H=): ${bxhMatch[1]} x ${bxhMatch[2]}`);
            } else {
                console.log(`  (Keine Masse im Text)`);
            }
        }
    }

    await closeW4APool();
}

debug().catch(err => {
    console.error('Fehler:', err);
    closeW4APool();
});
