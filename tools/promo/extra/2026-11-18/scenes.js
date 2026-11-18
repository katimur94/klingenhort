// Meme-Clip „Ich allein gegen ein ganzes Heer? … No way.“ (Erwartung → Enthüllung): echte Schlacht aus Krieg der Kronen (js/krieg.js, Ziel „Linie halten“)
// schlacht: EINE durchgehende Aufnahme in der Totale (Zoom 2.4, feste Kamera). Die Ritterin steht vorne, Karths Heer kommt auf sie zu;
//           das eigene Heer wartet die ersten Bilder hinten in seiner Aufstellung (nur festgehalten, sonst unverändert), dann stürmt es,
//           und Aureliens Katapult schießt einmal in Karths Reihen (krShot von der echten Maschine, gleiche Regeln und Vorwarnung).
//           Der Schnitt zeigt zuerst einen nahen Ausschnitt um die Ritterin und zoomt dann auf die Totale heraus.
// Aufruf: PROMO_OUT=/tmp/klingenhort-heer BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-heer';
const BASE = process.env.BASE || 'http://localhost:8766/';
const WAIT = 60;   // so viele Bilder bleibt das eigene Heer in der Aufstellung; die Ritterin wartet bis WAIT + 24, dann kämpft sie mit
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 18, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>#hud,#combo{display:none!important}</style>');
    window.__txtNo = /^\d+$/;
    __seed(18); activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); computeStats(); P.hp = P.st.hp;
    __vp(2.4); startRoom('krieg', 3, { krSeite: 'aurelien', krZiel: 'linie', krProbe: 1 }); window.__kinds = null; __off();
    P.x = 176; P.y = 262; P.vx = P.vy = 0; P.face = -1;
    window.__home = KR.al.map(u => [u, u.x, u.y]);
    window.__hold = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; KR.moral = Math.max(KR.moral, 64); KR.zt = Math.max(KR.zt, 48); };
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
    window.__feind = () => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d) { d = q; b = e; } } return [b, d]; };
    for (const m of KR.machs) m.cd = 99;
    for (let i = 0; i < 3; i++) { for (const [u, x, y] of window.__home) { u.x = x; u.y = y; } __hold(); __cam(176, 250); __step(1); } window.__log = [];
  });
  await R.cap('schlacht', 210, `i => { __hold(); __cam(176, 250);
    if (i < ${WAIT}) { for (const [u, x, y] of window.__home) { u.x = x; u.y = y; u.vx = u.vy = 0; } for (const m of KR.machs) m.cd = 99; KR.at = 9; }
    else if (i === ${WAIT}) { for (const m of KR.machs) if (m.team !== KR.side) m.cd = 3; }
    if (i === ${WAIT} + 4) { const m = KR.machs.find(m => m.team === KR.side); const [b] = __feind(); const t = b || { x: 176, y: 210 }; krShot(m.art, t.x, t.y - 6, { team: KR.side, from: m }); m.an = 1; }
    const [b, d] = __feind(); const far = b && d > 20;
    if (i < ${WAIT} + 24) __keys(0, 0, 0, 0, 0); else __keys(far && b.y < P.y - 4, far && b.x < P.x - 4, far && b.y > P.y + 4, far && b.x > P.x + 4, b && d < 40);
    window.__log.push({ px: P.x, py: P.y, al: KR.al.length, foe: enemies.filter(e => e.kr && !e.dead && !e.mach).length }); }`);
  fs.writeFileSync(OUT + '/raw/schlacht/log.json', JSON.stringify(await ev(() => window.__log)));
  await ev(() => __off());
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
