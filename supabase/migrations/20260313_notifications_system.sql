-- Notifications System
-- Central notification table for CI failures, system alerts, and future user notifications
-- KB-011: AM Notification-Badge foundation

-- Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active (non-archived) notifications
CREATE INDEX IF NOT EXISTS idx_notifications_active ON public.notifications (archived, read, created_at DESC) WHERE archived = false;

-- Index for unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (read, created_at DESC) WHERE read = false;

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_notifications_source ON public.notifications (source, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- anon can INSERT (GitHub Actions use anon key via notify-failure.sh)
CREATE POLICY "anon_insert_notifications" ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (true);

-- anon can SELECT + UPDATE (dashboard has no auth, uses anon key)
CREATE POLICY "anon_select_notifications" ON public.notifications
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_update_notifications" ON public.notifications
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- authenticated can SELECT + UPDATE
CREATE POLICY "authenticated_select_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_update_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC: notify() - webhook endpoint for external callers (GitHub Actions, Edge Functions)
CREATE OR REPLACE FUNCTION public.notify(
  p_type TEXT DEFAULT 'info',
  p_severity TEXT DEFAULT 'low',
  p_source TEXT DEFAULT 'system',
  p_title TEXT DEFAULT '',
  p_body TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (type, severity, source, title, body, metadata)
  VALUES (p_type, p_severity, p_source, p_title, p_body, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant execute to anon (for external webhook calls)
GRANT EXECUTE ON FUNCTION public.notify TO anon;
GRANT EXECUTE ON FUNCTION public.notify TO authenticated;

-- Auto-cleanup: delete notifications older than 90 days (via pg_cron, added separately)
COMMENT ON TABLE public.notifications IS 'Central notification system. Sources: github_action, edge_function, system. Used by AM dashboard NotificationBell.';
