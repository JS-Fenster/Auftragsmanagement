-- =============================================================================
-- Migration: Enable RLS on documents + email_subscriptions
-- Date: 2026-01-14
-- Author: Claude Code
-- =============================================================================
--
-- KONTEXT:
-- - Beide Tabellen werden NUR von Edge Functions mit SERVICE_ROLE_KEY genutzt
-- - Service Role Key bypassed RLS automatisch (hat bypassrls privilege)
-- - Kein Frontend/Client greift direkt auf diese Tabellen zu
-- - Daher: RLS aktivieren OHNE Policies = nur Service Role kommt durch
--
-- ROLLBACK:
-- ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.email_subscriptions DISABLE ROW LEVEL SECURITY;
-- =============================================================================

-- 1) Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 2) Enable RLS on email_subscriptions
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3) Verify (optional - kann nach Apply geprueft werden)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('documents', 'email_subscriptions');

-- =============================================================================
-- HINWEIS: Keine Policies erstellt!
-- - anon/authenticated haben jetzt KEINEN Zugriff mehr
-- - Nur service_role (Edge Functions mit SERVICE_ROLE_KEY) hat Zugriff
-- - Das ist das gewuenschte Verhalten
-- =============================================================================
