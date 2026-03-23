-- Audit Trail for business data (AM-085)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  ip_address text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Aenderungshistorie fuer Geschaeftsdaten. Wer hat wann was geaendert.';

CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_authenticated" ON public.audit_log
  FOR SELECT USING (true);

CREATE POLICY "audit_log_insert_service" ON public.audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  changed text[];
  col text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, user_id, action, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, auth.uid(), 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    changed := ARRAY[]::text[];
    FOR col IN SELECT column_name FROM information_schema.columns
               WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME
    LOOP
      IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
        changed := array_append(changed, col);
      END IF;
    END LOOP;
    IF array_length(changed, 1) > 0 THEN
      INSERT INTO public.audit_log (entity_type, entity_id, user_id, action, old_values, new_values, changed_fields)
      VALUES (TG_TABLE_NAME, NEW.id, auth.uid(), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, user_id, action, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, auth.uid(), 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Triggers on critical business tables
CREATE TRIGGER audit_belege AFTER INSERT OR UPDATE OR DELETE ON public.belege
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_projekte AFTER INSERT OR UPDATE OR DELETE ON public.projekte
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_kontakte AFTER INSERT OR UPDATE OR DELETE ON public.kontakte
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_projekt_bestellungen AFTER INSERT OR UPDATE OR DELETE ON public.projekt_bestellungen
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_beleg_zahlungen AFTER INSERT OR UPDATE OR DELETE ON public.beleg_zahlungen
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
