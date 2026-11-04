// Tages-Clip „Dein Begleiter: LV 1 → LV 150“ (~13 s), Feature aus 6.4 (Begleiter-Aufstieg)
// hook: Ritterin + aufgestiegener Jungdrache (LV 150, Aura „Ewiges Licht“) im Kampf, Feuersturm
// evo: echtes Begleiter-Bild aus dem Charakter-Menü, Stufe für Stufe (Baby → Aufgestiegen), je Level mehrere Bilder (Animation)
// fight: noch einmal LV 150 im Kampf, näher dran
// Aufruf: PROMO_OUT=/tmp/klingenhort-pet BASE=http://localhost:8767/ node scenes.js [szene]
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-pet';
const BASE = process.env.BASE || 'http://localhost:8767/';
const LVS = [1, 10, 25, 50, 75, 100, 150];
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 41, base: BASE });
  const { ev, page } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    const M = petM(); M.list.length = 0; M.act = null;
    window.__pet = petGive('jungdrache', { lv: 1, gn: [80, 80, 80, 80, 80] }); window.__pet.nw = 0;
    window.__setLv = (lv) => { const p = window.__pet; p.lv = lv; p.xp = 0; if (lv >= 150) { p.au = 'ewig'; p.ti = 'ewig'; } else { delete p.au; delete p.ti; } };
    window.__scene = (lv, kinds, zoom) => {
      __seed(lv); window.__setLv(lv); window.__txtNo = /^\d+$/;
      __vp(zoom); __fight(0, 6, kinds, { keepN: 4, dist: 40, tanky: 3 }); window.__camDX = -14; window.__camDY = 2;
      petM().act = window.__pet.id; computeStats(); petPlace(false); __keep(0); __step(10); __snap();
    };
  });
  // pro Bild: Held kämpft, Begleiter greift oft an, Level bleibt fest
  const per = spec => `i => { __keep(.5); const p = window.__pet; p.xp = 0; PET_RT.cd = Math.min(PET_RT.cd, .3); if (i % ${spec} === 3) PET_RT.spc = 0; }`;
  if (R.want('hook')) { await ev(() => window.__scene(150, ['imp', 'chort', 'lavadaemon', 'imp'], 4)); await R.cap('hook', 48, per(24)); }
  if (R.want('evo')) {
    const d = R.dir('evo');
    for (const lv of LVS) {
      await ev(lv => { window.__setLv(lv); activateChar(0); petView = window.__pet.id; openChar('pet'); }, lv);
      for (let j = 0; j < 6; j++) { await page.waitForTimeout(120); await page.locator('.petprev').first().screenshot({ path: `${d}/${lv}_${j}.png` }); }
    }
    await ev(() => { hideOverlay(); state = 'play' });
    console.log('Szene evo', LVS.length, 'Stufen');
  }
  if (R.want('fight')) { await ev(() => window.__scene(150, ['orc', 'berserker', 'ogre', 'orc'], 4.4)); await R.cap('fight', 72, per(30)); }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
