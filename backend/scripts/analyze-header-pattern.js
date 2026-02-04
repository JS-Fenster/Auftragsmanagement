/**
 * analyze-header-pattern.js
 *
 * Analysiert das Header-Fenster-Muster in W4A Positionen:
 * - Steht vor einer Fenster-Position eine beschreibende Header-Position?
 *
 * Aufruf: node backend/scripts/analyze-header-pattern.js
 *
 * Log-Referenz: [LOG-024]
 * Erstellt: 2026-02-04
 */

const path = require('path');

// Lade .env aus dem Backend-Ordner
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// ============================================================================
// KATEGORISIERUNG
// ============================================================================

function kategorisieren(pos) {
    const text = (pos.Bezeichnung || '').toLowerCase();
    const anzahl = pos.Anzahl || 0;
    const einzelpreis = pos.EinzPreis || 0;

    // HEADER: Anzahl=0 UND EinzPreis=0 (Beschreibungs-Position)
    if (anzahl === 0 && einzelpreis === 0) {
        return 'HEADER';
    }

    // Masse erkennbar? (z.B. "1200x1400" oder "Breite: 1200")
    const massePattern = /\d{3,4}\s*[xX×]\s*\d{3,4}|breite[:\s]*\d{3,4}|h[öo]he[:\s]*\d{3,4}/i;
    if (massePattern.test(text)) {
        return 'FENSTER';
    }

    // Montage/Regie/Stunden
    if (/regie|stunde|std\.|montage(?!.*fenster)/i.test(text)) {
        return 'MONTAGE';
    }

    return 'SONSTIG';
}

// ============================================================================
// HAUPTLOGIK
// ============================================================================

async function run() {
    console.log('=== W4A Header-Fenster-Muster Analyse ===\n');

    const pool = await getW4APool();

    try {
        // Finde eine Rechnung mit Fenstern (suche nach typischen Fenster-Begriffen)
        console.log('[1/3] Suche Rechnung mit Fenster-Keywords...');

        const rechnungResult = await pool.request().query(`
            SELECT TOP 5 Code, Nummer, Datum, Bruttowert, Notiz
            FROM dbo.Rechnung
            WHERE (
                  Notiz LIKE '%WERU%'
                  OR Notiz LIKE '%CASTELLO%'
                  OR Notiz LIKE '%CALIDO%'
                  OR Notiz LIKE '%Fenster%'
                  OR Notiz LIKE '%DKF%'
              )
              AND Bruttowert > 5000
            ORDER BY Datum DESC
        `);

        if (rechnungResult.recordset.length === 0) {
            // Fallback: Einfach eine große Rechnung nehmen
            console.log('Keine Rechnung mit Fenster-Keywords gefunden, versuche Fallback...');
            const fallbackResult = await pool.request().query(`
                SELECT TOP 5 Code, Nummer, Datum, Bruttowert, Notiz
                FROM dbo.Rechnung
                WHERE Bruttowert > 10000
                ORDER BY Datum DESC
            `);
            if (fallbackResult.recordset.length === 0) {
                console.log('Keine passende Rechnung gefunden');
                return;
            }
            rechnungResult.recordset = fallbackResult.recordset;
        }

        // Nimm die erste Rechnung
        const rechnung = rechnungResult.recordset[0];
        console.log('\n=== RECHNUNG ===');
        console.log(`Code: ${rechnung.Code}`);
        console.log(`Nummer: ${rechnung.Nummer}`);
        console.log(`Datum: ${rechnung.Datum}`);
        console.log(`Brutto: ${rechnung.Bruttowert} EUR`);
        console.log(`Notiz: ${(rechnung.Notiz || '').substring(0, 200)}`);

        // Hole ALLE Positionen dieser Rechnung
        console.log('\n[2/3] Hole alle Positionen...');

        const posResult = await pool.request()
            .input('rechnungCode', sql.Int, rechnung.Code)
            .query(`
                SELECT
                    PozNr,
                    Anzahl,
                    EinzPreis,
                    GesPreis,
                    Bezeichnung,
                    Einheit
                FROM dbo.Positionen
                WHERE BZObjType = 7
                  AND BZObjMemberCode = @rechnungCode
                ORDER BY PozNr ASC
            `);

        console.log(`\n=== ${posResult.recordset.length} POSITIONEN (sortiert nach PozNr) ===\n`);
        console.log('PozNr | Anz  | EinzPr   | GesPr    | Kat      | Bezeichnung');
        console.log('------|------|----------|----------|----------|' + '-'.repeat(60));

        let lastKat = null;
        let headerFensterPaare = 0;
        let fensterOhneHeader = 0;
        let headerDetails = [];

        for (let i = 0; i < posResult.recordset.length; i++) {
            const pos = posResult.recordset[i];
            const kat = kategorisieren(pos);

            // Prüfe: Ist das ein Fenster und war die vorherige Position ein Header?
            if (kat === 'FENSTER') {
                if (lastKat === 'HEADER') {
                    headerFensterPaare++;
                    // Speichere das Paar für Details
                    const prevPos = posResult.recordset[i - 1];
                    headerDetails.push({
                        header: (prevPos.Bezeichnung || '').substring(0, 80),
                        fenster: (pos.Bezeichnung || '').substring(0, 80),
                        headerPozNr: prevPos.PozNr,
                        fensterPozNr: pos.PozNr
                    });
                } else {
                    fensterOhneHeader++;
                }
            }

            const bez = (pos.Bezeichnung || '').substring(0, 60).replace(/\n/g, ' ');
            const katMarker = {
                'HEADER': '[HEADER]',
                'FENSTER': '[FENSTER]',
                'MONTAGE': '[MONTAGE]',
                'SONSTIG': '[SONSTIG]'
            }[kat];

            console.log(
                `${String(pos.PozNr || 0).padStart(5)} | ` +
                `${String(pos.Anzahl || 0).padStart(4)} | ` +
                `${String((pos.EinzPreis || 0).toFixed(2)).padStart(8)} | ` +
                `${String((pos.GesPreis || 0).toFixed(2)).padStart(8)} | ` +
                `${katMarker.padEnd(8)} | ` +
                `${bez}`
            );

            lastKat = kat;
        }

        console.log('\n=== MUSTER-ANALYSE ===');
        console.log(`Header -> Fenster Paare: ${headerFensterPaare}`);
        console.log(`Fenster ohne vorherigen Header: ${fensterOhneHeader}`);

        if (headerFensterPaare > 0) {
            console.log('\n=== HEADER-FENSTER PAARE (Details) ===');
            for (const detail of headerDetails) {
                console.log(`\n[PozNr ${detail.headerPozNr}] HEADER:`);
                console.log(`  "${detail.header}"`);
                console.log(`[PozNr ${detail.fensterPozNr}] FENSTER:`);
                console.log(`  "${detail.fenster}"`);
            }
        }

        if (headerFensterPaare > 0 && fensterOhneHeader === 0) {
            console.log('\n[OK] MUSTER BESTAETIGT: Jede Fenster-Position hat einen Header davor!');
        } else if (headerFensterPaare > fensterOhneHeader) {
            console.log('\n[TEILWEISE] MUSTER TEILWEISE: Die meisten Fenster haben einen Header.');
        } else {
            console.log('\n[X] KEIN KLARES MUSTER: Header -> Fenster Beziehung nicht konsistent.');
        }

        // Analyse mehrerer Rechnungen für Statistik
        console.log('\n\n[3/3] Analysiere mehrere Rechnungen fuer Statistik...');

        let gesamtHeaderFenster = 0;
        let gesamtFensterOhneHeader = 0;
        let analysiertRechnungen = 0;

        for (const r of rechnungResult.recordset) {
            const posRes = await pool.request()
                .input('code', sql.Int, r.Code)
                .query(`
                    SELECT PozNr, Anzahl, EinzPreis, GesPreis, Bezeichnung
                    FROM dbo.Positionen
                    WHERE BZObjType = 7 AND BZObjMemberCode = @code
                    ORDER BY PozNr ASC
                `);

            let prevKat = null;
            for (const p of posRes.recordset) {
                const k = kategorisieren(p);
                if (k === 'FENSTER') {
                    if (prevKat === 'HEADER') {
                        gesamtHeaderFenster++;
                    } else {
                        gesamtFensterOhneHeader++;
                    }
                }
                prevKat = k;
            }
            analysiertRechnungen++;
        }

        console.log(`\n=== STATISTIK ueber ${analysiertRechnungen} Rechnungen ===`);
        console.log(`Header -> Fenster Paare: ${gesamtHeaderFenster}`);
        console.log(`Fenster ohne Header: ${gesamtFensterOhneHeader}`);

        const headerRate = gesamtHeaderFenster + gesamtFensterOhneHeader > 0
            ? (gesamtHeaderFenster / (gesamtHeaderFenster + gesamtFensterOhneHeader) * 100).toFixed(1)
            : 0;
        console.log(`Header-Rate: ${headerRate}%`);

    } catch (err) {
        console.error('Fehler:', err.message);
    } finally {
        await closeW4APool();
    }
}

run();
