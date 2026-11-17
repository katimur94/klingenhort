// Begleiter-Clip „60 Stunden gepflegt – was schlüpft aus dem mythischen Ei?“ (Frage/Spannung): echtes Brutnest und echte Schlüpf-Animation (js/pets.js hatchStart)
// nest: Brutnest mit fertig gebrütetem mythischen Ei („Es wackelt und knackt – bereit!“)
// hatch: „Schlüpfen lassen!“ → Wackeln, Risse, Licht, Kreatur + Ergebnis-Karte des Spiels (die Uhr der Animation läuft bildgenau mit)
// kampf: der frisch geschlüpfte Sternenwal (LV 1) kämpft an der Seite der Ritterin
// Die 60 Stunden Pflegezeit sind für die Aufnahme übersprungen (Ei auf 100 % gesetzt), alles andere läuft wie im Spiel.
// Aufruf: PROMO_OUT=/tmp/klingenhort-ei BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-ei';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 17, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    __seed(17); __off(); activateChar(0);
    const M = petM(); M.list = []; M.eggs = []; M.act = null; M.seen = []; M.first = true; M.intro = true;
    const g = eggNew('wal'); g.nest = 1; g.got = g.need; M.eggs.push(g); window.__eg = g.id;
    G = null; openMap(); openNest('map'); panel.scrollTop = 0;
    window.__info = { view: eggView(g), tier: g.tier, care: PET_TIERS[g.tier].care };
  });
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(await ev(() => window.__info)));
  await R.page.waitForTimeout(400);
  await R.cap('nest', 45, `i => { panel.scrollTop = 0; }`);
  await ev(() => { window.__pt = performance.now(); performance.now = () => window.__pt; Math.random = (r => () => { const x = r(); return x < .02 ? .5 : x; })(Math.random); hatchStart(window.__eg); });
  await R.cap('hatch', 130, `i => { window.__pt += 1000 / 30; hatchRun(); }`);
  fs.writeFileSync(OUT + '/raw/hatch/info.json', JSON.stringify(await ev(() => { const p = HATCH.p; return { sp: p.sp, n: PET_SP[p.sp].n, lv: p.lv, shiny: !!p.shiny, mu: p.mu || null }; })));
  await ev(() => { ON.hatchtake(); hideOverlay(); __fight(0, 5, ['skeleton', 'zombie', 'skeleton', 'zombie'], { keepN: 5, dist: 50 }); petPlace(false); __vp(4); __step(10); __snap(); });
  await R.cap('kampf', 80, `i => { __keep(.5); }`);
  await ev(() => __off());
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
