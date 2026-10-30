# Deviation – FR-11 prepayment

| | |
|---|---|
| Date | 27-10-2026 |
| Requirement / design | FR-11, SAD CMP-11 (`sp_apply_prepayment`) |
| Document says | Prepayment applied by a PostgreSQL stored procedure |
| What we did | Same steps in one database transaction in `src/lib/db/prepayments.ts` (lock loan → check amount → deduct funding asset → regenerate unpaid installments → ledger entry → prepayment record). The maths is in `src/lib/services/prepayment.ts` |
| Why | The EMI maths already lives in TypeScript (FR-07 deviation); keeping prepayment next to it means one implementation and unit tests without a database. Atomicity (NFR-03) is unchanged – any failure rolls back everything |
| Also | Outstanding is now "balance before the next unpaid EMI" so it stays right after a prepayment |
| Author | Nishant Nag |
