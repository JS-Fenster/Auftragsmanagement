/**
 * Test: GPT strukturierte Extraktion für Backtest
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const INVOICE_NR = process.argv[2] || '250223';

async function test() {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  GPT STRUKTURIERTE EXTRAKTION - Rechnung ${INVOICE_NR}`);
    console.log(`${'═'.repeat(70)}\n`);

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

    console.log(`Rechnung: ${inv.Nummer} | Brutto: ${inv.Bruttowert} EUR | Notiz: ${inv.Notiz}\n`);

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
    console.log(`${positions.length} Positionen geladen. Sende an GPT...\n`);

    await closeW4APool();

    // 2. Sende an Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-gpt-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions, invoice_total: inv.Bruttowert })
    });

    if (!response.ok) {
        console.error(`Fehler: ${response.status} - ${await response.text()}`);
        return;
    }

    const result = await response.json();
    const ext = result.extraction;

    // 3. Ausgabe strukturiert
    console.log(`${'─'.repeat(70)}`);
    console.log('  KONTEXT');
    console.log(`${'─'.repeat(70)}`);
    console.log(`  Hersteller:    ${ext.kontext.hersteller}`);
    console.log(`  System:        ${ext.kontext.system}`);
    console.log(`  Verglasung:    ${ext.kontext.verglasung}`);
    console.log(`  Material:      ${ext.kontext.material}`);
    console.log(`  Farbe außen:   ${ext.kontext.farbe_aussen}`);
    console.log(`  Farbe innen:   ${ext.kontext.farbe_innen}`);

    console.log(`\n${'─'.repeat(70)}`);
    console.log('  ELEMENTE');
    console.log(`${'─'.repeat(70)}`);
    console.log('  #  | Raum                | Typ        | B×H mm      | Anz | Einzel   | qm    | €/qm');
    console.log('  ' + '─'.repeat(95));

    let elementeSumme = 0;
    for (let i = 0; i < ext.elemente.length; i++) {
        const e = ext.elemente[i];
        const qm = (e.breite_mm * e.hoehe_mm) / 1000000;
        const eurProQm = e.einzelpreis / qm;
        elementeSumme += e.gesamtpreis;

        const raum = (e.raum || '-').substring(0, 18).padEnd(18);
        const typ = (e.typ || '-').substring(0, 10).padEnd(10);
        const masse = `${e.breite_mm}×${e.hoehe_mm}`.padEnd(11);

        console.log(`  ${String(i+1).padStart(2)} | ${raum} | ${typ} | ${masse} | ${String(e.anzahl).padStart(3)} | ${e.einzelpreis.toFixed(2).padStart(8)} | ${qm.toFixed(2).padStart(5)} | ${eurProQm.toFixed(0).padStart(4)}`);
    }
    console.log('  ' + '─'.repeat(95));
    console.log(`  ${ext.elemente.length} Elemente | Summe Gesamtpreise: ${elementeSumme.toFixed(2)} EUR`);

    console.log(`\n${'─'.repeat(70)}`);
    console.log('  ZUBEHÖR');
    console.log(`${'─'.repeat(70)}`);
    if (ext.zubehoer.aussenfensterbank_lfm > 0) {
        console.log(`  Außenfensterbank: ${ext.zubehoer.aussenfensterbank_lfm} lfm × ${ext.zubehoer.aussenfensterbank_preis_lfm} €/lfm`);
    }
    if (ext.zubehoer.innenfensterbank_lfm > 0) {
        console.log(`  Innenfensterbank: ${ext.zubehoer.innenfensterbank_lfm} lfm × ${ext.zubehoer.innenfensterbank_preis_lfm} €/lfm`);
    }
    if (ext.zubehoer.rollladen_anzahl > 0) {
        console.log(`  Rollläden:        ${ext.zubehoer.rollladen_anzahl} Stk (elektrisch: ${ext.zubehoer.rollladen_elektrisch ? 'ja' : 'nein'})`);
    }
    if (ext.zubehoer.raffstore_anzahl > 0) {
        console.log(`  Raffstore:        ${ext.zubehoer.raffstore_anzahl} Stk`);
    }
    if (ext.zubehoer.insektenschutz_anzahl > 0) {
        console.log(`  Insektenschutz:   ${ext.zubehoer.insektenschutz_anzahl} Stk`);
    }
    if (ext.zubehoer.sonstiges && ext.zubehoer.sonstiges.length > 0) {
        console.log(`  Sonstiges:`);
        for (const s of ext.zubehoer.sonstiges) {
            console.log(`    - ${s.bezeichnung || s}: ${s.gesamt || ''} EUR`);
        }
    }

    console.log(`\n${'─'.repeat(70)}`);
    console.log('  MONTAGE');
    console.log(`${'─'.repeat(70)}`);
    console.log(`  Stunden:     ${ext.montage.stunden} × ${ext.montage.stundensatz} €/Std = ${ext.montage.montage_gesamt} EUR`);
    console.log(`  Demontage:   ${ext.montage.demontage ? 'ja' : 'nein'}`);
    console.log(`  Entsorgung:  ${ext.montage.entsorgung_gesamt} EUR`);

    if (ext.rabatte && ext.rabatte.betrag !== 0) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log('  RABATTE');
        console.log(`${'─'.repeat(70)}`);
        console.log(`  ${ext.rabatte.beschreibung}: ${ext.rabatte.betrag} EUR`);
    }

    console.log(`\n${'─'.repeat(70)}`);
    console.log('  SUMMEN');
    console.log(`${'─'.repeat(70)}`);
    console.log(`  Elemente:      ${ext.summen.elemente_summe?.toFixed(2) || '?'} EUR`);
    console.log(`  Zubehör:       ${ext.summen.zubehoer_summe?.toFixed(2) || '?'} EUR`);
    console.log(`  Montage:       ${ext.summen.montage_summe?.toFixed(2) || '?'} EUR`);
    console.log(`  Rabatt:        ${ext.summen.rabatt_summe?.toFixed(2) || '0.00'} EUR`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Netto (GPT):   ${ext.summen.netto_berechnet?.toFixed(2) || '?'} EUR`);
    console.log(`  Brutto (Rg):   ${inv.Bruttowert.toFixed(2)} EUR`);

    // Abweichung berechnen
    if (ext.summen.netto_berechnet) {
        const bruttoCalc = ext.summen.netto_berechnet * 1.19;
        const diff = ((bruttoCalc - inv.Bruttowert) / inv.Bruttowert * 100);
        console.log(`  ─────────────────────────────`);
        console.log(`  Brutto (calc): ${bruttoCalc.toFixed(2)} EUR (Netto × 1.19)`);
        console.log(`  Abweichung:    ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`);
    }

    console.log(`\n${'─'.repeat(70)}`);
    console.log('  META');
    console.log(`${'─'.repeat(70)}`);
    console.log(`  Tokens: ${result.meta.tokens.prompt_tokens} prompt + ${result.meta.tokens.completion_tokens} completion = ${result.meta.tokens.total_tokens} total`);

    console.log(`\n${'═'.repeat(70)}\n`);
}

test().catch(console.error);
