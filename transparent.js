/**
 * Transparent Tenders Kenya (TTK)
 * Digital Public Procurement Platform
 *
 * Integrates all 47 counties + national government into a single
 * transparent tendering ecosystem using AI fraud detection,
 * blockchain-style procurement ledger, and open data infrastructure.
 */

const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ttk.db');
let _serverless = false;

// ─────────────────────────────────────────────────────────────
//  sql.js compatibility wrapper (mirrors better-sqlite3 API)
// ─────────────────────────────────────────────────────────────

class DatabaseWrapper {
  constructor(sqlJsDb, filePath) {
    this.raw = sqlJsDb;
    this.filePath = filePath;
  }

  exec(sql) {
    this.raw.run(sql);
    this._save();
  }

  prepare(sql) {
    return new PreparedStatement(this, sql);
  }

  pragma(str) {
    try { this.raw.run(`PRAGMA ${str}`); } catch (_) { /* some pragmas unsupported in wasm */ }
  }

  close() {
    this._save();
    this.raw.close();
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self.raw.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self.raw.run('COMMIT');
        self._save();
        return result;
      } catch (e) {
        self.raw.run('ROLLBACK');
        throw e;
      }
    };
  }

  _save() {
    if (_serverless) return;
    const data = this.raw.export();
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }
}

class PreparedStatement {
  constructor(wrapper, sql) {
    this.wrapper = wrapper;
    this.sql = sql;
  }

  run(...params) {
    this.wrapper.raw.run(this.sql, params);
    this.wrapper._save();
    return { changes: this.wrapper.raw.getRowsModified() };
  }

  get(...params) {
    let stmt;
    try {
      stmt = this.wrapper.raw.prepare(this.sql);
      if (params.length) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  all(...params) {
    let stmt;
    try {
      stmt = this.wrapper.raw.prepare(this.sql);
      if (params.length) stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      if (stmt) stmt.free();
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  1. DATABASE INITIALIZATION
// ─────────────────────────────────────────────────────────────

function initDatabase(db) {
  db.exec(`
    -- Kenya counties reference table
    CREATE TABLE IF NOT EXISTS counties (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      code        TEXT NOT NULL UNIQUE,
      region      TEXT NOT NULL
    );

    -- Government entities that issue tenders
    CREATE TABLE IF NOT EXISTS procuring_entities (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('national','county','parastatal','agency')),
      county_id   INTEGER REFERENCES counties(id),
      contact     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Contractor / bidder companies
    CREATE TABLE IF NOT EXISTS contractors (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      registration_no TEXT NOT NULL UNIQUE,
      kra_pin         TEXT NOT NULL,
      category        TEXT NOT NULL,
      directors       TEXT NOT NULL,
      ownership       TEXT NOT NULL,
      date_registered TEXT NOT NULL,
      county_id       INTEGER REFERENCES counties(id),
      is_blacklisted  INTEGER NOT NULL DEFAULT 0,
      blacklist_reason TEXT,
      tax_compliant   INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Contractor performance history
    CREATE TABLE IF NOT EXISTS contractor_performance (
      id              TEXT PRIMARY KEY,
      contractor_id   TEXT NOT NULL REFERENCES contractors(id),
      tender_id       TEXT NOT NULL,
      project_name    TEXT NOT NULL,
      contract_value  REAL NOT NULL,
      completion_pct  REAL NOT NULL DEFAULT 0,
      quality_score   REAL,
      timeliness_score REAL,
      status          TEXT NOT NULL CHECK(status IN ('ongoing','completed','terminated','delayed')),
      notes           TEXT,
      evaluated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tenders
    CREATE TABLE IF NOT EXISTS tenders (
      id              TEXT PRIMARY KEY,
      reference_no    TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      entity_id       TEXT NOT NULL REFERENCES procuring_entities(id),
      county_id       INTEGER REFERENCES counties(id),
      category        TEXT NOT NULL,
      method          TEXT NOT NULL CHECK(method IN ('open','restricted','direct','rfq','rfp')),
      estimated_value REAL,
      currency        TEXT NOT NULL DEFAULT 'KES',
      status          TEXT NOT NULL CHECK(status IN ('draft','published','bidding','evaluation','awarded','completed','cancelled')),
      published_at    TEXT,
      closing_at      TEXT,
      awarded_at      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bids submitted against tenders
    CREATE TABLE IF NOT EXISTS bids (
      id              TEXT PRIMARY KEY,
      tender_id       TEXT NOT NULL REFERENCES tenders(id),
      contractor_id   TEXT NOT NULL REFERENCES contractors(id),
      bid_amount      REAL NOT NULL,
      technical_score REAL,
      financial_score REAL,
      total_score     REAL,
      documents       TEXT,
      status          TEXT NOT NULL CHECK(status IN ('submitted','under_review','accepted','rejected','disqualified')),
      submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
      evaluated_at    TEXT,
      UNIQUE(tender_id, contractor_id)
    );

    -- Contract awards
    CREATE TABLE IF NOT EXISTS awards (
      id              TEXT PRIMARY KEY,
      tender_id       TEXT NOT NULL REFERENCES tenders(id),
      bid_id          TEXT NOT NULL REFERENCES bids(id),
      contractor_id   TEXT NOT NULL REFERENCES contractors(id),
      contract_value  REAL NOT NULL,
      award_date      TEXT NOT NULL DEFAULT (datetime('now')),
      start_date      TEXT,
      end_date        TEXT,
      status          TEXT NOT NULL CHECK(status IN ('active','completed','terminated','suspended')),
      completion_pct  REAL NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Payments against awards
    CREATE TABLE IF NOT EXISTS payments (
      id              TEXT PRIMARY KEY,
      award_id        TEXT NOT NULL REFERENCES awards(id),
      amount          REAL NOT NULL,
      payment_date    TEXT NOT NULL DEFAULT (datetime('now')),
      description     TEXT,
      milestone       TEXT,
      verified        INTEGER NOT NULL DEFAULT 0
    );

    -- Blockchain-style procurement ledger
    CREATE TABLE IF NOT EXISTS blockchain_ledger (
      block_index     INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
      event_type      TEXT NOT NULL,
      reference_id    TEXT NOT NULL,
      data_hash       TEXT NOT NULL,
      previous_hash   TEXT NOT NULL,
      block_hash      TEXT NOT NULL,
      nonce           INTEGER NOT NULL DEFAULT 0
    );

    -- AI fraud detection alerts
    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id              TEXT PRIMARY KEY,
      alert_type      TEXT NOT NULL,
      severity        TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
      tender_id       TEXT REFERENCES tenders(id),
      contractor_id   TEXT REFERENCES contractors(id),
      description     TEXT NOT NULL,
      evidence        TEXT NOT NULL,
      status          TEXT NOT NULL CHECK(status IN ('open','investigating','resolved','dismissed')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at     TEXT
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      action          TEXT NOT NULL,
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      actor           TEXT,
      details         TEXT,
      ip_address      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
    CREATE INDEX IF NOT EXISTS idx_tenders_county ON tenders(county_id);
    CREATE INDEX IF NOT EXISTS idx_tenders_entity ON tenders(entity_id);
    CREATE INDEX IF NOT EXISTS idx_bids_tender ON bids(tender_id);
    CREATE INDEX IF NOT EXISTS idx_bids_contractor ON bids(contractor_id);
    CREATE INDEX IF NOT EXISTS idx_awards_tender ON awards(tender_id);
    CREATE INDEX IF NOT EXISTS idx_awards_contractor ON awards(contractor_id);
    CREATE INDEX IF NOT EXISTS idx_payments_award ON payments(award_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_tender ON fraud_alerts(tender_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_contractor ON fraud_alerts(contractor_id);
    CREATE INDEX IF NOT EXISTS idx_blockchain_event ON blockchain_ledger(event_type);
    CREATE INDEX IF NOT EXISTS idx_contractor_perf ON contractor_performance(contractor_id);
  `);

  console.log('[DB] Database initialized successfully');
}

// ─────────────────────────────────────────────────────────────
//  2. BLOCKCHAIN PROCUREMENT LEDGER
// ─────────────────────────────────────────────────────────────

class ProcurementLedger {
  constructor(database) {
    this.db = database;
  }

  computeHash(blockIndex, timestamp, eventType, referenceId, dataHash, previousHash, nonce) {
    const payload = `${blockIndex}:${timestamp}:${eventType}:${referenceId}:${dataHash}:${previousHash}:${nonce}`;
    return CryptoJS.SHA256(payload).toString();
  }

  getLastHash() {
    const row = this.db.prepare(
      'SELECT block_hash FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1'
    ).get();
    return row ? row.block_hash : '0'.repeat(64);
  }

  addBlock(eventType, referenceId, data) {
    const timestamp = new Date().toISOString();
    const dataHash = CryptoJS.SHA256(JSON.stringify(data)).toString();
    const previousHash = this.getLastHash();

    const lastBlock = this.db.prepare(
      'SELECT block_index FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1'
    ).get();
    const blockIndex = lastBlock ? lastBlock.block_index + 1 : 0;

    const blockHash = this.computeHash(blockIndex, timestamp, eventType, referenceId, dataHash, previousHash, 0);

    this.db.prepare(`
      INSERT INTO blockchain_ledger (block_index, timestamp, event_type, reference_id, data_hash, previous_hash, block_hash, nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(blockIndex, timestamp, eventType, referenceId, dataHash, previousHash, blockHash, 0);

    return { blockIndex, blockHash, previousHash, eventType, referenceId };
  }

  verifyChain() {
    const blocks = this.db.prepare('SELECT * FROM blockchain_ledger ORDER BY block_index ASC').all();
    const errors = [];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const recomputedHash = this.computeHash(
        b.block_index, b.timestamp, b.event_type, b.reference_id,
        b.data_hash, b.previous_hash, b.nonce
      );

      if (recomputedHash !== b.block_hash) {
        errors.push({ block: b.block_index, issue: 'hash_mismatch' });
      }
      if (i > 0 && b.previous_hash !== blocks[i - 1].block_hash) {
        errors.push({ block: b.block_index, issue: 'chain_broken' });
      }
    }

    return { valid: errors.length === 0, blocks: blocks.length, errors };
  }

  getChain(eventType = null, limit = 100, offset = 0) {
    if (eventType) {
      return this.db.prepare(
        'SELECT * FROM blockchain_ledger WHERE event_type = ? ORDER BY block_index DESC LIMIT ? OFFSET ?'
      ).all(eventType, limit, offset);
    }
    return this.db.prepare(
      'SELECT * FROM blockchain_ledger ORDER BY block_index DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
  }
}

// ─────────────────────────────────────────────────────────────
//  3. AI FRAUD DETECTION ENGINE
// ─────────────────────────────────────────────────────────────

class FraudDetectionEngine {
  constructor(database) {
    this.db = database;
  }

  analyzeTender(tenderId) {
    const alerts = [];
    alerts.push(...this.detectSharedDirectors(tenderId));
    alerts.push(...this.detectPriceInflation(tenderId));
    alerts.push(...this.detectRepeatWinners(tenderId));
    alerts.push(...this.detectBlacklistedBidders(tenderId));
    alerts.push(...this.detectSuspiciousBidPatterns(tenderId));
    return alerts;
  }

  detectSharedDirectors(tenderId) {
    const alerts = [];
    const bids = this.db.prepare(`
      SELECT b.id AS bid_id, b.contractor_id, c.name, c.directors
      FROM bids b JOIN contractors c ON b.contractor_id = c.id
      WHERE b.tender_id = ?
    `).all(tenderId);

    for (let i = 0; i < bids.length; i++) {
      const directorsA = JSON.parse(bids[i].directors);
      for (let j = i + 1; j < bids.length; j++) {
        const directorsB = JSON.parse(bids[j].directors);
        const shared = directorsA.filter(d => directorsB.includes(d));

        if (shared.length > 0) {
          const alertId = uuidv4();
          this.db.prepare(`
            INSERT INTO fraud_alerts (id, alert_type, severity, tender_id, description, evidence, status)
            VALUES (?, 'shared_directors', 'high', ?, ?, ?, 'open')
          `).run(alertId, tenderId,
            `Companies "${bids[i].name}" and "${bids[j].name}" share directors: ${shared.join(', ')}`,
            JSON.stringify({ company_a: bids[i].contractor_id, company_b: bids[j].contractor_id, shared_directors: shared })
          );
          alerts.push({ id: alertId, type: 'shared_directors', severity: 'high' });
        }
      }
    }
    return alerts;
  }

  detectPriceInflation(tenderId) {
    const alerts = [];
    const tender = this.db.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderId);
    if (!tender) return alerts;

    const avgResult = this.db.prepare(`
      SELECT AVG(a.contract_value) as avg_value, COUNT(*) as count
      FROM awards a JOIN tenders t ON a.tender_id = t.id
      WHERE t.category = ? AND t.id != ?
    `).get(tender.category, tenderId);

    if (!avgResult || avgResult.count < 2 || !avgResult.avg_value) return alerts;

    const bids = this.db.prepare('SELECT * FROM bids WHERE tender_id = ?').all(tenderId);

    for (const bid of bids) {
      const inflationRatio = bid.bid_amount / avgResult.avg_value;
      if (inflationRatio > 1.5) {
        const alertId = uuidv4();
        this.db.prepare(`
          INSERT INTO fraud_alerts (id, alert_type, severity, tender_id, contractor_id, description, evidence, status)
          VALUES (?, 'price_inflation', ?, ?, ?, ?, ?, 'open')
        `).run(alertId, inflationRatio > 2.0 ? 'critical' : 'medium', tenderId, bid.contractor_id,
          `Bid amount KES ${bid.bid_amount.toLocaleString()} is ${(inflationRatio * 100 - 100).toFixed(0)}% above category average`,
          JSON.stringify({ bid_amount: bid.bid_amount, category_avg: avgResult.avg_value, inflation_ratio: inflationRatio })
        );
        alerts.push({ id: alertId, type: 'price_inflation', severity: inflationRatio > 2.0 ? 'critical' : 'medium' });
      }
    }
    return alerts;
  }

  detectRepeatWinners(tenderId) {
    const alerts = [];
    const tender = this.db.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderId);
    if (!tender) return alerts;

    const recentWinners = this.db.prepare(`
      SELECT a.contractor_id, c.name, COUNT(*) as win_count,
             SUM(a.contract_value) as total_value
      FROM awards a
      JOIN contractors c ON a.contractor_id = c.id
      JOIN tenders t ON a.tender_id = t.id
      WHERE t.entity_id = ? AND a.award_date > datetime('now', '-12 months')
      GROUP BY a.contractor_id
      HAVING COUNT(*) >= 3
    `).all(tender.entity_id);

    for (const winner of recentWinners) {
      const alertId = uuidv4();
      this.db.prepare(`
        INSERT INTO fraud_alerts (id, alert_type, severity, tender_id, contractor_id, description, evidence, status)
        VALUES (?, 'repeat_winner', 'high', ?, ?, ?, ?, 'open')
      `).run(alertId, tenderId, winner.contractor_id,
        `${winner.name} has won ${winner.win_count} tenders (KES ${winner.total_value.toLocaleString()}) from the same entity in 12 months`,
        JSON.stringify({ contractor_id: winner.contractor_id, win_count: winner.win_count, total_value: winner.total_value })
      );
      alerts.push({ id: alertId, type: 'repeat_winner', severity: 'high' });
    }
    return alerts;
  }

  detectBlacklistedBidders(tenderId) {
    const alerts = [];
    const blacklisted = this.db.prepare(`
      SELECT b.id AS bid_id, c.id AS contractor_id, c.name, c.blacklist_reason
      FROM bids b JOIN contractors c ON b.contractor_id = c.id
      WHERE b.tender_id = ? AND c.is_blacklisted = 1
    `).all(tenderId);

    for (const entry of blacklisted) {
      const alertId = uuidv4();
      this.db.prepare(`
        INSERT INTO fraud_alerts (id, alert_type, severity, tender_id, contractor_id, description, evidence, status)
        VALUES (?, 'blacklisted_bidder', 'critical', ?, ?, ?, ?, 'open')
      `).run(alertId, tenderId, entry.contractor_id,
        `Blacklisted company "${entry.name}" submitted bid. Reason: ${entry.blacklist_reason || 'N/A'}`,
        JSON.stringify({ contractor_id: entry.contractor_id, bid_id: entry.bid_id })
      );
      alerts.push({ id: alertId, type: 'blacklisted_bidder', severity: 'critical' });
    }
    return alerts;
  }

  detectSuspiciousBidPatterns(tenderId) {
    const alerts = [];
    const bids = this.db.prepare(
      'SELECT * FROM bids WHERE tender_id = ? ORDER BY bid_amount ASC'
    ).all(tenderId);

    if (bids.length < 3) return alerts;

    for (let i = 0; i < bids.length - 1; i++) {
      const diff = Math.abs(bids[i + 1].bid_amount - bids[i].bid_amount);
      const pctDiff = diff / bids[i].bid_amount;
      if (pctDiff < 0.01 && pctDiff > 0) {
        const alertId = uuidv4();
        this.db.prepare(`
          INSERT INTO fraud_alerts (id, alert_type, severity, tender_id, description, evidence, status)
          VALUES (?, 'bid_collusion', 'high', ?, ?, ?, 'open')
        `).run(alertId, tenderId,
          `Two bids differ by only ${(pctDiff * 100).toFixed(2)}% — potential bid collusion`,
          JSON.stringify({ bid_a: bids[i].id, bid_b: bids[i + 1].id, amount_a: bids[i].bid_amount, amount_b: bids[i + 1].bid_amount })
        );
        alerts.push({ id: alertId, type: 'bid_collusion', severity: 'high' });
      }
    }
    return alerts;
  }

  getContractorRiskScore(contractorId) {
    const alertCounts = this.db.prepare(`
      SELECT severity, COUNT(*) as count FROM fraud_alerts
      WHERE contractor_id = ? AND status != 'dismissed'
      GROUP BY severity
    `).all(contractorId);

    let score = 0;
    const weights = { low: 5, medium: 15, high: 30, critical: 50 };
    for (const row of alertCounts) {
      score += (weights[row.severity] || 0) * row.count;
    }

    return {
      contractor_id: contractorId,
      risk_score: Math.min(score, 100),
      risk_level: score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low',
      alert_breakdown: alertCounts
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  4. EXPRESS APPLICATION SETUP & BOOT
// ─────────────────────────────────────────────────────────────

async function boot(options = {}) {
  _serverless = !!options.serverless;
  const SQL = await initSqlJs();

  // Load existing DB file or create new
  let rawDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buffer);
  } else {
    rawDb = new SQL.Database();
  }

  const db = new DatabaseWrapper(rawDb, DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initDatabase(db);

  const ledger = new ProcurementLedger(db);
  const fraudEngine = new FraudDetectionEngine(db);

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);

  // ── Helpers ──────────────────────────────────────────────

  function auditLog(action, entityType, entityId, actor, details, ipAddress) {
    db.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, actor, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(action, entityType, entityId, actor || 'system', details, ipAddress);
  }

  function paginate(query, countQuery, params, page = 1, perPage = 20) {
    const safePerPage = Math.min(Math.max(1, perPage), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safePerPage;

    const total = db.prepare(countQuery).get(...params);
    const data = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, safePerPage, offset);

    return {
      data,
      pagination: {
        page: safePage,
        per_page: safePerPage,
        total: total ? total.count : 0,
        total_pages: total ? Math.ceil(total.count / safePerPage) : 0
      }
    };
  }

  // ── COUNTIES ─────────────────────────────────────────────

  app.get('/api/counties', (req, res) => {
    const counties = db.prepare('SELECT * FROM counties ORDER BY name').all();
    res.json({ data: counties });
  });

  app.get('/api/counties/:id', (req, res) => {
    const county = db.prepare('SELECT * FROM counties WHERE id = ?').get(Number(req.params.id));
    if (!county) return res.status(404).json({ error: 'County not found' });
    res.json({ data: county });
  });

  app.get('/api/counties/:id/stats', (req, res) => {
    const countyId = Number(req.params.id);
    const county = db.prepare('SELECT * FROM counties WHERE id = ?').get(countyId);
    if (!county) return res.status(404).json({ error: 'County not found' });

    const tenderStats = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value
      FROM tenders WHERE county_id = ? GROUP BY status
    `).all(countyId);

    const awardStats = db.prepare(`
      SELECT COUNT(*) as total_awards, COALESCE(SUM(contract_value), 0) as total_value
      FROM awards a JOIN tenders t ON a.tender_id = t.id WHERE t.county_id = ?
    `).get(countyId);

    const contractorCount = db.prepare(
      'SELECT COUNT(DISTINCT contractor_id) as count FROM awards a JOIN tenders t ON a.tender_id = t.id WHERE t.county_id = ?'
    ).get(countyId);

    res.json({
      data: {
        county,
        tenders_by_status: tenderStats,
        awards: awardStats,
        unique_contractors: contractorCount ? contractorCount.count : 0
      }
    });
  });

  // ── PROCURING ENTITIES ───────────────────────────────────

  app.get('/api/entities', (req, res) => {
    const { type, county_id, page, per_page } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (type) { where += ' AND pe.type = ?'; params.push(type); }
    if (county_id) { where += ' AND pe.county_id = ?'; params.push(Number(county_id)); }

    const result = paginate(
      `SELECT pe.*, c.name as county_name FROM procuring_entities pe LEFT JOIN counties c ON pe.county_id = c.id ${where} ORDER BY pe.name`,
      `SELECT COUNT(*) as count FROM procuring_entities pe ${where}`,
      params,
      parseInt(page) || 1,
      parseInt(per_page) || 20
    );
    res.json(result);
  });

  app.post('/api/entities', (req, res) => {
    const { name, type, county_id, contact } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

    const validTypes = ['national', 'county', 'parastatal', 'agency'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });

    const id = uuidv4();
    db.prepare('INSERT INTO procuring_entities (id, name, type, county_id, contact) VALUES (?, ?, ?, ?, ?)').run(id, name, type, county_id || null, contact || null);

    auditLog('create', 'procuring_entity', id, null, `Created entity: ${name}`, req.ip);
    res.status(201).json({ data: { id, name, type, county_id, contact } });
  });

  // ── CONTRACTORS ──────────────────────────────────────────

  app.get('/api/contractors', (req, res) => {
    const { category, county_id, blacklisted, search, page, per_page } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (category) { where += ' AND ct.category = ?'; params.push(category); }
    if (county_id) { where += ' AND ct.county_id = ?'; params.push(Number(county_id)); }
    if (blacklisted !== undefined) { where += ' AND ct.is_blacklisted = ?'; params.push(blacklisted === 'true' ? 1 : 0); }
    if (search) { where += ' AND (ct.name LIKE ? OR ct.registration_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const result = paginate(
      `SELECT ct.*, c.name as county_name FROM contractors ct LEFT JOIN counties c ON ct.county_id = c.id ${where} ORDER BY ct.name`,
      `SELECT COUNT(*) as count FROM contractors ct ${where}`,
      params,
      parseInt(page) || 1,
      parseInt(per_page) || 20
    );
    res.json(result);
  });

  app.get('/api/contractors/:id', (req, res) => {
    const contractor = db.prepare(`
      SELECT ct.*, c.name as county_name FROM contractors ct
      LEFT JOIN counties c ON ct.county_id = c.id WHERE ct.id = ?
    `).get(req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' });
    res.json({ data: contractor });
  });

  app.get('/api/contractors/:id/profile', (req, res) => {
    const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' });

    const performance = db.prepare(
      'SELECT * FROM contractor_performance WHERE contractor_id = ? ORDER BY evaluated_at DESC'
    ).all(req.params.id);

    const stats = db.prepare(`
      SELECT COUNT(*) as total_projects,
             COALESCE(SUM(contract_value), 0) as total_value,
             COALESCE(AVG(completion_pct), 0) as avg_completion,
             COALESCE(AVG(quality_score), 0) as avg_quality,
             COALESCE(AVG(timeliness_score), 0) as avg_timeliness
      FROM contractor_performance WHERE contractor_id = ?
    `).get(req.params.id);

    const riskScore = fraudEngine.getContractorRiskScore(req.params.id);

    const activeAwards = db.prepare(`
      SELECT a.*, t.title as tender_title, t.reference_no
      FROM awards a JOIN tenders t ON a.tender_id = t.id
      WHERE a.contractor_id = ? AND a.status = 'active'
    `).all(req.params.id);

    res.json({
      data: {
        contractor,
        statistics: stats,
        risk_assessment: riskScore,
        active_contracts: activeAwards,
        performance_history: performance
      }
    });
  });

  app.post('/api/contractors', (req, res) => {
    const { name, registration_no, kra_pin, category, directors, ownership, date_registered, county_id } = req.body;

    if (!name || !registration_no || !kra_pin || !category || !directors) {
      return res.status(400).json({ error: 'name, registration_no, kra_pin, category, and directors are required' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO contractors (id, name, registration_no, kra_pin, category, directors, ownership, date_registered, county_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, registration_no, kra_pin, category,
      JSON.stringify(directors), JSON.stringify(ownership || {}),
      date_registered || new Date().toISOString().split('T')[0], county_id || null
    );

    ledger.addBlock('CONTRACTOR_REGISTERED', id, { name, registration_no });
    auditLog('create', 'contractor', id, null, `Registered contractor: ${name}`, req.ip);
    res.status(201).json({ data: { id, name, registration_no } });
  });

  app.patch('/api/contractors/:id/blacklist', (req, res) => {
    const { blacklist, reason } = req.body;
    const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' });

    db.prepare(`UPDATE contractors SET is_blacklisted = ?, blacklist_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(blacklist ? 1 : 0, reason || null, req.params.id);

    const action = blacklist ? 'CONTRACTOR_BLACKLISTED' : 'CONTRACTOR_UNBLACKLISTED';
    ledger.addBlock(action, req.params.id, { name: contractor.name, reason });
    auditLog(action.toLowerCase(), 'contractor', req.params.id, null, reason, req.ip);
    res.json({ message: `Contractor ${blacklist ? 'blacklisted' : 'removed from blacklist'}` });
  });

  // ── TENDERS ──────────────────────────────────────────────

  app.get('/api/tenders', (req, res) => {
    const { status, county_id, entity_id, category, method, search, page, per_page } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (county_id) { where += ' AND t.county_id = ?'; params.push(Number(county_id)); }
    if (entity_id) { where += ' AND t.entity_id = ?'; params.push(entity_id); }
    if (category) { where += ' AND t.category = ?'; params.push(category); }
    if (method) { where += ' AND t.method = ?'; params.push(method); }
    if (search) { where += ' AND (t.title LIKE ? OR t.reference_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const result = paginate(
      `SELECT t.*, pe.name as entity_name, c.name as county_name
       FROM tenders t LEFT JOIN procuring_entities pe ON t.entity_id = pe.id
       LEFT JOIN counties c ON t.county_id = c.id ${where} ORDER BY t.created_at DESC`,
      `SELECT COUNT(*) as count FROM tenders t ${where}`,
      params,
      parseInt(page) || 1,
      parseInt(per_page) || 20
    );
    res.json(result);
  });

  app.get('/api/tenders/:id', (req, res) => {
    const tender = db.prepare(`
      SELECT t.*, pe.name as entity_name, c.name as county_name
      FROM tenders t LEFT JOIN procuring_entities pe ON t.entity_id = pe.id
      LEFT JOIN counties c ON t.county_id = c.id WHERE t.id = ?
    `).get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const bids = db.prepare(`
      SELECT b.*, ct.name as contractor_name
      FROM bids b JOIN contractors ct ON b.contractor_id = ct.id WHERE b.tender_id = ?
    `).all(req.params.id);

    const award = db.prepare(`
      SELECT a.*, ct.name as contractor_name
      FROM awards a JOIN contractors ct ON a.contractor_id = ct.id WHERE a.tender_id = ?
    `).get(req.params.id);

    const fraudAlerts = db.prepare(
      'SELECT * FROM fraud_alerts WHERE tender_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);

    const chainRecords = ledger.getChain(null, 100, 0).filter(b => b.reference_id === req.params.id);

    res.json({ data: { tender, bids, award: award || null, fraud_alerts: fraudAlerts, blockchain_trail: chainRecords } });
  });

  app.post('/api/tenders', (req, res) => {
    const { title, description, entity_id, county_id, category, method, estimated_value, closing_at } = req.body;

    if (!title || !description || !entity_id || !category || !method) {
      return res.status(400).json({ error: 'title, description, entity_id, category, and method are required' });
    }

    const validMethods = ['open', 'restricted', 'direct', 'rfq', 'rfp'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `method must be one of: ${validMethods.join(', ')}` });
    }

    const entity = db.prepare('SELECT id FROM procuring_entities WHERE id = ?').get(entity_id);
    if (!entity) return res.status(400).json({ error: 'Invalid entity_id' });

    const id = uuidv4();
    const referenceNo = `TTK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    db.prepare(`
      INSERT INTO tenders (id, reference_no, title, description, entity_id, county_id, category, method, estimated_value, status, closing_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(id, referenceNo, title, description, entity_id, county_id || null, category, method, estimated_value || null, closing_at || null);

    ledger.addBlock('TENDER_CREATED', id, { reference_no: referenceNo, title, entity_id });
    auditLog('create', 'tender', id, null, `Created tender: ${referenceNo}`, req.ip);
    res.status(201).json({ data: { id, reference_no: referenceNo, title, status: 'draft' } });
  });

  app.patch('/api/tenders/:id/publish', (req, res) => {
    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (tender.status !== 'draft') return res.status(400).json({ error: 'Only draft tenders can be published' });

    db.prepare(`UPDATE tenders SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    ledger.addBlock('TENDER_PUBLISHED', req.params.id, { reference_no: tender.reference_no });
    auditLog('publish', 'tender', req.params.id, null, `Published tender: ${tender.reference_no}`, req.ip);
    res.json({ message: 'Tender published', data: { id: req.params.id, status: 'published' } });
  });

  app.patch('/api/tenders/:id/open-bidding', (req, res) => {
    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (tender.status !== 'published') return res.status(400).json({ error: 'Only published tenders can be opened for bidding' });

    db.prepare(`UPDATE tenders SET status = 'bidding', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    ledger.addBlock('TENDER_BIDDING_OPENED', req.params.id, { reference_no: tender.reference_no });
    res.json({ message: 'Bidding opened', data: { id: req.params.id, status: 'bidding' } });
  });

  app.patch('/api/tenders/:id/evaluate', (req, res) => {
    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (tender.status !== 'bidding') return res.status(400).json({ error: 'Only tenders in bidding phase can move to evaluation' });

    db.prepare(`UPDATE tenders SET status = 'evaluation', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

    const fraudAlerts = fraudEngine.analyzeTender(req.params.id);
    ledger.addBlock('TENDER_EVALUATION_STARTED', req.params.id, { reference_no: tender.reference_no, fraud_alerts: fraudAlerts.length });

    res.json({
      message: 'Evaluation started, AI analysis complete',
      data: { id: req.params.id, status: 'evaluation', fraud_alerts_generated: fraudAlerts.length, fraud_alerts: fraudAlerts }
    });
  });

  app.patch('/api/tenders/:id/cancel', (req, res) => {
    const { reason } = req.body;
    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (['completed', 'cancelled'].includes(tender.status)) {
      return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled tender' });
    }

    db.prepare(`UPDATE tenders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    ledger.addBlock('TENDER_CANCELLED', req.params.id, { reference_no: tender.reference_no, reason });
    auditLog('cancel', 'tender', req.params.id, null, reason || 'Cancelled', req.ip);
    res.json({ message: 'Tender cancelled' });
  });

  // ── BIDS ─────────────────────────────────────────────────

  app.post('/api/tenders/:tenderId/bids', (req, res) => {
    const { contractor_id, bid_amount, documents } = req.body;
    const tenderId = req.params.tenderId;

    if (!contractor_id || !bid_amount) return res.status(400).json({ error: 'contractor_id and bid_amount are required' });
    if (typeof bid_amount !== 'number' || bid_amount <= 0) return res.status(400).json({ error: 'bid_amount must be a positive number' });

    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderId);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (tender.status !== 'bidding') return res.status(400).json({ error: 'Tender is not open for bidding' });

    const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(contractor_id);
    if (!contractor) return res.status(400).json({ error: 'Invalid contractor_id' });
    if (contractor.is_blacklisted) return res.status(400).json({ error: 'Blacklisted contractors cannot bid' });
    if (!contractor.tax_compliant) return res.status(400).json({ error: 'Tax-noncompliant contractors cannot bid' });

    const existingBid = db.prepare('SELECT id FROM bids WHERE tender_id = ? AND contractor_id = ?').get(tenderId, contractor_id);
    if (existingBid) return res.status(409).json({ error: 'Contractor has already submitted a bid for this tender' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO bids (id, tender_id, contractor_id, bid_amount, documents, status) VALUES (?, ?, ?, ?, ?, 'submitted')
    `).run(id, tenderId, contractor_id, bid_amount, JSON.stringify(documents || []));

    ledger.addBlock('BID_SUBMITTED', id, { tender_id: tenderId, contractor_id, bid_amount });
    auditLog('submit_bid', 'bid', id, contractor_id, `Bid KES ${bid_amount} on ${tender.reference_no}`, req.ip);
    res.status(201).json({ data: { id, tender_id: tenderId, contractor_id, bid_amount, status: 'submitted' } });
  });

  app.get('/api/tenders/:tenderId/bids', (req, res) => {
    const bids = db.prepare(`
      SELECT b.*, ct.name as contractor_name, ct.registration_no
      FROM bids b JOIN contractors ct ON b.contractor_id = ct.id
      WHERE b.tender_id = ? ORDER BY b.submitted_at DESC
    `).all(req.params.tenderId);
    res.json({ data: bids });
  });

  app.patch('/api/bids/:id/score', (req, res) => {
    const { technical_score, financial_score } = req.body;
    if (technical_score === undefined || financial_score === undefined) {
      return res.status(400).json({ error: 'technical_score and financial_score are required' });
    }

    const bid = db.prepare('SELECT b.*, t.status as tender_status FROM bids b JOIN tenders t ON b.tender_id = t.id WHERE b.id = ?').get(req.params.id);
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.tender_status !== 'evaluation') return res.status(400).json({ error: 'Tender not in evaluation phase' });

    const totalScore = (technical_score * 0.7) + (financial_score * 0.3);
    db.prepare(`
      UPDATE bids SET technical_score = ?, financial_score = ?, total_score = ?, status = 'under_review', evaluated_at = datetime('now') WHERE id = ?
    `).run(technical_score, financial_score, totalScore, req.params.id);

    ledger.addBlock('BID_SCORED', req.params.id, { technical_score, financial_score, total_score: totalScore });
    res.json({ data: { id: req.params.id, technical_score, financial_score, total_score: totalScore } });
  });

  // ── AWARDS ───────────────────────────────────────────────

  app.post('/api/tenders/:tenderId/award', (req, res) => {
    const { bid_id, start_date, end_date } = req.body;
    const tenderId = req.params.tenderId;
    if (!bid_id) return res.status(400).json({ error: 'bid_id is required' });

    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderId);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });
    if (tender.status !== 'evaluation') return res.status(400).json({ error: 'Tender must be in evaluation phase to award' });

    const bid = db.prepare('SELECT * FROM bids WHERE id = ? AND tender_id = ?').get(bid_id, tenderId);
    if (!bid) return res.status(404).json({ error: 'Bid not found for this tender' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO awards (id, tender_id, bid_id, contractor_id, contract_value, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, tenderId, bid_id, bid.contractor_id, bid.bid_amount, start_date || null, end_date || null);

    db.prepare(`UPDATE tenders SET status = 'awarded', awarded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(tenderId);
    db.prepare(`UPDATE bids SET status = 'accepted' WHERE id = ?`).run(bid_id);
    db.prepare(`UPDATE bids SET status = 'rejected' WHERE tender_id = ? AND id != ?`).run(tenderId, bid_id);

    ledger.addBlock('CONTRACT_AWARDED', id, { tender_id: tenderId, contractor_id: bid.contractor_id, contract_value: bid.bid_amount, reference_no: tender.reference_no });
    auditLog('award', 'award', id, null, `Awarded ${tender.reference_no} to contractor ${bid.contractor_id} for KES ${bid.bid_amount}`, req.ip);

    res.status(201).json({ data: { id, tender_id: tenderId, contractor_id: bid.contractor_id, contract_value: bid.bid_amount, status: 'active' } });
  });

  app.patch('/api/awards/:id/progress', (req, res) => {
    const { completion_pct, status } = req.body;
    const award = db.prepare('SELECT * FROM awards WHERE id = ?').get(req.params.id);
    if (!award) return res.status(404).json({ error: 'Award not found' });

    const updates = [];
    const params = [];
    if (completion_pct !== undefined) { updates.push('completion_pct = ?'); params.push(completion_pct); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    db.prepare(`UPDATE awards SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (completion_pct === 100 || status === 'completed') {
      db.prepare(`UPDATE tenders SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(award.tender_id);
      ledger.addBlock('PROJECT_COMPLETED', req.params.id, { tender_id: award.tender_id, contractor_id: award.contractor_id });
    } else {
      ledger.addBlock('PROJECT_PROGRESS_UPDATED', req.params.id, { completion_pct, status });
    }

    res.json({ message: 'Progress updated' });
  });

  // ── PAYMENTS ─────────────────────────────────────────────

  app.post('/api/awards/:awardId/payments', (req, res) => {
    const { amount, description, milestone } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const award = db.prepare('SELECT * FROM awards WHERE id = ?').get(req.params.awardId);
    if (!award) return res.status(404).json({ error: 'Award not found' });

    const totalPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE award_id = ?').get(req.params.awardId);
    if (totalPaid.total + amount > award.contract_value) {
      return res.status(400).json({ error: `Payment would exceed contract value. Remaining: KES ${award.contract_value - totalPaid.total}` });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO payments (id, award_id, amount, description, milestone) VALUES (?, ?, ?, ?, ?)').run(id, req.params.awardId, amount, description || null, milestone || null);

    ledger.addBlock('PAYMENT_MADE', id, { award_id: req.params.awardId, amount, milestone });
    auditLog('payment', 'payment', id, null, `Payment KES ${amount} for award ${req.params.awardId}`, req.ip);
    res.status(201).json({ data: { id, award_id: req.params.awardId, amount } });
  });

  app.get('/api/awards/:awardId/payments', (req, res) => {
    const payments = db.prepare('SELECT * FROM payments WHERE award_id = ? ORDER BY payment_date DESC').all(req.params.awardId);
    const total = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE award_id = ?').get(req.params.awardId);
    res.json({ data: payments, total_paid: total ? total.total : 0 });
  });

  // ── FRAUD DETECTION ──────────────────────────────────────

  app.post('/api/fraud/analyze/:tenderId', (req, res) => {
    const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.tenderId);
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const alerts = fraudEngine.analyzeTender(req.params.tenderId);
    res.json({ data: { tender_id: req.params.tenderId, alerts_generated: alerts.length, alerts } });
  });

  app.get('/api/fraud/alerts', (req, res) => {
    const { status, severity, tender_id, page, per_page } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND fa.status = ?'; params.push(status); }
    if (severity) { where += ' AND fa.severity = ?'; params.push(severity); }
    if (tender_id) { where += ' AND fa.tender_id = ?'; params.push(tender_id); }

    const result = paginate(
      `SELECT fa.*, t.reference_no as tender_ref, t.title as tender_title
       FROM fraud_alerts fa LEFT JOIN tenders t ON fa.tender_id = t.id ${where} ORDER BY fa.created_at DESC`,
      `SELECT COUNT(*) as count FROM fraud_alerts fa ${where}`,
      params,
      parseInt(page) || 1,
      parseInt(per_page) || 20
    );
    res.json(result);
  });

  app.patch('/api/fraud/alerts/:id', (req, res) => {
    const { status } = req.body;
    const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const alert = db.prepare('SELECT * FROM fraud_alerts WHERE id = ?').get(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const resolvedAt = ['resolved', 'dismissed'].includes(status) ? new Date().toISOString() : null;
    db.prepare('UPDATE fraud_alerts SET status = ?, resolved_at = ? WHERE id = ?').run(status, resolvedAt, req.params.id);

    auditLog('update_alert', 'fraud_alert', req.params.id, null, `Status: ${status}`, req.ip);
    res.json({ message: 'Alert updated' });
  });

  app.get('/api/fraud/risk/:contractorId', (req, res) => {
    const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(req.params.contractorId);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' });

    const riskScore = fraudEngine.getContractorRiskScore(req.params.contractorId);
    res.json({ data: riskScore });
  });

  app.post('/api/fraud/scan', (req, res) => {
    const tenders = db.prepare("SELECT id FROM tenders WHERE status IN ('bidding','evaluation','awarded')").all();
    let totalAlerts = 0;
    const results = [];
    for (const t of tenders) {
      const alerts = fraudEngine.analyzeTender(t.id);
      totalAlerts += alerts.length;
      if (alerts.length > 0) results.push({ tender_id: t.id, alerts });
    }
    res.json({ data: { tenders_scanned: tenders.length, total_alerts: totalAlerts, results } });
  });

  // ── BLOCKCHAIN LEDGER ────────────────────────────────────

  app.get('/api/blockchain/chain', (req, res) => {
    const { event_type, limit, offset } = req.query;
    const chain = ledger.getChain(event_type || null, parseInt(limit) || 100, parseInt(offset) || 0);
    res.json({ data: chain });
  });

  app.get('/api/blockchain/verify', (req, res) => {
    const result = ledger.verifyChain();
    res.json({ data: result });
  });

  app.get('/api/blockchain/block/:index', (req, res) => {
    const block = db.prepare('SELECT * FROM blockchain_ledger WHERE block_index = ?').get(Number(req.params.index));
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json({ data: block });
  });

  // ── CITIZEN OVERSIGHT DASHBOARD ──────────────────────────

  app.get('/api/dashboard/overview', (req, res) => {
    const totalTenders = db.prepare('SELECT COUNT(*) as count FROM tenders').get();
    const totalAwarded = db.prepare('SELECT COUNT(*) as count FROM awards').get();
    const totalValue = db.prepare('SELECT COALESCE(SUM(contract_value), 0) as total FROM awards').get();
    const totalContractors = db.prepare('SELECT COUNT(*) as count FROM contractors').get();
    const totalPayments = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments').get();
    const openAlerts = db.prepare("SELECT COUNT(*) as count FROM fraud_alerts WHERE status IN ('open', 'investigating')").get();
    const blockchainBlocks = db.prepare('SELECT COUNT(*) as count FROM blockchain_ledger').get();

    const tendersByStatus = db.prepare('SELECT status, COUNT(*) as count FROM tenders GROUP BY status').all();
    const tendersByMethod = db.prepare('SELECT method, COUNT(*) as count FROM tenders GROUP BY method').all();

    const recentAwards = db.prepare(`
      SELECT a.id, a.contract_value, a.award_date, a.completion_pct, a.status,
             t.title as tender_title, t.reference_no, c.name as county_name,
             ct.name as contractor_name
      FROM awards a
      JOIN tenders t ON a.tender_id = t.id
      LEFT JOIN counties c ON t.county_id = c.id
      JOIN contractors ct ON a.contractor_id = ct.id
      ORDER BY a.award_date DESC LIMIT 10
    `).all();

    res.json({
      data: {
        summary: {
          total_tenders: totalTenders.count,
          total_awarded: totalAwarded.count,
          total_contract_value: totalValue.total,
          total_contractors: totalContractors.count,
          total_payments: totalPayments.total,
          open_fraud_alerts: openAlerts.count,
          blockchain_blocks: blockchainBlocks.count
        },
        tenders_by_status: tendersByStatus,
        tenders_by_method: tendersByMethod,
        recent_awards: recentAwards
      }
    });
  });

  app.get('/api/dashboard/county/:countyId', (req, res) => {
    const county = db.prepare('SELECT * FROM counties WHERE id = ?').get(Number(req.params.countyId));
    if (!county) return res.status(404).json({ error: 'County not found' });

    const tenders = db.prepare(`
      SELECT t.*, pe.name as entity_name
      FROM tenders t JOIN procuring_entities pe ON t.entity_id = pe.id
      WHERE t.county_id = ? ORDER BY t.created_at DESC LIMIT 20
    `).all(Number(req.params.countyId));

    const awards = db.prepare(`
      SELECT a.*, t.title as tender_title, t.reference_no, ct.name as contractor_name
      FROM awards a JOIN tenders t ON a.tender_id = t.id
      JOIN contractors ct ON a.contractor_id = ct.id
      WHERE t.county_id = ? ORDER BY a.award_date DESC LIMIT 20
    `).all(Number(req.params.countyId));

    const stats = db.prepare(`
      SELECT COUNT(DISTINCT t.id) as tender_count,
             COALESCE(SUM(a.contract_value), 0) as total_awarded_value,
             COUNT(DISTINCT a.id) as award_count
      FROM tenders t LEFT JOIN awards a ON t.id = a.tender_id
      WHERE t.county_id = ?
    `).get(Number(req.params.countyId));

    res.json({ data: { county, stats, recent_tenders: tenders, recent_awards: awards } });
  });

  app.get('/api/dashboard/rankings', (req, res) => {
    const rankings = db.prepare(`
      SELECT c.id, c.name, c.region,
             COUNT(DISTINCT t.id) as tender_count,
             COUNT(DISTINCT CASE WHEN t.method = 'open' THEN t.id END) as open_tenders,
             COUNT(DISTINCT a.id) as award_count,
             COALESCE(SUM(a.contract_value), 0) as total_value,
             CASE WHEN COUNT(DISTINCT t.id) > 0
                  THEN ROUND(COUNT(DISTINCT CASE WHEN t.method = 'open' THEN t.id END) * 100.0 / COUNT(DISTINCT t.id), 1)
                  ELSE 0 END as open_tender_pct
      FROM counties c
      LEFT JOIN tenders t ON c.id = t.county_id
      LEFT JOIN awards a ON t.id = a.tender_id
      GROUP BY c.id ORDER BY open_tender_pct DESC, tender_count DESC
    `).all();

    res.json({ data: rankings });
  });

  app.get('/api/dashboard/search', (req, res) => {
    const { q, type } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Search query must be at least 2 characters' });

    const searchTerm = `%${q}%`;
    const results = {};

    if (!type || type === 'tenders') {
      results.tenders = db.prepare(`
        SELECT t.id, t.reference_no, t.title, t.status, t.estimated_value, c.name as county_name
        FROM tenders t LEFT JOIN counties c ON t.county_id = c.id
        WHERE t.title LIKE ? OR t.reference_no LIKE ? OR t.description LIKE ? LIMIT 20
      `).all(searchTerm, searchTerm, searchTerm);
    }
    if (!type || type === 'contractors') {
      results.contractors = db.prepare(`
        SELECT id, name, registration_no, category, is_blacklisted
        FROM contractors WHERE name LIKE ? OR registration_no LIKE ? OR kra_pin LIKE ? LIMIT 20
      `).all(searchTerm, searchTerm, searchTerm);
    }
    if (!type || type === 'entities') {
      results.entities = db.prepare(`
        SELECT pe.id, pe.name, pe.type, c.name as county_name
        FROM procuring_entities pe LEFT JOIN counties c ON pe.county_id = c.id
        WHERE pe.name LIKE ? LIMIT 20
      `).all(searchTerm);
    }

    res.json({ data: results });
  });

  // ── GOVERNMENT INTEGRATION STUBS ─────────────────────────

  app.get('/api/integrations/kra/verify/:kraPin', (req, res) => {
    const contractor = db.prepare('SELECT id, name, kra_pin, tax_compliant FROM contractors WHERE kra_pin = ?').get(req.params.kraPin);
    if (!contractor) return res.status(404).json({ error: 'KRA PIN not found in registry' });

    res.json({
      data: {
        kra_pin: req.params.kraPin,
        taxpayer_name: contractor.name,
        tax_compliant: !!contractor.tax_compliant,
        last_filing_date: '2025-12-31',
        status: contractor.tax_compliant ? 'COMPLIANT' : 'NON-COMPLIANT',
        source: 'KRA Integration (simulated)'
      }
    });
  });

  app.get('/api/integrations/brs/verify/:registrationNo', (req, res) => {
    const contractor = db.prepare('SELECT * FROM contractors WHERE registration_no = ?').get(req.params.registrationNo);
    if (!contractor) return res.status(404).json({ error: 'Registration number not found' });

    res.json({
      data: {
        registration_no: req.params.registrationNo,
        company_name: contractor.name,
        directors: JSON.parse(contractor.directors),
        beneficial_ownership: JSON.parse(contractor.ownership),
        date_registered: contractor.date_registered,
        status: 'ACTIVE',
        source: 'BRS Integration (simulated)'
      }
    });
  });

  // ── AUDIT LOG ────────────────────────────────────────────

  app.get('/api/audit', (req, res) => {
    const { action, entity_type, entity_id, page, per_page } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (action) { where += ' AND action = ?'; params.push(action); }
    if (entity_type) { where += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { where += ' AND entity_id = ?'; params.push(entity_id); }

    const result = paginate(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC`,
      `SELECT COUNT(*) as count FROM audit_log ${where}`,
      params,
      parseInt(page) || 1,
      parseInt(per_page) || 50
    );
    res.json(result);
  });

  // ── HEALTH & ROOT ────────────────────────────────────────

  app.get('/api/info', (req, res) => {
    res.json({
      name: 'Transparent Tenders Kenya (TTK)',
      version: '1.0.0',
      description: 'Digital public procurement platform for all 47 counties and the national government',
      endpoints: {
        dashboard: '/api/dashboard/overview',
        counties: '/api/counties',
        entities: '/api/entities',
        tenders: '/api/tenders',
        contractors: '/api/contractors',
        fraud_alerts: '/api/fraud/alerts',
        blockchain: '/api/blockchain/chain',
        search: '/api/dashboard/search?q=',
        audit_log: '/api/audit'
      }
    });
  });

  app.get('/api/health', (req, res) => {
    const chainStatus = ledger.verifyChain();
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      database: 'connected',
      blockchain: chainStatus.valid ? 'valid' : 'compromised',
      blockchain_blocks: chainStatus.blocks
    });
  });

  // ── START ────────────────────────────────────────────────

  if (!_serverless) {
    const server = app.listen(PORT, () => {
      console.log(`
  ====================================================
    TRANSPARENT TENDERS KENYA (TTK) v1.0.0
    Digital Public Procurement Platform
    47 Counties + National Government
  
    Server:     http://localhost:${PORT}
    Dashboard:  http://localhost:${PORT}/api/dashboard/overview
    Health:     http://localhost:${PORT}/api/health
    Database:   ${DB_PATH}
  ====================================================
      `);
    });

    process.on('SIGINT', () => {
      console.log('\n[TTK] Shutting down gracefully...');
      server.close(() => {
        db.close();
        console.log('[TTK] Server closed. Database connection released.');
        process.exit(0);
      });
    });
  }

  return { app, db, ledger, fraudEngine };
}

if (require.main === module) {
  boot().catch(err => {
    console.error('[TTK] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = { boot };
