// Tages-Clip „5 Welten in 10 Sekunden“ (~12 s): echte Orte der Endlosen Lande, je ein Biom pro Schlag
// Die Biome werden in der festen Welt gesucht (gleiche Welt für alle Spieler), der Held läuft kurz durch
// Aufruf: PROMO_OUT=/tmp/klingenhort-biome BASE=http://localhost:8765/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-biome';
const WANT = ['wiese', 'gletscher', 'vulkan', 'kristall', 'mondsee', 'sternenfeld', 'pilzriesen', 'sturmklippen'];
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 8 });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  // Biome in der festen Welt suchen: Region für Region entlang von Strahlen
  const found = await ev(WANT => {
    activateChar(3); lBegin(); window.__txtNo = /^\d+$/;
    const f = {};
    for (let r = 4; r < 2600 && Object.keys(f).length < WANT.length; r += 6) for (let a = 0; a < 24; a++) {
      const cx = Math.cos(a / 24 * 6.283) * r, cy = Math.sin(a / 24 * 6.283) * r, R = lRegAtC(cx, cy);
      if (WANT.includes(R.biome) && !f[R.biome]) f[R.biome] = [R.sx, R.sy];
    }
    return f;
  }, WANT);
  console.log('gefunden', JSON.stringify(found));
  const list = WANT.filter(b => found[b]).slice(0, 6), info = [];
  for (const b of list) {
    await ev(([x, y]) => {
      const CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };
      lTeleport(x * LCK + LOFF, y * LCK + LOFF); CALM(); P.inv = 1e9; __vp(3.2); for (let i = 0; i < 60; i++) { LW.tick = 0; __step(1); CALM(); } __snap();
    }, found[b]);
    await R.cap(b, 36, `i => { P.inv = 1e9; LW.huntT = 1e9; LW.rivT = 1e9; keys.KeyD = true; keys.KeyS = i % 24 < 8; keys.KeyJ = false; }`);
    info.push(await ev(() => ({ b: LW.reg ? LW.reg.biome : '', n: LANDE_BIOMES[lRegAt(P.x, P.y).biome].n, reg: lRegName(lRegAt(P.x, P.y)), st: lStage(P.x, P.y) })));
  }
  await ev(() => { keys.KeyD = keys.KeyS = false; });
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify({ list, info }));
  console.log(JSON.stringify(info));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
