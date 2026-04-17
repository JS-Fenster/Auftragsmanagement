-- =============================================================================
-- INFRA-027b: TLS-Cert-Watchdog support
-- 2026-04-17
-- =============================================================================
-- Adds metadata column (host, port) + allows NULL expires_at so a new TLS
-- monitor row can exist before the first check populates its expiry date.
-- =============================================================================

ALTER TABLE public.expiring_items
  ALTER COLUMN expires_at DROP NOT NULL;

ALTER TABLE public.expiring_items
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.expiring_items.metadata IS
  'Per-row config (e.g., {"host":"dashboard.js-fenster.de","port":443} for tls_cert rows).';
