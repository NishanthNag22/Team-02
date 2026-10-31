-- 011_transaction_links.sql – keep ledger history when an asset or loan is deleted (FR-05, FR-08)
-- A transaction's link to a deleted asset/loan becomes NULL instead of pointing at a row that no longer exists.

-- Clear links that already point at deleted rows, so the constraints can be added.
UPDATE transactions t SET related_asset_id = NULL
 WHERE related_asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = t.related_asset_id);
UPDATE transactions t SET related_loan_id = NULL
 WHERE related_loan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.id = t.related_loan_id);

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT transactions_related_asset_fk
    FOREIGN KEY (related_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT transactions_related_loan_fk
    FOREIGN KEY (related_loan_id) REFERENCES loans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
