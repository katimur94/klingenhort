// Tages-Clip „Welche Klasse bist du?“ (~12 s): die vier Klassen und ihre Ultimativen, echte Kämpfe
// k0 Ritterin (Erdbeben) · k1 Magier (Meteorhagel) · k2 Assassine · k3 Bogenschützin – je ein Gebiet, Ultimative gleich am Anfang
// Aufruf: PROMO_OUT=/tmp/klingenhort-klassen BASE=http://localhost:8765/ node scenes.js [szene]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-klassen';
const SETS = [[0, 4, ['orc', 'berserker', 'goblin', 'orc', 'zwerg']], [1, 8, ['imp', 'chort', 'lavadaemon', 'imp', 'chort']], [2, 7, ['skeleton', 'zombie', 'skelarcher', 'geist', 'skeleton']], [3, 5, ['icez', 'eisgeist', 'frostoger', 'skelarcher', 'icez']]];
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 7 });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  const info = [];
  for (const [ci, act, kinds] of SETS) {
    const nm = 'k' + ci;
    if (!R.want(nm)) continue;
    await ev(([ci, act, kinds]) => { __vp(3.3); __fight(ci, act, kinds, { keepN: 6, dist: 42, tanky: 2 }); __step(14); __snap(); }, [ci, act, kinds]);
    await R.cap(nm, 48, `i => { __keep(.5); if (i === 2) { P.rage = 100; doUlt(); } }`);
    info.push(await ev(ci => { activateChar(ci); const C = CLASSES[P.cls]; return { ci, cls: C.name, ult: SKILLS[C.ult].n }; }, ci));
  }
  if (info.length) fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info));
  console.log(JSON.stringify(info));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
