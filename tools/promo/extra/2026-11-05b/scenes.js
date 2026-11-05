// Meme-Clip „Der Schatzgoblin“ (~10 s): Erwartung → Reinfall, echte Aufnahmen
// see: Schatzgoblin taucht auf · chase: Magier rennt hinterher – und vergisst anzugreifen (Held schlägt nie zu)
// gone: seine 20 Sekunden sind um – er verpufft (echtes Entkommen aus js/combat.js)
// Aufruf: PROMO_OUT=/tmp/klingenhort-gob BASE=http://localhost:8767/ node scenes.js [szene]
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-gob';
const BASE = process.env.BASE || 'http://localhost:8767/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 5, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__txtNo = /^\d+$/;
    window.__room = () => {
      __seed(12); __fight(1, 4, [], {}); for (const e of enemies) e.dead = true; enemies = []; window.__kinds = null;
      P.inv = 999; G.pending = [{ t: 1e9, type: 'imp' }]; __vp(3.6); window.__camDX = 30; __snap();
      const g = spawnEnemy('goldgob', { tint: 'rgba(255,210,60,.45)', x: P.x + 70, y: P.y - 6, instant: true }); g.escape = 20; G.goldgob = g; window.__gob = g;
    };
    // Kamera zwischen Held und Goblin, damit beide im Bild sind
    window.__frame = () => { const g = window.__gob; window.__camDX = g && !g.dead ? clamp((g.x - P.x) / 2, -90, 90) : window.__camDX; window.__camDY = g && !g.dead ? clamp((g.y - P.y) / 2, -40, 40) : window.__camDY; };
    window.__go = (dx, dy) => { keys.KeyJ = false; keys.KeyD = dx > 0; keys.KeyA = dx < 0; keys.KeyS = dy > 0; keys.KeyW = dy < 0; };
    // Held läuft auf den Goblin zu (mit Rolle)
    window.__chase = (i, roll) => {
      P.inv = 999; P.hp = P.st.hp; const g = window.__gob; if (!g || g.dead) { __go(0, 0); return; }
      const dx = g.x - P.x, dy = g.y - P.y; __go(Math.abs(dx) > 8 ? Math.sign(dx) : 0, Math.abs(dy) > 8 ? Math.sign(dy) : 0);
      keys.KeyK = roll && i % 24 === 6; if (keys.KeyK) P.roll = 0;
    };
  });
  if (R.want('see')) { await ev(() => window.__room()); await R.cap('see', 48, `i => { window.__frame(); P.inv = 999; __go(0, 0); window.__gob.escape = 20; }`); }
  if (R.want('chase')) { await ev(() => { window.__room(); __step(4); }); await R.cap('chase', 96, `i => { window.__frame(); window.__chase(i, true); window.__gob.escape = 20; }`); }
  // seine Zeit ist um: er verpufft
  if (R.want('gone')) {
    await ev(() => { window.__room(); const g = window.__gob; g.x = P.x + 60; __step(2); });
    await R.cap('gone', 60, `i => { window.__frame(); P.inv = 999; __go(0, 0); const g = window.__gob; if (i < 12) g.escape = 20; else if (i === 12) g.escape = .05; }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
