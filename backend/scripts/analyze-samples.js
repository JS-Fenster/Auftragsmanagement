/**
 * Analyse von Beispiel-Positionen
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sql = require('mssql');

const config = {
    server: 'localhost',
    port: 1433,
    database: 'WorkM001',
    user: process.env.W4A_DB_USER,
    password: process.env.W4A_DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectionTimeout: 60000,
        requestTimeout: 60000
    }
};

async function main() {
    const pool = await sql.connect(config);

    // Beispiel einer guten Rechnung analysieren (250743 - nur 1.67% Abweichung)
    console.log('=== Rechnung 250743 (GUTER TREFFER: +1.67%) ===\n');

    const inv1 = await pool.request().query(`
        SELECT Code, Bruttowert, Notiz
        FROM dbo.Rechnung WHERE Nummer = '250743'
    `);
    console.log(`Bruttowert: ${inv1.recordset[0].Bruttowert} EUR, Notiz: ${inv1.recordset[0].Notiz}`);

    const pos1 = await pool.request().query(`
        SELECT PozNr, Bezeichnung, Bemerkung, Anzahl, EinzPreis, GesPreis
        FROM dbo.Positionen
        WHERE BZObjType = 7 AND BZObjMemberCode = ${inv1.recordset[0].Code}
        ORDER BY PozNr
    `);

    console.log('\nPositionen:');
    pos1.recordset.forEach(p => {
        const bez = (p.Bezeichnung || '').substring(0, 55);
        console.log(`  ${p.PozNr}: ${bez.padEnd(55)} | Anz: ${String(p.Anzahl || 0).padStart(5)} | EP: ${String(p.EinzPreis || 0).padStart(8)} | Ges: ${p.GesPreis}`);
    });

    // Beispiel einer schlechten Rechnung analysieren (250643 - 629% Abweichung)
    console.log('\n\n=== Rechnung 250643 (GROSSER AUSREISSER: +629%) ===\n');

    const inv2 = await pool.request().query(`
        SELECT Code, Bruttowert, Notiz
        FROM dbo.Rechnung WHERE Nummer = '250643'
    `);
    console.log(`Bruttowert: ${inv2.recordset[0].Bruttowert} EUR, Notiz: ${inv2.recordset[0].Notiz}`);

    const pos2 = await pool.request().query(`
        SELECT PozNr, Bezeichnung, Bemerkung, Anzahl, EinzPreis, GesPreis
        FROM dbo.Positionen
        WHERE BZObjType = 7 AND BZObjMemberCode = ${inv2.recordset[0].Code}
        ORDER BY PozNr
    `);

    console.log('\nPositionen:');
    pos2.recordset.forEach(p => {
        const bez = (p.Bezeichnung || '').substring(0, 55);
        console.log(`  ${p.PozNr}: ${bez.padEnd(55)} | Anz: ${String(p.Anzahl || 0).padStart(5)} | EP: ${String(p.EinzPreis || 0).padStart(8)} | Ges: ${p.GesPreis}`);
    });

    await sql.close();
}

main().catch(err => {
    console.error('Error:', err);
    sql.close();
});
