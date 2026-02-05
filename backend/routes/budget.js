/**
 * Budget API Routes
 *
 * API-Endpunkte fuer Budgetangebote:
 * - Cases CRUD (Anlegen, Lesen, Aktualisieren)
 * - Items hinzufuegen
 * - Profile setzen
 * - Kalkulation ausfuehren
 * - Text parsen (fuer OCR/Notizen)
 *
 * Erstellt: 2026-02-04
 * Log-Referenz: [LOG-007]
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const budgetServices = require('../services/budget');

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validiert UUID Format
 */
function isValidUUID(str) {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Validiert Kanal
 */
const VALID_CHANNELS = ['showroom', 'telefon', 'email', 'website'];
function isValidChannel(channel) {
    return VALID_CHANNELS.includes(channel);
}

/**
 * Validiert Status
 */
const VALID_STATUSES = ['draft', 'calculated', 'sent', 'quoted', 'ordered', 'won', 'lost'];
function isValidStatus(status) {
    return VALID_STATUSES.includes(status);
}

/**
 * Validiert Masse (mm)
 */
function isValidMeasurement(value) {
    if (typeof value !== 'number') return false;
    return value >= 300 && value <= 5000;
}

/**
 * Standard-Response fuer Validierungsfehler
 */
function validationError(res, message, details = null) {
    return res.status(400).json({
        success: false,
        message: message,
        details: details
    });
}

// ============================================================================
// POST /api/budget/cases - Neuen Case anlegen
// ============================================================================

router.post('/cases', async (req, res) => {
    try {
        const {
            erp_kunden_code,
            lead_name,
            lead_telefon,
            lead_email,
            kanal,
            notes
        } = req.body;

        // Validierung: Kanal ist Pflicht
        if (!kanal) {
            return validationError(res, 'Kanal ist erforderlich');
        }
        if (!isValidChannel(kanal)) {
            return validationError(res, `Ungueltiger Kanal. Erlaubt: ${VALID_CHANNELS.join(', ')}`);
        }

        // Entweder ERP-Kunde oder Lead-Daten
        if (!erp_kunden_code && !lead_name) {
            return validationError(res, 'Entweder erp_kunden_code oder lead_name muss angegeben werden');
        }

        // Case anlegen
        const caseData = {
            erp_kunden_code: erp_kunden_code || null,
            lead_name: lead_name || null,
            lead_telefon: lead_telefon || null,
            lead_email: lead_email || null,
            kanal,
            notes: notes || null,
            status: 'draft'
        };

        const { data, error } = await supabase
            .from('budget_cases')
            .insert(caseData)
            .select('id, status, created_at')
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: data,
            message: 'Budget-Case erfolgreich angelegt'
        });

    } catch (error) {
        console.error('Fehler beim Anlegen des Budget-Cases:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Anlegen des Budget-Cases',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/budget/cases/:id/items - Items hinzufuegen
// ============================================================================

router.post('/cases/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body;

        // Validierung: Case-ID
        if (!isValidUUID(id)) {
            return validationError(res, 'Ungueltige Case-ID');
        }

        // Validierung: Items Array
        if (!Array.isArray(items) || items.length === 0) {
            return validationError(res, 'Items-Array ist erforderlich und darf nicht leer sein');
        }

        // Pruefen ob Case existiert
        const { data: caseExists, error: caseError } = await supabase
            .from('budget_cases')
            .select('id, status')
            .eq('id', id)
            .single();

        if (caseError) {
            if (caseError.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Budget-Case nicht gefunden'
                });
            }
            throw caseError;
        }

        // Items validieren und vorbereiten
        const validatedItems = [];
        const validationErrors = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const errors = [];

            // Pflichtfelder
            if (!item.element_type) {
                errors.push('element_type erforderlich');
            }
            if (!isValidMeasurement(item.width_mm)) {
                errors.push('width_mm muss zwischen 300 und 5000 mm liegen');
            }
            if (!isValidMeasurement(item.height_mm)) {
                errors.push('height_mm muss zwischen 300 und 5000 mm liegen');
            }

            if (errors.length > 0) {
                validationErrors.push({ index: i, errors });
                continue;
            }

            // Item vorbereiten
            validatedItems.push({
                budget_case_id: id,
                room: item.room || null,
                element_type: item.element_type,
                width_mm: item.width_mm,
                height_mm: item.height_mm,
                qty: item.qty || 1,
                notes: item.notes || null,
                confidence: item.confidence || 'medium'
            });
        }

        if (validationErrors.length > 0) {
            return validationError(res, 'Validierungsfehler bei Items', validationErrors);
        }

        // Items einfuegen
        const { data: insertedItems, error: insertError } = await supabase
            .from('budget_items')
            .insert(validatedItems)
            .select('id, element_type, width_mm, height_mm, qty');

        if (insertError) throw insertError;

        // Accessories separat einfuegen (falls vorhanden)
        const accessoriesToInsert = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.accessories && insertedItems[i]) {
                const acc = item.accessories;
                accessoriesToInsert.push({
                    budget_item_id: insertedItems[i].id,
                    shutter: acc.shutter || false,
                    shutter_type: acc.shutter_type || null,
                    shutter_electric: acc.shutter_electric || false,
                    motor_qty: acc.shutter_electric ? 1 : 0,
                    afb: acc.afb || false,
                    ifb: acc.ifb || false,
                    insect: acc.insect || false,
                    plissee: acc.plissee || false
                });
            }
        }

        if (accessoriesToInsert.length > 0) {
            const { error: accError } = await supabase
                .from('budget_accessories')
                .insert(accessoriesToInsert);

            if (accError) {
                console.error('Fehler beim Einfuegen der Accessories:', accError);
                // Nicht abbrechen, Items sind bereits eingefuegt
            }
        }

        res.status(201).json({
            success: true,
            data: {
                items: insertedItems,
                accessories_count: accessoriesToInsert.length
            },
            message: `${insertedItems.length} Item(s) erfolgreich hinzugefuegt`
        });

    } catch (error) {
        console.error('Fehler beim Hinzufuegen der Items:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Hinzufuegen der Items',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/budget/cases/:id/profile - Profil setzen
// ============================================================================

router.post('/cases/:id/profile', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            manufacturer = 'WERU',
            system,
            glazing,
            color_inside,
            color_outside
        } = req.body;

        // Validierung: Case-ID
        if (!isValidUUID(id)) {
            return validationError(res, 'Ungueltige Case-ID');
        }

        // Pruefen ob Case existiert
        const { data: caseExists, error: caseError } = await supabase
            .from('budget_cases')
            .select('id')
            .eq('id', id)
            .single();

        if (caseError) {
            if (caseError.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Budget-Case nicht gefunden'
                });
            }
            throw caseError;
        }

        // System automatisch setzen wenn nicht angegeben
        let effectiveSystem = system;
        if (!effectiveSystem && glazing) {
            // Regel aus 01_SPEC: 3-fach -> CALIDO, 2-fach -> CASTELLO
            if (glazing === '3-fach') {
                effectiveSystem = 'CALIDO';
            } else if (glazing === '2-fach') {
                effectiveSystem = 'CASTELLO';
            }
        }

        // Profil-Daten vorbereiten
        const profileData = {
            budget_case_id: id,
            manufacturer: manufacturer || 'WERU',
            system: effectiveSystem || null,
            glazing: glazing || null,
            color_inside: color_inside || null,
            color_outside: color_outside || null,
            inferred: !system,  // true wenn System automatisch gesetzt wurde
            manual_override: !!system
        };

        // Upsert (Insert oder Update)
        const { data, error } = await supabase
            .from('budget_profile')
            .upsert(profileData, { onConflict: 'budget_case_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            message: 'Profil erfolgreich gesetzt'
        });

    } catch (error) {
        console.error('Fehler beim Setzen des Profils:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Setzen des Profils',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/budget/cases/:id/calculate - Kalkulation ausfuehren
// ============================================================================

router.post('/cases/:id/calculate', async (req, res) => {
    try {
        const { id } = req.params;
        const { workConfig } = req.body;

        // Validierung: Case-ID
        if (!isValidUUID(id)) {
            return validationError(res, 'Ungueltige Case-ID');
        }

        // Case mit Items und Profile laden
        const { data: caseData, error: caseError } = await supabase
            .from('budget_cases')
            .select(`
                id,
                status,
                budget_items (
                    id,
                    element_type,
                    width_mm,
                    height_mm,
                    qty,
                    confidence,
                    budget_accessories (*)
                ),
                budget_profile (*)
            `)
            .eq('id', id)
            .single();

        if (caseError) {
            if (caseError.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Budget-Case nicht gefunden'
                });
            }
            throw caseError;
        }

        // Pruefen ob Items vorhanden sind
        if (!caseData.budget_items || caseData.budget_items.length === 0) {
            return validationError(res, 'Keine Items im Budget-Case vorhanden');
        }

        // Items fuer Kalkulation vorbereiten
        const items = caseData.budget_items.map(item => ({
            id: item.id,
            element_type: item.element_type,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            qty: item.qty || 1,
            confidence: item.confidence || 'medium',
            accessories: item.budget_accessories && item.budget_accessories.length > 0
                ? item.budget_accessories[0]
                : null
        }));

        // Profile extrahieren
        const profile = caseData.budget_profile && caseData.budget_profile.length > 0
            ? caseData.budget_profile[0]
            : {};

        // Kalkulation durchfuehren
        const budgetCase = {
            items,
            profile: {
                system: profile.system,
                manufacturer: profile.manufacturer,
                color_inside: profile.color_inside,
                color_outside: profile.color_outside
            },
            workConfig: workConfig || { montage: true, demontage: true, entsorgung: 'element' }
        };

        const result = budgetServices.calculateBudget(budgetCase);

        // Ergebnis in budget_results speichern
        const resultData = {
            budget_case_id: id,
            net_total: result.net_total,
            vat_rate: result.vat_rate,
            gross_total: result.gross_total,
            gross_rounded_50: result.gross_rounded_50,
            range_low: result.range_low,
            range_high: result.range_high,
            assumptions_json: result.assumptions_json,
            model_version: result.model_version
        };

        const { data: savedResult, error: resultError } = await supabase
            .from('budget_results')
            .insert(resultData)
            .select()
            .single();

        if (resultError) throw resultError;

        // Case-Status auf 'calculated' setzen
        const { error: updateError } = await supabase
            .from('budget_cases')
            .update({ status: 'calculated', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (updateError) {
            console.error('Fehler beim Aktualisieren des Status:', updateError);
        }

        res.json({
            success: true,
            data: {
                result_id: savedResult.id,
                ...result
            },
            message: 'Kalkulation erfolgreich durchgefuehrt'
        });

    } catch (error) {
        console.error('Fehler bei der Kalkulation:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler bei der Kalkulation',
            error: error.message
        });
    }
});

// ============================================================================
// GET /api/budget/cases/:id - Case mit allen Details abrufen
// ============================================================================

router.get('/cases/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validierung: Case-ID
        if (!isValidUUID(id)) {
            return validationError(res, 'Ungueltige Case-ID');
        }

        // Case mit allen Relationen laden (ohne erp_kunden - kein FK)
        const { data, error } = await supabase
            .from('budget_cases')
            .select(`
                *,
                budget_inputs (*),
                budget_profile (*),
                budget_items (
                    *,
                    budget_accessories (*)
                ),
                budget_results (*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Budget-Case nicht gefunden'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Fehler beim Abrufen des Budget-Cases:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen des Budget-Cases',
            error: error.message
        });
    }
});

// ============================================================================
// GET /api/budget/cases - Liste aller Cases (mit Filter)
// ============================================================================

router.get('/cases', async (req, res) => {
    try {
        const { status, assigned_to, kanal, limit = 100, offset = 0 } = req.query;

        // Query aufbauen (ohne erp_kunden Join - kein FK vorhanden)
        let query = supabase
            .from('budget_cases')
            .select(`
                id,
                created_at,
                updated_at,
                erp_kunden_code,
                lead_name,
                lead_telefon,
                lead_email,
                kanal,
                status,
                assigned_to,
                notes
            `, { count: 'exact' });

        // Filter anwenden
        if (status) {
            if (!isValidStatus(status)) {
                return validationError(res, `Ungueltiger Status. Erlaubt: ${VALID_STATUSES.join(', ')}`);
            }
            query = query.eq('status', status);
        }

        if (assigned_to) {
            if (!isValidUUID(assigned_to)) {
                return validationError(res, 'Ungueltige assigned_to UUID');
            }
            query = query.eq('assigned_to', assigned_to);
        }

        if (kanal) {
            if (!isValidChannel(kanal)) {
                return validationError(res, `Ungueltiger Kanal. Erlaubt: ${VALID_CHANNELS.join(', ')}`);
            }
            query = query.eq('kanal', kanal);
        }

        // Sortierung und Pagination
        query = query
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length,
            total: count,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + data.length) < count
            }
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Budget-Cases:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Budget-Cases',
            error: error.message
        });
    }
});

// ============================================================================
// PATCH /api/budget/cases/:id - Case aktualisieren (Status, Notes)
// ============================================================================

router.patch('/cases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, assigned_to } = req.body;

        // Validierung: Case-ID
        if (!isValidUUID(id)) {
            return validationError(res, 'Ungueltige Case-ID');
        }

        // Mindestens ein Feld muss aktualisiert werden
        if (!status && notes === undefined && !assigned_to) {
            return validationError(res, 'Mindestens ein Feld (status, notes, assigned_to) muss angegeben werden');
        }

        // Update-Daten vorbereiten
        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (status) {
            if (!isValidStatus(status)) {
                return validationError(res, `Ungueltiger Status. Erlaubt: ${VALID_STATUSES.join(', ')}`);
            }
            updateData.status = status;
        }

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        if (assigned_to) {
            if (!isValidUUID(assigned_to)) {
                return validationError(res, 'Ungueltige assigned_to UUID');
            }
            updateData.assigned_to = assigned_to;
        }

        // Update durchfuehren
        const { data, error } = await supabase
            .from('budget_cases')
            .update(updateData)
            .eq('id', id)
            .select('id, status, notes, assigned_to, updated_at')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Budget-Case nicht gefunden'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data,
            message: 'Budget-Case erfolgreich aktualisiert'
        });

    } catch (error) {
        console.error('Fehler beim Aktualisieren des Budget-Cases:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Aktualisieren des Budget-Cases',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/budget/parse - Text parsen (fuer OCR/Notizen)
// ============================================================================

router.post('/parse', async (req, res) => {
    try {
        const { raw_text, source_type = 'kundennotiz' } = req.body;

        // Validierung
        if (!raw_text || typeof raw_text !== 'string') {
            return validationError(res, 'raw_text ist erforderlich');
        }

        if (raw_text.trim().length === 0) {
            return validationError(res, 'raw_text darf nicht leer sein');
        }

        // Text zeilenweise verarbeiten
        const lines = raw_text.split('\n').filter(line => line.trim().length > 0);
        const parsedItems = [];
        let currentContext = budgetServices.getDefaultContext();
        const allAssumptions = [];

        for (const line of lines) {
            // Header-Position erkennen
            const isHeader = budgetServices.isHeaderPosition({
                bezeichnung: line,
                anzahl: 0,
                einzPreis: 0
            });

            if (isHeader) {
                // Kontext aus Header extrahieren
                const headerContext = budgetServices.parseContext(line);
                currentContext = budgetServices.mergeContexts(currentContext, headerContext);
                allAssumptions.push(`Header erkannt: "${line.substring(0, 50)}..."`);
                continue;
            }

            // Masse extrahieren
            const measurements = budgetServices.extractMeasurements(line);

            if (measurements.length > 0) {
                // Element klassifizieren
                const classification = budgetServices.classifyElement(line);

                for (const measurement of measurements) {
                    parsedItems.push({
                        raw_line: line,
                        element_type: classification.element_type || 'fenster',
                        width_mm: measurement.width,
                        height_mm: measurement.height,
                        qty: measurement.qty || 1,
                        confidence: measurement.confidence,
                        context: { ...currentContext },
                        opening_type: classification.opening_type
                    });
                }
            }
        }

        // Kontext-Vererbung anwenden
        const itemsWithContext = budgetServices.applyContextInheritance(
            parsedItems.map((item, index) => ({
                ...item,
                position: index + 1
            }))
        );

        // Profil aus Gesamtkontext ableiten
        const inferredProfile = {
            manufacturer: currentContext.manufacturer || 'WERU',
            system: currentContext.system,
            glazing: currentContext.glazing,
            color_inside: currentContext.color_inside,
            color_outside: currentContext.color_outside
        };

        // Gesamt-Confidence ermitteln
        let overallConfidence = 'high';
        for (const item of parsedItems) {
            if (item.confidence === 'low') {
                overallConfidence = 'low';
                break;
            }
            if (item.confidence === 'medium' && overallConfidence === 'high') {
                overallConfidence = 'medium';
            }
        }

        res.json({
            success: true,
            data: {
                items: itemsWithContext,
                profile: inferredProfile,
                parsing: {
                    lines_processed: lines.length,
                    items_found: parsedItems.length,
                    confidence: overallConfidence,
                    source_type
                },
                assumptions: allAssumptions
            },
            message: `${parsedItems.length} Element(e) aus ${lines.length} Zeilen extrahiert`
        });

    } catch (error) {
        console.error('Fehler beim Parsen des Textes:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Parsen des Textes',
            error: error.message
        });
    }
});

// ============================================================================
// GET /api/budget/config - Preiskonfiguration abrufen (fuer UI)
// ============================================================================

router.get('/config', async (req, res) => {
    try {
        const config = budgetServices.getPriceConfig();

        res.json({
            success: true,
            data: {
                ...config,
                valid_channels: VALID_CHANNELS,
                valid_statuses: VALID_STATUSES
            }
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Konfiguration:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Konfiguration',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/budget/quick-calculate - Schnell-Kalkulation (ohne Case)
// ============================================================================

router.post('/quick-calculate', async (req, res) => {
    try {
        const params = req.body;

        // Grundlegende Validierung
        if (!params.width_mm || !params.height_mm) {
            return validationError(res, 'width_mm und height_mm sind erforderlich');
        }

        if (!isValidMeasurement(params.width_mm) || !isValidMeasurement(params.height_mm)) {
            return validationError(res, 'Masse muessen zwischen 300 und 5000 mm liegen');
        }

        const result = budgetServices.quickCalculate(params);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Fehler bei der Schnell-Kalkulation:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler bei der Schnell-Kalkulation',
            error: error.message
        });
    }
});

module.exports = router;
