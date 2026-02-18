(function () {
  // ─── Palette ────────────────────────────────────────────────────────────────
  var STATUS_COLOR = {
    SUCCEEDED: '#22c55e', FAILED: '#ef4444', FAULT: '#f97316',
    TIMED_OUT: '#eab308', STOPPED: '#6b7280', ABORTED: '#8b5cf6',
    IN_PROGRESS: '#3b82f6', STARTED: '#3b82f6', QUEUED: '#a78bfa',
    PENDING_APPROVAL: '#f59e0b', APPROVED: '#10b981', REJECTED: '#dc2626',
    INVALID: '#9ca3af', UNKNOWN: '#d1d5db'
  };
  var TYPE_COLOR = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6',
                    '#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];
  var DAY_MS = 86400000;

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function fmtDuration(secs) {
    if (!secs && secs !== 0) return '—';
    var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + s + 's';
    return s + 's';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function statusBadge(s) {
    var c = STATUS_COLOR[s] || '#9ca3af';
    return '<span style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + (s || '—') + '</span>';
  }
  function typeBadge(t) {
    var colors = { HOTFIX:'#f97316', RELEASE:'#6366f1', LAUNCH:'#10b981', DESTROY:'#ef4444',
                   CUSTOM:'#8b5cf6', PLAN:'#0ea5e9', ROLLBACK:'#eab308' };
    var c = colors[t] || '#6b7280';
    return '<span style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + (t || '—') + '</span>';
  }
  function unique(arr) { return arr.filter(function(v,i,a){ return v && a.indexOf(v) === i; }).sort(); }
  function dayKey(iso) { return iso ? iso.slice(0,10) : null; }

  // ─── Canvas Chart Helpers ────────────────────────────────────────────────────
  function drawPie(canvas, data) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var total = data.reduce(function(s,d){ return s + d.value; }, 0);
    if (!total) { ctx.fillStyle='#9ca3af'; ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.fillText('No data',W/2,H/2); return; }
    var cx = W * 0.38, cy = H / 2, r = Math.min(cx, cy) - 10;
    var start = -Math.PI / 2;
    data.forEach(function(d) {
      var slice = (d.value / total) * 2 * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + slice);
      ctx.closePath(); ctx.fillStyle = d.color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      start += slice;
    });
    // legend
    var lx = W * 0.68, ly = H / 2 - (data.length * 16) / 2;
    data.forEach(function(d, i) {
      var y = ly + i * 20;
      ctx.fillStyle = d.color; ctx.fillRect(lx, y - 7, 12, 12);
      ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      var pct = Math.round((d.value/total)*100);
      ctx.fillText(d.label.slice(0,14) + ' (' + pct + '%)', lx + 16, y + 3);
    });
  }

  function drawBar(canvas, labels, datasets, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!labels.length) { ctx.fillStyle='#9ca3af'; ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.fillText('No data',W/2,H/2); return; }
    var padL = opts.padL || 45, padR = 15, padT = 15, padB = opts.padB || 55;
    var cW = W - padL - padR, cH = H - padT - padB;
    var allVals = [].concat.apply([], datasets.map(function(ds){ return ds.data; }));
    var maxV = Math.max.apply(null, allVals) || 1;
    // grid
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var y = padT + cH - (i / steps) * cH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y); ctx.stroke();
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round((i / steps) * maxV), padL - 4, y + 3);
    }
    // bars
    var nGroups = labels.length, nDS = datasets.length;
    var groupW = cW / nGroups;
    var barW = Math.min((groupW - 4) / nDS - 2, 32);
    labels.forEach(function(label, gi) {
      var gx = padL + gi * groupW;
      datasets.forEach(function(ds, di) {
        var v = ds.data[gi] || 0;
        var bh = (v / maxV) * cH;
        var bx = gx + (groupW - nDS * (barW + 2)) / 2 + di * (barW + 2);
        var by = padT + cH - bh;
        ctx.fillStyle = ds.color;
        ctx.fillRect(bx, by, barW, bh);
        if (v > 0 && barW > 14) {
          ctx.fillStyle = '#374151'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(v, bx + barW / 2, by - 2);
        }
      });
      // x label
      ctx.fillStyle = '#6b7280'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      var lbl = label.length > 10 ? label.slice(0, 9) + '…' : label;
      ctx.save(); ctx.translate(gx + groupW / 2, padT + cH + 10);
      if (labels.length > 7) { ctx.rotate(-Math.PI / 4); ctx.textAlign = 'right'; }
      ctx.fillText(lbl, 0, 0); ctx.restore();
    });
    // legend
    if (nDS > 1) {
      var lx = padL, ly2 = H - 14;
      datasets.forEach(function(ds, i) {
        ctx.fillStyle = ds.color; ctx.fillRect(lx + i * 90, ly2 - 8, 10, 10);
        ctx.fillStyle = '#374151'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(ds.label.slice(0,10), lx + i * 90 + 13, ly2);
      });
    }
  }

  // ─── Component ───────────────────────────────────────────────────────────────
  class ReleaseQualDash extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.stacks = [];
      this.environments = [];
      this.allDeployments = [];
      this.filteredDeployments = [];
      this.selectedStack = '';
      this.selectedClusterId = '';
      this.fromDate = '';
      this.toDate = '';
      this.filterStatus = [];
      this.filterReleaseType = [];
      this.filterTriggeredBy = [];
      this.filterDeploymentType = [];
      this.filterSearch = '';
      this.currentPage = 0;
      this.pageSize = 25;
      this.sortField = 'createdOn';
      this.sortDir = 'desc';
      this.isLoadingStacks = false;
      this.isLoadingEnvs = false;
      this.isLoadingData = false;
      this.error = null;
      this.render();
    }

    connectedCallback() {
      var now = new Date();
      var ago = new Date(now.getTime() - 30 * DAY_MS);
      var fr = this.shadowRoot.getElementById('from-date');
      var to = this.shadowRoot.getElementById('to-date');
      if (fr) fr.value = ago.toISOString().slice(0, 10);
      if (to) to.value = now.toISOString().slice(0, 10);
      this.fromDate = ago.toISOString().slice(0, 10);
      this.toDate = now.toISOString().slice(0, 10);
      this.setupListeners();
      this.loadStacks();
    }

    // ── Template ──────────────────────────────────────────────────────────────
    render() {
      this.shadowRoot.innerHTML = `
<style>
:host{display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh;}
*{box-sizing:border-box;}
.shell{padding:20px;max-width:1600px;margin:0 auto;}
.page-title{font-size:22px;font-weight:700;color:#0f172a;margin:0 0 18px;display:flex;align-items:center;gap:10px;}
.page-title span{font-size:20px;}

/* controls */
.controls{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:16px;}
.ctrl-group{display:flex;flex-direction:column;gap:4px;}
.ctrl-group label{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;}
.ctrl-group select,.ctrl-group input[type=date]{height:36px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;color:#1e293b;outline:none;min-width:160px;}
.ctrl-group select:focus,.ctrl-group input:focus{border-color:#6366f1;box-shadow:0 0 0 3px #6366f133;}
.btn-apply{height:36px;padding:0 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;}
.btn-apply:hover{background:#4f46e5;}
.btn-apply:disabled{background:#a5b4fc;cursor:not-allowed;}

/* filters */
.filters{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px;}
.filters-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-right:4px;}
.filter-group{display:flex;flex-direction:column;gap:3px;}
.filter-group label{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;}
.filter-group select{height:30px;padding:0 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;background:#f8fafc;color:#374151;outline:none;}
.filter-group select:focus{border-color:#6366f1;}
.search-box{height:30px;padding:0 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;outline:none;min-width:180px;}
.search-box:focus{border-color:#6366f1;}
.btn-clear{height:30px;padding:0 12px;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;}
.btn-clear:hover{background:#e2e8f0;}
.results-count{margin-left:auto;font-size:12px;color:#64748b;font-weight:500;}

/* kpi cards */
.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:18px;}
.kpi-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;}
.kpi-label{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}
.kpi-value{font-size:28px;font-weight:700;color:#0f172a;}
.kpi-sub{font-size:11px;color:#94a3b8;margin-top:3px;}
.kpi-card.green .kpi-value{color:#16a34a;}
.kpi-card.red .kpi-value{color:#dc2626;}
.kpi-card.blue .kpi-value{color:#2563eb;}
.kpi-card.orange .kpi-value{color:#ea580c;}

/* charts */
.charts-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-bottom:18px;}
.chart-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;}
.chart-title{font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;}
canvas{display:block;width:100%;max-width:100%;}

/* table */
.table-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:18px;overflow-x:auto;}
.table-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.table-title{font-size:13px;font-weight:700;color:#374151;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0;white-space:nowrap;cursor:pointer;user-select:none;}
th:hover{background:#f1f5f9;color:#374151;}
th .sort-arrow{margin-left:4px;color:#94a3b8;}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#f8fafc;}
.td-mono{font-family:'Courier New',monospace;font-size:11px;color:#6366f1;}
.td-wrap{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* pagination */
.pagination{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px;}
.pagination button{height:28px;padding:0 10px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;font-size:12px;cursor:pointer;color:#374151;}
.pagination button:hover:not(:disabled){background:#f1f5f9;}
.pagination button:disabled{opacity:.4;cursor:not-allowed;}
.pagination .page-info{font-size:12px;color:#64748b;}

/* states */
.loading-state,.empty-state,.error-state{text-align:center;padding:40px 20px;color:#94a3b8;}
.error-state{color:#dc2626;background:#fef2f2;border-radius:8px;padding:16px;}
.spinner{display:inline-block;width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite;margin-bottom:10px;}
@keyframes spin{to{transform:rotate(360deg)}}

/* misc */
.select-prompt{text-align:center;padding:48px 20px;color:#94a3b8;font-size:14px;}
</style>

<div class="shell">
  <div class="page-title"><span>📊</span> Release Quality Dashboard</div>

  <!-- Controls -->
  <div class="controls">
    <div class="ctrl-group">
      <label>Project</label>
      <select id="stack-select">
        <option value="">Select project…</option>
      </select>
    </div>
    <div class="ctrl-group">
      <label>Environment</label>
      <select id="env-select" disabled>
        <option value="">Select environment…</option>
      </select>
    </div>
    <div class="ctrl-group">
      <label>From Date</label>
      <input type="date" id="from-date"/>
    </div>
    <div class="ctrl-group">
      <label>To Date</label>
      <input type="date" id="to-date"/>
    </div>
    <button class="btn-apply" id="btn-apply" disabled>Apply</button>
  </div>

  <!-- Main content area -->
  <div id="main-content">
    <div class="select-prompt">
      <div style="font-size:40px;margin-bottom:12px;">🚀</div>
      Select a project and environment, then click Apply to load release data.
    </div>
  </div>
</div>`;
    }

    // ── Event Listeners ───────────────────────────────────────────────────────
    setupListeners() {
      var sr = this.shadowRoot;
      sr.getElementById('stack-select').addEventListener('change', this._onStackChange.bind(this));
      sr.getElementById('env-select').addEventListener('change', this._onEnvChange.bind(this));
      sr.getElementById('btn-apply').addEventListener('click', this._onApply.bind(this));
    }

    _onStackChange(e) {
      this.selectedStack = e.target.value;
      this.selectedClusterId = '';
      var envSel = this.shadowRoot.getElementById('env-select');
      var btnApply = this.shadowRoot.getElementById('btn-apply');
      envSel.innerHTML = '<option value="">Select environment…</option>';
      envSel.disabled = !this.selectedStack;
      btnApply.disabled = true;
      if (this.selectedStack) this.loadEnvironments(this.selectedStack);
    }

    _onEnvChange(e) {
      this.selectedClusterId = e.target.value;
      this.shadowRoot.getElementById('btn-apply').disabled = !this.selectedClusterId;
    }

    _onApply() {
      var fr = this.shadowRoot.getElementById('from-date');
      var to = this.shadowRoot.getElementById('to-date');
      this.fromDate = fr ? fr.value : '';
      this.toDate = to ? to.value : '';
      this.currentPage = 0;
      this.loadDeployments();
    }

    // ── Data Loading ──────────────────────────────────────────────────────────
    async loadStacks() {
      this.isLoadingStacks = true;
      try {
        var res = await fetch('/cc-ui/v1/stacks');
        if (!res.ok) throw new Error('Failed to load projects (' + res.status + ')');
        var data = await res.json();
        var list = Array.isArray(data) ? data : (data.content || data.stacks || []);
        this.stacks = list;
        var sel = this.shadowRoot.getElementById('stack-select');
        if (sel) {
          sel.innerHTML = '<option value="">Select project…</option>' +
            list.map(function(s){ return '<option value="' + (s.name||s) + '">' + (s.name||s) + '</option>'; }).join('');
        }
      } catch(err) {
        console.warn('Could not load stacks:', err.message);
      } finally {
        this.isLoadingStacks = false;
      }
    }

    async loadEnvironments(stackName) {
      this.isLoadingEnvs = true;
      var envSel = this.shadowRoot.getElementById('env-select');
      if (envSel) { envSel.disabled = true; envSel.innerHTML = '<option>Loading…</option>'; }
      try {
        var res = await fetch('/cc-ui/v1/stacks/' + encodeURIComponent(stackName) + '/clusters-overview');
        if (!res.ok) throw new Error('Failed to load environments (' + res.status + ')');
        var data = await res.json();
        var list = Array.isArray(data) ? data : (data.clusters || data.content || []);
        this.environments = list;
        if (envSel) {
          envSel.disabled = false;
          envSel.innerHTML = '<option value="">Select environment…</option>' +
            list.map(function(c){
              var id = c.id || c.clusterId || c.name;
              var nm = c.name || c.clusterName || id;
              return '<option value="' + id + '">' + nm + '</option>';
            }).join('');
        }
      } catch(err) {
        if (envSel) { envSel.disabled = false; envSel.innerHTML = '<option value="">Failed to load</option>'; }
        console.warn('Could not load environments:', err.message);
      } finally {
        this.isLoadingEnvs = false;
      }
    }

    async loadDeployments() {
      if (!this.selectedClusterId) return;
      this.isLoadingData = true;
      this.error = null;
      this._showLoading();
      try {
        var res = await fetch('/cc-ui/v1/clusters/' + encodeURIComponent(this.selectedClusterId) + '/deployments');
        if (!res.ok) throw new Error('Failed to load releases (' + res.status + ')');
        var wrapper = await res.json();
        var raw = wrapper.deployments || wrapper.deploymentsFull || wrapper || [];
        this.allDeployments = Array.isArray(raw) ? raw : [];
        // reset filters
        this.filterStatus = [];
        this.filterReleaseType = [];
        this.filterTriggeredBy = [];
        this.filterDeploymentType = [];
        this.filterSearch = '';
        this.currentPage = 0;
        this._applyFilters();
        this._renderDashboard();
      } catch(err) {
        this.error = err.message;
        this._renderError(err.message);
      } finally {
        this.isLoadingData = false;
      }
    }

    // ── Filtering ─────────────────────────────────────────────────────────────
    _applyFilters() {
      var from = this.fromDate ? new Date(this.fromDate).getTime() : 0;
      var to = this.toDate ? new Date(this.toDate + 'T23:59:59').getTime() : Infinity;
      var self = this;
      this.filteredDeployments = this.allDeployments.filter(function(d) {
        var ts = d.createdOn ? new Date(d.createdOn).getTime() : 0;
        if (ts < from || ts > to) return false;
        if (self.filterStatus.length && self.filterStatus.indexOf(d.status) === -1) return false;
        if (self.filterReleaseType.length && self.filterReleaseType.indexOf(d.releaseType) === -1) return false;
        if (self.filterTriggeredBy.length && self.filterTriggeredBy.indexOf(d.triggeredBy) === -1) return false;
        if (self.filterDeploymentType.length && self.filterDeploymentType.indexOf(d.deploymentType) === -1) return false;
        if (self.filterSearch) {
          var q = self.filterSearch.toLowerCase();
          var hay = [d.id, d.description, d.releaseComment, d.triggeredBy, d.releaseReviewedBy,
                     (d.labelIds||[]).join(',')].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      // sort
      var sf = this.sortField, sd = this.sortDir;
      this.filteredDeployments.sort(function(a,b) {
        var av = a[sf], bv = b[sf];
        if (sf === 'createdOn' || sf === 'finishedOn') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
        if (sf === 'timeTakenInSeconds') { av = av || 0; bv = bv || 0; }
        if (av < bv) return sd === 'asc' ? -1 : 1;
        if (av > bv) return sd === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // ── Render States ─────────────────────────────────────────────────────────
    _showLoading() {
      var mc = this.shadowRoot.getElementById('main-content');
      if (mc) mc.innerHTML = '<div class="loading-state"><div class="spinner"></div><div>Loading release data…</div></div>';
    }
    _renderError(msg) {
      var mc = this.shadowRoot.getElementById('main-content');
      if (mc) mc.innerHTML = '<div class="error-state">⚠️ ' + msg + '</div>';
    }

    // ── Full Dashboard Render ─────────────────────────────────────────────────
    _renderDashboard() {
      var data = this.filteredDeployments;
      var all  = this.allDeployments;

      // compute derived options for filters
      var allStatuses   = unique(all.map(function(d){ return d.status; }));
      var allTypes      = unique(all.map(function(d){ return d.releaseType; }));
      var allTriggerers = unique(all.map(function(d){ return d.triggeredBy; }));
      var allDepTypes   = unique(all.map(function(d){ return d.deploymentType; }));

      // KPIs on filtered data
      var total   = data.length;
      var success = data.filter(function(d){ return d.status === 'SUCCEEDED'; }).length;
      var failed  = data.filter(function(d){ return d.status === 'FAILED' || d.status === 'FAULT'; }).length;
      var rate    = total ? Math.round((success / total) * 100) : 0;
      var durations = data.filter(function(d){ return d.timeTakenInSeconds; }).map(function(d){ return d.timeTakenInSeconds; });
      var avgDur  = durations.length ? Math.round(durations.reduce(function(a,b){ return a+b; }, 0) / durations.length) : 0;
      var hotfixes = data.filter(function(d){ return d.releaseType === 'HOTFIX'; }).length;

      // Status counts for pie
      var statusCounts = {};
      data.forEach(function(d){ statusCounts[d.status] = (statusCounts[d.status]||0)+1; });
      var pieData = Object.keys(statusCounts).map(function(k){ return { label:k, value:statusCounts[k], color: STATUS_COLOR[k]||'#9ca3af' }; });
      pieData.sort(function(a,b){ return b.value - a.value; });

      // Release type bar
      var typeCounts = {};
      data.forEach(function(d){ typeCounts[d.releaseType||'UNKNOWN'] = (typeCounts[d.releaseType||'UNKNOWN']||0)+1; });
      var typeLabels = Object.keys(typeCounts).sort();
      var typeValues = typeLabels.map(function(k){ return typeCounts[k]; });
      var typeColors = typeLabels.map(function(k,i){ return TYPE_COLOR[i % TYPE_COLOR.length]; });

      // Timeline bar (by day, SUCCEEDED vs FAILED+FAULT vs OTHER)
      var dayBuckets = {};
      data.forEach(function(d) {
        var k = dayKey(d.createdOn); if (!k) return;
        if (!dayBuckets[k]) dayBuckets[k] = { s:0, f:0, o:0 };
        if (d.status === 'SUCCEEDED') dayBuckets[k].s++;
        else if (d.status === 'FAILED' || d.status === 'FAULT') dayBuckets[k].f++;
        else dayBuckets[k].o++;
      });
      var dayLabels = Object.keys(dayBuckets).sort();
      // If too many days, group by week
      var timelineLabels, tlSuccess, tlFailed, tlOther;
      if (dayLabels.length <= 31) {
        timelineLabels = dayLabels.map(function(d){ return d.slice(5); }); // MM-DD
        tlSuccess = dayLabels.map(function(k){ return dayBuckets[k].s; });
        tlFailed  = dayLabels.map(function(k){ return dayBuckets[k].f; });
        tlOther   = dayLabels.map(function(k){ return dayBuckets[k].o; });
      } else {
        var weekBuckets = {};
        dayLabels.forEach(function(d) {
          var dt = new Date(d), day = dt.getDay();
          var monday = new Date(dt.getTime() - (day === 0 ? 6 : day - 1) * DAY_MS);
          var wk = monday.toISOString().slice(0,10);
          if (!weekBuckets[wk]) weekBuckets[wk] = { s:0, f:0, o:0 };
          weekBuckets[wk].s += dayBuckets[d].s;
          weekBuckets[wk].f += dayBuckets[d].f;
          weekBuckets[wk].o += dayBuckets[d].o;
        });
        var wks = Object.keys(weekBuckets).sort();
        timelineLabels = wks.map(function(w){ return 'W/' + w.slice(5,10); });
        tlSuccess = wks.map(function(k){ return weekBuckets[k].s; });
        tlFailed  = wks.map(function(k){ return weekBuckets[k].f; });
        tlOther   = wks.map(function(k){ return weekBuckets[k].o; });
      }

      // Top triggerers bar
      var trigCounts = {};
      data.forEach(function(d){ if(d.triggeredBy) trigCounts[d.triggeredBy] = (trigCounts[d.triggeredBy]||0)+1; });
      var trigArr = Object.keys(trigCounts).map(function(k){ return {k:k, v:trigCounts[k]}; });
      trigArr.sort(function(a,b){ return b.v - a.v; });
      var topTrig = trigArr.slice(0, 10);
      var trigLabels = topTrig.map(function(t){ return t.k.split('@')[0]; });
      var trigValues = topTrig.map(function(t){ return t.v; });

      // avg duration by release type
      var typesDur = {};
      data.forEach(function(d) {
        if (!d.releaseType || !d.timeTakenInSeconds) return;
        if (!typesDur[d.releaseType]) typesDur[d.releaseType] = [];
        typesDur[d.releaseType].push(d.timeTakenInSeconds);
      });
      var durTypes = Object.keys(typesDur);
      var durValues = durTypes.map(function(k){ var a = typesDur[k]; return Math.round(a.reduce(function(s,v){return s+v;},0)/a.length); });

      // Paginated table data
      var start = this.currentPage * this.pageSize;
      var pageData = data.slice(start, start + this.pageSize);
      var totalPages = Math.max(1, Math.ceil(data.length / this.pageSize));

      // Build HTML
      var mc = this.shadowRoot.getElementById('main-content');
      if (!mc) return;
      mc.innerHTML = this._filtersHTML(allStatuses, allTypes, allTriggerers, allDepTypes) +
        this._kpiHTML(total, success, failed, rate, avgDur, hotfixes) +
        this._chartsHTML() +
        this._durationChartHTML() +
        this._tableHTML(pageData, start, data.length, totalPages);

      // Draw canvases after DOM is set
      var self = this;
      setTimeout(function() {
        // Pie – status
        var c1 = self.shadowRoot.getElementById('chart-pie-status');
        if (c1) { c1.width = c1.offsetWidth || 480; c1.height = 220; drawPie(c1, pieData); }

        // Bar – release types
        var c2 = self.shadowRoot.getElementById('chart-bar-types');
        if (c2) {
          c2.width = c2.offsetWidth || 480; c2.height = 220;
          drawBar(c2, typeLabels, [{ label: 'Count', data: typeValues, color: '#6366f1' }], {padB:55});
        }

        // Bar – timeline
        var c3 = self.shadowRoot.getElementById('chart-bar-timeline');
        if (c3) {
          c3.width = c3.offsetWidth || 960; c3.height = 220;
          drawBar(c3, timelineLabels, [
            { label: 'Succeeded', data: tlSuccess, color: '#22c55e' },
            { label: 'Failed',    data: tlFailed,  color: '#ef4444' },
            { label: 'Other',     data: tlOther,   color: '#94a3b8' }
          ], {padB:65});
        }

        // Bar – top triggerers
        var c4 = self.shadowRoot.getElementById('chart-bar-triggerers');
        if (c4) {
          c4.width = c4.offsetWidth || 480; c4.height = 220;
          drawBar(c4, trigLabels, [{ label: 'Releases', data: trigValues, color: '#0ea5e9' }], {padB:65});
        }

        // Bar – avg duration by type
        var c5 = self.shadowRoot.getElementById('chart-bar-duration');
        if (c5) {
          c5.width = c5.offsetWidth || 480; c5.height = 220;
          drawBar(c5, durTypes, [{ label: 'Avg Secs', data: durValues, color: '#f59e0b' }], {padB:55});
        }

        // wire filter & table listeners
        self._attachFilterListeners();
        self._attachTableListeners();
      }, 50);
    }

    // ── Fragment Builders ─────────────────────────────────────────────────────
    _filtersHTML(statuses, types, triggerers, depTypes) {
      function opts(arr, selected) {
        return '<option value="">All</option>' +
          arr.map(function(v){ return '<option value="'+v+'"' + (selected.indexOf(v)>-1?' selected':'') + '>'+v+'</option>'; }).join('');
      }
      return '<div class="filters">' +
        '<span class="filters-label">Filters</span>' +
        '<div class="filter-group"><label>Status</label><select id="f-status" multiple size="1">' + opts(statuses, this.filterStatus) + '</select></div>' +
        '<div class="filter-group"><label>Release Type</label><select id="f-type" multiple size="1">' + opts(types, this.filterReleaseType) + '</select></div>' +
        '<div class="filter-group"><label>Triggered By</label><select id="f-user" multiple size="1">' + opts(triggerers, this.filterTriggeredBy) + '</select></div>' +
        '<div class="filter-group"><label>Deploy Type</label><select id="f-deptype" multiple size="1">' + opts(depTypes, this.filterDeploymentType) + '</select></div>' +
        '<input class="search-box" id="f-search" type="text" placeholder="Search description, comment, labels…" value="' + (this.filterSearch||'') + '"/>' +
        '<button class="btn-clear" id="btn-clear-filters">Clear</button>' +
        '<span class="results-count" id="result-count">' + this.filteredDeployments.length + ' releases shown</span>' +
        '</div>';
    }

    _kpiHTML(total, success, failed, rate, avgDur, hotfixes) {
      var inFlight = this.allDeployments.filter(function(d){ return d.status === 'IN_PROGRESS' || d.status === 'STARTED'; }).length;
      return '<div class="kpi-row">' +
        '<div class="kpi-card blue"><div class="kpi-label">Total Releases</div><div class="kpi-value">' + total + '</div><div class="kpi-sub">in selected period</div></div>' +
        '<div class="kpi-card green"><div class="kpi-label">Success Rate</div><div class="kpi-value">' + rate + '%</div><div class="kpi-sub">' + success + ' succeeded</div></div>' +
        '<div class="kpi-card red"><div class="kpi-label">Failed</div><div class="kpi-value">' + failed + '</div><div class="kpi-sub">FAILED + FAULT</div></div>' +
        '<div class="kpi-card orange"><div class="kpi-label">Avg Duration</div><div class="kpi-value" style="font-size:20px;margin-top:4px;">' + fmtDuration(avgDur) + '</div><div class="kpi-sub">across releases</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Hotfixes</div><div class="kpi-value">' + hotfixes + '</div><div class="kpi-sub">HOTFIX type</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">In Flight</div><div class="kpi-value">' + inFlight + '</div><div class="kpi-sub">active right now</div></div>' +
        '</div>';
    }

    _chartsHTML() {
      return '<div class="charts-row">' +
        '<div class="chart-card"><div class="chart-title">Release Status Distribution</div><canvas id="chart-pie-status"></canvas></div>' +
        '<div class="chart-card"><div class="chart-title">Releases by Type</div><canvas id="chart-bar-types"></canvas></div>' +
        '<div class="chart-card"><div class="chart-title">Top Triggerers</div><canvas id="chart-bar-triggerers"></canvas></div>' +
        '</div>' +
        '<div class="charts-row" style="grid-template-columns:2fr 1fr;">' +
        '<div class="chart-card"><div class="chart-title">Release Timeline (Succeeded vs Failed)</div><canvas id="chart-bar-timeline"></canvas></div>' +
        '<div class="chart-card"><div class="chart-title">Avg Duration by Release Type (s)</div><canvas id="chart-bar-duration"></canvas></div>' +
        '</div>';
    }

    _durationChartHTML() { return ''; } // already inline above

    _tableHTML(pageData, start, total, totalPages) {
      var self = this;
      function sortArrow(field) {
        if (self.sortField !== field) return '<span class="sort-arrow">⇅</span>';
        return '<span class="sort-arrow">' + (self.sortDir === 'asc' ? '↑' : '↓') + '</span>';
      }
      var rows = pageData.map(function(d, idx) {
        var labels = (d.labelIds||[]).join(', ') || '—';
        var changes = (d.changesApplied||[]).length;
        var hotfixRes = (d.hotfixResources||[]).map(function(r){ return r.resourceType+'/'+r.resourceName; }).join(', ') || '—';
        return '<tr>' +
          '<td style="color:#94a3b8;font-size:11px;">' + (start+idx+1) + '</td>' +
          '<td class="td-mono td-wrap" title="' + (d.id||'') + '">' + (d.id||'—').slice(-12) + '</td>' +
          '<td>' + statusBadge(d.status) + '</td>' +
          '<td>' + typeBadge(d.releaseType) + '</td>' +
          '<td style="color:#374151;">' + (d.triggeredBy||'—') + '</td>' +
          '<td style="color:#374151;white-space:nowrap;">' + fmtDate(d.createdOn) + '</td>' +
          '<td style="color:#374151;white-space:nowrap;">' + fmtDate(d.finishedOn) + '</td>' +
          '<td style="color:#374151;">' + fmtDuration(d.timeTakenInSeconds) + '</td>' +
          '<td>' + typeBadge(d.deploymentType) + '</td>' +
          '<td class="td-wrap" title="' + labels + '">' + (labels.length>30?labels.slice(0,28)+'…':labels) + '</td>' +
          '<td>' + (changes > 0 ? '<span style="color:#6366f1;font-weight:600;">'+changes+' changes</span>' : '—') + '</td>' +
          '<td>' + (d.releaseReviewedBy||'—') + '</td>' +
          '<td class="td-wrap" title="' + (d.releaseComment||d.description||'') + '">' + ((d.releaseComment||d.description||'—').slice(0,40)) + '</td>' +
          '<td><span style="color:' + (d.signedOff?'#16a34a':'#94a3b8') + ';font-size:11px;">' + (d.signedOff?'✔':'—') + '</span></td>' +
          '<td><span style="color:' + (d.forceRelease?'#ea580c':'#94a3b8') + ';font-size:11px;">' + (d.forceRelease?'⚡':'—') + '</span></td>' +
          '</tr>';
      }).join('');

      if (!rows) rows = '<tr><td colspan="15" class="empty-state">No releases match the current filters.</td></tr>';

      return '<div class="table-card">' +
        '<div class="table-header"><span class="table-title">Release Details</span></div>' +
        '<div style="overflow-x:auto;"><table>' +
        '<thead><tr>' +
        '<th>#</th>' +
        '<th data-sort="id">ID ' + sortArrow('id') + '</th>' +
        '<th data-sort="status">Status ' + sortArrow('status') + '</th>' +
        '<th data-sort="releaseType">Type ' + sortArrow('releaseType') + '</th>' +
        '<th data-sort="triggeredBy">Triggered By ' + sortArrow('triggeredBy') + '</th>' +
        '<th data-sort="createdOn">Started ' + sortArrow('createdOn') + '</th>' +
        '<th data-sort="finishedOn">Finished ' + sortArrow('finishedOn') + '</th>' +
        '<th data-sort="timeTakenInSeconds">Duration ' + sortArrow('timeTakenInSeconds') + '</th>' +
        '<th data-sort="deploymentType">Deploy Type ' + sortArrow('deploymentType') + '</th>' +
        '<th>Labels</th>' +
        '<th>Changes</th>' +
        '<th>Reviewed By</th>' +
        '<th>Comment</th>' +
        '<th>Signed Off</th>' +
        '<th>Forced</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div>' +
        '<div class="pagination">' +
        '<button id="pg-first" ' + (this.currentPage===0?'disabled':'') + '>«</button>' +
        '<button id="pg-prev"  ' + (this.currentPage===0?'disabled':'') + '>‹ Prev</button>' +
        '<span class="page-info">Page ' + (this.currentPage+1) + ' of ' + totalPages + ' (' + total + ' releases)</span>' +
        '<button id="pg-next"  ' + (this.currentPage>=totalPages-1?'disabled':'') + '>Next ›</button>' +
        '<button id="pg-last"  ' + (this.currentPage>=totalPages-1?'disabled':'') + '>»</button>' +
        '</div></div>';
    }

    // ── Filter & Table Listeners ───────────────────────────────────────────────
    _attachFilterListeners() {
      var sr = this.shadowRoot, self = this;

      function getSelVals(id) {
        var el = sr.getElementById(id); if (!el) return [];
        return Array.from(el.options).filter(function(o){ return o.selected && o.value; }).map(function(o){ return o.value; });
      }

      function onFilterChange() {
        self.filterStatus       = getSelVals('f-status');
        self.filterReleaseType  = getSelVals('f-type');
        self.filterTriggeredBy  = getSelVals('f-user');
        self.filterDeploymentType = getSelVals('f-deptype');
        var fs = sr.getElementById('f-search');
        self.filterSearch = fs ? fs.value.trim() : '';
        self.currentPage = 0;
        self._applyFilters();
        self._renderDashboard();
      }

      ['f-status','f-type','f-user','f-deptype'].forEach(function(id) {
        var el = sr.getElementById(id);
        if (el) el.addEventListener('change', onFilterChange);
      });
      var fs = sr.getElementById('f-search');
      if (fs) {
        var timer;
        fs.addEventListener('input', function() {
          clearTimeout(timer);
          timer = setTimeout(onFilterChange, 300);
        });
      }
      var clrBtn = sr.getElementById('btn-clear-filters');
      if (clrBtn) {
        clrBtn.addEventListener('click', function() {
          self.filterStatus = []; self.filterReleaseType = [];
          self.filterTriggeredBy = []; self.filterDeploymentType = [];
          self.filterSearch = '';
          self.currentPage = 0;
          self._applyFilters();
          self._renderDashboard();
        });
      }
    }

    _attachTableListeners() {
      var sr = this.shadowRoot, self = this;
      // sort
      sr.querySelectorAll('th[data-sort]').forEach(function(th) {
        th.addEventListener('click', function() {
          var f = th.getAttribute('data-sort');
          if (self.sortField === f) { self.sortDir = self.sortDir === 'asc' ? 'desc' : 'asc'; }
          else { self.sortField = f; self.sortDir = 'desc'; }
          self._applyFilters();
          self._renderDashboard();
        });
      });
      // pagination
      var handlers = {
        'pg-first': function() { self.currentPage = 0; },
        'pg-prev':  function() { if (self.currentPage > 0) self.currentPage--; },
        'pg-next':  function() {
          var tp = Math.max(1, Math.ceil(self.filteredDeployments.length / self.pageSize));
          if (self.currentPage < tp - 1) self.currentPage++;
        },
        'pg-last':  function() {
          self.currentPage = Math.max(0, Math.ceil(self.filteredDeployments.length / self.pageSize) - 1);
        }
      };
      Object.keys(handlers).forEach(function(id) {
        var btn = sr.getElementById(id);
        if (btn) btn.addEventListener('click', function() { handlers[id](); self._applyFilters(); self._renderDashboard(); });
      });
    }
  }

  customElements.define('release-qual-dash', ReleaseQualDash);
})();
