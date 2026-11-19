// Tipp-Clip „Normaler Held vs. Saison-Held“ (Wettrennen um Saison-Punkte, Saison 1 aus 6.7): zweimal derselbe Kampf mit demselben Zufall –
// a: dieselbe Ritterin als normaler Held (P.sz = 0) · b: als Saison-Held (P.sz = aktuelle Saison, js/saison.js szGain: ×1,5, gerundet)
// Die Saison-Punkte kommen bildgenau aus SAVE.meta.sz.xp (raw/<szene>/log.json).
// Aufruf: PROMO_OUT=/tmp/klingenhort-szheld BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-szheld';
const BASE = process.env.BASE || 'http://localhost:8766/';
const N = 250;
(async () => {
  for (const [name, held] of [['a', false], ['b', true]]) {
    // jede Aufnahme in einer frischen Seite mit demselben Startzufall: beide Kämpfe laufen gleich
    const R = await H.open({ out: OUT + '/raw', seed: 19, base: BASE });
    const { ev } = R;
    await R.assets();
    await ev(held => {
      __seed(1911); __fight(0, 4, ['skeleton', 'zombie', 'skeleton', 'zombie', 'skeleton', 'zombie'], { keepN: 8, dist: 34 });
      P.sz = held ? szNo() : 0; const M = szM(); M.xp = 0; M.cl = []; window.__x0 = M.xp; window.__kl = 0; HOOK.kill.push(() => { window.__kl++; }); __vp(3.4); __step(4); __snap(); window.__log = [];
    }, held);
    await R.cap(name, N, `i => { __keep(0); if (i % 30 === 10) { P.cds[0] = 0; useSkill(0); } const M = szM(); window.__log.push({ xp: M.xp - window.__x0, k: window.__kl }); }`);
    fs.writeFileSync(`${OUT}/raw/${name}/log.json`, JSON.stringify(await ev(() => window.__log)));
    await ev(() => __off());
    const errs = await R.close();
    if (errs.length) { console.log(errs); process.exit(1); }
  }
  process.exit(0);
})();
