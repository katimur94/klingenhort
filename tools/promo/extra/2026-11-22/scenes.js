// Biom-Clip „3 Orte in den Endlosen Landen, wo es vom Himmel regnet“ (~11 s): die drei Kriegs-Biome (Krieg der Kronen, js/krieg.js KR_LANDE)
// Schildgraben (Pfeilhagel) · Verbrannte Mark (Katapulte) · Aschefront (Meteore). Die Biome werden in der festen Welt gesucht; der Beschuss ist der
// echte Beschuss der Lande (krShot, gleiche Vorwarnung) – nur der Zeitpunkt ist festgelegt; der Held läuft heraus.
// Aufruf: PROMO_OUT=/tmp/klingenhort-front BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-front';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 22, base: BASE });
  const { ev } = R;
  await R.assets();
  const found = await ev(() => {
    activateChar(0); lBegin(); window.__txtNo = /^\d+$/; SAVE.meta.lande.tips = 0xffff;
    const f = {}, K = Object.keys(KR_LANDE);
    for (let r = 8; r < 1510 && Object.keys(f).length < 3; r += r < 60 ? 1 : 4) for (let a = 0; a < 6.283; a += Math.max(.02, 2 / r)) { const c = lCell(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); if (KR_LANDE[c.biome] && !f[c.biome]) f[c.biome] = [c.sx, c.sy]; }
    return K.map(k => [k, f[k], LANDE_BIOMES[k].n, KR_LANDE[k][0]]);
  });
  console.log(JSON.stringify(found));
  const info = [];
  for (const [b, xy, n, art] of found) {
    if (!xy) continue;
    await ev(([x, y]) => { lTeleport(x * LCK + LOFF, y * LCK + LOFF); P.inv = 1e9; LW.huntT = LW.rivT = 1e9; KR.lt = 1e9; __vp(3.2); for (let i = 0; i < 50; i++) { LW.tick = 0; KR.lt = 1e9; __step(1); } KR.shots.length = 0; __snap(); }, xy);
    await R.cap(b, 60, `i => { P.inv = 1e9; LW.huntT = LW.rivT = 1e9; KR.lt = 1e9; if (i === 3) { window.__s = krShot('${art}', P.x, P.y, { team: 'x' }); } keys.KeyD = i >= 9 && i < 44; keys.KeyS = false; keys.KeyJ = false; }`);
    info.push({ b, n, art });
  }
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info));
  await ev(() => { keys.KeyD = false; });
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
