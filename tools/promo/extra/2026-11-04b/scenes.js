// Meme-Clip „Mythisch gefunden … LAUF!“ (~12 s): echte Aufnahmen
// see: Heldin entdeckt ein mythisches Schwert am Boden und schleicht hin · boss: Pyraxis und Horde tauchen hinter der Beute auf
// run: Flucht nach links, alles hinterher · back: drei Sekunden später zurück, Schwert geschnappt – Pyraxis steht daneben
// Aufruf: PROMO_OUT=/tmp/klingenhort-meme-2 BASE=http://localhost:8766/ node scenes.js
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-meme-2';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 77, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  // Hilfen im Browser: leerer Raum, Schwert am Boden, Pyraxis + Horde rufen
  await ev(() => {
    window.__room = () => {
      __seed(9); __fight(0, 6, [], {}); for (const e of enemies) e.dead = true; enemies = []; window.__kinds = null;
      P.inv = 999; P.x -= 60; G.pending = [{ t: 1e9, type: 'imp' }];   // Raum gilt nie als geschafft (sonst geht die Karte auf)
      window.__camDX = 40; __step(4); __vp(3.2); __snap();
      const it = makeItem({ slot: 'weapon', base: 'sword', tier: 7, rar: 6, myth: 'klinge' });
      pickups.push({ k: 'loot', it, x: P.x + 120, y: P.y + 4, z: 0, vz: 0, vx: 0, vy: 0, t: 1 }); window.__loot = pickups[pickups.length - 1];
    };
    window.__boss = (dx, dy) => {
      const L = window.__loot, B = BOSSES.find(b => b.type === 'pyraxis');
      const e = spawnEnemy(B.type, { boss: true, sc: B.sc, hpMul: 60, name: B.name, tint: B.tint, x: L.x + (dx || 40), y: L.y + (dy || -20), instant: true }); e.cd = 1.2;
      $('bossName').textContent = B.name.toUpperCase(); $('bossbar').hidden = false;
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; spawnEnemy(['imp', 'chort', 'skeleton'][i % 3], { x: L.x + 40 + Math.cos(a) * 46, y: L.y + Math.sin(a) * 34, instant: true }); }
    };
    window.__go = (dx, dy) => { keys.KeyJ = false; keys.KeyD = dx > 0; keys.KeyA = dx < 0; keys.KeyS = dy > 0; keys.KeyW = dy < 0; };
  });
  // 1) entdeckt und hinschleichen (bleibt vor dem Schwert stehen)
  if (R.want('see')) {
    await ev(() => window.__room());
    await R.cap('see', 66, `i => { P.inv = 999; const L = window.__loot; __go(L.x - P.x > 34 && i > 8 ? 1 : 0, 0); }`);
  }
  // 2) der Drache taucht hinter der Beute auf
  if (R.want('boss')) {
    await ev(() => { __go(0, 0); window.__boss(44, -24); });
    await R.cap('boss', 42, `i => { P.inv = 999; __go(0, 0); __holdBoss(-10); }`);
  }
  // 3) Flucht nach links (mit Rolle), alles hinterher
  if (R.want('run')) {
    await R.cap('run', 96, `i => { P.inv = 999; P.hp = P.st.hp; __go(-1, i % 40 < 20 ? 1 : -1); for (const e of enemies) if (e.boss) { e.tcd = 9; e.x += (P.x + 78 - e.x) * .2; e.y += (P.y - 14 - e.y) * .2; } else if (Math.hypot(e.x - P.x, e.y - P.y) < 26) { e.x += 3; } if (i === 10 || i === 50) { P.roll = 0; keys.KeyK = true; } else keys.KeyK = false; }`);
  }
  // 4) drei Sekunden später: zurück, Schwert geschnappt – und Pyraxis steht direkt daneben
  if (R.want('back')) {
    await ev(() => { window.__room(); const L = window.__loot; P.x = L.x - 70; __snap(); });
    await R.cap('back', 66, `i => { P.inv = 999; const L = window.__loot; __go(i > 4 && !L.got ? 1 : 0, 0); if (i === 40) window.__boss(20, -30); if (i > 40) __holdBoss(-6); }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
