-- G-004: E-Mail Archivierung (.eml)
-- Adds columns for .eml file storage path and integrity hash
-- Applied: 2026-03-12

ALTER TABLE documents ADD COLUMN IF NOT EXISTS eml_storage_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS eml_file_hash TEXT;

COMMENT ON COLUMN documents.eml_storage_path IS 'Storage path to archived .eml file (MIME content)';
COMMENT ON COLUMN documents.eml_file_hash IS 'SHA-256 hash of .eml file for integrity verification';
