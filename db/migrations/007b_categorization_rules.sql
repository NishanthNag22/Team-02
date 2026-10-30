-- 007b_categorization_rules.sql – keyword rules that categorise transactions (FR-15)
-- user_id NULL = a system rule shared by everyone; a user's own rule always wins over system rules.
CREATE TABLE IF NOT EXISTS categorization_rules (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT      REFERENCES users(id) ON DELETE CASCADE,
  keyword    TEXT        NOT NULL CHECK (length(trim(keyword)) >= 2),
  category   TEXT        NOT NULL CHECK (length(trim(category)) > 0),
  txn_type   txn_type    NOT NULL DEFAULT 'expense',
  priority   INTEGER     NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 999),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE (user_id, keyword) would not work for system rules, because NULL never equals NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_user_keyword ON categorization_rules (user_id, upper(keyword)) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_system_keyword ON categorization_rules (upper(keyword)) WHERE user_id IS NULL;

INSERT INTO categorization_rules (user_id, keyword, category, txn_type, priority) VALUES
  (NULL, 'SALARY', 'Salary', 'income', 10),
  (NULL, 'INTEREST', 'Interest', 'income', 50),
  (NULL, 'DIVIDEND', 'Investments', 'income', 50),
  (NULL, 'SWIGGY', 'Food', 'expense', 10),
  (NULL, 'ZOMATO', 'Food', 'expense', 10),
  (NULL, 'RESTAURANT', 'Food', 'expense', 60),
  (NULL, 'BIG BAZAAR', 'Groceries', 'expense', 10),
  (NULL, 'DMART', 'Groceries', 'expense', 10),
  (NULL, 'BLINKIT', 'Groceries', 'expense', 10),
  (NULL, 'AMAZON', 'Shopping', 'expense', 20),
  (NULL, 'FLIPKART', 'Shopping', 'expense', 20),
  (NULL, 'MYNTRA', 'Shopping', 'expense', 20),
  (NULL, 'APOLLO', 'Health', 'expense', 10),
  (NULL, 'PHARMACY', 'Health', 'expense', 30),
  (NULL, 'HOSPITAL', 'Health', 'expense', 30),
  (NULL, 'INDIAN OIL', 'Fuel', 'expense', 10),
  (NULL, 'HPCL', 'Fuel', 'expense', 10),
  (NULL, 'PETROL', 'Fuel', 'expense', 30),
  (NULL, 'BESCOM', 'Utilities', 'expense', 10),
  (NULL, 'ELECTRICITY', 'Utilities', 'expense', 30),
  (NULL, 'AIRTEL', 'Utilities', 'expense', 10),
  (NULL, 'JIO', 'Utilities', 'expense', 10),
  (NULL, 'RENT', 'Rent', 'expense', 40),
  (NULL, 'UBER', 'Transport', 'expense', 10),
  (NULL, 'OLA', 'Transport', 'expense', 15),
  (NULL, 'NETFLIX', 'Entertainment', 'expense', 10),
  (NULL, 'EMI', 'EMI Payment', 'loan', 20),
  (NULL, 'UPI', 'Transfers', 'expense', 900)
ON CONFLICT DO NOTHING;
