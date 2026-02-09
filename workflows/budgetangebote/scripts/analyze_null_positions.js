/**
 * Analyse-Script: Positionen mit PozNr = NULL
 *
 * Kategorisiert NULL-Positionen in:
 * 1. Raumbezeichnungen
 * 2. Fensterbeschreibungen
 * 3. Technische Details
 * 4. Summenzeilen
 * 5. Hinweistexte
 * 6. Sonstiges
 *
 * Erstellt: 2026-02-04
 */

const sql = require('mssql');
require('dotenv').config({ path: '../../../backend/.env' });

// W4A Konfiguration
const w4aConfig = {
    server: process.env.W4A_DB_SERVER || 'sql.js-fenster-intern.org',
    port: parseInt(process.env.W4A_DB_PORT || '1433', 10),
    database: process.env.W4A_DB_DATABASE || 'WorkM001',
    user: process.env.W4A_DB_USER,
    password: process.env.W4A_DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,
        requestTimeout: 120000
    }
};

// Kategorisierungs-Patterns
const PATTERNS = {
    // 1. Raumbezeichnungen
    raum: [
        /^(Erdgeschoss|EG|Obergeschoss|OG|Dachgeschoss|DG|Untergeschoss|UG|Keller)/i,
        /^(Zimmer|Raum|Kueche|Kche|Bad|WC|Schlafzimmer|Wohnzimmer|Kinderzimmer)/i,
        /^(Flur|Diele|Treppenhaus|Garage|Terrasse|Balkon|Wintergarten)/i,
        /^\d+\.\s*(OG|UG|DG|EG)/i,
        /(Geschoss|Stock|Etage)\s*[-:]/i,
        /^[A-Z][a-z]+(raum|zimmer)\s*[-:]/i,
        /^Bereich\s*[-:]/i
    ],

    // 2. Fensterbeschreibungen (Masse, Anschlag, Verglasung)
    fenster: [
        /\d+\s*[xX×]\s*\d+/,  // Masse wie 1000x1200 oder 1000 x 1200
        /\d+\s*mm/i,
        /\d+\s*cm/i,
        /BxH|HxB|Breite|Hoehe|Höhe/i,
        /(links|rechts)\s*(angeschlagen|Anschlag|oeffnend|öffnend)/i,
        /Anschlag\s*(links|rechts|L|R)/i,
        /DIN\s*(links|rechts|L|R)/i,
        /(Dreh|Kipp|Dreh-Kipp|DK|Fest|Fix)/i,
        /(2-fl|3-fl|1-fl|2-fluegel|3-fluegel)/i,
        /Fluegel|Flügel/i,
        /(Verglasung|Glas|3-fach|2-fach|Isolier)/i,
        /(Ug|Uw)\s*[=:]\s*[\d,\.]+/i,
        /Sprosse/i,
        /Oberlicht|Unterlicht|Seitenteil/i
    ],

    // 3. Technische Details (Kastenform, Antrieb, System)
    technisch: [
        /(CASTELLO|CALIDO|IMPREO|WERU|Schüco|Schueco|Rehau|Kömmerling|Salamander)/i,
        /(Aufsatz|Vorbau|Unterputz|Einbau)[-\s]?(Rollladen|Raffstore)/i,
        /(Motor|Antrieb|Elektrisch|Funk|Gurt|Kurbel)/i,
        /(Kastenform|Kasten|Blende|Fuehrungsschiene|Führungsschiene)/i,
        /(RC\s*\d|Einbruch|Sicherheit|Beschlag)/i,
        /(Aluminium|Alu|Kunststoff|KST|Holz|Holz-Alu)/i,
        /(RAL\s*\d{4}|Farbe|Dekor|weiss|weiß|anthrazit|grau)/i,
        /(Schwelle|Bodenschwelle|barrierearm|barrierefrei)/i,
        /(Insektenschutz|Fliegengitter|AFB|IFB|Plissee)/i,
        /(Laibung|Leibung|Putz|Anputzleiste)/i,
        /(Stangengriff|Olive|Griff|Drücker|Druecker)/i
    ],

    // 4. Summenzeilen
    summe: [
        /^(Summe|Gesamt|Zwischensumme|Netto|Brutto|Total)/i,
        /Gesamtpreis|Gesamtbetrag/i,
        /inkl\.\s*(MwSt|Mwst|Mehrwertsteuer)/i,
        /zzgl\.\s*(MwSt|Mwst|Mehrwertsteuer)/i,
        /^\s*[-=]+\s*$/,
        /Rabatt|Nachlass|Skonto/i,
        /^EUR\s+[\d\.,]+/,
        /^\s*[\d\.,]+\s*EUR\s*$/
    ],

    // 5. Hinweistexte
    hinweis: [
        /^(Hinweis|Anmerkung|Bemerkung|Notiz|Info|Achtung|Wichtig)[\s:]/i,
        /(Lieferzeit|Lieferung|Montage|Installation)\s*[\d]+\s*(Tag|Woche|Tage|Wochen)/i,
        /Aufmass|Aufmaß|vor Ort/i,
        /(Preise|Angebot)\s*(gueltig|gültig|freibleibend)/i,
        /Zahlungsbedingung|Zahlung/i,
        /Gewaehrleistung|Gewährleistung|Garantie/i,
        /Ausfuehrung|Ausführung\s*gem/i,
        /nach\s*(Aufwand|Absprache)/i,
        /vorbehaltlich/i,
        /exkl\.|inkl\.|ohne|mit/i,
        /^\s*\*+/,  // Fussnoten-Marker
        /^\s*\(\d+\)/  // Nummerierte Hinweise
    ]
};

// Kategorisierungsfunktion
function categorize(text) {
    if (!text || text.trim() === '') return 'leer';

    const trimmedText = text.trim();

    // Prüfe jede Kategorie
    for (const [category, patterns] of Object.entries(PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(trimmedText)) {
                return category;
            }
        }
    }

    return 'sonstiges';
}

// Extrahiere Masse aus Text
function extractDimensions(text) {
    if (!text) return null;

    const patterns = [
        // 1000x1200, 1000 x 1200, 1000X1200
        /(\d+)\s*[xX×]\s*(\d+)/g,
        // 1000mm x 1200mm
        /(\d+)\s*mm\s*[xX×]\s*(\d+)\s*mm/gi,
        // B: 1000 H: 1200
        /B[:\s]*(\d+).*H[:\s]*(\d+)/gi,
        // BxH: 1000x1200
        /BxH[:\s]*(\d+)\s*[xX×]\s*(\d+)/gi
    ];

    const dimensions = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            dimensions.push({
                width: parseInt(match[1]),
                height: parseInt(match[2]),
                raw: match[0]
            });
        }
    }

    return dimensions.length > 0 ? dimensions : null;
}

// Extrahiere System-Namen
function extractSystems(text) {
    if (!text) return null;

    const systemPatterns = [
        /(CASTELLO)/i,
        /(CALIDO)/i,
        /(IMPREO)/i,
        /(WERU)/i,
        /(Schüco|Schueco)/i,
        /(Rehau)/i,
        /(Kömmerling|Koemmerling)/i,
        /(Salamander)/i,
        /(Aluplast)/i,
        /(Veka)/i,
        /(Gealan)/i,
        /(Inoutic)/i
    ];

    const systems = [];
    for (const pattern of systemPatterns) {
        const match = text.match(pattern);
        if (match) {
            systems.push(match[1]);
        }
    }

    return systems.length > 0 ? systems : null;
}

async function main() {
    console.log('='.repeat(80));
    console.log('ANALYSE: Positionen mit PozNr = NULL');
    console.log('='.repeat(80));
    console.log('');

    // Prüfe Credentials
    if (!w4aConfig.user || !w4aConfig.password) {
        console.error('FEHLER: W4A_DB_USER und W4A_DB_PASSWORD nicht gesetzt!');
        console.log('Aktuell geladen:', {
            server: w4aConfig.server,
            database: w4aConfig.database,
            user: w4aConfig.user ? '***' : 'FEHLT',
            password: w4aConfig.password ? '***' : 'FEHLT'
        });
        process.exit(1);
    }

    console.log('Verbinde mit:', w4aConfig.server, '/', w4aConfig.database);

    try {
        // Verbindung herstellen
        const pool = await sql.connect(w4aConfig);
        console.log('Verbindung hergestellt.\n');

        // Query ausführen
        console.log('Lade Positionen mit PozNr IS NULL (max. 2000)...');
        const result = await pool.request().query(`
            SELECT TOP 2000
                p.Text,
                p.Anzahl,
                p.EinzPreis,
                p.GesPreis,
                a.AngebotNr,
                a.AngebotsDatum
            FROM dbo.Positionen p
            JOIN dbo.Angebot a ON p.BZObjMemberCode = a.Code
            WHERE p.PozNr IS NULL
              AND p.BZObjType = 6
              AND a.AngebotsDatum > '2023-01-01'
            ORDER BY a.AngebotsDatum DESC
        `);

        const rows = result.recordset;
        console.log(`Gefunden: ${rows.length} Positionen\n`);

        // Kategorisierung
        const categories = {
            raum: [],
            fenster: [],
            technisch: [],
            summe: [],
            hinweis: [],
            sonstiges: [],
            leer: []
        };

        let withDimensions = [];
        let withSystems = [];

        for (const row of rows) {
            const text = row.Text;
            const category = categorize(text);

            categories[category].push({
                text: text,
                anzahl: row.Anzahl,
                einzelpreis: row.EinzPreis,
                gesamtpreis: row.GesPreis,
                angebotNr: row.AngebotNr,
                datum: row.AngebotsDatum
            });

            // Prüfe auf Masse
            const dims = extractDimensions(text);
            if (dims) {
                withDimensions.push({ text, dimensions: dims, category });
            }

            // Prüfe auf System-Namen
            const systems = extractSystems(text);
            if (systems) {
                withSystems.push({ text, systems, category });
            }
        }

        // Ausgabe: Statistik
        console.log('='.repeat(80));
        console.log('STATISTIK');
        console.log('='.repeat(80));
        console.log('');
        console.log('Kategorie-Verteilung:');
        console.log('-'.repeat(50));

        const categoryNames = {
            raum: '1. Raumbezeichnungen',
            fenster: '2. Fensterbeschreibungen',
            technisch: '3. Technische Details',
            summe: '4. Summenzeilen',
            hinweis: '5. Hinweistexte',
            sonstiges: '6. Sonstiges',
            leer: '7. Leer/Null'
        };

        let total = 0;
        for (const [key, items] of Object.entries(categories)) {
            const count = items.length;
            total += count;
            const percent = ((count / rows.length) * 100).toFixed(1);
            console.log(`${categoryNames[key].padEnd(30)} ${String(count).padStart(5)} (${percent}%)`);
        }
        console.log('-'.repeat(50));
        console.log(`${'GESAMT'.padEnd(30)} ${String(total).padStart(5)}`);
        console.log('');

        // Ausgabe: Beispiele pro Kategorie
        for (const [key, items] of Object.entries(categories)) {
            if (items.length === 0) continue;

            console.log('');
            console.log('='.repeat(80));
            console.log(`${categoryNames[key]} - 20 Beispiele`);
            console.log('='.repeat(80));

            const examples = items.slice(0, 20);
            for (let i = 0; i < examples.length; i++) {
                const item = examples[i];
                const textPreview = item.text
                    ? item.text.substring(0, 100).replace(/\n/g, ' ').replace(/\r/g, '')
                    : '(leer)';
                console.log(`${(i + 1).toString().padStart(2)}. [${item.angebotNr}] ${textPreview}`);
            }
        }

        // Ausgabe: Positionen mit Massen
        console.log('');
        console.log('='.repeat(80));
        console.log('POSITIONEN MIT MASSEN (BxH in mm)');
        console.log('='.repeat(80));
        console.log(`Gefunden: ${withDimensions.length} Positionen mit Massangaben`);
        console.log('');

        if (withDimensions.length > 0) {
            console.log('Beispiele (max. 30):');
            console.log('-'.repeat(80));
            for (const item of withDimensions.slice(0, 30)) {
                const textPreview = item.text.substring(0, 60).replace(/\n/g, ' ');
                const dimStr = item.dimensions.map(d => `${d.width}x${d.height}`).join(', ');
                console.log(`[${item.category.padEnd(10)}] ${dimStr.padEnd(15)} "${textPreview}..."`);
            }

            // Kategorieverteilung der Masse
            console.log('');
            console.log('Verteilung der Massangaben nach Kategorie:');
            const dimsByCategory = {};
            for (const item of withDimensions) {
                dimsByCategory[item.category] = (dimsByCategory[item.category] || 0) + 1;
            }
            for (const [cat, count] of Object.entries(dimsByCategory)) {
                console.log(`  ${categoryNames[cat] || cat}: ${count}`);
            }
        }

        // Ausgabe: Positionen mit System-Namen
        console.log('');
        console.log('='.repeat(80));
        console.log('POSITIONEN MIT SYSTEM-NAMEN');
        console.log('='.repeat(80));
        console.log(`Gefunden: ${withSystems.length} Positionen mit System-Namen`);
        console.log('');

        if (withSystems.length > 0) {
            // System-Häufigkeit
            const systemCounts = {};
            for (const item of withSystems) {
                for (const sys of item.systems) {
                    const normalizedSys = sys.toUpperCase();
                    systemCounts[normalizedSys] = (systemCounts[normalizedSys] || 0) + 1;
                }
            }

            console.log('System-Haeufigkeit:');
            console.log('-'.repeat(40));
            const sortedSystems = Object.entries(systemCounts).sort((a, b) => b[1] - a[1]);
            for (const [sys, count] of sortedSystems) {
                console.log(`  ${sys.padEnd(20)} ${count}`);
            }

            console.log('');
            console.log('Beispiele (max. 20):');
            console.log('-'.repeat(80));
            for (const item of withSystems.slice(0, 20)) {
                const textPreview = item.text.substring(0, 60).replace(/\n/g, ' ');
                console.log(`[${item.category.padEnd(10)}] ${item.systems.join(', ').padEnd(15)} "${textPreview}..."`);
            }
        }

        // Spezialanalyse: Was ist in "sonstiges"?
        console.log('');
        console.log('='.repeat(80));
        console.log('ANALYSE: Was ist in "Sonstiges"?');
        console.log('='.repeat(80));

        const sonstigeTexte = categories.sonstiges.map(item => item.text).filter(t => t);
        const wordFreq = {};

        for (const text of sonstigeTexte) {
            const words = text.toLowerCase()
                .replace(/[^\w\säöü]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3);

            for (const word of words) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        }

        console.log('');
        console.log('Haeufigste Woerter in "Sonstiges" (Top 30):');
        console.log('-'.repeat(40));
        const sortedWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30);

        for (const [word, count] of sortedWords) {
            if (count >= 3) {
                console.log(`  ${word.padEnd(25)} ${count}`);
            }
        }

        // Schliesse Verbindung
        await pool.close();
        console.log('\nVerbindung geschlossen.');

    } catch (error) {
        console.error('FEHLER:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
