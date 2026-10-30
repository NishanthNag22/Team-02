# Deviation – FR-19 score recomputation

| | |
|---|---|
| Date | 28-10-2026 |
| Requirement / design | FR-19, SAD CMP-11 |
| Document says | Score recomputed (by trigger) whenever EMI payment status changes |
| What we did | The score is computed each time it is requested (`GET /api/insights/score`); a history row is added only when the score or a factor changed |
| Why | Gives the same history without a trigger on every EMI update, and an overdue EMI (which happens by date, not by an update) is still picked up |
| Author | Nishant Nag |
