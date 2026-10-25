// Aufnahmen für das ausführliche Video zu 6.0 „Die Verlorenen Lande“ (~75 s, Kapitel):
// Aufhänger (Weltentor) → Verlorene Lande (Risiko, Freiwelt, Truhen, Ungeheuer, NPCs, Nacht, Entkommen, Tod)
// → Brutnest → Aussehen & Auren → Basar → Schmiede → Was ist neu → Endkarte.
// Alles echt aus dem Spiel: Freiwelt Bild für Bild (feste Karten über Zufall + Uhr), Menüs als Standbilder,
// Grafiken (Eier, Kreaturen, Gegenstände) als PNG, das Schlüpfen Bild für Bild aus dem echten Schlüpf-Bildschirm.
// Aufruf (Spiel muss lokal laufen, siehe tools/promo/README.md):
//   PROMO_OUT=/tmp/klingenhort-clip-6.0 BASE=http://localhost:8765/ node scenes.js        alle Szenen
//   PROMO_OUT=/tmp/klingenhort-clip-6.0 node scenes.js hook_a,w_run1                       nur diese neu aufnehmen
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.0';

(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 60 });
  const { ev, page } = R;
  // Trefferzähler oben rechts ausblenden (stößt sonst an die Überschriften)
  await page.addStyleTag({ content: '#combo{display:none!important}' });
  // Standbild nach raw/<szene>/<datei>.jpg; Bereiche (Bildschirmpixel ×2) für den Schnitt nach raw/<szene>/boxes.json
  const boxes = {};
  const still = async (scene, file, fn, arg, wait) => {
    if (fn) await ev(fn, arg); await page.waitForTimeout(wait || 350);
    fs.mkdirSync(R.out + scene, { recursive: true }); await page.screenshot({ path: `${R.out}${scene}/${file}.jpg`, type: 'jpeg', quality: 93 });
  };
  const rect = async (scene, key, sel, i) => {
    const r = await ev(([sel, i]) => { const e = typeof sel === 'string' ? document.querySelectorAll(sel)[i || 0] : null; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, i]);
    (boxes[scene] = boxes[scene] || {})[key] = r; fs.writeFileSync(`${R.out}${scene}/boxes.json`, JSON.stringify(boxes[scene], null, 1)); return r;
  };
  // Bereich eines Elements, das per Text gefunden wird (z. B. Überschrift „WAS DU RISKIERST“)
  const rectTxt = async (scene, key, sel, re) => {
    const r = await ev(([sel, re]) => { const e = [...document.querySelectorAll(sel)].find(x => new RegExp(re).test(x.textContent)); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, re]);
    (boxes[scene] = boxes[scene] || {})[key] = r; fs.writeFileSync(`${R.out}${scene}/boxes.json`, JSON.stringify(boxes[scene], null, 1)); return r;
  };
  const fresh = scene => { const d = R.out + scene; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); boxes[scene] = {}; };
  const saveLog = async scene => fs.writeFileSync(`${R.out}${scene}/log.json`, JSON.stringify(await ev(() => window.__log)));
  const info = (scene, o) => fs.writeFileSync(`${R.out}${scene}/info.json`, JSON.stringify(o, null, 1));

  // Hilfen im Browser
  await ev(() => {
    // Ausrüstung der vier Helden merken (der Tod in den Landen nimmt sie weg)
    window.__gear0 = SAVE.chars.map(c => JSON.stringify(c.gear));
    window.__calm = () => { P.inv = 99; P.hp = P.st.hp; P.res = P.st.resMax; __off(); };
    // Freiwelt sauber beenden (ohne Belohnung, ohne Tod)
    window.__lend = () => { if (LW) { try { lEnd(); } catch (e) { } LW = null; } SAVE.meta.lande.cur = null; document.body.classList.remove('lande'); lHudShow(false); };
    // Menüs vor ruhigem Hintergrund (Titel-Szene), Kamera und Texte wieder normal
    window.__ui = () => { __lend(); DLG = null; hideOverlay(); showHud(false); $('bossbar').hidden = true; window.__camDX = 0; window.__camDY = 0; window.__txtNo = null; window.__txtOK = null; window.__kinds = null; window.__path = null; titleScene(); texts = []; parts = []; setState('title'); };
    window.__scene = seed => { __ui(); __seed(seed); };
    // Held ci mit seiner Ausrüstung und einem Begleiter (Glutdrache LV 60: Tasche mit 3 Plätzen)
    window.__hero = (ci, sp, lv) => {
      activateChar(ci); P.gear = JSON.parse(__gear0[ci]); P.lv = 40; computeStats(); P.hp = P.st.hp;
      const PM = SAVE.meta.pets; PM.list = []; PM.eggs = []; PM.first = true; PM.intro = true; const p = petGive(sp || 'drache', { lv: lv || 60 }); delete p.hurt; PM.act = p.id; petView = p.id; return p;
    };
    // Feste Freiwelt: Zufall und Uhr festlegen, damit jede Aufnahme dieselbe Karte hat
    window.__lgo = (ti, seed, ci) => {
      __ui(); __hero(ci || 0); hideOverlay();
      const M = SAVE.meta.lande; M.tx = [3, 3, 3, 3, 1]; M.rep = 420; M.keys = 2; M.tips = 255;
      __seed(seed); const dn = Date.now; Date.now = () => 1761400000000 + seed * 7919; try { lBegin(ti); } finally { Date.now = dn; }
      P.inv = 99; __vp(2.6); __snap(); texts = []; __seed(seed + 1000);
    };
    // Held hinstellen (Nebel aufdecken, Gegner weg, Begleiter daneben)
    window.__tp = (x, y) => { P.x = x; P.y = y; P.vx = P.vy = 0; lRevealAt(x, y, 6); for (const e of enemies) e.dead = true; enemies = []; projs = []; try { petPlace(false); } catch (e) { } __snap(); };
    // in Richtung (tx, ty) laufen; true = angekommen
    window.__go = (tx, ty, r) => { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy); keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; if (d < (r || 4)) return true; keys.KeyD = dx > d * .38; keys.KeyA = dx < -d * .38; keys.KeyS = dy > d * .38; keys.KeyW = dy < -d * .38; return false; };
    // einem Weg folgen (Punkte der Straße), ab Index i
    window.__follow = (pts, i, dir) => { window.__path = { pts, i, dir: dir || 1 }; };
    window.__walk = () => { const p = window.__path; if (!p) return; const n = p.pts.length; while (p.i >= 0 && p.i < n - 1 && Math.hypot(p.pts[p.i][0] - P.x, p.pts[p.i][1] - P.y) < 12) p.i += p.dir; const q = p.pts[clamp(p.i + p.dir * 2, 0, n - 1)]; __go(q[0], q[1]); };
    // erster Punkt einer Straße, an dem das Gebiet von a nach b wechselt
    window.__bound = (ri, a, b) => { const r = LW.roads[ri]; for (let i = 1; i < r.length; i++) if (lBioAt(r[i - 1][0], r[i - 1][1]) === a && lBioAt(r[i][0], r[i][1]) === b) return i; return -1; };
    // nichts in der Nähe, das aufwacht (Lager, Streifen, Rivalen) – für ruhige Laufbilder
    window.__quiet = (x, y, rad) => { const L = LW; for (const c of L.camps) if (Math.hypot(c.x - x, c.y - y) < rad) { c.left = []; c.state = 'done'; } for (const p of L.pats) if (Math.hypot(p.x - x, p.y - y) < rad) p.list = []; for (const r of L.rivals) if (Math.hypot(r.x - x, r.y - y) < rad) r.state = 'gone'; };
    // Fundstelle der Art t mit wenig Bäumen ringsum (gut zu sehen), ohne Lager in der Nähe
    window.__spot = (t, n) => { const L = LW, dens = o => L.objs.filter(x => x.solid && x.k === 'prop' && Math.hypot(x.x - o.x, (x.y - o.y) * 1.3) < 46).length; return L.spots.filter(o => o.t === t && !o.open && o.x > 120 && o.y > 160 && o.x < L.S - 120 && o.y < L.S - 120 && !L.camps.some(c => Math.hypot(c.x - o.x, c.y - o.y) < 340)).sort((a, b) => dens(a) - dens(b))[n || 0]; };
    // Beute für Szenen: ein Legendär, ein Episch, ein Ei, Gold, Edelstein, Material
    window.__loot = () => [{ t: 'item', it: lItem(4, 3) }, { t: 'item', it: lItem(3, 2) }, { t: 'gold', n: 186 }, { t: 'gem', k: 'rubin:2', n: 1 }, { t: 'mat', k: 'mithril', n: 3 }];
    // Gegenstände am Boden einsammeln (Gold, Material, Edelsteine fliegen von selbst)
    window.__sheetTop = () => { const sh = panel.querySelector('.side.sheet'); panel.scrollTop = 0; if (sh) panel.scrollTop = sh.getBoundingClientRect().top - panel.getBoundingClientRect().top - 210; };
    window.__collect = () => { const c = pickups.filter(c => c.k === 'loot' && c.t > .5).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; if (c) __go(c.x, c.y, 2); else __off(); return !!c; };
  });

  await R.news();
  if (R.want('assets')) await R.assets();

  /* ---------- Aufhänger: Brunhild geht im Versteck durch das Weltentor ---------- */
  if (R.want('hook_a')) {
    await ev(() => {
      __scene(11); __hero(0); SAVE.meta.hide.intro = true; enterHideout(); hideOverlay(); setState('play'); showHud(true);
      const p = hidePos('weltentor'); P.x = p.x + 2; P.y = p.y + 62; P.face = 1; __vp(3.4); window.__camDY = -14; __snap(); __step(12); __calm();
    });
    await R.cap('hook_a', 48, `i => { __calm(); const p = hidePos('weltentor'); if (i >= 4) __go(p.x + 1, p.y + 4, 2); }`);
  }
  // Ankunft: Schnee und Wald (Wildnis), der Held läuft los, Begleiter folgt
  if (R.want('hook_b')) {
    await ev(() => { __lgo(1, 2, 0); __quiet(P.x, P.y, 600); __follow(LW.roads[0], 0, 1); __step(2); });
    await R.cap('hook_b', 60, `i => { __calm(); if (i >= 6) __walk(); }`);
  }

  /* ---------- Was du riskierst: Weltentor-Bildschirm im Versteck ---------- */
  if (R.want('risk')) {
    fresh('risk');
    await ev(() => { __scene(12); __hero(0); SAVE.meta.hide.intro = true; const M = SAVE.meta.lande; M.tx = [1]; M.rep = 420; M.runs = 7; M.ext = 5; M.deaths = 2; M.best = 48200; M.sel = 0; enterHideout(); lGate('hide'); panel.scrollTop = 0; });
    await still('risk', 'top', () => { const h = [...panel.querySelectorAll('h3')].find(e => /RISKIERST/.test(e.textContent)); panel.scrollTop = 0; panel.scrollTop = h.getBoundingClientRect().top - panel.getBoundingClientRect().top - 30; });
    await rectTxt('risk', 'risk', '#panel h3', 'RISKIERST'); await rectTxt('risk', 'surv', '#panel h3', 'ÜBERLEBT');
    await rect('risk', 'rules', '#panel .lrules'); await rect('risk', 'go', '[data-act="l_go"]');
    info('risk', await ev(() => ({ gv: lSum(['weapon', 'armor', 'helm'].map(s => ({ t: 'item', it: P.gear[s] }))), bag: lBagSize(lPet()) })));
  }

  /* ---------- Freiwelt: drei Gebiete, Wege, Minikarte, Kompass ---------- */
  // Schnee → Wald (Wildnis)
  if (R.want('w_run1')) {
    await ev(() => { __lgo(1, 2, 0); const i = __bound(1, 'schnee', 'wald'), r = LW.roads[1], s = r[Math.max(0, i - 22)]; __tp(s[0], s[1]); __quiet(P.x, P.y, 700); __follow(r, Math.max(0, i - 22), 1); __step(2); });
    await R.cap('w_run1', 60, `i => { __calm(); __walk(); }`);
  }
  // Asche → Lava (Abgrund)
  if (R.want('w_run2')) {
    await ev(() => { __lgo(3, 3, 0); const i = __bound(2, 'asche', 'lava'), r = LW.roads[2], s = r[Math.max(0, i - 22)]; __tp(s[0], s[1]); __quiet(P.x, P.y, 700); __follow(r, Math.max(0, i - 22), 1); __step(2); });
    await R.cap('w_run2', 60, `i => { __calm(); __walk(); }`);
  }
  // Wald → Ruinen (Grenzland)
  if (R.want('w_run3')) {
    await ev(() => { __lgo(0, 1, 0); const i = __bound(4, 'wald', 'ruine'), r = LW.roads[4], s = r[Math.max(0, i - 22)]; __tp(s[0], s[1]); __quiet(P.x, P.y, 700); __follow(r, Math.max(0, i - 22), 1); __step(2); });
    await R.cap('w_run3', 60, `i => { __calm(); __walk(); }`);
  }
  // Große Karte mit Nebel: ein Stück der Welt erkundet (entlang der Wege aufgedeckt, wie nach ein paar Minuten)
  if (R.want('w_map')) {
    fresh('w_map');
    await ev(() => {
      __lgo(0, 1, 0); const L = LW;
      for (const ri of [0, 1, 2, 4]) for (const [x, y] of L.roads[ri]) lRevealAt(x, y, 5);
      const r = L.roads[2], q = r[Math.floor(r.length * .6)]; P.x = q[0]; P.y = q[1]; P.vx = -30; L.t = 214;
      L.misOn = true; L.mis = lMisGen(); lMapScreen();
    });
    await still('w_map', 'map');
    await rect('w_map', 'map', '#lmapBig'); await rect('w_map', 'leg', '#panel .lleg');
  }

  /* ---------- Truhen und Beute: alles landet im Rucksack ---------- */
  // Goldtruhe öffnen, Beute springt heraus, der Held sammelt ein (Zähler am Rucksack oben rechts)
  if (R.want('l_chest')) {
    await ev(() => {
      __lgo(0, 1, 0); const o = __spot('gold', 0); window.__chest = o; o.loot = __loot();
      __tp(o.x - 56, o.y + 6); __quiet(o.x, o.y, 500); P.face = 1; __step(4);
    });
    await ev(() => { window.__log = []; });
    await R.cap('l_chest', 96, `i => { __calm(); const o = window.__chest; if (!o.open) __go(o.x, o.y, 6); else if (i > 20) __collect(); else __off(); window.__log.push([o.open ? 1 : 0, LW.pack.length, pickups.filter(c => c.k === 'loot').length]); }`);
    await saveLog('l_chest');
    await rect('l_chest', 'pack', '#lhPack');
    console.log('Rucksack:', await ev(() => LW.pack.map(e => e.t + (e.t === 'item' ? ':' + e.it.rar : '')).join(' ')));
  }
  // Vergrabener Schatz: stehen bleiben, graben, ein Begleiter-Ei kommt heraus
  if (R.want('l_dig')) {
    await ev(() => {
      __lgo(0, 1, 0); const o = __spot('versteck', 0); window.__cache = o; const d = lEgg(3) || { egg: 1, sp: 'phoenix', tier: 5 };
      o.loot = [{ t: 'egg', d: { egg: 1, sp: 'phoenix', tier: 5 } }, { t: 'gold', n: 240 }, { t: 'gem', k: 'saphir:3', n: 1 }];
      __tp(o.x - 30, o.y + 2); __quiet(o.x, o.y, 500); P.face = 1; __step(4);
    });
    await ev(() => { window.__log = []; });
    await R.cap('l_dig', 84, `i => { __calm(); const o = window.__cache; if (!o.open) __go(o.x, o.y, 3); else __off(); window.__log.push([o.open ? 1 : 0, +LW.dig.toFixed(2), LW.pack.length]); }`);
    await saveLog('l_dig');
  }
  // Rucksack: Gegenstand antippen → in die Begleiter-Tasche (die überlebt den Tod)
  if (R.want('l_inv')) {
    fresh('l_inv');
    await ev(() => {
      __lgo(0, 1, 0); __seed(31);
      LW.pack = [{ t: 'item', it: lItem(4, 3) }, { t: 'item', it: lItem(3, 2) }, { t: 'egg', d: { egg: 1, sp: 'phoenix', tier: 5 } }, { t: 'item', it: lItem(2, 2) }, { t: 'gold', n: 426 }, { t: 'gem', k: 'rubin:2', n: 1 }, { t: 'mat', k: 'mithril', n: 3 }, { t: 'part', k: 'klinge:5', n: 1 }, { t: 'item', it: lItem(1, 1) }];
      for (const e of LW.pack) if (e.t === 'item') e.it.lw = LW.id;
      LG.sel = null; LG.arm = null; lInv(); panel.scrollTop = 0;
    });
    await still('l_inv', 'inv0'); await rect('l_inv', 'pack', '#panel .lpk'); await rect('l_inv', 'bag', '#panel .lpk + .box');
    await rect('l_inv', 'slot0', '[data-act="l_sel"][data-id="p:0"]');
    await still('l_inv', 'inv1', () => { ON.l_sel('p:0'); panel.scrollTop = 0; });
    await rect('l_inv', 'tobag', '[data-act="l_tobag"]'); await rect('l_inv', 'sheet', '#panel .side.sheet');
    await still('l_inv', 'inv2', () => { ON.l_tobag(); panel.scrollTop = 0; });
    await rect('l_inv', 'bag2', '#panel .lpk + .box');
  }

  /* ---------- Ungeheuer: ein Boss taucht auf, Kampf – dann läuft der Held weg (Kamera hält beide im Bild) ---------- */
  // [Szene, Weltstufe, Karte, Boss, Straße]
  const BOSSV = [['b_boss', 3, 3, 'Varkas', 3]];
  for (const [scene, ti, seed, bn, ri] of BOSSV) {
    if (!R.want(scene)) continue;
    await ev(([ti, seed, bn, ri]) => {
      __lgo(ti, seed, 0); const L = LW, r = L.roads[ri], i = Math.floor(r.length * .5), q = r[i];
      __tp(q[0], q[1]); __quiet(q[0], q[1], 900); window.__route = r; window.__ri = i;
      const B = L.bosses.find(b => b.B.name.includes(bn)) || L.bosses[0]; window.__B = B;
      L.t = 60; P.face = 1; window.__txtNo = /^\d+$/; __vp(3.1); __snap(); __step(2);
    }, [ti, seed, bn, ri]);
    await R.cap(scene, 120, `i => {
      __calm(); const B = window.__B, r = window.__route;
      if (i === 2) { B.state = 'roam'; B.x = P.x + 62; B.y = P.y - 30; B.tx = B.x; B.ty = B.y; B.hp = 1; }
      if (i < 46) { __off(); P.face = 1; keys.KeyJ = i > 20 && i < 42; }
      else { keys.KeyJ = false; if (!window.__path) __follow(r, window.__ri, -1); __walk(); }
      const b = enemies.find(e => e.boss && !e.dead);
      if (b) { b.hp = Math.max(b.hp, b.maxHp * .8); const tx = clamp((b.x - P.x) * .5, -70, 70), ty = clamp((b.y - P.y) * .5 + 8, -60, 50); window.__camDX = (window.__camDX || 0) * .85 + tx * .15; window.__camDY = (window.__camDY || 0) * .85 + ty * .15; }
    }`);
    await ev(() => { window.__camDX = 0; window.__camDY = 0; window.__path = null; window.__txtNo = null; });
    console.log(scene, await ev(() => window.__B.B.name));
  }

  /* ---------- Leute in den Landen: Kundschafterin Elwa, Händler Bodo, Kräuterfrau Mirja, Rivalen ---------- */
  if (R.want('n_camp')) {
    await ev(() => { __lgo(0, 1, 0); const o = LW.npcs.mis; __tp(o.x - 70, o.y + 30); __quiet(o.x, o.y, 500); __step(2); });
    await R.cap('n_camp', 40, `i => { __calm(); const o = LW.npcs.mis; __go(o.x - 16, o.y + 8, 3); }`);
  }
  if (R.want('n_mis')) {
    fresh('n_mis');
    await ev(() => { __lgo(0, 1, 0); __seed(41); const o = LW.npcs.mis; P.x = o.x - 16; P.y = o.y + 8; lMisScreen(); panel.scrollTop = 0; });
    await still('n_mis', 'mis'); await rectTxt('n_mis', 'list', '#panel h3', 'AUFTRÄGE'); await rect('n_mis', 'say', '#panel .say');
  }
  if (R.want('n_trade')) {
    fresh('n_trade');
    await ev(() => { __lgo(0, 1, 0); __seed(42); const o = LW.npcs.trade; P.x = o.x - 16; P.y = o.y + 8; LW.pack = [{ t: 'gold', n: 2400 }, { t: 'mat', k: 'zahn', n: 12 }, { t: 'mat', k: 'kristall', n: 14 }, { t: 'mat', k: 'horn', n: 10 }, { t: 'mat', k: 'leder', n: 12 }, { t: 'mat', k: 'knochen', n: 10 }, { t: 'mat', k: 'erz', n: 10 }]; LG.tab = 'tausch'; lTradeScreen(); panel.scrollTop = 0; });
    await still('n_trade', 'trade'); await rect('n_trade', 'say', '#panel .say');
    await still('n_heal', 'heal', () => { lResume(); P.hp = P.st.hp * .35; lHealScreen(); panel.scrollTop = 0; });
  }
  // Rivale greift an (will deine Beute) – besiegt lässt er alles fallen, was er geplündert hat
  if (R.want('n_rival')) {
    await ev(() => {
      __lgo(1, 2, 0); const L = LW, r = L.rivals[0], q = L.roads[1][40]; __tp(q[0], q[1]); __quiet(q[0], q[1], 900);
      r.state = 'roam'; r.loot = [{ t: 'item', it: lItem(3, 2) }, { t: 'gold', n: 160 }, { t: 'mat', k: 'mithril', n: 2 }]; r.x = P.x + 120; r.y = P.y - 50; r.tgt = null; r.leave = 9999; window.__R = r; P.face = 1; __step(1);
    });
    await ev(() => { window.__log = []; });
    await R.cap('n_rival', 96, `i => { window.__log.push([window.__R.state, enemies.some(x => x.rival) ? 1 : 0]); __calm(); const e = enemies.find(x => x.rival); keys.KeyJ = !!e && i > 14; if (e && Math.hypot(e.x - P.x, e.y - P.y) > 26 && i > 10) __go(e.x - 14, e.y, 3); else if (!e && i > 30) __collect(); else if (!e) __off(); if (e && i < 46) e.hp = Math.max(e.hp, e.maxHp * .5); }`);
    await saveLog('n_rival');
    console.log('Rivale:', await ev(() => window.__R.name + ' ' + window.__R.state));
  }

  /* ---------- Die Nacht bricht an: Zeitraffer – es wird dunkel, die Verderbnis wächst, Jäger der Leere ---------- */
  if (R.want('t_night')) {
    await ev(() => {
      __lgo(0, 1, 0); const L = LW, r = L.roads[3]; __tp(r[10][0], r[10][1]); __quiet(r[10][0], r[10][1], 900); __follow(r, 10, 1);
      L.rift.x = r[60][0] + 120; L.rift.y = r[60][1] + 40; L.t = 150; window.__kinds = null; __step(2);
    });
    await R.cap('t_night', 108, `i => {
      __calm(); const L = LW; L.t = 150 + i * 5.2; L.tick = 0; __walk();
      if (i === 30 || i === 62 || i === 84) for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; lSpawn(pick(lPool(lBioAt(P.x, P.y), lStage(P.x, P.y))), P.x + Math.cos(a) * 70, P.y + Math.sin(a) * 50, { instant: false }); }
      keys.KeyJ = enemies.some(e => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 40);
    }`);
  }

  /* ---------- Entkommen: im Ausgang stehen bleiben, Zähler läuft, Beute in Sicherheit ---------- */
  if (R.want('x_exit')) {
    await ev(() => {
      __lgo(0, 1, 0); const L = LW, ex = L.exits.find(e => e.t === 'portal'); window.__ex = ex;
      __tp(ex.x + 46, ex.y + 8); __quiet(ex.x, ex.y, 600); L.t = 520;
      L.pack = [{ t: 'item', it: lItem(4, 3) }, { t: 'item', it: lItem(3, 2) }, { t: 'item', it: lItem(3, 2) }, { t: 'egg', d: { egg: 1, sp: 'phoenix', tier: 5 } }, { t: 'gold', n: 1240 }, { t: 'gem', k: 'rubin:3', n: 1 }, { t: 'mat', k: 'mithril', n: 6 }, { t: 'part', k: 'klinge:5', n: 1 }];
      for (const e of L.pack) if (e.t === 'item') e.it.lw = L.id;
      lBag(L.pet).push({ t: 'item', it: lItem(4, 2) });
      L.misOn = true; L.mis = lMisGen(); L.mis[0].done = true; L.mis[0].c = L.mis[0].n;
      L.kills = 37; window.__chlog = []; P.face = -1; __step(1);
    });
    await R.cap('x_exit', 66, `i => { __calm(); const ex = window.__ex; if (LW && LW.on) { if (!__go(ex.x, ex.y + 1, 3)) {} window.__chlog.push([LW.ch, LW.chEx ? 1 : 0]); } else window.__chlog.push([-1, 0]); }`);
    const ch = await ev(() => ({ log: window.__chlog, need: 3, on: !!(LW && LW.on) }));
    fs.writeFileSync(R.out + 'x_exit/chlog.json', JSON.stringify(ch));
    fresh('x_done');
    if (ch.on) await ev(() => lExtract());
    await still('x_done', 'done', null, null, 2600);
    info('x_done', await ev(() => ({ kv: [...panel.querySelectorAll('.kv .pill')].map(e => e.textContent) })));
    await rect('x_done', 'panel', '#panel'); await rect('x_done', 'pill', '#panel .kv'); await rect('x_done', 'list', '#panel .lgot');
  }

  /* ---------- Tod: Pyraxis erwischt den Helden – alles weg, nur die Tasche des Begleiters kommt heim ---------- */
  if (R.want('d_die')) {
    await ev(() => {
      __lgo(3, 3, 0); const L = LW, r = L.roads[3], q = r[Math.floor(r.length * .55)]; __tp(q[0], q[1]); __quiet(q[0], q[1], 900);
      L.pack = [{ t: 'item', it: lItem(4, 3) }, { t: 'item', it: lItem(3, 2) }, { t: 'egg', d: { egg: 1, sp: 'phoenix', tier: 5 } }, { t: 'gold', n: 1240 }, { t: 'gem', k: 'rubin:3', n: 1 }];
      for (const e of L.pack) if (e.t === 'item') e.it.lw = L.id;
      const keep = lItem(4, 3); keep.lw = L.id; lBag(L.pet).push({ t: 'item', it: keep });
      const B = L.bosses.find(b => /Varkas/.test(b.B.name)) || L.bosses[0]; B.state = 'roam'; B.x = P.x + 56; B.y = P.y - 20; B.tx = B.x; B.ty = B.y; B.hp = .6; L.t = 60;
      window.__txtNo = /\d{4,}/; P.face = 1; __vp(3.1); __snap(); __step(16);
    });
    await ev(() => { window.__log = []; });
    await R.cap('d_die', 72, `i => { window.__log.push(state); if (i < 12) { __calm(); P.face = 1; keys.KeyJ = true; } else if (i === 12) { keys.KeyJ = false; __off(); P.inv = 0; P.hp = Math.min(P.hp, 20); } if (i === 28 && state === 'play') { P.inv = 0; hurtPlayer(1e9, enemies.find(e => e.boss) || null); } const b = enemies.find(e => e.boss && !e.dead); if (b && state === 'play') { window.__camDX = clamp((b.x - P.x) * .5, -60, 60); window.__camDY = clamp((b.y - P.y) * .5 + 8, -50, 40); } }`);
    await saveLog('d_die');
    fresh('d_screen');
    await ev(() => { for (let k = 0; k < 400 && state === 'dead'; k++) __step(1); });
    await still('d_screen', 'screen', () => { panel.scrollTop = 0; }, null, 600);
    await rect('d_screen', 'panel', '#panel .over'); await rect('d_screen', 'lost', '#panel .llost'); await rectTxt('d_screen', 'saved', '#panel h3', 'GERETTET');
    console.log('Tod:', await ev(() => state + ' ' + (panel.querySelector('h2') || {}).textContent)); await ev(() => { window.__txtNo = null; });
  }

  /* ---------- Brutnest: Eier wärmen, füttern, streicheln ---------- */
  if (R.want('e_nest')) {
    fresh('e_nest');
    const ids = await ev(() => {
      __scene(51); __hero(0); SAVE.meta.hide.intro = true; P.act = 5; for (const k of MATORDER) P.mats[k] = 40;
      const M = SAVE.meta.pets; M.eggs = []; const now = Date.now();
      const g1 = eggGive('wal', true), g2 = eggGive('phoenix', true), g3 = eggGive('fuchs', true);
      Object.assign(g2, { got: g2.need * .46, w: .72, f: .4, z: .85, t: now }); Object.assign(g3, { got: g3.need * .8, w: .9, f: .9, z: .6, t: now });
      enterHideout(); openNest('hide'); panel.scrollTop = 0; return [g1.id, g2.id, g3.id];
    });
    await still('e_nest', 'n0'); await rect('e_nest', 'say', '#panel .say'); await rect('e_nest', 'sum', '#panel .nsum');
    await rect('e_nest', 'card', `.ncard[data-eg="${ids[0]}"]`);
    await rect('e_nest', 'warm', `[data-act="nestwarm"][data-id="${ids[0]}"]`); await rect('e_nest', 'feed', `[data-act="nestfeed"][data-id="${ids[0]}"]`); await rect('e_nest', 'pet', `.nacts [data-act="nestpet"][data-id="${ids[0]}"]`);
    await still('e_nest', 'n1', id => { ON.nestwarm(id); panel.scrollTop = 0; }, ids[0]);
    await still('e_nest', 'n2', id => { ON.nestfeed(id); panel.scrollTop = 0; }, ids[0]);
    await still('e_nest', 'n3', id => { ON.nestpet(id); ON.nestpet(id); ON.nestpet(id); panel.scrollTop = 0; }, ids[0], 200);
    await rect('e_nest', 'card3', `.ncard[data-eg="${ids[0]}"]`);
  }
  // Schlüpfen Bild für Bild: der echte Schlüpf-Bildschirm (Wackeln, Risse, Licht, Splitter, dann die Kreatur)
  for (const [scene, sp] of [['e_hatch', 'phoenix'], ['e_hatch2', 'schlange']]) {
    if (!R.want(scene)) continue;
    await ev(sp => {
      __scene(52); __hero(0); SAVE.meta.hide.intro = true; SAVE.meta.settings.calm = false; const M = SAVE.meta.pets; M.eggs = []; M.seen = ['drache'];
      const g = eggGive(sp, true); Object.assign(g, { got: g.need, w: 1, f: 1, z: 1, t: Date.now() });
      enterHideout(); openNest('hide'); hatchStart(g.id);
    }, sp);
    await ev(() => { window.__log = []; });
    await R.cap(scene, 108, `i => { const H = HATCH; if (!H) return; for (const s of [.5, 0]) { H.t0 = performance.now() - ((i - s) / 30) * 1000 / H.sp; hatchRun(); } window.__log.push([H.burst ? 1 : 0, H.shown ? 1 : 0]); }`);
    await saveLog(scene);
    await rect(scene, 'cv', '#hatchcv'); await rect(scene, 'res', '#hres');
    await ev(() => { HATCH = null; });
  }
  // Grafiken: Eier aller Seltenheiten (mit Rissen), alle 24 Kreaturen, Gegenstände nach Material und Seltenheit
  if (R.want('art')) {
    fresh('art');
    const A = await ev(() => {
      const o = { tiers: PET_TIERS.map(t => ({ n: t.n, egg: t.egg, c: t.c })), pets: [], rar: RAR.map(r => ({ n: r.n, c: r.c })), mat: MAT.map(m => m.n), items: {} };
      o.eggs = PET_TIERS.map((_, t) => [0, 1, 2, 3].map(cr => eggURL(t, cr)));
      for (const sp of PET_ORDER) { const S = PET_SP[sp], st = [3, 5].map(s => { const U = petImgURL(sp, s, 0, false, true); return { u: U.url, W: U.W, H: U.H }; }); o.pets.push({ sp, n: S.n, t: S.t, el: S.el, fly: S.fly, st }); }
      const it = x => Object.assign({ uid: 'x', aff: {}, gems: [], sockets: 0, up: 0, fz: 0, set: null, name: null, suf: null }, x);
      const cv = c => (c.c || c).toDataURL();
      o.items.mat = []; for (let t = 0; t < TIERS; t++) o.items.mat.push(cv(weaponArt(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: t, rar: 3 }))));
      const named = (slot, r) => { const x = { slot, base: slot === 'weapon' ? 'sword' : slot, form: slot === 'weapon' ? 'lang' : undefined, tier: 5, rar: r }; if (r === 4) x.name = slot === 'weapon' ? 'Sonnenklinge' : LEGEND[slot][0]; if (r === 5) { x.set = 'lion'; x.name = SETS.lion.pieces[slot]; } if (r === 6) { x.myth = slot === 'weapon' ? 'klinge' : slot === 'armor' ? 'phoenix' : 'krone'; x.name = MYTHIC[x.myth].n; } return it(x); };
      o.items.rarW = [0, 1, 2, 3, 4, 5, 6].map(r => cv(weaponArt(named('weapon', r))));
      o.items.rarA = [0, 1, 2, 3, 4, 5, 6].map(r => armorArt(named('armor', r), 'knight').toDataURL());
      o.items.rarH = [0, 1, 2, 3, 4, 5, 6].map(r => armorArt(named('helm', r), 'knight').toDataURL());
      const my = weaponArt(named('weapon', 6)); o.items.mythFr = (my.fr || [my.c]).map(c => c.toDataURL());
      return o;
    });
    const save = (u, f) => R.saveData('art/' + f, u);
    A.eggs.forEach((row, t) => row.forEach((u, cr) => save(u, `egg_${t}_${cr}.png`))); delete A.eggs;
    for (const p of A.pets) p.st.forEach((s, i) => { save(s.u, `pet_${p.sp}_${i ? 5 : 3}.png`); delete s.u; });
    for (const k in A.items) A.items[k].forEach((u, i) => save(u, `item_${k}_${i}.png`)); A.items = Object.fromEntries(Object.entries(A.items).map(([k, v]) => [k, v.length]));
    fs.writeFileSync(R.out + 'art/art.json', JSON.stringify(A, null, 1));
    console.log('Grafiken: Eier, Kreaturen, Gegenstände');
  }

  /* ---------- Auren: Brunhild mit mythischen Gegenständen und vollem Set (Versteck bei Nacht) ---------- */
  const AURAS = [['phoenix', { armor: { rar: 6, myth: 'phoenix' } }], ['eisherz', { helm: { rar: 6, myth: 'eisherz' } }], ['klinge', { weapon: { rar: 6, myth: 'klinge' } }], ['krone', { helm: { rar: 6, myth: 'krone' } }],
    ['ernter', { weapon: { rar: 6, myth: 'ernter' } }], ['midas', { helm: { rar: 6, myth: 'midas' } }], ['zorn', { weapon: { rar: 6, myth: 'zorn' } }], ['lion', { weapon: { rar: 5, set: 'lion' }, armor: { rar: 5, set: 'lion' }, helm: { rar: 5, set: 'lion' } }],
    ['dornen', { armor: { rar: 6, myth: 'dornen' } }], ['alle', { weapon: { rar: 6, myth: 'klinge' }, armor: { rar: 6, myth: 'phoenix' }, helm: { rar: 6, myth: 'krone' } }]];
  for (const [k, cfg] of AURAS) {
    const scene = 'a_' + k; if (!R.want(scene)) continue;
    const nm = await ev(cfg => {
      __scene(61); __hero(0); SAVE.meta.hide.intro = true; SAVE.meta.pets.act = null; enterHideout(); hideOverlay(); setState('play'); showHud(false);
      P.look = Object.assign({}, lookOf(P), { aura: null, wings: null });
      for (const s of ['weapon', 'armor', 'helm']) { const d = cfg[s] || { rar: 2 }, x = makeItem({ slot: s, base: s === 'weapon' ? 'sword' : s, form: s === 'weapon' ? 'zwei' : undefined, tier: 6, rar: d.rar, set: d.set, myth: d.myth }); if (d.set) x.name = SETS[d.set].pieces[s]; P.gear[s] = x; }
      computeStats(); G.dark = .8; P.x = BD.x0 + (BD.x1 - BD.x0) * .4; P.y = BD.y0 + (BD.y1 - BD.y0) * .38; P.face = 1; P.turn = 1; __vp(5.5); __snap(); __calm(); __step(20);
      const A = auraOf(P); return A.myth.map(m => AURA[m].n).concat(A.set ? [AURA[A.set].n] : []).join(' + ');
    }, cfg);
    await R.cap(scene, 48, `i => { __calm(); P.face = 1; }`);
    const pos = await ev(() => ({ x: (P.x - CX) * SCALE * 2, y: (P.y - CY) * SCALE * 2, s: SCALE * 2 }));
    info(scene, { k, n: nm, pos });
  }

  /* ---------- Basar: kaufen, bieten (Bieter überbieten dich), versteigern, Marktwert ---------- */
  if (R.want('m_bas')) {
    fresh('m_bas');
    await ev(() => {
      __scene(71); __hero(0); SAVE.meta.hide.intro = true; P.gold = 260000; P.bag = [makeItem({ slot: 'armor', base: 'armor', tier: 6, rar: 4 }), makeItem({ slot: 'weapon', base: 'sword', tier: 5, rar: 3 }), makeItem({ slot: 'helm', base: 'helm', tier: 4, rar: 2 })];
      const M = mkM(); M.own = []; M.box = []; M.shop = {}; enterHideout(); mkOpen('hide'); panel.scrollTop = 0;
    });
    await still('m_bas', 'buy'); await rect('m_bas', 'say', '#panel .mk .say'); await rect('m_bas', 'tabs', '#panel .mk .tabs');
    // eine Versteigerung mit vielen Geboten auswählen
    const aid = await ev(() => { MARKET.tick(); const L = MARKET.listings('auc').filter(A => A.t1 - mkNow() > 20 * 60000); L.sort((a, b) => (b.e.t === 'item' ? b.e.it.rar : 0) * 10 + b.bids.length - ((a.e.t === 'item' ? a.e.it.rar : 0) * 10 + a.bids.length)); const A = L[0]; A.bo = 0; MK.tab = 'bid'; MK.sel = A.id; MK.amtFor = null; mkShow(); __sheetTop(); return A.id; });
    await still('m_bas', 'bid0'); await rect('m_bas', 'sheet', '#panel .side.sheet'); await rect('m_bas', 'bidbtn', '[data-act="mk_bid"]'); await rect('m_bas', 'hist', '#panel .mk-hist');
    await still('m_bas', 'bid1', id => { ON.mk_bid(id); __sheetTop(); }, aid);
    await rect('m_bas', 'lead', '#panel .side.sheet .mk-good');
    // Kaspar (Last-Minute-Bieter) überbietet dich
    await ev(id => { const A = mkM().auc.find(x => x.id === id); A.bd.push({ n: 0, m: 3, k: 2, x: Date.now() + 150 }); }, aid);
    await page.waitForTimeout(400);
    await still('m_bas', 'bid2', () => { MARKET.tick(); mkAutoGold(); mkShow(); __sheetTop(); });
    await rect('m_bas', 'now2', '#panel .side.sheet .mk-now'); await rect('m_bas', 'hist2', '#panel .mk-hist'); await rectTxt('m_bas', 'row2', '#panel .mk .row', 'ÜBERBOTEN');
    // Verkaufen: Gegenstand mit Marktwert, Sofort an Hedda oder versteigern
    await still('m_bas', 'sell', () => { MK.tab = 'sell'; MK.cat = 'item'; MK.sel = P.bag[0].uid; mkShow(); panel.scrollTop = 0; });
    await rectTxt('m_bas', 'mw', '#panel .side.sheet li, #panel .side.sheet div', '^Marktwert'); await rect('m_bas', 'sheet3', '#panel .side.sheet');
    await still('m_bas', 'set', () => { ON.mk_set(); panel.scrollTop = 0; });
  }

  /* ---------- Schmiede: vier Bereiche, Meisterwerk in fünf Schritten ---------- */
  if (R.want('f_wb')) {
    fresh('f_wb');
    await ev(() => {
      __scene(81); __hero(0); SAVE.meta.hide.intro = true; SAVE.meta.hide.b.schmiede = 4; P.gold = 250000; for (const k of MATORDER) P.mats[k] = 60;
      P.parts = { 'klinge:9': 1, 'griff:7': 1, 'kern:feuer:6': 1, 'klinge:4': 2, 'griff:3': 3, 'kern:frost:3': 2, 'platte:3': 2, 'polster:2': 3, 'rune:licht:4': 1 };
      SAVE.meta.smith.lv = 23; SAVE.meta.smith.xp = 14000; P.bag = []; computeStats(); FG.last = null; WB.help = null;
      enterHideout(); selItem = P.gear.weapon.uid; wbTab = 'ver'; WB.act = 'up'; openWorkbench('smith'); panel.scrollTop = 0;
    });
    await still('f_wb', 'ver'); await rect('f_wb', 'secs', '#panel .wbsecs');
    await still('f_wb', 's1', () => { MW.slot = 'weapon'; MW.base = 'sword'; MW.form = 'zwei'; MW.tier = 6; MW.pick = {}; FG.last = null; wbTab = 'sch'; MW.step = 1; openWorkbench('smith'); panel.scrollTop = 0; });
    await rect('f_wb', 'steps', '#panel .mwsteps');
    await still('f_wb', 's2', () => { MW.step = 2; MW.tier = 6; openWorkbench('smith'); panel.scrollTop = 0; });
    await still('f_wb', 's3', () => { MW.step = 3; ON.mw_best(); panel.scrollTop = 0; });
    await still('f_wb', 's4', () => { MW.step = 4; openWorkbench('smith'); panel.scrollTop = 0; });
    await rect('f_wb', 'make', '[data-act="mw_make"]');
    const it = await ev(() => { ON.mw_make(); const f = findItem(FG.last.uid); const it = f.it; panel.scrollTop = 0; return { n: itemName(it), c: itemColor(it), rar: RAR[it.rar].n, mat: MAT[it.tier].n, ic: itemIconURL(it) }; });
    await still('f_wb', 's5'); await rect('f_wb', 'last', '#panel .fglast');
    R.saveData('f_wb/item.png', it.ic); delete it.ic; info('f_wb', it); console.log('Meisterwerk:', it.n, it.rar);
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
