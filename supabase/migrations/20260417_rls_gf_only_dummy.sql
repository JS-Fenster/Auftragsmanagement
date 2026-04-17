-- AM-197 ZE-P1b + MA-P1a: Dummy-RLS-Policies "nur GF"
-- Andreas 2026-04-17: "bau schon mal Dummies — nur GF, Rest editieren wir spaeter"
--
-- Vorher: Alle sensiblen Tabellen hatten "FOR ALL USING (true)" — jeder angemeldete User
-- (und via anon-key sogar nicht-angemeldete) konnte SV-Nr, IBAN, Steuer-ID, Gehaelter,
-- Stempel etc. aller MA sehen. DSGVO-Verstoss.
--
-- Nachher: is_gf() Helper + Policies "nur Geschaeftsfuehrung sieht alles".
-- Nicht-GF-User (Monteure, Buerokraefte) sehen nichts auf sensiblen Tabellen.
-- Feinere Rollen (HR, MA-Self-View, etc.) kommen mit AM-199 (RBAC Admin-Panel).
--
-- VORAUSSETZUNG: Mitarbeiter.auth_user_id muss fuer jeden Login-User gesetzt sein.
-- Andreas' auth_user_id wurde bereits manuell gesetzt (2026-04-17, vor dieser Migration).

CREATE OR REPLACE FUNCTION public.is_gf() RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.mitarbeiter
      WHERE auth_user_id = auth.uid()
        AND rolle = 'geschaeftsfuehrung'
    );
  $$;

GRANT EXECUTE ON FUNCTION public.is_gf() TO authenticated, anon;

-- Existierende Open-Access-Policies droppen + neue GF-only Policies
DROP POLICY IF EXISTS mitarbeiter_anon_all ON public.mitarbeiter;
DROP POLICY IF EXISTS mitarbeiter_auth_all ON public.mitarbeiter;
CREATE POLICY mitarbeiter_gf_only ON public.mitarbeiter FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS mitarbeiter_daten_anon_all ON public.mitarbeiter_daten;
DROP POLICY IF EXISTS mitarbeiter_daten_auth_all ON public.mitarbeiter_daten;
CREATE POLICY mitarbeiter_daten_gf_only ON public.mitarbeiter_daten FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS personen_anon_all ON public.personen;
DROP POLICY IF EXISTS personen_auth_all ON public.personen;
CREATE POLICY personen_gf_only ON public.personen FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS person_adressen_anon_all ON public.person_adressen;
DROP POLICY IF EXISTS person_adressen_auth_all ON public.person_adressen;
CREATE POLICY person_adressen_gf_only ON public.person_adressen FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS person_kontaktdaten_anon_all ON public.person_kontaktdaten;
DROP POLICY IF EXISTS person_kontaktdaten_auth_all ON public.person_kontaktdaten;
CREATE POLICY person_kontaktdaten_gf_only ON public.person_kontaktdaten FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS arbeitsvertraege_anon_all ON public.arbeitsvertraege;
DROP POLICY IF EXISTS arbeitsvertraege_auth_all ON public.arbeitsvertraege;
CREATE POLICY arbeitsvertraege_gf_only ON public.arbeitsvertraege FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS lohnabrechnungen_anon_all ON public.lohnabrechnungen;
DROP POLICY IF EXISTS lohnabrechnungen_auth_all ON public.lohnabrechnungen;
CREATE POLICY lohnabrechnungen_gf_only ON public.lohnabrechnungen FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS zeitstempel_anon_all ON public.zeitstempel;
DROP POLICY IF EXISTS zeitstempel_auth_all ON public.zeitstempel;
CREATE POLICY zeitstempel_gf_only ON public.zeitstempel FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS zeit_korrekturen_anon_all ON public.zeit_korrekturen;
DROP POLICY IF EXISTS zeit_korrekturen_auth_all ON public.zeit_korrekturen;
CREATE POLICY zeit_korrekturen_gf_only ON public.zeit_korrekturen FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS abwesenheiten_anon_all ON public.abwesenheiten;
DROP POLICY IF EXISTS abwesenheiten_auth_all ON public.abwesenheiten;
CREATE POLICY abwesenheiten_gf_only ON public.abwesenheiten FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS arbeitszeitmodelle_anon_all ON public.arbeitszeitmodelle;
DROP POLICY IF EXISTS arbeitszeitmodelle_auth_all ON public.arbeitszeitmodelle;
CREATE POLICY arbeitszeitmodelle_gf_only ON public.arbeitszeitmodelle FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

DROP POLICY IF EXISTS mitarbeiter_skills_anon_all ON public.mitarbeiter_skills;
DROP POLICY IF EXISTS mitarbeiter_skills_auth_all ON public.mitarbeiter_skills;
CREATE POLICY mitarbeiter_skills_gf_only ON public.mitarbeiter_skills FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());

-- mitarbeiter_fuehrerscheine hat mehrere separate Policies (CRUD)
DROP POLICY IF EXISTS fuehrerscheine_anon_delete ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_anon_insert ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_anon_select ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_anon_update ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_auth_delete ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_auth_insert ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_auth_select ON public.mitarbeiter_fuehrerscheine;
DROP POLICY IF EXISTS fuehrerscheine_auth_update ON public.mitarbeiter_fuehrerscheine;
CREATE POLICY fuehrerscheine_gf_only ON public.mitarbeiter_fuehrerscheine FOR ALL TO authenticated USING (public.is_gf()) WITH CHECK (public.is_gf());
