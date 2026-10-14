# WealthWise – Wealth Management System

A web application for Indian households to track **net worth, loans, EMIs and expenses** in one place.

WealthWise records your assets, loans and day-to-day transactions, then answers questions like:

- What am I worth today, and is it going up or down?
- How much of my home loan have I actually repaid?
- How much interest would a ₹5 lakh prepayment save?
- Where does my money go each month, and which costs repeat?
- If the RBI raises rates, how do my EMIs change?

> **Note:** WealthWise is a record-keeping and analysis tool. It does not move money, connect to banks or credit bureaus, or give financial advice. The credit score is derived only from repayment records inside WealthWise.

---

## Team

| Member | Role |
|---|---|
| Madhusudhan P | Requirements & UAT Lead (SRS) |
| Nishant Nag | Architecture & Integration Lead (SAD) |
| Likith Kumar | Test Lead (STP) |
| Vasu Tripathi | Security & Traceability Lead |

---

## Features

| Area | What it does |
|---|---|
| **Accounts & roles** | Sign up / log in; two roles – *Individual* and *Advisor* |
| **Assets** | Gold, property, equity, mutual funds, EPF, PPF, FD, vehicle, cash, other; liquidity tagging; valuation history |
| **Loans & EMIs** | Automatic reducing-balance EMI schedule; mark EMIs paid; overdue detection; payoff progress |
| **Prepayment** | Compare "reduce tenure" vs "reduce EMI"; apply a prepayment, optionally funded from an asset |
| **Ledger** | Record income, expenses and asset/loan movements; filter; full-text search |
| **Statement import** | Upload a bank CSV (HDFC, ICICI, SBI, Axis, Kotak layouts) → preview → atomic commit with duplicate detection |
| **Categorisation** | Keyword rules; your own rules override system rules |
| **Receipt scanning** | Photo of a receipt → OCR extracts merchant, amount and date → confirm as an expense |
| **Document vault** | Store loan papers, deeds and receipts with tags and search |
| **Dashboard** | Net worth trend, asset allocation, loan progress, upcoming dues, cash flow, recurring expenses |
| **Insights** | Derived credit score (300–900), loan product comparison, what-if net worth projection |
| **Reports** | Financial-year (April–March) report with indicative tax hints; downloadable PDF net worth statement |
| **Reminders** | In-app EMI reminders for upcoming and overdue installments |
| **News** | RBI press releases with the EMI impact of rate changes on your floating-rate loans |
| **Advisor view** | Advisors see summaries of their assigned clients only |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Recharts |
| Backend | Next.js route handlers (Node.js 20+), TypeScript |
| Validation | Zod |
| Auth | bcrypt (12 rounds), JWT (HS256) in an httpOnly cookie |
| Relational DB | PostgreSQL 14+ (16 recommended) – system of record |
| Document DB | MongoDB 6+ (optional) – raw imports, documents, valuation history, news cache |
| OCR | tesseract.js (runs on the server) |
| PDF | pdfkit |
| Testing | Node.js test runner via `tsx` |

---

## Architecture

WealthWise uses a **layered architecture**. Each layer only calls the one directly below it.

```
Browser (React pages)
      │  calls /api/* only
      ▼
API layer – auth check · input validation · error mapping
      ▼
Service layer – business logic (auth, import, OCR, vault, news, PDF)
      ▼
Data-access layer – parameterised SQL / MongoDB driver
      ▼
PostgreSQL (core data, functions, triggers, views)  +  MongoDB (optional)
```

Financial calculations (EMI, schedules, net worth, prepayment, credit score) run inside PostgreSQL as functions, a procedure and triggers. This means every screen and report shows the same figure.

Full details: **Software Architecture and Design Specification (SAD)**.

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- PostgreSQL 14 or later
- MongoDB 6 or later *(optional – vault, valuation history and news cache need it; everything else works without it)*

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Configure `.env`

```ini
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/wealthwise
MONGODB_URI=mongodb://127.0.0.1:27017     # optional
MONGODB_DB=wealthwise
JWT_SECRET=<at least 32 random characters> # e.g. openssl rand -base64 48
JWT_EXPIRES_IN=7d
```

Never commit `.env`. All secrets come from environment variables.

### 3. Set up the database

```bash
createdb wealthwise
npm run db:migrate     # apply all migrations
npm run db:seed        # load demo data
```

`npm run db:reset` drops everything, re-migrates and re-seeds in one step.

MongoDB via Docker (optional):

```bash
docker run -d -p 27017:27017 --name wealthwise-mongo mongo:7
```

### 4. Run

```bash
npm run dev                      # http://localhost:3000
# or
npm run build && npm start
```

### Demo accounts (after seeding)

| Email | Password | Role |
|---|---|---|
| priya@wealthwise.dev | password123 | Individual |
| rahul@wealthwise.dev | password123 | Individual |
| advisor@wealthwise.dev | password123 | Advisor (assigned both) |

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and start |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Reset, migrate and seed |
| `npm test` | Unit + database tests (uses a separate `wealthwise_test` database) |
| `npm run docs:generate` | Regenerate schema diagrams and the data dictionary |

---

## Project Structure

```
src/
  app/
    (app)/            authenticated pages: dashboard, assets, loans, transactions,
                      import, vault, insights, reports, news, advisor
    api/              route handlers (auth, assets, loans, emi, transactions,
                      imports, receipts, rules, vault, dashboard, insights,
                      reports, notifications, news, advisor, dues)
    login/  signup/   public pages
  components/         UI components and charts
  lib/
    auth/             JWT, password hashing, session, cookie
    db/               data-access modules (one per entity)
    services/         import, CSV parser, OCR, vault, news, PDF, valuation
    validation/       Zod schemas
db/migrations/        ordered SQL migrations
scripts/              migrate, seed, test-db, generate-docs
tests/                unit and database tests
docs/                 data dictionary, diagrams
```

---

## API Overview

All endpoints are under `/api`. All except sign-up, login, logout and `/api/auth/me` require a session.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Assets | `GET/POST /assets`, `GET/PUT/DELETE /assets/{id}` |
| Loans | `GET/POST /loans`, `GET/PUT/PATCH/DELETE /loans/{id}`, `GET /loans/{id}/schedule` |
| EMI & dues | `POST /emi/{id}/pay`, `GET /dues` |
| Prepayment | `POST /loans/{id}/prepay/simulate`, `POST /loans/{id}/prepay` |
| Ledger | `GET/POST /transactions`, `DELETE /transactions/{id}` |
| Import | `POST /imports/preview`, `POST /imports/commit`, `GET /imports/batches` |
| Rules | `GET/POST /rules`, `DELETE /rules/{id}` |
| Receipts | `POST /receipts/scan`, `POST /receipts/confirm` |
| Vault | `GET/POST /vault`, `DELETE /vault/{id}` |
| Dashboard | `GET /dashboard` |
| Insights | `GET /insights/score`, `POST /insights/recommend`, `GET /insights/projection` |
| Reports | `GET /reports/fy`, `GET /reports/statement` |
| Notifications | `GET/POST /notifications` |
| News | `GET /news`, `GET /news/{id}/impact`, `POST /news/refresh` *(advisor)* |
| Advisor | `GET /advisor/clients` *(advisor)* |

**Common error codes:**

| Code | Meaning |
|---|---|
| 401 | Not signed in |
| 403 | Wrong role, or not your client |
| 404 | Not found, or not yours |
| 409 | Duplicate or conflict |
| 413 | File too large |
| 415 | Wrong file type |
| 422 | Validation failed |
| 503 | MongoDB or news feed unavailable |

Request and response details are in the SAD, §4.3.

---

## Security

- Passwords are hashed with bcrypt (cost 12) and never returned or logged.
- Sessions use a signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Login gives the same error for "no such user" and "wrong password".
- Every query is parameterised and filtered by the owner's user id. Users cannot access each other's data.
- Advisors can read only clients assigned to them.
- Input is validated at the API (Zod) and again by database constraints.
- Uploads have type and size limits: CSV ≤ 5 MB, receipts ≤ 8 MB, vault ≤ 10 MB.
- The PAN is masked on the PDF statement.

**Known open items:**
- Login rate limiting.
- Authenticated download for vault files.
- Restricting Advisor self-registration.

See SAD §3.7 and §4.6.

---

## Testing

```bash
npm test
```

- Runs unit tests (CSV parsing, receipt extraction, news parsing) and database tests (EMI maths, atomic payments, imports, triggers, score, prepayment, reports) against a separate test database.
- The full test strategy and 59 planned test cases are in the **Software Test Plan (STP)**.

---

## Documentation

| Document | Contents |
|---|---|
| `WealthWise_SRS_v1.0.docx` | Requirements: 26 FRs, 7 NFRs, security objectives and requirements, use cases, RTM |
| `WealthWise_SAD_v1.0.docx` | Architecture, components, data stores, sequence diagrams, API design, security architecture |
| `WealthWise_STP_v1.0.docx` | Test strategy, 59 test cases, security testing, cross-document traceability |

---

## What WealthWise Simulates

| Real world | WealthWise |
|---|---|
| Credit bureau score | Score derived from in-app repayment history, clearly labelled |
| Payment gateway | "Mark EMI paid" records the payment; no money moves |
| Bank / Account Aggregator link | User uploads a CSV statement downloaded from their bank |
| Market data | Asset values entered by the user, with history kept |
| Email / SMS alerts | In-app reminders only |

---

## Roadmap

- Login rate limiting and Advisor registration controls
- Authenticated vault file downloads
- Advisor–client assignment from the UI
- Email/SMS reminders
- Account Aggregator integration
- Deployment with HTTPS (hosting to be confirmed)

---

## License

To be confirmed by the team.
