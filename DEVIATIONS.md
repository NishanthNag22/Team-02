# Deviations from SRS / SAD / Test Plan

Each deviation is a separate file in the `deviations/` folder (one per PR, so PRs never conflict).
They are explained during the final demo.

| File | Requirement | Sprint | Summary |
|---|---|---|---|
| deviations/FR-07-emi-schedule.md | FR-07 – EMI schedule generation | 1 | Schedule maths in TypeScript instead of a database function |
| deviations/FR-06-valuation-history.md | FR-06 – valuation history storage | 1 | History kept in PostgreSQL |
| deviations/FR-18-net-worth-snapshot.md | FR-18 – net worth snapshot refresh | 1 | Snapshot saved when the dashboard loads |
| deviations/FR-11-prepayment.md | FR-11 – prepayment | 2 | One database transaction instead of a stored procedure |
| deviations/FR-15-categorisation-rules.md | FR-15 – categorisation rules | 2 | Rule lookup query instead of `fn_categorize` |
| deviations/FR-17-document-vault.md | FR-17 – document vault | 2 | PostgreSQL metadata + private folder instead of MongoDB |
| deviations/FR-19-credit-score.md | FR-19 – score recomputation | 2 | Computed on request instead of by trigger |
| deviations/NFR-04-no-document-store.md | NFR-04 – graceful degradation | 2 | No MongoDB; vault and news degrade on their own |
