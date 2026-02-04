/**
 * Price Calculator Service
 *
 * Berechnet Budgetpreise fuer:
 * - Fenster/Tueren (qm-basiert nach System)
 * - Zubehoer (Rollladen, Raffstore, AFB, IFB, etc.)
 * - Montage-Block (Montage, Demontage, Entsorgung)
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-006]
 *
 * HINWEIS: Alle Preise sind Schaetzwerte fuer Budgetangebote.
 * Bei Unsicherheit wird der hoehere Preis gewaehlt (sicherer).
 */

// ============================================================================
// PREISKONFIGURATION V1.0.0
// ============================================================================

/**
 * Basispreise pro qm nach System
 * Quelle: Erfahrungswerte WERU-Fenster 2024/2025
 */
const SYSTEM_PRICES = {
    'CASTELLO': { base_per_sqm: 400, description: '2-fach Standard' },  // Angepasst von 350 auf 400 (LOG-025)
    'CALIDO': { base_per_sqm: 420, description: '3-fach Standard' },
    'IMPREO': { base_per_sqm: 520, description: 'Premium' },
    'AFINO': { base_per_sqm: 480, description: 'Design' },
    // Fallback fuer unbekannte Systeme
    'DEFAULT': { base_per_sqm: 400, description: 'Fallback' }
};

/**
 * Mindestpreis pro Fenster (auch bei kleinen Massen)
 */
const MIN_WINDOW_PRICE = 150;

/**
 * Farb-Aufschlaege (prozentual)
 */
const COLOR_SURCHARGES = {
    'weiss/weiss': 0.00,       // Standard, kein Aufschlag
    'weiss/anthrazit': 0.08,   // Aussen Dekor
    'anthrazit/weiss': 0.08,   // Innen Dekor
    'anthrazit/anthrazit': 0.12, // Beidseitig Dekor
    'golden_oak': 0.10,        // Holzdekor
    'nussbaum': 0.12,          // Holzdekor Premium
    'schokobraun': 0.10,       // Sonderfarbe
    'DEFAULT_COLOR': 0.05     // Fallback bei unbekannter Farbe
};

/**
 * Sondermass-Aufschlag (prozentual)
 * Gilt wenn B > 1800mm oder H > 2400mm
 */
const OVERSIZED_SURCHARGE = 0.10;
const OVERSIZED_WIDTH_THRESHOLD = 1800;  // mm
const OVERSIZED_HEIGHT_THRESHOLD = 2400; // mm

/**
 * Zubehoer-Preise
 * Quelle: 01_SPEC.md Kapitel 2.6
 */
const ACCESSORY_PRICES = {
    // Rollladen - Preis nach Breite
    rollladen: {
        price_per_m: 180,       // EUR pro Meter Breite
        min_price: 120,         // Mindestpreis
        description: 'Vorbau-Rollladen'
    },
    // Raffstore - Preis nach Breite
    raffstore: {
        price_per_m: 280,       // EUR pro Meter Breite
        min_price: 200,         // Mindestpreis
        description: 'Aussenraffstore'
    },
    // Motor fuer elektrischen Antrieb
    motor: {
        price_per_unit: 150,    // EUR pro Stueck
        description: 'Elektromotor'
    },
    // Aussenfensterbank
    afb: {
        price_per_lfm: 35,      // EUR pro laufenden Meter
        min_price: 25,          // Mindestpreis
        description: 'Aussenfensterbank Aluminium'
    },
    // Innenfensterbank
    ifb: {
        price_per_lfm: 45,      // EUR pro laufenden Meter
        min_price: 30,          // Mindestpreis
        description: 'Innenfensterbank'
    },
    // Insektenschutz
    insektenschutz: {
        price_per_unit: 80,     // EUR pro Stueck
        description: 'Spannrahmen'
    },
    // Plissee
    plissee: {
        price_per_unit: 120,    // EUR pro Stueck
        description: 'Plissee/Faltstore'
    }
};

/**
 * Montage-Block Preise
 * Quelle: 01_SPEC.md Kapitel 2.7
 */
const WORK_PRICES = {
    montage: {
        price_per_element: 80,  // EUR pro Element
        description: 'Montage Neufenster'
    },
    demontage: {
        price_per_element: 40,  // EUR pro Element
        description: 'Demontage Altfenster'
    },
    entsorgung: {
        price_per_element: 25,  // EUR pro Element
        price_pauschal: 150,    // Alternative Pauschale
        description: 'Entsorgung Altmaterial'
    }
};

/**
 * MwSt-Satz
 */
const VAT_RATE = 19.00;

/**
 * Modell-Version
 */
const MODEL_VERSION = 'v1.0.0';

// ============================================================================
// BERECHNUNGSFUNKTIONEN
// ============================================================================

/**
 * Berechnet den Fensterpreis basierend auf Masse und Kontext
 *
 * @param {Object} item - Budget-Item mit width_mm, height_mm, qty
 * @param {Object} context - Kontext mit system, color_inside, color_outside
 * @returns {Object} - { price, area_sqm, breakdown, assumptions }
 */
function calculateWindowPrice(item, context = {}) {
    const { width_mm = 0, height_mm = 0, qty = 1 } = item;
    const { system, color_inside, color_outside } = context;

    // Flaeche in qm berechnen
    const area_sqm = (width_mm * height_mm) / 1000000;

    // System-Basispreis ermitteln
    const systemKey = (system || 'DEFAULT').toUpperCase();
    const systemConfig = SYSTEM_PRICES[systemKey] || SYSTEM_PRICES['DEFAULT'];
    const base_per_sqm = systemConfig.base_per_sqm;

    // Basispreis
    let unit_price = area_sqm * base_per_sqm;

    // Mindestpreis anwenden
    if (unit_price < MIN_WINDOW_PRICE) {
        unit_price = MIN_WINDOW_PRICE;
    }

    const assumptions = [];

    // Farb-Aufschlag berechnen
    const colorKey = normalizeColorKey(color_inside, color_outside);
    const colorSurcharge = COLOR_SURCHARGES[colorKey] || COLOR_SURCHARGES['DEFAULT_COLOR'];

    if (colorSurcharge > 0) {
        unit_price *= (1 + colorSurcharge);
        assumptions.push(`Farbaufschlag ${colorKey}: +${Math.round(colorSurcharge * 100)}%`);
    }

    // Sondermass-Aufschlag
    const isOversized = width_mm > OVERSIZED_WIDTH_THRESHOLD || height_mm > OVERSIZED_HEIGHT_THRESHOLD;
    if (isOversized) {
        unit_price *= (1 + OVERSIZED_SURCHARGE);
        assumptions.push(`Sondermass-Aufschlag: +${Math.round(OVERSIZED_SURCHARGE * 100)}%`);
    }

    // Gesamtpreis mit Menge
    const total_price = unit_price * qty;

    return {
        price: round2(total_price),
        unit_price: round2(unit_price),
        area_sqm: round4(area_sqm),
        qty,
        breakdown: {
            base_per_sqm,
            system: systemKey,
            color_surcharge: colorSurcharge,
            oversized: isOversized
        },
        assumptions
    };
}

/**
 * Normalisiert die Farbkombination fuer Aufschlag-Lookup
 */
function normalizeColorKey(colorInside, colorOutside) {
    const inside = normalizeColor(colorInside);
    const outside = normalizeColor(colorOutside);

    // Wenn beide gleich
    if (inside === outside) {
        if (inside === 'weiss') return 'weiss/weiss';
        if (inside === 'anthrazit') return 'anthrazit/anthrazit';
        if (inside === 'golden_oak') return 'golden_oak';
        if (inside === 'nussbaum') return 'nussbaum';
        if (inside === 'schokobraun') return 'schokobraun';
    }

    // Kombinationen
    const key = `${inside}/${outside}`;
    if (COLOR_SURCHARGES[key]) return key;

    // Fallback
    return 'DEFAULT_COLOR';
}

/**
 * Normalisiert eine Farbbezeichnung
 */
function normalizeColor(color) {
    if (!color) return 'weiss';

    const c = color.toLowerCase().trim();

    // Standard-Mapping
    if (/wei[sß]|white/i.test(c)) return 'weiss';
    if (/anthrazit|anthracite|ral\s*7016/i.test(c)) return 'anthrazit';
    if (/golden.*oak|eiche|golden/i.test(c)) return 'golden_oak';
    if (/nussbaum|walnut|nuss/i.test(c)) return 'nussbaum';
    if (/schoko|braun|chocolate/i.test(c)) return 'schokobraun';

    return 'weiss';
}

/**
 * Berechnet den Zubehoer-Preis
 *
 * @param {Object} accessories - Zubehoer-Objekt aus budget_accessories
 * @param {Object} item - Budget-Item mit width_mm fuer Breitenberechnung
 * @returns {Object} - { total, breakdown, assumptions }
 */
function calculateAccessoryPrice(accessories, item = {}) {
    const { width_mm = 1000 } = item;
    const width_m = width_mm / 1000;

    let total = 0;
    const breakdown = {};
    const assumptions = [];

    // Rollladen
    if (accessories.shutter && accessories.shutter_type === 'rollladen') {
        const config = ACCESSORY_PRICES.rollladen;
        let price = width_m * config.price_per_m;
        if (price < config.min_price) price = config.min_price;
        breakdown.rollladen = round2(price);
        total += price;
    }

    // Raffstore
    if (accessories.shutter && accessories.shutter_type === 'raffstore') {
        const config = ACCESSORY_PRICES.raffstore;
        let price = width_m * config.price_per_m;
        if (price < config.min_price) price = config.min_price;
        breakdown.raffstore = round2(price);
        total += price;
    }

    // Motor (nur wenn elektrisch)
    if (accessories.shutter_electric && accessories.motor_qty > 0) {
        const config = ACCESSORY_PRICES.motor;
        const price = config.price_per_unit * accessories.motor_qty;
        breakdown.motor = round2(price);
        total += price;
    }

    // Aussenfensterbank
    if (accessories.afb) {
        const config = ACCESSORY_PRICES.afb;
        let price = width_m * config.price_per_lfm;
        if (price < config.min_price) price = config.min_price;
        breakdown.afb = round2(price);
        total += price;
    }

    // Innenfensterbank
    if (accessories.ifb) {
        const config = ACCESSORY_PRICES.ifb;
        let price = width_m * config.price_per_lfm;
        if (price < config.min_price) price = config.min_price;
        breakdown.ifb = round2(price);
        total += price;
    }

    // Insektenschutz
    if (accessories.insect) {
        const config = ACCESSORY_PRICES.insektenschutz;
        breakdown.insektenschutz = config.price_per_unit;
        total += config.price_per_unit;
    }

    // Plissee
    if (accessories.plissee) {
        const config = ACCESSORY_PRICES.plissee;
        breakdown.plissee = config.price_per_unit;
        total += config.price_per_unit;
    }

    return {
        total: round2(total),
        breakdown,
        assumptions
    };
}

/**
 * Berechnet den Montage-Block
 *
 * @param {Object} workConfig - { montage: bool, demontage: bool, entsorgung: 'element'|'pauschal'|false }
 * @param {number} elementCount - Anzahl der Elemente
 * @returns {Object} - { total, breakdown, assumptions }
 */
function calculateWorkPrice(workConfig, elementCount = 1) {
    const { montage = true, demontage = true, entsorgung = 'element' } = workConfig || {};

    let total = 0;
    const breakdown = {};
    const assumptions = [];

    // Montage
    if (montage) {
        const price = WORK_PRICES.montage.price_per_element * elementCount;
        breakdown.montage = round2(price);
        total += price;
    }

    // Demontage
    if (demontage) {
        const price = WORK_PRICES.demontage.price_per_element * elementCount;
        breakdown.demontage = round2(price);
        total += price;
    }

    // Entsorgung
    if (entsorgung) {
        let price;
        if (entsorgung === 'pauschal') {
            price = WORK_PRICES.entsorgung.price_pauschal;
            assumptions.push('Entsorgung: Pauschale gewaehlt');
        } else {
            // Default: pro Element
            price = WORK_PRICES.entsorgung.price_per_element * elementCount;
            // Wenn pro Element teurer als pauschal, nehme pauschal (sicherer)
            if (price > WORK_PRICES.entsorgung.price_pauschal) {
                price = WORK_PRICES.entsorgung.price_pauschal;
                assumptions.push('Entsorgung: Pauschale guenstiger, automatisch gewaehlt');
            }
        }
        breakdown.entsorgung = round2(price);
        total += price;
    }

    return {
        total: round2(total),
        breakdown,
        assumptions
    };
}

/**
 * Berechnet die Range basierend auf Confidence
 * Quelle: L12 in 04_LEARNINGS.md
 *
 * @param {number} value - Basis-Wert
 * @param {string} confidence - 'high', 'medium', 'low'
 * @returns {Object} - { low, high, range_percent }
 */
function calculateRange(value, confidence = 'medium') {
    const ranges = {
        'high': 0.10,    // ±10%
        'medium': 0.20,  // ±20%
        'low': 0.30      // ±30%
    };

    const range_percent = ranges[confidence] || ranges['medium'];

    return {
        low: round2(value * (1 - range_percent)),
        high: round2(value * (1 + range_percent)),
        range_percent: range_percent * 100
    };
}

/**
 * Rundet Brutto auf 50 EUR Schritte
 * Quelle: 01_SPEC.md Kapitel 2.8
 *
 * @param {number} value - Brutto-Wert
 * @returns {number} - Gerundeter Wert
 */
function roundTo50(value) {
    return Math.round(value / 50) * 50;
}

// ============================================================================
// HAUPT-KALKULATION
// ============================================================================

/**
 * Berechnet das vollstaendige Budgetangebot
 *
 * @param {Object} budgetCase - Budget-Case mit items, accessories, profile
 * @param {Object} options - Zusaetzliche Optionen
 * @returns {Object} - Vollstaendiges Ergebnis nach Spec
 */
function calculateBudget(budgetCase, options = {}) {
    const {
        items = [],
        profile = {},
        workConfig = { montage: true, demontage: true, entsorgung: 'element' }
    } = budgetCase;

    // Gesamt-Confidence aus Items ermitteln (niedrigste gewinnt)
    const confidenceLevels = ['high', 'medium', 'low'];
    let overallConfidence = 'high';

    let fenster_total = 0;
    let zubehoer_total = 0;
    const itemDetails = [];
    const allAssumptions = [];

    // Jedes Item berechnen
    for (const item of items) {
        // Fenster/Element-Preis
        const windowResult = calculateWindowPrice(item, profile);
        fenster_total += windowResult.price;
        allAssumptions.push(...windowResult.assumptions);

        // Zubehoer-Preis (falls vorhanden)
        let accessoryResult = { total: 0, breakdown: {}, assumptions: [] };
        if (item.accessories) {
            accessoryResult = calculateAccessoryPrice(item.accessories, item);
            zubehoer_total += accessoryResult.total;
            allAssumptions.push(...accessoryResult.assumptions);
        }

        // Confidence aktualisieren
        if (item.confidence) {
            const itemLevel = confidenceLevels.indexOf(item.confidence);
            const currentLevel = confidenceLevels.indexOf(overallConfidence);
            if (itemLevel > currentLevel) {
                overallConfidence = item.confidence;
            }
        }

        itemDetails.push({
            item_id: item.id,
            element_type: item.element_type,
            dimensions: `${item.width_mm}x${item.height_mm}`,
            qty: item.qty || 1,
            fenster_price: windowResult.price,
            zubehoer_price: accessoryResult.total,
            total: round2(windowResult.price + accessoryResult.total),
            breakdown: {
                fenster: windowResult.breakdown,
                zubehoer: accessoryResult.breakdown
            }
        });
    }

    // Montage-Block berechnen
    const elementCount = items.reduce((sum, item) => sum + (item.qty || 1), 0);
    const workResult = calculateWorkPrice(workConfig, elementCount);
    const montage_total = workResult.total;
    allAssumptions.push(...workResult.assumptions);

    // Netto-Summe
    const net_total = round2(fenster_total + zubehoer_total + montage_total);

    // Brutto berechnen
    const gross_total = round2(net_total * (1 + VAT_RATE / 100));

    // Auf 50 EUR runden
    const gross_rounded_50 = roundTo50(gross_total);

    // Range berechnen (auf Basis von gross_rounded_50)
    const range = calculateRange(gross_rounded_50, overallConfidence);

    // Ergebnis-Struktur nach Spec
    return {
        net_total,
        vat_rate: VAT_RATE,
        gross_total,
        gross_rounded_50,
        range_low: range.low,
        range_high: range.high,
        confidence: overallConfidence,
        breakdown: {
            fenster: round2(fenster_total),
            zubehoer: round2(zubehoer_total),
            montage: round2(montage_total)
        },
        item_details: itemDetails,
        work_breakdown: workResult.breakdown,
        assumptions_json: {
            assumptions: allAssumptions,
            element_count: elementCount,
            system: profile.system || 'DEFAULT',
            manufacturer: profile.manufacturer || 'WERU'
        },
        model_version: MODEL_VERSION,
        calculated_at: new Date().toISOString()
    };
}

/**
 * Schnell-Kalkulation fuer ein einzelnes Element
 * Nuetzlich fuer Vorschau/Live-Updates
 *
 * @param {Object} params - { width_mm, height_mm, system, accessories }
 * @returns {Object} - Vereinfachtes Ergebnis
 */
function quickCalculate(params) {
    const {
        width_mm = 1000,
        height_mm = 1200,
        qty = 1,
        system = 'CALIDO',
        color_inside = 'weiss',
        color_outside = 'weiss',
        accessories = {},
        includeWork = false
    } = params;

    const item = { width_mm, height_mm, qty };
    const context = { system, color_inside, color_outside };

    // Fenster
    const windowResult = calculateWindowPrice(item, context);

    // Zubehoer
    const accessoryResult = calculateAccessoryPrice(accessories, item);

    // Montage (optional)
    let workResult = { total: 0, breakdown: {} };
    if (includeWork) {
        workResult = calculateWorkPrice({ montage: true, demontage: true, entsorgung: 'element' }, qty);
    }

    const net_total = round2(windowResult.price + accessoryResult.total + workResult.total);
    const gross_total = round2(net_total * (1 + VAT_RATE / 100));
    const gross_rounded_50 = roundTo50(gross_total);

    return {
        net_total,
        gross_total,
        gross_rounded_50,
        breakdown: {
            fenster: windowResult.price,
            zubehoer: accessoryResult.total,
            montage: workResult.total
        },
        area_sqm: windowResult.area_sqm
    };
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Rundet auf 2 Nachkommastellen
 */
function round2(value) {
    return Math.round(value * 100) / 100;
}

/**
 * Rundet auf 4 Nachkommastellen
 */
function round4(value) {
    return Math.round(value * 10000) / 10000;
}

/**
 * Gibt die Preiskonfiguration zurueck (fuer UI/Debugging)
 */
function getPriceConfig() {
    return {
        systems: SYSTEM_PRICES,
        accessories: ACCESSORY_PRICES,
        work: WORK_PRICES,
        color_surcharges: COLOR_SURCHARGES,
        vat_rate: VAT_RATE,
        model_version: MODEL_VERSION,
        thresholds: {
            min_window_price: MIN_WINDOW_PRICE,
            oversized_width: OVERSIZED_WIDTH_THRESHOLD,
            oversized_height: OVERSIZED_HEIGHT_THRESHOLD,
            oversized_surcharge: OVERSIZED_SURCHARGE
        }
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Haupt-Funktionen
    calculateBudget,
    quickCalculate,

    // Einzel-Berechnungen
    calculateWindowPrice,
    calculateAccessoryPrice,
    calculateWorkPrice,
    calculateRange,

    // Hilfsfunktionen
    roundTo50,
    normalizeColor,
    getPriceConfig,

    // Konstanten (fuer Tests/Debugging)
    SYSTEM_PRICES,
    ACCESSORY_PRICES,
    WORK_PRICES,
    COLOR_SURCHARGES,
    VAT_RATE,
    MODEL_VERSION
};
