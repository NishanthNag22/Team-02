-- 004_loans.sql – loans and their EMI schedules (FR-07)
DO $$ BEGIN
  CREATE TYPE loan_type AS ENUM ('home','vehicle','personal','education','gold','business','credit_card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE interest_type AS ENUM ('fixed','floating');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('active','closed','defaulted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE emi_status AS ENUM ('pending','overdue','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS loans (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_type     loan_type     NOT NULL,
  lender        TEXT          NOT NULL CHECK (length(trim(lender)) > 0),
  principal     NUMERIC(15,2) NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC(5,2)  NOT NULL CHECK (interest_rate > 0 AND interest_rate <= 60),
  interest_type interest_type NOT NULL DEFAULT 'fixed',
  tenure_months INTEGER       NOT NULL CHECK (tenure_months BETWEEN 1 AND 480),
  start_date    DATE          NOT NULL,
  status        loan_status   NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emi_schedule (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id             BIGINT        NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_no      INTEGER       NOT NULL CHECK (installment_no >= 1),
  due_date            DATE          NOT NULL,
  emi_amount          NUMERIC(15,2) NOT NULL CHECK (emi_amount > 0),
  principal_component NUMERIC(15,2) NOT NULL CHECK (principal_component >= 0),
  interest_component  NUMERIC(15,2) NOT NULL CHECK (interest_component >= 0),
  closing_balance     NUMERIC(15,2) NOT NULL CHECK (closing_balance >= 0),
  status              emi_status    NOT NULL DEFAULT 'pending',
  paid_date           DATE,
  UNIQUE (loan_id, installment_no),
  CONSTRAINT emi_paid_date_consistency CHECK ((status = 'paid') = (paid_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans (user_id);
CREATE INDEX IF NOT EXISTS idx_emi_due_pending ON emi_schedule (due_date) WHERE status IN ('pending','overdue');
