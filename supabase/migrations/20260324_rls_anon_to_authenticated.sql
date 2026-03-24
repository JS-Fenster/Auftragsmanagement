-- AM-069: Convert ALL anon/public write policies to authenticated
-- Security Advisor had 66 "always true" policies, many on anon/public role
-- After this migration: 0 anon/public write access, all require authentication
--
-- Approach: DROP anon/public policy → CREATE authenticated equivalent
-- service_role policies are kept as-is (Edge Functions need them)

-- ============================================================
-- Batch 1: belege, beleg_positionen, beleg_vorlagen, beleg_zahlungen
-- ============================================================

DROP POLICY IF EXISTS "anon_delete_belege" ON public.belege;
DROP POLICY IF EXISTS "anon_insert_belege" ON public.belege;
DROP POLICY IF EXISTS "anon_update_belege" ON public.belege;
CREATE POLICY "authenticated_delete_belege" ON public.belege FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_belege" ON public.belege FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_belege" ON public.belege FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_beleg_pos" ON public.beleg_positionen;
DROP POLICY IF EXISTS "anon_insert_beleg_pos" ON public.beleg_positionen;
DROP POLICY IF EXISTS "anon_update_beleg_pos" ON public.beleg_positionen;
CREATE POLICY "authenticated_delete_beleg_pos" ON public.beleg_positionen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_beleg_pos" ON public.beleg_positionen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_beleg_pos" ON public.beleg_positionen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "beleg_vorlagen_delete" ON public.beleg_vorlagen;
DROP POLICY IF EXISTS "beleg_vorlagen_insert" ON public.beleg_vorlagen;
DROP POLICY IF EXISTS "beleg_vorlagen_update" ON public.beleg_vorlagen;
CREATE POLICY "authenticated_delete_beleg_vorlagen" ON public.beleg_vorlagen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_beleg_vorlagen" ON public.beleg_vorlagen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_beleg_vorlagen" ON public.beleg_vorlagen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "beleg_zahlungen_delete" ON public.beleg_zahlungen;
DROP POLICY IF EXISTS "beleg_zahlungen_insert" ON public.beleg_zahlungen;
DROP POLICY IF EXISTS "beleg_zahlungen_update" ON public.beleg_zahlungen;
CREATE POLICY "authenticated_delete_beleg_zahlungen" ON public.beleg_zahlungen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_beleg_zahlungen" ON public.beleg_zahlungen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_beleg_zahlungen" ON public.beleg_zahlungen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Batch 2: kontakte, kontakt_personen, kontakt_details
-- ============================================================

DROP POLICY IF EXISTS "kontakte_delete" ON public.kontakte;
DROP POLICY IF EXISTS "kontakte_insert" ON public.kontakte;
DROP POLICY IF EXISTS "kontakte_update" ON public.kontakte;
CREATE POLICY "authenticated_delete_kontakte" ON public.kontakte FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_kontakte" ON public.kontakte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_kontakte" ON public.kontakte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kontakt_personen_delete" ON public.kontakt_personen;
DROP POLICY IF EXISTS "kontakt_personen_insert" ON public.kontakt_personen;
DROP POLICY IF EXISTS "kontakt_personen_update" ON public.kontakt_personen;
CREATE POLICY "authenticated_delete_kontakt_personen" ON public.kontakt_personen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_kontakt_personen" ON public.kontakt_personen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_kontakt_personen" ON public.kontakt_personen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kontakt_details_delete" ON public.kontakt_details;
DROP POLICY IF EXISTS "kontakt_details_insert" ON public.kontakt_details;
DROP POLICY IF EXISTS "kontakt_details_update" ON public.kontakt_details;
CREATE POLICY "authenticated_delete_kontakt_details" ON public.kontakt_details FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_kontakt_details" ON public.kontakt_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_kontakt_details" ON public.kontakt_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Batch 3: projekte, projekt_positionen, projekt_bestellungen, projekt_aufgaben, projekt_historie
-- ============================================================

DROP POLICY IF EXISTS "Allow anon delete projekte" ON public.projekte;
DROP POLICY IF EXISTS "Allow anon insert projekte" ON public.projekte;
DROP POLICY IF EXISTS "Allow anon update projekte" ON public.projekte;
CREATE POLICY "authenticated_delete_projekte" ON public.projekte FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_projekte" ON public.projekte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_projekte" ON public.projekte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete projekt_positionen" ON public.projekt_positionen;
DROP POLICY IF EXISTS "Allow anon insert projekt_positionen" ON public.projekt_positionen;
DROP POLICY IF EXISTS "Allow anon update projekt_positionen" ON public.projekt_positionen;
CREATE POLICY "authenticated_delete_projekt_positionen" ON public.projekt_positionen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_projekt_positionen" ON public.projekt_positionen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_projekt_positionen" ON public.projekt_positionen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete projekt_bestellungen" ON public.projekt_bestellungen;
DROP POLICY IF EXISTS "Allow anon insert projekt_bestellungen" ON public.projekt_bestellungen;
DROP POLICY IF EXISTS "Allow anon update projekt_bestellungen" ON public.projekt_bestellungen;
CREATE POLICY "authenticated_delete_projekt_bestellungen" ON public.projekt_bestellungen FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_projekt_bestellungen" ON public.projekt_bestellungen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_projekt_bestellungen" ON public.projekt_bestellungen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projekt_aufgaben_delete" ON public.projekt_aufgaben;
DROP POLICY IF EXISTS "projekt_aufgaben_insert" ON public.projekt_aufgaben;
DROP POLICY IF EXISTS "projekt_aufgaben_update" ON public.projekt_aufgaben;
CREATE POLICY "authenticated_delete_projekt_aufgaben" ON public.projekt_aufgaben FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_projekt_aufgaben" ON public.projekt_aufgaben FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_projekt_aufgaben" ON public.projekt_aufgaben FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert projekt_historie" ON public.projekt_historie;
CREATE POLICY "authenticated_insert_projekt_historie" ON public.projekt_historie FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Batch 4: projekt_*, objekte, notifications
-- ============================================================

DROP POLICY IF EXISTS "projekt_intern_anon_all" ON public.projekt_intern;
CREATE POLICY "authenticated_all_projekt_intern" ON public.projekt_intern FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projekt_reparatur_anon_all" ON public.projekt_reparatur;
CREATE POLICY "authenticated_all_projekt_reparatur" ON public.projekt_reparatur FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projekt_versicherung_anon_all" ON public.projekt_versicherung;
CREATE POLICY "authenticated_all_projekt_versicherung" ON public.projekt_versicherung FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projekt_wartung_anon_all" ON public.projekt_wartung;
CREATE POLICY "authenticated_all_projekt_wartung" ON public.projekt_wartung FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "objekte_anon_all" ON public.objekte;
CREATE POLICY "authenticated_all_objekte" ON public.objekte FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "objekt_bestand_anon_all" ON public.objekt_bestand;
CREATE POLICY "authenticated_all_objekt_bestand" ON public.objekt_bestand FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON public.notifications;
CREATE POLICY "authenticated_insert_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Batch 5: public role → authenticated/service_role
-- ============================================================

DROP POLICY IF EXISTS "Users can insert cases" ON public.budget_cases;

DROP POLICY IF EXISTS "Allow all for now" ON public.budgetangebote;
CREATE POLICY "authenticated_all_budgetangebote" ON public.budgetangebote FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for now" ON public.budgetangebot_positionen;
CREATE POLICY "authenticated_all_budgetangebot_positionen" ON public.budgetangebot_positionen FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projekt_dokumente_all" ON public.projekt_dokumente;
CREATE POLICY "authenticated_all_projekt_dokumente" ON public.projekt_dokumente FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON public.system_alerts;
CREATE POLICY "service_role_all_system_alerts" ON public.system_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_select_system_alerts" ON public.system_alerts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jess_feedback_insert_service" ON public.jess_feedback;
DROP POLICY IF EXISTS "jess_feedback_update_service" ON public.jess_feedback;
CREATE POLICY "service_role_insert_jess_feedback" ON public.jess_feedback FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_role_update_jess_feedback" ON public.jess_feedback FOR UPDATE TO service_role USING (true);
