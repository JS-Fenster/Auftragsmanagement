const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');

// GET alle Kunden
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_kunden')
            .select('code, firma1, firma2, name, strasse, plz, ort, telefon, mobil, email')
            .order('code', { ascending: false })
            .limit(1000);

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Kunden:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Kunden',
            error: error.message
        });
    }
});

// GET einzelner Kunde
router.get('/:code', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_kunden')
            .select('*')
            .eq('code', req.params.code)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Kunde nicht gefunden'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Fehler beim Abrufen des Kunden:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen des Kunden',
            error: error.message
        });
    }
});

// GET Kunden suchen
router.get('/search/:term', async (req, res) => {
    try {
        const searchTerm = req.params.term;

        const { data, error } = await supabase
            .from('erp_kunden')
            .select('code, firma1, firma2, name, strasse, plz, ort, telefon, mobil, email')
            .or(`firma1.ilike.%${searchTerm}%,firma2.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,telefon.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,ort.ilike.%${searchTerm}%`)
            .order('firma1')
            .limit(50);

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Fehler bei der Kundensuche:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler bei der Kundensuche',
            error: error.message
        });
    }
});

// GET Kunde mit Projekten
router.get('/:code/projekte', async (req, res) => {
    try {
        const { data: kunde, error: kundeError } = await supabase
            .from('erp_kunden')
            .select('*')
            .eq('code', req.params.code)
            .single();

        if (kundeError) throw kundeError;

        const { data: projekte, error: projekteError } = await supabase
            .from('erp_projekte')
            .select('*')
            .eq('kunden_code', req.params.code)
            .order('datum', { ascending: false });

        if (projekteError) throw projekteError;

        res.json({
            success: true,
            data: {
                kunde: kunde,
                projekte: projekte
            }
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Kundenprojekte:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Kundenprojekte',
            error: error.message
        });
    }
});

module.exports = router;
