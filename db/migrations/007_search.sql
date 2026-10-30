-- 007_search.sql – full-text search over the ledger (FR-13)
-- A STORED generated column keeps the search vector in sync with every insert/update automatically.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(description, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_txn_search ON transactions USING GIN (search_vector);
