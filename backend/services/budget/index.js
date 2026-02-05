/**
 * Budget Services Index
 *
 * Zentraler Export aller Budget-Services:
 * - measurementParser: Mass-Extraktion und Normalisierung
 * - contextParser: Kontext aus Header-Positionen
 * - elementClassifier: Element-Typ Erkennung
 * - priceCalculator: Preisberechnung Fenster/Zubehoer/Montage
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-005], [LOG-006]
 */

const measurementParser = require('./measurementParser');
const contextParser = require('./contextParser');
const elementClassifier = require('./elementClassifier');
const priceCalculator = require('./priceCalculator');

module.exports = {
    // Measurement Parser
    extractMeasurements: measurementParser.extractMeasurements,
    extractMeasurementsBatch: measurementParser.extractMeasurementsBatch,
    calculateArea: measurementParser.calculateArea,

    // Context Parser
    parseContext: contextParser.parseContext,
    applyContextInheritance: contextParser.applyContextInheritance,
    mergeContexts: contextParser.mergeContexts,
    getDefaultContext: contextParser.getDefaultContext,

    // Element Classifier
    classifyElement: elementClassifier.classifyElement,
    classifyElements: elementClassifier.classifyElements,
    groupByCategory: elementClassifier.groupByCategory,
    countByType: elementClassifier.countByType,
    isHeaderPosition: elementClassifier.isHeaderPosition,
    classifyPositionType: elementClassifier.classifyPositionType,

    // Price Calculator
    calculateBudget: priceCalculator.calculateBudget,
    quickCalculate: priceCalculator.quickCalculate,
    calculateWindowPrice: priceCalculator.calculateWindowPrice,
    calculateAccessoryPrice: priceCalculator.calculateAccessoryPrice,
    calculateWorkPrice: priceCalculator.calculateWorkPrice,
    calculateRange: priceCalculator.calculateRange,
    roundTo50: priceCalculator.roundTo50,
    getPriceConfig: priceCalculator.getPriceConfig,

    // Full modules (for advanced usage)
    measurementParser,
    contextParser,
    elementClassifier,
    priceCalculator
};
