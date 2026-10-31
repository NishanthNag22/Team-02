-- 009c_loan_products.sql – illustrative loan-product catalogue for comparison (FR-20).
-- Rates and limits are sample figures for demonstration only, not live lender offers.
CREATE TABLE IF NOT EXISTS loan_products (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lender              TEXT          NOT NULL,
  product_name        TEXT          NOT NULL,
  loan_type           loan_type     NOT NULL,
  min_rate            NUMERIC(5,2)  NOT NULL CHECK (min_rate > 0),
  max_rate            NUMERIC(5,2)  NOT NULL,
  min_score           INTEGER       NOT NULL CHECK (min_score BETWEEN 300 AND 900),
  min_amount          NUMERIC(15,2) NOT NULL CHECK (min_amount > 0),
  max_amount          NUMERIC(15,2) NOT NULL,
  max_tenure_months   INTEGER       NOT NULL CHECK (max_tenure_months BETWEEN 1 AND 480),
  processing_fee_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (processing_fee_pct >= 0),
  UNIQUE (lender, product_name),
  CHECK (max_rate >= min_rate),
  CHECK (max_amount >= min_amount)
);

INSERT INTO loan_products (lender, product_name, loan_type, min_rate, max_rate, min_score, min_amount, max_amount, max_tenure_months, processing_fee_pct) VALUES
  ('Sample Bank A', 'Home Loan Classic',      'home',      8.40, 9.60, 650, 500000, 50000000, 360, 0.50),
  ('Sample Bank B', 'Home Loan Advantage',    'home',      8.55, 9.40, 700, 1000000, 100000000, 360, 0.35),
  ('Sample HFC C',  'Easy Home',              'home',      8.90, 10.75, 600, 300000, 20000000, 300, 1.00),
  ('Sample Bank A', 'Car Loan',               'vehicle',   8.75, 10.50, 650, 100000, 5000000, 84, 0.50),
  ('Sample Bank D', 'Drive Now',              'vehicle',   9.10, 12.00, 600, 100000, 3000000, 84, 1.00),
  ('Sample Bank B', 'Personal Loan Prime',    'personal', 10.50, 16.00, 700, 50000, 4000000, 72, 1.50),
  ('Sample NBFC E', 'Quick Personal Loan',    'personal', 13.00, 24.00, 600, 25000, 1500000, 60, 2.50),
  ('Sample Bank A', 'Education Loan',         'education', 8.50, 11.00, 300, 100000, 7500000, 180, 0.00),
  ('Sample Bank D', 'Gold Loan',              'gold',      8.80, 12.50, 300, 10000, 5000000, 36, 0.50),
  ('Sample Bank B', 'Business Growth Loan',   'business', 11.00, 17.50, 680, 200000, 10000000, 84, 2.00),
  ('Sample NBFC E', 'Business Flexi',         'business', 14.00, 22.00, 620, 100000, 5000000, 60, 2.50),
  ('Sample Bank A', 'Card Balance Transfer',  'credit_card', 14.00, 36.00, 650, 10000, 500000, 24, 1.00)
ON CONFLICT (lender, product_name) DO NOTHING;
