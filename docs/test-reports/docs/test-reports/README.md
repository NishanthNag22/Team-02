# WealthWise – Test Reports (Deliverables Part-3)

Run date: **02-11-2026** · Build: `main` after PR #77 plus the testing-week tests · Test plan: `WealthWise_STP_v1.1.docx`

| Report | Result |
|---|---|
| [Unit Test Report](Unit_Test_Report.pdf) | 73/73 unit and 54/54 database integration tests passed |
| [System Validation Report](System_Validation_Report.pdf) | 59/59 STP test cases + 5 supplementary checks passed; 53/53 API operations exercised; 0 open defects |
| [Code Coverage Report](Code_Coverage_Report.pdf) | `src/lib`: 96.9 % statements, 96.9 % lines, 93.8 % functions |
| [Branch Coverage Report](Branch_Coverage_Report.pdf) | `src/lib`: 85.0 % branches (1002 / 1178) |

- `coverage-html/index.html` – interactive coverage report (open in a browser).
- `raw/` – test runner output, JUnit XML, coverage summary and the system-validation results the reports were built from.
- `scripts/` – the system-validation run (`system-validation.mjs`) and UI checks (`ui-checks.cjs`). They need a running production build, Linux tools (`pdftotext`) and Playwright.

Reproduce the unit, integration and coverage results:

```bash
npm run test:coverage
```
