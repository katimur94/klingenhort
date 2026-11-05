// Tages-Clip „Rang 1 vs. Rang 1200“ (~10 s), Challenge-Format: echte Übungskämpfe aus dem Boss-Kodex
// r1: Bogenschützin gegen Boss Rang 1 (eine Mechanik) · r600: Rang 600 · r1200: Magier gegen Rang 1200 (fünf Mechaniken, Warnflächen überall)
// Aufruf: PROMO_OUT=/tmp/klingenhort-boss BASE=http://localhost:8767/ node scenes.js [szene]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-boss';
const BASE = process.env.BASE || 'http://localhost:8767/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 23, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__txtNo = /^\d+$|SCHWÄCHE|RESIST|BEGLEITER/;
    window.__arena = (ci, id, zoom) => {
      __seed(id + 3); activateChar(ci); P.lv = 100; computeStats(); bossArena(id); __vp(zoom); window.__camDX = 0; window.__camDY = -18; __step(75); for (const e of enemies) if (e.boss) { e.x = P.x + 10; e.y = P.y - 46; } __snap();
    };
    // pro Bild: Held lebt, kämpft und läuft im Kreis; Boss bleibt über halbem Leben
    window.__boss = (i, mv) => {
      P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; keys.KeyJ = i % 18 < 7;
      const t = i * mv; keys.KeyD = Math.cos(t) > .7; keys.KeyA = Math.cos(t) < -.7; keys.KeyS = keys.KeyW = false; P.y += ((BD.y0 + BD.y1) / 2 + 20 - P.y) * .2;
      for (const e of enemies) if (e.boss) { e.hp = Math.max(e.hp, e.maxHp * .55); e.tcd = 9; e.x += (P.x + 6 - e.x) * .3; e.y += (P.y - 54 - e.y) * .3; }
      if (i % 36 === 20) { P.cds[0] = 0; useSkill(0); }
    };
  });
  const info = {};
  for (const [nm, ci, id, n, mv, z] of [['r1', 3, 0, 60, .08, 3.2], ['r600', 0, 599, 48, .1, 3], ['r1200', 2, 1199, 108, .12, 2.8]]) {
    if (!R.want(nm)) continue;
    await ev(([ci, id, z]) => window.__arena(ci, id, z), [ci, id, z]);
    await R.cap(nm, n, `i => window.__boss(i, ${mv})`);
    info[nm] = await ev(id => { const B = bossDef(id); return { name: B.name, title: B.title, rank: B.rank, band: bossRankName(id), mech: B.mech.map(k => BMECH[k].n) }; }, id);
  }
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info, null, 1)); console.log(JSON.stringify(info));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
