/**
 * LEISTUNGSVERZEICHNIS AUFBAUEN
 * =============================
 *
 * Analysiert synchronisierte Rechnungs- und Angebotspositionen
 * und baut daraus ein Leistungsverzeichnis mit Durchschnittspreisen auf.
 *
 * Liest aus: erp_rechnungs_positionen, erp_angebots_positionen
 * Schreibt nach: leistungsverzeichnis
 *
 * Verwendung:
 *   node build-leistungsverzeichnis.js           # Aufbauen/Aktualisieren
 *   node build-leistungsverzeichnis.js --dry-run  # Nur anzeigen
 *
 * Erstellt: 2026-02-05
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('FEHLER: SUPABASE_URL und SUPABASE_SERVICE_KEY muessen in .env gesetzt sein');
    process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// =============================================================================
// SUPABASE HELPER
// =============================================================================

async function supabaseRequest(endpoint, method = 'GET', body = null, headers = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=representation',
            ...headers
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase ${method} ${endpoint}: ${response.status} - ${errorText}`);
    }

    if (response.status === 204 || (method === 'POST' && !headers['Prefer']?.includes('return=representation'))) {
        return null;
    }

    return await response.json();
}

// =============================================================================
// KATEGORISIERUNG
// =============================================================================

const KATEGORIE_PATTERNS = [
    { kategorie: 'haustuer', patterns: [/haustuer|haustür|HT\b/i] },
    { kategorie: 'hst', patterns: [/HST|hebeschiebe/i] },
    { kategorie: 'psk', patterns: [/PSK|parallel.*schiebe/i] },
    { kategorie: 'festfeld', patterns: [/festfeld|festverglasu|FIX/i] },
    { kategorie: 'balkontuer', patterns: [/balkontuer|balkontür|BT\b/i] },
    { kategorie: 'tuer', patterns: [/tuer|tür|nebeneingangstür/i] },
    { kategorie: 'fenster', patterns: [/fenster|DKF|DK\/K|dreh.*kipp/i] },
    { kategorie: 'rollladen', patterns: [/rollladen|rollo|RL\b/i] },
    { kategorie: 'raffstore', patterns: [/raffstore|raff/i] },
    { kategorie: 'insektenschutz', patterns: [/insektenschutz|insekt|fliegengitter/i] },
    { kategorie: 'fensterbank', patterns: [/fensterbank|AFB|IFB/i] },
    { kategorie: 'montage', patterns: [/montage|einbau|demontage|ausbau/i] },
    { kategorie: 'entsorgung', patterns: [/entsorgung|abtransport/i] },
];

function kategorisiere(bezeichnung, langtext = '') {
    const text = `${bezeichnung || ''} ${langtext || ''}`;
    for (const { kategorie, patterns } of KATEGORIE_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(text)) return kategorie;
        }
    }
    return 'sonstiges';
}

// =============================================================================
// DIMENSIONEN EXTRAHIEREN
// =============================================================================

function extractDimensions(text) {
    if (!text) return null;

    // Pattern: 1230x1480 oder 1230 x 1480
    const mmMatch = text.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})/);
    if (mmMatch) {
        return { breite: parseInt(mmMatch[1]), hoehe: parseInt(mmMatch[2]) };
    }

    // Pattern: Breite: 1230 mm, Hoehe: 1480 mm
    const explicitMatch = text.match(/[Bb](?:reite)?[:\s]*(\d+)\s*(?:mm)?.*[Hh](?:oehe|öhe)?[:\s]*(\d+)/);
    if (explicitMatch) {
        return { breite: parseInt(explicitMatch[1]), hoehe: parseInt(explicitMatch[2]) };
    }

    return null;
}

// =============================================================================
// HAUPTLOGIK
// =============================================================================

async function main() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  LEISTUNGSVERZEICHNIS AUFBAUEN`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Dry-Run: ${DRY_RUN ? 'Ja' : 'Nein'}`);
    console.log(`${'='.repeat(70)}\n`);

    // 1. Rechnungspositionen laden
    console.log('[1/4] Lade Rechnungspositionen...');
    let rechnungsPos = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const batch = await supabaseRequest(
            `erp_rechnungs_positionen?select=bezeichnung,langtext,anzahl,einz_preis,ges_preis&offset=${offset}&limit=${pageSize}`,
            'GET', null, { 'Prefer': 'return=representation' }
        );
        if (!batch || batch.length === 0) break;
        rechnungsPos = rechnungsPos.concat(batch);
        offset += pageSize;
        if (batch.length < pageSize) break;
    }
    console.log(`      ${rechnungsPos.length} Rechnungspositionen geladen`);

    // 2. Angebotspositionen laden
    console.log('[2/4] Lade Angebotspositionen...');
    let angebotsPos = [];
    offset = 0;

    while (true) {
        const batch = await supabaseRequest(
            `erp_angebots_positionen?select=bezeichnung,langtext,anzahl,einz_preis,ges_preis&offset=${offset}&limit=${pageSize}`,
            'GET', null, { 'Prefer': 'return=representation' }
        );
        if (!batch || batch.length === 0) break;
        angebotsPos = angebotsPos.concat(batch);
        offset += pageSize;
        if (batch.length < pageSize) break;
    }
    console.log(`      ${angebotsPos.length} Angebotspositionen geladen`);

    // 3. Alle Positionen kategorisieren und aggregieren
    console.log('[3/4] Kategorisiere und aggregiere...');

    const allPositions = [...rechnungsPos, ...angebotsPos];
    const catalog = new Map(); // key: "kategorie::bezeichnung_normalized" -> aggregated data

    for (const pos of allPositions) {
        if (!pos.bezeichnung) continue;

        // Header-Positionen (ohne Punkt in PosNr) ueberspringen
        const preis = parseFloat(pos.einz_preis) || 0;
        if (preis <= 0) continue;

        const kategorie = kategorisiere(pos.bezeichnung, pos.langtext);
        const bezeichnung = normalizeBezeichnung(pos.bezeichnung);
        const dims = extractDimensions(`${pos.bezeichnung} ${pos.langtext || ''}`);

        const key = `${kategorie}::${bezeichnung}`;

        if (!catalog.has(key)) {
            catalog.set(key, {
                kategorie,
                bezeichnung: pos.bezeichnung.trim().substring(0, 200),
                preise: [],
                dimensions: [],
                meta: {}
            });
        }

        const entry = catalog.get(key);
        entry.preise.push(preis);

        if (dims) {
            entry.dimensions.push(dims);
        }
    }

    console.log(`      ${catalog.size} eindeutige Leistungen identifiziert`);

    // 4. Leistungsverzeichnis-Eintraege erstellen
    console.log('[4/4] Erstelle Leistungsverzeichnis...');

    const lvEntries = [];

    for (const [key, entry] of catalog) {
        if (entry.preise.length === 0) continue;

        const sortedPreise = entry.preise.sort((a, b) => a - b);
        const avg = sortedPreise.reduce((s, p) => s + p, 0) / sortedPreise.length;
        const min = sortedPreise[0];
        const max = sortedPreise[sortedPreise.length - 1];

        // Median berechnen
        const mid = Math.floor(sortedPreise.length / 2);
        const median = sortedPreise.length % 2 !== 0
            ? sortedPreise[mid]
            : (sortedPreise[mid - 1] + sortedPreise[mid]) / 2;

        // Durchschnitts-Dimensionen
        let avgDims = null;
        if (entry.dimensions.length > 0) {
            const avgB = Math.round(entry.dimensions.reduce((s, d) => s + d.breite, 0) / entry.dimensions.length);
            const avgH = Math.round(entry.dimensions.reduce((s, d) => s + d.hoehe, 0) / entry.dimensions.length);
            avgDims = { breite_mm: avgB, hoehe_mm: avgH };
        }

        // Einheit ableiten
        let einheit = 'Stk';
        if (entry.kategorie === 'montage' || entry.kategorie === 'entsorgung') {
            einheit = 'Psch';
        } else if (entry.kategorie === 'fensterbank') {
            einheit = 'lfm';
        }

        lvEntries.push({
            kategorie: entry.kategorie,
            bezeichnung: entry.bezeichnung,
            beschreibung: null,
            einheit,
            avg_preis: round2(avg),
            min_preis: round2(min),
            max_preis: round2(max),
            sample_count: entry.preise.length,
            letzte_aktualisierung: new Date().toISOString(),
            meta: {
                median_preis: round2(median),
                avg_dimensionen: avgDims,
                quelle: 'auto-sync'
            }
        });
    }

    console.log(`      ${lvEntries.length} Eintraege vorbereitet`);

    if (DRY_RUN) {
        console.log('\n  [DRY RUN] Top 20 Eintraege:');
        const top = lvEntries.sort((a, b) => b.sample_count - a.sample_count).slice(0, 20);
        for (const e of top) {
            console.log(`    ${e.kategorie.padEnd(15)} ${e.bezeichnung.substring(0, 40).padEnd(42)} Ø${String(e.avg_preis).padStart(8)}€  (${e.sample_count}x)`);
        }
    } else {
        // In Batches nach Supabase schreiben
        const batchSize = 100;
        let written = 0;

        for (let i = 0; i < lvEntries.length; i += batchSize) {
            const batch = lvEntries.slice(i, i + batchSize);
            try {
                await supabaseRequest('leistungsverzeichnis?on_conflict=kategorie,bezeichnung', 'POST', batch, {
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                });
                written += batch.length;
                process.stdout.write(`\r      ${written}/${lvEntries.length} geschrieben`);
            } catch (error) {
                console.error(`\n      FEHLER bei Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
            }
        }
        console.log('');
    }

    // Zusammenfassung
    const kategorien = {};
    for (const e of lvEntries) {
        kategorien[e.kategorie] = (kategorien[e.kategorie] || 0) + 1;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ZUSAMMENFASSUNG`);
    console.log(`${'='.repeat(70)}`);
    console.log(`  Positionen analysiert:  ${allPositions.length}`);
    console.log(`  LV-Eintraege erstellt:  ${lvEntries.length}`);
    console.log(`  Kategorien:`);
    for (const [kat, count] of Object.entries(kategorien).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${kat.padEnd(20)} ${count}`);
    }
    console.log(`${'='.repeat(70)}\n`);
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

function normalizeBezeichnung(bez) {
    if (!bez) return '';
    return bez.trim()
        .replace(/\s+/g, ' ')
        .replace(/\d{3,4}\s*[xX×*]\s*\d{3,4}/g, '') // Masse entfernen
        .replace(/\d+\s*mm/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100)
        .toLowerCase();
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
});
