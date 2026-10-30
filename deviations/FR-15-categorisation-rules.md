# Deviation – FR-15 categorisation rules

| | |
|---|---|
| Date | 27-10-2026 |
| Requirement / design | FR-15, SAD CMP-07 (`fn_categorize`) |
| Document says | Category chosen by a PostgreSQL function `fn_categorize` |
| What we did | The same rule lookup is one parameterised query in `src/lib/db/rules.ts` (`categorize()`): user rule first, then priority, then the longest matching keyword |
| Why | Keeps all SQL in the data-access layer where it is unit-tested with the rest of the import code; no behaviour change |
| Author | Madhusudhan P |
