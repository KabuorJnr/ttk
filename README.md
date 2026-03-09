# Transparent Tenders Kenya (TTK) — e-GP Portal

> *"Every tender tracked. Every shilling accounted for."*

A digital public procurement platform integrating all **47 Kenya counties** and the **national government** into a single transparent tendering ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Features

- **AI-Powered Fraud Detection** — Automatically detects shared directors, price inflation, repeat winners, blacklisted bidders, and bid collusion patterns
- **Blockchain Procurement Ledger** — Immutable SHA-256 hash-chain recording every procurement event
- **Open Data APIs** — 40+ RESTful JSON endpoints for citizens, media, civil society, and oversight bodies
- **Citizen Oversight Dashboard** — Real-time transparency metrics, county rankings, and searchable procurement data
- **Government Integration** — Simulated KRA (tax compliance) and BRS (company registration) verification

---

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
# Install dependencies
npm install

# Seed the database with 47 counties and demo data
npm run seed

# Start the server
npm start
```

The portal is then available at **http://localhost:3000**.

| URL | Description |
|-----|-------------|
| http://localhost:3000 | e-GP Portal (frontend) |
| http://localhost:3000/api/health | Health check |
| http://localhost:3000/api/dashboard/overview | Dashboard overview |
| http://localhost:3000/api/info | Full API endpoint listing |

---

## Project Structure

```
transparent-tenders-ke/
├── transparent.js        # Main server — API, blockchain, fraud detection
├── seed.js               # Database seeder (47 counties + demo data)
├── package.json          # Dependencies and npm scripts
├── vercel.json           # Vercel serverless deployment config
├── api/
│   └── index.js          # Vercel serverless entry point
├── DOCS.md               # Full technical documentation
└── public/               # e-GP Portal frontend (SPA)
    ├── index.html         # Application shell
    ├── css/style.css      # Stylesheet
    └── js/app.js          # SPA routing and page renderers
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Framework | Express.js 4.x |
| Database | SQLite via sql.js (WASM) |
| Security | helmet, cors, express-rate-limit |
| Crypto | crypto-js (SHA-256) |
| IDs | uuid v4 |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Charts | Chart.js 4.x (CDN) |

---

## API Overview

The server exposes a comprehensive REST API. Key endpoint groups:

| Group | Base Path | Description |
|-------|-----------|-------------|
| Counties | `/api/counties` | All 47 Kenya counties and their stats |
| Entities | `/api/entities` | Procuring entities (ministries, county govts) |
| Contractors | `/api/contractors` | Registered contractors and risk profiles |
| Tenders | `/api/tenders` | Procurement opportunities and lifecycle management |
| Bids | `/api/tenders/:id/bids` | Bid submission and scoring |
| Awards | `/api/tenders/:id/award` | Contract awards and progress tracking |
| Payments | `/api/awards/:id/payments` | Payment recording and listing |
| Fraud | `/api/fraud` | AI fraud scan, alerts, and contractor risk scores |
| Blockchain | `/api/blockchain` | Chain browsing and integrity verification |
| Dashboard | `/api/dashboard` | Overview stats, county rankings, and search |
| Integrations | `/api/integrations` | KRA and BRS verification (simulated) |
| Audit | `/api/audit` | System-wide audit log |

See [DOCS.md](DOCS.md) for the complete API reference with request/response details and example `curl` commands.

---

## Tender Lifecycle

```
DRAFT → PUBLISHED → BIDDING → EVALUATION → AWARDED → COMPLETED
                                    ↓
                              [AI Fraud Scan]
                                    ↓
                            Fraud Alerts Generated
```

---

## Deployment

The application is configured for **Vercel** serverless deployment:

```bash
vercel deploy
```

The `vercel.json` routes all `/api/*` requests to the serverless function in `api/index.js`, which lazily boots the Express application.

---

## Documentation

Full technical documentation is available in **[DOCS.md](DOCS.md)**, including:

- Architecture diagram and technology stack
- Complete database schema (12 tables)
- Full API reference (40+ endpoints)
- AI fraud detection algorithms
- Blockchain ledger structure and verification
- Frontend SPA page reference
- Security measures
- Seed data details
- Legal framework

---

## License

[MIT](LICENSE) — Republic of Kenya
