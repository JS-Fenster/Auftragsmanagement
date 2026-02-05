/**
 * Test: GPT-5.2 mit Rohdaten aus W4A
 * Sendet Positionen an Edge Function und zeigt was GPT extrahiert
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const INVOICE_NR = process.argv[2] || '250223';

async function test() {
    console.log(`\n=== GPT ROHDATEN-TEST fuer Rechnung ${INVOICE_NR} ===\n`);

    // 1. Hole Positionen aus W4A
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

    console.log(`Rechnung: ${inv.Nummer}`);
    console.log(`Bruttowert: ${inv.Bruttowert} EUR`);
    console.log(`Notiz: ${inv.Notiz}\n`);

    const posResult = await pool.request()
        .input('code', sql.Int, inv.Code)
        .query(`
            SELECT
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

    const positions = posResult.recordset;
    console.log(`${positions.length} Positionen geladen\n`);

    await closeW4APool();

    // 2. Sende an Edge Function
    console.log('Sende an GPT...\n');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-gpt-extraction`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ positions, invoice_total: inv.Bruttowert })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fehler: ${response.status} - ${errorText}`);
        return;
    }

    const result = await response.json();

    // 3. Zeige Ergebnis
    console.log('=== GPT EXTRAKTION ===\n');
    console.log(JSON.stringify(result.gpt_extraction, null, 2));

    console.log('\n=== METADATA ===');
    console.log(`Positionen gesendet: ${result.raw_positions_count}`);
    console.log(`Model: ${result.model}`);
    if (result.usage) {
        console.log(`Tokens: ${result.usage.prompt_tokens} prompt + ${result.usage.completion_tokens} completion = ${result.usage.total_tokens} total`);
    }

    // 4. Vergleich mit Ist
    console.log('\n=== VERGLEICH ===');
    console.log(`Tatsaechlicher Bruttowert: ${inv.Bruttowert} EUR`);

    if (result.gpt_extraction) {
        const ext = result.gpt_extraction;
        console.log(`GPT erkannt: ${ext.hersteller || ext.manufacturer || '?'} / ${ext.system || ext.produktsystem || '?'}`);

        const elemente = ext.elemente || ext.fenster_tueren || ext.items || [];
        console.log(`GPT Elemente: ${Array.isArray(elemente) ? elemente.length : '?'}`);
    }
}

test().catch(console.error);
