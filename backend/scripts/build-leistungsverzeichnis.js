/**
 * LEISTUNGSVERZEICHNIS AUFBAUEN (V2 - Granular)
 * ==============================================
 *
 * Analysiert synchronisierte Rechnungs- und Angebotspositionen
 * und baut daraus ein Leistungsverzeichnis mit Durchschnittspreisen auf.
 *
 * V2: Erweitert um granulare Felder (Oeffnungsart, Fluegel, Masse,
 *     Groessenklasse, Uw-Wert, Verglasung, Rollladen, Hersteller, System)
 *
 * Liest aus: erp_rechnungs_positionen, erp_angebots_positionen
 * Schreibt nach: leistungsverzeichnis
 *
 * Verwendung:
 *   node build-leistungsverzeichnis.js           # Aufbauen/Aktualisieren
 *   node build-leistungsverzeichnis.js --dry-run  # Nur anzeigen
 *
 * Erstellt: 2026-02-05
 * Erweitert: 2026-02-09 (P004 - Granulare Felder)
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

    // Erst: Standard-Pattern-Match
    let kategorie = 'sonstiges';
    for (const { kategorie: k, patterns } of KATEGORIE_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                kategorie = k;
                break;
            }
        }
        if (kategorie !== 'sonstiges') break;
    }

    // Korrektur: Stulp-Fenster von Haustuer unterscheiden
    // Wenn als "haustuer" kategorisiert, aber Masse vorhanden und Hoehe < 2200mm
    // UND Oeffnungsart (DLS/Stulp/DKR/DKL) erkannt → ist Fenster, nicht Haustuer
    if (kategorie === 'haustuer') {
        const dims = extractDimensions(text);
        const hasAnschlag = /Anschlag:/i.test(text);
        if (dims && dims.hoehe < 2200 && hasAnschlag) {
            kategorie = 'fenster';
        }
    }

    return kategorie;
}

// =============================================================================
// DIMENSIONEN EXTRAHIEREN
// =============================================================================

function extractDimensions(text) {
    if (!text) return null;

    // Pattern 1: "Breite: 1230 mm, Hoehe: 1480 mm" (W4A Standard - 91% der Faelle, L22)
    const explicitMatch = text.match(/[Bb]reite[:\s]*(\d+)\s*mm[\s,]*[Hh](?:öhe|oehe)[:\s]*(\d+)\s*mm/);
    if (explicitMatch) {
        return { breite: parseInt(explicitMatch[1]), hoehe: parseInt(explicitMatch[2]) };
    }

    // Pattern 2: 1230x1480 oder 1230 x 1480 (mm)
    const mmMatch = text.match(/(\d{3,4})\s*[xX\u00d7*]\s*(\d{3,4})/);
    if (mmMatch) {
        return { breite: parseInt(mmMatch[1]), hoehe: parseInt(mmMatch[2]) };
    }

    // Pattern 3: B=1230 H=1480
    const bhMatch = text.match(/B[=:\s]*(\d+).*H[=:\s]*(\d+)/);
    if (bhMatch) {
        return { breite: parseInt(bhMatch[1]), hoehe: parseInt(bhMatch[2]) };
    }

    return null;
}

// =============================================================================
// NEUE EXTRAKTOR-FUNKTIONEN (P004)
// =============================================================================

/**
 * Extrahiert die Oeffnungsart aus dem Positionstext.
 * Patterns basieren auf echten W4A-Daten:
 * - "Anschlag: DKR Dreh-Kipp rechts" -> "DKR"
 * - "Anschlag: DKL Dreh-Kipp links" -> "DKL"
 * - "Anschlag: DLS Dreh links, Stulpfluegel" -> "Stulp"
 * - "Stulpvariante" -> "Stulp"
 * - "Anschlag: F Festverglasung" -> "FIX"
 * - "HSR Hebeschiebe" -> "HST"
 * - "PSK" oder "Parallel" -> "PSK"
 * - "Dreh rechts" (ohne Kipp) -> "D"
 * - "Kipp" (ohne Dreh) -> "K"
 */
function extractOeffnungsart(text) {
    if (!text) return null;

    // HST / Hebeschiebe (vor Dreh-Kipp, da HSR/HSF auch "Dreh" enthalten koennte)
    if (/\bHST\b|HSR\b|HSF\b|[Hh]ebeschiebe/i.test(text)) return 'HST';

    // PSK / Parallel-Schiebe-Kipp
    if (/\bPSK\b|[Pp]arallel.*[Ss]chiebe/i.test(text)) return 'PSK';

    // Stulp (DLS = Dreh links, Stulpfluegel)
    if (/\bDLS\b|[Ss]tulp(?:variante|fl)/i.test(text)) return 'Stulp';

    // DKR / Dreh-Kipp rechts
    if (/\bDKR\b|[Dd]reh[- ]*[Kk]ipp\s+rechts/i.test(text)) return 'DKR';

    // DKL / Dreh-Kipp links
    if (/\bDKL\b|[Dd]reh[- ]*[Kk]ipp\s+links/i.test(text)) return 'DKL';

    // DK generisch (Dreh-Kipp ohne Richtung)
    if (/\bDK\b|[Dd]reh[- ]*[Kk]ipp/i.test(text)) return 'DK';

    // FIX / Festverglasung
    if (/\bFIX\b|\bF\s+Festverglasung\b|[Ff]estfeld|[Ff]estverglasu/i.test(text)) return 'FIX';

    // D = Dreh (ohne Kipp) - z.B. "DR Dreh rechts", "DL Dreh links"
    if (/\bDR\s+Dreh\b|\bDL\s+Dreh\b|Anschlag:.*\bDreh\b(?!.*[Kk]ipp)/i.test(text)) return 'D';

    // K = Kipp (ohne Dreh)
    if (/\bK\s+Kipp\b|Anschlag:.*\bKipp\b(?!.*[Dd]reh)/i.test(text)) return 'K';

    return null;
}

/**
 * Leitet die Anzahl Fluegel aus der Oeffnungsart ab.
 * L27: Anzahl Fluegel (1/2/3) ist KRITISCH fuer Preismodell
 */
function deriveAnzahlFluegel(oeffnungsart) {
    if (!oeffnungsart) return null;

    const mapping = {
        'DK': 1, 'DKR': 1, 'DKL': 1, 'D': 1, 'K': 1, 'FIX': 1,
        'Stulp': 2,
        'HST': 2,
        'PSK': 2
    };

    return mapping[oeffnungsart] || null;
}

/**
 * Extrahiert den Uw-Wert aus dem Positionstext.
 * Pattern: "Uw,N: 0,92 W/(m2K)" oder "Uw,N: 1.01W/(m2K)"
 */
function extractUwWert(text) {
    if (!text) return null;

    // Pattern: Uw,N: 0,92 W/(m2K) oder Uw,N: 1.01W/(m2K)
    const match = text.match(/Uw[,.]N[:\s]*(\d+[,.]?\d*)\s*W/i);
    if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(value) && value > 0 && value < 5) {
            return value;
        }
    }

    // Fallback: Ug-Wert aus Header (z.B. "Ug-Wert 1,1 W/m2K")
    const ugMatch = text.match(/Ug[- ]?Wert[:\s]*(\d+[,.]?\d*)\s*W/i);
    if (ugMatch) {
        const value = parseFloat(ugMatch[1].replace(',', '.'));
        if (!isNaN(value) && value > 0 && value < 5) {
            return value;
        }
    }

    return null;
}

/**
 * Leitet die Verglasung aus dem Uw-Wert ab.
 * Uw <= 1.0 -> "3-fach" (typisch 0.7-0.95)
 * Uw > 1.0 -> "2-fach" (typisch 1.1-1.3)
 */
function deriveVerglasung(uw) {
    if (uw === null || uw === undefined) return null;
    return uw <= 1.0 ? '3-fach' : '2-fach';
}

/**
 * Erkennt ob die Position einen Rollladen hat.
 * Sucht nach "Rollladenfuehrungsschiene" oder "Rollladen" im Text,
 * aber NICHT wenn die Position selbst in der Kategorie "rollladen" ist.
 */
function detectRollladen(text, kategorie) {
    if (!text || kategorie === 'rollladen') return false;
    return /[Rr]ollladenf[uü]hrungsschiene|[Rr]ollladen(?!.*[Kk]asten)/i.test(text);
}

/**
 * Leitet die Groessenklasse aus der Flaeche in qm ab.
 * XS: < 0.3 qm, S: 0.3-0.7 qm, M: 0.7-1.3 qm,
 * L1: 1.3-1.8 qm, L2: 1.8-2.5 qm, XL: > 2.5 qm
 * (P006: L aufgesplittet in L1 + L2 fuer bessere Preisgenauigkeit)
 */
function deriveGroessenKlasse(qm) {
    if (qm === null || qm === undefined) return null;
    if (qm < 0.3) return 'XS';
    if (qm < 0.7) return 'S';
    if (qm < 1.3) return 'M';
    if (qm < 1.8) return 'L1';
    if (qm < 2.5) return 'L2';
    return 'XL';
}

/**
 * Extrahiert den Hersteller aus dem Positionstext.
 * Sucht nach bekannten Herstellernamen.
 */
function extractHersteller(text) {
    if (!text) return null;

    // Case-insensitive Suche nach Herstellern
    const herstellerPatterns = [
        { name: 'WERU', pattern: /\bWERU\b|\bWeru\b/i },
        { name: 'Drutex', pattern: /\bDrutex\b/i },
        { name: 'KOMPOtherm', pattern: /\bKOMPOtherm\b|\bKompo\s*therm\b/i },
        { name: 'Roto', pattern: /\bRoto\b/i },
        { name: 'Internorm', pattern: /\bInternorm\b/i },
        { name: 'Schüco', pattern: /\bSch[uü]co\b/i },
        { name: 'Rehau', pattern: /\bRehau\b/i },
        { name: 'Salamander', pattern: /\bSalamander\b/i },
        { name: 'Veka', pattern: /\bVeka\b/i },
        { name: 'Aluplast', pattern: /\bAluplast\b/i },
        { name: 'Heroal', pattern: /\bHeroal\b/i },
    ];

    for (const { name, pattern } of herstellerPatterns) {
        if (pattern.test(text)) return name;
    }

    return null;
}

/**
 * Extrahiert das Fenstersystem aus dem Positionstext.
 * Sucht nach bekannten Systemnamen.
 */
function extractSystem(text) {
    if (!text) return null;

    const systemPatterns = [
        { name: 'CALIDO', pattern: /\bCALIDO\b|\bCalido\b/i },
        { name: 'CASTELLO', pattern: /\bCASTELLO\b|\bCastello\b/i },
        { name: 'IMPREO', pattern: /\bIMPREO\b|\bImpreo\b/i },
        { name: 'ALEGRA', pattern: /\bALEGRA\b|\bAlegra\b/i },
        { name: 'Iglo 5', pattern: /\bIglo\s*5\b/i },
        { name: 'Iglo Energy', pattern: /\bIglo\s*Energy\b/i },
        { name: 'Iglo Light', pattern: /\bIglo\s*Light\b/i },
        { name: 'Softline', pattern: /\bSoftline\b/i },
        { name: 'Bluevolution', pattern: /\bBluevolution\b/i },
    ];

    for (const { name, pattern } of systemPatterns) {
        if (pattern.test(text)) return name;
    }

    return null;
}

// =============================================================================
// NEUE ERKENNUNGS-FUNKTIONEN (P006)
// =============================================================================

/**
 * Erkennt Kombielemente (mehrere Felder in einem Rahmen).
 * z.B. "Anschlag: F Festverglasung/DKR Dreh-Kipp rechts" = 2-Feld-Kombi
 * z.B. "Breitenteilungen: 1" oder "Breitenteilungen: 2" = Kombi
 */
function detectKombiElement(text) {
    if (!text) return { istKombi: false, felder: 1 };

    // Pattern 1: Mehrere Oeffnungsarten mit "/" getrennt im Anschlag
    const anschlagMatch = text.match(/Anschlag:\s*(.+)/i);
    if (anschlagMatch) {
        const anschlag = anschlagMatch[1];
        const teile = anschlag.split('/').filter(t => t.trim().length > 0);
        if (teile.length > 1) {
            return { istKombi: true, felder: teile.length };
        }
    }

    // Pattern 2: "Breitenteilungen: N" (N > 0 = Kombi)
    const teilungMatch = text.match(/Breitenteilungen:\s*(\d+)/i);
    if (teilungMatch && parseInt(teilungMatch[1]) > 0) {
        return { istKombi: true, felder: parseInt(teilungMatch[1]) + 1 };
    }

    return { istKombi: false, felder: 1 };
}

/**
 * Erkennt Lagerware/Abverkaufsartikel.
 * Diese haben atypisch niedrige Preise und verzerren Durchschnitte.
 */
function detectLagerware(text) {
    if (!text) return false;
    return /\bLager\b|\bAbverkauf\b|\bSonderposten\b|\bMusterst[uü]ck\b|\bAusstellungsst[uü]ck/i.test(text);
}

// =============================================================================
// HAUPTLOGIK
// =============================================================================

async function main() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  LEISTUNGSVERZEICHNIS AUFBAUEN (V2 - Granular)`);
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

    // Statistik-Zaehler fuer granulare Felder
    const stats = {
        oeffnungsart_found: 0,
        dims_found: 0,
        uw_found: 0,
        rollladen_found: 0,
        hersteller_found: 0,
        system_found: 0,
        kombi_found: 0,
        lagerware_found: 0,
        lagerware_excluded: 0,
        total_processed: 0
    };

    for (const pos of allPositions) {
        if (!pos.bezeichnung) continue;

        // Header-Positionen (ohne Punkt in PosNr) ueberspringen
        const preis = parseFloat(pos.einz_preis) || 0;
        if (preis <= 0) continue;

        stats.total_processed++;

        const fullText = `${pos.bezeichnung} ${pos.langtext || ''}`;
        const kategorie = kategorisiere(pos.bezeichnung, pos.langtext);
        const bezeichnung = normalizeBezeichnung(pos.bezeichnung);
        const dims = extractDimensions(fullText);

        // Neue granulare Extraktionen
        const oeffnungsart = extractOeffnungsart(fullText);
        const uwWert = extractUwWert(fullText);
        const hersteller = extractHersteller(fullText);
        const systemName = extractSystem(fullText);
        const hatRollladen = detectRollladen(fullText, kategorie);

        // P006: Kombi-Erkennung
        const kombiInfo = detectKombiElement(fullText);

        // P006: Lagerware-Erkennung
        const istLagerware = detectLagerware(fullText);

        // Statistik
        if (oeffnungsart) stats.oeffnungsart_found++;
        if (dims) stats.dims_found++;
        if (uwWert !== null) stats.uw_found++;
        if (hatRollladen) stats.rollladen_found++;
        if (hersteller) stats.hersteller_found++;
        if (systemName) stats.system_found++;
        if (kombiInfo.istKombi) stats.kombi_found++;
        if (istLagerware) stats.lagerware_found++;

        const key = `${kategorie}::${bezeichnung}`;

        if (!catalog.has(key)) {
            catalog.set(key, {
                kategorie,
                bezeichnung: pos.bezeichnung.trim().substring(0, 200),
                preise: [],
                dimensions: [],
                oeffnungsarten: [],
                uwWerte: [],
                rollladenFlags: [],
                hersteller: [],
                systeme: [],
                kombiFlags: [],
                kombiFelder: [],
                lagerwaren_count: 0,
                meta: {}
            });
        }

        const entry = catalog.get(key);

        // P006: Lagerware-Positionen aus Preisaggregation ausschliessen
        if (istLagerware) {
            entry.lagerwaren_count++;
            stats.lagerware_excluded++;
            // Preis NICHT aggregieren, aber alles andere schon (fuer Transparenz)
        } else {
            entry.preise.push(preis);
        }

        if (dims) entry.dimensions.push(dims);
        if (oeffnungsart) entry.oeffnungsarten.push(oeffnungsart);
        if (uwWert !== null) entry.uwWerte.push(uwWert);
        entry.rollladenFlags.push(hatRollladen);
        if (hersteller) entry.hersteller.push(hersteller);
        if (systemName) entry.systeme.push(systemName);
        entry.kombiFlags.push(kombiInfo.istKombi);
        entry.kombiFelder.push(kombiInfo.felder);
    }

    console.log(`      ${catalog.size} eindeutige Leistungen identifiziert`);
    console.log(`      Granulare Extraktion:`);
    console.log(`        Oeffnungsart: ${stats.oeffnungsart_found}/${stats.total_processed} (${pct(stats.oeffnungsart_found, stats.total_processed)})`);
    console.log(`        Dimensionen:  ${stats.dims_found}/${stats.total_processed} (${pct(stats.dims_found, stats.total_processed)})`);
    console.log(`        Uw-Wert:      ${stats.uw_found}/${stats.total_processed} (${pct(stats.uw_found, stats.total_processed)})`);
    console.log(`        Rollladen:    ${stats.rollladen_found}/${stats.total_processed} (${pct(stats.rollladen_found, stats.total_processed)})`);
    console.log(`        Hersteller:   ${stats.hersteller_found}/${stats.total_processed} (${pct(stats.hersteller_found, stats.total_processed)})`);
    console.log(`        System:       ${stats.system_found}/${stats.total_processed} (${pct(stats.system_found, stats.total_processed)})`);
    console.log(`        Kombi:        ${stats.kombi_found}/${stats.total_processed} (${pct(stats.kombi_found, stats.total_processed)})`);
    console.log(`        Lagerware:    ${stats.lagerware_found}/${stats.total_processed} (${pct(stats.lagerware_found, stats.total_processed)}) - ${stats.lagerware_excluded} aus Preisen ausgeschlossen`);

    // 4. Leistungsverzeichnis-Eintraege erstellen
    console.log('\n[4/4] Erstelle Leistungsverzeichnis...');

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
        let avgBreite = null;
        let avgHoehe = null;
        let avgFlaeche = null;
        if (entry.dimensions.length > 0) {
            avgBreite = Math.round(entry.dimensions.reduce((s, d) => s + d.breite, 0) / entry.dimensions.length);
            avgHoehe = Math.round(entry.dimensions.reduce((s, d) => s + d.hoehe, 0) / entry.dimensions.length);
            avgFlaeche = round3(avgBreite * avgHoehe / 1000000);
        }

        // Haeufigste Oeffnungsart (Modus)
        const dominantOeffnungsart = getModus(entry.oeffnungsarten);

        // P006: Kombi-Erkennung - Mehrheit bestimmt ob Kombi
        const kombiTrueCount = entry.kombiFlags.filter(Boolean).length;
        const kombiMajority = kombiTrueCount > entry.kombiFlags.length / 2;

        // P006: Bei Kombi → anzahl_fluegel = Modus der felder, sonst aus Oeffnungsart
        let anzahlFluegel;
        if (kombiMajority) {
            const kombiFelder = entry.kombiFelder.filter(f => f > 1);
            anzahlFluegel = kombiFelder.length > 0
                ? parseInt(getModus(kombiFelder.map(String)))
                : deriveAnzahlFluegel(dominantOeffnungsart);
        } else {
            anzahlFluegel = deriveAnzahlFluegel(dominantOeffnungsart);
        }

        // Groessenklasse
        const groessenKlasse = avgFlaeche !== null ? deriveGroessenKlasse(avgFlaeche) : null;

        // Durchschnittlicher Uw-Wert
        const avgUw = entry.uwWerte.length > 0
            ? round2(entry.uwWerte.reduce((s, v) => s + v, 0) / entry.uwWerte.length)
            : null;
        const verglasung = deriveVerglasung(avgUw);

        // Rollladen: true wenn Mehrheit der Positionen Rollladen hat
        const rollladenCount = entry.rollladenFlags.filter(Boolean).length;
        const hatRollladen = rollladenCount > entry.rollladenFlags.length / 2;

        // Haeufigster Hersteller und System
        const dominantHersteller = getModus(entry.hersteller);
        const dominantSystem = getModus(entry.systeme);

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
            // Neue granulare Felder
            oeffnungsart: dominantOeffnungsart,
            anzahl_fluegel: anzahlFluegel,
            breite_mm: avgBreite,
            hoehe_mm: avgHoehe,
            flaeche_qm: avgFlaeche,
            groessen_klasse: groessenKlasse,
            uw_wert: avgUw,
            verglasung: verglasung,
            hat_rollladen: hatRollladen,
            hersteller: dominantHersteller,
            system_name: dominantSystem,
            // P006: Neue Felder
            ist_kombi: kombiMajority,
            ist_lagerware: entry.lagerwaren_count > 0,
            meta: {
                median_preis: round2(median),
                quelle: 'auto-sync-v2-p006',
                oeffnungsart_samples: entry.oeffnungsarten.length,
                dim_samples: entry.dimensions.length,
                uw_samples: entry.uwWerte.length,
                kombi_samples: kombiTrueCount,
                lagerwaren_count: entry.lagerwaren_count
            }
        });
    }

    console.log(`      ${lvEntries.length} Eintraege vorbereitet`);

    // Granulare Statistik ueber LV-Eintraege
    const granularStats = {
        with_oeffnungsart: lvEntries.filter(e => e.oeffnungsart).length,
        with_dims: lvEntries.filter(e => e.breite_mm).length,
        with_uw: lvEntries.filter(e => e.uw_wert).length,
        with_rollladen: lvEntries.filter(e => e.hat_rollladen).length,
        with_kombi: lvEntries.filter(e => e.ist_kombi).length,
        with_lagerware: lvEntries.filter(e => e.ist_lagerware).length,
        with_hersteller: lvEntries.filter(e => e.hersteller).length,
        with_system: lvEntries.filter(e => e.system_name).length,
    };

    console.log(`      LV-Eintraege mit granularen Daten:`);
    console.log(`        Mit Oeffnungsart: ${granularStats.with_oeffnungsart}/${lvEntries.length}`);
    console.log(`        Mit Dimensionen:  ${granularStats.with_dims}/${lvEntries.length}`);
    console.log(`        Mit Uw-Wert:      ${granularStats.with_uw}/${lvEntries.length}`);
    console.log(`        Mit Rollladen:    ${granularStats.with_rollladen}/${lvEntries.length}`);
    console.log(`        Mit Hersteller:   ${granularStats.with_hersteller}/${lvEntries.length}`);
    console.log(`        Mit System:       ${granularStats.with_system}/${lvEntries.length}`);
    console.log(`        Kombielemente:    ${granularStats.with_kombi}/${lvEntries.length}`);
    console.log(`        Lagerware-Flag:   ${granularStats.with_lagerware}/${lvEntries.length}`);

    if (DRY_RUN) {
        console.log('\n  [DRY RUN] Top 30 Eintraege mit granularen Daten:');
        const withData = lvEntries
            .filter(e => e.oeffnungsart || e.breite_mm || e.uw_wert)
            .sort((a, b) => b.sample_count - a.sample_count)
            .slice(0, 30);

        for (const e of withData) {
            const dims = e.breite_mm ? `${e.breite_mm}x${e.hoehe_mm}` : '---';
            const oa = (e.oeffnungsart || '---').padEnd(5);
            const gk = (e.groessen_klasse || '--').padEnd(2);
            const vg = (e.verglasung || '---').padEnd(6);
            const rl = e.hat_rollladen ? 'RL' : '  ';
            const hs = (e.hersteller || '').padEnd(6).substring(0, 6);
            const sys = (e.system_name || '').padEnd(8).substring(0, 8);
            console.log(`    ${e.kategorie.padEnd(12)} ${oa} ${gk} ${vg} ${rl} ${hs} ${sys} ${dims.padEnd(10)} ${String(e.avg_preis).padStart(8)}E  (${e.sample_count}x)`);
        }

        console.log('\n  [DRY RUN] Top 20 nach Sample-Count (alle):');
        const top = [...lvEntries].sort((a, b) => b.sample_count - a.sample_count).slice(0, 20);
        for (const e of top) {
            console.log(`    ${e.kategorie.padEnd(15)} ${e.bezeichnung.substring(0, 40).padEnd(42)} ${String(e.avg_preis).padStart(8)}E  (${e.sample_count}x)`);
        }

        // Verteilung nach Groessenklasse + Oeffnungsart
        console.log('\n  [DRY RUN] Verteilung Groessenklasse x Oeffnungsart:');
        const distrib = {};
        for (const e of lvEntries) {
            if (!e.oeffnungsart || !e.groessen_klasse) continue;
            const key = `${e.groessen_klasse}-${e.oeffnungsart}`;
            distrib[key] = (distrib[key] || 0) + e.sample_count;
        }
        for (const [key, count] of Object.entries(distrib).sort((a, b) => b[1] - a[1])) {
            console.log(`    ${key.padEnd(12)} ${count} Positionen`);
        }
    } else {
        // Bestehende Eintraege loeschen und neu schreiben
        console.log('      Loesche alte Eintraege...');
        try {
            await supabaseRequest('leistungsverzeichnis?id=not.is.null', 'DELETE', null, {
                'Prefer': 'return=minimal'
            });
            console.log('      Alte Eintraege geloescht');
        } catch (error) {
            console.error(`      WARNUNG beim Loeschen: ${error.message}`);
        }

        // In Batches nach Supabase schreiben
        const batchSize = 100;
        let written = 0;

        for (let i = 0; i < lvEntries.length; i += batchSize) {
            const batch = lvEntries.slice(i, i + batchSize);
            try {
                await supabaseRequest('leistungsverzeichnis', 'POST', batch, {
                    'Prefer': 'return=minimal'
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
    console.log(`  Granular angereichert:  ${granularStats.with_oeffnungsart} mit Oeffnungsart, ${granularStats.with_dims} mit Massen`);
    console.log(`  P006 Fixes:  ${granularStats.with_kombi} Kombielemente, ${granularStats.with_lagerware} mit Lagerware-Flag, ${stats.lagerware_excluded} Preise ausgeschlossen`);
    console.log(`${'='.repeat(70)}\n`);
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

function normalizeBezeichnung(bez) {
    if (!bez) return '';
    return bez.trim()
        .replace(/\s+/g, ' ')
        .replace(/\d{3,4}\s*[xX\u00d7*]\s*\d{3,4}/g, '') // Masse entfernen
        .replace(/\d+\s*mm/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100)
        .toLowerCase();
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function round3(value) {
    return Math.round(value * 1000) / 1000;
}

function pct(n, total) {
    if (total === 0) return '0%';
    return `${Math.round(n / total * 100)}%`;
}

/**
 * Findet den Modus (haeufigsten Wert) in einem Array.
 */
function getModus(arr) {
    if (!arr || arr.length === 0) return null;
    const counts = {};
    for (const v of arr) {
        counts[v] = (counts[v] || 0) + 1;
    }
    let maxCount = 0;
    let modus = null;
    for (const [val, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            modus = val;
        }
    }
    return modus;
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
});
