// Boss-Clip „Speedrun: Sturmkönig Aerok“ (Challenge): echter Boss-Raum von Akt 9 (Sturmgipfel), die Ritterin auf LV 100 spielt selbst (einfacher Bot:
// nächstes Ziel angreifen, Fähigkeiten und Ultimative sobald bereit, aus angekündigten Blitzen heraus). Leben je Bild in raw/kampf/log.json.
// Aufruf: PROMO_OUT=/tmp/klingenhort-aerok BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-aerok';
const BASE = process.env.BASE || 'http://localhost:8766/';
const N = +(process.env.N || 420);
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: +(process.env.SEED || 24), base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    window.__txtNo = null;
    activateChar(0); P.lv = 100; P.act = 9; P.maxAct = 9; P.map = genMap(9); computeStats(); P.hp = P.st.hp; P.potions = 9;
    __vp(3); startRoom('boss', 6); hideOverlay(); setState('play'); __off();
    window.__boss = () => enemies.find(e => e.boss && !e.dead);
    window.__bot = i => {
      const B = __boss(); let t = B, d = 1e9;
      for (const e of enemies) if (!e.dead && e.st !== 'spawn') { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d && (!B || e === B || q < 40)) { d = q; t = e; } }
      keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false; keys.KeyJ = false;
      if (!t) return;
      const dx = t.x - P.x, dy = t.y - P.y, dd = Math.hypot(dx, dy);
      if (dd > 22) { keys.KeyD = dx > 6; keys.KeyA = dx < -6; keys.KeyS = dy > 6; keys.KeyW = dy < -6; }
      keys.KeyJ = dd < 40;
      for (let s = 0; s < 3; s++) if (P.cds[s] <= 0 && dd < 50 && i % 7 === s) useSkill(s);
      if (P.rage >= 100 && dd < 60) doUlt();
      if (P.hp < P.st.hp * .45 && P.potions > 0 && i % 30 === 0) usePotion && usePotion();
    };
    // Vorlauf: Welle vor dem Boss ohne Kamera
    for (let i = 0; i < 2400 && !__boss(); i++) { __bot(i); __step(1); }
    __snap(); window.__log = [];
  });
  await R.cap('kampf', N, `i => { __bot(i); const B = __boss() || enemies.find(e => e.boss); window.__log.push({ bh: B ? Math.max(0, B.hp / B.maxHp) : 0, ph: P.hp / P.st.hp, dead: !B || B.dead || B.hp <= 0, t: G ? T - G.startTime : 0 }); }`);
  fs.writeFileSync(OUT + '/raw/kampf/log.json', JSON.stringify(await ev(() => window.__log)));
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(await ev(() => ({ boss: (BOSSES.find(b => b.type === 'aerok') || {}).name, lv: P.lv }))));
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
