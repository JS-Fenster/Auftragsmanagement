/**
 * Work4All Proxy Routes
 *
 * Bridge-Proxy fuer on-demand Abfragen von Work4All Positionen.
 * KEINE Replikation von dbo.Positionen (~120k Zeilen).
 *
 * Endpunkte:
 * - GET /api/w4a/health - Health Check
 * - GET /api/w4a/angebote/:code/positionen - Positionen eines Angebots
 * - GET /api/w4a/angebote/:code/summary - Aggregat mit Textposition-Erkennung
 * - GET /api/w4a/kunden/:code/angebots-history - Alle Angebote eines Kunden
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-004]
 */

const express = require('express');
const router = express.Router();
const { sql, getW4APool, checkW4AHealth } = require('../config/w4a-database');
const { supabase } = require('../config/database');

// ============================================
// KONSTANTEN
// ============================================

// Cache TTL: 24 Stunden in Millisekunden
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Keywords fuer Textposition-Erkennung (aus 04_LEARNINGS.md L8)
const HEADER_KEYWORDS = [
    'WERU', 'CASTELLO', 'CALIDO', 'IMPREO',
    'weiss', 'anthrazit', 'golden oak', 'nussbaum',
    '2-fach', '3-fach', '2fach', '3fach',
    'Kunststoff', 'Aluminium', 'Holz-Alu'
];

// Heuristic Version fuer Cache-Invalidierung
const HEURISTIC_VERSION = '1.0.0';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Prueft ob eine Position eine Textposition/Header ist
 * Kriterien aus 04_LEARNINGS.md L5:
 * - Anzahl = 0 ODER Anzahl IS NULL
 * - EinzPreis = 0 ODER EinzPreis IS NULL
 * - Bezeichnung enthaelt Header-Keywords
 *
 * @param {Object} position - Position aus dbo.Positionen
 * @returns {boolean}
 */
const isTextPosition = (position) => {
    // Anzahl und Preis muessen 0 oder NULL sein
    const hasZeroQuantity = !position.Anzahl || position.Anzahl === 0;
    const hasZeroPrice = !position.EinzPreis || position.EinzPreis === 0;

    if (!hasZeroQuantity || !hasZeroPrice) {
        return false;
    }

    // Bezeichnung muss Header-Keyword enthalten
    const bezeichnung = (position.Bezeichnung || '').toLowerCase();
    return HEADER_KEYWORDS.some(keyword =>
        bezeichnung.includes(keyword.toLowerCase())
    );
};

/**
 * Klassifiziert eine Position
 * @param {Object} position
 * @returns {'header'|'item'|'accessory'|'montage'|'unknown'}
 */
const classifyPosition = (position) => {
    // Textposition/Header
    if (isTextPosition(position)) {
        return 'header';
    }

    const bezeichnung = (position.Bezeichnung || '').toLowerCase();

    // Montage/Demontage/Entsorgung
    if (bezeichnung.includes('montage') ||
        bezeichnung.includes('demontage') ||
        bezeichnung.includes('entsorgung')) {
        return 'montage';
    }

    // Zubehoer
    const accessoryKeywords = [
        'rollladen', 'raffstore', 'motor',
        'fensterbank', 'afb', 'ifb',
        'insektenschutz', 'plissee', 'jalousie'
    ];
    if (accessoryKeywords.some(kw => bezeichnung.includes(kw))) {
        return 'accessory';
    }

    // Fenster/Tueren = Items
    const itemKeywords = [
        'fenster', 'tuer', 'hst', 'hebe-schiebe',
        'balkon', 'terrassen', 'eingang'
    ];
    if (itemKeywords.some(kw => bezeichnung.includes(kw))) {
        return 'item';
    }

    return 'unknown';
};

/**
 * Validiert einen numerischen Code-Parameter
 * @param {string} code
 * @returns {number|null}
 */
const validateCode = (code) => {
    const parsed = parseInt(code, 10);
    if (isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

/**
 * Prueft ob Cache-Eintrag noch gueltig ist
 * @param {Object} cacheEntry
 * @returns {boolean}
 */
const isCacheValid = (cacheEntry) => {
    if (!cacheEntry || !cacheEntry.computed_at) {
        return false;
    }
    const computedAt = new Date(cacheEntry.computed_at).getTime();
    const age = Date.now() - computedAt;
    return age < CACHE_TTL_MS;
};

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/w4a/health
 * Health Check fuer W4A SQL Server Verbindung
 */
router.get('/health', async (req, res) => {
    try {
        const health = await checkW4AHealth();

        res.json({
            success: health.connected,
            service: 'w4a-proxy',
            database: {
                connected: health.connected,
                server: health.server,
                database: health.database,
                latency_ms: health.latency_ms,
                error: health.error
            },
            cache: {
                ttl_hours: 24,
                heuristic_version: HEURISTIC_VERSION
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            service: 'w4a-proxy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/w4a/angebote/:code/positionen
 * Positionen eines Angebots (paginated)
 *
 * Query-Parameter:
 * - page: Seitennummer (default: 1)
 * - limit: Anzahl pro Seite (default: 50, max: 200)
 * - include_headers: Textpositionen einschliessen (default: true)
 */
router.get('/angebote/:code/positionen', async (req, res) => {
    try {
        // Parameter validieren
        const angebotCode = validateCode(req.params.code);
        if (!angebotCode) {
            return res.status(400).json({
                success: false,
                message: 'Ungueltiger Angebots-Code'
            });
        }

        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const includeHeaders = req.query.include_headers !== 'false';
        const offset = (page - 1) * limit;

        // W4A Abfrage mit Parameterized Query (SQL Injection verhindert)
        const pool = await getW4APool();

        // Zuerst Gesamtanzahl ermitteln
        const countResult = await pool.request()
            .input('angebotCode', sql.Int, angebotCode)
            .query(`
                SELECT COUNT(*) AS total
                FROM dbo.Positionen
                WHERE AngebotCode = @angebotCode
            `);

        const total = countResult.recordset[0].total;

        // Positionen abrufen
        const result = await pool.request()
            .input('angebotCode', sql.Int, angebotCode)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT
                    Code,
                    AngebotCode,
                    PosNr,
                    Bezeichnung,
                    Langtext,
                    Anzahl,
                    Einheit,
                    EinzPreis,
                    Rabatt,
                    GesamtPreis,
                    ArtikelCode
                FROM dbo.Positionen
                WHERE AngebotCode = @angebotCode
                ORDER BY PosNr
                OFFSET @offset ROWS
                FETCH NEXT @limit ROWS ONLY
            `);

        // Positionen klassifizieren
        const positionen = result.recordset.map(pos => ({
            ...pos,
            _type: classifyPosition(pos),
            _is_header: isTextPosition(pos)
        }));

        // Optional: Header ausfiltern
        const filteredPositionen = includeHeaders
            ? positionen
            : positionen.filter(p => !p._is_header);

        res.json({
            success: true,
            data: {
                angebot_code: angebotCode,
                positionen: filteredPositionen,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit),
                    has_more: offset + filteredPositionen.length < total
                }
            }
        });

    } catch (error) {
        console.error('[W4A] Fehler bei Positionen-Abfrage:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Positionen',
            error: error.message
        });
    }
});

/**
 * GET /api/w4a/angebote/:code/summary
 * Aggregat mit Textposition-Analyse
 *
 * Gibt zurueck:
 * - fenster_count: Anzahl Fenster/Tueren
 * - montage_summe: Summe Montage/Demontage/Entsorgung
 * - zubehoer_summe: Summe Rollladen/Raffstore/etc.
 * - positionen_count: Gesamtanzahl Positionen
 * - headers: Erkannte Header-Positionen (fuer Kontext-Parser)
 *
 * Verwendet Cache: erp_angebot_summaries_cache (TTL 24h)
 */
router.get('/angebote/:code/summary', async (req, res) => {
    try {
        // Parameter validieren
        const angebotCode = validateCode(req.params.code);
        if (!angebotCode) {
            return res.status(400).json({
                success: false,
                message: 'Ungueltiger Angebots-Code'
            });
        }

        const forceRefresh = req.query.refresh === 'true';

        // 1. Cache pruefen (falls nicht force refresh)
        if (!forceRefresh) {
            const { data: cacheEntry, error: cacheError } = await supabase
                .from('erp_angebot_summaries_cache')
                .select('*')
                .eq('angebot_code', angebotCode)
                .single();

            if (!cacheError && cacheEntry && isCacheValid(cacheEntry)) {
                // Cache-Hit mit gleicher Heuristic-Version
                if (cacheEntry.heuristic_version === HEURISTIC_VERSION) {
                    return res.json({
                        success: true,
                        data: {
                            angebot_code: angebotCode,
                            fenster_count: cacheEntry.fenster_count,
                            montage_summe: cacheEntry.montage_summe,
                            zubehoer_summe: cacheEntry.zubehoer_summe,
                            positionen_count: cacheEntry.positionen_count,
                            headers: cacheEntry.headers_json || [],
                            computed_at: cacheEntry.computed_at
                        },
                        cached: true,
                        cache_age_hours: Math.round((Date.now() - new Date(cacheEntry.computed_at).getTime()) / 3600000 * 10) / 10
                    });
                }
            }
        }

        // 2. W4A Abfrage - alle Positionen laden
        const pool = await getW4APool();

        const result = await pool.request()
            .input('angebotCode', sql.Int, angebotCode)
            .query(`
                SELECT
                    Code,
                    PosNr,
                    Bezeichnung,
                    Langtext,
                    Anzahl,
                    Einheit,
                    EinzPreis,
                    GesamtPreis
                FROM dbo.Positionen
                WHERE AngebotCode = @angebotCode
                ORDER BY PosNr
            `);

        const positionen = result.recordset;

        // 3. Aggregation berechnen
        let fensterCount = 0;
        let montageSumme = 0;
        let zubehoerSumme = 0;
        const headers = [];

        positionen.forEach(pos => {
            const typ = classifyPosition(pos);

            switch (typ) {
                case 'header':
                    headers.push({
                        pos_nr: pos.PosNr,
                        bezeichnung: pos.Bezeichnung,
                        detected_context: extractContextFromHeader(pos.Bezeichnung)
                    });
                    break;
                case 'item':
                    fensterCount += (pos.Anzahl || 1);
                    break;
                case 'montage':
                    montageSumme += (pos.GesamtPreis || 0);
                    break;
                case 'accessory':
                    zubehoerSumme += (pos.GesamtPreis || 0);
                    break;
            }
        });

        const summary = {
            angebot_code: angebotCode,
            fenster_count: fensterCount,
            montage_summe: Math.round(montageSumme * 100) / 100,
            zubehoer_summe: Math.round(zubehoerSumme * 100) / 100,
            positionen_count: positionen.length,
            headers: headers,
            computed_at: new Date().toISOString()
        };

        // 4. Cache aktualisieren (upsert)
        const { error: upsertError } = await supabase
            .from('erp_angebot_summaries_cache')
            .upsert({
                angebot_code: angebotCode,
                fenster_count: summary.fenster_count,
                montage_summe: summary.montage_summe,
                zubehoer_summe: summary.zubehoer_summe,
                positionen_count: summary.positionen_count,
                headers_json: summary.headers,
                heuristic_version: HEURISTIC_VERSION,
                computed_at: summary.computed_at
            }, {
                onConflict: 'angebot_code'
            });

        if (upsertError) {
            console.warn('[W4A] Cache-Update fehlgeschlagen:', upsertError.message);
        }

        res.json({
            success: true,
            data: summary,
            cached: false
        });

    } catch (error) {
        console.error('[W4A] Fehler bei Summary-Abfrage:', error);

        // Fallback: erp_angebote.wert nutzen (aus SPEC 4.5)
        try {
            const { data: angebot, error: angebotError } = await supabase
                .from('erp_angebote')
                .select('code, wert')
                .eq('code', req.params.code)
                .single();

            if (!angebotError && angebot) {
                return res.json({
                    success: true,
                    data: {
                        angebot_code: parseInt(req.params.code, 10),
                        total_wert: angebot.wert,
                        fallback: true,
                        fallback_reason: 'W4A nicht erreichbar'
                    },
                    cached: false,
                    warning: 'Keine Positionsanalyse moeglich - nur Gesamtwert verfuegbar'
                });
            }
        } catch (fallbackError) {
            console.error('[W4A] Fallback fehlgeschlagen:', fallbackError);
        }

        res.status(500).json({
            success: false,
            message: 'Fehler beim Berechnen des Summaries',
            error: error.message
        });
    }
});

/**
 * GET /api/w4a/kunden/:code/angebots-history
 * Alle Angebote eines Kunden mit Summen
 *
 * Query-Parameter:
 * - limit: Max. Anzahl (default: 50)
 * - with_summary: Summaries einschliessen (default: false, langsam!)
 */
router.get('/kunden/:code/angebots-history', async (req, res) => {
    try {
        // Parameter validieren
        const kundenCode = validateCode(req.params.code);
        if (!kundenCode) {
            return res.status(400).json({
                success: false,
                message: 'Ungueltiger Kunden-Code'
            });
        }

        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const withSummary = req.query.with_summary === 'true';

        // W4A Abfrage
        const pool = await getW4APool();

        const result = await pool.request()
            .input('kundenCode', sql.Int, kundenCode)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit)
                    a.Code,
                    a.Nummer,
                    a.Datum,
                    a.Wert,
                    a.ProjektCode,
                    a.Notiz,
                    a.AuftragsDatum,
                    p.Bezeichnung AS ProjektBezeichnung
                FROM dbo.Angebot a
                LEFT JOIN dbo.Projekt p ON a.ProjektCode = p.Code
                WHERE a.KundenCode = @kundenCode
                ORDER BY a.Datum DESC
            `);

        const angebote = result.recordset.map(a => ({
            code: a.Code,
            nummer: a.Nummer,
            datum: a.Datum,
            wert: a.Wert,
            projekt_code: a.ProjektCode,
            projekt_bezeichnung: a.ProjektBezeichnung,
            notiz: a.Notiz,
            ist_auftrag: !!a.AuftragsDatum,
            auftrags_datum: a.AuftragsDatum
        }));

        // Optional: Summaries aus Cache laden
        if (withSummary && angebote.length > 0) {
            const codes = angebote.map(a => a.code);
            const { data: cacheEntries, error: cacheError } = await supabase
                .from('erp_angebot_summaries_cache')
                .select('*')
                .in('angebot_code', codes);

            if (!cacheError && cacheEntries) {
                const cacheMap = new Map(cacheEntries.map(c => [c.angebot_code, c]));
                angebote.forEach(a => {
                    const cache = cacheMap.get(a.code);
                    if (cache && isCacheValid(cache)) {
                        a.summary = {
                            fenster_count: cache.fenster_count,
                            montage_summe: cache.montage_summe,
                            zubehoer_summe: cache.zubehoer_summe,
                            positionen_count: cache.positionen_count
                        };
                    }
                });
            }
        }

        res.json({
            success: true,
            data: {
                kunden_code: kundenCode,
                angebote: angebote,
                count: angebote.length
            }
        });

    } catch (error) {
        console.error('[W4A] Fehler bei Angebots-History:', error);

        // Fallback: Aus Supabase erp_angebote laden
        try {
            const { data: angebote, error: angebotError } = await supabase
                .from('erp_angebote')
                .select('code, nummer, datum, wert, projekt_code, notiz, ist_auftrag')
                .eq('kunden_code', req.params.code)
                .order('datum', { ascending: false })
                .limit(parseInt(req.query.limit || '50', 10));

            if (!angebotError && angebote) {
                return res.json({
                    success: true,
                    data: {
                        kunden_code: parseInt(req.params.code, 10),
                        angebote: angebote,
                        count: angebote.length,
                        fallback: true
                    },
                    warning: 'Daten aus Supabase-Cache (W4A nicht erreichbar)'
                });
            }
        } catch (fallbackError) {
            console.error('[W4A] Fallback fehlgeschlagen:', fallbackError);
        }

        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Angebots-History',
            error: error.message
        });
    }
});

// ============================================
// HELPER: Context Extraction
// ============================================

/**
 * Extrahiert Kontext-Informationen aus einer Header-Bezeichnung
 * z.B. "WERU CASTELLO weiss/weiss 3-fach" ->
 *      { manufacturer: 'WERU', system: 'CASTELLO', colors: ['weiss', 'weiss'], glazing: '3-fach' }
 *
 * @param {string} bezeichnung
 * @returns {Object}
 */
function extractContextFromHeader(bezeichnung) {
    const text = bezeichnung || '';
    const textLower = text.toLowerCase();

    const context = {};

    // Hersteller
    if (textLower.includes('weru')) context.manufacturer = 'WERU';

    // System
    if (textLower.includes('castello')) context.system = 'CASTELLO';
    else if (textLower.includes('calido')) context.system = 'CALIDO';
    else if (textLower.includes('impreo')) context.system = 'IMPREO';

    // Verglasung
    if (textLower.includes('3-fach') || textLower.includes('3fach')) {
        context.glazing = '3-fach';
    } else if (textLower.includes('2-fach') || textLower.includes('2fach')) {
        context.glazing = '2-fach';
    }

    // Farben (vereinfachte Erkennung)
    const colorPattern = /(\w+)\s*\/\s*(\w+)/;
    const colorMatch = text.match(colorPattern);
    if (colorMatch) {
        context.color_inside = colorMatch[1];
        context.color_outside = colorMatch[2];
    } else {
        // Einzelne Farbe
        const colors = ['weiss', 'anthrazit', 'golden oak', 'nussbaum', 'grau'];
        colors.forEach(color => {
            if (textLower.includes(color)) {
                context.color = color;
            }
        });
    }

    return context;
}

module.exports = router;
