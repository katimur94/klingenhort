// Vorher/Nachher-Clip „Meisterschaft: Stufe 1 vs. Stufe 50“ (Meisterschaft aus 5.0, js/mastery.js): derselbe Magier, dieselbe Ultimative
// „Meteorhagel“, dieselben Gegner, derselbe Zufall – a: Meisterschaft Stufe 1 (Lehrling) · b: Stufe 50 (Legende, golden, mehr Meteore).
// Nur P.mastery.mu unterscheidet sich. Kills und Meteorzahl kommen aus dem Spiel (raw/<szene>/log.json).
// Aufruf: PROMO_OUT=/tmp/klingenhort-meister BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-meister';
const BASE = process.env.BASE || 'http://localhost:8766/';
const N = 120;
(async () => {
  for (const [name, lv] of [['a', 1], ['b', 50]]) {
    const R = await H.open({ out: OUT + '/raw', seed: 26, base: BASE });
    const { ev } = R;
    await R.assets();
    const info = await ev(lv => {
      __seed(2611); window.__txtNo = /^\d+$/;
      __fight(1, 4, ['orc', 'berserker', 'goblin', 'orc', 'zwerg', 'goblin', 'orc', 'berserker'], { keepN: 8, dist: 40 });
      P.mastery = P.mastery || {}; P.mastery.mu = lv > 1 ? MCUM[lv] : 0; computeStats();
      window.__kl = 0; HOOK.kill.push(() => { window.__kl++; }); __vp(3.0); __step(3); __snap(); window.__log = [];
      return { lv: mastLv('mu'), rang: MRANK[mrank(mastLv('mu'))], meteore: 10 + mod('uCount') };
    }, lv);
    await R.cap(name, N, `i => { __keep(0); keys.KeyJ = false; if (i === 6) { P.rage = 100; doUlt(); } window.__log.push({ k: window.__kl }); }`);
    fs.writeFileSync(`${OUT}/raw/${name}/log.json`, JSON.stringify({ info, log: await ev(() => window.__log) }));
    console.log(name, JSON.stringify(info), 'Kills', await ev(() => window.__kl));
    const errs = await R.close();
    if (errs.length) { console.log(errs); process.exit(1); }
  }
  process.exit(0);
})();
