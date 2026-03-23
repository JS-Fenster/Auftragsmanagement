-- Feature Flags for controlled rollout (AM-082)
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  allowed_users text[] DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.feature_flags IS 'Feature flags for controlled rollout. allowed_users empty = flag applies to all users when enabled.';

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_all" ON public.feature_flags
  FOR SELECT USING (true);

CREATE POLICY "feature_flags_service_modify" ON public.feature_flags
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (flag_key, enabled, description) VALUES
  ('dashboard_online', false, 'Master switch: Dashboard ueber Cloudflare Pages erreichbar'),
  ('jess_feedback', false, 'Jess kann Verbesserungsvorschlaege in jess_feedback schreiben'),
  ('audit_trail', false, 'Aenderungshistorie auf kritischen Tabellen aktiv')
ON CONFLICT (flag_key) DO NOTHING;
