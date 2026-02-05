/**
 * analyze-header-pattern-v2.js
 *
 * Detaillierte Analyse des Header-Fenster-Musters:
 * - Hierarchische Position (1, 1.1, 1.2) vs flache PozNr
 * - Was enthalten Header-Positionen genau?
 * - Wie sind die Masse kodiert?
 *
 * Log-Referenz: [LOG-024]
 * Erstellt: 2026-02-04
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// ============================================================================
// ANALYSE-FUNKTIONEN
// ============================================================================

function extractDimensions(text) {
    if (!text) return null;

    // Pattern 1: 1,23m x 1,48m oder 1.23m x 1.48m
    const patternM = /(\d+[,.]\d+)\s*m?\s*[xX×]\s*(\d+[,.]\d+)\s*m/;
    const matchM = text.match(patternM);
    if (matchM) {
        return {
            b: parseFloat(matchM[1].replace(',', '.')) * 1000,
            h: parseFloat(matchM[2].replace(',', '.')) * 1000,
            unit: 'm',
            raw: matchM[0]
        };
    }

    // Pattern 2: 1230x1480 (mm)
    const patternMM = /(\d{3,4})\s*[xX×]\s*(\d{3,4})/;
    const matchMM = text.match(patternMM);
    if (matchMM) {
        return {
            b: parseInt(matchMM[1]),
            h: parseInt(matchMM[2]),
            unit: 'mm',
            raw: matchMM[0]
        };
    }

    // Pattern 3: 123x148 cm oder 123 x 148 cm
    const patternCM = /(\d{2,3})\s*[xX×]\s*(\d{2,3})\s*cm/i;
    const matchCM = text.match(patternCM);
    if (matchCM) {
        return {
            b: parseInt(matchCM[1]) * 10,
            h: parseInt(matchCM[2]) * 10,
            unit: 'cm',
            raw: matchCM[0]
        };
    }

    return null;
}

function extractSystem(text) {
    if (!text) return null;
    const upper = text.toUpperCase();

    // WERU Systeme
    if (upper.includes('CALIDO')) return 'WERU CALIDO';
    if (upper.includes('CASTELLO')) return 'WERU CASTELLO';
    if (upper.includes('IMPREO')) return 'WERU IMPREO';
    if (upper.includes('WERU')) return 'WERU (unbekannt)';

    // Drutex
    if (upper.includes('IGLO')) return 'DRUTEX IGLO';
    if (upper.includes('DRUTEX')) return 'DRUTEX (unbekannt)';

    // Aluprof
    if (upper.includes('ALUPROF') || upper.includes('MB-86') || upper.includes('MB-77')) {
        const mbMatch = upper.match(/MB-\d+/);
        return mbMatch ? `ALUPROF ${mbMatch[0]}` : 'ALUPROF';
    }

    // Schüco
    if (upper.includes('SCHÜCO') || upper.includes('SCHUCO') || upper.includes('SCHUECO')) {
        return 'SCHÜCO';
    }

    return null;
}

function extractGlass(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    // 3-fach oder 2-fach
    if (lower.includes('3-fach') || lower.includes('3fach') || lower.includes('dreifach')) return '3-fach';
    if (lower.includes('2-fach') || lower.includes('2fach') || lower.includes('zweifach')) return '2-fach';

    // Ug-Wert
    const ugMatch = text.match(/[uU]g[\s:=]*(\d+[,.]\d+)/);
    if (ugMatch) {
        const ug = parseFloat(ugMatch[1].replace(',', '.'));
        if (ug <= 0.7) return '3-fach';
        if (ug <= 1.1) return '3-fach';
        if (ug <= 1.6) return '2-fach';
    }

    return null;
}

function extractOpeningType(text) {
    if (!text) return null;
    const upper = text.toUpperCase();

    if (upper.includes('DKL') || upper.includes('DK-L') || upper.includes('DREH-KIPP LINKS')) return 'DKL';
    if (upper.includes('DKR') || upper.includes('DK-R') || upper.includes('DREH-KIPP RECHTS')) return 'DKR';
    if (upper.includes('DKF') || upper.includes('DREH-KIPP')) return 'DK';
    if (upper.includes('DL') || upper.includes('DREH LINKS')) return 'DL';
    if (upper.includes('DR') || upper.includes('DREH RECHTS')) return 'DR';
    if (upper.includes('FESTVERGLAST') || upper.includes('FESTVERGLAS') || upper.includes('FIX')) return 'FIX';
    if (upper.includes('KIPP')) return 'K';
    if (upper.includes('HST') || upper.includes('HEBESCHIEBE')) return 'HST';
    if (upper.includes('PSK') || upper.includes('PARALLEL')) return 'PSK';
    if (upper.includes('BALKONTÜR') || upper.includes('BALKONTUER') || upper.includes('BT')) return 'BT';
    if (upper.includes('HAUSTÜR') || upper.includes('HAUSTUER') || upper.includes('HT')) return 'HT';

    return null;
}

function kategorisieren(pos) {
    const text = (pos.Bezeichnung || '').toLowerCase();
    const anzahl = pos.Anzahl || 0;
    const einzelpreis = pos.EinzPreis || 0;

    if (anzahl === 0 && einzelpreis === 0) return 'HEADER';

    // Hat Masse?
    const dims = extractDimensions(pos.Bezeichnung);
    if (dims) return 'FENSTER_MIT_MASS';

    // Fenster-Keywords ohne Masse?
    if (/fenster|tuer|hst|psk|dreh|kipp|festver|flue?gel/i.test(text)) return 'FENSTER_OHNE_MASS';

    // Zubehör
    if (/rollladen|raffstore|insekt|plissee|fensterbank|motor|antrieb/i.test(text)) return 'ZUBEHOER';

    // Montage/Regie
    if (/regie|stunde|std\.|montage/i.test(text)) return 'MONTAGE';

    return 'SONSTIG';
}

// ============================================================================
// HAUPTLOGIK
// ============================================================================

async function run() {
    console.log('=== W4A Header-Fenster-Muster Analyse V2 ===\n');

    const pool = await getW4APool();

    try {
        // Hole mehrere verschiedene Rechnungen
        console.log('[1/2] Hole Rechnungen mit verschiedenen Herstellern...');

        const rechnungResult = await pool.request().query(`
            SELECT TOP 10 Code, Nummer, Datum, Bruttowert, Notiz
            FROM dbo.Rechnung
            WHERE (
                  Notiz LIKE '%WERU%'
                  OR Notiz LIKE '%CASTELLO%'
                  OR Notiz LIKE '%CALIDO%'
                  OR Notiz LIKE '%Drutex%'
                  OR Notiz LIKE '%DKF%'
              )
              AND Bruttowert > 3000
              AND Datum >= '2024-01-01'
            ORDER BY Datum DESC
        `);

        console.log(`${rechnungResult.recordset.length} Rechnungen gefunden.\n`);

        // Analysiere jede Rechnung
        let alleHeaderInfos = [];

        for (const rechnung of rechnungResult.recordset) {
            console.log('================================================================================');
            console.log(`RECHNUNG ${rechnung.Nummer} | ${rechnung.Bruttowert.toFixed(2)} EUR | ${rechnung.Datum.toISOString().split('T')[0]}`);
            console.log(`Notiz: ${(rechnung.Notiz || '').substring(0, 100)}`);
            console.log('================================================================================\n');

            const posResult = await pool.request()
                .input('code', sql.Int, rechnung.Code)
                .query(`
                    SELECT
                        PozNr,
                        Anzahl,
                        EinzPreis,
                        GesPreis,
                        Bezeichnung,
                        Einheit
                    FROM dbo.Positionen
                    WHERE BZObjType = 7 AND BZObjMemberCode = @code
                    ORDER BY PozNr ASC
                `);

            if (posResult.recordset.length === 0) {
                console.log('  (keine Positionen)\n');
                continue;
            }

            // Zeige alle Positionen mit extrahierten Infos
            console.log('PozNr | Kat            | Masse      | System       | Glas   | Typ  | Bezeichnung (50 Zeichen)');
            console.log('------|----------------|------------|--------------|--------|------|' + '-'.repeat(50));

            let lastHeader = null;

            for (const pos of posResult.recordset) {
                const kat = kategorisieren(pos);
                const dims = extractDimensions(pos.Bezeichnung);
                const system = extractSystem(pos.Bezeichnung);
                const glass = extractGlass(pos.Bezeichnung);
                const openType = extractOpeningType(pos.Bezeichnung);

                // Speichere Header-Info
                if (kat === 'HEADER') {
                    lastHeader = {
                        pozNr: pos.PozNr,
                        text: pos.Bezeichnung,
                        dims: dims,
                        system: system,
                        glass: glass,
                        openType: openType
                    };

                    if (system || glass || dims) {
                        alleHeaderInfos.push(lastHeader);
                    }
                }

                const dimsStr = dims ? `${dims.b}x${dims.h}` : '-';
                const systemStr = (system || '-').substring(0, 12);
                const glassStr = (glass || '-').padEnd(6);
                const typeStr = (openType || '-').padEnd(4);
                const bez = (pos.Bezeichnung || '').substring(0, 50).replace(/[\r\n]+/g, ' ');

                console.log(
                    `${String(pos.PozNr || 0).toString().padEnd(5)} | ` +
                    `${kat.padEnd(14)} | ` +
                    `${dimsStr.padEnd(10)} | ` +
                    `${systemStr.padEnd(12)} | ` +
                    `${glassStr} | ` +
                    `${typeStr} | ` +
                    `${bez}`
                );
            }

            console.log('\n');
        }

        // Zusammenfassung: Was enthalten die Header?
        console.log('\n================================================================================');
        console.log('ZUSAMMENFASSUNG: Was enthalten HEADER-Positionen?');
        console.log('================================================================================\n');

        const headerMitSystem = alleHeaderInfos.filter(h => h.system).length;
        const headerMitGlass = alleHeaderInfos.filter(h => h.glass).length;
        const headerMitDims = alleHeaderInfos.filter(h => h.dims).length;

        console.log(`Analysierte Header mit relevanten Infos: ${alleHeaderInfos.length}`);
        console.log(`  - Mit System-Info: ${headerMitSystem}`);
        console.log(`  - Mit Glas-Info: ${headerMitGlass}`);
        console.log(`  - Mit Masse: ${headerMitDims}`);

        console.log('\nBeispiele:');
        for (const h of alleHeaderInfos.slice(0, 10)) {
            console.log(`\n[PozNr ${h.pozNr}]`);
            console.log(`  Text: "${h.text?.substring(0, 100)}"`);
            if (h.system) console.log(`  System: ${h.system}`);
            if (h.glass) console.log(`  Glas: ${h.glass}`);
            if (h.dims) console.log(`  Masse: ${h.dims.b}x${h.dims.h} (${h.dims.unit})`);
        }

        console.log('\n\n================================================================================');
        console.log('FAZIT');
        console.log('================================================================================\n');

        console.log(`Header enthalten oft wichtige Kontext-Informationen:`);
        console.log(`  - Hersteller/System (z.B. "ALUPROF MB-86", "WERU CASTELLO")`);
        console.log(`  - Referenzmasse (z.B. "1,23m x 1,48m")`);
        console.log(`  - Glas-Spezifikation (z.B. "3-fach")`);
        console.log(`\nDiese Infos können fuer nachfolgende Positionen relevant sein,`);
        console.log(`wenn diese selbst keine expliziten Angaben haben.`);
        console.log(`\nEmpfehlung: Header-Infos als "Kontext" fuer nachfolgende Positionen nutzen.`);

    } catch (err) {
        console.error('Fehler:', err.message);
        console.error(err.stack);
    } finally {
        await closeW4APool();
    }
}

run();
