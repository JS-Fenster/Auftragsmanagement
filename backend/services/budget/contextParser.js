/**
 * Context Parser Service
 *
 * Parst Header-Positionen und extrahiert Kontext-Informationen:
 * - Hersteller (WERU default)
 * - System (CASTELLO, CALIDO, IMPREO)
 * - Verglasung (2-fach, 3-fach)
 * - Farben (innen/aussen)
 * - Material (Kunststoff, Holz-Alu)
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-005]
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * Bekannte Hersteller
 */
const MANUFACTURERS = {
    'weru': 'WERU',
    'schüco': 'SCHUECO',
    'schueco': 'SCHUECO',
    'schuco': 'SCHUECO',
    'salamander': 'SALAMANDER',
    'veka': 'VEKA',
    'rehau': 'REHAU',
    'kömmerling': 'KOEMMERLING',
    'koemmerling': 'KOEMMERLING',
    'aluplast': 'ALUPLAST',
    'gealan': 'GEALAN',
    'internorm': 'INTERNORM',
    'aluprof': 'ALUPROF',
    'drutex': 'DRUTEX',
    'heroal': 'HEROAL',
    'warema': 'WAREMA'
};

/**
 * WERU Systeme (Hauptfokus)
 */
const WERU_SYSTEMS = {
    'castello': 'CASTELLO',
    'calido': 'CALIDO',
    'impreo': 'IMPREO',
    'impreo-top': 'IMPREO',
    'afino': 'AFINO',
    'afino-art': 'AFINO',
    'afino-one': 'AFINO',
    'afino-top': 'AFINO',
    'atris': 'ATRIS',
    'avida': 'AVIDA',
    'alegra': 'ALEGRA',
    'alegra-top': 'ALEGRA'
};

/**
 * Systeme anderer Hersteller
 */
const OTHER_SYSTEMS = {
    // INTERNORM
    'hf310': { manufacturer: 'INTERNORM', system: 'HF310' },
    'hf 310': { manufacturer: 'INTERNORM', system: 'HF310' },
    'kf410': { manufacturer: 'INTERNORM', system: 'KF410' },
    'kf 410': { manufacturer: 'INTERNORM', system: 'KF410' },
    'kf310': { manufacturer: 'INTERNORM', system: 'KF310' },
    'kf 310': { manufacturer: 'INTERNORM', system: 'KF310' },
    'hs330': { manufacturer: 'INTERNORM', system: 'HS330' },
    'hs 330': { manufacturer: 'INTERNORM', system: 'HS330' },
    // ALUPROF
    'mb-70': { manufacturer: 'ALUPROF', system: 'MB-70' },
    'mb 70': { manufacturer: 'ALUPROF', system: 'MB-70' },
    'mb70': { manufacturer: 'ALUPROF', system: 'MB-70' },
    'mb-86': { manufacturer: 'ALUPROF', system: 'MB-86' },
    'mb 86': { manufacturer: 'ALUPROF', system: 'MB-86' },
    'mb86': { manufacturer: 'ALUPROF', system: 'MB-86' },
    // SCHUECO
    'aws 70': { manufacturer: 'SCHUECO', system: 'AWS-70' },
    'aws-70': { manufacturer: 'SCHUECO', system: 'AWS-70' },
    'aws 75': { manufacturer: 'SCHUECO', system: 'AWS-75' },
    'aws-75': { manufacturer: 'SCHUECO', system: 'AWS-75' },
    // HEROAL
    'w72': { manufacturer: 'HEROAL', system: 'W72' },
    'w 72': { manufacturer: 'HEROAL', system: 'W72' },
    'w92': { manufacturer: 'HEROAL', system: 'W92' },
    'w 92': { manufacturer: 'HEROAL', system: 'W92' },
    // DRUTEX / VEKA (Legacy)
    'iglo 5': { manufacturer: 'DRUTEX', system: 'IGLO5' },
    'iglo5': { manufacturer: 'DRUTEX', system: 'IGLO5' },
    'iglo energy': { manufacturer: 'DRUTEX', system: 'IGLO-ENERGY' },
    'iglo-energy': { manufacturer: 'DRUTEX', system: 'IGLO-ENERGY' },
    'veka 76': { manufacturer: 'VEKA', system: 'VEKA-76' },
    'veka 82': { manufacturer: 'VEKA', system: 'VEKA-82' },
    'vekamotion': { manufacturer: 'VEKA', system: 'VEKAMOTION' }
};

/**
 * Verglasung
 */
const GLAZING_PATTERNS = [
    { pattern: /3[\s-]?fach/i, value: '3-fach' },
    { pattern: /dreifach/i, value: '3-fach' },
    { pattern: /triple/i, value: '3-fach' },
    { pattern: /2[\s-]?fach/i, value: '2-fach' },
    { pattern: /zweifach/i, value: '2-fach' },
    { pattern: /double/i, value: '2-fach' },
    { pattern: /ug\s*[\d,\.]+/i, value: null } // UG-Wert extrahieren separat
];

/**
 * Farben (erweiterte Liste)
 */
const COLORS = {
    // Standard
    'weiss': 'weiss',
    'weiß': 'weiss',
    'white': 'weiss',
    // Grau/Anthrazit
    'anthrazit': 'anthrazit',
    'anthrazitgrau': 'anthrazit',
    'ral 7016': 'anthrazit',
    'db 703': 'anthrazit',
    'grau': 'grau',
    'silbergrau': 'silbergrau',
    'betongrau': 'betongrau',
    // Holzdekor
    'golden oak': 'golden oak',
    'goldenoak': 'golden oak',
    'eiche': 'eiche',
    'nussbaum': 'nussbaum',
    'mahagoni': 'mahagoni',
    'douglasie': 'douglasie',
    'winchester': 'winchester',
    'oregon': 'oregon',
    // Sonstige
    'schwarz': 'schwarz',
    'braun': 'braun',
    'cream': 'cream',
    'creme': 'cream'
};

/**
 * Material-Klassen
 */
const MATERIALS = {
    'kunststoff': 'Kunststoff',
    'pvc': 'Kunststoff',
    'upvc': 'Kunststoff',
    'holz-alu': 'Holz-Alu',
    'holz alu': 'Holz-Alu',
    'holz/alu': 'Holz-Alu',
    'aluminium': 'Aluminium',
    'alu': 'Aluminium',
    'holz': 'Holz'
};

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Parst einen Header-Text und extrahiert Kontext
 *
 * @param {string} headerText - Header-Bezeichnung aus Textposition
 * @returns {Object} - Extrahierter Kontext
 *
 * @example
 * parseContext("WERU CASTELLO weiss/anthrazit 3-fach")
 * // Returns: {
 * //   manufacturer: 'WERU',
 * //   system: 'CASTELLO',
 * //   glazing: '3-fach',
 * //   color_inside: 'weiss',
 * //   color_outside: 'anthrazit',
 * //   material: null,
 * //   confidence: 'high'
 * // }
 */
function parseContext(headerText) {
    if (!headerText || typeof headerText !== 'string') {
        return getDefaultContext();
    }

    const text = headerText;
    const textLower = text.toLowerCase();

    // Extrahiere Hersteller + System kombiniert (bessere Erkennung)
    const { manufacturer: detectedMfr, system: detectedSys } = extractManufacturerAndSystem(textLower);

    // Fallback auf einzelne Extraktion
    const manufacturer = detectedMfr || extractManufacturer(textLower);
    const system = detectedSys || extractSystem(textLower, manufacturer);

    const glazing = extractGlazing(text);
    const colors = extractColors(text);
    const material = extractMaterial(textLower);
    const ugValue = extractUgValue(text);

    // Confidence basierend auf gefundenen Komponenten
    const confidence = calculateConfidence({
        manufacturer,
        system,
        glazing,
        colors,
        material
    });

    return {
        manufacturer: manufacturer || 'WERU', // Default: WERU
        system: system || inferSystemFromGlazing(glazing),
        glazing,
        color_inside: colors.inside,
        color_outside: colors.outside,
        material,
        ug_value: ugValue,
        confidence,
        raw_header: headerText.substring(0, 100) // Truncate
    };
}

// ============================================
// EXTRACTORS
// ============================================

/**
 * Extrahiert Hersteller
 */
function extractManufacturer(textLower) {
    for (const [key, value] of Object.entries(MANUFACTURERS)) {
        if (textLower.includes(key)) {
            return value;
        }
    }
    return null;
}

/**
 * Extrahiert System (alle Hersteller)
 */
function extractSystem(textLower, manufacturer) {
    // 1. Zuerst OTHER_SYSTEMS pruefen (spezifischer)
    for (const [key, info] of Object.entries(OTHER_SYSTEMS)) {
        if (textLower.includes(key)) {
            return info.system;
        }
    }

    // 2. WERU-Systeme wenn WERU oder kein Hersteller
    if (!manufacturer || manufacturer === 'WERU') {
        for (const [key, value] of Object.entries(WERU_SYSTEMS)) {
            if (textLower.includes(key)) {
                return value;
            }
        }
    }

    return null;
}

/**
 * Extrahiert Hersteller UND System kombiniert (fuer bessere Erkennung)
 * Nutzt OTHER_SYSTEMS um Hersteller aus System abzuleiten
 */
function extractManufacturerAndSystem(textLower) {
    // Zuerst OTHER_SYSTEMS pruefen - dort ist Hersteller implizit
    for (const [key, info] of Object.entries(OTHER_SYSTEMS)) {
        if (textLower.includes(key)) {
            return {
                manufacturer: info.manufacturer,
                system: info.system
            };
        }
    }

    // Dann explizite Hersteller
    let manufacturer = null;
    for (const [key, value] of Object.entries(MANUFACTURERS)) {
        if (textLower.includes(key)) {
            manufacturer = value;
            break;
        }
    }

    // WERU-Systeme
    let system = null;
    for (const [key, value] of Object.entries(WERU_SYSTEMS)) {
        if (textLower.includes(key)) {
            system = value;
            // Wenn System gefunden aber kein Hersteller -> WERU
            if (!manufacturer) {
                manufacturer = 'WERU';
            }
            break;
        }
    }

    return { manufacturer, system };
}

/**
 * Extrahiert Verglasung
 */
function extractGlazing(text) {
    for (const { pattern, value } of GLAZING_PATTERNS) {
        if (pattern.test(text)) {
            if (value) return value;
        }
    }
    return null;
}

/**
 * Extrahiert UG-Wert (Waermedurchgangskoeffizient)
 */
function extractUgValue(text) {
    const ugMatch = text.match(/[Uu][Gg]\s*[=:]?\s*([\d,\.]+)/);
    if (ugMatch) {
        const value = parseFloat(ugMatch[1].replace(',', '.'));
        if (value >= 0.4 && value <= 2.0) {
            return value;
        }
    }
    return null;
}

/**
 * Extrahiert Farben (innen/aussen)
 */
function extractColors(text) {
    const result = {
        inside: null,
        outside: null
    };

    // Pattern 1: innen/aussen Notation (weiss/anthrazit)
    const slashPattern = /(\w+(?:\s+\w+)?)\s*[\/\\]\s*(\w+(?:\s+\w+)?)/;
    const slashMatch = text.match(slashPattern);

    if (slashMatch) {
        const color1 = normalizeColor(slashMatch[1]);
        const color2 = normalizeColor(slashMatch[2]);

        if (color1 && color2) {
            result.inside = color1;
            result.outside = color2;
            return result;
        }
    }

    // Pattern 2: Explizit "innen/aussen"
    const insideMatch = text.match(/innen[:\s]+(\w+(?:\s+\w+)?)/i);
    const outsideMatch = text.match(/au(?:ss|ß)en[:\s]+(\w+(?:\s+\w+)?)/i);

    if (insideMatch) {
        result.inside = normalizeColor(insideMatch[1]);
    }
    if (outsideMatch) {
        result.outside = normalizeColor(outsideMatch[1]);
    }

    // Pattern 3: Einzelne Farbe (gilt fuer beide Seiten)
    if (!result.inside && !result.outside) {
        const textLower = text.toLowerCase();
        for (const [key, value] of Object.entries(COLORS)) {
            if (textLower.includes(key)) {
                result.inside = value;
                result.outside = value;
                break;
            }
        }
    }

    return result;
}

/**
 * Normalisiert einen Farb-String
 */
function normalizeColor(colorStr) {
    if (!colorStr) return null;

    const lower = colorStr.toLowerCase().trim();
    return COLORS[lower] || null;
}

/**
 * Extrahiert Material
 */
function extractMaterial(textLower) {
    for (const [key, value] of Object.entries(MATERIALS)) {
        if (textLower.includes(key)) {
            return value;
        }
    }
    return null;
}

/**
 * Inferiert System aus Verglasung (WERU-spezifisch)
 * Aus 01_SPEC.md 2.4:
 * - 3-fach -> CALIDO
 * - 2-fach -> CASTELLO
 */
function inferSystemFromGlazing(glazing) {
    if (glazing === '3-fach') return 'CALIDO';
    if (glazing === '2-fach') return 'CASTELLO';
    return null;
}

/**
 * Berechnet Confidence basierend auf gefundenen Komponenten
 */
function calculateConfidence(components) {
    let score = 0;

    if (components.manufacturer) score += 2;
    if (components.system) score += 2;
    if (components.glazing) score += 1;
    if (components.colors.inside || components.colors.outside) score += 1;
    if (components.material) score += 1;

    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
}

/**
 * Gibt Default-Kontext zurueck (WERU Standard)
 */
function getDefaultContext() {
    return {
        manufacturer: 'WERU',
        system: null,
        glazing: null,
        color_inside: null,
        color_outside: null,
        material: 'Kunststoff',
        ug_value: null,
        confidence: 'low',
        raw_header: null
    };
}

// ============================================
// CONTEXT INHERITANCE
// ============================================

/**
 * Verwaltet Kontext-Vererbung fuer eine Liste von Positionen
 *
 * Logik aus 01_SPEC.md 2.5:
 * - Header setzt Kontext
 * - Items erben bis zum naechsten Header
 *
 * @param {Object[]} positions - Array von Positionen mit { bezeichnung, _type }
 * @returns {Object[]} - Positionen mit inherited_context
 */
function applyContextInheritance(positions) {
    if (!Array.isArray(positions)) {
        return [];
    }

    let currentContext = getDefaultContext();

    return positions.map(pos => {
        // Wenn Header: Neuen Kontext setzen
        if (pos._type === 'header' || pos._is_header) {
            currentContext = parseContext(pos.Bezeichnung || pos.bezeichnung);
            return {
                ...pos,
                context: currentContext,
                context_source: 'self'
            };
        }

        // Sonst: Kontext erben
        return {
            ...pos,
            context: { ...currentContext },
            context_source: 'inherited'
        };
    });
}

/**
 * Merged mehrere Kontexte (z.B. von mehreren Headers)
 *
 * @param {Object[]} contexts - Array von Kontexten
 * @returns {Object} - Gemergter Kontext (letzter gewinnt)
 */
function mergeContexts(contexts) {
    if (!Array.isArray(contexts) || contexts.length === 0) {
        return getDefaultContext();
    }

    // Reduziere: Letzter nicht-null Wert gewinnt
    return contexts.reduce((merged, ctx) => {
        return {
            manufacturer: ctx.manufacturer || merged.manufacturer,
            system: ctx.system || merged.system,
            glazing: ctx.glazing || merged.glazing,
            color_inside: ctx.color_inside || merged.color_inside,
            color_outside: ctx.color_outside || merged.color_outside,
            material: ctx.material || merged.material,
            ug_value: ctx.ug_value || merged.ug_value,
            confidence: ctx.confidence === 'high' ? 'high' : merged.confidence,
            raw_header: ctx.raw_header || merged.raw_header
        };
    }, getDefaultContext());
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    parseContext,
    applyContextInheritance,
    mergeContexts,
    getDefaultContext,
    extractManufacturerAndSystem,
    // Fuer Tests
    _constants: {
        MANUFACTURERS,
        WERU_SYSTEMS,
        OTHER_SYSTEMS,
        COLORS,
        MATERIALS
    }
};
