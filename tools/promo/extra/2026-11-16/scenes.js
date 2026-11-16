// Tages-Clip „Pfeilhagel: stehen bleiben oder Deckung?“ (Mini-Tutorial falsch/richtig zum neuen Krieg der Kronen, 6.6) – echte Schlacht aus js/krieg.js
// falsch:  die Ritterin bleibt im angekündigten Pfeilhagel stehen – echter Schaden (Leben je Bild in raw/falsch/log.json)
// richtig: derselbe Pfeilhagel, sie rollt hinter den Schildwall – „GEDECKT“, kein Schaden
// Der Pfeilhagel kommt mit krShot von der echten Maschine (gleiche Regeln und Vorwarnung), nur der Zeitpunkt ist festgelegt. Keine Unverwundbarkeit.
// Aufbau wie tools/promo/updates/kdk-trailer/scenes.js. Aufruf: PROMO_OUT=/tmp/klingenhort-deckung BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-deckung';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 16, base: BASE });
  const { ev } = R;
  await R.assets();
  await ev(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>#combo{display:none!important}</style>');
    window.__txtNo = null; window.__txtOK = /GEDECKT|^-\d+$/;
    window.__krieg = (zoom, pre) => {
      window.__camDX = window.__camDY = 0; activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); computeStats(); P.hp = P.st.hp; P.potions = 0;
      __vp(zoom); startRoom('krieg', 3, { krSeite: 'aurelien', krZiel: 'linie', krProbe: 1 }); window.__kinds = null; __off();
      for (let i = 0; i < pre; i++) { P.inv = 1; __hold(); __step(1); }
      P.inv = 0; P.hp = P.st.hp; window.__log = [];
    };
    window.__hold = () => { KR.moral = Math.max(KR.moral, 64); if (KR.ziel === 'linie') KR.zt = Math.max(KR.zt, 48); for (const m of KR.machs) m.cd = 99; };
    window.__go = (x, y) => { P.x = x; P.y = y; P.vx = P.vy = 0; __snap(); };
    window.__mach = () => KR.machs.find(m => m.art === 'pfeil' && m.team !== KR.side);
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
    // Soldaten des Feindes vom Helden fernhalten (es geht nur um den Pfeilhagel)
    window.__frei = () => { for (const e of enemies) if (e.kr && !e.dead && !e.mach && Math.hypot(e.x - P.x, e.y - P.y) < 46) { e.y -= 3; } };
  });
  for (const mode of ['falsch', 'richtig']) {
    await ev(() => { __seed(61); __krieg(3.5, 150); const c = KR.cover[0]; window.__c = c; __go(c.x + 52, c.y + 16); __cam(c.x + 20, c.y + 8); __step(2); P.hp = P.st.hp; window.__log = []; });
    await R.cap(mode, 96, mode === 'falsch'
      ? `i => { __hold(); __frei(); const c = window.__c; __cam(c.x + 20, c.y + 8); __keys(0, 0, 0, 0, 0); if (i === 4 || i === 46) { const m = __mach(); krShot('pfeil', P.x, P.y, { team: KR.foe, from: m }); m.an = 1; } window.__log.push(P.hp / P.st.hp); }`
      : `i => { __hold(); __frei(); const c = window.__c, dx = c.x + 1 - P.x, dy = c.y + 12 - P.y; __cam(c.x + 20, c.y + 8); if (i === 4) { const m = __mach(); krShot('pfeil', P.x, P.y, { team: KR.foe, from: m }); m.an = 1; } if (i === 46) { const m = __mach(); krShot('pfeil', c.x - 2, c.y + 11, { team: KR.foe, from: m }); }
        if (i < 10) __keys(0, 0, 0, 0, 0); else __keys(dy < -3, dx < -3, dy > 3, dx > 3, 0); if (i === 13) doRoll(); window.__log.push(P.hp / P.st.hp); }`);
    fs.writeFileSync(`${OUT}/raw/${mode}/log.json`, JSON.stringify(await ev(() => ({ log: window.__log, hpmax: P.st.hp, cover: !!krCover(P.x, P.y) }))));
  }
  await ev(() => __off());
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
