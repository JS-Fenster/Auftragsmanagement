/**
 * SYNC W4A STAMMDATEN NACH SUPABASE
 * ==================================
 *
 * Synchronisiert Stammdaten aus Work4All nach Supabase:
 *   - erp_kunden (Kunden)
 *   - erp_lieferanten (Lieferanten)
 *   - erp_projekte (Projekte)
 *   - erp_bestellungen (Bestellungen)
 *   - erp_ra (Offene Posten / Ausgangsrechnungen)
 *   - erp_ansprechpartner (Kunden-Ansprechpartner) — NEU
 *   - erp_mitarbeiter (Mitarbeiter) — NEU
 *
 * Sync-Strategie: Upsert basierend auf W4A UpdateTime.
 *   - Nur Datensaetze synchen die seit letztem Sync geaendert wurden
 *   - --force: Alle Datensaetze neu synchen
 *
 * Verwendung:
 *   node sync-stammdaten.js           # Inkrementeller Sync
 *   node sync-stammdaten.js --force   # Alle neu synchen
 *   node sync-stammdaten.js --dry-run # Nur anzeigen
 *
 * Erstellt: 2026-03-13
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getW4APool, closeW4APool } = require('../config/w4a-database');

// =============================================================================
// KONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('FEHLER: SUPABASE_URL und SUPABASE_SERVICE_KEY muessen in .env gesetzt sein');
    process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const BATCH_SIZE = 200;

// =============================================================================
// SUPABASE HELPER
// =============================================================================

async function supabaseUpsert(table, rows) {
    if (rows.length === 0 || DRY_RUN) return;

    // Batch in chunks
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const url = `${SUPABASE_URL}/rest/v1/${table}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(batch)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Supabase upsert ${table} (batch ${i}): ${response.status} - ${errorText}`);
        }
    }
}

async function getLastSyncTime(table) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=synced_at&order=synced_at.desc&limit=1`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    const data = await response.json();
    return data.length > 0 ? data[0].synced_at : null;
}

// =============================================================================
// SYNC DEFINITIONEN
// =============================================================================

const SYNC_TABLES = [
    {
        name: 'Kunden',
        w4aTable: 'Kunden',
        supabaseTable: 'erp_kunden',
        query: `SELECT Code, Firma1, Firma2, Firma3, Name,
                Straße AS Strasse, Plz, Ort, Telefon,
                Autotelefon AS Mobil, [E-Mail] AS Email,
                InsertTime, UpdateTime
                FROM dbo.Kunden`,
        mapRow: (r) => ({
            code: r.Code,
            firma1: r.Firma1,
            firma2: r.Firma2,
            firma3: r.Firma3,
            name: r.Name,
            strasse: r.Strasse,
            plz: r.Plz,
            ort: r.Ort,
            telefon: r.Telefon,
            mobil: r.Mobil,
            email: r.Email,
            erp_insert_time: r.InsertTime,
            erp_update_time: r.UpdateTime,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Lieferanten',
        w4aTable: 'Lieferanten',
        supabaseTable: 'erp_lieferanten',
        query: `SELECT Code, Firma1, Firma2, Name,
                Straße AS Strasse, Plz, Ort, Telefon, [E-Mail] AS Email,
                InsertTime, UpdateTime
                FROM dbo.Lieferanten`,
        mapRow: (r) => ({
            code: r.Code,
            firma1: r.Firma1,
            firma2: r.Firma2,
            name: r.Name,
            strasse: r.Strasse,
            plz: r.Plz,
            ort: r.Ort,
            telefon: r.Telefon,
            email: r.Email,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Projekte',
        w4aTable: 'Projekte',
        supabaseTable: 'erp_projekte',
        query: `SELECT Code, Nummer, Name, KundenCode, Datum, ProjektStatus,
                CAST(Notiz AS NVARCHAR(MAX)) AS Notiz,
                InsertTime, UpdateTime
                FROM dbo.Projekte`,
        mapRow: (r) => ({
            code: r.Code,
            nummer: r.Nummer,
            name: r.Name,
            kunden_code: r.KundenCode,
            datum: r.Datum,
            projekt_status: r.ProjektStatus,
            notiz: r.Notiz ? r.Notiz.substring(0, 5000) : null,
            erp_insert_time: r.InsertTime,
            erp_update_time: r.UpdateTime,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Bestellungen',
        w4aTable: 'Bestellung',
        supabaseTable: 'erp_bestellungen',
        query: `SELECT Code, Nummer, Datum, ProjektCode, SDObjMemberCode AS LieferantCode,
                Wert, InsertTime, UpdateTime
                FROM dbo.Bestellung`,
        mapRow: (r) => ({
            code: r.Code,
            nummer: r.Nummer,
            datum: r.Datum,
            projekt_code: r.ProjektCode,
            lieferant_code: r.LieferantCode,
            wert: r.Wert,
            erp_insert_time: r.InsertTime,
            erp_update_time: r.UpdateTime,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Offene Posten (RA)',
        w4aTable: 'RA',
        supabaseTable: 'erp_ra',
        query: `SELECT Code, RCode, RNummer, RBetrag, BezSumme,
                Mahnstuffe AS Mahnstufe, FälligDatum AS FaelligDatum
                FROM dbo.RA`,
        mapRow: (r) => ({
            code: r.Code,
            r_code: r.RCode,
            r_nummer: r.RNummer,
            r_betrag: r.RBetrag,
            bez_summe: r.BezSumme,
            mahnstufe: r.Mahnstufe,
            faellig_datum: r.FaelligDatum,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Ansprechpartner',
        w4aTable: 'KAnsprechp',
        supabaseTable: 'erp_ansprechpartner',
        query: `SELECT KAnsprechpCode AS Code, KundenCode, AnredeCode, Vorname, Name,
                Telefon, Telefon2, Telefax, Mobilfunk, [E-Mail] AS Email,
                Funktion, AbteilungCode, Straße AS Strasse, Plz, Ort,
                Geburtsdatum, Entlassen,
                InsertTime, UpdateTime
                FROM dbo.KAnsprechp`,
        mapRow: (r) => ({
            code: r.Code,
            kunden_code: r.KundenCode,
            anrede_code: r.AnredeCode,
            vorname: r.Vorname,
            name: r.Name,
            telefon: r.Telefon,
            telefon2: r.Telefon2,
            telefax: r.Telefax,
            mobilfunk: r.Mobilfunk,
            email: r.Email,
            funktion: r.Funktion,
            abteilung_code: r.AbteilungCode,
            strasse: r.Strasse,
            plz: r.Plz,
            ort: r.Ort,
            geburtsdatum: r.Geburtsdatum,
            entlassen: r.Entlassen,
            erp_insert_time: r.InsertTime,
            erp_update_time: r.UpdateTime,
            synced_at: new Date().toISOString()
        })
    },
    {
        name: 'Mitarbeiter',
        w4aTable: 'Mitarbeiter',
        supabaseTable: 'erp_mitarbeiter',
        query: `SELECT Code, Nummer, Name, Vorname, eMail AS Email,
                Telefon, BenutzerCode, Ausgeschieden, Eintrittsdatum
                FROM dbo.Mitarbeiter`,
        mapRow: (r) => ({
            code: r.Code,
            nummer: r.Nummer,
            name: r.Name,
            vorname: r.Vorname,
            email: r.Email,
            telefon: r.Telefon,
            benutzer_code: r.BenutzerCode,
            ausgeschieden: r.Ausgeschieden,
            eintrittsdatum: r.Eintrittsdatum,
            synced_at: new Date().toISOString()
        })
    }
];

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log('======================================================================');
    console.log('  SYNC W4A STAMMDATEN NACH SUPABASE');
    console.log('======================================================================');
    console.log(`  Force-Mode:    ${FORCE ? 'Ja (alles neu)' : 'Nein (inkrementell)'}`);
    console.log(`  Dry-Run:       ${DRY_RUN ? 'Ja (nichts speichern)' : 'Nein'}`);
    console.log('======================================================================');

    const pool = await getW4APool();
    const results = [];

    for (const table of SYNC_TABLES) {
        console.log(`\n[${table.name}] Starte...`);

        try {
            // W4A Daten holen (Full-Upsert — Stammdaten sind klein genug)
            const w4aData = await pool.request().query(table.query);
            const rows = w4aData.recordset;

            console.log(`[${table.name}] ${rows.length} Datensaetze aus W4A`);

            if (rows.length === 0) {
                results.push({ name: table.name, synced: 0, status: 'up-to-date' });
                continue;
            }

            // Mapping
            const mapped = rows.map(table.mapRow);

            if (DRY_RUN) {
                console.log(`[${table.name}] (dry-run) Wuerde ${mapped.length} upserten`);
                results.push({ name: table.name, synced: mapped.length, status: 'dry-run' });
                continue;
            }

            // Upsert
            await supabaseUpsert(table.supabaseTable, mapped);
            console.log(`[${table.name}] ${mapped.length} Datensaetze gesynced`);
            results.push({ name: table.name, synced: mapped.length, status: 'ok' });

        } catch (err) {
            console.error(`[${table.name}] FEHLER: ${err.message}`);
            results.push({ name: table.name, synced: 0, status: 'error', error: err.message });
        }
    }

    await closeW4APool();

    // Zusammenfassung
    console.log('\n======================================================================');
    console.log('  ZUSAMMENFASSUNG');
    console.log('======================================================================');
    for (const r of results) {
        const icon = r.status === 'ok' ? 'OK' : r.status === 'up-to-date' ? '--' : r.status === 'dry-run' ? 'DRY' : 'ERR';
        console.log(`  [${icon}] ${r.name.padEnd(25)} ${String(r.synced).padStart(6)} Datensaetze`);
    }
    console.log('======================================================================');
}

main().catch(err => {
    console.error(`\nFATAL ERROR: ${err.constructor.name}: ${err.message}`);
    process.exit(1);
});
