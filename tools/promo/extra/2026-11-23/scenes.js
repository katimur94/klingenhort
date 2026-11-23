// Meme-Clip „Niemand: / Die Balliste der Nordmark:“ (~8 s), Krieg der Kronen 6.8: echte Schlacht (Ritterin für Sylvara gegen die Nordmark)
// ruhe:  die Ritterin spaziert über das Feld, Soldaten und Maschinen sind still (Feld vorher geräumt)
// bolzen: die Balliste der Nordmark zielt (krShot von der echten Maschine, gleiche Vorwarnung) – Streifen am Boden, Rolle heraus, Einschlag
// Aufruf: PROMO_OUT=/tmp/klingenhort-niemand BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-niemand';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 23, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>#hud,#combo{display:none!important}</style>');
    window.__txtNo = /^\d+$/;
    __seed(23); window.__camDX = window.__camDY = 0; activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); computeStats(); P.hp = P.st.hp;
    __vp(3.4); startRoom('krieg', 3, { krSeite: 'sylvara', krFeind: 'nordmark', krZiel: 'linie', krProbe: 1 }); __off();
    // Feld räumen: keine Soldaten, Maschinen schweigen – nur die Balliste bleibt stehen
    window.__ruhe = () => { for (const e of enemies) if (e.kr && !e.mach) e.dead = true; enemies = enemies.filter(e => !e.dead); KR.al = []; for (const m of KR.machs) m.cd = 1e9; KR.vt = KR.at = 1e9; KR.zt = 1e9; KR.moral = 70; P.inv = 1; P.hp = P.st.hp; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
    const p = krPos(.45, .5); P.x = p.x; P.y = p.y; __ruhe(); __step(2); __snap(); window.__p0 = [P.x, P.y];
  });
  await R.cap('ruhe', 45, `i => { __ruhe(); __keys(0, 0, 0, i % 40 < 20, 0); window.__camDX = window.__p0[0] - P.x + 10; window.__camDY = window.__p0[1] - P.y; }`);
  await R.cap('bolzen', 80, `i => { __ruhe(); window.__camDX = 0; window.__camDY = 0; window.__px = (window.__px || []); window.__px[i] = [Math.round(P.x), Math.round(P.y), P.hp > 0, state];
    if (i === 2) { const m = KR.machs.find(m => m.art === 'ballista' && m.team !== KR.side); window.__s = krShot('ballista', P.x, P.y, { team: KR.foe, from: m }); m.an = 1; }
    if (i < 14) __keys(0, 0, 0, 0, 0); else if (i < 18) __keys(0, 1, 0, 0, 0); else __keys(0, 0, 0, 0, 0); if (i === 15) doRoll(); }`);
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(await ev(() => ({ max: window.__s ? window.__s.max : 0, log: KR.log.length, px: window.__px }))));
  await ev(() => __off());
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
