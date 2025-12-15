const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');

// GET alle Projekte (ersetzt Reparaturen)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_projekte')
            .select(`
                code,
                nummer,
                name,
                kunden_code,
                datum,
                projekt_status,
                notiz,
                erp_kunden!inner (
                    firma1,
                    name,
                    strasse,
                    plz,
                    ort,
                    telefon
                )
            `)
            .order('datum', { ascending: false })
            .limit(500);

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Projekte:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Projekte',
            error: error.message
        });
    }
});

// GET einzelnes Projekt
router.get('/:code', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_projekte')
            .select(`
                *,
                erp_kunden (
                    code,
                    firma1,
                    firma2,
                    name,
                    strasse,
                    plz,
                    ort,
                    telefon,
                    mobil,
                    email
                )
            `)
            .eq('code', req.params.code)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Projekt nicht gefunden'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Fehler beim Abrufen des Projekts:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen des Projekts',
            error: error.message
        });
    }
});

// GET Statistiken
router.get('/stats/overview', async (req, res) => {
    try {
        // Anzahl Projekte
        const { count: gesamt } = await supabase
            .from('erp_projekte')
            .select('*', { count: 'exact', head: true });

        // Anzahl Kunden
        const { count: kunden } = await supabase
            .from('erp_kunden')
            .select('*', { count: 'exact', head: true });

        // Anzahl Angebote
        const { count: angebote } = await supabase
            .from('erp_angebote')
            .select('*', { count: 'exact', head: true });

        // Anzahl Rechnungen
        const { count: rechnungen } = await supabase
            .from('erp_rechnungen')
            .select('*', { count: 'exact', head: true });

        // Summe offene Rechnungen (ueber erp_ra)
        const { data: offeneData } = await supabase
            .from('erp_ra')
            .select('r_betrag, bez_summe')
            .gt('mahnstufe', 0);

        let offeneSumme = 0;
        if (offeneData) {
            offeneSumme = offeneData.reduce((sum, r) => {
                const offen = (r.r_betrag || 0) - (r.bez_summe || 0);
                return sum + (offen > 0 ? offen : 0);
            }, 0);
        }

        res.json({
            success: true,
            data: {
                projekte: gesamt || 0,
                kunden: kunden || 0,
                angebote: angebote || 0,
                rechnungen: rechnungen || 0,
                offeneSumme: Math.round(offeneSumme * 100) / 100
            }
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Statistiken:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Statistiken',
            error: error.message
        });
    }
});

// GET Angebote
router.get('/angebote/list', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_angebote')
            .select(`
                code,
                nummer,
                datum,
                wert,
                auftrags_datum,
                auftrags_nummer,
                notiz,
                erp_kunden (
                    firma1,
                    name,
                    ort
                )
            `)
            .order('datum', { ascending: false })
            .limit(200);

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Angebote:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Angebote',
            error: error.message
        });
    }
});

// GET Rechnungen
router.get('/rechnungen/list', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('erp_rechnungen')
            .select(`
                code,
                nummer,
                datum,
                wert,
                bruttowert,
                zahlbar_bis,
                erp_kunden (
                    firma1,
                    name,
                    ort
                )
            `)
            .order('datum', { ascending: false })
            .limit(200);

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Rechnungen:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Rechnungen',
            error: error.message
        });
    }
});

module.exports = router;
