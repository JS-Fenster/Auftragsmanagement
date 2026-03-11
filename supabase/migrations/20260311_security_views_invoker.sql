-- Security Fix: 8 Views SECURITY DEFINER -> SECURITY INVOKER
-- Applied: 2026-03-11
-- All underlying tables have RLS policies with USING(true), INVOKER is safe

CREATE OR REPLACE VIEW public.alle_kunden WITH (security_invoker = true) AS
 SELECT 'erp_'::text || erp_kunden.code::text AS kunden_id,
    'erp'::text AS quelle, erp_kunden.code AS erp_code,
    NULL::uuid AS manuelle_id, NULL::text AS vorname,
    erp_kunden.name, erp_kunden.firma1, erp_kunden.firma2,
    erp_kunden.strasse, erp_kunden.plz, erp_kunden.ort,
    erp_kunden.telefon, erp_kunden.mobil, erp_kunden.email,
    'Unbekannt'::text AS kundentyp, NULL::text AS notizen
   FROM erp_kunden
UNION ALL
 SELECT 'man_'::text || manuelle_kunden.id::text AS kunden_id,
    'manuell'::text AS quelle, NULL::integer AS erp_code,
    manuelle_kunden.id AS manuelle_id, manuelle_kunden.vorname,
    manuelle_kunden.name, manuelle_kunden.firma1, manuelle_kunden.firma2,
    manuelle_kunden.strasse, manuelle_kunden.plz, manuelle_kunden.ort,
    manuelle_kunden.telefon, manuelle_kunden.mobil, manuelle_kunden.email,
    manuelle_kunden.kundentyp, manuelle_kunden.notizen
   FROM manuelle_kunden;

CREATE OR REPLACE VIEW public.kategorie_fehlerrate WITH (security_invoker = true) AS
 SELECT kategorie, count(*) AS total,
    count(*) FILTER (WHERE review_status = 'corrected' AND kategorie <> kategorie_manual) AS fehler,
    round(100.0 * count(*) FILTER (WHERE review_status = 'corrected' AND kategorie <> kategorie_manual)::numeric / NULLIF(count(*), 0)::numeric, 1) AS fehlerrate_pct
   FROM documents WHERE kategorie IS NOT NULL
  GROUP BY kategorie
  ORDER BY fehlerrate_pct DESC;

CREATE OR REPLACE VIEW public.v_anstehende_montagen WITH (security_invoker = true) AS
 SELECT id, montageauftrag_nummer, montage_datum, montage_uhrzeit_von, montage_uhrzeit_bis,
    empfaenger_nachname || COALESCE(' ' || empfaenger_vorname, '') AS kunde_name,
    empfaenger_telefon AS kunde_telefon, empfaenger_mobil AS kunde_mobil,
    montageort_strasse, montageort_plz, montageort_ort,
    montageteam, montage_elemente, bezug_kommission, kundenwuensche, interne_hinweise
   FROM documents
  WHERE kategorie = 'Montageauftrag' AND montage_datum >= CURRENT_DATE
  ORDER BY montage_datum, montage_uhrzeit_von;

CREATE OR REPLACE VIEW public.v_auftraege WITH (security_invoker = true) AS
 SELECT a.id, a.status, a.kunde_kategorie, a.prioritaet, a.mannstaerke,
    a.zeitfenster, a.outcome_sv1, a.erstellt_am, a.aktualisiert_am,
    a.termin_sv1, a.termin_sv2, a.letzter_kontakt_am,
    a.erp_kunde_id, a.kontakt_id, a.document_id,
    a.beschreibung, a.notizen,
    a.adresse_strasse, a.adresse_plz, a.adresse_ort,
    a.neukunde_name, a.neukunde_telefon, a.neukunde_email,
    a.neukunde_rechnungsadresse, a.neukunde_formular_unterschrieben,
    a.ist_zu_lange_offen, a.ist_no_show, a.metadata,
    a.auftragstyp, a.manuelle_kunde_id, a.erstellt_via,
    a.telegram_chat_id, a.telegram_message_id,
    a.kundentyp_option, a.auftragsnummer,
    a.einsatzort_strasse, a.einsatzort_plz, a.einsatzort_ort,
    ek.firma1 AS kunde_firma, ek.firma2 AS kunde_firma2,
    ek.name AS kunde_name_erp, ek.strasse AS kunde_strasse_erp,
    ek.plz AS kunde_plz_erp, ek.ort AS kunde_ort_erp,
    ek.telefon AS kunde_telefon_erp, ek.email AS kunde_email_erp,
    k.id AS kontakt_uuid, k.firma1 AS kontakt_firma,
    k.ist_kunde AS kontakt_ist_kunde, k.ist_lieferant AS kontakt_ist_lieferant,
    k.typ AS kontakt_typ
   FROM auftraege a
     LEFT JOIN erp_kunden ek ON a.erp_kunde_id = ek.code
     LEFT JOIN kontakte k ON a.kontakt_id = k.id;

CREATE OR REPLACE VIEW public.v_dokumente_pro_kunde WITH (security_invoker = true) AS
 SELECT COALESCE(empfaenger_kundennummer, 'OHNE_NR') AS kundennummer,
    COALESCE(empfaenger_firma, empfaenger_nachname || ' ' || COALESCE(empfaenger_vorname, '')) AS kunde,
    count(*) AS anzahl_dokumente,
    count(*) FILTER (WHERE kategorie = 'Angebot') AS angebote,
    count(*) FILTER (WHERE kategorie = 'Ausgangsrechnung') AS rechnungen,
    count(*) FILTER (WHERE kategorie = 'Montageauftrag') AS montagen,
    sum(summe_brutto) FILTER (WHERE kategorie = 'Ausgangsrechnung') AS umsatz_gesamt,
    max(dokument_datum) AS letztes_dokument
   FROM documents
  WHERE empfaenger_kundennummer IS NOT NULL OR empfaenger_nachname IS NOT NULL
  GROUP BY kundennummer, kunde
  ORDER BY umsatz_gesamt DESC NULLS LAST;

CREATE OR REPLACE VIEW public.v_offene_ausgangsrechnungen WITH (security_invoker = true) AS
 SELECT id, dokument_nummer AS rechnung_nr, dokument_datum AS rechnung_datum,
    empfaenger_nachname || COALESCE(' ' || empfaenger_vorname, '') AS kunde_name,
    empfaenger_firma AS kunde_firma, empfaenger_kundennummer AS kundennummer,
    summe_brutto, COALESCE(offener_betrag, summe_brutto) AS offener_betrag,
    faellig_am, CURRENT_DATE - faellig_am AS ueberfaellig_tage, bezug_kommission
   FROM documents
  WHERE kategorie = 'Ausgangsrechnung' AND (zahlungsstatus IS NULL OR zahlungsstatus <> 'bezahlt')
    AND COALESCE(offener_betrag, summe_brutto) > 0
  ORDER BY faellig_am;

CREATE OR REPLACE VIEW public.v_offene_eingangsrechnungen WITH (security_invoker = true) AS
 SELECT id, dokument_nummer AS rechnung_nr, dokument_datum AS rechnung_datum,
    aussteller_firma AS lieferant, summe_brutto,
    COALESCE(offener_betrag, summe_brutto) AS offener_betrag,
    faellig_am, skonto_prozent, skonto_tage,
    dokument_datum + COALESCE(skonto_tage, 0) AS skonto_bis,
    CASE WHEN CURRENT_DATE <= (dokument_datum + COALESCE(skonto_tage, 0))
      THEN round(summe_brutto * COALESCE(skonto_prozent, 0) / 100, 2) ELSE 0 END AS skonto_moeglich,
    bezug_kommission, bezug_endkunde
   FROM documents
  WHERE kategorie = 'Eingangsrechnung' AND (zahlungsstatus IS NULL OR zahlungsstatus <> 'bezahlt')
    AND COALESCE(offener_betrag, summe_brutto) > 0
  ORDER BY faellig_am;

CREATE OR REPLACE VIEW public.v_wiedervorlagen WITH (security_invoker = true) AS
 SELECT id, kategorie, dokument_datum, wiedervorlage_datum, wiedervorlage_grund,
    betreff, empfaenger_nachname || COALESCE(' ' || empfaenger_vorname, '') AS kunde_name,
    empfaenger_firma AS kunde_firma, bezug_kommission
   FROM documents
  WHERE wiedervorlage_datum IS NOT NULL AND wiedervorlage_datum >= CURRENT_DATE
  ORDER BY wiedervorlage_datum;
