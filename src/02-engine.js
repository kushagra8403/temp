/* =====================================================================
   Engine: state, quarter resolution, employees, markets, funding
   ===================================================================== */
let S = null; // the whole game state lives here

const IND = () => INDUSTRIES[S.industry];
const DIF = () => DIFFICULTY[S.difficulty];
const HOR = () => HORIZONS[S.horizon];

// ---------- Helpers on state ----------
const homeMarket = () => S.markets.find((m) => m.home);
const enteredMarkets = () => S.markets.filter((m) => m.entered);
const marketById = (id) => S.markets.find((m) => m.id === id);
const empById = (id) => S.employees.find((e) => e.id === id);
const totalCustomers = () => sum(enteredMarkets(), (m) => m.customers);
const totalRevenue = () => sum(enteredMarkets(), (m) => m.revenue);
const currentARR = () => totalRevenue() * 4;
const yearOf = (turn) => Math.floor(turn / 4) + 1;
const quarterOf = (turn) => (turn % 4) + 1;
const wageIndex = () => 1 + 0.015 * Math.floor(S.turn / 4);
// Each release helps, with diminishing returns (but never zero).
const productArpuMult = (level = S.product.level) => 1 + 0.5 * Math.log(1 + (level - 1) / 6);
const productChurnMult = (level = S.product.level) => Math.max(0.65, Math.pow(0.965, level - 1));
const marketARPU = (m) => IND().arpu * productArpuMult() * m.arpu;
const ipoARRRequired = () => HOR().ipoARR * IND().ipoMult;
const recessionNow = (turn = S.turn) => S.recessions.find((r) => turn >= r.start && turn < r.end) || null;
const shipCost = (level = S.product.level) => Math.round(3 * Math.pow(1.2, level - 1) * IND().buildMult * 10) / 10;
const shipCash = (level = S.product.level) => Math.round(IND().shipCost * (1 + 0.25 * (level - 1)));
const isFit = (e) => SKILLS[e.skill].dept === e.dept;
const tierIdx = (t) => TIERS.indexOf(t);
const quartersSinceRecog = (e) => S.turn - e.lastRecog;
const tenure = (e) => S.turn - e.hiredTurn;
const clapBudget = () => Math.max(3, Math.ceil(S.employees.length / 5));
const scoutCost = () => Math.round(SCOUT_BASE_COST * Math.pow(1.15, S.scoutCount) / 1000) * 1000;
const hireFee = (salary) => Math.round(salary * 0.1 / 500) * 500;
const bonusCost = (e) => Math.max(2000, Math.round(e.salary * 0.08 / 500) * 500);
const severance = (e) => Math.round(e.salary * 0.15 / 500) * 500;
const marketChurnMult = (m) => clamp(1.15 - 0.15 * m.arpu, 0.95, 1.12);
// Addressable customers in a market; a better product widens it a little.
const marketTAM = (m) => IND().tam * m.size * (1 + 0.04 * (S.product.level - 1));
const penetration = (m) => m.customers / marketTAM(m);

function log(kind, text) { S.log.push({ turn: S.turn, kind, text }); }
function news(text, kind = 'info') { S.newsQueue.push({ text, kind, turn: S.turn }); log(kind, text); }
function addHistory(e, text) { e.history.push({ turn: S.turn, text }); if (e.history.length > 8) e.history.shift(); }
function spend(amount, why) { S.cash -= amount; S.qOneTime += amount; S.qOneTimeItems.push({ why, amount }); }

// ---------- Name generation (no repeats within the last ~25 hires) ----------
function genName() {
  const recentF = S.recentFirst.slice(-NAME_MEMORY), recentL = S.recentLast.slice(-NAME_MEMORY);
  let first, last;
  const onTeam = new Set(S.employees.map((e) => e.name));
  const ok = (strict) => !onTeam.has(first + ' ' + last) && !S.usedNames.slice(-NAME_MEMORY * 4).includes(first + ' ' + last) && (!strict || (!recentF.includes(first) && !recentL.includes(last)));
  let found = false;
  for (let i = 0; i < 120 && !found; i++) { first = pick(FIRST_NAMES); last = pick(LAST_NAMES); found = ok(true); }
  for (let i = 0; i < 400 && !found; i++) { first = pick(FIRST_NAMES); last = pick(LAST_NAMES); found = ok(false); }
  S.recentFirst.push(first); S.recentLast.push(last); S.usedNames.push(first + ' ' + last);
  return { first, last };
}
function genCompanyName() { return pick(COMPANY_A) + ' ' + pick(COMPANY_B); }

function rollTier(dist) {
  let r = rand(), acc = 0;
  for (let i = 0; i < TIERS.length; i++) { acc += dist[i]; if (r < acc) return TIERS[i]; }
  return 'solid';
}

// ---------- Employees ----------
function makeEmployee(dept, opts = {}) {
  const { first, last } = genName();
  const skillDept = chance(0.6) ? dept : pick(DEPT_KEYS.filter((d) => d !== dept));
  const skill = pick(DEPTS[skillDept].skills);
  const salary = Math.round(DEPTS[dept].salary * DIF().salary * rr(0.88, 1.12) * wageIndex() / 1000) * 1000;
  const e = {
    id: S.nextId++, first, last, name: `${first} ${last}`, dept, origDept: dept, skill,
    tier: rollTier(HIRE_DIST), revealed: false, hiredTurn: S.turn, deptSince: S.turn, salary,
    temp: null, lastRecog: S.turn, grievance: 0, history: [], dip: 0, lastRaiseTurn: S.turn,
    bonusReadyTurn: S.turn, clapReadyTurn: S.turn, request: null, trait: null, market: null, nativeMarket: null,
  };
  if (dept === 'sales') setupSalesRep(e, opts.market);
  addHistory(e, `Joined ${DEPTS[dept].name}${e.market != null ? ' in ' + marketById(e.market).name : ''}`);
  return e;
}
function setupSalesRep(e, marketId) {
  if (!e.trait) e.trait = chance(0.5) ? 'home' : 'global';
  const m = marketId != null && marketById(marketId) && marketById(marketId).entered ? marketId : homeMarket().id;
  e.market = m;
  if (e.nativeMarket == null) e.nativeMarket = m;
}
function traitMult(e) {
  if (e.dept !== 'sales' || e.market == null) return 1;
  const native = e.market === e.nativeMarket;
  if (e.trait === 'home') return native ? 1.25 : 0.8;
  return native ? 0.95 : 1.15;
}
function traitFitText(e, marketId) {
  const native = marketId === e.nativeMarket;
  const nm = marketById(e.nativeMarket).name;
  if (e.trait === 'home') return native ? { ok: true, text: `Back on home turf in ${nm}. This fits them.` } : { ok: false, text: `A gamble. Home-turf experts tend to struggle away from ${nm}.` };
  return native ? { ok: false, text: `Fine, but globally-minded reps get restless at home.` } : { ok: true, text: `Fits their trait. Globally-minded reps do their best work somewhere new.` };
}

function empOutput(e) {
  let m = TIER_INFO[e.tier].mult;
  if (e.temp) m *= TEMP_INFO[e.temp.type].mult;
  if (isFit(e)) m *= SKILL_FIT_MULT;
  if (S.turn === e.hiredTurn) m *= 0.5; // onboarding quarter
  if (e.dip > 0) m *= 0.75;            // settling after a move
  m *= traitMult(e);
  return m;
}

function flightRisk(e) {
  if (tenure(e) < 2) return 3;
  const since = quartersSinceRecog(e);
  let r = 5 + Math.min(27, Math.max(0, since - 2) * 3);
  r += { star: 14, strong: 7, solid: 2, struggling: 0, under: -2 }[e.tier];
  if (e.temp && e.temp.type === 'rough') r += 8;
  if (e.temp && e.temp.type === 'motivated') r -= 12;
  if (e.temp && e.temp.type === 'hot') r -= 4;
  r += e.grievance;
  if (S.turn - e.lastRaiseTurn > 12) r += 5;
  return clamp(Math.round(r), 0, 95);
}
const riskLabel = (r) => (r >= 35 ? 'High' : r >= 20 ? 'Watch' : 'Low');

function hire(dept, marketId) {
  const e = makeEmployee(dept, { market: marketId });
  spend(hireFee(e.salary), `Recruiting ${e.name}`);
  S.employees.push(e);
  S.stats.hires++;
  news(`${e.name} joins ${DEPTS[dept].name}${e.market != null ? ' covering ' + marketById(e.market).name : ''}. Tier unknown until their first quarter is in.`, 'hire');
  return e;
}

function removeEmployee(e, how) {
  S.employees = S.employees.filter((x) => x.id !== e.id);
  S.events = S.events.filter((ev) => ev.empId !== e.id);
  S.former.push({ name: e.name, tier: e.tier, dept: e.dept, how, turn: S.turn });
  // A strong ex-employee may land at the rival, which makes them tougher to compete with.
  if ((e.tier === 'star' || e.tier === 'strong') && chance(e.tier === 'star' ? 0.55 : 0.4)) {
    const bump = e.tier === 'star' ? 0.04 : 0.025;
    S.rival.strength = Math.min(0.25, S.rival.strength + bump);
    S.rival.alumni.push(e.name);
    S.stats.toRival++;
    news(`${e.name} has signed with ${S.rival.name}. Expect them to be a little harder to beat.`, 'rival');
    S.rival.pending.push({ turn: S.turn + ri(2, 5), name: e.name, dept: e.dept });
  }
}

function fire(e) {
  spend(severance(e), `Severance for ${e.name}`);
  S.stats.fires++;
  const label = e.revealed ? TIER_INFO[e.tier].label.toLowerCase() : 'unproven';
  news(`${e.name} (${label}, ${DEPTS[e.dept].name}) has been let go.`, 'depart');
  removeEmployee(e, 'fired');
  S.employees.forEach((x) => { x.grievance = Math.min(20, x.grievance + 2); });
}

function giveBonus(e) {
  const cost = bonusCost(e);
  spend(cost, `Bonus for ${e.name}`);
  e.bonusReadyTurn = S.turn + 2;
  e.lastRecog = S.turn;
  e.grievance = Math.max(0, e.grievance - 6);
  S.stats.bonuses++;
  S.events = S.events.filter((ev) => !(ev.type === 'overlooked' && ev.empId === e.id));
  let msg;
  if (e.temp && e.temp.type === 'rough') {
    if (chance(0.7)) { e.temp = { type: 'motivated', left: 2, reason: 'bonus' }; msg = `${e.first} is out of the rough patch. The bonus landed. Motivated for 2 quarters.`; addHistory(e, 'Bonus pulled them out of a rough patch'); }
    else { msg = `${e.first} appreciated it, but the rough patch hasn't lifted yet.`; addHistory(e, 'Bonus during a rough patch'); }
  } else if (e.temp && e.temp.type === 'hot') {
    e.temp.left += 1; msg = `${e.first} is riding high. The hot streak runs a quarter longer.`; addHistory(e, 'Bonus extended a hot streak');
  } else {
    e.temp = { type: 'motivated', left: 2, reason: 'bonus' }; msg = `${e.first} felt genuinely valued. Motivated for 2 quarters.`; addHistory(e, 'Received a bonus');
  }
  return msg;
}

function giveClap(e) {
  if (S.clapsUsed >= clapBudget()) return null;
  S.clapsUsed++;
  e.clapReadyTurn = S.turn + 3;
  e.lastRecog = S.turn;
  e.grievance = Math.max(0, e.grievance - 2);
  S.stats.claps++;
  S.events = S.events.filter((ev) => !(ev.type === 'overlooked' && ev.empId === e.id));
  let msg;
  if (e.temp && e.temp.type === 'rough') {
    if (chance(0.3)) { e.temp = { type: 'motivated', left: 1, reason: 'clap' }; msg = `A public thank-you was exactly what ${e.first} needed. Rough patch over.`; addHistory(e, 'Public praise lifted a rough patch'); }
    else { msg = `${e.first} smiled, but it'll take more than applause to turn this around.`; addHistory(e, 'Applauded during a rough patch'); }
  } else if (!e.temp && chance(0.4)) {
    e.temp = { type: 'motivated', left: 1, reason: 'clap' }; msg = `${e.first} lit up. Motivated for a quarter.`; addHistory(e, 'Applauded at all-hands');
  } else { msg = `${e.first} appreciated the shout-out.`; addHistory(e, 'Applauded at all-hands'); }
  return msg;
}

// Transfer: a real gamble with a fresh performance roll, hidden until next quarter.
function transferOdds(e, dept) {
  const fit = SKILLS[e.skill].dept === dept;
  const dist = fit ? [0.18, 0.30, 0.34, 0.12, 0.06] : [0.08, 0.20, 0.40, 0.20, 0.12];
  const keep = tierIdx(e.tier) <= 2 ? 1 : 0;
  const good = 0.4 * keep + 0.6 * (dist[0] + dist[1] + dist[2]);
  return { fit, dist, good };
}
function transfer(e, dept, initiatedBy = 'you') {
  if (dept === e.dept) return;
  const { dist } = transferOdds(e, dept);
  const from = e.dept;
  e.prevTier = e.tier;
  if (!chance(0.4)) e.tier = rollTier(dist);
  e.dept = dept; e.deptSince = S.turn; e.revealed = false; e.dip = 1;
  if (e.temp && e.temp.type !== 'motivated') e.temp = null;
  if (dept === 'sales') setupSalesRep(e, homeMarket().id); else e.market = null;
  e.request = null;
  S.events = S.events.filter((ev) => !(ev.type === 'transfer' && ev.empId === e.id));
  S.stats.transfers++;
  addHistory(e, `Transferred ${DEPTS[from].short} → ${DEPTS[dept].short}${initiatedBy === 'request' ? ' (their request)' : ''}`);
  news(`${e.name} moves from ${DEPTS[from].name} to ${DEPTS[dept].name}. We'll know next quarter whether it suits them.`, 'team');
}
function reassignMarket(e, marketId) {
  if (e.dept !== 'sales' || marketId === e.market) return null;
  const fit = traitFitText(e, marketId);
  e.market = marketId; e.dip = 1;
  addHistory(e, `Reassigned to ${marketById(marketId).name}`);
  S.stats.reassigns++;
  return fit;
}

// ---------- Markets ----------
function makeMarket(def, idx) {
  return {
    id: idx, name: def.name, size: def.size, growth: def.growth, arpu: def.arpu, entry: def.entry, overhead: def.overhead,
    home: !!def.home, scouted: !!def.scouted, entered: !!def.home, enteredTurn: def.home ? 0 : null,
    customers: 0, revenue: 0, newCust: 0, churned: 0, lastSpend: 0, hist: [], profitHist: [],
  };
}
function marketRamp(m) {
  const q = S.turn - m.enteredTurn;
  return q <= 0 ? 0.5 : q === 1 ? 0.8 : 1;
}
function enterMarket(m) {
  if (m.entered) return;
  spend(m.entry, `Entering ${m.name}`);
  m.entered = true; m.enteredTurn = S.turn;
  S.stats.marketsEntered++;
  news(`${S.company} opens for business in ${m.name}. Local partners are lined up and the first ads go live this quarter.`, 'market');
}
function scoutMarket() {
  const cost = scoutCost();
  spend(cost, 'Scouting a new market');
  S.scoutCount++;
  let name;
  for (let i = 0; i < 60; i++) { name = `The ${pick(SCOUT_ADJ)} ${pick(SCOUT_NOUN)}`; if (!S.markets.some((m) => m.name === name)) break; }
  if (S.markets.some((m) => m.name === name)) name = `${name} ${S.scoutCount + 1}`;
  const t = rand(); // 0 = frontier, 1 = mature
  const arpu = Math.round((0.25 + 0.85 * t) * 100) / 100;
  const growth = Math.round(clamp(1.75 - 0.95 * t + rr(-0.1, 0.1), 0.6, 1.85) * 100) / 100;
  const size = Math.round(rr(0.15, 0.7) * 100) / 100;
  const def = {
    name, size, growth, arpu, scouted: true,
    entry: Math.round((40000 + 160000 * arpu * size + rr(0, 30000)) / 5000) * 5000,
    overhead: Math.round((5000 + 15000 * arpu * (0.6 + size)) / 500) * 500,
  };
  const m = makeMarket(def, S.markets.length);
  S.markets.push(m);
  news(`Scouts report back on ${name}: ${t < 0.4 ? 'a frontier market, cheap to win and quick to grow, with low prices' : t < 0.7 ? 'a balanced market with fair prices and steady demand' : 'a mature market where customers pay well but growth is slow'}.`, 'market');
  return m;
}
function marketStatus(m) {
  if (!m.entered) return null;
  if (S.turn - m.enteredTurn < 3) return { key: 'new', label: 'Ramping up' };
  const recent = m.profitHist.slice(-3);
  if (recent.length >= 3 && recent.every((p) => p < 0)) return { key: 'bad', label: 'Struggling' };
  const h = m.hist; const g = h.length >= 3 ? h[h.length - 1] / Math.max(1, h[h.length - 3]) - 1 : 0;
  if (g > 0.15) return { key: 'good', label: 'Thriving' };
  return { key: 'ok', label: 'Steady' };
}

// ---------- Financial projections ----------
function payrollQ() { return sum(S.employees, (e) => e.salary) / 4; }
function opsStrain() {
  const ops = S.employees.filter((e) => e.dept === 'ops');
  const opsOut = sum(ops, (e) => TIER_INFO[e.tier].mult);
  const nonOps = S.employees.length - ops.length;
  const ratio = nonOps / (opsOut * 8 + 6);
  return clamp(1 + 0.15 * (ratio - 1), 1, 1.5);
}
function overheadQ() {
  const base = 18000 + 5000 * S.employees.length + sum(enteredMarkets(), (m) => m.overhead) + IND().compliance;
  return base * DIF().overhead * opsStrain() * wageIndex();
}
function projectedNet() {
  const rev = sum(enteredMarkets(), (m) => m.customers * marketARPU(m) * 3);
  const gp = rev * IND().margin;
  return gp - payrollQ() - overheadQ() - S.marketingSpend;
}
function runwayMonths() {
  const net = projectedNet();
  if (net >= 0) return Infinity;
  return Math.max(0, S.cash) / (-net / 3);
}

// ---------- Valuation ----------
function arrGrowthYoY() {
  const h = S.history; const now = currentARR();
  const prior = h.length >= 4 ? h[h.length - 4].arr : 0;
  if (prior < 50000) return now > 0 ? 1 : 0;
  return clamp(now / prior - 1, -0.5, 3);
}
function computeValuation() {
  const ind = IND(); const arr = currentARR(); const rec = recessionNow();
  const g = arrGrowthYoY();
  const gf = clamp(0.6 + 0.5 * g, 0.4, 1.6);
  const pf = Math.min(1.5, 1 + 0.025 * (S.product.level - 1));
  const recF = rec ? 1 - 0.4 * rec.sev : 1;
  const revVal = arr * ind.multiple * gf * pf * S.sentiment * recF;
  const fallback = 1.5e6 + Math.max(0, S.cash) + S.product.level * 350000 + S.employees.length * 60000;
  const fade = clamp(1 - arr / 3e6, 0, 1);
  return Math.max(revVal, fallback * fade, Math.max(0, S.cash) * 0.8, 250000);
}

// ---------- Funding ----------
function roundUnlockTurn(r) {
  if (r.key === 'seed') return r.t5;
  const t = Math.round(r.t5 * Math.pow(S.totalTurns / 20, 0.6));
  return r.key === 'a' ? Math.min(t, 8) : t;
}
function roundARRNeed(r) { return r.arrAbs != null ? r.arrAbs : r.arrFrac * HOR().ipoARR * Math.min(IND().ipoMult, 1.3); }
function roundStatus() {
  const r = ROUNDS[S.funding.next];
  if (!r) return { state: 'done' };
  const unlock = roundUnlockTurn(r), need = roundARRNeed(r);
  if (S.turn < unlock) return { state: 'locked', r, why: `Opens in Year ${yearOf(unlock)}, Q${quarterOf(unlock)}`, unlock, need };
  if (currentARR() < need) return { state: 'locked', r, why: `Needs ${fmtMoney(need)} ARR`, unlock, need };
  if (S.turn < S.funding.cooldownUntil) return { state: 'cooldown', r, why: `Investors will take meetings again in ${S.funding.cooldownUntil - S.turn} quarter${S.funding.cooldownUntil - S.turn > 1 ? 's' : ''}`, unlock, need };
  return { state: 'open', r, unlock, need };
}
function fundingTerms(r) {
  const scale = r.key === 'seed' || r.key === 'a' ? 1 : HOR().ipoARR / 100e6;
  const preBasis = Math.max(r.floor * IND().floorMult * scale, computeValuation() * 1.1);
  const mid = (r.eq[0] + r.eq[1]) / 2;
  const fair = clamp(mid / S.sentiment, r.eq[0], r.eq[1]);
  const baseCheck = preBasis * fair / (1 - fair);
  return { preBasis, fair, baseCheck, min: r.eq[0] * 0.5, max: Math.min(0.4, r.eq[1] * 1.3) };
}
function fundingQuote(terms, eq) {
  const cash = terms.baseCheck * Math.sqrt(eq / terms.fair);
  const post = cash / eq;
  return { eq, cash, post, pre: post - cash, ownerAfter: S.founderOwnership * (1 - eq) };
}
function closeRound(r, eq, cash) {
  const investor = pick(INVESTORS[r.key]);
  S.cash += cash;
  S.founderOwnership *= 1 - eq;
  S.capTable.forEach((h) => { h.pct *= 1 - eq; });
  S.capTable.push({ name: `${investor} (${r.name})`, pct: eq });
  S.funding.raised.push({ key: r.key, name: r.name, eq, cash, post: cash / eq, turn: S.turn, investor });
  S.funding.next++;
  S.funding.cooldownUntil = S.turn + HOR().roundGap;
  S.stats.raised += cash;
  S.sentiment = clamp(S.sentiment + 0.03, 0.6, 1.4);
  news(`${S.company} closes a ${fmtMoney(cash)} ${r.name} led by ${investor}, at a ${fmtMoney(cash / eq)} post-money valuation.`, 'funding');
}
function walkAwayFromRound() {
  S.funding.cooldownUntil = S.turn + 2;
  S.sentiment = clamp(S.sentiment - 0.04, 0.6, 1.4);
  S.stats.walkedAway++;
}

function ipoStatus() {
  const need = ipoARRRequired();
  const minTurn = Math.round(S.totalTurns * 0.3);
  const checks = [
    { ok: currentARR() >= need, text: `ARR of at least ${fmtMoney(need)}`, now: fmtMoney(currentARR()) },
    { ok: S.turn >= minTurn, text: `At least ${Math.round(minTurn / 4)} years of operating history`, now: `${(S.turn / 4).toFixed(1)} years` },
    { ok: S.funding.raised.length >= 2, text: 'Institutional backing (Series A or later)', now: `${S.funding.raised.length} rounds raised` },
    { ok: arrGrowthYoY() > 0.1, text: 'Growing more than 10% a year', now: `${Math.round(arrGrowthYoY() * 100)}% YoY` },
  ];
  return { ok: checks.every((c) => c.ok), checks, need };
}

// ---------- Recessions ----------
function scheduleRecessions() {
  const list = HOR().recessions; const n = list.length; const seg = S.totalTurns / n;
  S.recessions = list.map((r, i) => {
    const start = Math.max(6, Math.round(seg * i + rr(0.3, 0.7) * seg));
    const dur = Math.round(rr(3, 4 + 2 * r.sev));
    return { start, end: Math.min(S.totalTurns, start + dur), sev: r.sev, announced: false, ended: false };
  });
}

// ---------- New game ----------
function newGame(opts) {
  if (opts.seed != null) setSeed(opts.seed);
  const h = HORIZONS[opts.horizon];
  S = {
    company: (opts.company || '').trim() || 'Untitled Co.', industry: opts.industry, difficulty: opts.difficulty, horizon: opts.horizon,
    turn: 0, totalTurns: h.turns, cash: DIFFICULTY[opts.difficulty].cash, marketingSpend: 15000,
    markets: CURATED_MARKETS.map((d, i) => makeMarket(d, i)),
    employees: [], former: [], nextId: 1, recentFirst: [], recentLast: [], usedNames: [],
    product: { level: 1, points: 0, shipped: [] },
    sentiment: 1, valuation: 0, founderOwnership: 1, capTable: [],
    funding: { next: 0, raised: [], cooldownUntil: 0, announced: {} },
    rival: { name: '', strength: 0, alumni: [], pending: [] },
    recessions: [], history: [], log: [], events: [], modalQueue: [], newsQueue: [],
    qOneTime: 0, qOneTimeItems: [], last: null, scoutCount: 0, clapsUsed: 0, bridgeUsed: false,
    acqCooldownUntil: 4, gameOver: null, offersDeclined: [],
    stats: { hires: 0, fires: 0, resigned: 0, retained: 0, lostNegotiations: 0, transfers: 0, reassigns: 0, bonuses: 0, claps: 0,
      marketsEntered: 0, raised: 0, ships: 0, toRival: 0, walkedAway: 0, peakARR: 0, peakValuation: 0, calcified: 0 },
  };
  S.rival.name = `${pick(RIVAL_A)} ${pick(RIVAL_B)}`;
  scheduleRecessions();
  // Founding team: two engineers and one sales rep.
  ['eng', 'eng', 'sales'].forEach((d) => S.employees.push(makeEmployee(d)));
  S.valuation = computeValuation();
  S.history.push(snapshot());
  news(`${S.company} is open for business. Three people, ${fmtMoney(S.cash)} in the bank, and an MVP. ${S.rival.name} is already in the space.`, 'info');
  return S;
}
function snapshot() {
  return { turn: S.turn, arr: currentARR(), cash: S.cash, customers: totalCustomers(), valuation: S.valuation, revenue: totalRevenue(), net: S.last ? S.last.net : 0, head: S.employees.length };
}

// ---------- The quarter ----------
function advanceQuarter() {
  if (!S || S.gameOver || S.modalQueue.length) return false;
  const ind = IND(), dif = DIF();
  const rec = recessionNow(); const sev = rec ? rec.sev : 0;
  const level = S.product.level;

  // 1. Effective output of every person this quarter
  const outs = new Map(S.employees.map((e) => [e.id, empOutput(e)]));
  const deptOut = (d) => sum(S.employees.filter((e) => e.dept === d), (e) => outs.get(e.id));
  const engOut = deptOut('eng'), mktOut = deptOut('mkt'), opsOut = deptOut('ops');

  // 2. Customer acquisition (marketing + sales), 3. churn, 4. revenue, per market
  const entered = enteredMarkets();
  const weights = entered.map((m) => m.size * m.growth);
  const wsum = sum(weights);
  const mktTeam = Math.min(1.8, 1 + 0.12 * Math.pow(mktOut, 0.6));
  const baseCAC = ind.cac * dif.cac * Math.pow(productArpuMult(level), 0.8) * (1 + 0.45 * sev) * (1 + S.rival.strength) / mktTeam;
  const stageCap = 1 + 0.05 * (level - 1);
  const custStart = totalCustomers();
  const coverage = (opsOut * ind.supportCap + ind.supportCap * 0.6) / Math.max(1, custStart);
  const supportF = 1.2 - 0.35 * Math.min(1, coverage);
  const churnM = ind.churn * dif.churn * productChurnMult(level) * supportF * (1 + 0.3 * sev);
  let newMkt = 0, newSales = 0, churnedAll = 0;
  entered.forEach((m, i) => {
    const spendM = wsum > 0 ? S.marketingSpend * weights[i] / wsum : 0;
    const cap = 250000 * m.size * m.growth * stageCap;
    const eff = 1 / (1 + spendM / cap);
    const headroom = Math.max(0, 1 - penetration(m));
    const nm = spendM * eff * m.growth * marketRamp(m) * headroom / (baseCAC * Math.pow(m.arpu, 0.3));
    const reps = S.employees.filter((e) => e.dept === 'sales' && e.market === m.id);
    const sat = 1 / (1 + 0.05 * Math.max(0, reps.length - 1) / m.size);
    let ns = 0;
    reps.forEach((e) => { ns += headroom * ind.salesDeals * (1 - 0.3 * sev) * outs.get(e.id) * Math.sqrt(m.growth) * marketRamp(m) * sat; });
    const rate = 1 - Math.pow(1 - churnM * marketChurnMult(m), 3);
    const churned = m.customers * rate + (nm + ns) * rate * 0.5;
    m.customers = Math.max(0, m.customers + nm + ns - churned);
    m.revenue = m.customers * marketARPU(m) * 3;
    m.newCust = nm + ns; m.churned = churned; m.lastSpend = spendM;
    m.cac = nm > 0 ? spendM / nm : 0;
    m.hist.push(m.revenue); if (m.hist.length > 16) m.hist.shift();
    m.profitHist.push(m.revenue * ind.margin - m.overhead * dif.overhead - spendM - sum(reps, (e) => e.salary / 4));
    if (m.profitHist.length > 8) m.profitHist.shift();
    newMkt += nm; newSales += ns; churnedAll += churned;
  });

  // 5. P&L
  const revenue = totalRevenue();
  const cogs = revenue * (1 - ind.margin);
  const gp = revenue - cogs;
  const payroll = payrollQ();
  const overhead = overheadQ();
  const marketing = S.marketingSpend;
  const net = gp - payroll - overhead - marketing;
  S.cash += net;
  S.last = { revenue, cogs, gp, payroll, overhead, marketing, net, oneTime: S.qOneTime, oneTimeItems: S.qOneTimeItems.slice(),
    newMkt, newSales, churned: churnedAll, churnRate: churnM, supportF, coverage, cac: newMkt > 0 ? marketing / newMkt : 0,
    engOut, mktOut, opsOut, strain: opsStrain() };
  S.qOneTime = 0; S.qOneTimeItems = [];

  // 6. Product progress
  S.product.points += engOut + 0.3;

  // 7. Sentiment & valuation
  S.sentiment = clamp(S.sentiment + rr(-0.07, 0.07) + (1 - S.sentiment) * 0.15 - sev * 0.04, 0.6, 1.4);
  S.valuation = computeValuation();
  S.stats.peakARR = Math.max(S.stats.peakARR, currentARR());
  S.stats.peakValuation = Math.max(S.stats.peakValuation, S.valuation);

  // 8. People
  // Unanswered transfer requests lapse; overlooked cards stay while the rough patch lasts.
  S.events = S.events.filter((ev) => { const e = empById(ev.empId); return ev.type === 'overlooked' && e && e.temp && e.temp.reason === 'feeling overlooked'; });
  S.employees.forEach((e) => { if (e.request) { e.request = null; e.grievance = Math.min(20, e.grievance + 4); addHistory(e, 'Transfer request went unanswered'); } });
  employeesQuarter();

  // 9. The world
  S.turn++;
  S.clapsUsed = 0;
  worldQuarter();
  S.history.push(snapshot());

  // 10. End conditions
  if (S.cash < 0) {
    if (S.turn >= S.totalTurns || S.bridgeUsed) { endGame('bankrupt'); return true; }
    S.modalQueue.unshift({ type: 'bridge' });
  } else if (S.turn >= S.totalTurns) { endGame('time'); return true; }
  return true;
}

function employeesQuarter() {
  const leaving = [];
  S.employees.forEach((e) => {
    if (e.dip > 0) e.dip--;
    e.grievance = Math.max(0, e.grievance - 1);
    // Reveal the baseline after their first quarter (or first quarter after a move)
    if (!e.revealed) {
      e.revealed = true;
      const t = TIER_INFO[e.tier].label;
      if (e.prevTier) {
        const better = tierIdx(e.tier) < tierIdx(e.prevTier), worse = tierIdx(e.tier) > tierIdx(e.prevTier);
        addHistory(e, `Settled into ${DEPTS[e.dept].short} as ${t}`);
        news(`${e.name} has settled into ${DEPTS[e.dept].name}: ${better ? 'the move unlocked something. Now ' + t + '.' : worse ? 'it hasn’t clicked. Now ' + t + '.' : 'same as before, ' + t + '.'}`, better ? 'good' : worse ? 'bad' : 'team');
        e.prevTier = null;
      } else {
        addHistory(e, `First quarter in: ${t}`);
        if (e.tier === 'star' || e.tier === 'under') news(`${e.name}'s first quarter is in. ${e.tier === 'star' ? 'A genuine Star. Keep them happy.' : 'An Underperformer, so far. Coaching or a move might help.'}`, e.tier === 'star' ? 'good' : 'bad');
      }
      return;
    }
    // Temporary states run their course; rarely they calcify into a real shift.
    if (e.temp) {
      e.temp.left--;
      if (e.temp.left <= 0) {
        const t = e.temp; e.temp = null;
        if (t.type === 'rough' && chance(CALCIFY_CHANCE) && e.tier !== 'under') {
          e.tier = TIERS[tierIdx(e.tier) + 1]; S.stats.calcified++;
          addHistory(e, `Rough patch stuck: now ${TIER_INFO[e.tier].label}`);
          news(`${e.name}'s rough patch didn't lift. It looks like a lasting change: now ${TIER_INFO[e.tier].label}.`, 'bad');
        } else if (t.type === 'hot' && chance(CALCIFY_CHANCE) && e.tier !== 'star') {
          e.tier = TIERS[tierIdx(e.tier) - 1]; S.stats.calcified++;
          addHistory(e, `Hot streak stuck: now ${TIER_INFO[e.tier].label}`);
          news(`${e.name}'s hot streak turned out to be real growth: now ${TIER_INFO[e.tier].label}.`, 'good');
        } else if (t.type !== 'motivated') addHistory(e, t.type === 'rough' ? 'Out of the rough patch' : 'Hot streak cooled off');
      }
    } else {
      const r = rand();
      const since = quartersSinceRecog(e);
      if (r < TEMP_ODDS.rough) {
        e.temp = { type: 'rough', left: ri(1, 3), reason: pick(['a hard stretch at home', 'burnout', 'a project that went sideways', 'a clash with a teammate']) };
        addHistory(e, `Rough patch (${e.temp.reason})`);
        news(`${e.name} has hit a rough patch: ${e.temp.reason}.`, 'bad');
      } else if (r < TEMP_ODDS.rough + TEMP_ODDS.hot) {
        e.temp = { type: 'hot', left: ri(1, 3), reason: pick(['in the zone', 'a breakthrough idea', 'a great new mentor']) };
        addHistory(e, `Hot streak (${e.temp.reason})`);
        news(`${e.name} is on a hot streak: ${e.temp.reason}.`, 'good');
      } else if (since >= 5 && chance(Math.min(0.25, 0.04 * (since - 4)))) {
        e.temp = { type: 'rough', left: ri(2, 3), reason: 'feeling overlooked' };
        addHistory(e, 'Rough patch: feeling overlooked');
        S.events.push({ type: 'overlooked', empId: e.id, turn: S.turn });
      }
    }
    // Resignations
    if (tenure(e) >= 2) {
      const risk = flightRisk(e);
      const p = Math.max(0, risk - 20) / 100 * 0.35;
      if (chance(p)) leaving.push(e);
    }
    // Transfer requests (biased toward the skill's department)
    if (!e.request && tenure(e) >= 3 && S.turn - e.deptSince >= 3 && chance(0.03)) {
      const skillDept = SKILLS[e.skill].dept;
      const to = skillDept !== e.dept && chance(0.65) ? skillDept : pick(DEPT_KEYS.filter((d) => d !== e.dept));
      e.request = to;
      S.events.push({ type: 'transfer', empId: e.id, to, turn: S.turn });
      addHistory(e, `Asked to move to ${DEPTS[to].short}`);
    }
  });
  let talks = 0;
  leaving.sort((a, b) => tierIdx(a.tier) - tierIdx(b.tier)).forEach((e) => {
    if (e.tier === 'star' || e.tier === 'strong') {
      if (talks++ >= 2) { e.grievance = Math.min(20, e.grievance + 2); return; }
      const dest = chance(0.45) ? S.rival.name : pick(OTHER_EMPLOYERS);
      S.modalQueue.push({ type: 'retain', empId: e.id, dest });
    } else {
      S.stats.resigned++;
      news(`${e.name} (${TIER_INFO[e.tier].label}, ${DEPTS[e.dept].name}) has resigned. ${quartersSinceRecog(e) >= 5 ? 'They said nobody noticed their work.' : 'They wanted a change of scene.'}`, 'depart');
      removeEmployee(e, 'resigned');
    }
  });
}

function retainOptions(e) {
  const since = quartersSinceRecog(e);
  const adj = (e.tier === 'star' ? -0.08 : 0) + (since > 8 ? -0.08 : 0) + (tenure(e) > 12 ? 0.05 : 0) - e.grievance / 200;
  const mk = (key, label, raise, oneTime, base) => ({ key, label, raise, oneTime, cost: Math.round(e.salary * raise / 1000) * 1000, oneTimeCost: Math.round(e.salary * oneTime / 1000) * 1000, p: clamp(base + adj, 0.05, 0.97) });
  return [mk('low', 'Lowball', 0.07, 0, 0.38), mk('fair', 'Fair', 0.15, 0, 0.66), mk('gen', 'Generous', 0.25, 0.1, 0.88)];
}
const RETAIN_YES = ['felt genuinely valued by the raise', 'realized they were not done building here', 'said the counter showed we were serious', 'talked it over at home and decided to stay'];
const RETAIN_NO = ['the new role was too exciting to pass up', 'said the offer came too late', 'felt the counter didn’t match what they bring', 'had already made up their mind'];
function resolveRetain(e, opt, dest) {
  if (opt) spend(opt.oneTimeCost, `Retention bonus for ${e.name}`);
  if (opt && chance(opt.p)) {
    e.salary += opt.cost; e.lastRaiseTurn = S.turn; e.lastRecog = S.turn; e.grievance = 0;
    if (opt.key === 'gen') e.temp = { type: 'motivated', left: 2, reason: 'retention' };
    S.stats.retained++;
    addHistory(e, `Stayed after a ${opt.label.toLowerCase()} counter (+${fmtMoney(opt.cost)}/yr)`);
    const msg = `${e.name} is staying. They ${pick(RETAIN_YES)}.`;
    news(msg, 'good');
    return { ok: true, msg };
  }
  S.stats.resigned++;
  if (opt) S.stats.lostNegotiations++;
  const msg = opt ? `${e.name} is leaving for ${dest}. ${pick(RETAIN_NO).replace(/^./, (c) => c.toUpperCase())}.` : `${e.name} is leaving for ${dest}. You didn't counter.`;
  news(msg, 'depart');
  removeEmployee(e, 'resigned');
  return { ok: false, msg };
}

function worldQuarter() {
  // Recessions start and end
  S.recessions.forEach((r) => {
    if (!r.announced && S.turn >= r.start) { r.announced = true; news(r.sev >= 0.8 ? 'A full-blown recession. Budgets are frozen, buyers are cautious, and investors want profits.' : 'The economy is wobbling. Deals take longer and customers are watching spend.', 'recession'); }
    if (r.announced && !r.ended && S.turn >= r.end) { r.ended = true; news('The downturn is over. Buyers are back and investors are taking meetings again.', 'good'); }
  });
  // Rival alumni news
  S.rival.pending = S.rival.pending.filter((p) => {
    if (p.turn > S.turn) return true;
    if (chance(0.7)) news(pick([`${p.name} is reportedly running ${DEPTS[p.dept].name} at ${S.rival.name} now. Their last launch got good press.`, `${S.rival.name} landed a big partnership this quarter. Insiders credit ${p.name}.`, `Industry chatter says ${p.name} has made ${S.rival.name} noticeably sharper.`]), 'rival');
    else { S.rival.strength = Math.max(0, S.rival.strength - 0.01); news(`Word is ${p.name} is already restless at ${S.rival.name}. The grass wasn't greener.`, 'rival'); }
    return false;
  });
  // Funding round opens
  const fs = roundStatus();
  if (fs.state === 'open' && !S.funding.announced[fs.r.key]) { S.funding.announced[fs.r.key] = true; news(`Investors are circling. A ${fs.r.name} round is now open to you on the Funding tab.`, 'funding'); }
  // Acquisition offers
  if (S.turn >= S.acqCooldownUntil && S.turn < S.totalTurns && currentARR() > 0) {
    const p = HOR().acqRate * (currentARR() > 500000 ? 1 : 0.3);
    if (chance(p)) {
      const rec = recessionNow();
      const offer = S.valuation * rr(0.85, 1.55) * HOR().acqPremium * (rec ? 0.8 : 1);
      S.modalQueue.push({ type: 'acquisition', buyer: pick(ACQUIRERS), offer });
      S.acqCooldownUntil = S.turn + 4;
    }
  }
}

function acquisitionVerdict(offer) {
  const h = S.history; const n = Math.min(4, h.length - 1);
  let qg = 0;
  if (n > 0 && h[h.length - 1 - n].arr > 0) qg = Math.pow(h[h.length - 1].arr / h[h.length - 1 - n].arr, 1 / n) - 1;
  qg = clamp(qg, -0.1, 0.25);
  const horizon = Math.min(12, S.totalTurns - S.turn);
  const projected = S.valuation * Math.pow(1 + qg, horizon) * 0.75;
  let key, text;
  if (offer >= projected) { key = 'great'; text = `Sold at the right time. At your recent growth rate (${(qg * 100).toFixed(1)}% a quarter), the company would likely have been worth about ${fmtMoney(projected)} after risk in ${horizon} quarters. The offer beat that.`; }
  else if (offer >= projected * 0.7) { key = 'ok'; text = `A defensible exit. Staying the course pointed to roughly ${fmtMoney(projected)} after risk, so you left some upside on the table, but you also skipped the risk of getting there.`; }
  else { key = 'early'; text = `Probably early. Growth of ${(qg * 100).toFixed(1)}% a quarter pointed to roughly ${fmtMoney(projected)} within ${horizon} quarters, well above the offer.`; }
  return { key, text, projected, qg };
}

function endGame(kind, extra = {}) {
  S.gameOver = { kind, turn: S.turn, ...extra };
  S.modalQueue = [];
}

function shipProduct() {
  const cost = shipCost(), cash = shipCash();
  if (S.product.points < cost) return false;
  S.product.points -= cost;
  spend(cash, `Launching v${S.product.level + 1}`);
  const before = stageFor(S.product.level).cur.name;
  S.product.level++;
  const code = CODENAMES[(S.product.level - 2) % CODENAMES.length];
  S.product.shipped.push({ level: S.product.level, turn: S.turn, code });
  S.stats.ships++;
  const after = stageFor(S.product.level).cur.name;
  news(`v${S.product.level} "${code}" ships. Prices can rise a little and customers have fewer reasons to leave.${after !== before ? ` The product is now ${after}.` : ''}`, 'product');
  return true;
}
