// Tages-Clip „Von Grau bis Mythisch“ (Fund-Clip + Frage, ~12 s): sechs echte Beute-Drops, je Seltenheit ein Schlag
// Je Stufe: leerer Raum, die Beute springt neben der Heldin aus dem Boden (dropItem, wie bei einem Gegner-Drop) und wird aufgehoben.
// Aufruf: PROMO_OUT=/tmp/klingenhort-rar BASE=http://localhost:8766/ node scenes.js
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-rar';
const BASE = process.env.BASE || 'http://localhost:8766/';
const RARS = [0, 1, 2, 3, 4, 6];   // Gewöhnlich, Magisch, Selten, Episch, Legendär, Mythisch
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 31, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__room = (rar) => {
      __seed(12 + rar); __fight(0, 6, [], {}); for (const e of enemies) e.dead = true; enemies = [];
      P.inv = 999; G.pending = [{ t: 1e9, type: 'imp' }]; window.__camDX = 18; __step(4); __vp(3.6); __snap();
      const it = makeItem(Object.assign({ slot: 'weapon', base: 'sword', tier: 6, rar }, rar === 6 ? { myth: 'klinge' } : {}));
      dropItem(P.x + 34, P.y + 2, it); window.__loot = pickups[pickups.length - 1]; window.__loot.vz = 160;
    };
    window.__go = (dx) => { keys.KeyJ = false; keys.KeyD = dx > 0; keys.KeyA = dx < 0; keys.KeyS = keys.KeyW = false; };
  });
  for (const r of RARS) {
    const nm = 'r' + r;
    if (!R.want(nm)) continue;
    await ev(r => window.__room(r), r);
    await R.cap(nm, 36, `i => { P.inv = 999; __go(i > 16 ? 1 : 0); }`);
  }
  await ev(() => window.__go(0));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
