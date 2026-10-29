# Deviation – FR-06 valuation history storage

| | |
|---|---|
| Date | 22-10-2026 |
| Requirement / design | FR-06, SAD DS-02 |
| Document says | Asset valuation history stored in MongoDB (`asset_valuation_history`) |
| What we did | Stored in a PostgreSQL table `asset_valuations` |
| Why | MongoDB is optional and not set up on all team machines; PostgreSQL saves history in the same transaction as the asset change |
| Author | Madhusudhan P |
