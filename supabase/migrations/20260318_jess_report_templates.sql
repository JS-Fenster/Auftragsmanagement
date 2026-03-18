-- LLM-012: Report template persistence for Jess
CREATE TABLE IF NOT EXISTS jess_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  titel TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  use_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jess_report_templates_type ON jess_report_templates(report_type);

ALTER TABLE jess_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read report templates"
  ON jess_report_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert report templates"
  ON jess_report_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update report templates"
  ON jess_report_templates FOR UPDATE TO authenticated USING (true);
