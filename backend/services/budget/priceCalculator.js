/**
 * Price Calculator Service V2.0.0
 *
 * Berechnet Budgetpreise fuer:
 * - Fenster/Tueren (qm-basiert nach System)
 * - Zubehoer (Rollladen, Raffstore, AFB, IFB, etc.)
 * - Montage-Block V2 (stundenbasiert + lfm-basiert)
 *
 * Erstellt: 2026-02-04
 * Aktualisiert: 2026-02-11 (P018: Montage-Kalkulation V2)
 * Log-Referenz: [LOG-006], [B-059]
 *
 * HINWEIS: Alle Preise sind Schaetzwerte fuer Budgetangebote.
 * Bei Unsicherheit wird der hoehere Preis gewaehlt (sicherer).
 */

// ============================================================================
// PREISKONFIGURATION V2.0.0
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
 * Montage-Block Preise V2.0.0
 * Quelle: P018 - Rechnungsdaten + WPS-Screenshots
 *
 * Inkludiert: Demontage + Montage + Beiputz (alles in Arbeitsstunden)
 */
const WORK_PRICES = {
    // Stundensatz netto
    hourly_rate: 58.82,

    // Degressiver Stundenansatz pro Fenster nach Projektgroesse
    hours_per_element: [
        { max_elements: 2,  hours: 6.0 },
        { max_elements: 4,  hours: 5.5 },
        { max_elements: 9,  hours: 5.3 },
        { max_elements: Infinity, hours: 5.3 }
    ],

    // Entsorgung degressiv nach lfm Umfang (2*B + 2*H pro Element)
    entsorgung_per_lfm: [
        { max_lfm: 2.0, price: 13.70 },
        { max_lfm: 2.5, price: 11.42 },
        { max_lfm: 3.0, price:  9.90 },
        { max_lfm: 3.5, price:  8.76 },
        { max_lfm: 4.0, price:  7.80 },
        { max_lfm: Infinity, price: 7.61 }
    ],

    // Montagematerial flat pro lfm Umfang
    material_per_lfm: {
        altbau: 3.25,   // EUR/lfm (Default)
        neubau: 3.50    // EUR/lfm
    },

    // HST-Aufpreis Material
    hst_material_surcharge: 100.00
};

/**
 * MwSt-Satz
 */
const VAT_RATE = 19.00;

/**
 * Modell-Version
 */
const MODEL_VERSION = 'v2.0.0';

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
 * Ermittelt den degressiven Stundensatz pro Element basierend auf Gesamtanzahl
 *
 * @param {number} totalElements - Gesamtanzahl Elemente im Projekt
 * @returns {number} - Stunden pro Element
 */
function getHoursPerElement(totalElements) {
    for (const tier of WORK_PRICES.hours_per_element) {
        if (totalElements <= tier.max_elements) {
            return tier.hours;
        }
    }
    // Fallback: letzter Tier
    return WORK_PRICES.hours_per_element[WORK_PRICES.hours_per_element.length - 1].hours;
}

/**
 * Ermittelt den degressiven Entsorgungspreis pro lfm basierend auf Element-Umfang
 *
 * @param {number} lfm - Umfang eines Elements in laufenden Metern
 * @returns {number} - EUR pro lfm
 */
function getEntsorgungPerLfm(lfm) {
    for (const tier of WORK_PRICES.entsorgung_per_lfm) {
        if (lfm <= tier.max_lfm) {
            return tier.price;
        }
    }
    // Fallback: letzter Tier
    return WORK_PRICES.entsorgung_per_lfm[WORK_PRICES.entsorgung_per_lfm.length - 1].price;
}

/**
 * Berechnet den Umfang eines Elements in laufenden Metern
 *
 * @param {number} width_mm - Breite in mm
 * @param {number} height_mm - Hoehe in mm
 * @returns {number} - Umfang in lfm (= 2*B + 2*H in Metern)
 */
function calculateLfm(width_mm, height_mm) {
    const width_m = (width_mm || 1000) / 1000;
    const height_m = (height_mm || 1200) / 1000;
    return round2(2 * width_m + 2 * height_m);
}

/**
 * Berechnet den Montage-Block V2 (stundenbasiert + lfm-basiert)
 *
 * Inkludiert in Arbeitsstunden: Demontage + Montage + Beiputz
 * Separat: Entsorgung (nach lfm) + Montagematerial (nach lfm)
 *
 * @param {Object} workConfig - { montage: bool, entsorgung: bool, bautyp: 'altbau'|'neubau' }
 * @param {Array} items - Array von Items mit { width_mm, height_mm, qty, element_type }
 * @returns {Object} - { total, breakdown, details, assumptions }
 */
function calculateWorkPrice(workConfig, items = []) {
    const {
        montage = true,
        entsorgung = true,
        bautyp = 'altbau'
    } = workConfig || {};

    let total = 0;
    const breakdown = {};
    const assumptions = [];
    const details = {};

    // Gesamtanzahl Elemente berechnen
    const elementCount = items.reduce((sum, item) => sum + (item.qty || 1), 0);

    // --- Arbeitsstunden (Montage + Demontage + Beiputz) ---
    if (montage && elementCount > 0) {
        const hoursPerElement = getHoursPerElement(elementCount);
        const totalHours = round2(hoursPerElement * elementCount);
        const hourlyRate = WORK_PRICES.hourly_rate;
        const montagePrice = round2(totalHours * hourlyRate);

        breakdown.montage = montagePrice;
        details.montage = {
            stunden_pro_element: hoursPerElement,
            gesamt_stunden: totalHours,
            stundensatz: hourlyRate,
            element_count: elementCount
        };
        total += montagePrice;
        assumptions.push(`Montage: ${totalHours} Std x ${hourlyRate.toFixed(2)} EUR/Std (${hoursPerElement} Std/Element bei ${elementCount} Elementen)`);
    }

    // --- Entsorgung (degressiv nach lfm pro Element) ---
    if (entsorgung && items.length > 0) {
        let entsorgungTotal = 0;
        let entsorgungLfmTotal = 0;
        const entsorgungDetails = [];

        for (const item of items) {
            const qty = item.qty || 1;
            const lfm = calculateLfm(item.width_mm, item.height_mm);
            const pricePerLfm = getEntsorgungPerLfm(lfm);
            const itemEntsorgung = round2(lfm * pricePerLfm * qty);

            entsorgungTotal += itemEntsorgung;
            entsorgungLfmTotal += lfm * qty;
            entsorgungDetails.push({
                lfm,
                price_per_lfm: pricePerLfm,
                qty,
                subtotal: itemEntsorgung
            });
        }

        breakdown.entsorgung = round2(entsorgungTotal);
        details.entsorgung = {
            gesamt_lfm: round2(entsorgungLfmTotal),
            positionen: entsorgungDetails
        };
        total += entsorgungTotal;
        assumptions.push(`Entsorgung: ${round2(entsorgungLfmTotal)} lfm gesamt (degressiv nach Elementgroesse)`);
    }

    // --- Montagematerial (flat pro lfm) ---
    if (montage && items.length > 0) {
        let materialTotal = 0;
        let materialLfmTotal = 0;
        const materialRate = WORK_PRICES.material_per_lfm[bautyp] || WORK_PRICES.material_per_lfm.altbau;
        let hstSurchargeTotal = 0;

        for (const item of items) {
            const qty = item.qty || 1;
            const lfm = calculateLfm(item.width_mm, item.height_mm);
            const itemMaterial = round2(lfm * materialRate * qty);
            materialTotal += itemMaterial;
            materialLfmTotal += lfm * qty;

            // HST-Aufpreis
            if (item.element_type === 'hst') {
                hstSurchargeTotal += WORK_PRICES.hst_material_surcharge * qty;
            }
        }

        materialTotal = round2(materialTotal + hstSurchargeTotal);
        breakdown.material = materialTotal;
        details.material = {
            gesamt_lfm: round2(materialLfmTotal),
            rate_per_lfm: materialRate,
            bautyp,
            hst_aufpreis: hstSurchargeTotal
        };
        total += materialTotal;

        let materialHint = `Montagematerial ${bautyp}: ${round2(materialLfmTotal)} lfm x ${materialRate.toFixed(2)} EUR/lfm`;
        if (hstSurchargeTotal > 0) {
            materialHint += ` + ${hstSurchargeTotal.toFixed(2)} EUR HST-Aufpreis`;
        }
        assumptions.push(materialHint);
    }

    return {
        total: round2(total),
        breakdown,
        details,
        assumptions,
        element_count: elementCount
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

    // Montage-Block berechnen (V2: Items statt elementCount)
    const workResult = calculateWorkPrice(workConfig, items);
    const elementCount = workResult.element_count;
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
        work_details: workResult.details,
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

    // Montage (optional) - V2: Items-Array uebergeben
    let workResult = { total: 0, breakdown: {} };
    if (includeWork) {
        workResult = calculateWorkPrice(
            { montage: true, entsorgung: true, bautyp: 'altbau' },
            [{ width_mm, height_mm, qty, element_type: params.element_type || 'fenster' }]
        );
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
    calculateLfm,
    getHoursPerElement,
    getEntsorgungPerLfm,

    // Konstanten (fuer Tests/Debugging)
    SYSTEM_PRICES,
    ACCESSORY_PRICES,
    WORK_PRICES,
    COLOR_SURCHARGES,
    VAT_RATE,
    MODEL_VERSION
};
