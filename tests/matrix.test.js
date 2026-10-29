// Headless matrix test: plays every industry x difficulty x horizon with a heuristic bot,
// exercising hiring, markets, scouting, funding negotiation, transfers, reassignment,
// retention, recognition and acquisitions, and checks internal consistency each quarter.
// Usage: node tests/matrix.test.js [seedsPerCombo]
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.join(__dirname, '..', 'billion-dollar-company.html');
const SEEDS = +(process.argv[2] || 2);

function botGame(cfg) {
  const B = window.BDC; const A = B.ACTIONS; const H = B.helpers;
  B.setSeed(cfg.seed);
  B.UI.setup = { name: 'Test Co', industry: cfg.industry, difficulty: cfg.difficulty, horizon: cfg.horizon };
  A.start();
  // Bot randomness is separate from the game's RNG so strategy choices don't perturb it.
  let bs = cfg.seed * 7919 + 13;
  const br = () => { bs = (bs * 1103515245 + 12345) % 2147483648; return bs / 2147483648; };
  const problems = [];
  const fail = (msg) => { if (problems.length < 15) problems.push(`T${B.S.turn}: ${msg}`); };
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const counts = { negotiations: 0, counters: 0, retains: 0, transfers: 0, reassigns: 0, overlooked: 0, requests: 0, acqOffers: 0, scouts: 0, bridges: 0, modalsSeen: {} };
  const TABS = ['overview', 'team', 'payroll', 'product', 'markets', 'funding', 'log'];
  const click = (sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; };

  const checkNumbers = () => {
    const S = B.S;
    const nums = { cash: S.cash, valuation: S.valuation, founder: S.founderOwnership, sentiment: S.sentiment, points: S.product.points };
    for (const [k, v] of Object.entries(nums)) if (!Number.isFinite(v)) fail(`${k} not finite: ${v}`);
    S.markets.forEach((m) => { if (!Number.isFinite(m.customers) || !Number.isFinite(m.revenue) || m.customers < 0) fail(`market ${m.name} bad numbers`); });
    S.employees.forEach((e) => { if (!Number.isFinite(H.empOutput(e)) || !Number.isFinite(H.flightRisk(e))) fail(`employee ${e.name} bad output`); if (!e.name || e.name.includes('undefined')) fail('bad name'); });
    const own = S.founderOwnership + S.capTable.reduce((a, h) => a + h.pct, 0);
    if (!near(own, 1, 1e-6)) fail(`cap table sums to ${own}`);
  };
  const checkMarketsDom = () => {
    B.UI.tab = 'markets'; B.render();
    const rows = [...document.querySelectorAll('#markets-table tbody tr')];
    const c = rows.reduce((a, r) => a + +r.querySelector('[data-c]').dataset.c, 0);
    const r = rows.reduce((a, r) => a + +r.querySelector('[data-r]').dataset.r, 0);
    const fc = +document.querySelector('#mt-c').dataset.c, fr = +document.querySelector('#mt-r').dataset.r;
    if (!near(c, fc) || !near(r, fr)) fail(`market table rows ${c}/${r} != totals ${fc}/${fr}`);
    if (!near(fc, H.totalCustomers()) || !near(fr, H.totalRevenue())) fail('market totals != global totals');
    if (B.S.last && !near(fr, B.S.last.revenue)) fail(`market revenue ${fr} != reported revenue ${B.S.last.revenue}`);
    if (rows.length !== B.S.markets.filter((m) => m.entered).length) fail('market row count mismatch');
  };
  const checkAdvanceLock = () => {
    const btn = document.querySelector('#advance-btn');
    if (!btn) return;
    if (B.S.modalQueue.length && !btn.disabled) fail(`advance enabled with ${B.S.modalQueue[0].type} modal open`);
    if (!B.S.modalQueue.length && !B.S.gameOver && btn.disabled) fail('advance disabled with no modal');
    if (B.S.modalQueue.length && !document.querySelector('#modal-root .modal')) fail('modal queued but not in DOM');
  };

  const handleModals = () => {
    let guard = 0;
    while (B.S && !B.S.gameOver && B.S.modalQueue.length && guard++ < 20) {
      const m = B.S.modalQueue[0];
      counts.modalsSeen[m.type] = (counts.modalsSeen[m.type] || 0) + 1;
      checkAdvanceLock();
      if (m.type === 'funding') {
        counts.negotiations++;
        const t = m.terms; const eq = Math.max(t.min, Math.min(t.max, t.fair * (0.55 + br() * 0.7)));
        const slider = document.querySelector('#fund-eq');
        slider.value = Math.round(eq * 1000); slider.dispatchEvent(new Event('input', { bubbles: true }));
        const cashTxt = document.querySelector('#fq-cash').textContent;
        if (!cashTxt || cashTxt.includes('NaN')) fail('funding quote not rendered');
        const q = H.fundingQuote(t, m.eq);
        if (q.eq > 0.45 || q.cash <= 0 || !near(q.post * q.eq, q.cash)) fail(`odd funding quote ${JSON.stringify(q)}`);
        click('[data-act="fund-offer"]');
      } else if (m.type === 'counter') {
        counts.counters++;
        const r = br(); click(r < 0.4 ? '[data-act="counter-accept"]' : r < 0.85 ? '[data-act="counter-middle"]' : '[data-act="counter-walk"]');
      } else if (m.type === 'retain') {
        counts.retains++;
        const r = br(); click(`[data-act="retain"][data-v="${r < 0.15 ? 'none' : r < 0.35 ? 'low' : r < 0.8 ? 'fair' : 'gen'}"]:not([disabled])`) || click('[data-act="retain"][data-v="none"]');
      } else if (m.type === 'acquisition') {
        counts.acqOffers++;
        const accept = cfg.acceptAcq && (m.offer > 2e8 || br() < 0.08);
        click(accept ? '[data-act="acq-accept"]' : '[data-act="acq-decline"]');
      } else if (m.type === 'bridge') {
        counts.bridges++; click(br() < 0.85 ? '[data-act="bridge-accept"]' : '[data-act="bridge-decline"]');
      } else if (m.type === 'result') click('[data-act="result-ok"]');
      else { fail('unknown modal ' + m.type); break; }
    }
  };

  const playTurn = () => {
    const S = B.S; const runway = H.runwayMonths();
    // Funding
    if (H.roundStatus().state === 'open' && (runway < 30 || br() < 0.5)) { A['open-funding'](); handleModals(); }
    // Marketing budget
    const target = runway > 18 ? Math.min(S.cash * 0.07, 6e6) : runway > 9 ? Math.min(S.cash * 0.04, 2e6) : 5000;
    S.marketingSpend = Math.max(5000, Math.round(target / 5000) * 5000);
    // Hiring toward a ratio
    let hires = 0;
    while (H.runwayMonths() > 16 && S.cash > 250000 && hires < 6) {
      const n = S.employees.length + 1; const c = (d) => S.employees.filter((e) => e.dept === d).length;
      const want = { eng: 0.35, sales: 0.3, mkt: 0.15, ops: 0.2 };
      const dept = Object.keys(want).sort((a, b) => (c(a) - want[a] * n) - (c(b) - want[b] * n))[0];
      if (dept === 'sales') { const ms = S.markets.filter((m) => m.entered); B.UI.hireMarket = ms[Math.floor(br() * ms.length)].id; }
      A.hire({ dept }); hires++;
    }
    // Markets
    const avail = S.markets.filter((m) => !m.entered).sort((a, b) => b.size * b.growth * b.arpu - a.size * a.growth * a.arpu);
    if (S.turn > 4 && avail[0] && S.cash > avail[0].entry * 8 && H.runwayMonths() > 18) A['enter-market']({ id: String(avail[0].id) });
    if (S.turn > 8 && br() < 0.05 && S.cash > 2e6) { A.scout(); counts.scouts++; }
    // Product
    if (S.product.points >= H.shipCost()) A.ship();
    // Events
    S.events.slice().forEach((ev) => {
      if (ev.type === 'overlooked') { counts.overlooked++; br() < 0.6 ? A.bonus({ id: String(ev.empId) }) : A.clap({ id: String(ev.empId) }); }
      if (ev.type === 'transfer') { counts.requests++; br() < 0.6 ? A['approve-request']({ id: String(ev.empId) }) : A['decline-request']({ id: String(ev.empId) }); }
    });
    // People: recognize at-risk strong people, fire chronic underperformers, random moves
    S.employees.slice().forEach((e) => {
      if (!e.revealed) return;
      if ((e.tier === 'star' || e.tier === 'strong') && H.flightRisk(e) >= 30 && br() < 0.6) { if (S.cash > 500000 && S.turn >= e.bonusReadyTurn) A.bonus({ id: String(e.id) }); else A.clap({ id: String(e.id) }); }
      if (e.tier === 'under' && S.turn - e.hiredTurn > 4 && br() < 0.3) { A.fire({ id: String(e.id) }); A.fire({ id: String(e.id) }); }
    });
    if (br() < 0.15 && S.employees.length > 3) {
      const e = S.employees[Math.floor(br() * S.employees.length)];
      const sel = (B.UI.tab = 'team', B.render(), document.querySelector(`select[data-change="transfer-select"][data-id="${e.id}"]`));
      if (sel && sel.options.length > 1) {
        sel.value = sel.options[1 + Math.floor(br() * (sel.options.length - 1))].value; sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (click(`[data-act="transfer-confirm"][data-id="${e.id}"]`)) counts.transfers++;
      }
    }
    const reps = S.employees.filter((e) => e.dept === 'sales' && e.revealed);
    if (reps.length && br() < 0.12 && S.markets.filter((m) => m.entered).length > 1) {
      const e = reps[Math.floor(br() * reps.length)];
      B.UI.tab = 'team'; B.render();
      const sel = document.querySelector(`select[data-change="market-select"][data-id="${e.id}"]`);
      const other = [...sel.options].find((o) => +o.value !== e.market);
      if (other) { sel.value = other.value; sel.dispatchEvent(new Event('change', { bubbles: true })); if (click(`[data-act="market-confirm"][data-id="${e.id}"]`)) counts.reassigns++; }
    }
  };

  let lastNames = [];
  while (B.S && !B.S.gameOver && B.UI.screen === 'game') {
    const S = B.S;
    handleModals();
    if (S.gameOver) break;
    playTurn();
    handleModals();
    if (S.gameOver) break;
    // Render a tab (all of them periodically) to exercise the UI against live state
    const tabs = S.turn % 8 === 0 ? TABS : [TABS[S.turn % TABS.length]];
    tabs.forEach((t) => { B.UI.tab = t; B.render(); });
    B.UI.tipsOpen = true; B.render(); B.UI.tipsOpen = false;
    checkAdvanceLock();
    // Advance through the real button, checking the P&L and cash reconcile
    const cashBefore = S.cash, oneTimeBefore = S.qOneTime;
    if (!click('#advance-btn')) { fail('no advance button'); break; }
    if (S.history.length < 2) { fail('quarter did not advance'); break; }
    const L = S.last;
    if (!near(L.net, L.gp - L.payroll - L.overhead - L.marketing)) fail('net income does not reconcile');
    if (!near(L.oneTime, oneTimeBefore)) fail('one-time spend mismatch');
    if (!B.S.gameOver || B.S.gameOver.kind !== 'acquired') {
      const expected = cashBefore + L.net + (B.S.bridgeUsed && !lastNames.bridge ? 0 : 0);
      if (!B.S.modalQueue.some((m) => m.type === 'bridge') && !near(B.S.cash, expected, 1e-6)) fail(`cash ${B.S.cash} != ${expected}`);
    }
    if (B.S.gameOver) break;
    checkNumbers();
    checkMarketsDom();
    // Name repetition window
    const names = S.employees.map((e) => e.name);
    if (new Set(names).size !== names.length) fail('duplicate employee names on the team');
  }
  // Game over checks: report shown, modals cleared, scrolled to top
  const S = B.S;
  if (!S.gameOver) fail('game did not end');
  if (B.UI.screen !== 'report' || !document.querySelector('.report')) fail('report screen not shown');
  if (document.querySelector('#modal-root .modal')) fail('modal left in DOM after game over');
  if (window.scrollY !== 0) fail('report not scrolled to top');
  const recent = S.usedNames.slice(-25); const firsts = recent.map((n) => n.split(' ')[0]);
  if (S.usedNames.length >= 25 && new Set(firsts).size < 22) fail('first names repeat within 25 hires');
  return {
    problems, counts, outcome: S.gameOver && S.gameOver.kind, turn: S.turn, total: S.totalTurns,
    valuation: S.gameOver.kind === 'acquired' ? S.gameOver.offer : S.gameOver.kind === 'ipo' ? S.gameOver.ipoVal : S.valuation,
    arr: H.currentARR(), peakARR: S.stats.peakARR, head: S.employees.length, rounds: S.funding.raised.length, markets: S.markets.filter((m) => m.entered).length,
    level: S.product.level, recessions: S.recessions.filter((r) => r.announced).length, founder: S.founderOwnership, toRival: S.stats.toRival, calcified: S.stats.calcified,
  };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(FILE);

  const inds = ['saas', 'fintech', 'consumer', 'ecommerce', 'hardware'];
  const difs = ['beginner', 'standard'];
  const hors = [5, 10, 15, 20, 30];
  const results = [];
  let failures = 0;
  for (const industry of inds) for (const difficulty of difs) for (const horizon of hors) for (let s = 0; s < SEEDS; s++) {
    const seed = 1000 + s * 97 + hors.indexOf(horizon) * 7 + inds.indexOf(industry) * 31 + difs.indexOf(difficulty) * 3;
    const before = errors.length;
    let res;
    try { res = await page.evaluate(botGame, { industry, difficulty, horizon, seed, acceptAcq: s % 2 === 1 }); }
    catch (e) { res = { problems: ['evaluate threw: ' + e.message.split('\n')[0]] }; }
    const errs = errors.slice(before);
    const bad = (res.problems || []).length + errs.length;
    if (bad) failures++;
    results.push({ industry, difficulty, horizon, seed, ...res, errors: errs });
    const v = res.valuation != null ? '$' + (res.valuation / 1e6).toFixed(1) + 'M' : '?';
    console.log(`${bad ? 'FAIL' : 'ok  '} ${industry.padEnd(9)} ${difficulty.padEnd(8)} ${String(horizon).padStart(2)}y seed ${seed}: ${String(res.outcome).padEnd(8)} T${res.turn}/${res.total} val ${v.padStart(9)} ARR $${((res.arr || 0) / 1e6).toFixed(1)}M head ${res.head} rounds ${res.rounds} mkts ${res.markets} v${res.level} own ${((res.founder || 0) * 100).toFixed(0)}%`);
    if (bad) { (res.problems || []).forEach((p) => console.log('     - ' + p)); errs.forEach((e) => console.log('     ! ' + e)); }
  }
  // Aggregate coverage: make sure each mechanic actually fired somewhere in the matrix
  const tot = {};
  results.forEach((r) => Object.entries(r.counts || {}).forEach(([k, v]) => { if (typeof v === 'number') tot[k] = (tot[k] || 0) + v; }));
  const modalTypes = {};
  results.forEach((r) => Object.entries((r.counts || {}).modalsSeen || {}).forEach(([k, v]) => { modalTypes[k] = (modalTypes[k] || 0) + v; }));
  const outcomes = {};
  results.forEach((r) => { outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1; });
  console.log('\nmechanics fired:', JSON.stringify(tot));
  console.log('modals seen:', JSON.stringify(modalTypes));
  console.log('outcomes:', JSON.stringify(outcomes));
  console.log('calcified total:', results.reduce((a, r) => a + (r.calcified || 0), 0), ' to rival:', results.reduce((a, r) => a + (r.toRival || 0), 0));
  for (const k of ['negotiations', 'retains', 'transfers', 'reassigns', 'overlooked', 'requests', 'acqOffers', 'scouts']) if (!tot[k]) { console.log('MECHANIC NEVER FIRED: ' + k); failures++; }
  await browser.close();
  console.log(failures ? `\n${failures} failing run(s)` : `\nall ${results.length} runs passed`);
  process.exit(failures ? 1 : 0);
})();
