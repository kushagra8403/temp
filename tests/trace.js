// Prints a quarter-by-quarter trace of one bot game: node tests/trace.js industry difficulty horizon seed
const path = require('path'); const { chromium } = require('playwright');
const [ind = 'saas', dif = 'standard', hor = '10', seed = '1010'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', 'billion-dollar-company.html'));
  const rows = await p.evaluate(({ ind, dif, hor, seed }) => {
    const B = window.BDC, A = B.ACTIONS, H = B.helpers; B.setSeed(+seed);
    B.UI.setup = { name: 'T', industry: ind, difficulty: dif, horizon: +hor }; A.start();
    const out = [];
    while (!B.S.gameOver) {
      const S = B.S;
      while (S.modalQueue.length && !S.gameOver) {
        const m = S.modalQueue[0];
        if (m.type === 'funding') A['fund-offer'](); else if (m.type === 'counter') A['counter-accept']();
        else if (m.type === 'retain') A.retain({ v: 'fair' }); else if (m.type === 'acquisition') A['acq-decline']();
        else if (m.type === 'bridge') A['bridge-accept'](); else A['result-ok']();
      }
      if (S.gameOver) break;
      if (H.roundStatus().state === 'open') { A['open-funding'](); continue; }
      const rw = H.runwayMonths();
      S.marketingSpend = Math.max(5000, Math.round((rw > 18 ? S.cash * 0.07 : rw > 9 ? S.cash * 0.04 : 5000) / 5000) * 5000);
      let h = 0; while (H.runwayMonths() > 16 && S.cash > 250000 && h++ < 6) { const n = S.employees.length + 1, c = (d) => S.employees.filter((e) => e.dept === d).length, w = { eng: .35, sales: .3, mkt: .15, ops: .2 }; A.hire({ dept: Object.keys(w).sort((a, b) => (c(a) - w[a] * n) - (c(b) - w[b] * n))[0] }); }
      const av = S.markets.filter((m) => !m.entered).sort((a, b) => b.size * b.growth * b.arpu - a.size * a.growth * a.arpu);
      if (S.turn > 4 && av[0] && S.cash > av[0].entry * 8 && H.runwayMonths() > 18) A['enter-market']({ id: String(av[0].id) });
      if (S.product.points >= H.shipCost()) A.ship();
      A.advance();
      const L = S.last; if (!L) continue;
      out.push([S.turn, Math.round(S.cash / 1e3), Math.round(H.currentARR() / 1e3), Math.round(S.valuation / 1e6), S.employees.length, Math.round(L.newMkt), Math.round(L.newSales), Math.round(L.churned), Math.round(L.marketing / 1e3), Math.round(L.net / 1e3), S.product.level, S.markets.filter((m) => m.entered).length, Math.round(S.markets[0].customers / (S.markets[0].customers ? 1 : 1)), S.funding.raised.length].join('\t'));
    }
    out.push('END ' + B.S.gameOver.kind);
    return out;
  }, { ind, dif, hor, seed });
  console.log('turn\tcash k\tARR k\tval M\thead\tnewMkt\tnewSales\tchurned\tmkt k\tnet k\tlvl\tmkts\thomeCust\trounds');
  console.log(rows.join('\n')); await b.close();
})();
