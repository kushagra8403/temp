/* =====================================================================
   UI: rendering and interaction
   ===================================================================== */
const $ = (s) => document.querySelector(s);
const UI = {
  screen: 'setup', tab: 'overview',
  setup: { name: '', industry: 'saas', difficulty: 'standard', horizon: 10 },
  sort: { key: 'dept', dir: 1 }, teamFilter: 'all', hireMarket: null,
  pendingTransfer: {}, pendingMarket: {}, confirmFire: null,
  tipsOpen: false, newsOpen: false, newsIdx: 0,
};

// ---------- Formatting ----------
function fmtMoney(n, opts = {}) {
  if (n == null || !isFinite(n)) return '—';
  const neg = n < 0, a = Math.abs(n); let s;
  if (a >= 1e9) s = (a / 1e9).toFixed(a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2) + 'B';
  else if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + 'M';
  else if (a >= 1e4) s = Math.round(a / 1e3) + 'k';
  else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  else s = String(Math.round(a));
  return (neg ? '−' : opts.sign ? '+' : '') + '$' + s;
}
function fmtNum(n) {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toLocaleString('en-US');
}
const fmtPct = (x, d = 1) => (x * 100).toFixed(d).replace(/\.0+$/, '') + '%';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTenure = (q) => (q < 4 ? `${q}q` : `${Math.floor(q / 4)}y${q % 4 ? ' ' + (q % 4) + 'q' : ''}`);
const fmtRunway = (m) => (m === Infinity ? 'Profitable' : m >= 120 ? '10+ yrs' : m >= 24 ? (m / 12).toFixed(1) + ' yrs' : m.toFixed(1) + ' mo');
const clockLabel = (turn) => `Year ${yearOf(turn)} · Q${quarterOf(turn)}`;

// ---------- Theme ----------
function applyIndustryTheme(key) { document.documentElement.setAttribute('data-industry', key); }

// ---------- Toast ----------
let toastTimer = null;
function toast(text, kind = '') {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast ${kind}" role="status">${esc(text)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 4200);
}

// ---------- Charts ----------
function lineChart(series, { w = 560, h = 170, fmt = fmtMoney } = {}) {
  const n = Math.max(...series.map((s) => s.values.length));
  if (n < 2) return `<div class="chart-empty">This chart fills in after your first quarter.</div>`;
  const pad = { l: 54, r: 14, t: 12, b: 24 };
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(0, ...all), hi = Math.max(...all);
  if (hi - lo < 1) hi = lo + 1;
  const X = (i) => pad.l + (w - pad.l - pad.r) * (i / (n - 1));
  const Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  let g = '';
  const ticks = lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi];
  ticks.forEach((t) => { g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}" class="grid${t === 0 ? ' zero' : ''}"/><text x="${pad.l - 8}" y="${Y(t) + 4}" text-anchor="end" class="tick">${fmt(t)}</text>`; });
  const years = Math.ceil(n / 4); const step = Math.max(1, Math.ceil(years / 8)) * 4;
  for (let i = 0; i < n; i += step) g += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" class="tick">Y${yearOf(i)}</text>`;
  S.recessions.forEach((r) => {
    if (!r.announced) return;
    const a = Math.min(r.start, n - 1), b = Math.min(r.end, n - 1);
    if (b > a) g += `<rect x="${X(a)}" y="${pad.t}" width="${X(b) - X(a)}" height="${h - pad.t - pad.b}" class="rec-band"/>`;
  });
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    if (si === 0) g += `<path d="M${X(0)},${Y(Math.max(lo, 0))} L${pts.join(' L')} L${X(s.values.length - 1)},${Y(Math.max(lo, 0))} Z" class="area" style="fill:${s.color}"/>`;
    g += `<path d="M${pts.join(' L')}" class="line" style="stroke:${s.color}"/>`;
    const li = s.values.length - 1;
    g += `<circle cx="${X(li)}" cy="${Y(s.values[li])}" r="3.5" style="fill:${s.color}" class="dot"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(series.map((s) => s.label).join(' and '))} over time">${g}</svg>`;
}
function sparkline(values, w = 90, h = 22) {
  if (values.length < 2) return `<span class="spark-empty">—</span>`;
  const lo = Math.min(...values), hi = Math.max(...values, lo + 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - lo) / (hi - lo) * (h - 6)).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="M${pts.join(' L')}"/></svg>`;
}

// ---------- Setup screen ----------
function setupRunway(industry, difficulty) {
  // Real computation of the founding team's burn vs starting cash, before any revenue.
  const d = DIFFICULTY[difficulty], ind = INDUSTRIES[industry];
  const payroll = (DEPTS.eng.salary * 2 + DEPTS.sales.salary) * d.salary / 4;
  const overhead = (18000 + 5000 * 3 + ind.compliance) * d.overhead;
  const burn = payroll + overhead + 15000;
  return { burn, months: d.cash / (burn / 3), cash: d.cash };
}
function renderSetup() {
  const st = UI.setup;
  applyIndustryTheme(st.industry);
  const rw = setupRunway(st.industry, st.difficulty);
  const hz = HORIZONS[st.horizon];
  $('#app').innerHTML = `
  <div class="setup-scroll"><div class="setup">
    <div class="setup-head">
      <p class="eyebrow">A founder's game, played one quarter at a time</p>
      <h1>Build a Billion-Dollar Company</h1>
      <p class="lede">You have a little money, three people, and an idea. Hire well, ship often, raise when it counts, and get out the door before the clock runs out.</p>
    </div>
    <div class="field">
      <label for="co-name">Company name</label>
      <div class="name-row"><input id="co-name" data-input="co-name" maxlength="32" value="${esc(st.name)}" placeholder="Name your company" autocomplete="off"><button class="btn ghost" data-act="suggest-name">Suggest one</button></div>
    </div>
    <div class="field">
      <span class="label">Industry</span>
      <div class="industry-grid" role="radiogroup" aria-label="Industry">
        ${Object.entries(INDUSTRIES).map(([k, ind]) => `
        <button class="industry-card${st.industry === k ? ' on' : ''}" role="radio" aria-checked="${st.industry === k}" data-act="pick-industry" data-v="${k}">
          <span class="ic-top">${mascotSVG(ind.advisor.kind, 34)}<span class="ic-name">${ind.name}</span></span>
          <span class="ic-blurb">${ind.blurb}</span>
          <span class="ic-stats"><span>${Math.round(ind.margin * 100)}% margin</span><span>${fmtPct(ind.churn)} churn/mo</span><span>${ind.multiple}× ARR</span></span>
        </button>`).join('')}
      </div>
    </div>
    <div class="setup-row">
      <div class="field">
        <span class="label">Difficulty</span>
        <div class="seg" role="radiogroup" aria-label="Difficulty">${Object.entries(DIFFICULTY).map(([k, d]) => `<button role="radio" aria-checked="${st.difficulty === k}" class="${st.difficulty === k ? 'on' : ''}" data-act="pick-difficulty" data-v="${k}">${d.name}</button>`).join('')}</div>
        <p class="hint">${DIFFICULTY[st.difficulty].blurb}</p>
      </div>
      <div class="field">
        <span class="label">Time horizon</span>
        <div class="seg" role="radiogroup" aria-label="Time horizon">${Object.keys(HORIZONS).map((k) => `<button role="radio" aria-checked="${+k === st.horizon}" class="${+k === st.horizon ? 'on' : ''}" data-act="pick-horizon" data-v="${k}">${k} yrs</button>`).join('')}</div>
        <p class="hint"><strong>${hz.label}.</strong> ${hz.blurb}</p>
      </div>
    </div>
    <div class="setup-foot">
      <p class="setup-sum">You start with <strong>${fmtMoney(rw.cash)}</strong> and a three-person team burning about <strong>${fmtMoney(rw.burn)}</strong> a quarter: <strong>${Math.floor(rw.months)} months</strong> of runway before your first customer pays you. ${INDUSTRIES[st.industry].advisor.name} the ${INDUSTRIES[st.industry].advisor.kind} will advise; ${INDUSTRIES[st.industry].news.name} the ${INDUSTRIES[st.industry].news.kind === 'dish' ? 'dish' : INDUSTRIES[st.industry].news.kind} runs the newsroom.</p>
      <button class="btn primary big" data-act="start">Found the company</button>
    </div>
  </div></div>`;
}

// ---------- Game screen ----------
function advanceDisabled() { return !S || !!S.gameOver || S.modalQueue.length > 0 || UI.screen !== 'game'; }

function renderTopbar() {
  const el = $('#topbar'); if (!el) return;
  const rw = runwayMonths();
  const rec = recessionNow();
  const pct = (S.turn / S.totalTurns) * 100;
  const bands = S.recessions.filter((r) => r.announced).map((r) => `<span class="clock-rec" style="left:${r.start / S.totalTurns * 100}%;width:${(Math.min(r.end, S.turn) - r.start) / S.totalTurns * 100}%"></span>`).join('');
  el.innerHTML = `
    <div class="tb-brand">
      <div class="tb-name">${esc(S.company)}</div>
      <div class="tb-meta">${IND().name} · ${DIF().name} · ${HOR().label}, ${S.horizon} years</div>
    </div>
    <div class="tb-clock">
      <div class="tb-clock-row"><strong>${clockLabel(S.turn)}</strong><span>Quarter ${S.turn + 1} of ${S.totalTurns}</span>${rec ? '<span class="pill bad">Recession</span>' : ''}</div>
      <div class="clock-bar" aria-hidden="true"><span class="clock-fill" style="width:${pct}%"></span>${bands}</div>
    </div>
    <dl class="tb-stats">
      <div><dt>Cash</dt><dd class="${S.cash < 0 ? 'neg' : ''}">${fmtMoney(S.cash)}</dd></div>
      <div><dt>Runway</dt><dd class="${rw < 6 ? 'neg' : rw < 12 ? 'warn' : ''}">${fmtRunway(rw)}</dd></div>
      <div><dt>ARR</dt><dd>${fmtMoney(currentARR())}</dd></div>
      <div><dt>Valuation</dt><dd>${fmtMoney(S.valuation)}</dd></div>
      <div><dt>Your stake</dt><dd>${fmtPct(S.founderOwnership)}</dd></div>
    </dl>
    <button id="advance-btn" class="btn primary advance" data-act="advance" ${advanceDisabled() ? 'disabled' : ''}>Advance quarter <span aria-hidden="true">→</span></button>`;
}

const TABS = [['overview', 'Overview'], ['team', 'Team'], ['payroll', 'Payroll'], ['product', 'Product'], ['markets', 'Markets'], ['funding', 'Funding'], ['log', 'Log']];
function renderGame() {
  applyIndustryTheme(S.industry);
  const badge = (k) => {
    if (k === 'overview' && S.events.length) return `<span class="tab-badge">${S.events.length}</span>`;
    if (k === 'team') return `<span class="tab-count">${S.employees.length}</span>`;
    if (k === 'funding' && roundStatus().state === 'open') return '<span class="tab-dot" aria-label="round open"></span>';
    if (k === 'product' && S.product.points >= shipCost()) return '<span class="tab-dot" aria-label="ready to ship"></span>';
    return '';
  };
  $('#app').innerHTML = `
  <div class="game">
    <header class="topbar" id="topbar"></header>
    <nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${UI.tab === k}" class="tab${UI.tab === k ? ' on' : ''}" data-act="tab" data-v="${k}">${l}${badge(k)}</button>`).join('')}</nav>
    <main class="tab-body" id="tab-body">${TAB_RENDER[UI.tab]()}</main>
  </div>`;
  renderTopbar();
}

// ---------- Overview ----------
function eventCard(ev) {
  const e = empById(ev.empId); if (!e) return '';
  const who = `<strong>${esc(e.name)}</strong> (${e.revealed ? TIER_INFO[e.tier].label : 'unproven'}, ${DEPTS[e.dept].name})`;
  if (ev.type === 'overlooked') {
    const canClap = S.clapsUsed < clapBudget() && S.turn >= e.clapReadyTurn, canBonus = S.turn >= e.bonusReadyTurn;
    return `<div class="event warn"><div class="event-kind">Feeling overlooked</div>
      <p>${who} hasn't been recognized in ${quartersSinceRecog(e)} quarters and has hit a rough patch. They feel their work goes unnoticed.</p>
      <div class="event-actions"><button class="btn" data-act="bonus" data-id="${e.id}" ${canBonus ? '' : 'disabled'}>Bonus · ${fmtMoney(bonusCost(e))}</button><button class="btn ghost" data-act="clap" data-id="${e.id}" ${canClap ? '' : 'disabled'}>Clap${canClap ? '' : ' (used)'}</button><span class="event-note">A bonus usually pulls people out of it. A clap sometimes does.</span></div></div>`;
  }
  if (ev.type === 'transfer') {
    const o = transferOdds(e, ev.to);
    return `<div class="event"><div class="event-kind">Transfer request</div>
      <p>${who} asks to move to <strong>${DEPTS[ev.to].name}</strong>. ${o.fit ? `It matches their ${e.skill} skill.` : `Their ${e.skill} skill fits ${DEPTS[SKILLS[e.skill].dept].name} better.`} Their track record suggests about <strong>${Math.round(o.good * 100)}%</strong> odds it works out. Ignoring the request will sting.</p>
      <div class="event-actions"><button class="btn" data-act="approve-request" data-id="${e.id}">Approve the move</button><button class="btn ghost" data-act="decline-request" data-id="${e.id}">Decline</button></div></div>`;
  }
  return '';
}
function statementRows() {
  const L = S.last;
  const row = (label, v, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th><td>${fmtMoney(v)}</td></tr>`;
  return row('Revenue', L.revenue) + row('Cost of revenue', -L.cogs) + row('Gross profit', L.gp, 'sub') +
    row('Payroll', -L.payroll) + row('Overhead', -L.overhead) + row('Marketing', -L.marketing) +
    row('Operating result', L.net, 'total' + (L.net < 0 ? ' neg' : '')) +
    (L.oneTime ? row('One-time spend (hires, launches, entries)', -L.oneTime) : '') +
    row('Change in cash', L.net - L.oneTime, 'sub');
}
function renderOverview() {
  const L = S.last; const ind = IND();
  const events = S.events.slice(0, 6).map(eventCard).join('') + (S.events.length > 6 ? `<p class="fine">${S.events.length - 6} more people need attention. Look for rough patches and requests on the Team tab.</p>` : '');
  const hist = S.history;
  const ipo = ipoStatus();
  const arr = currentARR();
  const custs = totalCustomers();
  const churnM = L ? L.churnRate : ind.churn * DIF().churn;
  const arpu = custs > 0 ? totalRevenue() / custs / 3 : ind.arpu * productArpuMult();
  const cac = L && L.cac ? L.cac : ind.cac * DIF().cac;
  const ltv = arpu * ind.margin / Math.max(0.001, churnM);
  const deptCounts = DEPT_KEYS.map((d) => { const es = S.employees.filter((e) => e.dept === d); return { d, n: es.length, out: sum(es, empOutput) }; });
  const maxSpend = Math.max(200000, Math.ceil(Math.max(S.marketingSpend, S.cash * 0.25) / 50000) * 50000);
  return `
  <div class="ov-grid">
    <div class="col">
      <section class="panel">
        <div class="panel-head"><h2>This quarter</h2><span class="muted">${clockLabel(S.turn)}</span></div>
        ${events || `<p class="quiet">Nothing needs your decision this quarter. Check the team for anyone who could use some recognition, then advance when you're ready.</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Last quarter</h2>${L ? `<span class="muted">${clockLabel(S.turn - 1)}</span>` : ''}</div>
        ${L ? `<table class="statement">${statementRows()}</table>
          <p class="fine">${fmtNum(L.newMkt)} ${ind.unit} from marketing, ${fmtNum(L.newSales)} from sales, ${fmtNum(L.churned)} churned. Support coverage ${L.coverage >= 1 ? 'is comfortable' : `is at ${Math.round(L.coverage * 100)}%, so churn runs higher`}.</p>`
          : `<p class="quiet">Your first quarter's numbers appear here after you advance. Projected operating result: <strong>${fmtMoney(projectedNet())}</strong> a quarter.</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>ARR and cash</h2><span class="legend"><i style="background:var(--accent)"></i>ARR <i style="background:var(--second)"></i>Cash</span></div>
        ${lineChart([{ label: 'ARR', color: 'var(--accent)', values: hist.map((h) => h.arr) }, { label: 'Cash', color: 'var(--second)', values: hist.map((h) => h.cash) }])}
      </section>
    </div>
    <div class="col">
      <section class="panel">
        <div class="panel-head"><h2>Marketing budget</h2><span class="num" id="mkt-val">${fmtMoney(S.marketingSpend)}/q</span></div>
        <input type="range" id="mkt-range" data-input="marketing" min="0" max="${maxSpend}" step="5000" value="${S.marketingSpend}" aria-label="Marketing spend per quarter">
        <p class="fine">Spread across ${enteredMarkets().length} market${enteredMarkets().length > 1 ? 's' : ''} by size. Each market saturates: past a point, more money buys fewer ${ind.unit}. Last quarter's blended CAC: <strong>${L && L.cac ? fmtMoney(L.cac) : '—'}</strong>.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Unit economics</h2></div>
        <dl class="kv">
          <div><dt>${ind.unit[0].toUpperCase() + ind.unit.slice(1)}</dt><dd>${fmtNum(custs)}</dd></div>
          <div><dt>ARPU</dt><dd>${fmtMoney(arpu)}/mo</dd></div>
          <div><dt>Churn</dt><dd>${fmtPct(churnM, 2)}/mo</dd></div>
          <div><dt>CAC</dt><dd>${fmtMoney(cac)}</dd></div>
          <div><dt>LTV : CAC</dt><dd class="${ltv / cac < 1 ? 'neg' : ltv / cac >= 3 ? 'pos' : ''}">${(ltv / cac).toFixed(1)}×</dd></div>
          <div><dt>Gross margin</dt><dd>${Math.round(ind.margin * 100)}%</dd></div>
        </dl>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>The goal</h2></div>
        <div class="goal"><div class="goal-row"><span>ARR toward IPO bar</span><span class="num">${fmtMoney(arr)} / ${fmtMoney(ipo.need)}</span></div><div class="meter"><span style="width:${Math.min(100, arr / ipo.need * 100)}%"></span></div></div>
        <div class="goal"><div class="goal-row"><span>Valuation toward $1B</span><span class="num">${fmtMoney(S.valuation)}</span></div><div class="meter alt"><span style="width:${Math.min(100, S.valuation / 1e9 * 100)}%"></span></div></div>
        <p class="fine">${S.horizon <= 5 ? 'In a five-year game, a strong acquisition or a big raise is a real win. The IPO bar is there for the bold.' : `${S.totalTurns - S.turn} quarters left on the clock.`}</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Team at a glance</h2><button class="link" data-act="tab" data-v="team">Open team</button></div>
        <dl class="kv">${deptCounts.map((c) => `<div><dt>${DEPTS[c.d].name}</dt><dd>${c.n} <span class="muted">· ${c.out.toFixed(1)} output</span></dd></div>`).join('')}</dl>
        <p class="fine">Claps left this quarter: ${clapBudget() - S.clapsUsed} of ${clapBudget()}.${S.rival.strength > 0 ? ` ${esc(S.rival.name)} has raised your acquisition costs by ${Math.round(S.rival.strength * 100)}% with talent that used to be yours.` : ''}</p>
      </section>
    </div>
  </div>`;
}

// ---------- Team ----------
function tierPill(e) {
  if (!e.revealed) return `<span class="pill unknown" title="Their baseline is hidden until a full quarter is in">${e.prevTier ? 'Settling in' : 'Onboarding'}</span>`;
  return `<span class="pill tier-${e.tier}">${TIER_INFO[e.tier].label}</span>`;
}
function tempChip(e) {
  if (!e.temp) return '';
  const t = e.temp; const cls = t.type === 'rough' ? 'bad' : 'good';
  return `<span class="pill ${cls}" title="${esc(t.reason)}">${TEMP_INFO[t.type].label}${t.reason === 'feeling overlooked' ? ': overlooked' : ''} · ${t.left}q</span>`;
}
function empCard(e) {
  const risk = flightRisk(e); const rl = riskLabel(risk);
  const fit = isFit(e);
  const since = quartersSinceRecog(e);
  const canBonus = S.turn >= e.bonusReadyTurn, canClap = S.turn >= e.clapReadyTurn && S.clapsUsed < clapBudget();
  const pt = UI.pendingTransfer[e.id];
  const pm = UI.pendingMarket[e.id];
  const skillDept = SKILLS[e.skill].dept;
  const transferOpts = DEPT_KEYS.filter((d) => d !== e.dept).map((d) => {
    const marks = []; if (d === skillDept) marks.push('skill fit'); if (d === e.origDept) marks.push('original dept');
    return `<option value="${d}" ${pt === d ? 'selected' : ''}>${DEPTS[d].name}${marks.length ? ' — ' + marks.join(', ') : ''}</option>`;
  }).join('');
  let salesBlock = '';
  if (e.dept === 'sales') {
    const opts = enteredMarkets().map((m) => {
      const tag = m.id === e.nativeMarket ? ' — native' : '';
      return `<option value="${m.id}" ${(pm != null ? pm : e.market) === m.id ? 'selected' : ''}>${esc(m.name)}${tag}</option>`;
    }).join('');
    const tm = traitMult(e);
    salesBlock = `<div class="emp-sales"><div><span class="k">Trait</span> ${SALES_TRAITS[e.trait].label} <span class="muted">· native to ${esc(marketById(e.nativeMarket).name)}</span></div>
      <div class="emp-market"><label for="mkt-${e.id}" class="k">Market</label><select id="mkt-${e.id}" data-change="market-select" data-id="${e.id}">${opts}</select><span class="pill ${tm > 1 ? 'good' : tm < 1 ? 'bad' : ''}">${tm > 1 ? 'Trait fit' : tm < 1 ? 'Off-trait' : 'Neutral'} ${tm.toFixed(2)}×</span></div>
      ${pm != null && pm !== e.market ? (() => { const f = traitFitText(e, pm); return `<div class="confirm-row ${f.ok ? '' : 'risky'}"><p>${f.text} Expect a one-quarter adjustment dip.</p><button class="btn small" data-act="market-confirm" data-id="${e.id}">Reassign</button><button class="btn small ghost" data-act="market-cancel" data-id="${e.id}">Cancel</button></div>`; })() : ''}</div>`;
  }
  const transferConfirm = pt ? (() => {
    const o = transferOdds(e, pt);
    return `<div class="confirm-row ${o.good >= 0.6 ? '' : 'risky'}"><p>Move to ${DEPTS[pt].name}? ${o.fit ? 'Matches their skill. ' : ''}${pt === e.origDept ? 'It’s where they started. ' : ''}A transfer re-rolls their performance: about <strong>${Math.round(o.good * 100)}%</strong> odds they land Solid or better.</p><button class="btn small" data-act="transfer-confirm" data-id="${e.id}">Transfer</button><button class="btn small ghost" data-act="transfer-cancel" data-id="${e.id}">Cancel</button></div>`;
  })() : '';
  const req = e.request ? `<div class="emp-request">Asked to move to ${DEPTS[e.request].name}. <button class="link" data-act="approve-request" data-id="${e.id}">Approve</button> · <button class="link" data-act="decline-request" data-id="${e.id}">Decline</button></div>` : '';
  return `<article class="emp${e.temp && e.temp.type === 'rough' ? ' is-rough' : ''}">
    <header class="emp-head"><div><h3 class="emp-name">${esc(e.name)}</h3><div class="emp-sub">${DEPTS[e.dept].name} · ${fmtTenure(tenure(e))}</div></div><div class="emp-out" title="Effective output this quarter"><span class="num">${empOutput(e).toFixed(2)}×</span><span>output</span></div></header>
    <div class="chips">${tierPill(e)}${tempChip(e)}</div>
    <div class="emp-skill"><span class="k">Skill</span> ${e.skill} ${fit ? `<span class="pill good">Fits ${DEPTS[e.dept].short} +20%</span>` : `<span class="muted">· suits ${DEPTS[skillDept].name}</span>`}</div>
    ${salesBlock}
    <div class="emp-risk"><span class="k">Flight risk</span><span class="risk-meter r-${rl.toLowerCase()}"><span style="width:${risk}%"></span></span><span class="risk-label r-${rl.toLowerCase()}">${rl}</span><span class="muted">${since === 0 ? 'recognized this quarter' : `${since}q since recognition`}</span></div>
    ${req}
    <ol class="emp-hist">${e.history.slice(-4).reverse().map((h) => `<li><span class="when">${clockLabel(h.turn)}</span> ${esc(h.text)}</li>`).join('')}</ol>
    <div class="emp-actions">
      <button class="btn small" data-act="bonus" data-id="${e.id}" ${canBonus ? '' : 'disabled'} title="${canBonus ? 'Cash bonus' : 'Bonus available again next quarter'}">Bonus · ${fmtMoney(bonusCost(e))}</button>
      <button class="btn small ghost" data-act="clap" data-id="${e.id}" ${canClap ? '' : 'disabled'} title="Free public recognition">Clap</button>
      <select aria-label="Transfer ${esc(e.name)} to another department" data-change="transfer-select" data-id="${e.id}"><option value="">Move to…</option>${transferOpts}</select>
      ${UI.confirmFire === e.id ? `<button class="btn small danger" data-act="fire" data-id="${e.id}">Confirm · ${fmtMoney(severance(e))} severance</button><button class="btn small ghost" data-act="fire-cancel">Keep</button>` : `<button class="btn small ghost danger-text" data-act="fire" data-id="${e.id}">Let go</button>`}
    </div>
    ${transferConfirm}
    <div class="emp-foot muted">${fmtMoney(e.salary)}/yr${e.origDept !== e.dept ? ` · started in ${DEPTS[e.origDept].name}` : ''}</div>
  </article>`;
}
const DEPT_ROLE = {
  eng: 'Builds toward the next release.', sales: 'Closes deals in one market.', mkt: 'Makes every marketing dollar go further.', ops: 'Keeps churn and overhead in check.',
};
function renderTeam() {
  const list = S.employees.filter((e) => UI.teamFilter === 'all' || e.dept === UI.teamFilter);
  const hm = UI.hireMarket != null && marketById(UI.hireMarket) && marketById(UI.hireMarket).entered ? UI.hireMarket : homeMarket().id;
  return `
  <section class="panel hire-panel">
    <div class="panel-head"><h2>Hire</h2><span class="muted">Every hire is a person. You'll learn how good they are after one quarter.</span></div>
    <div class="hire-grid">${DEPT_KEYS.map((d) => {
      const sal = DEPTS[d].salary * DIF().salary * wageIndex();
      return `<div class="hire-card"><div class="hire-name">${DEPTS[d].name}</div><div class="hire-role">${DEPT_ROLE[d]}</div>
        <div class="hire-cost">~${fmtMoney(sal)}/yr · ${fmtMoney(hireFee(sal))} to recruit</div>
        ${d === 'sales' ? `<select id="hire-market" data-change="hire-market" aria-label="Market for the new sales hire">${enteredMarkets().map((m) => `<option value="${m.id}" ${m.id === hm ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>` : ''}
        <button class="btn" data-act="hire" data-dept="${d}">Hire</button></div>`;
    }).join('')}</div>
  </section>
  <div class="team-bar">
    <div class="seg small">${[['all', 'Everyone'], ...DEPT_KEYS.map((d) => [d, DEPTS[d].name])].map(([k, l]) => `<button class="${UI.teamFilter === k ? 'on' : ''}" data-act="team-filter" data-v="${k}">${l}</button>`).join('')}</div>
    <span class="muted">Claps left this quarter: <strong>${clapBudget() - S.clapsUsed}</strong> of ${clapBudget()}</span>
  </div>
  ${list.length ? `<div class="emp-grid">${list.map(empCard).join('')}</div>` : `<p class="quiet panel">Nobody here yet. Hire someone above.</p>`}`;
}

// ---------- Payroll ----------
const PAY_COLS = [
  ['name', 'Name', (e) => e.last + e.first], ['dept', 'Department', (e) => e.dept + e.last],
  ['perf', 'Performance', (e) => (e.revealed ? tierIdx(e.tier) : 9)], ['skill', 'Skill', (e) => e.skill],
  ['market', 'Market', (e) => (e.market != null ? marketById(e.market).name : '~')], ['tenure', 'Tenure', (e) => tenure(e)],
  ['salary', 'Salary', (e) => e.salary], ['output', 'Output', (e) => empOutput(e)],
];
function renderPayroll() {
  const col = PAY_COLS.find((c) => c[0] === UI.sort.key) || PAY_COLS[1];
  const rows = S.employees.slice().sort((a, b) => { const x = col[2](a), y = col[2](b); return (x < y ? -1 : x > y ? 1 : 0) * UI.sort.dir; });
  const total = sum(S.employees, (e) => e.salary);
  const subs = DEPT_KEYS.map((d) => { const es = S.employees.filter((e) => e.dept === d); return { d, n: es.length, sal: sum(es, (e) => e.salary), out: sum(es, empOutput) }; });
  return `
  <section class="panel">
    <div class="panel-head"><h2>Payroll</h2><span class="muted">${S.employees.length} people · ${fmtMoney(total)}/yr · ${fmtMoney(total / 4)} this quarter</span></div>
    <div class="table-wrap"><table class="data sortable">
      <thead><tr>${PAY_COLS.map(([k, l]) => `<th scope="col"><button class="th-btn${UI.sort.key === k ? ' on' : ''}" data-act="sort" data-v="${k}">${l}${UI.sort.key === k ? (UI.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map((e) => `<tr>
        <td>${esc(e.name)}</td><td>${DEPTS[e.dept].name}</td>
        <td>${e.revealed ? TIER_INFO[e.tier].label : '<span class="muted">Unknown</span>'}${e.temp ? ` <span class="muted">· ${TEMP_INFO[e.temp.type].label}</span>` : ''}</td>
        <td>${e.skill}${isFit(e) ? ' <span class="fit-mark" title="Skill fits department">✓</span>' : ''}</td>
        <td>${e.market != null ? esc(marketById(e.market).name) : '<span class="muted">—</span>'}</td>
        <td class="num">${fmtTenure(tenure(e))}</td><td class="num">${fmtMoney(e.salary)}</td><td class="num">${empOutput(e).toFixed(2)}×</td></tr>`).join('')}</tbody>
      <tfoot>${subs.map((s) => `<tr class="subtotal"><td colspan="2">${DEPTS[s.d].name}</td><td colspan="4">${s.n} ${s.n === 1 ? 'person' : 'people'}</td><td class="num">${fmtMoney(s.sal)}</td><td class="num">${s.out.toFixed(2)}</td></tr>`).join('')}
        <tr class="grand"><td colspan="2">Total</td><td colspan="4">${S.employees.length} people</td><td class="num">${fmtMoney(total)}</td><td class="num">${sum(subs, (s) => s.out).toFixed(2)}</td></tr></tfoot>
    </table></div>
  </section>`;
}

// ---------- Product ----------
function renderProduct() {
  const lvl = S.product.level; const cost = shipCost(); const pts = S.product.points;
  const engOut = sum(S.employees.filter((e) => e.dept === 'eng'), empOutput) + 0.3;
  const eta = pts >= cost ? 0 : Math.ceil((cost - pts) / Math.max(0.1, engOut));
  const { cur, next } = stageFor(lvl);
  const ladder = STAGES.concat(lvl >= 30 ? [next] : []);
  const ind = IND();
  return `
  <div class="ov-grid">
    <div class="col">
      <section class="panel product-hero">
        <div class="ph-version"><span class="ph-v">v${lvl}</span><span class="ph-stage">${cur.name}</span></div>
        <ol class="ladder">${ladder.map((s) => `<li class="${lvl >= s.at ? 'done' : ''}${s === cur || s.name === cur.name ? ' cur' : ''}"><span class="dot"></span><span class="lname">${s.name}</span><span class="lat">v${s.at}</span></li>`).join('')}</ol>
        <p class="fine">${next ? `${next.at - lvl} more release${next.at - lvl > 1 ? 's' : ''} to ${next.name}.` : ''} There is no final version. Keep shipping.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Next release</h2><span class="muted">v${lvl + 1}</span></div>
        <div class="goal"><div class="goal-row"><span>Engineering progress</span><span class="num">${pts.toFixed(1)} / ${cost.toFixed(1)}</span></div><div class="meter"><span style="width:${Math.min(100, pts / cost * 100)}%"></span></div></div>
        <p class="fine">Engineering delivers about <strong>${engOut.toFixed(1)}</strong> points a quarter${ind.buildMult > 1.3 ? ', and hardware takes longer to build' : ''}. ${eta === 0 ? 'Ready to ship now.' : `About ${eta} quarter${eta > 1 ? 's' : ''} at this pace.`}</p>
        <dl class="kv">
          <div><dt>ARPU</dt><dd>${fmtMoney(ind.arpu * productArpuMult(lvl))} → <strong>${fmtMoney(ind.arpu * productArpuMult(lvl + 1))}</strong>/mo</dd></div>
          <div><dt>Churn factor</dt><dd>${productChurnMult(lvl).toFixed(2)} → <strong>${productChurnMult(lvl + 1).toFixed(2)}</strong></dd></div>
          <div><dt>Launch cost</dt><dd>${fmtMoney(shipCash())}</dd></div>
        </dl>
        <button class="btn primary" data-act="ship" ${pts >= cost ? '' : 'disabled'}>Ship v${lvl + 1}</button>
      </section>
    </div>
    <div class="col">
      <section class="panel">
        <div class="panel-head"><h2>Release history</h2></div>
        ${S.product.shipped.length ? `<ol class="releases">${S.product.shipped.slice().reverse().map((r) => `<li><span class="num">v${r.level}</span> <em>“${r.code}”</em><span class="muted">${clockLabel(r.turn)}</span></li>`).join('')}</ol>` : '<p class="quiet">Nothing shipped yet beyond the MVP. Your two engineers are on it.</p>'}
      </section>
    </div>
  </div>`;
}

// ---------- Markets ----------
function renderMarkets() {
  const ent = enteredMarkets(); const avail = S.markets.filter((m) => !m.entered);
  const reps = (m) => S.employees.filter((e) => e.dept === 'sales' && e.market === m.id).length;
  const ind = IND();
  const totals = { c: totalCustomers(), r: totalRevenue(), n: sum(ent, (m) => m.newCust), ch: sum(ent, (m) => m.churned) };
  return `
  <section class="panel">
    <div class="panel-head"><h2>Your markets</h2><span class="muted">${ent.length} active</span></div>
    <div class="table-wrap"><table class="data" id="markets-table">
      <thead><tr><th>Market</th><th class="num">${ind.unit[0].toUpperCase() + ind.unit.slice(1)}</th><th class="num">Revenue/q</th><th class="num">New</th><th class="num">Churned</th><th class="num">Reps</th><th class="num">Price</th><th class="num">Reached</th><th>Trend</th><th>Status</th></tr></thead>
      <tbody>${ent.map((m) => { const st = marketStatus(m); return `<tr data-market="${m.id}">
        <td>${esc(m.name)}${m.home ? ' <span class="muted">home</span>' : ''}</td><td class="num" data-c="${m.customers}">${fmtNum(m.customers)}</td><td class="num" data-r="${m.revenue}">${fmtMoney(m.revenue)}</td>
        <td class="num">${fmtNum(m.newCust)}</td><td class="num">${fmtNum(m.churned)}</td><td class="num">${reps(m)}</td><td class="num">${m.arpu.toFixed(2)}×</td><td class="num">${fmtPct(Math.min(1, penetration(m)), 0)}</td>
        <td>${sparkline(m.hist)}</td><td><span class="pill ${st.key === 'bad' ? 'bad' : st.key === 'good' ? 'good' : ''}">${st.label}</span></td></tr>`; }).join('')}</tbody>
      <tfoot><tr class="grand"><td>All markets</td><td class="num" id="mt-c" data-c="${totals.c}">${fmtNum(totals.c)}</td><td class="num" id="mt-r" data-r="${totals.r}">${fmtMoney(totals.r)}</td><td class="num">${fmtNum(totals.n)}</td><td class="num">${fmtNum(totals.ch)}</td><td class="num">${S.employees.filter((e) => e.dept === 'sales').length}</td><td colspan="4"></td></tr></tfoot>
    </table></div>
    <p class="fine">Marketing is split by market size. Sales reps sell only in the market they're assigned to; reassign them from their card on the Team tab. <em>Reached</em> is the share of a market's likely buyers you already have. New customers get harder to find as it climbs.</p>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Expand</h2><span class="muted">${avail.length} known markets</span></div>
    <div class="market-grid">
      <div class="market-card scout"><div class="mc-name">Scout a new market</div><p class="fine">Send a team to map somewhere nobody's charted yet. There is always somewhere else to go.</p><button class="btn" data-act="scout">Scout · ${fmtMoney(scoutCost())}</button></div>
      ${avail.map((m) => `<div class="market-card"><div class="mc-name">${esc(m.name)}${m.scouted ? ' <span class="pill">Scouted</span>' : ''}</div>
        <dl class="mc-stats"><div><dt>Price level</dt><dd>${m.arpu.toFixed(2)}×</dd></div><div><dt>Growth</dt><dd>${m.growth.toFixed(2)}×</dd></div><div><dt>Size</dt><dd>${m.size.toFixed(2)}</dd></div><div><dt>Overhead</dt><dd>${fmtMoney(m.overhead)}/q</dd></div></dl>
        <button class="btn" data-act="enter-market" data-id="${m.id}" ${S.cash >= m.entry ? '' : 'disabled'}>Enter · ${fmtMoney(m.entry)}</button></div>`).join('')}
    </div>
  </section>`;
}

// ---------- Funding ----------
function renderFunding() {
  const fs = roundStatus(); const ipo = ipoStatus();
  return `
  <div class="ov-grid">
    <div class="col">
      <section class="panel">
        <div class="panel-head"><h2>Funding rounds</h2></div>
        <ol class="rounds">${ROUNDS.map((r, i) => {
          const raised = S.funding.raised.find((x) => x.key === r.key);
          let body;
          if (raised) body = `<span class="pill good">Raised</span> ${fmtMoney(raised.cash)} for ${fmtPct(raised.eq)} from ${esc(raised.investor)} <span class="muted">· ${fmtMoney(raised.post)} post · ${clockLabel(raised.turn)}</span>`;
          else if (i === S.funding.next && fs.state === 'open') body = `<span class="pill accent">Open</span> Investors are ready to talk. <button class="btn small primary" data-act="open-funding">Open negotiations</button>`;
          else if (i === S.funding.next) body = `<span class="pill">${fs.state === 'cooldown' ? 'Cooling off' : 'Locked'}</span> <span class="muted">${fs.why}</span>`;
          else body = `<span class="muted">Typical dilution ${Math.round(r.eq[0] * 100)}–${Math.round(r.eq[1] * 100)}%</span>`;
          return `<li class="${raised ? 'done' : i === S.funding.next ? 'cur' : ''}"><span class="r-name">${r.name}</span><span class="r-body">${body}</span></li>`;
        }).join('')}</ol>
        <p class="fine">Investor sentiment right now: <strong>${S.sentiment >= 1.1 ? 'warm' : S.sentiment <= 0.9 ? 'cool' : 'neutral'}</strong>. Warmer sentiment means investors accept less equity for the same check.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Going public</h2></div>
        <ul class="checks">${ipo.checks.map((c) => `<li class="${c.ok ? 'ok' : ''}"><span class="check-mark">${c.ok ? '✓' : ''}</span>${c.text} <span class="muted">· ${c.now}</span></li>`).join('')}</ul>
        <button class="btn primary" data-act="ipo" ${ipo.ok ? '' : 'disabled'}>Ring the bell</button>
      </section>
    </div>
    <div class="col">
      <section class="panel">
        <div class="panel-head"><h2>Cap table</h2></div>
        <ul class="cap">${[{ name: 'You (founder)', pct: S.founderOwnership }, ...S.capTable].map((h) => `<li><span>${esc(h.name)}</span><span class="cap-bar"><span style="width:${h.pct * 100}%"></span></span><span class="num">${fmtPct(h.pct)}</span></li>`).join('')}</ul>
        <p class="fine">Your stake is worth about <strong>${fmtMoney(S.founderOwnership * S.valuation)}</strong> at today's valuation.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Buyers</h2></div>
        <p class="quiet">${S.offersDeclined.length ? `You've turned down ${S.offersDeclined.length} offer${S.offersDeclined.length > 1 ? 's' : ''}: ${S.offersDeclined.map((o) => `${esc(o.buyer)} at ${fmtMoney(o.offer)} (${clockLabel(o.turn)})`).join('; ')}.` : 'No offers yet. Buyers call when they’re interested, and more often in shorter games.'}</p>
      </section>
    </div>
  </div>`;
}

// ---------- Log ----------
function renderLog() {
  const byTurn = {};
  S.log.forEach((l) => { (byTurn[l.turn] = byTurn[l.turn] || []).push(l); });
  const turns = Object.keys(byTurn).map(Number).sort((a, b) => b - a);
  return `<section class="panel"><div class="panel-head"><h2>Company log</h2></div>
    ${turns.map((t) => `<div class="log-q"><h3>${clockLabel(t)}</h3><ul>${byTurn[t].map((l) => `<li class="k-${l.kind}">${esc(l.text)}</li>`).join('')}</ul></div>`).join('')}</section>`;
}

const TAB_RENDER = { overview: renderOverview, team: renderTeam, payroll: renderPayroll, product: renderProduct, markets: renderMarkets, funding: renderFunding, log: renderLog };
