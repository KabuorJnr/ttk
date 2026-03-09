# Transparent Tenders Kenya (TTK) — e-GP Portal

## System Documentation v1.0

---

## 1. Overview

**Transparent Tenders Kenya (TTK)** is a digital public procurement platform that integrates all **47 Kenya counties** and the **national government** into a single transparent tendering ecosystem. The platform implements:

- **AI-Powered Fraud Detection** — Automated analysis of shared directors, price inflation, repeat winners, blacklisted bidders, and bid collusion patterns
- **Blockchain Procurement Ledger** — Immutable SHA-256 hash-chain recording every procurement event (tender creation, bid submission, contract award, payment)
- **Open Data Infrastructure** — RESTful JSON APIs for citizens, media, civil society, and oversight bodies
- **Citizen Oversight Dashboard** — Real-time transparency metrics, county rankings, and searchable procurement data
- **Government Integration** — Simulated KRA (tax compliance) and BRS (company registration) verification

---

## 2. Architecture

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

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js 4.x | HTTP API server |
| Database | SQLite via sql.js (WASM) | Zero-dependency embedded database |
| Security | helmet, cors, express-rate-limit | HTTP security headers, CORS, rate limiting |
| Crypto | crypto-js (SHA-256) | Blockchain hash computation |
| IDs | uuid v4 | Universally unique identifiers |
| Frontend | Vanilla HTML/CSS/JS | Single-page application, no build step |
| Charts | Chart.js 4.x (CDN) | Dashboard visualizations |

---

## 3. Project Structure

```
transparent-tenders-ke/
├── transparent.js        # Main server — API, blockchain, fraud detection
├── seed.js               # Database seeder (47 counties + demo data)
├── package.json          # Dependencies and scripts
├── ttk.db                # SQLite database (created at runtime)
├── DOCS.md               # This documentation
└── public/               # e-GP Portal frontend
    ├── index.html         # SPA shell (header, nav, footer, modal)
    ├── css/
    │   └── style.css      # Complete stylesheet
    └── js/
        └── app.js         # SPA routing + all page renderers
```

---

## 4. Getting Started

### Prerequisites
- Node.js 18+ installed

### Installation

```bash
# Install dependencies
npm install

# Seed the database with 47 counties and demo data
npm run seed

# Start the server
npm start
```

### Access Points

| URL | Description |
|-----|------------|
| http://localhost:3000 | e-GP Portal (frontend) |
| http://localhost:3000/api/health | Health check |
| http://localhost:3000/api/dashboard/overview | Dashboard API |
| http://localhost:3000/api/info | API endpoint listing |

---

## 5. Database Schema

### 5.1 Tables

#### `counties` — Kenya's 47 counties
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | County number (1-47) |
| name | TEXT | County name |
| code | TEXT | 3-letter code |
| region | TEXT | Geographic region |

#### `procuring_entities` — Government bodies that issue tenders
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | Entity name |
| type | TEXT | national / county / parastatal / agency |
| county_id | INTEGER FK | Reference to county |
| contact | TEXT | Contact information |

#### `contractors` — Registered companies/bidders
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | Company name |
| registration_no | TEXT UNIQUE | Companies registry number |
| kra_pin | TEXT | Kenya Revenue Authority PIN |
| category | TEXT | Business category |
| directors | TEXT (JSON) | Array of director names |
| ownership | TEXT (JSON) | Beneficial ownership structure |
| is_blacklisted | INTEGER | 0=active, 1=blacklisted |
| blacklist_reason | TEXT | Reason for blacklisting |
| tax_compliant | INTEGER | 0=non-compliant, 1=compliant |

#### `tenders` — Procurement opportunities
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| reference_no | TEXT UNIQUE | TTK-xxxxxx-xxxx format |
| title | TEXT | Tender title |
| description | TEXT | Full description |
| entity_id | TEXT FK | Issuing entity |
| county_id | INTEGER FK | Target county |
| category | TEXT | Procurement category |
| method | TEXT | open / restricted / direct / rfq / rfp |
| estimated_value | REAL | Estimated value in KES |
| status | TEXT | draft→published→bidding→evaluation→awarded→completed |
| published_at | TEXT | Publication timestamp |
| closing_at | TEXT | Bid submission deadline |

#### `bids` — Submitted bids
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| tender_id | TEXT FK | Target tender |
| contractor_id | TEXT FK | Bidding contractor |
| bid_amount | REAL | Bid amount in KES |
| technical_score | REAL | Technical evaluation (0-100) |
| financial_score | REAL | Financial evaluation (0-100) |
| total_score | REAL | Weighted: tech×0.7 + fin×0.3 |
| status | TEXT | submitted / under_review / accepted / rejected |

#### `awards` — Contract awards
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| tender_id | TEXT FK | Awarded tender |
| bid_id | TEXT FK | Winning bid |
| contractor_id | TEXT FK | Winning contractor |
| contract_value | REAL | Contract amount in KES |
| status | TEXT | active / completed / terminated / suspended |
| completion_pct | REAL | 0-100 project completion |

#### `payments` — Payments against contracts
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| award_id | TEXT FK | Target contract |
| amount | REAL | Payment amount in KES |
| milestone | TEXT | Payment milestone name |

#### `blockchain_ledger` — Immutable procurement event chain
| Column | Type | Description |
|--------|------|-------------|
| block_index | INTEGER PK | Sequential block number |
| event_type | TEXT | TENDER_CREATED, BID_SUBMITTED, etc. |
| reference_id | TEXT | ID of related entity |
| data_hash | TEXT | SHA-256 of event data |
| previous_hash | TEXT | Hash of previous block |
| block_hash | TEXT | This block's SHA-256 hash |

#### `fraud_alerts` — AI-generated fraud detection alerts
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| alert_type | TEXT | shared_directors / price_inflation / repeat_winner / blacklisted_bidder / bid_collusion |
| severity | TEXT | low / medium / high / critical |
| tender_id | TEXT FK | Related tender |
| contractor_id | TEXT FK | Related contractor |
| description | TEXT | Human-readable alert description |
| evidence | TEXT (JSON) | Supporting evidence data |
| status | TEXT | open / investigating / resolved / dismissed |

#### `contractor_performance` — Historical project performance
#### `audit_log` — System activity audit trail

---

## 6. API Reference

### 6.1 Counties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/counties` | List all 47 counties |
| GET | `/api/counties/:id` | Get county by ID |
| GET | `/api/counties/:id/stats` | County procurement statistics |

### 6.2 Procuring Entities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entities` | List entities (filter: type, county_id) |
| POST | `/api/entities` | Create new entity |

### 6.3 Contractors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contractors` | List contractors (filter: category, blacklisted, search) |
| GET | `/api/contractors/:id` | Get contractor |
| GET | `/api/contractors/:id/profile` | Full profile with risk score |
| POST | `/api/contractors` | Register new contractor |
| PATCH | `/api/contractors/:id/blacklist` | Blacklist/unblacklist |

### 6.4 Tenders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenders` | List tenders (filter: status, county_id, category, method, search) |
| GET | `/api/tenders/:id` | Full tender detail with bids, award, fraud alerts, blockchain trail |
| POST | `/api/tenders` | Create new tender (draft status) |
| PATCH | `/api/tenders/:id/publish` | Publish draft tender |
| PATCH | `/api/tenders/:id/open-bidding` | Open published tender for bidding |
| PATCH | `/api/tenders/:id/evaluate` | Move to evaluation + trigger AI fraud scan |
| PATCH | `/api/tenders/:id/cancel` | Cancel tender |

### 6.5 Bids
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenders/:tenderId/bids` | Submit bid |
| GET | `/api/tenders/:tenderId/bids` | List bids for tender |
| PATCH | `/api/bids/:id/score` | Score bid (technical + financial) |

### 6.6 Awards
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenders/:tenderId/award` | Award contract to winning bid |
| PATCH | `/api/awards/:id/progress` | Update project completion |

### 6.7 Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/awards/:awardId/payments` | Record payment |
| GET | `/api/awards/:awardId/payments` | List payments for contract |

### 6.8 Fraud Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fraud/analyze/:tenderId` | Run AI analysis on specific tender |
| POST | `/api/fraud/scan` | Run full system-wide fraud scan |
| GET | `/api/fraud/alerts` | List alerts (filter: status, severity) |
| PATCH | `/api/fraud/alerts/:id` | Update alert status |
| GET | `/api/fraud/risk/:contractorId` | Get contractor risk score |

### 6.9 Blockchain
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/chain` | Browse blockchain (filter: event_type) |
| GET | `/api/blockchain/verify` | Verify full chain integrity |
| GET | `/api/blockchain/block/:index` | Get specific block |

### 6.10 Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | System-wide statistics summary |
| GET | `/api/dashboard/county/:countyId` | County-specific dashboard |
| GET | `/api/dashboard/rankings` | County transparency rankings |
| GET | `/api/dashboard/search?q=` | Cross-entity search |

### 6.11 Government Integrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/kra/verify/:kraPin` | KRA tax compliance check (simulated) |
| GET | `/api/integrations/brs/verify/:regNo` | BRS company verification (simulated) |

### 6.12 Audit & System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | Browse audit log |
| GET | `/api/health` | System health + blockchain status |
| GET | `/api/info` | API endpoint listing |

---

## 7. Tender Lifecycle

```
DRAFT → PUBLISHED → BIDDING → EVALUATION → AWARDED → COMPLETED
                                    ↓
                              [AI Fraud Scan]
                                    ↓
                            Fraud Alerts Generated
```

1. **Draft** — Entity creates tender via Admin panel
2. **Published** — Tender published to public portal
3. **Bidding** — Open for bid submissions; contractors submit bids
4. **Evaluation** — Bids scored (technical 70% + financial 30%); AI fraud scan runs automatically
5. **Awarded** — Contract awarded to highest-scoring bid
6. **Completed** — Project completion reaches 100%

At any point (except completed/cancelled), a tender can be **Cancelled** with a reason.

---

## 8. AI Fraud Detection

The `FraudDetectionEngine` class implements 5 detection methods:

### 8.1 Shared Directors
Detects companies bidding on the same tender that share one or more directors. Indicates potential bid rigging or conflict of interest.
- **Severity:** High
- **Example:** "Megastructures Ltd" and "Urban Planners Consult" share director "James Mwangi"

### 8.2 Price Inflation
Compares bid amounts against historical category averages. Flags bids exceeding 150% of the average.
- **Severity:** Medium (150-200%) or Critical (>200%)

### 8.3 Repeat Winners
Identifies contractors winning 3+ tenders from the same entity within 12 months.
- **Severity:** High

### 8.4 Blacklisted Bidders
Flags any bid from a company on the blacklist.
- **Severity:** Critical

### 8.5 Suspicious Bid Patterns
Detects bids that differ by less than 1% — potential collusion signal.
- **Severity:** High

### Contractor Risk Score
Composite score (0-100) based on weighted fraud alert counts:
- Low alerts: 5 points each
- Medium: 15 points
- High: 30 points
- Critical: 50 points

Risk levels: Low (<20) → Medium (20-39) → High (40-69) → Critical (70+)

---

## 9. Blockchain Ledger

Every significant procurement event is recorded as a block in the chain:

| Event Type | Trigger |
|-----------|---------|
| CONTRACTOR_REGISTERED | New contractor registration |
| CONTRACTOR_BLACKLISTED | Company blacklisted |
| TENDER_CREATED | New tender created |
| TENDER_PUBLISHED | Tender published |
| TENDER_BIDDING_OPENED | Bidding opened |
| TENDER_EVALUATION_STARTED | Evaluation begins |
| TENDER_CANCELLED | Tender cancelled |
| BID_SUBMITTED | Bid received |
| BID_SCORED | Bid evaluated |
| CONTRACT_AWARDED | Contract awarded |
| PAYMENT_MADE | Payment processed |
| PROJECT_COMPLETED | Project completion |
| PROJECT_PROGRESS_UPDATED | Progress update |

### Block Structure
- **block_index:** Sequential integer
- **timestamp:** ISO 8601
- **data_hash:** SHA-256 of event data JSON
- **previous_hash:** Hash of prior block (genesis = 64 zeros)
- **block_hash:** SHA-256(index:timestamp:event:ref:data_hash:prev_hash:nonce)

### Verification
`GET /api/blockchain/verify` recomputes all hashes and checks chain linkage. Any tampered block will produce a hash mismatch.

---

## 10. e-GP Portal Frontend

The frontend is a **single-page application** (SPA) using hash-based routing. No build step required — plain HTML/CSS/JS served as static files.

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `#/` | Home | Hero banner, stats, charts, county grid |
| `#/dashboard` | Dashboard | Full oversight dashboard with rankings |
| `#/tenders` | Tenders | Browse/search/filter all tenders |
| `#/tenders/:id` | Tender Detail | Full detail with bids, award, fraud alerts, blockchain trail |
| `#/contractors` | Contractors | Registry with search/filter |
| `#/contractors/:id` | Contractor Profile | Full profile with risk score, performance |
| `#/counties` | Counties | All 47 counties by region |
| `#/counties/:id` | County Detail | County procurement data |
| `#/blockchain` | Blockchain | Chain viewer with verification |
| `#/fraud` | Fraud Alerts | Alert list with scan capability |
| `#/admin` | Admin Panel | Create tenders, manage lifecycle, register contractors/entities, audit log |

### Design System
- **Colors:** Kenya flag palette — Green (#006233), Red (#BB0000), Black (#1a1a2e)
- **Typography:** System UI / Segoe UI
- **Components:** Cards, stat cards, data tables, badges, progress bars, tabs, modals, filters, pagination
- **Charts:** Chart.js doughnut and bar charts
- **Responsive:** Full mobile support

---

## 11. Security

- **Helmet.js** — Sets secure HTTP headers (XSS protection, content type sniffing, etc.)
- **CORS** — Cross-origin requests allowed (configurable)
- **Rate Limiting** — 500 requests per 15 minutes per IP on `/api/*`
- **Input Validation** — All API endpoints validate required fields, types, and enum values
- **SQL Injection Prevention** — Parameterized queries throughout (no string concatenation in SQL)
- **XSS Prevention** — HTML escaping in frontend rendering via `escHtml()`
- **Audit Trail** — All write operations logged with actor, action, IP address, and timestamp
- **Blockchain Tamper Detection** — Any database modification to procurement records is detectable via chain verification

---

## 12. Seed Data

The seed script (`npm run seed`) populates:

| Entity | Count | Notes |
|--------|-------|-------|
| Counties | 47 | All Kenya counties with codes and regions |
| Procuring Entities | 14 | National ministries, county governments, agencies, parastatals |
| Contractors | 10 | Various categories; 1 blacklisted; planted fraud signals (shared directors) |
| Tenders | 8 | Various statuses (draft through completed) |
| Bids | 14 | Technical and financial scores for evaluated tenders |
| Awards | 3 | Active and completed contracts |
| Payments | 5 | Milestone-based payments |
| Performance Records | 3 | Quality and timeliness scores |
| Blockchain Blocks | ~30 | Complete history of all seed events |

### Planted Fraud Signals
- **Shared Directors:** "Megastructures Ltd" and "Urban Planners Consult" share director "James Mwangi"
- **Shared Directors:** "Megastructures Ltd" and "Rift Valley Constructors" share director "Peter Otieno"
- **Blacklisted Bidder:** "SafeGuard Security Ltd" — Failed to deliver on KES 50M contract

---

## 13. Legal Framework

TTK operates within Kenya's legal procurement framework:

- **Public Procurement and Asset Disposal Act, 2015** — Primary procurement legislation
- **Access to Information Act, 2016** — Constitutional right to government information
- **Constitution of Kenya, Article 227** — Fair, equitable, transparent procurement
- **Public Finance Management Act, 2012** — Financial accountability
- **Prevention of Corruption Act** — Anti-corruption requirements

---

## 14. API Examples

### List open tenders
```bash
curl http://localhost:3000/api/tenders?status=bidding
```

### Search for contractors
```bash
curl "http://localhost:3000/api/contractors?search=Mega"
```

### Verify blockchain integrity
```bash
curl http://localhost:3000/api/blockchain/verify
```

### Run AI fraud scan
```bash
curl -X POST http://localhost:3000/api/fraud/scan
```

### Get county transparency rankings
```bash
curl http://localhost:3000/api/dashboard/rankings
```

---

*TTK e-GP Portal v1.0 — Republic of Kenya*
*"Every tender tracked. Every shilling accounted for."*
