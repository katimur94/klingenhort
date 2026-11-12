// Tages-Clip „Mein Versteck: Ruine → ausgebaut“ (Vorher/Nachher + Frage): dieselbe Strecke durchs Versteck, einmal als Ruine (alles Stufe 0, Gerüste),
// einmal ausgebaut (jede Station auf ihrer Höchststufe – so, wie man sie im Spiel ausbauen kann). Stufe des Verstecks (hideTotal) steht in raw/info.json.
// Aufruf: PROMO_OUT=/tmp/klingenhort-versteck BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-versteck';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 12, base: BASE });
  const { ev } = R;
  await R.assets();
  const info = {};
  for (const mode of ['vorher', 'nachher']) {
    info[mode] = await ev(full => {
      __off(); __seed(4); activateChar(0); SAVE.meta.hide.intro = true; const b = SAVE.meta.hide.b; SAVE.meta.hide.q = [];
      for (const k in BUILD) if (!BUILD[k].fixed) b[k] = full ? BUILD[k].lv.length : 0;
      P.map = genMap(5); enterHideout(); __vp(2.6); window.__camDY = -10;
      P.x = BD.x0 + 40; P.y = BD.y0 + (BD.y1 - BD.y0) * .42; P.inv = 1; __step(50); __snap();
      return { lv: hideTotal(), n: Object.keys(BUILD).filter(k => !BUILD[k].fixed).length };
    }, mode === 'nachher');
    // von links nach rechts durch die Mitte, leicht geschwungen (an Lagerfeuer und Stationen vorbei)
    await R.cap(mode, 110, `i => { P.inv = 1; keys.KeyJ = false; keys.KeyD = P.x < BD.x1 - 40; keys.KeyS = i % 60 < 14; keys.KeyW = i % 60 >= 30 && i % 60 < 44; }`);
  }
  await ev(() => __off());
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info)); console.log(JSON.stringify(info));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
