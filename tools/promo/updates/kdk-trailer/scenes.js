// Trailer „Krieg der Kronen“ (~41 s): alle Spielszenen sind echte Aufnahmen aus js/krieg.js (Kapitel 1, Version 6.6)
// offen:    Totale der Schlacht, Magiehagel des Glutwerfers schlägt in die Reihen (Kaltstart)
// heere:    Aurelien gegen Karth, Ziel „Linie halten“ – die Maschinen feuern von selbst
// pfeil:    Pfeilhagel (Schatten am Boden), die Ritterin rollt heraus, die Pfeile bleiben stecken
// katapult: der Magier kämpft für Karth, Aureliens Katapult schleudert einen Stein – Krater
// magie:    Magiehagel, der Boden brennt weiter
// deckung:  Pfeilhagel auf den Schildwall – die Ritterin rollt dahinter (Schild-Zeichen, „GEDECKT“)
// maschine: Ziel „Kriegsmaschine nehmen“ – Wachen fallen, der Ring „EROBERN“ füllt sich, der Glutwerfer wechselt die Farbe
// duell:    Ziel „Hauptmann besiegen“ – Hauptfrau Sareth legt ihren Flammenring, die Ritterin rollt heraus
// wahl:     Bildschirm „Seite wählen“ (Standbild) · wappen: Wappen und Daten der fünf Reiche aus REICHE, Soldaten der zwei Reiche an der Front
// Beschuss wird mit krShot von der echten Maschine ausgelöst (gleiche Regeln, gleiche Vorwarnung) – nur der Zeitpunkt ist festgelegt.
// Aufruf: PROMO_OUT=/tmp/klingenhort-kdk-trailer BASE=http://localhost:8795/ node scenes.js [szene,szene]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-kdk-trailer';
const BASE = process.env.BASE || 'http://localhost:8795/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 66, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    // Kopfzeile des Spiels (Leben, Gold, Pause) ausblenden – die Schlacht-Anzeige (Ziel + Moral) bleibt
    document.head.insertAdjacentHTML('beforeend', '<style>#hud,#combo{display:none!important}</style>');
    window.__txtNo = /^\d+$/; window.__txtOK = /GEDECKT|Brennt|Asche/;
    // Schlacht: Held ci, Ziel, Seite, Zoom, Akt (Farbe des Bodens), pre = Bilder Vorlauf (die Heere treffen aufeinander)
    window.__krieg = (ci, ziel, seite, zoom, act, pre) => {
      window.__camDX = window.__camDY = 0; activateChar(ci); P.lv = 40; P.act = act; P.maxAct = 9; P.map = genMap(act); computeStats(); P.hp = P.st.hp;
      __vp(zoom); startRoom('krieg', 3, { krSeite: seite, krZiel: ziel, krProbe: 1 }); window.__kinds = null; __off();
      for (let i = 0; i < (pre || 0); i++) { __hold(); __step(1); }
    };
    // Held bleibt am Leben, die Moral kippt nicht während der Aufnahme
    window.__hold = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; KR.moral = Math.max(KR.moral, 64); if (KR.ziel === 'linie') KR.zt = Math.max(KR.zt, 48); };
    window.__still = () => { for (const m of KR.machs) m.cd = 99; };          // Maschinen schweigen: Beschuss kommt zum festgelegten Zeitpunkt
    window.__go = (x, y) => { P.x = x; P.y = y; P.vx = P.vy = 0; __snap(); };
    window.__mach = (art, own) => KR.machs.find(m => m.art === art && (m.team === KR.side) === !!own);
    window.__feind = () => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d) { d = q; b = e; } } return b; };
    // feste Kamera auf einen Punkt des Feldes (pro Bild aufrufen)
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    // Held kämpft um den Punkt (cx, cy): nächster Feind im Umkreis rad, sonst zurück zum Punkt
    window.__kampf = (cx, cy, rad) => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d && Math.hypot(e.x - cx, e.y - cy) < rad) { d = q; b = e; } }
      const tx = b ? b.x : cx, ty = b ? b.y + 4 : cy, dx = tx - P.x, dy = ty - P.y, n = b ? 20 : 5, far = Math.hypot(dx, dy) > n; __keys(far && dy < -4, far && dx < -4, far && dy > 4, far && dx > 4, !!b && d < 60); return b; };
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
  });

  // --- Kaltstart: vier Meteore schlagen in die Reihen ---
  if (R.want('offen')) {
    await ev(() => { __seed(11); __krieg(0, 'linie', 'aurelien', 3, 8, 200); __still(); __go(176, 292); window.__f = [P.x + 4, P.y - 30]; for (let i = 0; i < 20; i++) { __hold(); __kampf(176, 292, 40); __cam(__f[0], __f[1]); __step(1); } });
    await R.cap('offen', 120, `i => { __hold(); __still(); __kampf(176, 296, 34); __cam(__f[0], __f[1]);
      if (i === 0) { const m = __mach('magie'); krShot('magie', __f[0], __f[1] - 6, { team: KR.foe, from: m, n: 4 }); m.an = 1; } }`);
  }
  // --- Zwei Heere: Gefecht in der Mitte, Maschinen feuern von selbst; die Kamera fährt langsam nach vorn ---
  if (R.want('heere')) {
    await ev(() => { __seed(23); __krieg(0, 'linie', 'aurelien', 2.9, 8, 0); for (let i = 0; i < 60; i++) { __hold(); if (i % 6 === 0) KR.vt = KR.at = 0; __cam(176, 330); __step(1); } __go(176, 350); __cam(176, 322); __step(1); });
    await R.cap('heere', 260, `i => { __hold(); if (i < 60 && i % 10 === 0) KR.vt = KR.at = 0; if (i < 70) __keys(P.y > 318, 0, 0, 0, 0); else __kampf(176, 290, 46); __cam(176, 318 - Math.min(i, 110) * .3); }`);
  }
  // --- Pfeilhagel: Schatten, heraus rollen, Einschlag ---
  if (R.want('pfeil')) {
    await ev(() => { __seed(31); __krieg(0, 'linie', 'aurelien', 3.3, 8, 190); __still(); __go(170, 292); window.__f = [P.x, P.y + 6]; for (let i = 0; i < 14; i++) { __hold(); __kampf(170, 292, 30); __cam(__f[0], __f[1]); __step(1); } window.__f = [P.x + 2, P.y + 8]; });
    await R.cap('pfeil', 100, `i => { __hold(); __still(); __cam(__f[0], __f[1]);
      if (i === 2) { const m = __mach('pfeil'); krShot('pfeil', __f[0], __f[1] - 10, { team: KR.foe, from: m }); m.an = 1; }
      if (i < 24) __kampf(__f[0], __f[1] + 14, 40); else if (i < 28) __keys(0, 0, 1, 0, 0); else { const dy = __f[1] + 30 - P.y; __keys(dy < -4, 0, dy > 4, 0, 0); } if (i === 26) doRoll(); }`);
  }
  // --- Katapult: der Magier kämpft für Karth, Aureliens Katapult antwortet ---
  if (R.want('katapult')) {
    await ev(() => { __seed(47); __krieg(1, 'linie', 'karth', 3.2, 3, 190); __still(); __go(180, 290); window.__f = [P.x, P.y]; for (let i = 0; i < 14; i++) { __hold(); __kampf(180, 290, 30); __cam(__f[0], __f[1]); __step(1); } window.__f = [P.x, P.y + 4]; KR.fires.length = 0; KR.shots.length = 0; });   // Feld frei: nur der eine Stein zählt
    await R.cap('katapult', 110, `i => { __hold(); __still(); __cam(__f[0], __f[1]);
      if (i === 0) { const m = __mach('katapult'); krShot('katapult', __f[0] - 2, __f[1] - 8, { team: KR.foe, from: m }); m.an = 1; }
      if (i < 32 || i > 70) __kampf(__f[0], __f[1] + 20, 44); else if (i < 37) __keys(0, 0, 1, 1, 0); else { const dx = __f[0] + 26 - P.x, dy = __f[1] + 30 - P.y; __keys(dy < -4, dx < -4, dy > 4, dx > 4, 0); } if (i === 34) doRoll(); }`);
  }
  // --- Magiehagel: Meteore, der Boden brennt weiter ---
  if (R.want('magie')) {
    await ev(() => { __seed(53); __krieg(0, 'linie', 'aurelien', 3.2, 8, 190); __still(); __go(172, 294); window.__f = [P.x, P.y]; for (let i = 0; i < 14; i++) { __hold(); __kampf(172, 294, 30); __cam(__f[0], __f[1]); __step(1); } window.__f = [P.x, P.y + 4]; });
    await R.cap('magie', 120, `i => { __hold(); __still(); __cam(__f[0], __f[1]);
      if (i === 0) { const m = __mach('magie'); krShot('magie', __f[0] + 2, __f[1] - 10, { team: KR.foe, from: m, n: 4 }); m.an = 1; }
      if (i < 22) __kampf(__f[0], __f[1], 40); else if (i < 34) __keys(0, 0, 1, 0, 0); else __kampf(__f[0] - 6, __f[1] + 30, 26); if (i === 24) doRoll(); }`);
  }
  // --- Deckung: hinter den Schildwall rollen, der Pfeilhagel prallt ab ---
  if (R.want('deckung')) {
    await ev(() => { __seed(61); __krieg(0, 'linie', 'aurelien', 3.5, 8, 150); __still(); const c = KR.cover[0]; window.__c = c; __go(c.x + 52, c.y + 16); __cam(c.x + 10, c.y + 6); __step(2); });
    await R.cap('deckung', 110, `i => { __hold(); __still(); const c = window.__c, dx = c.x + 1 - P.x, dy = c.y + 12 - P.y; __cam(c.x + 10, c.y + 6);
      if (i === 0) { const m = __mach('pfeil'); krShot('pfeil', c.x + 8, c.y + 12, { team: KR.foe, from: m }); m.an = 1; }
      if (i < 6) __keys(0, 0, 0, 0, 0); else __keys(dy < -3, dx < -3, dy > 3, dx > 3, 0); if (i === 9) doRoll();
      if (i === 52) { const m = __mach('pfeil'); krShot('pfeil', c.x - 4, c.y + 11, { team: KR.foe, from: m }); } }`);
  }
  // --- Kriegsmaschine nehmen: Wachen besiegen, daneben stehen, der Glutwerfer gehört Aurelien ---
  if (R.want('maschine')) {
    await ev(() => { __seed(71); __krieg(0, 'maschine', 'aurelien', 3.2, 8, 150); __still(); const m = KR.zm; window.__m = m; __go(m.x - 6, m.y + 52); __cam(m.x - 4, m.y + 24); __step(1);
      for (const e of enemies) if (e.kr && !e.mach && Math.hypot(e.x - m.x, e.y - m.y) < 110) e.hp = Math.min(e.hp, e.maxHp * .5); });
    await R.cap('maschine', 200, `i => { __hold(); __still(); const m = window.__m; KR.vres = 0; __cam(m.x - 4, m.y + 24); let w = null; for (const e of enemies) if (e.kr && !e.dead && !e.mach && Math.hypot(e.x - m.x, e.y - m.y) < 90) w = e;
      const tx = w ? w.x : m.x - 14, ty = w ? w.y + 6 : m.y + 12, dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy), nah = w ? 20 : 4;
      __keys(d > nah && dy < -3, d > nah && dx < -3, d > nah && dy > 3, d > nah && dx > 3, !!w); window.__log = (window.__log || []); window.__log[i] = [m.cap, m.team, KR.aus]; }`);
    fs.writeFileSync(OUT + '/raw/maschine/log.json', JSON.stringify(await ev(() => { const l = window.__log; window.__log = null; return l; })));
  }
  // --- Duell: Hauptfrau Sareth legt ihren Flammenring, die Ritterin rollt heraus und greift wieder an ---
  if (R.want('duell')) {
    await ev(() => { __seed(83); window.__txtNo = null; __krieg(0, 'hauptmann', 'aurelien', 3.3, 8, 120); __still(); KR.ht = 0; for (let i = 0; i < 150; i++) { __hold(); __cam(P.x, P.y); __step(1); if (KR.hpt) KR.hpt.kr.mt = 9; }
      const h = KR.hpt; __go(h.x - 16, h.y + 30); for (let i = 0; i < 10; i++) { __hold(); h.kr.mt = 9; __keys(0, 0, 0, 0, 1); __cam(h.x, h.y + 16); __step(1); } window.__cy = [h.x, h.y + 16]; });
    await R.cap('duell', 120, `i => { __hold(); __still(); const h = KR.hpt; if (!h) return; h.hp = Math.max(h.hp, h.maxHp * .42); if (i < 10) h.kr.mt = 9; if (i === 10) { h.kr.mt = 0; h.kr.n = 0; } if (i > 12) h.kr.mt = Math.max(h.kr.mt, 3);
      const c = window.__cy; c[0] += (h.x - c[0]) * .12; c[1] += (h.y + 16 - c[1]) * .12; __cam(c[0], c[1]);
      const dx = h.x - P.x, dy = h.y - P.y, d = Math.hypot(dx, dy), raus = i >= 26 && i < 44;
      if (raus) __keys(0, 0, 1, 0, 0); else __keys(d > 24 && dy < -4, d > 24 && dx < -4, d > 24 && dy > 4, d > 24 && dx > 4, d < 44); if (i === 27) doRoll(); if (i === 70) { P.cds[0] = 0; useSkill(0); } }`);
    await ev(() => { window.__txtNo = /^\d+$/; });
  }
  // --- Seite wählen (Standbild des echten Bildschirms) ---
  if (R.want('wahl')) {
    await ev(() => { __off(); activateChar(0); P.act = 4; P.map = genMap(4); SAVE.meta.krieg.pro = 1; SAVE.meta.krieg.n = 3; __vp(3); krWahl(3); __step(2); });
    await R.shot('wahl.png');
    const box = await ev(() => [...document.querySelectorAll('.krside')].map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    fs.writeFileSync(OUT + '/raw/wahl.json', JSON.stringify(box));
    await ev(() => { hideOverlay(); });
  }
  // --- Wappen und Daten der fünf Reiche, Soldaten der beiden Reiche an der Front ---
  if (R.want('wappen')) {
    const A = await ev(() => {
      const o = { reiche: [] };
      for (const k of REICH_ORDER) { const X = REICHE[k]; o.reiche.push({ k, n: X.n, krone: X.krone, c: X.c, c2: X.c2, dk: X.dk, aktiv: X.aktiv, stil: X.stil, wappen: artIcon('kr_w_' + k).toDataURL(),
        einh: X.aktiv ? [...new Set(X.einh)].concat([X.hpt]).map(t => { const s = krStrip(EN[t]), cv = s.c || s.cv || s, S = SP[(BODIES[EN[t].body] || BODIES.knight_m).sp]; return { t, n: EN[t].name, fw: S.w, fh: S.h, u: cv.toDataURL ? cv.toDataURL() : null }; }) : [],
        masch: X.aktiv ? krMaschSpr(X.masch[0], k, 0).toDataURL() : null }); }
      o.banner = artIcon('kr_banner').toDataURL(); o.version = VERSION; return o;
    });
    const d = R.dir('wappen');
    for (const X of A.reiche) { R.saveData('wappen/' + X.k + '.png', X.wappen); delete X.wappen; if (X.masch) { R.saveData('wappen/' + X.k + '_masch.png', X.masch); X.masch = 1; } X.einh.forEach((e, i) => { if (e.u) R.saveData('wappen/' + X.k + '_e' + i + '.png', e.u); delete e.u; }); }
    R.saveData('wappen/banner.png', A.banner); delete A.banner;
    fs.writeFileSync(d + '/reiche.json', JSON.stringify(A, null, 1)); console.log('Wappen', A.reiche.length, 'Version', A.version);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
