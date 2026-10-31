-- 008_documents.sql – document vault metadata (FR-17). File bytes live in the private uploads/ folder.
CREATE TABLE IF NOT EXISTS documents (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  file_name    TEXT        NOT NULL,
  stored_name  TEXT        NOT NULL UNIQUE,
  mime_type    TEXT        NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes   INTEGER     NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  loan_id      BIGINT      REFERENCES loans(id) ON DELETE SET NULL,
  asset_id     BIGINT      REFERENCES assets(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);