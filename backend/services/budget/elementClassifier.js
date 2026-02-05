/**
 * Element Classifier Service
 *
 * Klassifiziert Bezeichnungen in Element-Typen:
 * - fenster, tuer, hst, psk
 * - rollladen, raffstore, motor
 * - afb, ifb, insektenschutz, plissee
 * - montage, demontage, entsorgung
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-005]
 */

// ============================================
// CLASSIFICATION RULES
// ============================================

/**
 * Element-Typen mit Keywords und Prioritaet
 * Hoehere Prioritaet = wird zuerst geprueft
 */
const ELEMENT_TYPES = {
    // Hauptelemente (hoechste Prioritaet)
    'hst': {
        keywords: ['hst', 'hebe-schiebe', 'hebeschiebeanlage', 'hebe schiebe'],
        category: 'element',
        priority: 10
    },
    'psk': {
        keywords: ['psk', 'parallel-schiebe-kipp', 'parallelschiebekipp'],
        category: 'element',
        priority: 10
    },
    'haustuer': {
        keywords: ['haustuer', 'haustür', 'hauseingang', 'eingangstuer', 'eingangstür'],
        category: 'element',
        priority: 9
    },
    'tuer': {
        keywords: ['tuer', 'tür', 'balkontuer', 'balkontür', 'terrassentuer', 'terrassentür', 'nebeneingangstuer'],
        category: 'element',
        priority: 8
    },
    'fenster': {
        keywords: ['fenster', 'fester rahmen', 'festfeld', 'festverglasung', 'fix'],
        category: 'element',
        priority: 7
    },

    // Sonnenschutz
    'rollladen': {
        keywords: ['rollladen', 'rolladen', 'rollo', 'vorbaurollladen'],
        category: 'accessory',
        priority: 6
    },
    'raffstore': {
        keywords: ['raffstore', 'raffstoren', 'raff store', 'jalousie', 'aussenjalousie'],
        category: 'accessory',
        priority: 6
    },
    'motor': {
        keywords: ['motor', 'antrieb', 'elektrisch', 'e-motor', 'elektro'],
        category: 'accessory',
        priority: 5
    },

    // Fensterbaenke
    'afb': {
        keywords: ['afb', 'aussenfensterbank', 'außenfensterbank', 'aussen fensterbank', 'außen fensterbank', 'alu-fensterbank aussen'],
        category: 'accessory',
        priority: 4
    },
    'ifb': {
        keywords: ['ifb', 'innenfensterbank', 'innen fensterbank', 'innenfb'],
        category: 'accessory',
        priority: 4
    },
    'fensterbank': {
        keywords: ['fensterbank'],
        category: 'accessory',
        priority: 3
    },

    // Insektenschutz / Plissee
    'insektenschutz': {
        keywords: ['insektenschutz', 'fliegengitter', 'mueckenschutz', 'mückenschutz', 'insekt'],
        category: 'accessory',
        priority: 3
    },
    'plissee': {
        keywords: ['plissee', 'faltenstore'],
        category: 'accessory',
        priority: 3
    },

    // Montage-Block
    'montage': {
        keywords: ['montage', 'einbau'],
        category: 'work',
        priority: 2
    },
    'demontage': {
        keywords: ['demontage', 'ausbau'],
        category: 'work',
        priority: 2
    },
    'entsorgung': {
        keywords: ['entsorgung', 'abtransport', 'abfuhr'],
        category: 'work',
        priority: 2
    }
};

/**
 * Oeffnungsarten fuer Fenster/Tueren
 */
const OPENING_TYPES = {
    'dreh-kipp': ['dk', 'dreh-kipp', 'drehkipp', 'd/k'],
    'dreh': ['dreh', 'dr', 'drehfluegel'],
    'kipp': ['kipp', 'ki', 'kippoberhalb'],
    'fix': ['fix', 'fest', 'festverglasung', 'fester rahmen'],
    'schwingfluegel': ['schwing', 'schwingfluegel'],
    'schiebe': ['schiebe', 'gleiter']
};

/**
 * Negative Keywords (schliessen Typ aus)
 */
const NEGATIVE_KEYWORDS = {
    'fenster': ['tuer', 'tür', 'hst', 'psk'], // Kein Fenster wenn "Tuer" drin
    'tuer': ['fenster'],
    'rollladen': ['raffstore'],
    'raffstore': ['rollladen']
};

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Klassifiziert eine Bezeichnung
 *
 * @param {string} bezeichnung - Text aus Position
 * @returns {Object} - Klassifikation
 *
 * @example
 * classifyElement("Fenster DK 1230x1480 mm weiss")
 * // Returns: {
 * //   element_type: 'fenster',
 * //   category: 'element',
 * //   opening_type: 'dreh-kipp',
 * //   confidence: 'high',
 * //   raw_designation: 'Fenster DK 1230x1480 mm weiss'
 * // }
 */
function classifyElement(bezeichnung) {
    if (!bezeichnung || typeof bezeichnung !== 'string') {
        return {
            element_type: 'unknown',
            category: 'unknown',
            opening_type: null,
            confidence: 'low',
            raw_designation: bezeichnung
        };
    }

    const textLower = bezeichnung.toLowerCase();

    // Finde alle passenden Typen
    const matches = [];

    for (const [type, config] of Object.entries(ELEMENT_TYPES)) {
        const hasKeyword = config.keywords.some(kw => textLower.includes(kw));

        if (hasKeyword) {
            // Pruefe negative Keywords
            const negatives = NEGATIVE_KEYWORDS[type] || [];
            const hasNegative = negatives.some(neg => textLower.includes(neg));

            if (!hasNegative) {
                matches.push({
                    type,
                    category: config.category,
                    priority: config.priority
                });
            }
        }
    }

    // Sortiere nach Prioritaet (hoechste zuerst)
    matches.sort((a, b) => b.priority - a.priority);

    // Kein Match gefunden
    if (matches.length === 0) {
        return {
            element_type: 'unknown',
            category: 'unknown',
            opening_type: null,
            confidence: 'low',
            raw_designation: bezeichnung.substring(0, 100)
        };
    }

    // Bester Match
    const bestMatch = matches[0];

    // Oeffnungsart extrahieren (nur fuer Elemente)
    const openingType = bestMatch.category === 'element'
        ? extractOpeningType(textLower)
        : null;

    // Confidence berechnen
    const confidence = calculateClassificationConfidence(matches, bezeichnung);

    return {
        element_type: bestMatch.type,
        category: bestMatch.category,
        opening_type: openingType,
        confidence,
        raw_designation: bezeichnung.substring(0, 100),
        ...(matches.length > 1 && { alternative_types: matches.slice(1).map(m => m.type) })
    };
}

/**
 * Extrahiert Oeffnungsart
 */
function extractOpeningType(textLower) {
    for (const [type, keywords] of Object.entries(OPENING_TYPES)) {
        if (keywords.some(kw => textLower.includes(kw))) {
            return type;
        }
    }
    return null;
}

/**
 * Berechnet Confidence fuer Klassifikation
 */
function calculateClassificationConfidence(matches, bezeichnung) {
    // Mehrere Matches = weniger sicher
    if (matches.length > 2) return 'low';

    // Kurze Bezeichnung = weniger sicher
    if (bezeichnung.length < 10) return 'medium';

    // Nur ein klarer Match
    if (matches.length === 1 && matches[0].priority >= 7) {
        return 'high';
    }

    return 'medium';
}

// ============================================
// BATCH CLASSIFICATION
// ============================================

/**
 * Klassifiziert eine Liste von Bezeichnungen
 *
 * @param {string[]|Object[]} items - Array von Strings oder Objekten mit bezeichnung
 * @returns {Object[]} - Array mit Klassifikationen
 */
function classifyElements(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map((item, index) => {
        const bezeichnung = typeof item === 'string' ? item : item.Bezeichnung || item.bezeichnung;
        const classification = classifyElement(bezeichnung);

        return {
            index,
            ...(typeof item === 'object' && item),
            classification
        };
    });
}

/**
 * Gruppiert Elemente nach Kategorie
 *
 * @param {Object[]} classifiedItems - Klassifizierte Items
 * @returns {Object} - Gruppiert nach category
 */
function groupByCategory(classifiedItems) {
    const groups = {
        element: [],
        accessory: [],
        work: [],
        unknown: []
    };

    classifiedItems.forEach(item => {
        const category = item.classification?.category || 'unknown';
        if (groups[category]) {
            groups[category].push(item);
        } else {
            groups.unknown.push(item);
        }
    });

    return groups;
}

/**
 * Zaehlt Elemente nach Typ
 *
 * @param {Object[]} classifiedItems - Klassifizierte Items
 * @returns {Object} - Anzahl pro Typ
 */
function countByType(classifiedItems) {
    const counts = {};

    classifiedItems.forEach(item => {
        const type = item.classification?.element_type || 'unknown';
        counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
}

// ============================================
// HEADER DETECTION
// ============================================

/**
 * Prueft ob eine Position ein Header ist (Textposition)
 *
 * Kriterien aus 04_LEARNINGS.md L5:
 * - Anzahl = 0 ODER NULL
 * - EinzPreis = 0 ODER NULL
 * - Enthaelt Header-Keywords
 *
 * @param {Object} position - Position mit Anzahl, EinzPreis, Bezeichnung
 * @returns {boolean}
 */
function isHeaderPosition(position) {
    if (!position) return false;

    // Anzahl und Preis pruefen
    const hasZeroQuantity = !position.Anzahl || position.Anzahl === 0;
    const hasZeroPrice = !position.EinzPreis || position.EinzPreis === 0;

    if (!hasZeroQuantity || !hasZeroPrice) {
        return false;
    }

    // Header-Keywords pruefen
    const bezeichnung = (position.Bezeichnung || position.bezeichnung || '').toLowerCase();
    const headerKeywords = [
        'weru', 'castello', 'calido', 'impreo', 'afino',
        'weiss', 'anthrazit', 'golden oak',
        '2-fach', '3-fach', '2fach', '3fach',
        'kunststoff', 'aluminium', 'holz-alu'
    ];

    return headerKeywords.some(kw => bezeichnung.includes(kw));
}

/**
 * Klassifiziert Position als header, item, accessory, work, unknown
 *
 * @param {Object} position - Position aus dbo.Positionen
 * @returns {'header'|'item'|'accessory'|'work'|'unknown'}
 */
function classifyPositionType(position) {
    // Header-Check zuerst
    if (isHeaderPosition(position)) {
        return 'header';
    }

    // Element-Klassifikation
    const classification = classifyElement(position.Bezeichnung || position.bezeichnung);

    switch (classification.category) {
        case 'element':
            return 'item';
        case 'accessory':
            return 'accessory';
        case 'work':
            return 'work';
        default:
            return 'unknown';
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    classifyElement,
    classifyElements,
    groupByCategory,
    countByType,
    isHeaderPosition,
    classifyPositionType,
    // Fuer Tests
    _constants: {
        ELEMENT_TYPES,
        OPENING_TYPES,
        NEGATIVE_KEYWORDS
    }
};
