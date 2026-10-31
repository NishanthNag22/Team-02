# Deviation – NFR-04 graceful degradation without MongoDB

| | |
|---|---|
| Date | 28-10-2026 |
| Requirement / design | NFR-04, SAD DS-02 (MongoDB, optional), CMP-16 |
| Document says | Vault, valuation history, raw imports and news cache use MongoDB; when it is down those features show "unavailable" and the connection is not retried for 60 s |
| What we did | MongoDB is not used. Valuation history (FR-06), imports (FR-14), vault metadata (FR-17) and the news cache (FR-25) are PostgreSQL tables. The parts that can still fail on their own degrade as NFR-04 asks: |
| | • Vault storage folder not writable → `503 "The document vault is unavailable"` (tested in `tests/db/vault.test.ts`) |
| | • RBI feed unreachable → cached articles with a notice, or clearly labelled illustrative samples; no retry for 60 s after a failure (`src/lib/db/news.ts`) |
| | • Receipt filing in the vault fails → the expense is still saved and the reply says the image was not filed |
| Why | A second database added setup work for every team member and the CI pipeline without adding a feature. Auth, assets, loans, EMI payment, ledger, dashboard and import commit never depend on an optional service, which is the goal of NFR-04 |
| Author | Likith Kumar |