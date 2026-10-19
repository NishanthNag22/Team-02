-- 001_init.sql – base setup.
-- Feature migrations are added by each feature owner as 002_..., 003_..., etc.
-- Rule: never edit a migration that has been merged; add a new one instead.

CREATE TABLE IF NOT EXISTS app_info (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_info (key, value) VALUES ('app', 'WealthWise'), ('schema_version', '1')
ON CONFLICT (key) DO NOTHING;
