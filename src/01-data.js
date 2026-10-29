'use strict';
/* =====================================================================
   Build a Billion-Dollar Company — data tables
   ===================================================================== */

// ---------- Seedable RNG (mulberry32) so test runs are reproducible ----------
let _seed = (Date.now() ^ 0x5f3759df) >>> 0;
function setSeed(s) { _seed = s >>> 0; }
function rand() {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + rand() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

// ---------- Industries ----------
// arpu is monthly revenue per customer; churn is monthly; cac in dollars.
const INDUSTRIES = {
  saas: {
    name: 'SaaS', unit: 'accounts', blurb: 'Subscription software for teams. Sticky customers and rich margins, but every account is earned.',
    margin: 0.80, arpu: 120, churn: 0.025, cac: 900, multiple: 10, buildMult: 1.0, shipCost: 12000,
    salesDeals: 18, supportCap: 1400, compliance: 0, ipoMult: 1.0, floorMult: 1.0, tam: 25000,
    advisor: { kind: 'penguin', name: 'Pim', role: 'a very cool penguin' },
    news: { kind: 'owl', name: 'Hollis', role: 'the night-desk owl' },
  },
  fintech: {
    name: 'Fintech', unit: 'accounts', blurb: 'Money moves. Customers rarely leave once they trust you, but regulators cost real money every quarter.',
    margin: 0.66, arpu: 95, churn: 0.018, cac: 950, multiple: 9, buildMult: 1.25, shipCost: 18000,
    salesDeals: 15, supportCap: 1200, compliance: 9000, ipoMult: 1.1, floorMult: 0.95, tam: 30000,
    advisor: { kind: 'fox', name: 'Vesper', role: 'a sharp-eyed fox' },
    news: { kind: 'eagle', name: 'Aldous', role: 'the markets eagle' },
  },
  consumer: {
    name: 'Consumer App', unit: 'users', blurb: 'A phone in every pocket. Cheap to acquire, cheap to lose. Volume and product polish are everything.',
    margin: 0.86, arpu: 7, churn: 0.06, cac: 30, multiple: 6, buildMult: 0.85, shipCost: 10000,
    salesDeals: 600, supportCap: 60000, compliance: 0, ipoMult: 1.3, floorMult: 0.9, tam: 1000000,
    advisor: { kind: 'rabbit', name: 'Juniper', role: 'a very fast rabbit' },
    news: { kind: 'parrot', name: 'Pepper', role: 'the gossip parrot' },
  },
  ecommerce: {
    name: 'E-commerce', unit: 'shoppers', blurb: 'Boxes on doorsteps. Thin margins and fickle shoppers, but enormous volume if logistics keep up.',
    margin: 0.32, arpu: 58, churn: 0.085, cac: 85, multiple: 2.6, buildMult: 0.9, shipCost: 9000,
    salesDeals: 280, supportCap: 9000, compliance: 0, ipoMult: 2.2, floorMult: 0.7, tam: 140000,
    advisor: { kind: 'bee', name: 'Bramble', role: 'a busy bee' },
    news: { kind: 'squirrel', name: 'Nutmeg', role: 'the stockroom squirrel' },
  },
  hardware: {
    name: 'Hardware', unit: 'customers', blurb: 'Things you can drop on your foot. High order values and loyal buyers, slow and costly build cycles.',
    margin: 0.42, arpu: 260, churn: 0.014, cac: 1300, multiple: 4.5, buildMult: 1.8, shipCost: 22000,
    salesDeals: 9, supportCap: 900, compliance: 4000, ipoMult: 1.6, floorMult: 0.8, tam: 9000,
    advisor: { kind: 'robot', name: 'Bolt', role: 'a sturdy robot' },
    news: { kind: 'dish', name: 'Relay', role: 'the satellite dish' },
  },
};

const DIFFICULTY = {
  beginner: { name: 'Beginner', blurb: 'More cash, kinder customers, cheaper people.', cash: 1100000, cac: 0.85, churn: 0.85, salary: 0.85, overhead: 0.8 },
  standard: { name: 'Standard', blurb: 'The real thing. Every hire has to pull weight.', cash: 850000, cac: 1.1, churn: 1.1, salary: 1.0, overhead: 1.0 },
};

// Each horizon is a different kind of game: pace of rounds, size of the IPO bar,
// how often buyers call, and how many downturns you must live through.
const HORIZONS = {
  5:  { turns: 20,  ipoARR: 20e6,  label: 'Sprint',   acqRate: 0.11,  acqPremium: 1.15, roundGap: 2, recessions: [{ sev: 0.5 }],
        blurb: 'Five years. Raise early, grow hot, and find a buyer. An IPO is a long shot; a great acquisition is a real win.' },
  10: { turns: 40,  ipoARR: 50e6,  label: 'Run',      acqRate: 0.075, acqPremium: 1.05, roundGap: 3, recessions: [{ sev: 0.8 }],
        blurb: 'Ten years. Enough time for a Series C and a credible IPO if growth compounds. One real downturn.' },
  15: { turns: 60,  ipoARR: 75e6,  label: 'Climb',    acqRate: 0.06,  acqPremium: 1.0,  roundGap: 3, recessions: [{ sev: 0.6 }, { sev: 0.9 }],
        blurb: 'Fifteen years. Two downturns, a full funding ladder, and a team that turns over more than once.' },
  20: { turns: 80,  ipoARR: 100e6, label: 'Long Game', acqRate: 0.05,  acqPremium: 1.0,  roundGap: 4, recessions: [{ sev: 0.7 }, { sev: 1.0 }],
        blurb: 'Twenty years. The classic arc to a $100M ARR public company, with patience for slow-burn bets.' },
  30: { turns: 120, ipoARR: 150e6, label: 'Dynasty',  acqRate: 0.045, acqPremium: 0.95, roundGap: 4, recessions: [{ sev: 0.6 }, { sev: 1.0 }, { sev: 0.8 }],
        blurb: 'Thirty years. Three downturns and generations of employees. Build an institution, not a flip.' },
};

// Funding ladder. t5 is the unlock quarter in a 5-year game; longer games stretch it
// (roughly with horizon^0.6) and the later rounds' ARR bars scale with the horizon's IPO bar.
const ROUNDS = [
  { key: 'seed', name: 'Seed',     t5: 1,  arrAbs: 0,      eq: [0.10, 0.20], floor: 8e6 },
  { key: 'a',    name: 'Series A', t5: 3,  arrAbs: 400000, eq: [0.15, 0.25], floor: 22e6 },
  { key: 'b',    name: 'Series B', t5: 7,  arrFrac: 0.030, eq: [0.12, 0.22], floor: 70e6 },
  { key: 'c',    name: 'Series C', t5: 10, arrFrac: 0.120, eq: [0.10, 0.18], floor: 200e6 },
  { key: 'd',    name: 'Series D', t5: 13, arrFrac: 0.280, eq: [0.08, 0.15], floor: 450e6 },
  { key: 'e',    name: 'Series E', t5: 15, arrFrac: 0.500, eq: [0.05, 0.12], floor: 900e6 },
];

const INVESTORS = {
  seed: ['Lantern Angels', 'Small Hours Capital', 'First Light Fund', 'Kettle Ventures'],
  a: ['Meridian Partners', 'Northbound Ventures', 'Halyard Capital', 'Common Room VC'],
  b: ['Atlas Growth', 'Bellwether Partners', 'Greystone Ventures', 'Tidewater Capital'],
  c: ['Summit Crossover', 'Corvid Capital', 'Kingfisher Growth', 'Orchard Hill'],
  d: ['Sovereign Lane', 'Pinnacle Fund IV', 'Ironbridge Partners', 'Cobalt Growth'],
  e: ['Harbor Crossover', 'Lighthouse Pre-IPO', 'Monarch Capital', 'Evergreen Global'],
};

// ---------- Departments & skills (two skills per department) ----------
const DEPTS = {
  eng:   { name: 'Engineering', short: 'Eng',   salary: 125000, skills: ['Technical Builder', 'Rapid Prototyper'] },
  sales: { name: 'Sales',       short: 'Sales', salary: 85000,  skills: ['Deal Closer', 'Relationship Builder'] },
  mkt:   { name: 'Marketing',   short: 'Mktg',  salary: 95000,  skills: ['Storyteller', 'Growth Analyst'] },
  ops:   { name: 'Operations',  short: 'Ops',   salary: 78000,  skills: ['Systems Operator', 'Customer Champion'] },
};
const DEPT_KEYS = Object.keys(DEPTS);
const SKILLS = {
  'Technical Builder':    { dept: 'eng',   note: 'ships solid code fast' },
  'Rapid Prototyper':     { dept: 'eng',   note: 'turns ideas into demos overnight' },
  'Deal Closer':          { dept: 'sales', note: 'gets signatures on paper' },
  'Relationship Builder': { dept: 'sales', note: 'customers ask for them by name' },
  'Storyteller':          { dept: 'mkt',   note: 'makes the product sound inevitable' },
  'Growth Analyst':       { dept: 'mkt',   note: 'finds the cheap channels' },
  'Systems Operator':     { dept: 'ops',   note: 'keeps the machine humming' },
  'Customer Champion':    { dept: 'ops',   note: 'turns complaints into loyalty' },
};
const SKILL_FIT_MULT = 1.2;

const TIERS = ['star', 'strong', 'solid', 'struggling', 'under'];
const TIER_INFO = {
  star:       { label: 'Star',           mult: 1.6 },
  strong:     { label: 'Strong',         mult: 1.25 },
  solid:      { label: 'Solid',          mult: 1.0 },
  struggling: { label: 'Struggling',     mult: 0.7 },
  under:      { label: 'Underperformer', mult: 0.45 },
};
const HIRE_DIST = [0.10, 0.22, 0.40, 0.18, 0.10];
const TEMP_INFO = {
  rough:     { label: 'Rough patch', mult: 0.6 },
  hot:       { label: 'Hot streak',  mult: 1.35 },
  motivated: { label: 'Motivated',   mult: 1.15 },
};
// Rough patches and hot streaks hit anyone, at the same odds regardless of tier.
const TEMP_ODDS = { rough: 0.065, hot: 0.065 };
const CALCIFY_CHANCE = 0.13;

const SALES_TRAITS = {
  home:   { label: 'Home-Turf Expert', note: 'unbeatable in their native market, out of place elsewhere' },
  global: { label: 'Globally-Minded',  note: 'thrives when sent somewhere new' },
};

// ---------- Names ----------
const FIRST_NAMES = ['Maya', 'Theo', 'Priya', 'Jonah', 'Ines', 'Kofi', 'Hana', 'Mateo', 'Saoirse', 'Arjun', 'Lena', 'Tobias',
  'Amara', 'Felix', 'Yuki', 'Rafael', 'Noor', 'Elias', 'Wren', 'Dmitri', 'Zara', 'Caleb', 'Ottilie', 'Kwame', 'Ingrid',
  'Sami', 'Beatriz', 'Ruben', 'Mei', 'Callum', 'Asha', 'Lior', 'Freya', 'Emeka', 'Clio'];
const LAST_NAMES = ['Okafor', 'Lindqvist', 'Haddad', 'Moreau', 'Tanaka', 'Brennan', 'Castillo', 'Novak', 'Mensah', 'Adeyemi',
  'Ferreira', 'Kowalski', 'Achterberg', 'Nakamura', 'Oyelaran', 'Sorensen', 'Delacroix', 'Iyer', 'Halloran', 'Petrov',
  'Vance', 'Quispe', 'Abernathy', 'Ruiz', 'Whitlock', 'Osei', 'Marchetti', 'Kaur', 'Fenwick', 'Varga', 'Byrne',
  'Takahashi', 'Ellery', 'Lindgren', 'Mbeki'];
const NAME_MEMORY = 25;

const COMPANY_A = ['Lantern', 'Harbor', 'Fieldnote', 'Copperleaf', 'Quillwork', 'Tidewell', 'Northstar', 'Bramblewood', 'Kestrel', 'Slate', 'Marigold', 'Ember', 'Juniper', 'Larkspur', 'Foxglove', 'Waypoint'];
const COMPANY_B = ['Labs', 'Works', '& Co.', 'Systems', 'HQ', 'Collective', 'Industries', 'Studio'];
const RIVAL_A = ['Northwind', 'Brightline', 'Ironclad', 'Bluefin', 'Copperhead', 'Silverback', 'Tallgrass', 'Granite', 'Vantage', 'Obsidian', 'Riptide', 'Sterling'];
const RIVAL_B = ['Labs', 'Systems', 'Dynamics', 'Group', 'Technologies', 'Works', 'Partners'];
const ACQUIRERS = ['Consolidated Global', 'Helix Holdings', 'Oberon Technologies', 'Meridian Group', 'Paragon Industries', 'Aster Corp', 'Vanguard Systems', 'Crestline Inc.', 'Monolith', 'Pacifica Holdings'];
const OTHER_EMPLOYERS = ['a fast-growing startup', 'a big-tech giant', 'a well-funded competitor', 'a former boss’s new company', 'a consultancy that pays double'];

const CODENAMES = ['Lantern', 'Kite', 'Bramble', 'Atlas', 'Harbor', 'Juniper', 'Comet', 'Thistle', 'Quarry', 'Fable', 'Orchard', 'Beacon',
  'Cinder', 'Marlin', 'Tundra', 'Saffron', 'Pylon', 'Wicket', 'Halcyon', 'Ridge', 'Cobalt', 'Meadow', 'Sable', 'Vireo'];

// Open-ended maturity ladder: no ceiling on product level.
const STAGES = [
  { at: 1, name: 'MVP' }, { at: 3, name: 'Early Product' }, { at: 5, name: 'Established' }, { at: 8, name: 'Mature' },
  { at: 12, name: 'Best-in-Class' }, { at: 17, name: 'Category Leader' }, { at: 23, name: 'Platform' }, { at: 30, name: 'Institution' },
];
function stageFor(level) {
  let cur = STAGES[0], next = null;
  for (let i = 0; i < STAGES.length; i++) if (level >= STAGES[i].at) { cur = STAGES[i]; next = STAGES[i + 1] || null; }
  if (!next) { // past the ladder: Legendary I, II, ... every 10 levels
    const n = Math.floor((level - 30) / 10);
    cur = n === 0 ? cur : { at: 30 + n * 10, name: 'Legendary ' + toRoman(n) };
    next = { at: 30 + (n + 1) * 10, name: 'Legendary ' + toRoman(n + 1) };
  }
  return { cur, next };
}
function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}

// ---------- Markets ----------
// size: share of reachable demand; growth: acquisition efficiency & headroom; arpu: price multiplier.
const CURATED_MARKETS = [
  { name: 'United States',        size: 1.6,  growth: 1.0,  arpu: 1.0,  entry: 0,      overhead: 0, home: true },
  { name: 'Canada',               size: 0.45, growth: 0.95, arpu: 0.95, entry: 60000,  overhead: 9000 },
  { name: 'United Kingdom',       size: 0.7,  growth: 0.8,  arpu: 1.05, entry: 110000, overhead: 16000 },
  { name: 'Germany',              size: 0.75, growth: 0.78, arpu: 1.08, entry: 140000, overhead: 18000 },
  { name: 'France',               size: 0.6,  growth: 0.8,  arpu: 0.98, entry: 120000, overhead: 16000 },
  { name: 'The Nordics',          size: 0.35, growth: 0.85, arpu: 1.15, entry: 90000,  overhead: 13000 },
  { name: 'Netherlands',          size: 0.3,  growth: 0.9,  arpu: 1.05, entry: 70000,  overhead: 11000 },
  { name: 'Australia',            size: 0.4,  growth: 0.95, arpu: 1.0,  entry: 90000,  overhead: 13000 },
  { name: 'Japan',                size: 0.8,  growth: 0.7,  arpu: 1.1,  entry: 200000, overhead: 24000 },
  { name: 'South Korea',          size: 0.45, growth: 0.95, arpu: 0.9,  entry: 120000, overhead: 15000 },
  { name: 'Singapore',            size: 0.2,  growth: 1.05, arpu: 1.0,  entry: 60000,  overhead: 10000 },
  { name: 'United Arab Emirates', size: 0.25, growth: 1.1,  arpu: 1.05, entry: 90000,  overhead: 14000 },
  { name: 'Brazil',               size: 0.7,  growth: 1.35, arpu: 0.5,  entry: 100000, overhead: 12000 },
  { name: 'Mexico',               size: 0.55, growth: 1.3,  arpu: 0.52, entry: 80000,  overhead: 10000 },
  { name: 'India',                size: 1.2,  growth: 1.6,  arpu: 0.3,  entry: 120000, overhead: 11000 },
  { name: 'Indonesia',            size: 0.7,  growth: 1.55, arpu: 0.33, entry: 80000,  overhead: 8000 },
  { name: 'Nigeria',              size: 0.5,  growth: 1.7,  arpu: 0.28, entry: 60000,  overhead: 7000 },
];
const SCOUT_ADJ = ['Northern', 'Southern', 'Eastern', 'Western', 'Coastal', 'Inland', 'Upper', 'Lower', 'Golden', 'Amber', 'Silver',
  'Emerald', 'Outer', 'Central', 'Highland', 'Lowland', 'Riverine', 'Lakeside', 'Windward', 'Leeward'];
const SCOUT_NOUN = ['Corridor', 'Basin', 'Reach', 'Plateau', 'Coast', 'Delta', 'Highlands', 'Archipelago', 'Provinces', 'Valley',
  'Steppe', 'Isthmus', 'Peninsula', 'Belt', 'Expanse', 'Marches', 'Littoral', 'Territories', 'Frontier', 'Shelf'];
const SCOUT_BASE_COST = 25000;
