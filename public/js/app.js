/* ═══════════════════════════════════════════════════════════════
   TTK — Transparent Tenders Kenya  |  e-GP Portal Application
   Single-page application with hash-based routing.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── API CLIENT ───────────────────────────────────────────
  const API = {
    async get(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    },
    async post(url, body) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `${r.status}`); }
      return r.json();
    },
    async patch(url, body) {
      const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `${r.status}`); }
      return r.json();
    }
  };

  // ── HELPERS ──────────────────────────────────────────────
  function kes(n) {
    if (n == null || isNaN(n)) return 'KES 0';
    return 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0 });
  }

  function shortKes(n) {
    if (n == null) return 'KES 0';
    if (n >= 1e9) return 'KES ' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return 'KES ' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return 'KES ' + (n / 1e3).toFixed(0) + 'K';
    return kes(n);
  }

  function badge(text, type) {
    const cls = type || text.toLowerCase().replace(/\s/g, '_');
    return `<span class="badge badge--${cls}">${text}</span>`;
  }

  function methodBadge(m) {
    return `<span class="badge badge--method-${m}">${m.toUpperCase()}</span>`;
  }

  function timeAgo(dt) {
    if (!dt) return '—';
    const s = Math.floor((Date.now() - new Date(dt).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function progressBar(pct, color) {
    const c = color || (pct >= 80 ? 'green' : pct >= 40 ? 'orange' : 'red');
    return `<div class="progress"><div class="progress__bar progress__bar--${c}" style="width:${Math.min(pct, 100)}%"></div></div>`;
  }

  function loading() { return '<div class="loading">Loading…</div>'; }
  function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── ROUTING ──────────────────────────────────────────────
  const app = document.getElementById('app');
  const routes = {};

  function register(pattern, handler) {
    routes[pattern] = handler;
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function matchRoute(hash) {
    const path = hash.replace(/^#/, '') || '/';
    for (const pattern of Object.keys(routes)) {
      const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, '([^/]+)') + '$');
      const m = path.match(regex);
      if (m) return { handler: routes[pattern], params: m.slice(1) };
    }
    return null;
  }

  async function handleRoute() {
    const hash = window.location.hash || '#/';
    const matched = matchRoute(hash);

    // Update active nav
    document.querySelectorAll('.main-nav__link').forEach(l => {
      const route = l.getAttribute('data-route');
      const current = hash.replace(/^#/, '') || '/';
      l.classList.toggle('main-nav__link--active', current === route || (route !== '/' && current.startsWith(route)));
    });

    if (matched) {
      app.innerHTML = loading();
      app.className = 'content fade-in';
      try {
        await matched.handler(...matched.params);
      } catch (err) {
        app.innerHTML = `<div class="alert alert--danger">Error loading page: ${escHtml(err.message)}</div>`;
      }
    } else {
      app.innerHTML = '<div class="empty-state"><h3>Page Not Found</h3><p>The page you requested does not exist.</p><a href="#/" class="btn btn--primary" style="margin-top:1rem">Go Home</a></div>';
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', handleRoute);

  // ── SEARCH ───────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.classList.remove('open'); return; }
    searchTimer = setTimeout(async () => {
      try {
        const data = await API.get(`/api/dashboard/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(data.data);
      } catch { searchResults.innerHTML = '<div class="sr-empty">Search failed</div>'; searchResults.classList.add('open'); }
    }, 300);
  });

  searchInput.addEventListener('blur', () => setTimeout(() => searchResults.classList.remove('open'), 200));
  searchInput.addEventListener('focus', () => { if (searchResults.innerHTML) searchResults.classList.add('open'); });

  function renderSearchResults(data) {
    let html = '';
    if (data.tenders && data.tenders.length) {
      html += '<div class="sr-group">Tenders</div>';
      data.tenders.forEach(t => {
        html += `<div class="sr-item" onclick="location.hash='#/tenders/${t.id}'">
          <span class="sr-badge badge badge--${t.status}">${t.status}</span>
          <div><strong>${escHtml(t.title)}</strong><br><small>${t.reference_no} — ${t.county_name || 'National'}</small></div>
        </div>`;
      });
    }
    if (data.contractors && data.contractors.length) {
      html += '<div class="sr-group">Contractors</div>';
      data.contractors.forEach(c => {
        html += `<div class="sr-item" onclick="location.hash='#/contractors/${c.id}'">
          ${c.is_blacklisted ? '<span class="sr-badge badge badge--blacklisted">BLACKLISTED</span>' : ''}
          <div><strong>${escHtml(c.name)}</strong><br><small>${c.registration_no} — ${c.category}</small></div>
        </div>`;
      });
    }
    if (data.entities && data.entities.length) {
      html += '<div class="sr-group">Entities</div>';
      data.entities.forEach(e => {
        html += `<div class="sr-item">
          <span class="sr-badge badge badge--${e.type === 'national' ? 'evaluation' : 'bidding'}">${e.type}</span>
          <div><strong>${escHtml(e.name)}</strong><br><small>${e.county_name || 'National'}</small></div>
        </div>`;
      });
    }
    if (!html) html = '<div class="sr-empty">No results found</div>';
    searchResults.innerHTML = html;
    searchResults.classList.add('open');
  }

  // ── DATE DISPLAY ─────────────────────────────────────────
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── MODAL HELPERS ────────────────────────────────────────
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  function openModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.classList.add('open');
  }
  function closeModal() {
    modalOverlay.classList.remove('open');
    modalContent.innerHTML = '';
  }

  // Clean up chart instances on page change
  const chartInstances = [];
  function destroyCharts() { chartInstances.forEach(c => c.destroy()); chartInstances.length = 0; }
  function makeChart(canvasId, config) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const c = new Chart(ctx, config);
    chartInstances.push(c);
    return c;
  }

  // ═══════════════════════════════════════════════════════════
  //  PAGE: HOME
  // ═══════════════════════════════════════════════════════════
  register('/', async () => {
    destroyCharts();
    const data = await API.get('/api/dashboard/overview');
    const s = data.data.summary;
    const health = await API.get('/api/health');

    app.innerHTML = `
      <div class="hero">
        <h1>Transparent Tenders Kenya</h1>
        <p>Kenya's digital public procurement platform integrating all 47 counties and the national government. Every tender tracked. Every shilling accounted for. Powered by AI and blockchain.</p>
        <div class="hero__stats">
          <div class="hero__stat"><span class="hero__stat-value">${s.total_tenders}</span><span class="hero__stat-label">Total Tenders</span></div>
          <div class="hero__stat"><span class="hero__stat-value">${s.total_awarded}</span><span class="hero__stat-label">Contracts Awarded</span></div>
          <div class="hero__stat"><span class="hero__stat-value">${shortKes(s.total_contract_value)}</span><span class="hero__stat-label">Contract Value</span></div>
          <div class="hero__stat"><span class="hero__stat-value">${s.total_contractors}</span><span class="hero__stat-label">Registered Contractors</span></div>
          <div class="hero__stat"><span class="hero__stat-value">${s.blockchain_blocks}</span><span class="hero__stat-label">Blockchain Blocks</span></div>
          <div class="hero__stat"><span class="hero__stat-value">${s.open_fraud_alerts}</span><span class="hero__stat-label">Open Fraud Alerts</span></div>
        </div>
        <div class="hero__actions">
          <a href="#/tenders" class="btn btn--lg" style="background:#fff;color:#006233">Browse Tenders</a>
          <a href="#/dashboard" class="btn btn--lg btn--secondary" style="border-color:#fff;color:#fff">View Dashboard</a>
        </div>
        <div class="kenya-stripe"><span class="kenya-stripe--black"></span><span class="kenya-stripe--red"></span><span class="kenya-stripe--green"></span></div>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-card--green">
          <span class="stat-card__label">System Status</span>
          <span class="stat-card__value" style="color:#006233">${health.status === 'healthy' ? '● Online' : '○ Issue'}</span>
          <span class="stat-card__sub">Uptime: ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m</span>
        </div>
        <div class="stat-card stat-card--blue">
          <span class="stat-card__label">Blockchain Integrity</span>
          <span class="stat-card__value" style="color:${health.blockchain === 'valid' ? '#006233' : '#BB0000'}">${health.blockchain === 'valid' ? '✓ Valid' : '✗ Compromised'}</span>
          <span class="stat-card__sub">${health.blockchain_blocks} blocks verified</span>
        </div>
        <div class="stat-card stat-card--orange">
          <span class="stat-card__label">Open Alerts</span>
          <span class="stat-card__value" style="color:${s.open_fraud_alerts > 0 ? '#BB0000' : '#006233'}">${s.open_fraud_alerts}</span>
          <span class="stat-card__sub">AI fraud detection active</span>
        </div>
        <div class="stat-card stat-card--purple">
          <span class="stat-card__label">Total Payments</span>
          <span class="stat-card__value">${shortKes(s.total_payments)}</span>
          <span class="stat-card__sub">Across all contracts</span>
        </div>
      </div>

      <div class="chart-grid">
        <div class="card">
          <div class="card__header"><h3>Tenders by Status</h3></div>
          <div class="card__body"><div class="chart-wrap"><canvas id="chartStatus"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card__header"><h3>Procurement Methods</h3></div>
          <div class="card__body"><div class="chart-wrap"><canvas id="chartMethod"></canvas></div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div class="card__header"><h3>Recent Contract Awards</h3><a href="#/dashboard" class="btn btn--sm btn--ghost">View All</a></div>
        <div class="card__body" style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tender</th><th>Contractor</th><th>County</th><th>Value</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              ${data.data.recent_awards.map(a => `<tr class="clickable" onclick="location.hash='#/tenders/${a.reference_no}'">
                <td><strong>${escHtml(a.tender_title)}</strong><br><small>${a.reference_no}</small></td>
                <td>${escHtml(a.contractor_name)}</td>
                <td>${a.county_name || 'National'}</td>
                <td class="money">${shortKes(a.contract_value)}</td>
                <td style="min-width:120px">${progressBar(a.completion_pct)}<small>${a.completion_pct}%</small></td>
                <td>${badge(a.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <h2 class="section-title">Quick Access — All 47 Counties</h2>
      <div id="homeCountyGrid" class="county-grid"></div>
    `;

    // Charts
    const statusMap = {};
    data.data.tenders_by_status.forEach(t => { statusMap[t.status] = t.count; });
    const statusColors = { draft: '#adb5bd', published: '#4dabf7', bidding: '#ffc078', evaluation: '#69db7c', awarded: '#38d9a9', completed: '#51cf66', cancelled: '#ff6b6b' };

    makeChart('chartStatus', {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusMap).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        datasets: [{ data: Object.values(statusMap), backgroundColor: Object.keys(statusMap).map(s => statusColors[s] || '#adb5bd'), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    const methodMap = {};
    data.data.tenders_by_method.forEach(t => { methodMap[t.method] = t.count; });
    const methodColors = { open: '#51cf66', restricted: '#ffc078', direct: '#ff6b6b', rfq: '#38d9a9', rfp: '#4dabf7' };

    makeChart('chartMethod', {
      type: 'bar',
      data: {
        labels: Object.keys(methodMap).map(m => m.toUpperCase()),
        datasets: [{ label: 'Tenders', data: Object.values(methodMap), backgroundColor: Object.keys(methodMap).map(m => methodColors[m] || '#adb5bd'), borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    // County grid
    try {
      const counties = await API.get('/api/counties');
      document.getElementById('homeCountyGrid').innerHTML = counties.data.map(c =>
        `<div class="county-card" onclick="location.hash='#/counties/${c.id}'">
          <div class="county-card__name">${escHtml(c.name)}</div>
          <div class="county-card__region">${c.region}</div>
        </div>`
      ).join('');
    } catch {}
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: DASHBOARD
  // ═══════════════════════════════════════════════════════════
  register('/dashboard', async () => {
    destroyCharts();
    const data = await API.get('/api/dashboard/overview');
    const s = data.data.summary;
    const rankings = await API.get('/api/dashboard/rankings');

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Dashboard</div>
      <h1 class="section-title">Citizen Oversight Dashboard</h1>

      <div class="stats-grid">
        <div class="stat-card stat-card--green"><span class="stat-card__label">Total Tenders</span><span class="stat-card__value">${s.total_tenders}</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">Contracts Awarded</span><span class="stat-card__value">${s.total_awarded}</span></div>
        <div class="stat-card stat-card--green"><span class="stat-card__label">Total Contract Value</span><span class="stat-card__value">${shortKes(s.total_contract_value)}</span></div>
        <div class="stat-card stat-card--purple"><span class="stat-card__label">Contractors</span><span class="stat-card__value">${s.total_contractors}</span></div>
        <div class="stat-card stat-card--orange"><span class="stat-card__label">Total Payments</span><span class="stat-card__value">${shortKes(s.total_payments)}</span></div>
        <div class="stat-card stat-card--red"><span class="stat-card__label">Open Fraud Alerts</span><span class="stat-card__value">${s.open_fraud_alerts}</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">Blockchain Blocks</span><span class="stat-card__value">${s.blockchain_blocks}</span></div>
      </div>

      <div class="chart-grid">
        <div class="card">
          <div class="card__header"><h3>Tenders by Status</h3></div>
          <div class="card__body"><div class="chart-wrap"><canvas id="dashChartStatus"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card__header"><h3>Top Counties by Open Tender %</h3></div>
          <div class="card__body"><div class="chart-wrap"><canvas id="dashChartCounty"></canvas></div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div class="card__header"><h3>County Transparency Rankings</h3></div>
        <div class="card__body" style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>#</th><th>County</th><th>Region</th><th>Tenders</th><th>Open Tenders</th><th>Awards</th><th>Total Value</th><th>Transparency %</th></tr></thead>
            <tbody>
              ${rankings.data.filter(r => r.tender_count > 0).map((r, i) => `<tr class="clickable" onclick="location.hash='#/counties/${r.id}'">
                <td>${i + 1}</td>
                <td><strong>${escHtml(r.name)}</strong></td>
                <td>${r.region}</td>
                <td>${r.tender_count}</td>
                <td>${r.open_tenders}</td>
                <td>${r.award_count}</td>
                <td class="money">${shortKes(r.total_value)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:.4rem">
                    ${progressBar(r.open_tender_pct, r.open_tender_pct >= 80 ? 'green' : r.open_tender_pct >= 50 ? 'orange' : 'red')}
                    <span style="min-width:35px;font-weight:700;font-size:.78rem">${r.open_tender_pct}%</span>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Recent Contract Awards</h3></div>
        <div class="card__body" style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tender</th><th>Contractor</th><th>County</th><th>Value</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              ${data.data.recent_awards.map(a => `<tr class="clickable" onclick="location.hash='#/tenders/${a.id}'">
                <td><strong>${escHtml(a.tender_title)}</strong><br><small>${a.reference_no}</small></td>
                <td>${escHtml(a.contractor_name)}</td>
                <td>${a.county_name || 'National'}</td>
                <td class="money">${shortKes(a.contract_value)}</td>
                <td style="min-width:120px">${progressBar(a.completion_pct)}<small>${a.completion_pct}%</small></td>
                <td>${badge(a.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Charts
    const statusMap = {};
    data.data.tenders_by_status.forEach(t => { statusMap[t.status] = t.count; });
    const statusColors = { draft: '#adb5bd', published: '#4dabf7', bidding: '#ffc078', evaluation: '#69db7c', awarded: '#38d9a9', completed: '#51cf66', cancelled: '#ff6b6b' };

    makeChart('dashChartStatus', {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusMap).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        datasets: [{ data: Object.values(statusMap), backgroundColor: Object.keys(statusMap).map(s => statusColors[s] || '#adb5bd'), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    const topCounties = rankings.data.filter(r => r.tender_count > 0).slice(0, 10);
    makeChart('dashChartCounty', {
      type: 'bar',
      data: {
        labels: topCounties.map(r => r.name),
        datasets: [{ label: 'Open Tender %', data: topCounties.map(r => r.open_tender_pct), backgroundColor: topCounties.map(r => r.open_tender_pct >= 80 ? '#51cf66' : r.open_tender_pct >= 50 ? '#ffc078' : '#ff6b6b'), borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 100 } } }
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: TENDERS LIST
  // ═══════════════════════════════════════════════════════════
  register('/tenders', async () => {
    destroyCharts();
    let currentPage = 1;
    const perPage = 15;
    let filters = {};

    async function load() {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('per_page', perPage);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const data = await API.get(`/api/tenders?${params}`);
      const counties = await API.get('/api/counties');

      renderTenderList(data, counties.data);
    }

    function renderTenderList(data, counties) {
      const tenders = data.data;
      const pg = data.pagination;

      app.innerHTML = `
        <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Tenders</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
          <h1 class="section-title" style="margin-bottom:0">Public Tenders</h1>
          <div style="display:flex;gap:.5rem">
            <a href="#/admin" class="btn btn--primary btn--sm">+ Create Tender</a>
          </div>
        </div>

        <div class="filters" id="tenderFilters">
          <label>Status</label>
          <select id="fStatus"><option value="">All</option><option value="draft">Draft</option><option value="published">Published</option><option value="bidding">Bidding</option><option value="evaluation">Evaluation</option><option value="awarded">Awarded</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
          <label>County</label>
          <select id="fCounty"><option value="">All Counties</option>${counties.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
          <label>Category</label>
          <select id="fCategory"><option value="">All</option><option value="construction">Construction</option><option value="medical">Medical</option><option value="ict">ICT</option><option value="water">Water</option><option value="energy">Energy</option><option value="security">Security</option><option value="supplies">Supplies</option><option value="consultancy">Consultancy</option></select>
          <label>Method</label>
          <select id="fMethod"><option value="">All</option><option value="open">Open</option><option value="restricted">Restricted</option><option value="direct">Direct</option><option value="rfq">RFQ</option><option value="rfp">RFP</option></select>
          <input type="text" id="fSearch" placeholder="Search tenders…" style="min-width:180px">
        </div>

        <div class="card">
          <div class="card__body" style="overflow-x:auto">
            ${tenders.length ? `<table class="data-table">
              <thead><tr><th>Ref No.</th><th>Title</th><th>Entity</th><th>County</th><th>Category</th><th>Method</th><th>Est. Value</th><th>Status</th><th>Published</th></tr></thead>
              <tbody>
                ${tenders.map(t => `<tr class="clickable" onclick="location.hash='#/tenders/${t.id}'">
                  <td><strong>${t.reference_no}</strong></td>
                  <td>${escHtml(t.title)}</td>
                  <td><small>${escHtml(t.entity_name || '—')}</small></td>
                  <td>${t.county_name || 'National'}</td>
                  <td>${t.category}</td>
                  <td>${methodBadge(t.method)}</td>
                  <td class="money">${shortKes(t.estimated_value)}</td>
                  <td>${badge(t.status)}</td>
                  <td><small>${fmtDate(t.published_at)}</small></td>
                </tr>`).join('')}
              </tbody>
            </table>` : '<div class="empty-state"><h3>No tenders found</h3><p>Try adjusting your filters.</p></div>'}
          </div>
          ${pg ? `<div class="card__footer">
            <div class="pagination">
              <button ${pg.page <= 1 ? 'disabled' : ''} onclick="window.__tenderPrev()">← Prev</button>
              <span class="page-info">Page ${pg.page} of ${pg.total_pages} (${pg.total} tenders)</span>
              <button ${pg.page >= pg.total_pages ? 'disabled' : ''} onclick="window.__tenderNext()">Next →</button>
            </div>
          </div>` : ''}
        </div>
      `;

      // Set filter values
      if (filters.status) document.getElementById('fStatus').value = filters.status;
      if (filters.county_id) document.getElementById('fCounty').value = filters.county_id;
      if (filters.category) document.getElementById('fCategory').value = filters.category;
      if (filters.method) document.getElementById('fMethod').value = filters.method;
      if (filters.search) document.getElementById('fSearch').value = filters.search;

      // Filter handlers
      const applyFilters = () => {
        filters = {
          status: document.getElementById('fStatus').value,
          county_id: document.getElementById('fCounty').value,
          category: document.getElementById('fCategory').value,
          method: document.getElementById('fMethod').value,
          search: document.getElementById('fSearch').value
        };
        currentPage = 1;
        load();
      };

      document.getElementById('fStatus').onchange = applyFilters;
      document.getElementById('fCounty').onchange = applyFilters;
      document.getElementById('fCategory').onchange = applyFilters;
      document.getElementById('fMethod').onchange = applyFilters;
      let searchTimeout;
      document.getElementById('fSearch').oninput = () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyFilters, 400); };

      window.__tenderPrev = () => { if (currentPage > 1) { currentPage--; load(); } };
      window.__tenderNext = () => { if (currentPage < pg.total_pages) { currentPage++; load(); } };
    }

    await load();
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: TENDER DETAIL
  // ═══════════════════════════════════════════════════════════
  register('/tenders/:id', async (id) => {
    destroyCharts();
    const data = await API.get(`/api/tenders/${id}`);
    const d = data.data;
    const t = d.tender;

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> <a href="#/tenders">Tenders</a> <span>/</span> ${t.reference_no}</div>

      <div class="detail-header">
        <div>
          <h1>${escHtml(t.title)} <span class="ref">${t.reference_no}</span></h1>
          <div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap">
            ${badge(t.status)} ${methodBadge(t.method)}
          </div>
        </div>
        <div style="text-align:right">
          <div class="money money--large money--positive">${kes(t.estimated_value)}</div>
          <small>Estimated Value</small>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom:1.5rem">
        <div class="stat-card stat-card--green"><span class="stat-card__label">Entity</span><span class="stat-card__value" style="font-size:1rem">${escHtml(t.entity_name || '—')}</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">County</span><span class="stat-card__value" style="font-size:1rem">${t.county_name || 'National'}</span></div>
        <div class="stat-card stat-card--orange"><span class="stat-card__label">Category</span><span class="stat-card__value" style="font-size:1rem;text-transform:capitalize">${t.category}</span></div>
        <div class="stat-card stat-card--purple"><span class="stat-card__label">Published</span><span class="stat-card__value" style="font-size:1rem">${fmtDate(t.published_at)}</span></div>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div class="card__header"><h3>Description</h3></div>
        <div class="card__body"><p>${escHtml(t.description)}</p></div>
      </div>

      <div class="tabs" id="tenderTabs">
        <button class="tab-btn tab-btn--active" data-tab="bids">Bids (${d.bids.length})</button>
        <button class="tab-btn" data-tab="award">Award</button>
        <button class="tab-btn" data-tab="fraud">Fraud Alerts (${d.fraud_alerts.length})</button>
        <button class="tab-btn" data-tab="chain">Blockchain Trail (${d.blockchain_trail.length})</button>
      </div>

      <div class="tab-panel tab-panel--active" id="tab-bids">
        ${d.bids.length ? `<table class="data-table">
          <thead><tr><th>Contractor</th><th>Bid Amount</th><th>Technical</th><th>Financial</th><th>Total</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            ${d.bids.map(b => `<tr class="clickable" onclick="location.hash='#/contractors/${b.contractor_id}'">
              <td><strong>${escHtml(b.contractor_name)}</strong></td>
              <td class="money">${kes(b.bid_amount)}</td>
              <td>${b.technical_score != null ? b.technical_score : '—'}</td>
              <td>${b.financial_score != null ? b.financial_score : '—'}</td>
              <td><strong>${b.total_score != null ? b.total_score.toFixed(1) : '—'}</strong></td>
              <td>${badge(b.status)}</td>
              <td><small>${fmtDate(b.submitted_at)}</small></td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><h3>No bids submitted yet</h3></div>'}
      </div>

      <div class="tab-panel" id="tab-award">
        ${d.award ? `
          <div class="stats-grid">
            <div class="stat-card stat-card--green"><span class="stat-card__label">Contractor</span><span class="stat-card__value" style="font-size:1rem">${escHtml(d.award.contractor_name)}</span></div>
            <div class="stat-card stat-card--blue"><span class="stat-card__label">Contract Value</span><span class="stat-card__value">${shortKes(d.award.contract_value)}</span></div>
            <div class="stat-card stat-card--orange"><span class="stat-card__label">Completion</span><span class="stat-card__value">${d.award.completion_pct}%</span></div>
            <div class="stat-card stat-card--purple"><span class="stat-card__label">Status</span><span class="stat-card__value" style="font-size:1rem">${d.award.status}</span></div>
          </div>
          <div style="margin-top:1rem">
            <strong>Progress</strong>
            ${progressBar(d.award.completion_pct)}
          </div>
          <div style="margin-top:.8rem;font-size:.82rem;color:#555">
            <p>Start: ${fmtDate(d.award.start_date)} — End: ${fmtDate(d.award.end_date)}</p>
            <p>Awarded: ${fmtDate(d.award.award_date)}</p>
          </div>
        ` : '<div class="empty-state"><h3>Not yet awarded</h3></div>'}
      </div>

      <div class="tab-panel" id="tab-fraud">
        ${d.fraud_alerts.length ? d.fraud_alerts.map(a => `
          <div class="fraud-item">
            <div class="fraud-item__severity fraud-item__severity--${a.severity}"></div>
            <div class="fraud-item__body">
              <div class="fraud-item__type">${a.alert_type.replace(/_/g, ' ')} ${badge(a.severity, a.severity)}</div>
              <div class="fraud-item__desc">${escHtml(a.description)}</div>
              <div class="fraud-item__meta"><span>Status: ${badge(a.status)}</span><span>${fmtDate(a.created_at)}</span></div>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><h3>No fraud alerts</h3><p>AI fraud detection has not flagged any issues for this tender.</p></div>'}
      </div>

      <div class="tab-panel" id="tab-chain">
        ${d.blockchain_trail.length ? `<div class="block-chain">
          ${d.blockchain_trail.map(b => `
            <div class="block-item">
              <div class="block-item__index">#${b.block_index}</div>
              <div class="block-item__info">
                <div class="block-item__event">${b.event_type.replace(/_/g, ' ')}</div>
                <div class="block-item__time">${fmtDate(b.timestamp)}</div>
                <div class="block-item__hash">Hash: ${b.block_hash}</div>
                <div class="block-item__hash">Prev: ${b.previous_hash}</div>
              </div>
            </div>
          `).join('')}
        </div>` : '<div class="empty-state"><h3>No blockchain records</h3></div>'}
      </div>
    `;

    // Tab switching
    document.querySelectorAll('#tenderTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
        btn.classList.add('tab-btn--active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('tab-panel--active');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: CONTRACTORS LIST
  // ═══════════════════════════════════════════════════════════
  register('/contractors', async () => {
    destroyCharts();
    let currentPage = 1;
    const perPage = 15;
    let filters = {};

    async function load() {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('per_page', perPage);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const data = await API.get(`/api/contractors?${params}`);
      render(data);
    }

    function render(data) {
      const list = data.data;
      const pg = data.pagination;

      app.innerHTML = `
        <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Contractors</div>
        <h1 class="section-title">Contractor Registry</h1>

        <div class="filters">
          <label>Category</label>
          <select id="cCat"><option value="">All</option><option value="construction">Construction</option><option value="medical">Medical</option><option value="ict">ICT</option><option value="water">Water</option><option value="energy">Energy</option><option value="security">Security</option><option value="supplies">Supplies</option><option value="consultancy">Consultancy</option></select>
          <label>Status</label>
          <select id="cBlack"><option value="">All</option><option value="false">Active</option><option value="true">Blacklisted</option></select>
          <input type="text" id="cSearch" placeholder="Search by name or reg no…" style="min-width:200px">
        </div>

        <div class="card">
          <div class="card__body" style="overflow-x:auto">
            ${list.length ? `<table class="data-table">
              <thead><tr><th>Name</th><th>Reg No.</th><th>Category</th><th>County</th><th>Tax</th><th>Status</th><th>Directors</th></tr></thead>
              <tbody>
                ${list.map(c => {
                  let directors = [];
                  try { directors = JSON.parse(c.directors); } catch {}
                  return `<tr class="clickable" onclick="location.hash='#/contractors/${c.id}'">
                    <td><strong>${escHtml(c.name)}</strong></td>
                    <td>${c.registration_no}</td>
                    <td style="text-transform:capitalize">${c.category}</td>
                    <td>${c.county_name || '—'}</td>
                    <td>${c.tax_compliant ? badge('Compliant', 'compliant') : badge('Non-Compliant', 'non-compliant')}</td>
                    <td>${c.is_blacklisted ? badge('BLACKLISTED', 'blacklisted') : badge('Active', 'active')}</td>
                    <td><small>${directors.join(', ')}</small></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>` : '<div class="empty-state"><h3>No contractors found</h3></div>'}
          </div>
          ${pg ? `<div class="card__footer"><div class="pagination">
            <button ${pg.page <= 1 ? 'disabled' : ''} onclick="window.__cPrev()">← Prev</button>
            <span class="page-info">Page ${pg.page} of ${pg.total_pages} (${pg.total} contractors)</span>
            <button ${pg.page >= pg.total_pages ? 'disabled' : ''} onclick="window.__cNext()">Next →</button>
          </div></div>` : ''}
        </div>
      `;

      if (filters.category) document.getElementById('cCat').value = filters.category;
      if (filters.blacklisted) document.getElementById('cBlack').value = filters.blacklisted;
      if (filters.search) document.getElementById('cSearch').value = filters.search;

      const apply = () => {
        filters = { category: document.getElementById('cCat').value, blacklisted: document.getElementById('cBlack').value, search: document.getElementById('cSearch').value };
        currentPage = 1;
        load();
      };

      document.getElementById('cCat').onchange = apply;
      document.getElementById('cBlack').onchange = apply;
      let t; document.getElementById('cSearch').oninput = () => { clearTimeout(t); t = setTimeout(apply, 400); };
      window.__cPrev = () => { if (currentPage > 1) { currentPage--; load(); } };
      window.__cNext = () => { if (currentPage < pg.total_pages) { currentPage++; load(); } };
    }

    await load();
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: CONTRACTOR DETAIL
  // ═══════════════════════════════════════════════════════════
  register('/contractors/:id', async (id) => {
    destroyCharts();
    const data = await API.get(`/api/contractors/${id}/profile`);
    const d = data.data;
    const c = d.contractor;
    const risk = d.risk_assessment;

    let directors = [];
    try { directors = JSON.parse(c.directors); } catch {}
    let ownership = {};
    try { ownership = JSON.parse(c.ownership); } catch {}

    const riskColor = risk.risk_level === 'critical' ? '#721c24' : risk.risk_level === 'high' ? '#dc3545' : risk.risk_level === 'medium' ? '#f0ad4e' : '#28a745';

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> <a href="#/contractors">Contractors</a> <span>/</span> ${escHtml(c.name)}</div>

      <div class="detail-header">
        <div>
          <h1>${escHtml(c.name)}</h1>
          <div style="margin-top:.4rem">${c.is_blacklisted ? badge('BLACKLISTED', 'blacklisted') : badge('Active', 'active')} <span style="color:#777;font-size:.82rem;margin-left:.5rem">${c.registration_no} | KRA: ${c.kra_pin}</span></div>
          ${c.blacklist_reason ? `<div class="alert alert--danger" style="margin-top:.5rem">${escHtml(c.blacklist_reason)}</div>` : ''}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-card--green">
          <span class="stat-card__label">Category</span>
          <span class="stat-card__value" style="font-size:1rem;text-transform:capitalize">${c.category}</span>
        </div>
        <div class="stat-card stat-card--blue">
          <span class="stat-card__label">Total Projects</span>
          <span class="stat-card__value">${d.statistics.total_projects}</span>
          <span class="stat-card__sub">${shortKes(d.statistics.total_value)} total value</span>
        </div>
        <div class="stat-card stat-card--orange">
          <span class="stat-card__label">Avg Quality Score</span>
          <span class="stat-card__value">${d.statistics.avg_quality ? d.statistics.avg_quality.toFixed(0) : '—'}/100</span>
        </div>
        <div class="stat-card stat-card--purple">
          <span class="stat-card__label">Risk Score</span>
          <span class="stat-card__value" style="color:${riskColor}">${risk.risk_score}/100</span>
          <span class="stat-card__sub">${badge(risk.risk_level.toUpperCase(), 'risk-' + risk.risk_level)}</span>
        </div>
      </div>

      <div style="margin-bottom:1.5rem">
        <strong>AI Risk Assessment</strong>
        <div class="risk-meter" style="margin-top:.5rem">
          <div class="risk-meter__bar"><div class="risk-meter__fill" style="width:${risk.risk_score}%;background:${riskColor}"></div></div>
          <div class="risk-meter__score" style="color:${riskColor}">${risk.risk_score}</div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="card">
          <div class="card__header"><h3>Directors & Ownership</h3></div>
          <div class="card__body">
            <p><strong>Directors:</strong></p>
            <ul style="padding-left:1.2rem;margin:.3rem 0 .8rem">${directors.map(d => `<li>${escHtml(d)}</li>`).join('')}</ul>
            ${ownership.shareholders ? `<p><strong>Shareholders:</strong></p>
            <ul style="padding-left:1.2rem;margin:.3rem 0">${ownership.shareholders.map(s => `<li>${escHtml(s.name)} — ${s.share_pct}%</li>`).join('')}</ul>` : ''}
            <p style="margin-top:.5rem;font-size:.78rem;color:#777">Registered: ${fmtDate(c.date_registered)} | County: ${c.county_name || '—'}</p>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h3>Active Contracts</h3></div>
          <div class="card__body">
            ${d.active_contracts.length ? d.active_contracts.map(a => `
              <div style="margin-bottom:.8rem;padding-bottom:.8rem;border-bottom:1px solid #f0f0f0">
                <strong><a href="#/tenders/${a.tender_id}">${escHtml(a.tender_title)}</a></strong>
                <div style="font-size:.78rem;color:#777">${a.reference_no} — ${kes(a.contract_value)}</div>
                <div style="margin-top:.3rem">${progressBar(a.completion_pct)} <small>${a.completion_pct}%</small></div>
              </div>
            `).join('') : '<p style="color:#999">No active contracts</p>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Performance History</h3></div>
        <div class="card__body" style="overflow-x:auto">
          ${d.performance_history.length ? `<table class="data-table">
            <thead><tr><th>Project</th><th>Value</th><th>Completion</th><th>Quality</th><th>Timeliness</th><th>Status</th></tr></thead>
            <tbody>
              ${d.performance_history.map(p => `<tr>
                <td><strong>${escHtml(p.project_name)}</strong></td>
                <td class="money">${shortKes(p.contract_value)}</td>
                <td>${progressBar(p.completion_pct)} <small>${p.completion_pct}%</small></td>
                <td>${p.quality_score || '—'}</td>
                <td>${p.timeliness_score || '—'}</td>
                <td>${badge(p.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="empty-state"><h3>No performance records</h3></div>'}
        </div>
      </div>
    `;
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: COUNTIES LIST
  // ═══════════════════════════════════════════════════════════
  register('/counties', async () => {
    destroyCharts();
    const counties = await API.get('/api/counties');
    const rankings = await API.get('/api/dashboard/rankings');

    const rankMap = {};
    rankings.data.forEach(r => { rankMap[r.id] = r; });

    const regions = {};
    counties.data.forEach(c => {
      if (!regions[c.region]) regions[c.region] = [];
      regions[c.region].push(c);
    });

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Counties</div>
      <h1 class="section-title">All 47 Kenya Counties</h1>

      <div class="stats-grid" style="margin-bottom:1.5rem">
        <div class="stat-card stat-card--green"><span class="stat-card__label">Total Counties</span><span class="stat-card__value">47</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">Regions</span><span class="stat-card__value">${Object.keys(regions).length}</span></div>
        <div class="stat-card stat-card--orange"><span class="stat-card__label">Counties with Tenders</span><span class="stat-card__value">${rankings.data.filter(r => r.tender_count > 0).length}</span></div>
      </div>

      ${Object.entries(regions).map(([region, list]) => `
        <h2 style="font-size:.95rem;font-weight:700;color:#006233;margin:1.2rem 0 .6rem;text-transform:uppercase;letter-spacing:.05em">${region} Region</h2>
        <div class="county-grid" style="margin-bottom:1rem">
          ${list.map(c => {
            const r = rankMap[c.id] || {};
            return `<div class="county-card" onclick="location.hash='#/counties/${c.id}'">
              <div class="county-card__name">${escHtml(c.name)}</div>
              <div class="county-card__region">${c.code}</div>
              <div class="county-card__stat">${r.tender_count || 0} tenders | ${shortKes(r.total_value || 0)}</div>
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    `;
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: COUNTY DETAIL
  // ═══════════════════════════════════════════════════════════
  register('/counties/:id', async (id) => {
    destroyCharts();
    const data = await API.get(`/api/dashboard/county/${id}`);
    const d = data.data;
    const c = d.county;
    const st = d.stats;

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> <a href="#/counties">Counties</a> <span>/</span> ${escHtml(c.name)}</div>
      <h1 class="section-title">${escHtml(c.name)} County</h1>
      <p style="color:#777;margin-bottom:1rem">${c.region} Region — Code: ${c.code}</p>

      <div class="stats-grid">
        <div class="stat-card stat-card--green"><span class="stat-card__label">Tenders</span><span class="stat-card__value">${st.tender_count}</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">Awards</span><span class="stat-card__value">${st.award_count}</span></div>
        <div class="stat-card stat-card--orange"><span class="stat-card__label">Total Awarded Value</span><span class="stat-card__value">${shortKes(st.total_awarded_value)}</span></div>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div class="card__header"><h3>Recent Tenders</h3></div>
        <div class="card__body" style="overflow-x:auto">
          ${d.recent_tenders.length ? `<table class="data-table">
            <thead><tr><th>Title</th><th>Entity</th><th>Category</th><th>Value</th><th>Status</th></tr></thead>
            <tbody>
              ${d.recent_tenders.map(t => `<tr class="clickable" onclick="location.hash='#/tenders/${t.id}'">
                <td><strong>${escHtml(t.title)}</strong></td>
                <td><small>${escHtml(t.entity_name)}</small></td>
                <td>${t.category}</td>
                <td class="money">${shortKes(t.estimated_value)}</td>
                <td>${badge(t.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="empty-state"><h3>No tenders for this county</h3></div>'}
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Recent Awards</h3></div>
        <div class="card__body" style="overflow-x:auto">
          ${d.recent_awards.length ? `<table class="data-table">
            <thead><tr><th>Tender</th><th>Contractor</th><th>Value</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              ${d.recent_awards.map(a => `<tr>
                <td><strong>${escHtml(a.tender_title)}</strong><br><small>${a.reference_no}</small></td>
                <td>${escHtml(a.contractor_name)}</td>
                <td class="money">${shortKes(a.contract_value)}</td>
                <td style="min-width:100px">${progressBar(a.completion_pct)}<small>${a.completion_pct}%</small></td>
                <td>${badge(a.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="empty-state"><h3>No awards for this county</h3></div>'}
        </div>
      </div>
    `;
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: BLOCKCHAIN LEDGER
  // ═══════════════════════════════════════════════════════════
  register('/blockchain', async () => {
    destroyCharts();
    const verify = await API.get('/api/blockchain/verify');
    const chain = await API.get('/api/blockchain/chain?limit=50');

    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Blockchain Ledger</div>
      <h1 class="section-title">Procurement Blockchain Ledger</h1>

      <div class="alert ${verify.data.valid ? 'alert--success' : 'alert--danger'}">
        <strong>${verify.data.valid ? '✓ Blockchain Integrity Verified' : '✗ Blockchain Integrity Compromised!'}</strong>
        — ${verify.data.blocks} blocks in chain${verify.data.errors.length ? `, ${verify.data.errors.length} error(s) found` : ', zero errors'}
      </div>

      <div class="stats-grid" style="margin-bottom:1.5rem">
        <div class="stat-card stat-card--green"><span class="stat-card__label">Total Blocks</span><span class="stat-card__value">${verify.data.blocks}</span></div>
        <div class="stat-card stat-card--blue"><span class="stat-card__label">Chain Status</span><span class="stat-card__value" style="color:${verify.data.valid ? '#006233' : '#BB0000'}">${verify.data.valid ? 'Valid' : 'Compromised'}</span></div>
        <div class="stat-card stat-card--orange"><span class="stat-card__label">Errors</span><span class="stat-card__value">${verify.data.errors.length}</span></div>
      </div>

      <div class="card">
        <div class="card__header"><h3>Recent Blocks</h3>
          <div class="filters" style="margin:0">
            <select id="chainFilter">
              <option value="">All Events</option>
              <option value="TENDER_CREATED">Tender Created</option>
              <option value="TENDER_PUBLISHED">Tender Published</option>
              <option value="BID_SUBMITTED">Bid Submitted</option>
              <option value="CONTRACT_AWARDED">Contract Awarded</option>
              <option value="PAYMENT_MADE">Payment Made</option>
              <option value="CONTRACTOR_REGISTERED">Contractor Registered</option>
            </select>
          </div>
        </div>
        <div class="card__body" id="chainBlocks">
          <div class="block-chain">
            ${chain.data.map(b => `
              <div class="block-item">
                <div class="block-item__index">#${b.block_index}</div>
                <div class="block-item__info">
                  <div class="block-item__event">${b.event_type.replace(/_/g, ' ')}</div>
                  <div class="block-item__time">${fmtDate(b.timestamp)}</div>
                  <div class="block-item__hash">Block: ${b.block_hash}</div>
                  <div class="block-item__hash">Prev:  ${b.previous_hash}</div>
                  <div class="block-item__hash">Data:  ${b.data_hash}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('chainFilter').addEventListener('change', async (e) => {
      const eventType = e.target.value;
      const url = eventType ? `/api/blockchain/chain?event_type=${eventType}&limit=50` : '/api/blockchain/chain?limit=50';
      const filtered = await API.get(url);
      document.getElementById('chainBlocks').innerHTML = `<div class="block-chain">
        ${filtered.data.map(b => `
          <div class="block-item">
            <div class="block-item__index">#${b.block_index}</div>
            <div class="block-item__info">
              <div class="block-item__event">${b.event_type.replace(/_/g, ' ')}</div>
              <div class="block-item__time">${fmtDate(b.timestamp)}</div>
              <div class="block-item__hash">Block: ${b.block_hash}</div>
              <div class="block-item__hash">Prev:  ${b.previous_hash}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: FRAUD ALERTS
  // ═══════════════════════════════════════════════════════════
  register('/fraud', async () => {
    destroyCharts();
    let currentPage = 1;
    let filters = {};

    async function load() {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('per_page', 20);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const data = await API.get(`/api/fraud/alerts?${params}`);
      render(data);
    }

    function render(data) {
      const alerts = data.data;
      const pg = data.pagination;

      app.innerHTML = `
        <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Fraud Alerts</div>
        <h1 class="section-title">AI Fraud Detection Alerts</h1>

        <div class="alert alert--info" style="margin-bottom:1rem">
          TTK uses AI-powered fraud detection to automatically flag suspicious patterns: shared directors, price inflation, repeat winners, blacklisted bidders, and bid collusion. All alerts are recorded on the blockchain.
        </div>

        <div class="filters">
          <label>Severity</label>
          <select id="faSev"><option value="">All</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
          <label>Status</label>
          <select id="faStat"><option value="">All</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
          <button class="btn btn--primary btn--sm" id="btnScan">Run Full Scan</button>
        </div>

        <div class="card">
          <div class="card__body">
            ${alerts.length ? alerts.map(a => `
              <div class="fraud-item">
                <div class="fraud-item__severity fraud-item__severity--${a.severity}"></div>
                <div class="fraud-item__body">
                  <div class="fraud-item__type">${a.alert_type.replace(/_/g, ' ')} ${badge(a.severity, a.severity)}</div>
                  <div class="fraud-item__desc">${escHtml(a.description)}</div>
                  <div class="fraud-item__meta">
                    <span>${badge(a.status)}</span>
                    ${a.tender_ref ? `<span>Tender: <a href="#/tenders/${a.tender_id}">${a.tender_ref}</a></span>` : ''}
                    <span>${fmtDate(a.created_at)}</span>
                  </div>
                </div>
              </div>
            `).join('') : '<div class="empty-state"><h3>No alerts found</h3><p>Try running a fraud scan or adjusting filters.</p></div>'}
          </div>
          ${pg ? `<div class="card__footer"><div class="pagination">
            <button ${pg.page <= 1 ? 'disabled' : ''} onclick="window.__faPrev()">← Prev</button>
            <span class="page-info">Page ${pg.page} of ${pg.total_pages} (${pg.total} alerts)</span>
            <button ${pg.page >= pg.total_pages ? 'disabled' : ''} onclick="window.__faNext()">Next →</button>
          </div></div>` : ''}
        </div>
      `;

      if (filters.severity) document.getElementById('faSev').value = filters.severity;
      if (filters.status) document.getElementById('faStat').value = filters.status;

      const apply = () => {
        filters = { severity: document.getElementById('faSev').value, status: document.getElementById('faStat').value };
        currentPage = 1;
        load();
      };
      document.getElementById('faSev').onchange = apply;
      document.getElementById('faStat').onchange = apply;
      window.__faPrev = () => { if (currentPage > 1) { currentPage--; load(); } };
      window.__faNext = () => { if (currentPage < pg.total_pages) { currentPage++; load(); } };

      document.getElementById('btnScan').addEventListener('click', async () => {
        const btn = document.getElementById('btnScan');
        btn.textContent = 'Scanning…';
        btn.disabled = true;
        try {
          const result = await API.post('/api/fraud/scan');
          const r = result.data;
          openModal(`<h3>Fraud Scan Complete</h3><p>Tenders scanned: <strong>${r.tenders_scanned}</strong></p><p>Total alerts generated: <strong>${r.total_alerts}</strong></p>${r.results.length ? `<div style="margin-top:1rem">${r.results.map(t => `<p>Tender ${t.tender_id}: ${t.alerts.length} alert(s)</p>`).join('')}</div>` : '<p style="color:#006233;margin-top:.5rem">No new issues detected.</p>'}`);
          load();
        } catch (err) {
          openModal(`<h3>Scan Failed</h3><p class="alert alert--danger">${escHtml(err.message)}</p>`);
          btn.textContent = 'Run Full Scan';
          btn.disabled = false;
        }
      });
    }

    await load();
  });

  // ═══════════════════════════════════════════════════════════
  //  PAGE: ADMIN PANEL
  // ═══════════════════════════════════════════════════════════
  register('/admin', async () => {
    destroyCharts();
    let activeTab = 'create';

    async function render() {
      const entitiesData = await API.get('/api/entities?per_page=100');
      const entities = entitiesData.data;
      const counties = await API.get('/api/counties');
      const tenders = await API.get('/api/tenders?per_page=100');
      const contractors = await API.get('/api/contractors?per_page=100');
      const audits = await API.get('/api/audit?per_page=20');

      app.innerHTML = `
        <div class="breadcrumb"><a href="#/">Home</a> <span>/</span> Admin Panel</div>
        <h1 class="section-title">Administration Panel</h1>

        <div class="admin-layout">
          <div class="admin-sidebar">
            <div class="admin-sidebar__link ${activeTab === 'create' ? 'admin-sidebar__link--active' : ''}" data-admin-tab="create">📝 Create Tender</div>
            <div class="admin-sidebar__link ${activeTab === 'manage' ? 'admin-sidebar__link--active' : ''}" data-admin-tab="manage">📋 Manage Tenders</div>
            <div class="admin-sidebar__link ${activeTab === 'contractor' ? 'admin-sidebar__link--active' : ''}" data-admin-tab="contractor">🏢 Add Contractor</div>
            <div class="admin-sidebar__link ${activeTab === 'entity' ? 'admin-sidebar__link--active' : ''}" data-admin-tab="entity">🏛️ Add Entity</div>
            <div class="admin-sidebar__link ${activeTab === 'audit' ? 'admin-sidebar__link--active' : ''}" data-admin-tab="audit">📊 Audit Log</div>
          </div>

          <div class="admin-content">
            <!-- CREATE TENDER -->
            <div class="tab-panel ${activeTab === 'create' ? 'tab-panel--active' : ''}" id="admin-create">
              <div class="card">
                <div class="card__header"><h3>Create New Tender</h3></div>
                <div class="card__body">
                  <form id="formCreateTender">
                    <div class="form-group"><label>Title *</label><input type="text" id="ctTitle" required></div>
                    <div class="form-group"><label>Description *</label><textarea id="ctDesc" required></textarea></div>
                    <div class="form-row">
                      <div class="form-group"><label>Procuring Entity *</label>
                        <select id="ctEntity" required><option value="">Select entity…</option>${entities.map(e => `<option value="${e.id}">${escHtml(e.name)}</option>`).join('')}</select>
                      </div>
                      <div class="form-group"><label>County</label>
                        <select id="ctCounty"><option value="">National</option>${counties.data.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group"><label>Category *</label>
                        <select id="ctCat" required><option value="construction">Construction</option><option value="medical">Medical</option><option value="ict">ICT</option><option value="water">Water</option><option value="energy">Energy</option><option value="security">Security</option><option value="supplies">Supplies</option><option value="consultancy">Consultancy</option></select>
                      </div>
                      <div class="form-group"><label>Method *</label>
                        <select id="ctMethod" required><option value="open">Open</option><option value="restricted">Restricted</option><option value="direct">Direct</option><option value="rfq">RFQ</option><option value="rfp">RFP</option></select>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group"><label>Estimated Value (KES)</label><input type="number" id="ctValue" min="0" step="1000"></div>
                      <div class="form-group"><label>Closing Date</label><input type="date" id="ctClosing"></div>
                    </div>
                    <button type="submit" class="btn btn--primary">Create Tender</button>
                  </form>
                  <div id="ctResult" style="margin-top:1rem"></div>
                </div>
              </div>
            </div>

            <!-- MANAGE TENDERS -->
            <div class="tab-panel ${activeTab === 'manage' ? 'tab-panel--active' : ''}" id="admin-manage">
              <div class="card">
                <div class="card__header"><h3>Manage Tenders</h3></div>
                <div class="card__body" style="overflow-x:auto">
                  <table class="data-table">
                    <thead><tr><th>Ref</th><th>Title</th><th>Status</th><th>Value</th><th>Actions</th></tr></thead>
                    <tbody>
                      ${tenders.data.map(t => `<tr>
                        <td><strong>${t.reference_no}</strong></td>
                        <td>${escHtml(t.title)}</td>
                        <td>${badge(t.status)}</td>
                        <td class="money">${shortKes(t.estimated_value)}</td>
                        <td>
                          ${t.status === 'draft' ? `<button class="btn btn--primary btn--sm" onclick="window.__publishTender('${t.id}')">Publish</button>` : ''}
                          ${t.status === 'published' ? `<button class="btn btn--warning btn--sm" onclick="window.__openBidding('${t.id}')">Open Bidding</button>` : ''}
                          ${t.status === 'bidding' ? `<button class="btn btn--primary btn--sm" onclick="window.__evaluate('${t.id}')">Evaluate</button>` : ''}
                          ${!['completed', 'cancelled'].includes(t.status) ? `<button class="btn btn--danger btn--sm" onclick="window.__cancelTender('${t.id}')">Cancel</button>` : ''}
                          <a href="#/tenders/${t.id}" class="btn btn--ghost btn--sm">View</a>
                        </td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- ADD CONTRACTOR -->
            <div class="tab-panel ${activeTab === 'contractor' ? 'tab-panel--active' : ''}" id="admin-contractor">
              <div class="card">
                <div class="card__header"><h3>Register New Contractor</h3></div>
                <div class="card__body">
                  <form id="formAddContractor">
                    <div class="form-group"><label>Company Name *</label><input type="text" id="ccName" required></div>
                    <div class="form-row">
                      <div class="form-group"><label>Registration No. *</label><input type="text" id="ccReg" required placeholder="CPR/2025/xxxxx"></div>
                      <div class="form-group"><label>KRA PIN *</label><input type="text" id="ccKra" required></div>
                    </div>
                    <div class="form-row">
                      <div class="form-group"><label>Category *</label>
                        <select id="ccCat" required><option value="construction">Construction</option><option value="medical">Medical</option><option value="ict">ICT</option><option value="water">Water</option><option value="energy">Energy</option><option value="security">Security</option><option value="supplies">Supplies</option><option value="consultancy">Consultancy</option></select>
                      </div>
                      <div class="form-group"><label>County</label>
                        <select id="ccCounty"><option value="">—</option>${counties.data.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
                      </div>
                    </div>
                    <div class="form-group"><label>Directors * (comma-separated)</label><input type="text" id="ccDirectors" required placeholder="Jane Doe, John Smith"></div>
                    <button type="submit" class="btn btn--primary">Register Contractor</button>
                  </form>
                  <div id="ccResult" style="margin-top:1rem"></div>
                </div>
              </div>
            </div>

            <!-- ADD ENTITY -->
            <div class="tab-panel ${activeTab === 'entity' ? 'tab-panel--active' : ''}" id="admin-entity">
              <div class="card">
                <div class="card__header"><h3>Create Procuring Entity</h3></div>
                <div class="card__body">
                  <form id="formAddEntity">
                    <div class="form-group"><label>Entity Name *</label><input type="text" id="enName" required></div>
                    <div class="form-row">
                      <div class="form-group"><label>Type *</label>
                        <select id="enType" required><option value="national">National</option><option value="county">County</option><option value="parastatal">Parastatal</option><option value="agency">Agency</option></select>
                      </div>
                      <div class="form-group"><label>County</label>
                        <select id="enCounty"><option value="">—</option>${counties.data.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
                      </div>
                    </div>
                    <div class="form-group"><label>Contact Info</label><input type="text" id="enContact" placeholder="Phone or email"></div>
                    <button type="submit" class="btn btn--primary">Create Entity</button>
                  </form>
                  <div id="enResult" style="margin-top:1rem"></div>
                </div>
              </div>
            </div>

            <!-- AUDIT LOG -->
            <div class="tab-panel ${activeTab === 'audit' ? 'tab-panel--active' : ''}" id="admin-audit">
              <div class="card">
                <div class="card__header"><h3>Audit Log</h3></div>
                <div class="card__body" style="overflow-x:auto">
                  <table class="data-table">
                    <thead><tr><th>Time</th><th>Action</th><th>Entity Type</th><th>Actor</th><th>Details</th></tr></thead>
                    <tbody>
                      ${audits.data.map(a => `<tr>
                        <td><small>${fmtDate(a.created_at)}</small></td>
                        <td><strong>${a.action}</strong></td>
                        <td>${a.entity_type}</td>
                        <td>${a.actor || 'system'}</td>
                        <td><small>${escHtml(a.details || '—')}</small></td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Admin tab switching
      document.querySelectorAll('.admin-sidebar__link').forEach(link => {
        link.addEventListener('click', () => {
          activeTab = link.dataset.adminTab;
          render();
        });
      });

      // Create tender form
      document.getElementById('formCreateTender').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          title: document.getElementById('ctTitle').value.trim(),
          description: document.getElementById('ctDesc').value.trim(),
          entity_id: document.getElementById('ctEntity').value,
          county_id: document.getElementById('ctCounty').value ? Number(document.getElementById('ctCounty').value) : undefined,
          category: document.getElementById('ctCat').value,
          method: document.getElementById('ctMethod').value,
          estimated_value: document.getElementById('ctValue').value ? Number(document.getElementById('ctValue').value) : undefined,
          closing_at: document.getElementById('ctClosing').value || undefined
        };
        try {
          const result = await API.post('/api/tenders', body);
          document.getElementById('ctResult').innerHTML = `<div class="alert alert--success">Tender created: <strong>${result.data.reference_no}</strong> — <a href="#/tenders/${result.data.id}">View Tender</a></div>`;
          e.target.reset();
        } catch (err) {
          document.getElementById('ctResult').innerHTML = `<div class="alert alert--danger">${escHtml(err.message)}</div>`;
        }
      });

      // Add contractor form
      document.getElementById('formAddContractor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById('ccName').value.trim(),
          registration_no: document.getElementById('ccReg').value.trim(),
          kra_pin: document.getElementById('ccKra').value.trim(),
          category: document.getElementById('ccCat').value,
          directors: document.getElementById('ccDirectors').value.split(',').map(d => d.trim()).filter(Boolean),
          county_id: document.getElementById('ccCounty').value ? Number(document.getElementById('ccCounty').value) : undefined
        };
        try {
          const result = await API.post('/api/contractors', body);
          document.getElementById('ccResult').innerHTML = `<div class="alert alert--success">Contractor registered: <strong>${escHtml(result.data.name)}</strong></div>`;
          e.target.reset();
        } catch (err) {
          document.getElementById('ccResult').innerHTML = `<div class="alert alert--danger">${escHtml(err.message)}</div>`;
        }
      });

      // Add entity form
      document.getElementById('formAddEntity').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById('enName').value.trim(),
          type: document.getElementById('enType').value,
          county_id: document.getElementById('enCounty').value ? Number(document.getElementById('enCounty').value) : undefined,
          contact: document.getElementById('enContact').value.trim() || undefined
        };
        try {
          const result = await API.post('/api/entities', body);
          document.getElementById('enResult').innerHTML = `<div class="alert alert--success">Entity created: <strong>${escHtml(result.data.name)}</strong></div>`;
          e.target.reset();
        } catch (err) {
          document.getElementById('enResult').innerHTML = `<div class="alert alert--danger">${escHtml(err.message)}</div>`;
        }
      });

      // Tender management actions
      window.__publishTender = async (id) => {
        try { await API.patch(`/api/tenders/${id}/publish`); activeTab = 'manage'; render(); }
        catch (err) { openModal(`<div class="alert alert--danger">${escHtml(err.message)}</div>`); }
      };
      window.__openBidding = async (id) => {
        try { await API.patch(`/api/tenders/${id}/open-bidding`); activeTab = 'manage'; render(); }
        catch (err) { openModal(`<div class="alert alert--danger">${escHtml(err.message)}</div>`); }
      };
      window.__evaluate = async (id) => {
        try {
          const result = await API.patch(`/api/tenders/${id}/evaluate`);
          const d = result.data;
          openModal(`<h3>Evaluation Started</h3><p>AI Fraud Analysis complete. <strong>${d.fraud_alerts_generated}</strong> alert(s) generated.</p>`);
          activeTab = 'manage'; render();
        }
        catch (err) { openModal(`<div class="alert alert--danger">${escHtml(err.message)}</div>`); }
      };
      window.__cancelTender = async (id) => {
        if (!confirm('Cancel this tender?')) return;
        try { await API.patch(`/api/tenders/${id}/cancel`, { reason: 'Cancelled by admin' }); activeTab = 'manage'; render(); }
        catch (err) { openModal(`<div class="alert alert--danger">${escHtml(err.message)}</div>`); }
      };
    }

    await render();
  });

  // ═══════════════════════════════════════════════════════════
  //  BOOT
  // ═══════════════════════════════════════════════════════════
  handleRoute();

})();
