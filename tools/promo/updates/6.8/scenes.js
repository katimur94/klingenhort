// Aufnahmen für den TikTok-Clip zu 6.8 „Krieg der Kronen 2 – Fünf Kronen“ (~15 s), alles echte Szenen aus js/krieg.js:
// hook:   Schlacht Nordmark gegen Sylvara (die zwei neuen Reiche), die Ritterin kämpft für die Nordmark
// bolzen: Ritterin für Sylvara, die Balliste der Nordmark zielt – Streifen am Boden, die Ritterin rollt heraus, der Bolzen schlägt ein
// eryn:   Waldmeisterin Eryn (Hauptfrau von Sylvara) legt ihren Dornenring, die Ritterin rollt heraus
// wahl:   Seitenwahl an der Front Nordmark gegen Sylvara (Standbild des echten Bildschirms)
// akt:    Chronik Akt 1 · Karth, Kapitel 3 „Der Gast in Violett“ (echter Dialog)
// Beschuss wird mit krShot von der echten Maschine ausgelöst (gleiche Regeln, gleiche Vorwarnung) – nur der Zeitpunkt ist festgelegt.
// Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.8 BASE=http://localhost:8766/ node scenes.js [szene,…]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.8';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 68, base: BASE });
  const { ev, page } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>#hud,#combo{display:none!important}</style>');
    window.__txtNo = /^\d+$/;
    window.__krieg = (ci, ziel, seite, feind, zoom, act, pre) => {
      window.__camDX = window.__camDY = 0; activateChar(ci); P.lv = 40; P.act = act; P.maxAct = 9; P.map = genMap(act); computeStats(); P.hp = P.st.hp;
      __vp(zoom); startRoom('krieg', 3, { krSeite: seite, krFeind: feind, krZiel: ziel, krProbe: 1 }); window.__kinds = null; __off();
      for (let i = 0; i < (pre || 0); i++) { __hold(); __step(1); }
    };
    window.__hold = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; KR.moral = Math.max(KR.moral, 64); if (KR.ziel === 'linie') KR.zt = Math.max(KR.zt, 48); };
    window.__still = () => { for (const m of KR.machs) m.cd = 99; };
    window.__go = (x, y) => { P.x = x; P.y = y; P.vx = P.vy = 0; __snap(); };
    window.__mach = (art, own) => KR.machs.find(m => m.art === art && (m.team === KR.side) === !!own);
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    window.__kampf = (cx, cy, rad) => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d && Math.hypot(e.x - cx, e.y - cy) < rad) { d = q; b = e; } }
      const tx = b ? b.x : cx, ty = b ? b.y + 4 : cy, dx = tx - P.x, dy = ty - P.y, n = b ? 20 : 5, far = Math.hypot(dx, dy) > n; __keys(far && dy < -4, far && dx < -4, far && dy > 4, far && dx > 4, !!b && d < 60); return b; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
  });
  // --- Hook: die zwei neuen Reiche prallen aufeinander ---
  if (R.want('hook')) {
    await ev(() => { __seed(5); __krieg(0, 'linie', 'nordmark', 'sylvara', 3, 8, 170); __go(176, 300); for (let i = 0; i < 10; i++) { __hold(); __kampf(176, 296, 40); __cam(176, 288); __step(1); } });
    await R.cap('hook', 70, `i => { __hold(); __kampf(176, 292, 44); __cam(176, 286 - i * .15); }`);
  }
  // --- Balliste: Streifen am Boden, heraus rollen, Einschlag ---
  if (R.want('bolzen')) {
    await ev(() => { __seed(31); __krieg(0, 'linie', 'sylvara', 'nordmark', 3.2, 8, 170); __still(); __go(176, 292); for (let i = 0; i < 12; i++) { __hold(); __kampf(176, 292, 30); __cam(P.x, P.y); __step(1); } window.__f = [P.x, P.y]; });
    await R.cap('bolzen', 90, `i => { __hold(); __still(); __cam(__f[0], __f[1]);
      if (i === 2) { const m = __mach('ballista'); krShot('ballista', __f[0], __f[1], { team: KR.foe, from: m }); m.an = 1; }
      if (i < 16) __kampf(__f[0], __f[1], 30); else if (i < 22) __keys(0, 0, 1, 0, 0); else if (i < 48) { const dy = __f[1] + 34 - P.y; __keys(dy < -4, 0, dy > 4, 0, 0); } else __kampf(__f[0], __f[1] + 30, 40); if (i === 17) doRoll(); }`);
    fs.writeFileSync(OUT + '/raw/bolzen/info.json', JSON.stringify(await ev(() => ({ log: KR.log.length }))));
  }
  // --- Waldmeisterin Eryn: Dornenring, heraus rollen ---
  if (R.want('eryn')) {
    await ev(() => { __seed(83); window.__txtNo = null; __krieg(0, 'hauptmann', 'nordmark', 'sylvara', 3.3, 8, 120); __still(); KR.ht = 0; for (let i = 0; i < 150; i++) { __hold(); __cam(P.x, P.y); __step(1); if (KR.hpt) KR.hpt.kr.mt = 9; }
      const h = KR.hpt; __go(h.x - 16, h.y + 26); for (let i = 0; i < 8; i++) { __hold(); h.kr.mt = 9; __keys(0, 0, 0, 0, 1); __cam(h.x, h.y + 16); __step(1); } window.__cy = [h.x, h.y + 16]; h.kr.n = 1; });
    await R.cap('eryn', 96, `i => { __hold(); __still(); const h = KR.hpt; if (!h) return; h.hp = Math.max(h.hp, h.maxHp * .45); if (i < 8) h.kr.mt = 9; if (i === 8) { h.kr.mt = 0; h.kr.tt = 0; } if (i > 10) h.kr.mt = Math.max(h.kr.mt, 4);
      const c = window.__cy; c[0] += (h.x - c[0]) * .12; c[1] += (h.y + 16 - c[1]) * .12; __cam(c[0], c[1]);
      const dx = h.x - P.x, dy = h.y - P.y, d = Math.hypot(dx, dy), raus = i >= 14 && i < 34;
      if (raus) __keys(0, 0, 1, 0, 0); else __keys(d > 22 && dy < -4, d > 22 && dx < -4, d > 22 && dy > 4, d > 22 && dx > 4, d < 44); if (i === 15) doRoll(); }`);
    await ev(() => { window.__txtNo = /^\d+$/; });
  }
  // --- Seitenwahl an der Front Nordmark gegen Sylvara ---
  if (R.want('wahl')) {
    await ev(() => { __off(); activateChar(0); P.act = 4; P.map = genMap(4); SAVE.meta.krieg.pro = 1; window.krFront = () => ['nordmark', 'sylvara']; __vp(3); krWahl(3); panel.scrollTop = 0; __step(2); });
    await page.waitForTimeout(300);
    await R.cap('wahl', 30, `i => { panel.scrollTop = Math.min(i * 3, 60); }`);
    await ev(() => { hideOverlay(); });
  }
  // --- Chronik Akt 1 · Karth, Kapitel 3: der Gast in Violett ---
  if (R.want('akt')) {
    await ev(() => { __off(); activateChar(0); const M = SAVE.meta.krieg; M.r.karth.sg = 6; ON.kr_akt('karth:2'); });
    await page.waitForTimeout(300);
    await R.cap('akt', 40, `i => { if (i === 20 && DLG) DLG.next(); }`);
  }
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
