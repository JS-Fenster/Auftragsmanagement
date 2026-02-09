/**
 * Analyse: Positionen mit PozNr = NULL
 */
const sql = require('mssql');
require('dotenv').config();

const config = {
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
    raum: [
        /^(Erdgeschoss|EG|Obergeschoss|OG|Dachgeschoss|DG|Untergeschoss|UG|Keller)/i,
        /^(Zimmer|Raum|Kueche|Küche|Bad|WC|Schlafzimmer|Wohnzimmer|Kinderzimmer)/i,
        /^(Flur|Diele|Treppenhaus|Garage|Terrasse|Balkon|Wintergarten)/i,
        /^\d+\.\s*(OG|UG|DG|EG)/i,
        /(Geschoss|Stock|Etage)\s*[-:]/i,
        /^[A-Z][a-z]+(raum|zimmer)\s*[-:]/i,
        /^Bereich\s*[-:]/i
    ],
    fenster: [
        /\d+\s*[xX×]\s*\d+/,
        /\d+\s*mm/i,
        /\d+\s*cm/i,
        /BxH|HxB|Breite|Hoehe|Höhe/i,
        /(links|rechts)\s*(angeschlagen|Anschlag|oeffnend|öffnend)/i,
        /Anschlag\s*(links|rechts|L|R)/i,
        /DIN\s*(links|rechts|L|R)/i,
        /(Dreh|Kipp|Dreh-Kipp|DK|Fest|Fix)/i,
        /(2-fl|3-fl|1-fl|2-fluegel|3-flügel)/i,
        /Fluegel|Flügel/i,
        /(Verglasung|Glas|3-fach|2-fach|Isolier)/i,
        /(Ug|Uw)\s*[=:]\s*[\d,\.]+/i,
        /Sprosse/i,
        /Oberlicht|Unterlicht|Seitenteil/i
    ],
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
        /^\s*\*+/,
        /^\s*\(\d+\)/
    ]
};

function categorize(text) {
    if (!text || text.trim() === '') return 'leer';
    const trimmedText = text.trim();
    for (const [category, patterns] of Object.entries(PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(trimmedText)) {
                return category;
            }
        }
    }
    return 'sonstiges';
}

function extractDimensions(text) {
    if (!text) return null;
    const matches = text.match(/(\d+)\s*[xX×]\s*(\d+)/g);
    return matches;
}

function extractSystems(text) {
    if (!text) return null;
    const systemPatterns = [
        /(CASTELLO)/i, /(CALIDO)/i, /(IMPREO)/i, /(WERU)/i,
        /(Schüco|Schueco)/i, /(Rehau)/i, /(Kömmerling)/i, /(Salamander)/i
    ];
    const systems = [];
    for (const pattern of systemPatterns) {
        const match = text.match(pattern);
        if (match) systems.push(match[1].toUpperCase());
    }
    return systems.length > 0 ? systems : null;
}

async function main() {
    console.log('Verbinde mit:', config.server);
    const pool = await sql.connect(config);
    console.log('Verbunden. Lade Daten...');

    const result = await pool.request().query(`
        SELECT TOP 2000
            CAST(p.Bezeichnung AS NVARCHAR(MAX)) AS Text,
            p.Anzahl,
            p.EinzPreis,
            p.GesPreis,
            a.Nummer AS AngebotNr,
            a.Datum
        FROM dbo.Positionen p
        JOIN dbo.Angebot a ON p.BZObjMemberCode = a.Code
        WHERE p.PozNr IS NULL
          AND p.BZObjType = 6
          AND a.Datum > '2023-01-01'
        ORDER BY a.Datum DESC
    `);

    const rows = result.recordset;
    console.log('Gefunden:', rows.length, 'Positionen\n');

    // Kategorisierung
    const categories = { raum: [], fenster: [], technisch: [], summe: [], hinweis: [], sonstiges: [], leer: [] };
    let withDimensions = [];
    let withSystems = [];

    for (const row of rows) {
        const text = row.Text;
        const category = categorize(text);
        categories[category].push({ text, angebotNr: row.AngebotNr });

        const dims = extractDimensions(text);
        if (dims) withDimensions.push({ text, dimensions: dims, category });

        const systems = extractSystems(text);
        if (systems) withSystems.push({ text, systems, category });
    }

    // Ausgabe
    console.log('='.repeat(80));
    console.log('STATISTIK - Kategorie-Verteilung');
    console.log('='.repeat(80));

    const categoryNames = {
        raum: '1. Raumbezeichnungen',
        fenster: '2. Fensterbeschreibungen',
        technisch: '3. Technische Details',
        summe: '4. Summenzeilen',
        hinweis: '5. Hinweistexte',
        sonstiges: '6. Sonstiges',
        leer: '7. Leer/Null'
    };

    for (const [key, items] of Object.entries(categories)) {
        const count = items.length;
        const percent = ((count / rows.length) * 100).toFixed(1);
        console.log(categoryNames[key].padEnd(30) + String(count).padStart(5) + ' (' + percent + '%)');
    }

    // 20 Beispiele pro Kategorie
    for (const [key, items] of Object.entries(categories)) {
        if (items.length === 0) continue;
        console.log('\n' + '='.repeat(80));
        console.log(categoryNames[key] + ' - 20 Beispiele');
        console.log('='.repeat(80));
        const examples = items.slice(0, 20);
        for (let i = 0; i < examples.length; i++) {
            const item = examples[i];
            const textPreview = item.text ? item.text.substring(0, 90).replace(/\n/g, ' ').replace(/\r/g, '') : '(leer)';
            console.log((i + 1).toString().padStart(2) + '. [' + item.angebotNr + '] ' + textPreview);
        }
    }

    // Masse-Analyse
    console.log('\n' + '='.repeat(80));
    console.log('POSITIONEN MIT MASSEN (BxH)');
    console.log('='.repeat(80));
    console.log('Gefunden: ' + withDimensions.length + ' Positionen mit Massangaben');

    const dimsByCategory = {};
    for (const item of withDimensions) {
        dimsByCategory[item.category] = (dimsByCategory[item.category] || 0) + 1;
    }
    console.log('\nVerteilung nach Kategorie:');
    for (const [cat, count] of Object.entries(dimsByCategory)) {
        console.log('  ' + (categoryNames[cat] || cat) + ': ' + count);
    }

    console.log('\nBeispiele (max. 25):');
    for (const item of withDimensions.slice(0, 25)) {
        const textPreview = item.text.substring(0, 60).replace(/\n/g, ' ');
        console.log('[' + item.category.padEnd(10) + '] ' + item.dimensions.join(', ').padEnd(15) + ' "' + textPreview + '..."');
    }

    // System-Analyse
    console.log('\n' + '='.repeat(80));
    console.log('POSITIONEN MIT SYSTEM-NAMEN');
    console.log('='.repeat(80));
    console.log('Gefunden: ' + withSystems.length + ' Positionen mit System-Namen');

    const systemCounts = {};
    for (const item of withSystems) {
        for (const sys of item.systems) {
            systemCounts[sys] = (systemCounts[sys] || 0) + 1;
        }
    }
    console.log('\nSystem-Haeufigkeit:');
    const sortedSystems = Object.entries(systemCounts).sort((a, b) => b[1] - a[1]);
    for (const [sys, count] of sortedSystems) {
        console.log('  ' + sys.padEnd(20) + count);
    }

    console.log('\nBeispiele (max. 20):');
    for (const item of withSystems.slice(0, 20)) {
        const textPreview = item.text.substring(0, 55).replace(/\n/g, ' ');
        console.log('[' + item.category.padEnd(10) + '] ' + item.systems.join(', ').padEnd(12) + ' "' + textPreview + '..."');
    }

    // Sonstiges analysieren
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSE: Was ist in "Sonstiges"?');
    console.log('='.repeat(80));

    const sonstigeTexte = categories.sonstiges.map(item => item.text).filter(t => t);
    const wordFreq = {};
    for (const text of sonstigeTexte) {
        const words = text.toLowerCase().replace(/[^\wäöü]/g, ' ').split(/\s+/).filter(w => w.length > 3);
        for (const word of words) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    }

    console.log('\nHaeufigste Woerter (Top 40):');
    const sortedWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 40);
    for (const [word, count] of sortedWords) {
        if (count >= 3) console.log('  ' + word.padEnd(25) + count);
    }

    await pool.close();
    console.log('\nAnalyse abgeschlossen.');
}

main().catch(err => { console.error('FEHLER:', err.message); process.exit(1); });
