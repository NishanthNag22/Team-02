-- 005_transactions.sql – the ledger of income, expenses and asset/loan movements (FR-12)
DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('income','expense','asset','loan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  txn_type         txn_type      NOT NULL,
  amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  txn_date         DATE          NOT NULL,
  category         TEXT          NOT NULL DEFAULT 'Uncategorized' CHECK (length(trim(category)) > 0),
  description      TEXT,
  related_asset_id BIGINT,
  related_loan_id  BIGINT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions (user_id, txn_date DESC);
