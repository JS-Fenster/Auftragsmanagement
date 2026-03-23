-- Jess Feedback table (AM-076)
CREATE TABLE IF NOT EXISTS public.jess_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type text NOT NULL CHECK (feedback_type IN ('bug', 'verbesserung', 'feature', 'ux')),
  title text NOT NULL,
  description text,
  page_context text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'dismissed')),
  jess_session_id text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  backlog_id text
);

COMMENT ON TABLE public.jess_feedback IS 'Jess notiert hier Verbesserungsvorschlaege waehrend Andreas AM testet. Claude Code holt diese beim Sprint-Start ab.';

ALTER TABLE public.jess_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jess_feedback_select_all" ON public.jess_feedback
  FOR SELECT USING (true);

CREATE POLICY "jess_feedback_insert_service" ON public.jess_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "jess_feedback_update_service" ON public.jess_feedback
  FOR UPDATE USING (true);

CREATE INDEX idx_jess_feedback_status ON public.jess_feedback (status) WHERE status = 'open';
