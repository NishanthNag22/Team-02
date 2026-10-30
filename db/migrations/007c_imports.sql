-- 007c_imports.sql – bank statement imports with duplicate protection (FR-14)
CREATE TABLE IF NOT EXISTS import_batches (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name   TEXT        NOT NULL,
  bank        TEXT        NOT NULL,
  row_count   INTEGER     NOT NULL,
  inserted    INTEGER     NOT NULL DEFAULT 0,
  duplicates  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_hash TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_batch_id BIGINT REFERENCES import_batches(id) ON DELETE SET NULL;

-- Re-importing the same statement can never create duplicates: the database refuses them.
-- Partial, so manually entered rows (no hash) may repeat freely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_import_hash ON transactions (user_id, import_hash) WHERE import_hash IS NOT NULL;
