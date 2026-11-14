// Meme-Clip „Endlich eine Truhe … und sie beißt“ (Erwartung → Reinfall → Happy End): echte Mimik-Truhe (js/combat.js openChest)
// truhe: Schatzkammer, Ritterin läuft zur Truhe und schlägt zu – es ist eine Goldmimik (echte Meldung „Eine Goldmimik!“), sie beißt (echter Schaden)
// rache: dieselbe Goldmimik wird besiegt, Gold und Beute springen heraus
// Aufruf: PROMO_OUT=/tmp/klingenhort-mimik BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-mimik';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 14, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    __seed(21); window.__txtNo = null; window.__txtOK = /^-\d+$/;
    activateChar(0); P.lv = 30; computeStats(); P.act = 3; P.map = genMap(3); startRoom('schatz', 3);
    for (const e of enemies) e.dead = true; enemies = []; G.waves = [{ list: [] }]; G.pending = [{ t: 1e9, type: 'imp' }]; G.phase = 'fight';
    obs = obs.filter(o => o.k !== 'chest');
    const c = { k: 'chest', x: P.x + 70, y: P.y - 4, r: 6, solid: true, mimic: true, gold: true, open: 0 }; obs.push(c); window.__c = c;
    P.inv = 0; P.hp = P.st.hp; __vp(3.6); window.__camDX = 24; __step(6); __snap(); window.__log = [];
  });
  // hinlaufen, zuschlagen → Mimik; danach stehen bleiben (wird gebissen)
  await R.cap('truhe', 100, `i => { keys.KeyA = keys.KeyW = keys.KeyS = false; const c = window.__c, d = c.x - P.x; const m = enemies.find(e => !e.dead); keys.KeyD = !m && !c.dead && d > 20 && i > 12; keys.KeyJ = !m && !c.dead && d <= 22; P.hp = Math.max(P.hp, P.st.hp * .3); window.__log.push({ hp: P.hp / P.st.hp, m: m ? 1 : 0 }); }`);
  const log = await ev(() => window.__log);
  fs.writeFileSync(OUT + '/raw/truhe/log.json', JSON.stringify(log));
  // Rache: zuschlagen, bis die Goldmimik besiegt ist
  await ev(() => { window.__log = []; for (const e of enemies) if (!e.dead) { e.hp = e.maxHp * .9; } });
  await R.cap('rache', 90, `i => { const m = enemies.find(e => !e.dead); P.inv = 1; P.hp = P.st.hp; keys.KeyJ = !!m; keys.KeyD = keys.KeyA = false; if (m) { const dx = m.x - P.x; if (Math.abs(dx) > 26) keys[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (i % 20 === 5) { P.cds[0] = 0; useSkill(0); } } window.__log.push({ m: m ? m.hp / m.maxHp : 0, g: P.gold }); }`);
  fs.writeFileSync(OUT + '/raw/rache/log.json', JSON.stringify(await ev(() => window.__log)));
  await ev(() => __off());
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
