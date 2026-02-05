/**
 * Measurement Parser Service
 *
 * Extrahiert Masse aus Texten (Positionen, Aufmassblatt, Kundennotiz).
 * Normalisiert alle Masse nach mm.
 *
 * Unterstuetzte Patterns (aus 04_LEARNINGS.md L11):
 * 1. 1230x1480     -> mm (Standard, 4-stellig)
 * 2. 123x148       -> cm (2-3 stellig) -> x10 nach mm
 * 3. 1,23x1,48     -> m (Komma) -> x1000 nach mm
 * 4. B=1230 H=1480 -> explizit mm
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-005]
 */

// ============================================
// REGEX PATTERNS (parameterized for security)
// ============================================

/**
 * Pattern 1: mm (Standard)
 * Matches: 1230x1480, 1230 x 1480, 1230*1480
 * Kriterium: 4-stellige Zahlen
 */
const PATTERN_MM = /(\d{4})\s*[xX*]\s*(\d{4})/;

/**
 * Pattern 2: cm
 * Matches: 123x148, 123 x 148, 90x120
 * Kriterium: 2-3 stellige Zahlen (keine Kommas)
 */
const PATTERN_CM = /(?<!\d)(\d{2,3})\s*[xX*]\s*(\d{2,3})(?!\d)/;

/**
 * Pattern 3: m (mit Komma)
 * Matches: 1,23x1,48, 1,23 x 1,48, 0,90x1,20
 * Kriterium: Komma als Dezimaltrenner
 */
const PATTERN_M = /(\d+,\d+)\s*[xX*]\s*(\d+,\d+)/;

/**
 * Pattern 4: Explizit (B= H=)
 * Matches: B=1230 H=1480, Breite=1230 Hoehe=1480, B:1230 H:1480
 */
const PATTERN_EXPLICIT = /[Bb](?:reite)?[=:]\s*(\d+)\s*(?:mm)?\s*[Hh](?:oehe)?[=:]\s*(\d+)\s*(?:mm)?/;

/**
 * Pattern 5: Explizit (nur eine Dimension, z.B. "Breite 1230mm")
 * Wird separat behandelt wenn nur B oder H angegeben
 */
const PATTERN_SINGLE_B = /[Bb](?:reite)?[=:\s]+(\d+)\s*(?:mm)?/;
const PATTERN_SINGLE_H = /[Hh](?:oehe)?[=:\s]+(\d+)\s*(?:mm)?/;

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Extrahiert Masse aus einem Text
 *
 * @param {string} text - Der zu parsende Text (Bezeichnung, Notiz, etc.)
 * @param {Object} options - Optionale Konfiguration
 * @param {string} options.elementType - Element-Typ fuer B/H Heuristik (fenster, tuer, hst)
 * @returns {Object|null} - Extrahierte Masse oder null wenn nicht gefunden
 *
 * @example
 * extractMeasurements("Fenster DK 1230x1480 mm")
 * // Returns: { width_mm: 1230, height_mm: 1480, source_unit: 'mm', confidence: 'high', raw_match: '1230x1480' }
 */
function extractMeasurements(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const { elementType = 'fenster' } = options;

    // Versuche Patterns in Reihenfolge der Praezision
    let result = null;

    // 1. Explizit (hoechste Praezision)
    result = tryExplicitPattern(text);
    if (result) {
        return applyBHHeuristic(result, elementType);
    }

    // 2. mm Pattern (4-stellig)
    result = tryMmPattern(text);
    if (result) {
        return applyBHHeuristic(result, elementType);
    }

    // 3. m Pattern (Komma)
    result = tryMeterPattern(text);
    if (result) {
        return applyBHHeuristic(result, elementType);
    }

    // 4. cm Pattern (2-3 stellig) - als letztes, da am wenigsten praezise
    result = tryCmPattern(text);
    if (result) {
        return applyBHHeuristic(result, elementType);
    }

    return null;
}

// ============================================
// PATTERN MATCHERS
// ============================================

/**
 * Pattern 4: Explizit B= H=
 */
function tryExplicitPattern(text) {
    const match = text.match(PATTERN_EXPLICIT);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10),
            height_mm: parseInt(match[2], 10),
            source_unit: 'explicit',
            confidence: 'high',
            raw_match: match[0]
        };
    }

    // Versuche einzelne B/H Angaben
    const matchB = text.match(PATTERN_SINGLE_B);
    const matchH = text.match(PATTERN_SINGLE_H);

    if (matchB && matchH) {
        return {
            width_mm: parseInt(matchB[1], 10),
            height_mm: parseInt(matchH[1], 10),
            source_unit: 'explicit',
            confidence: 'medium', // Einzeln angegeben, weniger sicher
            raw_match: `${matchB[0]} ${matchH[0]}`
        };
    }

    return null;
}

/**
 * Pattern 1: mm (4-stellig)
 */
function tryMmPattern(text) {
    const match = text.match(PATTERN_MM);
    if (match) {
        return {
            width_mm: parseInt(match[1], 10),
            height_mm: parseInt(match[2], 10),
            source_unit: 'mm',
            confidence: 'high',
            raw_match: match[0]
        };
    }
    return null;
}

/**
 * Pattern 2: cm (2-3 stellig)
 */
function tryCmPattern(text) {
    const match = text.match(PATTERN_CM);
    if (match) {
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);

        // Sanity check: cm-Werte sollten realistisch sein (30-300 cm)
        if (width < 30 || width > 300 || height < 30 || height > 300) {
            return null;
        }

        return {
            width_mm: width * 10,
            height_mm: height * 10,
            source_unit: 'cm',
            confidence: 'medium', // cm ist weniger eindeutig
            raw_match: match[0]
        };
    }
    return null;
}

/**
 * Pattern 3: m (Komma als Dezimaltrenner)
 */
function tryMeterPattern(text) {
    const match = text.match(PATTERN_M);
    if (match) {
        // Deutsche Notation: Komma -> Punkt
        const widthM = parseFloat(match[1].replace(',', '.'));
        const heightM = parseFloat(match[2].replace(',', '.'));

        // Sanity check: Meter-Werte sollten realistisch sein (0.3-3.0 m)
        if (widthM < 0.3 || widthM > 3.5 || heightM < 0.3 || heightM > 3.5) {
            return null;
        }

        return {
            width_mm: Math.round(widthM * 1000),
            height_mm: Math.round(heightM * 1000),
            source_unit: 'm',
            confidence: 'medium',
            raw_match: match[0]
        };
    }
    return null;
}

// ============================================
// B/H HEURISTIC
// ============================================

/**
 * Wendet B/H Heuristik an basierend auf Element-Typ
 *
 * Regeln aus 01_SPEC.md 2.3:
 * - Fenster: B < H (normal)
 * - Tueren: B < H, aber H > 2000mm typisch
 * - HST: B > H moeglich
 *
 * @param {Object} measurement - Extrahierte Masse
 * @param {string} elementType - Element-Typ
 * @returns {Object} - Masse mit ggf. korrigierter Orientierung
 */
function applyBHHeuristic(measurement, elementType) {
    const { width_mm, height_mm, source_unit, raw_match } = measurement;
    let { confidence } = measurement;

    // Keine Korrektur noetig wenn explizit angegeben
    if (source_unit === 'explicit') {
        return measurement;
    }

    let finalWidth = width_mm;
    let finalHeight = height_mm;
    let swapped = false;

    switch (elementType.toLowerCase()) {
        case 'fenster':
        case 'window':
            // Standard: B < H
            // Typische Fensterhoehe: 800-1800mm
            // Typische Fensterbreite: 500-1500mm
            if (width_mm > height_mm) {
                // Wahrscheinlich vertauscht
                finalWidth = height_mm;
                finalHeight = width_mm;
                swapped = true;
                confidence = downgradeConfidence(confidence);
            }
            break;

        case 'tuer':
        case 'door':
        case 'balkontuer':
        case 'balkon':
        case 'terrassentuer':
            // Tueren: B < H, H typisch > 2000mm
            if (width_mm > height_mm) {
                finalWidth = height_mm;
                finalHeight = width_mm;
                swapped = true;
                confidence = downgradeConfidence(confidence);
            }
            // Extra-Check: Tuerhoehe sollte > 1800mm sein
            if (finalHeight < 1800) {
                confidence = downgradeConfidence(confidence);
            }
            break;

        case 'hst':
        case 'hebe-schiebe':
        case 'hebeschiebeanlage':
            // HST: B > H ist moeglich (Panorama-Fenster)
            // Keine automatische Vertauschung, aber Confidence anpassen
            if (width_mm < height_mm && width_mm > 1500) {
                // Breites Element, aber H > B -> evtl. ok, aber unsicher
                confidence = downgradeConfidence(confidence);
            }
            // Bei HST keine Vertauschung, da beide Orientierungen moeglich
            break;

        case 'psk':
        case 'parallel-schiebe-kipp':
            // PSK: Aehnlich wie Tuer, B < H
            if (width_mm > height_mm) {
                finalWidth = height_mm;
                finalHeight = width_mm;
                swapped = true;
                confidence = downgradeConfidence(confidence);
            }
            break;

        default:
            // Unbekannter Typ: Standard-Heuristik (B < H)
            if (width_mm > height_mm && width_mm > 1500) {
                // Grosse Breite, evtl. vertauscht
                finalWidth = height_mm;
                finalHeight = width_mm;
                swapped = true;
                confidence = 'low';
            }
    }

    // Sanity Checks
    const sanityResult = performSanityChecks(finalWidth, finalHeight, elementType);
    if (!sanityResult.valid) {
        confidence = 'low';
    }

    return {
        width_mm: finalWidth,
        height_mm: finalHeight,
        source_unit,
        confidence,
        raw_match,
        ...(swapped && { bh_swapped: true }),
        ...(sanityResult.warnings.length > 0 && { warnings: sanityResult.warnings })
    };
}

/**
 * Downgrade confidence level
 */
function downgradeConfidence(current) {
    if (current === 'high') return 'medium';
    if (current === 'medium') return 'low';
    return 'low';
}

/**
 * Sanity checks fuer Masse
 */
function performSanityChecks(width, height, elementType) {
    const warnings = [];

    // Minimale Masse
    if (width < 300 || height < 300) {
        warnings.push('Masse unter 300mm - ungewoehnlich klein');
    }

    // Maximale Masse
    if (width > 3500 || height > 3500) {
        warnings.push('Masse ueber 3500mm - ungewoehnlich gross');
    }

    // Typ-spezifische Checks
    if (elementType === 'tuer' || elementType === 'door') {
        if (height < 1800) {
            warnings.push('Tuerhoehe unter 1800mm - ungewoehnlich');
        }
        if (width > 1200) {
            warnings.push('Tuerbreite ueber 1200mm - pruefen');
        }
    }

    if (elementType === 'hst' || elementType === 'hebe-schiebe') {
        if (width < 1500) {
            warnings.push('HST-Breite unter 1500mm - ungewoehnlich');
        }
    }

    return {
        valid: warnings.length < 2, // Max 1 Warning ist OK
        warnings
    };
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Extrahiert Masse aus mehreren Texten
 *
 * @param {string[]} texts - Array von Texten
 * @param {Object} options - Optionen fuer alle
 * @returns {Object[]} - Array von Ergebnissen
 */
function extractMeasurementsBatch(texts, options = {}) {
    if (!Array.isArray(texts)) {
        return [];
    }

    return texts.map((text, index) => {
        const result = extractMeasurements(text, options);
        return {
            index,
            text: text ? text.substring(0, 100) : '', // Truncate fuer Log
            measurement: result
        };
    });
}

/**
 * Berechnet Flaeche in m2
 *
 * @param {Object} measurement - Extrahiertes Measurement-Objekt
 * @returns {number|null} - Flaeche in m2 oder null
 */
function calculateArea(measurement) {
    if (!measurement || !measurement.width_mm || !measurement.height_mm) {
        return null;
    }

    const widthM = measurement.width_mm / 1000;
    const heightM = measurement.height_mm / 1000;

    return Math.round(widthM * heightM * 100) / 100; // Auf 2 Dezimalstellen
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    extractMeasurements,
    extractMeasurementsBatch,
    calculateArea,
    // Fuer Tests: Pattern exportieren
    _patterns: {
        PATTERN_MM,
        PATTERN_CM,
        PATTERN_M,
        PATTERN_EXPLICIT
    }
};
