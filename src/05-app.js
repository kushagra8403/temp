/* =====================================================================
   Modals, mascots, report screen, actions, boot
   ===================================================================== */

// ---------- Modals ----------
// Every modal goes through renderModal(), which also owns the Advance button's
// disabled state, so no caller can open a blocking modal and leave Advance live.
const MODALS = {
  funding: {
    render(m) {
      const r = ROUNDS[m.roundIdx], t = m.terms;
      const lo = t.fair * 0.85, hi = t.fair * 1.15;
      const pos = (x) => ((x - t.min) / (t.max - t.min)) * 100;
      return `<p class="eyebrow">${r.name} round</p><h2 id="modal-title">Set your terms</h2>
        <p class="prose">Investors value ${esc(S.company)} at roughly <strong>${fmtMoney(t.preBasis)}</strong> before their money goes in. Choose how much of the company to offer. Offer more and you raise more cash at a lower price. Offer less and you are asking for a richer valuation.</p>
        <div class="slider-block">
          <label for="fund-eq" class="label">Equity offered</label>
          <input type="range" id="fund-eq" data-input="fund-eq" min="${Math.round(t.min * 1000)}" max="${Math.round(t.max * 1000)}" step="5" value="${Math.round(m.eq * 1000)}">
          <div class="slider-scale"><span>${fmtPct(t.min)}</span><span class="band" style="left:${pos(lo)}%;width:${pos(hi) - pos(lo)}%" title="What investors expect right now"></span><span>${fmtPct(t.max)}</span></div>
          <p class="fine">The shaded band is what similar ${r.name} rounds are going for right now.</p>
        </div>
        <dl class="quote">
          <div><dt>Equity offered</dt><dd id="fq-eq"></dd></div>
          <div><dt>Cash raised</dt><dd id="fq-cash"></dd></div>
          <div><dt>Post-money valuation</dt><dd id="fq-post"></dd></div>
          <div><dt>Your stake after</dt><dd id="fq-own"></dd></div>
        </dl>
        <p class="fq-note" id="fq-note"></p>
        <div class="modal-actions"><button class="btn ghost" data-act="fund-close">Not now</button><button class="btn primary" data-act="fund-offer">Make the offer</button></div>`;
    },
    mount(m) { updateFundingQuote(m); },
  },
  counter: {
    render(m) {
      const r = ROUNDS[m.roundIdx];
      return `<p class="eyebrow">${r.name} round</p><h2 id="modal-title">They came back with a counter</h2>
        <p class="prose">${esc(m.investor)} likes the company but not the price. You asked them to put in <strong>${fmtMoney(m.cash)}</strong> for <strong>${fmtPct(m.askEq)}</strong>, a ${fmtMoney(m.cash / m.askEq)} post-money valuation. They'll write the same check for <strong>${fmtPct(m.theirEq)}</strong>.</p>
        <div class="offer-grid three">
          <div class="offer"><div class="offer-name">Accept their terms</div><div class="offer-cost">${fmtPct(m.theirEq)} for ${fmtMoney(m.cash)}</div><div class="offer-odds">Certain</div><button class="btn primary" data-act="counter-accept">Accept</button></div>
          <div class="offer"><div class="offer-name">Meet in the middle</div><div class="offer-cost">${fmtPct(m.midEq)} for ${fmtMoney(m.cash)}</div><div class="offer-odds">${Math.round(m.midP * 100)}% they agree</div><button class="btn" data-act="counter-middle">Propose it</button></div>
          <div class="offer"><div class="offer-name">Walk away</div><div class="offer-cost">No deal this round</div><div class="offer-odds">Investors cool off for 2 quarters</div><button class="btn ghost" data-act="counter-walk">Walk away</button></div>
        </div>`;
    },
  },
  retain: {
    render(m) {
      const e = empById(m.empId); const opts = retainOptions(e); const since = quartersSinceRecog(e);
      return `<p class="eyebrow">A resignation letter on your desk</p><h2 id="modal-title">${esc(e.name)} wants to leave</h2>
        <p class="prose">${esc(e.first)} is one of your <strong>${TIER_INFO[e.tier].label}</strong> people in ${DEPTS[e.dept].name} and has an offer from <strong>${esc(m.dest)}</strong>. ${since >= 5 ? `They mention, not unkindly, that nobody has recognized their work in ${since} quarters.` : e.grievance > 6 ? 'They have felt unheard lately.' : 'It’s a good offer and they’re tempted.'} You can counter.</p>
        <div class="offer-grid three">${opts.map((o) => `<div class="offer"><div class="offer-name">${o.label}</div><div class="offer-cost">+${fmtMoney(o.cost)}/yr raise${o.oneTimeCost ? ` and a ${fmtMoney(o.oneTimeCost)} bonus now` : ''}</div><div class="offer-odds">${Math.round(o.p * 100)}% they stay</div><button class="btn${o.key === 'fair' ? ' primary' : ''}" data-act="retain" data-v="${o.key}" ${S.cash >= o.oneTimeCost ? '' : 'disabled'}>Offer ${o.label.toLowerCase()}</button></div>`).join('')}</div>
        <div class="modal-actions"><button class="btn ghost" data-act="retain" data-v="none">Let them go</button></div>`;
    },
  },
  acquisition: {
    render(m) {
      const v = acquisitionVerdict(m.offer); const arr = currentARR();
      const read = v.key === 'great' ? 'That is a strong price for where you are. I would think hard before saying no.' : v.key === 'ok' ? 'It’s a fair price, not a spectacular one. Staying has upside, and risk.' : 'Your growth says you could be worth a lot more by staying. This feels early.';
      return `<p class="eyebrow">An offer to buy ${esc(S.company)}</p><h2 id="modal-title">${esc(m.buyer)} offers ${fmtMoney(m.offer)}</h2>
        <dl class="quote">
          <div><dt>Versus today's valuation</dt><dd>${(m.offer / S.valuation).toFixed(2)}×</dd></div>
          <div><dt>Multiple of ARR</dt><dd>${arr > 0 ? (m.offer / arr).toFixed(1) + '×' : '—'}</dd></div>
          <div><dt>Your stake</dt><dd>${fmtPct(S.founderOwnership)}</dd></div>
          <div><dt>You would take home</dt><dd>${fmtMoney(m.offer * S.founderOwnership)}</dd></div>
        </dl>
        <p class="prose"><strong>${IND().advisor.name}:</strong> “${read}”</p>
        <p class="fine">Accepting ends the game. Declining keeps you building; buyers won't call again for at least a year.</p>
        <div class="modal-actions"><button class="btn ghost" data-act="acq-decline">Decline</button><button class="btn primary" data-act="acq-accept">Sell the company</button></div>`;
    },
  },
  bridge: {
    render(m) {
      const amt = bridgeAmount();
      return `<p class="eyebrow">${clockLabel(S.turn)}</p><h2 id="modal-title">You can't make payroll</h2>
        <p class="prose">Cash is at <strong>${fmtMoney(S.cash)}</strong>. Your bank and two of your angels will wire an emergency bridge of <strong>${fmtMoney(amt)}</strong>, but they want <strong>12%</strong> of the company and they will only do it once.</p>
        <div class="modal-actions"><button class="btn ghost" data-act="bridge-decline">Close the doors</button><button class="btn primary" data-act="bridge-accept">Take the bridge</button></div>`;
    },
  },
  result: {
    render(m) {
      return `<p class="eyebrow">${esc(m.eyebrow)}</p><h2 id="modal-title">${esc(m.title)}</h2><p class="prose">${esc(m.text)}</p>
        <div class="modal-actions"><button class="btn primary" data-act="result-ok">Continue</button></div>`;
    },
  },
};
function bridgeAmount() { return Math.round((-S.cash + Math.max(150000, -projectedNet() * 2)) / 10000) * 10000; }

function renderModal() {
  const root = $('#modal-root');
  const m = S && UI.screen === 'game' ? S.modalQueue[0] : null;
  const btn = $('#advance-btn');
  if (btn) btn.disabled = advanceDisabled();
  if (!m) { root.innerHTML = ''; root.hidden = true; document.body.classList.remove('modal-open'); return; }
  root.hidden = false;
  document.body.classList.add('modal-open');
  root.innerHTML = `<div class="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${MODALS[m.type].render(m)}</div></div>`;
  if (MODALS[m.type].mount) MODALS[m.type].mount(m);
  const first = root.querySelector('.modal-actions .btn.primary, .modal .btn');
  if (first) first.focus({ preventScroll: true });
}
function pushModal(m) { S.modalQueue.push(m); }
function replaceModal(m) { S.modalQueue[0] = m; }
function closeModal() { S.modalQueue.shift(); }

function openFunding() {
  const fs = roundStatus(); if (fs.state !== 'open') return;
  const terms = fundingTerms(fs.r);
  S.modalQueue.unshift({ type: 'funding', roundIdx: S.funding.next, terms, eq: Math.round(terms.fair * 200) / 200 });
}
function updateFundingQuote(m) {
  const q = fundingQuote(m.terms, m.eq);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('fq-eq', fmtPct(m.eq));
  set('fq-cash', fmtMoney(q.cash));
  set('fq-post', fmtMoney(q.post));
  set('fq-own', `${fmtPct(S.founderOwnership)} → ${fmtPct(q.ownerAfter)}`);
  const t = m.terms; const note = document.getElementById('fq-note');
  if (note) {
    if (m.eq < t.fair * 0.85) { note.textContent = 'An aggressive ask. Investors may push back with a counter-offer.'; note.className = 'fq-note warn'; }
    else if (m.eq > t.fair * 1.25) { note.textContent = 'Generous. They will sign today, but you are giving away more than you need to.'; note.className = 'fq-note'; }
    else { note.textContent = 'Within the range investors expect. This should close cleanly.'; note.className = 'fq-note ok'; }
  }
}
function submitFundingOffer(m) {
  const r = ROUNDS[m.roundIdx], t = m.terms, e = m.eq, q = fundingQuote(t, e);
  const thr = t.fair * 0.85;
  if (e >= thr) { closeModal(); closeRound(r, e, q.cash); toast(`${r.name} closed: ${fmtMoney(q.cash)} for ${fmtPct(e)}.`, 'good'); return; }
  const p = clamp(0.4 + ((thr - e) / t.fair) * 2.5, 0, 0.95);
  if (chance(p)) {
    const theirEq = q.cash / (t.preBasis + q.cash);
    const midEq = (e + theirEq) / 2;
    replaceModal({ type: 'counter', roundIdx: m.roundIdx, terms: t, askEq: e, cash: q.cash, theirEq, midEq, midP: clamp(0.55 + (S.sentiment - 1) * 0.8, 0.3, 0.8), investor: pick(INVESTORS[r.key]) });
  } else {
    closeModal(); closeRound(r, e, q.cash); toast(`A bold ask, and they took it: ${fmtMoney(q.cash)} for ${fmtPct(e)}.`, 'good');
  }
}

// ---------- Advisor ----------
function advisorTips() {
  const tips = []; const add = (p, text, tab) => tips.push({ p, text, tab });
  const rw = runwayMonths(); const rec = recessionNow(); const L = S.last;
  if (rw < 6) add(100, `Runway is down to ${fmtRunway(rw)}. Cut marketing, pause hiring, or raise money now.`, rw < 6 && roundStatus().state === 'open' ? 'funding' : 'overview');
  else if (rw < 12) add(70, `About ${fmtRunway(rw)} of runway. Start planning the next raise before you need it.`, 'funding');
  if (rec) add(80, `We're in a downturn. Acquisition costs are up about ${Math.round(45 * rec.sev)}% and valuations are down. Protect cash; the good news is it will end.`, null);
  if (ipoStatus().ok) add(95, `You meet every IPO requirement. Ring the bell on the Funding tab, or keep growing for a bigger debut.`, 'funding');
  const risky = S.employees.filter((e) => e.revealed && (e.tier === 'star' || e.tier === 'strong') && flightRisk(e) >= 30).sort((a, b) => flightRisk(b) - flightRisk(a));
  risky.slice(0, 2).forEach((e) => add(85, `${e.name} (${TIER_INFO[e.tier].label}, ${DEPTS[e.dept].name}) hasn't been recognized in ${quartersSinceRecog(e)} quarters. Flight risk is ${riskLabel(flightRisk(e)).toLowerCase()}. A bonus or a clap would help.`, 'team'));
  S.events.filter((ev) => ev.type === 'overlooked').slice(0, 1).forEach((ev) => { const e = empById(ev.empId); if (e) add(75, `${e.name} is in a rough patch because they feel overlooked. A bonus usually pulls people out of it.`, 'overview'); });
  S.events.filter((ev) => ev.type === 'transfer').slice(0, 1).forEach((ev) => { const e = empById(ev.empId); if (e) add(55, `${e.first} asked to move to ${DEPTS[ev.to].name}. Answer before next quarter or they'll take the silence personally.`, 'overview'); });
  const fs = roundStatus(); if (fs.state === 'open') add(65, `The ${fs.r.name} round is open. Investor sentiment is ${S.sentiment >= 1.1 ? 'warm, a good moment' : S.sentiment <= 0.9 ? 'cool, so expect to give up more' : 'neutral'}.`, 'funding');
  enteredMarkets().filter((m) => !m.home && marketStatus(m).key === 'bad').slice(0, 1).forEach((m) => add(58, `${m.name} has lost money three quarters running. Put a rep there whose trait fits, or accept it as a long bet.`, 'markets'));
  if (S.product.points >= shipCost()) add(60, `Engineering has enough built to ship v${S.product.level + 1}. Shipping raises prices and lowers churn.`, 'product');
  if (L && L.coverage < 0.7) add(57, `Support is stretched to ${Math.round(L.coverage * 100)}% of what customers need, and churn is creeping up. An Operations hire would help.`, 'team');
  if (opsStrain() > 1.1) add(50, `The team has outgrown its operations. Overhead is running ${Math.round((opsStrain() - 1) * 100)}% high until you add Ops capacity.`, 'team');
  const saturated = enteredMarkets().filter((m) => penetration(m) > 0.55).sort((a, b) => penetration(b) - penetration(a))[0];
  if (saturated) add(52, `You've reached ${Math.round(penetration(saturated) * 100)}% of the likely buyers in ${saturated.name}. Growth there will keep slowing; the next stretch comes from new markets or a better product.`, 'markets');
  const home = homeMarket();
  if (L && home.lastSpend > 350000 * home.size * home.growth * (1 + 0.12 * (S.product.level - 1)) * 0.6) add(45, `Marketing in ${home.name} is hitting diminishing returns. A new market would stretch each dollar further.`, 'markets');
  if (S.employees.filter((e) => e.dept === 'eng').length === 0) add(72, 'Nobody is building the product. Hire an engineer or two.', 'team');
  if (L && rw > 30 && S.marketingSpend < 50000 && S.turn > 2) add(40, `You have plenty of runway. Put some of it to work: more marketing or another rep.`, 'overview');
  if (S.rival.strength >= 0.08) add(35, `${S.rival.name} has gotten stronger with people who used to work here. Keeping your stars matters.`, 'team');
  // Praise, not just problems
  const h = S.history;
  if (h.length >= 2 && h[h.length - 2].arr > 50000) { const g = h[h.length - 1].arr / h[h.length - 2].arr - 1; if (g > 0.2) add(32, `ARR grew ${Math.round(g * 100)}% last quarter. That's a great quarter. Enjoy it.`, null); }
  if (L && L.net > 0) add(30, `You made an operating profit last quarter. Very few startups can say that.`, null);
  const stars = S.employees.filter((e) => e.revealed && e.tier === 'star').length;
  if (stars >= 3) add(25, `You have ${stars} Stars on the team. Whatever you're doing to keep them, keep doing it.`, 'team');
  if (!tips.length) add(10, `Nothing urgent. Good moment to think about where growth comes from next year.`, null);
  return tips.sort((a, b) => b.p - a.p).slice(0, 3).map((t) => ({ ...t, level: t.p >= 80 ? 'urgent' : t.p >= 50 ? 'warn' : t.p <= 35 ? 'praise' : 'info' }));
}

// ---------- Mascots ----------
function renderMascots() {
  const adv = $('#advisor'), nr = $('#newsroom');
  if (UI.screen !== 'game' || !S) { adv.innerHTML = ''; nr.innerHTML = ''; adv.hidden = true; nr.hidden = true; return; }
  adv.hidden = false; nr.hidden = false;
  const ind = IND();
  const tips = UI.tipsOpen ? advisorTips() : [];
  const unseen = UI.tipsSeenTurn !== S.turn;
  adv.innerHTML = `${UI.tipsOpen ? `<div class="bubble tip-card" role="region" aria-label="Advice from ${ind.advisor.name}">
      <div class="bubble-head"><span><strong>${ind.advisor.name}</strong> <span class="muted">your advisor</span></span><button class="x" data-act="toggle-tips" aria-label="Close advice">×</button></div>
      <ol class="tips">${tips.map((t) => `<li class="lv-${t.level}"><span>${esc(t.text)}</span>${t.tab && t.tab !== UI.tab ? `<button class="link" data-act="tip-go" data-v="${t.tab}">Show me</button>` : ''}</li>`).join('')}</ol></div>` : ''}
    <button class="mascot-btn" data-act="toggle-tips" aria-expanded="${UI.tipsOpen}" aria-label="${UI.tipsOpen ? 'Close' : 'Open'} advice from ${ind.advisor.name} the ${ind.advisor.kind}">
      <span class="walker${UI.tipsOpen ? ' still' : ''}"><span class="bob">${mascotSVG(ind.advisor.kind)}</span>${!UI.tipsOpen && unseen ? '<span class="badge">Tip</span>' : ''}</span>
      <span class="mascot-label">${ind.advisor.name}</span></button>`;
  const items = S.newsQueue;
  const idx = Math.min(UI.newsIdx, Math.max(0, items.length - 1));
  const it = items[idx];
  nr.innerHTML = `${UI.newsOpen && it ? `<div class="bubble news-card k-${it.kind}" role="status" aria-live="polite" ${''}data-idx="${idx}">
      <div class="bubble-head"><span><strong>${ind.news.name}</strong> <span class="muted">the newsroom · ${clockLabel(it.turn)}</span></span><button class="x" data-act="news-close" aria-label="Dismiss news">×</button></div>
      <p>${esc(it.text)}</p>
      <div class="bubble-foot"><span class="muted">${idx + 1} of ${items.length}</span>${idx < items.length - 1 ? '<button class="btn small" data-act="news-next">Next</button>' : '<button class="btn small" data-act="news-close">Done</button>'}</div></div>` : ''}
    <button class="mascot-btn" data-act="news-toggle" aria-label="${ind.news.name}, the newsroom${items.length ? ': ' + items.length + ' new' : ''}">
      <span class="perch"><span class="bob slow">${mascotSVG(ind.news.kind)}</span>${!UI.newsOpen && items.length ? `<span class="badge count">${items.length}</span>` : ''}</span>
      <span class="mascot-label">${ind.news.name}</span></button>`;
}
const narrow = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;

// ---------- Report ----------
function renderReport() {
  applyIndustryTheme(S.industry);
  const g = S.gameOver; const st = S.stats;
  const value = g.kind === 'acquired' ? g.offer : g.kind === 'ipo' ? g.ipoVal : g.kind === 'bankrupt' ? 0 : S.valuation;
  const stake = g.kind === 'ipo' ? S.founderOwnership * 0.85 : S.founderOwnership;
  const years = (S.turn / 4).toFixed(S.turn % 4 ? 1 : 0);
  let eyebrow, title, verdict;
  if (g.kind === 'acquired') {
    eyebrow = `Acquired by ${g.buyer} · ${clockLabel(S.turn)}`;
    title = g.verdict.key === 'great' ? 'Sold at the right moment.' : g.verdict.key === 'ok' ? 'A good exit.' : 'An early exit.';
    if (value >= 1e9) title = 'A billion-dollar exit.';
    verdict = g.verdict.text;
  } else if (g.kind === 'ipo') {
    eyebrow = `Initial public offering · ${clockLabel(S.turn)}`;
    title = value >= 1e9 ? 'A billion-dollar public company.' : 'A public company.';
    verdict = `${S.company} listed at ${fmtMoney(value)} after a first-day pop, on ${fmtMoney(currentARR())} of ARR. New shares diluted your stake to ${fmtPct(stake)}.`;
  } else if (g.kind === 'bankrupt') {
    eyebrow = `Closed · ${clockLabel(S.turn)}`;
    title = 'The money ran out.';
    verdict = `After ${years} years, ${S.company} couldn't make payroll. At its peak it was worth ${fmtMoney(st.peakValuation)} on ${fmtMoney(st.peakARR)} of ARR. Most companies end this way; the lessons are real.`;
  } else {
    eyebrow = `The clock ran out · ${S.horizon} years`;
    title = value >= 1e9 ? 'A billion-dollar company.' : value >= 2.5e8 ? 'A serious company.' : value >= 5e7 ? 'A real business.' : value >= 1e7 ? 'A small, living company.' : 'Still standing.';
    verdict = `After ${S.horizon} years, ${S.company} is worth ${fmtMoney(value)} on ${fmtMoney(currentARR())} of ARR, ${arrGrowthYoY() > 0.3 ? 'and still growing fast' : arrGrowthYoY() > 0 ? 'and still growing' : 'though growth has stalled'}.`;
  }
  const lvl = S.product.level;
  const stars = S.employees.filter((e) => e.tier === 'star').length;
  const recCount = S.recessions.filter((r) => r.announced).length;
  const recap = [
    `You hired ${st.hires + 3} people in ${years} years, counting the founding three. ${plural(st.fires, 'was', 'were')} let go and ${st.resigned} resigned${st.retained ? `; ${plural(st.retained, 'was', 'were')} talked into staying` : ''}${st.lostNegotiations ? ` and ${plural(st.lostNegotiations, 'counter-offer', 'counter-offers')} fell short` : ''}.`,
    `${plural(st.bonuses, 'bonus', 'bonuses')} and ${plural(st.claps, 'clap', 'claps')}.${st.calcified ? ` ${plural(st.calcified, 'temporary slump or streak', 'temporary slumps or streaks')} became permanent.` : ''} ${stars ? `You finished with ${stars} Star${stars > 1 ? 's' : ''} on a team of ${S.employees.length}.` : `No Stars on the final team of ${S.employees.length}.`}`,
    st.transfers || st.reassigns ? `${st.transfers} department transfer${st.transfers === 1 ? '' : 's'} and ${st.reassigns} sales reassignment${st.reassigns === 1 ? '' : 's'}.` : 'Nobody changed roles. Everyone stayed where you first put them.',
    `${st.ships} release${st.ships === 1 ? '' : 's'} shipped, reaching v${lvl} (${stageFor(lvl).cur.name}).`,
    S.funding.raised.length ? `Raised ${S.funding.raised.length} round${S.funding.raised.length > 1 ? 's' : ''} totaling ${fmtMoney(st.raised)}, through ${S.funding.raised[S.funding.raised.length - 1].name}.${st.walkedAway ? ` Walked away from the table ${st.walkedAway} time${st.walkedAway > 1 ? 's' : ''}.` : ''}` : 'Bootstrapped the whole way. You never sold a share to investors.',
    `Operated in ${enteredMarkets().length} market${enteredMarkets().length > 1 ? 's' : ''}${S.scoutCount ? `, after scouting ${S.scoutCount} new one${S.scoutCount > 1 ? 's' : ''}` : ''}.`,
    st.toRival ? `${st.toRival} former employee${st.toRival > 1 ? 's' : ''} went to ${S.rival.name}.` : `Nobody you lost ended up at ${S.rival.name}.`,
    recCount ? `Lived through ${recCount} downturn${recCount > 1 ? 's' : ''}.` : 'No downturn hit while you were running things.',
    S.offersDeclined.length ? `Turned down ${S.offersDeclined.length} acquisition offer${S.offersDeclined.length > 1 ? 's' : ''}, the best at ${fmtMoney(Math.max(...S.offersDeclined.map((o) => o.offer)))}.` : null,
  ].filter(Boolean);
  $('#app').innerHTML = `
  <div class="report-wrap"><article class="report">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(title)}</h1>
    <p class="report-co">${esc(S.company)} · ${IND().name} · ${DIF().name} · ${S.horizon}-year game</p>
    <p class="prose lead">${esc(verdict)}</p>
    <dl class="report-nums">
      <div><dt>${g.kind === 'acquired' ? 'Sale price' : g.kind === 'ipo' ? 'Listing value' : 'Final valuation'}</dt><dd>${fmtMoney(value)}</dd></div>
      <div><dt>Your stake</dt><dd>${fmtPct(stake)}</dd></div>
      <div><dt>Worth to you</dt><dd>${fmtMoney(value * stake)}</dd></div>
      <div><dt>Final ARR</dt><dd>${fmtMoney(currentARR())}</dd></div>
      <div><dt>Peak ARR</dt><dd>${fmtMoney(st.peakARR)}</dd></div>
      <div><dt>Team</dt><dd>${S.employees.length}</dd></div>
    </dl>
    <section><h2>How you played it</h2><ul class="recap">${recap.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>
    <section><h2>ARR and cash, every quarter</h2>${lineChart([{ label: 'ARR', color: 'var(--accent)', values: S.history.map((h) => h.arr) }, { label: 'Cash', color: 'var(--second)', values: S.history.map((h) => h.cash) }])}</section>
    <div class="report-actions"><button class="btn primary big" data-act="new-game">Found another company</button></div>
  </article></div>`;
}
// "1 was" / "3 were", "1 bonus" / "2 bonuses"
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
function toReport() {
  $('#toast-root').innerHTML = '';
  S.modalQueue = [];
  UI.screen = 'report'; UI.tipsOpen = false; UI.newsOpen = false;
  render();
  const root = $('#modal-root'); root.innerHTML = ''; root.hidden = true; document.body.classList.remove('modal-open');
  window.scrollTo(0, 0);
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
}

// ---------- Render ----------
function render() {
  if (UI.screen === 'setup' || !S) renderSetup();
  else if (UI.screen === 'report') renderReport();
  else renderGame();
  renderModal();
  renderMascots();
}

// ---------- Actions ----------
function need(cost) { if (S.cash < cost) { toast(`That costs ${fmtMoney(cost)} and you have ${fmtMoney(S.cash)}.`, 'bad'); return false; } return true; }
function afterAdvance() {
  UI.tipsOpen = false; UI.pendingTransfer = {}; UI.pendingMarket = {}; UI.confirmFire = null;
  UI.newsIdx = 0; UI.newsOpen = S.newsQueue.length > 0;
  if (S.gameOver) { toReport(); return; }
  render();
}
const ACTIONS = {
  'suggest-name': () => { UI.setup.name = genCompanyName(); render(); },
  'pick-industry': (d) => { UI.setup.industry = d.v; render(); },
  'pick-difficulty': (d) => { UI.setup.difficulty = d.v; render(); },
  'pick-horizon': (d) => { UI.setup.horizon = +d.v; render(); },
  start: () => {
    const name = UI.setup.name.trim() || genCompanyName();
    newGame({ company: name, industry: UI.setup.industry, difficulty: UI.setup.difficulty, horizon: UI.setup.horizon });
    Object.assign(UI, { screen: 'game', tab: 'overview', newsOpen: true, newsIdx: 0, tipsOpen: false, tipsSeenTurn: -1, teamFilter: 'all', hireMarket: null, pendingTransfer: {}, pendingMarket: {}, confirmFire: null });
    render(); window.scrollTo(0, 0);
  },
  'new-game': () => { S = null; UI.screen = 'setup'; render(); window.scrollTo(0, 0); },
  advance: () => { if (advanceDisabled()) return; S.newsQueue = []; if (advanceQuarter()) afterAdvance(); },
  tab: (d) => { UI.tab = d.v; render(); },
  'tip-go': (d) => { UI.tab = d.v; UI.tipsOpen = false; render(); window.scrollTo(0, 0); },
  'toggle-tips': () => { UI.tipsOpen = !UI.tipsOpen; UI.tipsSeenTurn = S.turn; if (UI.tipsOpen && narrow()) UI.newsOpen = false; renderMascots(); },
  'news-toggle': () => { UI.newsOpen = !UI.newsOpen && S.newsQueue.length > 0; if (!S.newsQueue.length) toast('No news since you last checked.'); if (UI.newsOpen && narrow()) UI.tipsOpen = false; renderMascots(); },
  'news-next': () => { UI.newsIdx++; renderMascots(); },
  'news-close': () => { S.newsQueue = []; UI.newsIdx = 0; UI.newsOpen = false; renderMascots(); },
  hire: (d) => {
    const sal = DEPTS[d.dept].salary * DIF().salary * wageIndex();
    if (!need(hireFee(sal) * 1.15)) return;
    const mId = d.dept === 'sales' ? (UI.hireMarket != null && marketById(UI.hireMarket).entered ? UI.hireMarket : homeMarket().id) : null;
    const e = hire(d.dept, mId); UI.newsOpen = true; UI.newsIdx = S.newsQueue.length - 1;
    toast(`${e.name} joins ${DEPTS[e.dept].name} at ${fmtMoney(e.salary)}/yr.`); render();
  },
  bonus: (d) => { const e = empById(+d.id); if (!e || S.turn < e.bonusReadyTurn || !need(bonusCost(e))) return; toast(giveBonus(e), 'good'); render(); },
  clap: (d) => { const e = empById(+d.id); if (!e || S.turn < e.clapReadyTurn) return; const msg = giveClap(e); toast(msg || 'You’ve used all your claps this quarter.', msg ? 'good' : 'bad'); render(); },
  fire: (d) => {
    const e = empById(+d.id); if (!e) return;
    if (UI.confirmFire !== e.id) { UI.confirmFire = e.id; render(); return; }
    if (!need(severance(e))) return;
    UI.confirmFire = null; fire(e); UI.newsOpen = true; UI.newsIdx = S.newsQueue.length - 1; render();
  },
  'fire-cancel': () => { UI.confirmFire = null; render(); },
  'transfer-confirm': (d) => { const e = empById(+d.id); const to = UI.pendingTransfer[d.id]; delete UI.pendingTransfer[d.id]; if (e && to) { transfer(e, to); toast(`${e.first} starts in ${DEPTS[to].name} this quarter. Their new performance level shows next quarter.`); } render(); },
  'transfer-cancel': (d) => { delete UI.pendingTransfer[d.id]; render(); },
  'market-confirm': (d) => { const e = empById(+d.id); const to = UI.pendingMarket[d.id]; delete UI.pendingMarket[d.id]; if (e && to != null) { const f = reassignMarket(e, to); if (f) toast(`${e.first} now covers ${marketById(to).name}. ${f.text}`, f.ok ? 'good' : 'bad'); } render(); },
  'market-cancel': (d) => { delete UI.pendingMarket[d.id]; render(); },
  'approve-request': (d) => { const e = empById(+d.id); if (e && e.request) { const to = e.request; transfer(e, to, 'request'); toast(`${e.first} is moving to ${DEPTS[to].name}.`); } render(); },
  'decline-request': (d) => {
    const e = empById(+d.id); if (!e) return;
    e.request = null; e.grievance = Math.min(20, e.grievance + 6); addHistory(e, 'Transfer request declined');
    S.events = S.events.filter((ev) => !(ev.type === 'transfer' && ev.empId === e.id));
    toast(`${e.first} took it professionally, but they're disappointed.`); render();
  },
  'team-filter': (d) => { UI.teamFilter = d.v; render(); },
  sort: (d) => { if (UI.sort.key === d.v) UI.sort.dir *= -1; else UI.sort = { key: d.v, dir: d.v === 'salary' || d.v === 'output' || d.v === 'tenure' ? -1 : 1 }; render(); },
  'enter-market': (d) => { const m = marketById(+d.id); if (!m || m.entered || !need(m.entry)) return; enterMarket(m); UI.newsOpen = true; UI.newsIdx = S.newsQueue.length - 1; render(); },
  scout: () => { if (!need(scoutCost())) return; scoutMarket(); UI.newsOpen = true; UI.newsIdx = S.newsQueue.length - 1; render(); },
  ship: () => { if (!need(shipCash())) return; if (shipProduct()) { UI.newsOpen = true; UI.newsIdx = S.newsQueue.length - 1; } render(); },
  'open-funding': () => { openFunding(); render(); },
  'fund-close': () => { closeModal(); render(); },
  'fund-offer': () => { const m = S.modalQueue[0]; if (m && m.type === 'funding') submitFundingOffer(m); render(); },
  'counter-accept': () => { const m = S.modalQueue[0]; closeModal(); closeRound(ROUNDS[m.roundIdx], m.theirEq, m.cash); toast(`Done: ${fmtMoney(m.cash)} for ${fmtPct(m.theirEq)}.`, 'good'); render(); },
  'counter-middle': () => {
    const m = S.modalQueue[0]; const r = ROUNDS[m.roundIdx];
    if (chance(m.midP)) { closeModal(); closeRound(r, m.midEq, m.cash); replaceOrPush({ type: 'result', eyebrow: `${r.name} round`, title: 'They met you halfway', text: `${m.investor} agreed: ${fmtMoney(m.cash)} for ${fmtPct(m.midEq)}. A good negotiation.` }); }
    else { closeModal(); walkAwayFromRound(); replaceOrPush({ type: 'result', eyebrow: `${r.name} round`, title: 'No deal', text: `${m.investor} wouldn't move and the talks ended. Investors will take meetings again in two quarters.` }); }
    render();
  },
  'counter-walk': () => { closeModal(); walkAwayFromRound(); toast('You walked away. Investors will talk again in two quarters.'); render(); },
  retain: (d) => {
    const m = S.modalQueue[0]; const e = empById(m.empId); closeModal();
    const opt = d.v === 'none' ? null : retainOptions(e).find((o) => o.key === d.v);
    const res = resolveRetain(e, opt, m.dest);
    if (opt) replaceOrPush({ type: 'result', eyebrow: res.ok ? 'They’re staying' : 'They’re leaving', title: res.ok ? `${e.first} stays` : `${e.first} said no`, text: res.msg });
    else toast(res.msg);
    render();
  },
  'result-ok': () => { closeModal(); render(); },
  'acq-accept': () => { const m = S.modalQueue[0]; endGame('acquired', { buyer: m.buyer, offer: m.offer, verdict: acquisitionVerdict(m.offer) }); toReport(); },
  'acq-decline': () => { const m = S.modalQueue[0]; S.offersDeclined.push({ buyer: m.buyer, offer: m.offer, turn: S.turn }); log('funding', `Declined ${m.buyer}'s ${fmtMoney(m.offer)} offer.`); closeModal(); render(); },
  'bridge-accept': () => { const amt = bridgeAmount(); S.cash += amt; S.founderOwnership *= 0.88; S.capTable.forEach((h) => { h.pct *= 0.88; }); S.capTable.push({ name: 'Bridge lenders', pct: 0.12 }); S.bridgeUsed = true; closeModal(); news(`An emergency bridge of ${fmtMoney(amt)} keeps the lights on, at a steep 12%.`, 'funding'); UI.newsOpen = true; render(); },
  'bridge-decline': () => { endGame('bankrupt'); toReport(); },
  ipo: () => { if (!ipoStatus().ok) return; endGame('ipo', { ipoVal: S.valuation * 1.2 }); toReport(); },
};
function replaceOrPush(m) { S.modalQueue.unshift(m); }

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target; const k = el.dataset && el.dataset.input;
  if (k === 'co-name') UI.setup.name = el.value;
  else if (k === 'marketing') { S.marketingSpend = +el.value; const v = $('#mkt-val'); if (v) v.textContent = fmtMoney(S.marketingSpend) + '/q'; renderTopbar(); }
  else if (k === 'fund-eq') { const m = S.modalQueue[0]; if (m && m.type === 'funding') { m.eq = +el.value / 1000; updateFundingQuote(m); } }
});
document.addEventListener('change', (ev) => {
  const el = ev.target; const k = el.dataset && el.dataset.change;
  if (k === 'transfer-select') { if (el.value) UI.pendingTransfer[el.dataset.id] = el.value; else delete UI.pendingTransfer[el.dataset.id]; render(); }
  else if (k === 'market-select') { UI.pendingMarket[el.dataset.id] = +el.value; render(); }
  else if (k === 'hire-market') { UI.hireMarket = +el.value; }
  else if (el.dataset && el.dataset.input === 'marketing') render();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && S && S.modalQueue[0] && S.modalQueue[0].type === 'funding') { closeModal(); render(); }
});

// ---------- Test hooks ----------
window.BDC = {
  get S() { return S; }, UI, ACTIONS, setSeed, newGame, advanceQuarter, render, toReport, afterAdvance,
  helpers: { totalCustomers, totalRevenue, currentARR, runwayMonths, projectedNet, roundStatus, fundingTerms, fundingQuote, flightRisk, transferOdds, empOutput, setupRunway, advisorTips, shipCost, ipoStatus, computeValuation },
};

// ---------- Boot ----------
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ S, UI: { ...UI }, seed: _seed }));
function boot(data) {
  if (data && data.S) { S = data.S; Object.assign(UI, data.UI || {}); if (data.seed != null) _seed = data.seed; }
  render();
}
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
