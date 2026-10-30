-- 009_prepayments.sql – loan prepayments (FR-11)
DO $$ BEGIN
  CREATE TYPE prepayment_mode AS ENUM ('reduce_tenure', 'reduce_emi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS loan_prepayments (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id               BIGINT          NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id               BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount                NUMERIC(15,2)   NOT NULL CHECK (amount > 0),
  mode                  prepayment_mode NOT NULL,
  funded_from_asset_id  BIGINT          REFERENCES assets(id) ON DELETE SET NULL,
  outstanding_before    NUMERIC(15,2)   NOT NULL,
  outstanding_after     NUMERIC(15,2)   NOT NULL CHECK (outstanding_after >= 0),
  emi_before            NUMERIC(15,2)   NOT NULL,
  emi_after             NUMERIC(15,2)   NOT NULL,
  months_before         INTEGER         NOT NULL,
  months_after          INTEGER         NOT NULL,
  interest_saved        NUMERIC(15,2)   NOT NULL,
  prepaid_on            DATE            NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT prepayment_reduces_balance CHECK (outstanding_after = outstanding_before - amount)
);

CREATE INDEX IF NOT EXISTS idx_prepayments_loan ON loan_prepayments (loan_id, prepaid_on);
