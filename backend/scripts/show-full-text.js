require('dotenv').config();
const sql = require('mssql');

async function showFullText() {
  const pool = await sql.connect({
    server: process.env.W4A_DB_SERVER,
    port: parseInt(process.env.W4A_DB_PORT),
    database: process.env.W4A_DB_DATABASE,
    user: process.env.W4A_DB_USER,
    password: process.env.W4A_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 60000
  });

  // Hole 3 Fenster-Positionen mit dem KOMPLETTEN Text
  const result = await pool.request().query(`
    SELECT TOP 3
      p.Code, p.PozNr, p.Anzahl, p.EinzPreis, p.GesPreis,
      p.Bezeichnung, p.Bemerkung, p.Aufmass, p.Kurztext
    FROM dbo.Positionen p
    WHERE p.BZObjType = 7
      AND p.EinzPreis > 100
      AND p.Bezeichnung LIKE '%Anschlag%'
  `);

  result.recordset.forEach((row, i) => {
    console.log('=== POSITION ' + (i+1) + ' ===');
    console.log('PozNr: ' + row.PozNr);
    console.log('Anzahl: ' + row.Anzahl + ' x ' + row.EinzPreis + ' EUR = ' + row.GesPreis + ' EUR');
    console.log('');
    console.log('--- BEZEICHNUNG (komplett) ---');
    console.log(row.Bezeichnung || '(leer)');
    console.log('');
    console.log('--- BEMERKUNG ---');
    console.log(row.Bemerkung || '(leer)');
    console.log('');
    console.log('--- AUFMASS ---');
    console.log(row.Aufmass || '(leer)');
    console.log('');
    console.log('--- KURZTEXT ---');
    console.log(row.Kurztext || '(leer)');
    console.log('');
    console.log('========================================');
    console.log('');
  });

  await pool.close();
}

showFullText().catch(e => console.error(e.message));
