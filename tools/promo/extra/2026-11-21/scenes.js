// Frage-Clip „Welches Reich bist du? 1 · 2 · 3 · 4“ (Krieg der Kronen, Stand 6.8): vier echte Schlachten, je eine für jedes Reich an der Front
// r1 Aurelien (gegen Karth) · r2 Nordmark (gegen Sylvara) · r3 Sylvara (gegen Nordmark) · r4 Karth (gegen Aurelien) – die Ritterin kämpft jeweils mit
// Aufruf: PROMO_OUT=/tmp/klingenhort-reiche BASE=http://localhost:8766/ node scenes.js
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-reiche';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 21, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>#hud,#combo{display:none!important}</style>');
    window.__txtNo = /^\d+$/;
    window.__hold = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; KR.moral = Math.max(KR.moral, 64); KR.zt = Math.max(KR.zt, 48); };
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
    window.__kampf = (cx, cy, rad) => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d && Math.hypot(e.x - cx, e.y - cy) < rad) { d = q; b = e; } }
      const tx = b ? b.x : cx, ty = b ? b.y + 4 : cy, dx = tx - P.x, dy = ty - P.y, n = b ? 20 : 5, far = Math.hypot(dx, dy) > n; __keys(far && dy < -4, far && dx < -4, far && dy > 4, far && dx > 4, !!b && d < 60); };
    window.__reich = (seite, feind, seed) => {
      __seed(seed); window.__camDX = window.__camDY = 0; activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); computeStats(); P.hp = P.st.hp;
      __vp(3.2); startRoom('krieg', 3, { krSeite: seite, krFeind: feind, krZiel: 'linie', krProbe: 1 }); window.__kinds = null; __off();
      for (let i = 0; i < 150; i++) { __hold(); __step(1); }
      P.x = 176; P.y = 300; P.vx = P.vy = 0; for (let i = 0; i < 8; i++) { __hold(); __kampf(176, 296, 44); __cam(176, 300); __step(1); }
    };
  });
  const L = [['r1', 'aurelien', 'karth', 11], ['r2', 'nordmark', 'sylvara', 12], ['r3', 'sylvara', 'nordmark', 13], ['r4', 'karth', 'aurelien', 14]];
  for (const [n, s, f, sd] of L) {
    await ev(([s, f, sd]) => __reich(s, f, sd), [s, f, sd]);
    await R.cap(n, 48, `i => { __hold(); __kampf(176, 296, 46); __cam(176, 300 - i * .2); }`);
  }
  await ev(() => __off());
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
