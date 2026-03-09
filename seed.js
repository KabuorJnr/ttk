/**
 * TTK Seed Script
 * Populates the database with all 47 Kenya counties, sample entities,
 * contractors, tenders, bids, awards, and payments for demonstration.
 */

const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ttk.db');

// ── Helpers for sql.js ─────────────────────────────────────

function run(db, sql, params) {
  db.run(sql, params || []);
}

function get(db, sql, params) {
  let stmt;
  try {
    stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    if (stmt.step()) return stmt.getAsObject();
    return undefined;
  } finally { if (stmt) stmt.free(); }
}

function save(db) {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ── All 47 Kenya Counties ──────────────────────────────────

const counties = [
  [1,'Mombasa','MSA','Coast'],[2,'Kwale','KWL','Coast'],[3,'Kilifi','KLF','Coast'],
  [4,'Tana River','TNR','Coast'],[5,'Lamu','LMU','Coast'],[6,'Taita-Taveta','TTV','Coast'],
  [7,'Garissa','GRS','North Eastern'],[8,'Wajir','WJR','North Eastern'],[9,'Mandera','MND','North Eastern'],
  [10,'Marsabit','MBT','Eastern'],[11,'Isiolo','ISL','Eastern'],[12,'Meru','MRU','Eastern'],
  [13,'Tharaka-Nithi','THN','Eastern'],[14,'Embu','EMB','Eastern'],[15,'Kitui','KTU','Eastern'],
  [16,'Machakos','MCK','Eastern'],[17,'Makueni','MKN','Eastern'],
  [18,'Nyandarua','NYD','Central'],[19,'Nyeri','NYR','Central'],[20,'Kirinyaga','KRN','Central'],
  [21,"Murang'a",'MRG','Central'],[22,'Kiambu','KMB','Central'],
  [23,'Turkana','TRK','Rift Valley'],[24,'West Pokot','WPK','Rift Valley'],[25,'Samburu','SMB','Rift Valley'],
  [26,'Trans-Nzoia','TNZ','Rift Valley'],[27,'Uasin Gishu','UGS','Rift Valley'],
  [28,'Elgeyo-Marakwet','ELM','Rift Valley'],[29,'Nandi','NND','Rift Valley'],
  [30,'Baringo','BRG','Rift Valley'],[31,'Laikipia','LKP','Rift Valley'],
  [32,'Nakuru','NKR','Rift Valley'],[33,'Narok','NRK','Rift Valley'],
  [34,'Kajiado','KJD','Rift Valley'],[35,'Kericho','KRC','Rift Valley'],[36,'Bomet','BMT','Rift Valley'],
  [37,'Kakamega','KKM','Western'],[38,'Vihiga','VHG','Western'],[39,'Bungoma','BGM','Western'],[40,'Busia','BSA','Western'],
  [41,'Siaya','SYA','Nyanza'],[42,'Kisumu','KSM','Nyanza'],[43,'Homa Bay','HMB','Nyanza'],
  [44,'Migori','MGR','Nyanza'],[45,'Kisii','KSI','Nyanza'],[46,'Nyamira','NYM','Nyanza'],
  [47,'Nairobi','NRB','Nairobi'],
];

async function seed() {
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    console.error('[SEED] Database not found. Run "npm start" first to initialize the schema.');
    process.exit(1);
  }

  // ── Seed Counties ────────────────────────────────────────
  console.log('[SEED] Inserting 47 counties...');
  db.run('BEGIN TRANSACTION');
  for (const c of counties) {
    run(db, 'INSERT OR IGNORE INTO counties (id, name, code, region) VALUES (?, ?, ?, ?)', c);
  }
  db.run('COMMIT');

  // ── Seed Procuring Entities ──────────────────────────────
  console.log('[SEED] Inserting procuring entities...');
  const entities = [
    { name: 'National Treasury and Economic Planning',  type: 'national',   county_id: 47 },
    { name: 'Kenya National Highways Authority (KeNHA)',type: 'agency',     county_id: 47 },
    { name: 'Kenya Rural Roads Authority (KeRRA)',      type: 'agency',     county_id: 47 },
    { name: 'Ministry of Health',                       type: 'national',   county_id: 47 },
    { name: 'Ministry of Education',                    type: 'national',   county_id: 47 },
    { name: 'Nairobi County Government',                type: 'county',     county_id: 47 },
    { name: 'Mombasa County Government',                type: 'county',     county_id: 1  },
    { name: 'Kisumu County Government',                 type: 'county',     county_id: 42 },
    { name: 'Nakuru County Government',                 type: 'county',     county_id: 32 },
    { name: 'Kiambu County Government',                 type: 'county',     county_id: 22 },
    { name: 'Machakos County Government',               type: 'county',     county_id: 16 },
    { name: 'Nyeri County Government',                  type: 'county',     county_id: 19 },
    { name: 'Kenya Power and Lighting Company',         type: 'parastatal', county_id: 47 },
    { name: 'Kenya Ports Authority',                    type: 'parastatal', county_id: 1  },
  ];

  const entityIds = {};
  db.run('BEGIN TRANSACTION');
  for (const e of entities) {
    const id = uuidv4();
    run(db, 'INSERT OR IGNORE INTO procuring_entities (id, name, type, county_id) VALUES (?, ?, ?, ?)', [id, e.name, e.type, e.county_id]);
    entityIds[e.name] = id;
  }
  db.run('COMMIT');

  // ── Seed Contractors ─────────────────────────────────────
  console.log('[SEED] Inserting contractors...');
  const contractorData = [
    { name:'Megastructures Ltd',       reg:'CPR/2019/45123',kra:'A009876543K',cat:'construction',directors:['James Mwangi','Peter Otieno'],county:47 },
    { name:'Savannah Roads Contractors',reg:'CPR/2020/67891',kra:'A001234567L',cat:'construction',directors:['Grace Wanjiku','Daniel Karanja'],county:32 },
    { name:'Coastal Medical Supplies',  reg:'CPR/2018/33456',kra:'P009871234M',cat:'medical',     directors:['Amina Hassan','Mohamed Ali'],county:1 },
    { name:'Digital Horizons ICT',      reg:'CPR/2021/78900',kra:'A005554321N',cat:'ict',         directors:['Kevin Omondi','Stella Njeri'],county:47 },
    { name:'Clean Water Systems',       reg:'CPR/2017/12300',kra:'P003217654O',cat:'water',       directors:['John Kamau','Lucy Achieng'],county:42 },
    { name:'Green Energy Solutions',    reg:'CPR/2020/44500',kra:'A008765432P',cat:'energy',      directors:['Samson Kipchoge','Mary Nyambura'],county:27 },
    { name:'Urban Planners Consult',    reg:'CPR/2019/99800',kra:'P001239876Q',cat:'consultancy', directors:['David Mutua','James Mwangi'],county:47 },
    { name:'Rift Valley Constructors',  reg:'CPR/2018/55600',kra:'A004568901R',cat:'construction',directors:['Peter Otieno','Moses Kibet'],county:35 },
    { name:'SafeGuard Security Ltd',    reg:'CPR/2022/11200',kra:'P007891011S',cat:'security',    directors:['Agnes Wambui','Samuel Odhiambo'],county:47,blacklisted:true,blacklistReason:'Failed to deliver on KES 50M security contract' },
    { name:'Lakeshore Suppliers',       reg:'CPR/2021/66700',kra:'A002345678T',cat:'supplies',    directors:['Rose Kemunto','Brian Ochieng'],county:45 },
  ];

  const contractorIds = {};
  db.run('BEGIN TRANSACTION');
  for (const c of contractorData) {
    const id = uuidv4();
    run(db, `INSERT OR IGNORE INTO contractors (id, name, registration_no, kra_pin, category, directors, ownership, date_registered, county_id, is_blacklisted, blacklist_reason, tax_compliant)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, c.name, c.reg, c.kra, c.cat,
        JSON.stringify(c.directors),
        JSON.stringify({ shareholders: c.directors.map(d => ({ name: d, share_pct: Math.round(100/c.directors.length) })) }),
        `20${c.reg.split('/')[1]}-01-15`, c.county, c.blacklisted ? 1 : 0, c.blacklistReason || null, 1
      ]);
    contractorIds[c.name] = id;
  }
  db.run('COMMIT');

  // ── Seed Tenders ─────────────────────────────────────────
  console.log('[SEED] Inserting tenders...');
  const tenderData = [
    { title:'Construction of Nairobi Expressway Phase 2',desc:'Extension of the Nairobi Expressway to JKIA',entity:'Kenya National Highways Authority (KeNHA)',county:47,cat:'construction',method:'open',value:12000000000,status:'awarded' },
    { title:'Supply of Medical Equipment to Mombasa County Hospitals',desc:'Supply and installation of diagnostic equipment to 5 hospitals',entity:'Mombasa County Government',county:1,cat:'medical',method:'open',value:450000000,status:'evaluation' },
    { title:'Kisumu Water Supply Expansion Project',desc:'Expansion of water supply network to Lake Victoria communities',entity:'Kisumu County Government',county:42,cat:'water',method:'open',value:890000000,status:'bidding' },
    { title:'Nakuru County ICT Infrastructure Upgrade',desc:'Upgrade of county government ICT systems',entity:'Nakuru County Government',county:32,cat:'ict',method:'rfp',value:120000000,status:'published' },
    { title:'Rural Road Maintenance - Kiambu County',desc:'Routine maintenance of 200km rural access roads',entity:'Kiambu County Government',county:22,cat:'construction',method:'open',value:340000000,status:'completed' },
    { title:'Solar Power Installation - Turkana Schools',desc:'Installation of solar panels in 50 primary schools',entity:'Ministry of Education',county:23,cat:'energy',method:'open',value:180000000,status:'bidding' },
    { title:'Nairobi County Security Systems Procurement',desc:'Procurement of CCTV and surveillance for Nairobi CBD',entity:'Nairobi County Government',county:47,cat:'security',method:'restricted',value:560000000,status:'draft' },
    { title:'Machakos County Government Office Construction',desc:'Construction of new county admin offices',entity:'Machakos County Government',county:16,cat:'construction',method:'open',value:750000000,status:'awarded' },
  ];

  const tenderIds = {};
  db.run('BEGIN TRANSACTION');
  for (const t of tenderData) {
    const id = uuidv4();
    const refNo = `TTK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    const published = ['draft'].includes(t.status) ? null : '2025-06-01T09:00:00.000Z';
    const closing = ['draft','published'].includes(t.status) ? null : '2025-07-15T17:00:00.000Z';
    run(db, `INSERT OR IGNORE INTO tenders (id, reference_no, title, description, entity_id, county_id, category, method, estimated_value, status, published_at, closing_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, refNo, t.title, t.desc, entityIds[t.entity], t.county, t.cat, t.method, t.value, t.status, published, closing]);
    tenderIds[t.title] = id;
  }
  db.run('COMMIT');

  // ── Seed Bids ────────────────────────────────────────────
  console.log('[SEED] Inserting bids...');
  const bidData = [
    { tender:'Construction of Nairobi Expressway Phase 2',contractor:'Megastructures Ltd',amount:11500000000,tech:88,fin:92 },
    { tender:'Construction of Nairobi Expressway Phase 2',contractor:'Savannah Roads Contractors',amount:13200000000,tech:75,fin:70 },
    { tender:'Construction of Nairobi Expressway Phase 2',contractor:'Rift Valley Constructors',amount:12800000000,tech:72,fin:74 },
    { tender:'Supply of Medical Equipment to Mombasa County Hospitals',contractor:'Coastal Medical Supplies',amount:430000000,tech:85,fin:88 },
    { tender:'Supply of Medical Equipment to Mombasa County Hospitals',contractor:'Lakeshore Suppliers',amount:470000000,tech:70,fin:65 },
    { tender:'Kisumu Water Supply Expansion Project',contractor:'Clean Water Systems',amount:850000000 },
    { tender:'Kisumu Water Supply Expansion Project',contractor:'Megastructures Ltd',amount:920000000 },
    { tender:'Solar Power Installation - Turkana Schools',contractor:'Green Energy Solutions',amount:170000000 },
    { tender:'Solar Power Installation - Turkana Schools',contractor:'Digital Horizons ICT',amount:195000000 },
    { tender:'Machakos County Government Office Construction',contractor:'Savannah Roads Contractors',amount:720000000,tech:82,fin:85 },
    { tender:'Machakos County Government Office Construction',contractor:'Megastructures Ltd',amount:780000000,tech:78,fin:75 },
    { tender:'Machakos County Government Office Construction',contractor:'Urban Planners Consult',amount:785000000,tech:65,fin:60 },
    { tender:'Rural Road Maintenance - Kiambu County',contractor:'Rift Valley Constructors',amount:310000000,tech:80,fin:84 },
    { tender:'Rural Road Maintenance - Kiambu County',contractor:'Savannah Roads Contractors',amount:350000000,tech:70,fin:72 },
  ];

  const bidIds = {};
  db.run('BEGIN TRANSACTION');
  for (const b of bidData) {
    const id = uuidv4();
    const totalScore = b.tech ? (b.tech * 0.7 + b.fin * 0.3) : null;
    const status = b.tech ? 'under_review' : 'submitted';
    const evaluated = b.tech ? '2025-08-01T10:00:00.000Z' : null;
    run(db, `INSERT OR IGNORE INTO bids (id, tender_id, contractor_id, bid_amount, technical_score, financial_score, total_score, status, evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenderIds[b.tender], contractorIds[b.contractor], b.amount, b.tech || null, b.fin || null, totalScore, status, evaluated]);
    bidIds[`${b.tender}:${b.contractor}`] = id;
  }
  db.run('COMMIT');

  // ── Seed Awards ──────────────────────────────────────────
  console.log('[SEED] Inserting awards...');
  const awardData = [
    { tender:'Construction of Nairobi Expressway Phase 2',contractor:'Megastructures Ltd',value:11500000000,start:'2025-09-01',end:'2028-09-01',status:'active',completion:15 },
    { tender:'Machakos County Government Office Construction',contractor:'Savannah Roads Contractors',value:720000000,start:'2025-08-01',end:'2026-12-01',status:'active',completion:35 },
    { tender:'Rural Road Maintenance - Kiambu County',contractor:'Rift Valley Constructors',value:310000000,start:'2025-03-01',end:'2025-12-01',status:'completed',completion:100 },
  ];

  const awardIds = {};
  db.run('BEGIN TRANSACTION');
  for (const a of awardData) {
    const id = uuidv4();
    const bidId = bidIds[`${a.tender}:${a.contractor}`];
    run(db, `INSERT OR IGNORE INTO awards (id, tender_id, bid_id, contractor_id, contract_value, start_date, end_date, status, completion_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenderIds[a.tender], bidId, contractorIds[a.contractor], a.value, a.start, a.end, a.status, a.completion]);
    awardIds[a.tender] = id;
    run(db, "UPDATE bids SET status = 'accepted' WHERE id = ?", [bidId]);
    run(db, "UPDATE bids SET status = 'rejected' WHERE tender_id = ? AND id != ? AND status = 'under_review'", [tenderIds[a.tender], bidId]);
  }
  db.run('COMMIT');

  // ── Seed Payments ────────────────────────────────────────
  console.log('[SEED] Inserting payments...');
  const paymentData = [
    { award:'Construction of Nairobi Expressway Phase 2',amount:2300000000,desc:'Mobilisation advance (20%)',milestone:'Mobilisation' },
    { award:'Construction of Nairobi Expressway Phase 2',amount:1150000000,desc:'Foundation works payment',milestone:'Phase 1 Foundation' },
    { award:'Machakos County Government Office Construction',amount:216000000,desc:'Advance payment (30%)',milestone:'Mobilisation' },
    { award:'Rural Road Maintenance - Kiambu County',amount:155000000,desc:'First half payment',milestone:'Phase 1' },
    { award:'Rural Road Maintenance - Kiambu County',amount:155000000,desc:'Final payment',milestone:'Completion' },
  ];

  db.run('BEGIN TRANSACTION');
  for (const p of paymentData) {
    run(db, 'INSERT OR IGNORE INTO payments (id, award_id, amount, description, milestone) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), awardIds[p.award], p.amount, p.desc, p.milestone]);
  }
  db.run('COMMIT');

  // ── Seed Contractor Performance ──────────────────────────
  console.log('[SEED] Inserting contractor performance...');
  const perfData = [
    { contractor:'Megastructures Ltd',tender:'Construction of Nairobi Expressway Phase 2',project:'Nairobi Expressway Phase 2',value:11500000000,completion:15,quality:82,timeliness:78,status:'ongoing' },
    { contractor:'Savannah Roads Contractors',tender:'Machakos County Government Office Construction',project:'Machakos County Offices',value:720000000,completion:35,quality:85,timeliness:80,status:'ongoing' },
    { contractor:'Rift Valley Constructors',tender:'Rural Road Maintenance - Kiambu County',project:'Kiambu Rural Roads',value:310000000,completion:100,quality:88,timeliness:92,status:'completed' },
  ];

  db.run('BEGIN TRANSACTION');
  for (const p of perfData) {
    run(db, `INSERT OR IGNORE INTO contractor_performance (id, contractor_id, tender_id, project_name, contract_value, completion_pct, quality_score, timeliness_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), contractorIds[p.contractor], tenderIds[p.tender], p.project, p.value, p.completion, p.quality, p.timeliness, p.status]);
  }
  db.run('COMMIT');

  // ── Seed Blockchain Ledger ───────────────────────────────
  console.log('[SEED] Writing blockchain ledger...');

  function addBlock(eventType, referenceId, data) {
    const timestamp = new Date().toISOString();
    const dataHash = CryptoJS.SHA256(JSON.stringify(data)).toString();
    const lastBlock = get(db, 'SELECT block_index, block_hash FROM blockchain_ledger ORDER BY block_index DESC LIMIT 1');
    const previousHash = lastBlock ? lastBlock.block_hash : '0'.repeat(64);
    const blockIndex = lastBlock ? lastBlock.block_index + 1 : 0;
    const payload = `${blockIndex}:${timestamp}:${eventType}:${referenceId}:${dataHash}:${previousHash}:0`;
    const blockHash = CryptoJS.SHA256(payload).toString();
    run(db, `INSERT INTO blockchain_ledger (block_index, timestamp, event_type, reference_id, data_hash, previous_hash, block_hash, nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [blockIndex, timestamp, eventType, referenceId, dataHash, previousHash, blockHash]);
  }

  db.run('BEGIN TRANSACTION');
  for (const name of Object.keys(contractorIds)) addBlock('CONTRACTOR_REGISTERED', contractorIds[name], { name });
  for (const [title, id] of Object.entries(tenderIds)) {
    addBlock('TENDER_CREATED', id, { title });
    if (!title.includes('Security Systems')) addBlock('TENDER_PUBLISHED', id, { title });
  }
  for (const [title, id] of Object.entries(awardIds)) addBlock('CONTRACT_AWARDED', id, { title });
  db.run('COMMIT');

  // ── Save and Summary ─────────────────────────────────────
  save(db);
  const blockCount = get(db, 'SELECT COUNT(*) as c FROM blockchain_ledger');
  console.log(`
  Seed complete!
  ───────────────────────────────
  Counties:           ${counties.length}
  Procuring Entities: ${Object.keys(entityIds).length}
  Contractors:        ${Object.keys(contractorIds).length}
  Tenders:            ${Object.keys(tenderIds).length}
  Bids:               ${Object.keys(bidIds).length}
  Awards:             ${Object.keys(awardIds).length}
  Blockchain blocks:  ${blockCount.c}
  `);

  db.close();
}

seed().catch(err => { console.error('[SEED] Error:', err); process.exit(1); });
