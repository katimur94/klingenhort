// Tages-Clip „Falsches Element vs. richtiges Element“ (Mini-Tutorial im Split-Screen): dieselbe Ritterin, derselbe Lavadämon (Element Feuer),
// einmal mit Feuer-Klinge (RESISTENT, halber Schaden), einmal mit Frost-Klinge (SCHWÄCHE!, 1,5-facher Schaden) – Regeln aus js/elements.js.
// Schaden je Bild (verlorene Lebenspunkte des Gegners) steht in raw/<szene>/log.json.
// Aufruf: PROMO_OUT=/tmp/klingenhort-element BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-element';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 15, base: BASE });
  const { ev } = R;
  await R.assets();
  for (const [nm, el] of [['feuer', 'feuer'], ['frost', 'frost']]) {
    await ev(el => {
      __seed(7); window.__txtNo = null; window.__txtOK = /SCHWÄCHE|RESISTENT/;
      activateChar(0); P.lv = 40; P.gear.weapon.el = el; computeStats();
      __fight(0, 6, ['lavadaemon'], { keepN: 1, dist: 30, tanky: 400 }); window.__kinds = null; P.gear.weapon.el = el; computeStats();
      const e = enemies[0]; e.x = P.x + 26; e.y = P.y - 2; window.__e = e; window.__hp0 = e.hp; window.__log = [];
      __vp(4.2); window.__camDX = 12; __step(4); __snap();
    }, el);
    await R.cap(nm, 110, `i => { __keep(0); P.rage = 0; P.cds = [9, 9, 9]; const e = window.__e; e.x += (P.x + 26 - e.x) * .3; e.y += (P.y - 2 - e.y) * .3; window.__log.push(Math.round(window.__hp0 - e.hp)); }`);
    fs.writeFileSync(`${OUT}/raw/${nm}/log.json`, JSON.stringify(await ev(() => ({ log: window.__log, el: P.gear.weapon.el, en: EN_EL.lavadaemon }))));
  }
  await ev(() => __off());
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
