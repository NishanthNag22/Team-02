# Deviation – FR-18 net worth snapshot refresh

| | |
|---|---|
| Date | 22-10-2026 |
| Requirement / design | FR-18, SAD CMP-10 |
| Document says | Net worth snapshot refreshed by database triggers when assets, loans or EMI status change |
| What we did | Today's snapshot is saved (upserted) each time the dashboard loads |
| Why | Simpler to build and test in Sprint-1; the dashboard shows the same figures. Triggers can replace it in Sprint-2 |
| Author | Likith Kumar |