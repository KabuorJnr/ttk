# Transparent Tenders Kenya (TTK) — e-GP Portal

> **"Every tender tracked. Every shilling accounted for."**

A digital public procurement platform integrating all **47 Kenya counties** and the **national government** into a single transparent tendering ecosystem. TTK combines AI-powered fraud detection, an immutable blockchain procurement ledger, and open data APIs to enable citizen oversight and fight corruption.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Frontend Pages](#frontend-pages)
- [Tender Lifecycle](#tender-lifecycle)
- [AI Fraud Detection](#ai-fraud-detection)
- [Blockchain Ledger](#blockchain-ledger)
- [Deployment](#deployment)
- [Legal Framework](#legal-framework)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| 🏛️ **Full Procurement Lifecycle** | Draft → Published → Bidding → Evaluation → Awarded → Completed |
| 🤖 **AI Fraud Detection** | Detects shared directors, price inflation, repeat winners, bid collusion, and blacklisted bidders |
| ⛓️ **Blockchain Ledger** | Immutable SHA-256 hash chain recording every procurement event |
| 🗺️ **47 Counties** | Complete coverage of all Kenya counties and national government entities |
| 📊 **Transparency Dashboard** | Real-time county rankings, procurement metrics, and oversight statistics |
| 🔎 **Open Data APIs** | 40+ RESTful endpoints for citizens, media, and civil society |
| 🏦 **Payment Tracking** | Milestone-based payment records against active contracts |
| 🧾 **Audit Trail** | Every write operation logged with actor, action, IP, and timestamp |
| 🔐 **Security Hardened** | Helmet headers, CORS, rate limiting, parameterized SQL queries |
| 🔗 **Government Integration** | Simulated KRA tax compliance and BRS company registration verification |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  TTK e-GP Portal                    │
│         (public/index.html — SPA Frontend)          │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │Dashboard │ Tenders  │Contractors│ Counties │      │
│  │Blockchain│  Fraud   │  Admin   │  Search  │      │
│  └──────────┴──────────┴──────────┴──────────┘      │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP (JSON)
┌───────────────────────┴─────────────────────────────┐
│              Express.js API Server                   │
│               (transparent.js)                       │
│  ┌──────────┬──────────┬──────────┐                  │
│  │ REST API │AI Fraud  │Blockchain│                  │
│  │ 40+ endp.│ Engine   │ Ledger   │                  │
│  └──────────┴──────────┴──────────┘                  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────┐
│              SQLite (via sql.js WASM)                │
│                    ttk.db                            │
│  12 tables · 12 indexes · blockchain ledger          │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 18+ | Server-side JavaScript |
| **Framework** | Express.js 4.x | HTTP API server |
| **Database** | SQLite via sql.js (WASM) | Zero-dependency embedded database |
| **Security** | helmet, cors, express-rate-limit | HTTP security headers, CORS, rate limiting |
| **Crypto** | crypto-js (SHA-256) | Blockchain hash computation |
| **IDs** | uuid v4 | Universally unique identifiers |
| **Frontend** | Vanilla HTML/CSS/JS | Single-page application, no build step |
| **Charts** | Chart.js 4.x (CDN) | Dashboard visualizations |

---

## Project Structure

```
transparent-tenders-ke/
├── transparent.js        # Main server — Express API, blockchain, fraud engine
├── seed.js               # Database seeder (47 counties + demo data)
├── package.json          # Dependencies and npm scripts
├── vercel.json           # Vercel serverless deployment config
├── DOCS.md               # Full technical documentation
├── README.md             # This file
└── public/               # e-GP Portal frontend (SPA)
    ├── index.html        # SPA shell (header, nav, footer, modals)
    ├── css/
    │   └── style.css     # Complete stylesheet (Kenya flag color palette)
    └── js/
        └── app.js        # Hash-based routing + all page renderers
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with 47 counties and demo data
npm run seed

# 3. Start the server
npm start
```

The portal is now live at **http://localhost:3000**.

### Quick Access

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | e-GP Portal (frontend SPA) |
| `http://localhost:3000/api/health` | System health check |
| `http://localhost:3000/api/info` | Full API endpoint listing |
| `http://localhost:3000/api/dashboard/overview` | Dashboard statistics |
| `http://localhost:3000/api/tenders` | Tenders registry |
| `http://localhost:3000/api/contractors` | Contractors database |
| `http://localhost:3000/api/blockchain/chain` | Blockchain ledger |
| `http://localhost:3000/api/fraud/alerts` | AI fraud detection alerts |

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npm start` | Start the server (`node transparent.js`) |
| `dev` | `npm run dev` | Same as start (development alias) |
| `seed` | `npm run seed` | Populate the database with demo data |
| `vercel-build` | `npm run vercel-build` | Build step for Vercel deployment |

---

## API Overview

The API provides 40+ RESTful JSON endpoints. Below is a high-level summary — see [`DOCS.md`](DOCS.md) for the full reference.

### Counties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/counties` | List all 47 counties |
| GET | `/api/counties/:id` | Get county details |
| GET | `/api/counties/:id/stats` | County procurement statistics |

### Contractors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contractors` | List contractors (filter: category, blacklisted, search) |
| GET | `/api/contractors/:id/profile` | Full profile with risk score |
| POST | `/api/contractors` | Register new contractor |
| PATCH | `/api/contractors/:id/blacklist` | Blacklist or unblacklist |

### Tenders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenders` | List tenders (filter: status, county, category, search) |
| GET | `/api/tenders/:id` | Tender detail with bids, award, fraud alerts, blockchain trail |
| POST | `/api/tenders` | Create new tender (draft) |
| PATCH | `/api/tenders/:id/publish` | Publish draft tender |
| PATCH | `/api/tenders/:id/evaluate` | Start evaluation + trigger AI fraud scan |

### Fraud Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fraud/analyze/:tenderId` | Run AI analysis on a specific tender |
| POST | `/api/fraud/scan` | Full system-wide fraud scan |
| GET | `/api/fraud/alerts` | List alerts (filter: status, severity) |
| GET | `/api/fraud/risk/:contractorId` | Get contractor risk score |

### Blockchain
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/chain` | Browse the full ledger |
| GET | `/api/blockchain/verify` | Verify chain integrity |
| GET | `/api/blockchain/block/:index` | Inspect a specific block |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | System-wide statistics |
| GET | `/api/dashboard/county/:id` | County-specific dashboard |
| GET | `/api/dashboard/rankings` | County transparency rankings |
| GET | `/api/dashboard/search?q=` | Cross-entity global search |

### Quick Examples

```bash
# List open tenders accepting bids
curl http://localhost:3000/api/tenders?status=bidding

# Search contractors by name
curl "http://localhost:3000/api/contractors?search=Mega"

# Verify blockchain integrity
curl http://localhost:3000/api/blockchain/verify

# Run full AI fraud scan
curl -X POST http://localhost:3000/api/fraud/scan

# County transparency rankings
curl http://localhost:3000/api/dashboard/rankings
```

---

## Frontend Pages

The portal is a vanilla JavaScript SPA using hash-based routing (`#/route`). No build step required.

| Route | Page | Description |
|-------|------|-------------|
| `#/` | Home | Overview with quick stats, charts, county grid |
| `#/dashboard` | Dashboard | Transparency metrics and county rankings |
| `#/tenders` | Tenders | Browse, search, and filter all tenders |
| `#/tenders/:id` | Tender Detail | Bids, award, fraud alerts, blockchain trail |
| `#/contractors` | Contractors | Registry with search, filter, and risk badges |
| `#/contractors/:id` | Contractor Profile | Full profile with risk score and performance |
| `#/counties` | Counties | All 47 counties grouped by region |
| `#/counties/:id` | County Detail | County procurement breakdown |
| `#/blockchain` | Blockchain | Chain viewer and integrity verification |
| `#/fraud` | Fraud Alerts | AI alert list with on-demand scan |
| `#/admin` | Admin Panel | Create tenders, manage lifecycle, audit log |

---

## Tender Lifecycle

```
DRAFT → PUBLISHED → BIDDING → EVALUATION → AWARDED → COMPLETED
                                    ↓
                              [AI Fraud Scan]
                                    ↓
                            Fraud Alerts Generated
```

1. **Draft** — Entity creates tender via the Admin panel
2. **Published** — Tender is made visible on the public portal
3. **Bidding** — Contractors submit bids (deadline enforced)
4. **Evaluation** — Bids scored (technical 70% + financial 30%); AI fraud scan runs automatically
5. **Awarded** — Contract issued to the highest-scoring compliant bid
6. **Completed** — Project reaches 100% completion

A tender can be **Cancelled** with a reason at any non-terminal stage.

---

## AI Fraud Detection

The `FraudDetectionEngine` automatically analyses procurement data for five fraud patterns:

| Pattern | Trigger | Severity |
|---------|---------|----------|
| **Shared Directors** | Multiple bidders on the same tender share board members | High |
| **Price Inflation** | Bid exceeds 150% of category historical average | Medium-Critical |
| **Repeat Winners** | Same contractor wins 3+ tenders from one entity in 12 months | High |
| **Blacklisted Bidder** | Any bid submitted by a debarred company | Critical |
| **Suspicious Bid Patterns** | Two bids differ by less than 1% (collusion signal) | High |

### Contractor Risk Score

Each contractor receives a composite risk score (0–100):
- Low alerts: +5 pts each
- Medium alerts: +15 pts each
- High alerts: +30 pts each
- Critical alerts: +50 pts each

Risk levels: **Low** (<20) · **Medium** (20–39) · **High** (40–69) · **Critical** (70+)

---

## Blockchain Ledger

Every significant procurement event is appended as an immutable block:

| Event Type | Trigger |
|-----------|---------|
| `CONTRACTOR_REGISTERED` | New contractor registration |
| `CONTRACTOR_BLACKLISTED` | Company blacklisted |
| `TENDER_CREATED` | Tender created |
| `TENDER_PUBLISHED` | Tender published to portal |
| `BID_SUBMITTED` | Bid received |
| `BID_SCORED` | Bid evaluated |
| `CONTRACT_AWARDED` | Contract awarded |
| `PAYMENT_MADE` | Payment processed |
| `PROJECT_COMPLETED` | Project finalised |

### Block Structure

Each block contains:
- `block_index` — Sequential integer
- `timestamp` — ISO 8601 UTC
- `event_type` — Event classification
- `data_hash` — SHA-256 of event data JSON
- `previous_hash` — Hash of the preceding block (genesis = 64 zeros)
- `block_hash` — SHA-256 of all block fields

`GET /api/blockchain/verify` recomputes all hashes and validates the full chain. Any tampered block produces a hash mismatch, providing tamper evidence.

---

## Deployment

### Local

```bash
npm install && npm run seed && npm start
# → http://localhost:3000
```

### Vercel (Serverless)

The project is pre-configured for Vercel deployment via `vercel.json`:

```bash
# Install Vercel CLI (once)
npm install -g vercel

# Deploy
vercel
```

The serverless function handler lives in `api/index.js`. The configuration sets a 30-second function timeout and bundles `ttk.db`, `transparent.js`, `seed.js`, and the sql.js WASM binary.

### Environment Variables

No environment variables are required for basic operation. The server listens on `process.env.PORT` (default `3000`) for cloud deployments.

---

## Seed Data

Running `npm run seed` populates the database with realistic demo data:

| Entity | Count | Notes |
|--------|-------|-------|
| Counties | 47 | All Kenya counties with codes and regions |
| Procuring Entities | 14 | National ministries, county governments, agencies |
| Contractors | 10 | Various categories; 1 blacklisted; planted fraud signals |
| Tenders | 8 | Various statuses across the full lifecycle |
| Bids | 14 | Technical and financial scores |
| Awards | 3 | Active and completed contracts |
| Payments | 5 | Milestone-based payment records |
| Blockchain Blocks | ~30 | Complete event history |

### Planted Fraud Signals (for demo)

- **Shared Directors:** *Megastructures Ltd* and *Urban Planners Consult* share director "James Mwangi"
- **Shared Directors:** *Megastructures Ltd* and *Rift Valley Constructors* share director "Peter Otieno"
- **Blacklisted Bidder:** *SafeGuard Security Ltd* — failed to deliver on a KES 50M security contract

---

## Legal Framework

TTK operates within Kenya's public procurement legal framework:

- **Public Procurement and Asset Disposal Act, 2015** — Primary procurement legislation
- **Access to Information Act, 2016** — Constitutional right to government information
- **Constitution of Kenya, Article 227** — Fair, equitable, transparent procurement
- **Public Finance Management Act, 2012** — Financial accountability requirements
- **Prevention of Corruption Act** — Anti-corruption obligations

---

## Further Reading

Full technical documentation including the complete database schema, all 40+ API endpoints, and security implementation details is available in [**DOCS.md**](DOCS.md).

---

## License

[MIT](https://opensource.org/licenses/MIT) — Republic of Kenya
