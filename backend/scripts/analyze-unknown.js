/**
 * Analyse der UNBEKANNTEN Positionen
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

async function analyzeUnknown() {
    const pool = await getW4APool();

    // Hole eine Stichprobe von 'unbekannten' Positionen
    const query = `
        SELECT TOP 50
            p.Bezeichnung,
            p.Bemerkung,
            p.Anzahl,
            p.Einheit,
            p.EinzPreis,
            p.GesPreis
        FROM dbo.Positionen p
        INNER JOIN dbo.Rechnung r ON p.BZObjMemberCode = r.Code
        WHERE p.BZObjType = 7
          AND r.Datum >= '2024-01-01'
          AND r.Bruttowert >= 500
          AND (r.Notiz LIKE '%DKF%' OR r.Notiz LIKE '%HT%' OR r.Notiz LIKE '%HST%' OR r.Notiz LIKE '%PSK%' OR r.Notiz LIKE '%BT%')
          AND (p.Anzahl IS NOT NULL AND p.Anzahl > 0)
          AND (p.EinzPreis IS NOT NULL AND p.EinzPreis > 0)
          AND p.Bezeichnung NOT LIKE '%fenster%'
          AND p.Bezeichnung NOT LIKE '%tuer%'
          AND p.Bezeichnung NOT LIKE '%Tür%'
          AND p.Bezeichnung NOT LIKE '%HST%'
          AND p.Bezeichnung NOT LIKE '%PSK%'
          AND p.Bezeichnung NOT LIKE '%haustuer%'
          AND p.Bezeichnung NOT LIKE '%Haustür%'
          AND p.Bezeichnung NOT LIKE '%rollladen%'
          AND p.Bezeichnung NOT LIKE '%Rolladen%'
          AND p.Bezeichnung NOT LIKE '%raffstore%'
          AND p.Bezeichnung NOT LIKE '%fensterbank%'
          AND p.Bezeichnung NOT LIKE '%insekt%'
          AND p.Bezeichnung NOT LIKE '%motor%'
          AND p.Bezeichnung NOT LIKE '%stunde%'
          AND p.Bezeichnung NOT LIKE '%std%'
          AND p.Bezeichnung NOT LIKE '%regie%'
          AND p.Bezeichnung NOT LIKE '%anfahrt%'
          AND p.Bezeichnung NOT LIKE '%konstruktionsholz%'
          AND p.Bezeichnung NOT LIKE '%schraub%'
          AND p.Bezeichnung NOT LIKE '%silikon%'
          AND p.Bezeichnung NOT LIKE '%rabatt%'
          AND p.Bezeichnung NOT LIKE '%entsorg%'
          AND p.Bezeichnung NOT LIKE '%montage%'
          AND p.Bezeichnung NOT LIKE '%Montage%'
          AND p.Bezeichnung NOT LIKE '%demontage%'
          AND p.Bezeichnung NOT LIKE '%AFB%'
          AND p.Bezeichnung NOT LIKE '%IFB%'
        ORDER BY NEWID()
    `;

    const result = await pool.request().query(query);

    console.log('\n=== STICHPROBE UNBEKANNTER POSITIONEN (50) ===\n');

    // Gruppiere nach Mustern
    const patterns = {
        'GLAS': [],
        'BESCHLAG': [],
        'GRIFF': [],
        'DICHTUNG': [],
        'ERSATZTEIL': [],
        'LIEFERUNG': [],
        'SONSTIGES': []
    };

    for (const pos of result.recordset) {
        const text = (pos.Bezeichnung || '').toLowerCase();
        const display = `[${pos.Anzahl}] x [${pos.EinzPreis?.toFixed(2)}] | ${(pos.Bezeichnung || '').substring(0, 70)}`;

        if (text.includes('glas') || text.includes('scheibe') || text.includes('isolier')) {
            patterns['GLAS'].push(display);
        } else if (text.includes('beschlag') || text.includes('band') || text.includes('schloss') || text.includes('kfv')) {
            patterns['BESCHLAG'].push(display);
        } else if (text.includes('griff') || text.includes('olive') || text.includes('drücker')) {
            patterns['GRIFF'].push(display);
        } else if (text.includes('dichtung') || text.includes('dicht')) {
            patterns['DICHTUNG'].push(display);
        } else if (text.includes('ersatz') || text.includes('reparatur') || text.includes('austausch')) {
            patterns['ERSATZTEIL'].push(display);
        } else if (text.includes('liefer') || text.includes('versand') || text.includes('transport')) {
            patterns['LIEFERUNG'].push(display);
        } else {
            patterns['SONSTIGES'].push(display);
        }
    }

    for (const [cat, items] of Object.entries(patterns)) {
        if (items.length > 0) {
            console.log(`\n--- ${cat} (${items.length}) ---`);
            for (const item of items.slice(0, 5)) {
                console.log(item);
            }
        }
    }

    await closeW4APool();
}

analyzeUnknown().catch(console.error);
