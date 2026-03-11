-- Security Fix: Enable RLS on 4 tables (Supabase Security Advisor ERRORs)
-- Applied: 2026-03-11

-- 1. email_ingest_filters: Policy "anon_select_email_ingest_filters" already existed
ALTER TABLE public.email_ingest_filters ENABLE ROW LEVEL SECURITY;

-- 2. ignored_emails: Policy "anon_select_ignored_emails" already existed
ALTER TABLE public.ignored_emails ENABLE ROW LEVEL SECURITY;

-- 3. document_embeddings: No policies existed, created before enabling
CREATE POLICY "anon_select_document_embeddings" ON public.document_embeddings
  FOR SELECT USING (true);
CREATE POLICY "service_role_all_document_embeddings" ON public.document_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- 4. backtest_elements: No policies existed, created before enabling
CREATE POLICY "anon_select_backtest_elements" ON public.backtest_elements
  FOR SELECT USING (true);
CREATE POLICY "service_role_all_backtest_elements" ON public.backtest_elements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.backtest_elements ENABLE ROW LEVEL SECURITY;
