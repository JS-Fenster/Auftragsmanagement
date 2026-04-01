-- Probezeit als Monate statt festes Datum
-- Applied via MCP on 2026-04-01
ALTER TABLE public.mitarbeiter ADD COLUMN IF NOT EXISTS probezeit_monate INTEGER DEFAULT 6;
