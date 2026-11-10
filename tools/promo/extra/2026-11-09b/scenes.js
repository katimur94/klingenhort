// Tages-Clip „Wie viele Bäume in 10 Sekunden?“ (Challenge + oddly satisfying): Ritterin fällt in den Endlosen Landen
// echte Bäume mit echten Angriffen; Zähler (gefällte Bäume, Holz) kommt aus gatherInfo() und wird je Bild mitgeschrieben.
// Aufruf: PROMO_OUT=/tmp/klingenhort-holz BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-holz';
const BASE = process.env.BASE || 'http://localhost:8766/';
const WANT = ['uralt', 'tannen', 'nebelwald', 'dschungel', 'wiese', 'herbst'];
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 77, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  // dichtesten Wald suchen: Regionen der festen Welt durchgehen, Bäume um die Mitte zählen
  const best = await ev(WANT => {
    activateChar(0); lBegin(); window.__txtNo = /^\d+$/;
    window.__CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };
    const cand = [];
    for (let r = 4; r < 1400 && cand.length < 14; r += 9) for (let a = 0; a < 16; a++) {
      const cx = Math.cos(a / 16 * 6.283) * r, cy = Math.sin(a / 16 * 6.283) * r, Rg = lRegAtC(cx, cy);
      if (WANT.includes(Rg.biome) && !cand.some(c => c.sx === Rg.sx && c.sy === Rg.sy)) cand.push({ b: Rg.biome, sx: Rg.sx, sy: Rg.sy });
    }
    let top = null;
    for (const c of cand) {
      lTeleport(c.sx * LCK + LOFF, c.sy * LCK + LOFF); __CALM();
      const n = lNear(P.x, P.y, 160).filter(o => o.k === 'prop' && !o.gone && GPROP[o.t] === 'baum' && o.r > 0).length;
      if (!top || n > top.n) top = Object.assign({ n }, c);
    }
    return top;
  }, WANT);
  console.log('Wald', JSON.stringify(best));
  await ev(([x, y]) => {
    lTeleport(x * LCK + LOFF, y * LCK + LOFF); __CALM(); P.inv = 1e9; __vp(3.4);
    for (let i = 0; i < 30; i++) { LW.tick = 0; __step(1); __CALM(); }
    window.__log = [];
    // je Bild: zum nächsten stehenden Baum gehen und zuschlagen
    window.__chop = i => {
      __CALM(); P.inv = 1e9; keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
      let t = null, bd = 1e9;
      for (const o of lNear(P.x, P.y, 260)) if (o.k === 'prop' && !o.gone && GPROP[o.t] === 'baum' && o.r > 0) { const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < bd) { bd = d; t = o; } }
      if (t && bd > t.r + 12) { const dx = t.x - P.x, dy = t.y - P.y; if (Math.abs(dx) > 4) keys[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (Math.abs(dy) > 4) keys[dy > 0 ? 'KeyS' : 'KeyW'] = true; keys.KeyJ = false; }
      else keys.KeyJ = true;
      const g = gatherInfo(); window.__log.push({ i, n: g.tripGone || 0, holz: (g.trip || {}).holz || 0 });
    };
    __snap();
  }, [best.sx, best.sy]);
  await R.cap('chop', 300, `i => window.__chop(i)`);
  const log = await ev(() => { keys.KeyJ = keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false; return window.__log; });
  fs.writeFileSync(OUT + '/raw/log.json', JSON.stringify({ best, log }));
  console.log('Bäume', log[log.length - 1]);
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
