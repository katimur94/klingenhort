// Aufnahmen für das ausführliche Video zu 6.1 „Die Endlosen Lande“ (~80 s, Kapitel):
// Aufhänger (Biome im Schnitt) → 1 Endlose Lande (48 Biome, Regionen, Karte bis zum Rand, Barriere + Werkzeug, Leuchtfeuer,
// Nacht, Tor der Alten) → 2 1200 Bosse (Kodex, Rang 1 gegen Rang 1200, Trophäe) → 3 Artefakte (Elwas Gerücht, Fund, Lesen,
// Suchkreis, versiegelter Schatz, Begegnungen) → 4 Kreaturen (77 Arten, Zucht, Mutationen, Ausrüstung, Zauber im Kampf)
// → 5 Mods (Plätze, Resonanz, Glyphen im Kampf, Umschmieden/Veredeln/Extrahieren) → Was ist neu → Endkarte.
// Alles echt aus dem Spiel: Freiwelt Bild für Bild (feste Welt-Saat, Ausflugs-Saat und Uhr festgelegt), Menüs als Standbilder,
// Grafiken (Kreaturen, Mutationen) als PNG. Meldungen des Spiels (Banner, Hinweise) werden mit Bildnummer mitgeschrieben
// (raw/<szene>/msgs.json) – storyboard.py zeigt genau diese Texte groß an.
// Aufruf (Spiel muss lokal laufen, siehe tools/promo/README.md):
//   PROMO_OUT=/tmp/klingenhort-clip-6.1 BASE=http://localhost:8766/ node scenes.js            alle Szenen
//   PROMO_OUT=/tmp/klingenhort-clip-6.1 node scenes.js region,bar_a                              nur diese neu aufnehmen
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.1';
const BASE = process.env.BASE || 'http://localhost:8766/';

// Biome für Aufhänger und Raster: [Szene, Biom] – „h_vulkan“ ist ein Kampf, alle anderen laufen
const BIOMES = ['gletscher', 'wueste', 'pilz', 'kristall', 'schattenwald', 'riff', 'sternenfeld', 'dschungel', 'herbst', 'traumwiese', 'chaos', 'goetterhain'];

(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 61, base: BASE });
  const { ev, page } = R;
  // Trefferzähler oben rechts ausblenden (stößt sonst an die Überschriften)
  await page.addStyleTag({ content: '#combo{display:none!important}' });
  const boxes = {};
  const still = async (scene, file, fn, arg, wait) => {
    if (fn) await ev(fn, arg); await page.waitForTimeout(wait || 350);
    fs.mkdirSync(R.out + scene, { recursive: true }); await page.screenshot({ path: `${R.out}${scene}/${file}.jpg`, type: 'jpeg', quality: 93 });
  };
  const saveBoxes = scene => fs.writeFileSync(`${R.out}${scene}/boxes.json`, JSON.stringify(boxes[scene], null, 1));
  const rect = async (scene, key, sel, i) => {
    const r = await ev(([sel, i]) => { const e = document.querySelectorAll(sel)[i || 0]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, i]);
    (boxes[scene] = boxes[scene] || {})[key] = r; saveBoxes(scene); return r;
  };
  const rectTxt = async (scene, key, sel, re) => {
    const r = await ev(([sel, re]) => { const e = [...document.querySelectorAll(sel)].find(x => new RegExp(re).test(x.textContent)); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, re]);
    (boxes[scene] = boxes[scene] || {})[key] = r; saveBoxes(scene); return r;
  };
  const fresh = scene => { const d = R.out + scene; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); boxes[scene] = {}; };
  const info = (scene, o) => fs.writeFileSync(`${R.out}${scene}/info.json`, JSON.stringify(o, null, 1));
  // Aufnahme mit Bildnummer (window.__fi) und Mitschrift: Meldungen des Spiels und eigenes Protokoll (window.__log) nach raw/<szene>/msgs.json
  const cap = async (name, n, per) => {
    if (!R.want(name)) return false;
    await ev(() => { window.__msg = []; window.__log = []; });
    await R.cap(name, n, `i => { window.__fi = i; (${per})(i); }`);
    fs.writeFileSync(`${R.out}${name}/msgs.json`, JSON.stringify(await ev(() => ({ msg: window.__msg, log: window.__log })), null, 0));
    return true;
  };

  /* ---------- Hilfen im Browser ---------- */
  await ev(() => {
    window.__msg = []; window.__fi = 0;
    // Meldungen mitschreiben (Banner und Hinweise sind im Bild ausgeblendet – der Schnitt zeigt sie groß)
    const _b = window.banner, _t = window.toast;
    window.banner = function (t, s) { window.__msg.push({ f: window.__fi, k: 'b', t: String(t), s: String(s || '') }); return _b.apply(this, arguments); };
    window.toast = function (t, c) { window.__msg.push({ f: window.__fi, k: 't', t: String(t), c: String(c || '') }); return _t.apply(this, arguments); };
    for (const a of ACH) SAVE.meta.ach[a.id] = 1;   // Erfolge zahlen sonst zwischendurch Gold und melden sich
    SAVE.meta.hide.intro = true; SAVE.meta.lande.tips = 0xffff; SAVE.meta.bosses.h = 2147483647;
    window.__gear0 = SAVE.chars.map(c => JSON.stringify(c.gear));
    window.__off2 = () => { keys.KeyJ = keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; };
    // alles beenden: Freiwelt, Kampfplatz, Menüs; Kamera und Texte wie im Spiel
    window.__ui = () => {
      if (typeof LW !== 'undefined' && LW) { try { if (LW.on) lEnd(); } catch (e) { } try { lRelease(); } catch (e) { } LW = null; }
      SAVE.meta.lande.cur = null; document.body.classList.remove('lande'); try { lHudShow(false); } catch (e) { }
      if (BA) { try { bArenaClear(); } catch (e) { } BA = null; } BZ.fx = []; BZ.call = null; try { bDarkEnd(); } catch (e) { } slowmo = 0; hitStop = 0;
      DLG = null; hideOverlay(); showHud(false); $('bossbar').hidden = true; window.__camDX = 0; window.__camDY = 0; window.__txtNo = null; window.__txtOK = null; window.__kinds = null;
      __off2(); titleScene(); texts = []; parts = []; setState('title');
    };
    // Held ci mit seiner Ausrüstung; Begleiter: Eulenbär (Mischform aus der Zucht, Sternen-Mutation, drei Zauber)
    window.__hero = (ci, noPet) => {
      activateChar(ci); P.gear = JSON.parse(__gear0[ci]); P.lv = 40; P.mods = {}; computeStats(); P.hp = P.st.hp;
      const M = SAVE.meta.pets; M.list = []; M.eggs = []; M.first = true; M.intro = true; M.act = null;
      if (!noPet) { const p = petGive('eulenbaer', { lv: 80, mu: 'sternen', pa: ['eule', 'baer'], ge: 2, gn: [88, 61, 74, 92, 55] }); delete p.hurt; p.mg = ['meteor', 'blitz', 'schild']; M.act = p.id; petView = p.id; }
      computeStats(); P.hp = P.st.hp;
    };
    // Freiwelt betreten: Ausflugs-Saat und Uhr fest (gleiche Truhen, Lager, Streifen bei jeder Aufnahme)
    window.__lgo = (o) => {
      o = o || {}; __ui(); __hero(o.ci || 0, o.noPet); hideOverlay();
      const M = SAVE.meta.lande; M.tools = o.tools != null ? o.tools : 0; M.stones = o.stones != null ? o.stones : 1; M.cps = []; M.cpn = 0; M.start = 'tor'; M.map = {}; M.regs = []; M.keys = 0;
      LMAP = null; LREGS = null;
      const seed = o.seed || 1; __seed(seed); const dn = Date.now; Date.now = () => 1761500000000 + seed * 7919; try { lBegin(); } finally { Date.now = dn; }
      __calm(); __vp(o.vp || 2.6); __snap(); texts = []; __seed(seed + 1000);
    };
    // Ruhe: keine Jäger, Rivalen, Ungeheuer; Held unverwundbar
    window.__calm = () => { if (LW) { LW.huntT = 1e9; LW.rivT = 1e9; LW.hurtT = -99; LW.beastN = false; } P.inv = 99; P.hp = P.st.hp; P.res = P.st.resMax; };
    // nichts in der Nähe, das aufwacht (Horte, Lager, Streifen, Rivalen, Begegnungen)
    window.__quiet = rad => { if (!LW) return; for (const o of lNear(P.x, P.y, rad || 900)) { if (o.k === 'lair') o.act = true; else if (o.k === 'camp') { o.left = []; o.state = 'done'; } else if (o.k === 'enc') o.used = true; } LW.pats = LW.pats.filter(p => Math.hypot(p.x - P.x, p.y - P.y) > 1400); LW.rivals = []; };
    window.__clear = () => { for (const e of enemies) e.dead = true; enemies = []; projs = []; };
    // wartende Banner vergessen (beim Teleport hätte das Spiel sonst ältere Meldungen nachgereicht)
    window.__nomsg = () => { LBQ.length = 0; LBT = -9; window.__msg = []; };
    // Held hinstellen (Chunks laden, Nebel aufdecken, Gegner weg, Begleiter daneben)
    window.__tp = (x, y) => { lTeleport(x, y); __clear(); __calm(); try { petPlace(false); } catch (e) { } __snap(); };
    window.__go = (tx, ty, r) => { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy); keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; if (d < (r || 4)) return true; keys.KeyD = dx > d * .38; keys.KeyA = dx < -d * .38; keys.KeyS = dy > d * .38; keys.KeyW = dy < -d * .38; return false; };
    // Gegner der Gegend nachfüllen (wie __keep, aber mit den Bewohnern des Bioms und der Tiefen-Stufe)
    window.__lkeep = (n, atk) => {
      P.inv = 99; P.hp = P.st.hp; P.res = P.st.resMax; keys.KeyJ = atk !== false; for (let i = 0; i < 3; i++) P.cds[i] = Math.min(P.cds[i], .2);
      const live = enemies.filter(e => !e.dead && !e.boss);
      if (live.length < n) { const a = Math.random() * 6.283, pool = lPool(lBioAt(P.x, P.y), lStage(P.x, P.y)); lSpawn(pick(pool), P.x + Math.cos(a) * 60, P.y + Math.sin(a) * 40, { instant: Math.random() < .5 }); }
    };
    // Saatpunkt der nächsten Region jedes Bioms (Chunks)
    window.__bio = {};
    for (let r = 1; r < 1700; r += r < 40 ? 1 : r < 300 ? 3 : 9) for (let a = 0; a < 6.283; a += Math.max(.02, 2 / r)) { const C = lCell(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); if (!__bio[C.biome] || __bio[C.biome].dist > C.dist) __bio[C.biome] = { sx: C.sx, sy: C.sy, dist: C.dist }; }
    window.__wp = (cx, cy) => ({ x: cx * LCK + LOFF, y: cy * LCK + LOFF });
    // Lage auf dem Bildschirm (Bildpunkte im Video) eines Spielpunkts
    window.__scr = (x, y) => ({ x: (x - CX) * SCALE * 2, y: (y - CY) * SCALE * 2 });
  });

  await R.news();
  if (R.want('assets')) await R.assets();

  /* ================= 1 Die Endlosen Lande ================= */
  // Laufbilder durch verschiedene Biome (alle Werkzeuge dabei: keine Gefahren, damit man das Gelände sieht)
  for (const b of BIOMES) {
    const scene = 'w_' + b; if (!R.want(scene)) continue;
    const st = await ev(b => {
      __lgo({ seed: 3, tools: 2047 }); const S = __bio[b], p0 = __wp(S.sx - 1.1, S.sy + .5), p = lFreeNear(p0.x, p0.y, 200) || p0;
      __tp(p.x, p.y); __quiet(1200); P.face = 1; __step(3); __clear();
      const R_ = lRegAt(P.x, P.y); return { b, n: LANDE_BIOMES[b].n, reg: lRegName(R_), st: lStage(P.x, P.y), depth: landeDepth() };
    }, b);
    await cap(scene, 36, `i => { __calm(); __quiet(900); __clear(); const t = i * .05; keys.KeyD = true; keys.KeyS = Math.sin(t * 3) > .55; keys.KeyW = Math.sin(t * 3) < -.55; window.__log.push([Math.round(P.x), Math.round(P.y)]); }`);
    info(scene, st); console.log(scene, st.reg, 'St.', st.st);
  }
  // Aufhänger: Kampf am Vulkanhang – Bewohner des Bioms, der Begleiter zaubert mit
  if (R.want('h_fight')) {
    const st = await ev(() => {
      __lgo({ seed: 4, tools: 2047 }); const S = __bio.vulkan, p0 = __wp(S.sx + 1.2, S.sy - .6), p = lFreeNear(p0.x, p0.y, 200) || p0;
      __tp(p.x, p.y); __quiet(1200); P.face = 1; window.__txtOK = /METEOR|BLITZ|SCHILD/; __vp(3.0); __snap();
      for (let i = 0; i < 4; i++) __lkeep(5); __step(8);
      return { n: LANDE_BIOMES.vulkan.n, reg: lRegName(lRegAt(P.x, P.y)), st: lStage(P.x, P.y) };
    });
    await cap('h_fight', 48, `i => { __calm(); __quiet(900); __lkeep(6); if (i % 16 < 8) { keys.KeyD = true; keys.KeyA = false; } else { keys.KeyD = false; keys.KeyA = i % 32 > 24; } }`);
    await ev(() => { window.__txtOK = null; __off2(); });
    info('h_fight', st);
  }

  // Neue Region: der Held läuft über eine Regionsgrenze (Wald → Schnee) – Banner „NEUE REGION: …“
  if (R.want('region')) {
    const st = await ev(() => {
      __lgo({ seed: 5, tools: 2047 });
      // Grenze suchen: zwei sehr verschiedene Biome nebeneinander, ohne Barriere dazwischen, nicht weit vom Tor
      const pairs = [['wald', 'schnee'], ['herbst', 'schnee'], ['tannen', 'schnee'], ['wiese', 'schnee'], ['heide', 'schnee'], ['steppe', 'canyon'], ['wald', 'pilz'], ['fels', 'schnee']];
      let best = null;
      for (let r = 12; r < 60 && !best; r += 1) for (let a = 0; a < 6.283 && !best; a += .05) {
        const x = Math.cos(a) * r, y = Math.sin(a) * r, A = lRegAtC(x, y), B = lRegAtC(x + .32, y);
        if (A === B || !pairs.some(([p, q]) => A.biome === p && B.biome === q)) continue;
        let ok = true; for (let k = 0; k <= 12; k++) { const c = lClassC(x - .1 + k * .04, y); if (c.bar >= 0) ok = false; }
        if (ok) best = { x, y, a: A.biome, b: B.biome };
      }
      // Grenze im geladenen Gelände genau suchen, Start ~115 px davor (der Held braucht ~1,4 s bis hinüber)
      const p0 = __wp(best.x, best.y); __tp(p0.x - 90, p0.y); __quiet(1200); __step(2);
      const R0 = lRegAt(P.x, P.y); let gx = P.x; for (let k = 0; k < 160; k++) { if (lRegAt(gx, P.y) !== R0) break; gx += 3; }
      __tp(gx - 115, P.y); __quiet(1200); P.face = 1; __step(3); __clear(); __nomsg();
      return Object.assign(best, { from: lRegName(lRegAt(P.x, P.y)), to: lRegName(lRegAt(gx + 6, P.y)), toX: gx, x0: P.x });
    });
    console.log('Region', JSON.stringify(st));
    await cap('region', 90, `i => { __calm(); __quiet(900); __clear(); keys.KeyD = true; keys.KeyW = keys.KeyS = false; window.__log.push([Math.round(P.x), Math.round(P.y), lRegName(lRegAt(P.x, P.y))]); }`);
    await ev(() => __off2());
    info('region', st);
  }

  // Karte der Lande: vom Weltentor bis an den Rand der Welt (für das Video ganz aufgedeckt: ein Gitter, das bei jedem Zoom jedes Kartenpixel trifft)
  if (R.want('map')) {
    fresh('map');
    await ev(() => {
      __lgo({ seed: 6, tools: 0 }); const [x, y] = lRoadPt(1, 1.2); __tp(x * LCK + LOFF, y * LCK + LOFF);
      const map = lMap();
      for (let L = 0; L <= 7; L++) { const s = 1 << L, r0 = L ? 200 * (1 << (L - 1)) : 0, r1 = L === 7 ? 18400 : 200 * (1 << L); for (let fy = -r1; fy <= r1; fy += s) for (let fx = -r1; fx <= r1; fx += s) { const d = Math.hypot(fx, fy); if (d < r0 || d >= r1) continue; lFSet(map, fx, fy); } }
      lMapScreen(); LMV.cx = P.x - LOFF; LMV.cy = P.y - LOFF; LMV.z = 16; lMapRender(); panel.scrollTop = 0;
    });
    await still('map', 'screen'); await rect('map', 'cv', '#lmapBig'); await rect('map', 'panel', '#panel');
    const zs = []; for (let k = 0; k <= 12; k++) zs.push(16 * Math.pow(2, k));
    const meta = [];
    for (const z of zs) {
      const r = await ev(z => { LMV.z = z; const t0 = performance.now(); lMapRender(); return { z, ms: Math.round(performance.now() - t0), w: $('lmapN').textContent, u: $('lmapBig').toDataURL() }; }, z);
      R.saveData(`map/z_${z}.png`, r.u); meta.push({ z: r.z, w: r.w, ms: r.ms }); console.log('Karte z', z, r.w, r.ms + ' ms');
    }
    info('map', { zs: meta, edge: await ev(() => ({ km: lKm(LWR * LCK), st0: worldStage(0), st1: worldStage(1), hero: [P.x - LOFF, P.y - LOFF] })) });
    // Karte wieder vergessen (die anderen Szenen zeigen nur, was dort erkundet ist)
    await ev(() => { LMAP = null; SAVE.meta.lande.map = {}; lResume(); });
  }

  // Barriere ohne Werkzeug: Schlucht am Alten Weg, Übergang mit Planken – „Du brauchst: Seil“
  if (R.want('bar_a')) {
    const st = await ev(() => {
      __lgo({ seed: 7, tools: 0 }); const c = lRoadCross(0, 0), [x, y] = lRoadPt(0, Math.hypot(c.px, c.py) - .24); __tp(x * LCK + LOFF, y * LCK + LOFF); __quiet(1200);
      window.__c = c; P.face = 1; __vp(2.8); __snap(); __step(3); __nomsg();
      return { bar: LBAR[LBARK[c.kind]].n, tool: LANDE_TOOLS[c.need].n, cx: c.px * LCK + LOFF, cy: c.py * LCK + LOFF };
    });
    await cap('bar_a', 84, `i => { __calm(); __quiet(900); __clear(); const c = window.__c; __go(c.px * LCK + LOFF + 6, c.py * LCK + LOFF, 2); window.__log.push([Math.round(P.x), Math.round(P.y)]); }`);
    await ev(() => __off2());
    info('bar_a', st);
  }
  // Werkzeug-Hort mit Runenrätsel: Steine I – II – III – IV berühren, der Hort öffnet sich, das Seil liegt auf dem Sockel
  if (R.want('bar_hort')) {
    const st = await ev(() => {
      __lgo({ seed: 8, tools: 0 }); const N = lToolN(0); let s = null; for (let j = 0; j < N; j++) { const q = lToolSite(0, j); if (!s || Math.hypot(q.x, q.y) < Math.hypot(s.x, s.y)) s = q; }
      const p = __wp(s.x, s.y); __tp(p.x, p.y + 120); __quiet(1200);
      const o = lNear(P.x, P.y, 600).find(x => x.k === 'tool'); window.__H = o; P.face = 1; __vp(2.8); __step(4); __clear(); __nomsg();
      return { guard: o.guard, x: o.x, y: o.y, stones: o.stones.map(t => [Math.round(t.x), Math.round(t.y), t.n]) };
    });
    console.log('Hort', JSON.stringify(st));
    // nacheinander zum nächsten Stein laufen (Reihenfolge s.n), dann zum Sockel; die Wächter des Horts kämpfen gegen Held und Begleiter
    await cap('bar_hort', 300, `i => {
      __calm(); __quiet(900); const o = window.__H; let tgt = null;
      if (o.state !== 'open' && o.state !== 'done') { const s = o.stones.find(t => t.n === o.lit); tgt = s; } else if (o.state === 'open') tgt = o;
      keys.KeyJ = enemies.some(e => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 34);
      if (tgt) __go(tgt.x, tgt.y + (tgt === o ? 4 : 2), 2); else __off2();
      window.__log.push([o.lit, o.state, enemies.filter(e => !e.dead).length]);
    }`);
    await ev(() => __off2());
    info('bar_hort', st);
  }
  // Mit dem Seil über die Schlucht
  if (R.want('bar_b')) {
    await ev(() => {
      __lgo({ seed: 7, tools: 1 }); const c = lRoadCross(0, 0), [x, y] = lRoadPt(0, Math.hypot(c.px, c.py) - .22); __tp(x * LCK + LOFF, y * LCK + LOFF); __quiet(1200);
      window.__c = c; const [x2, y2] = lRoadPt(0, Math.hypot(c.px, c.py) + 1.4); window.__t2 = [x2 * LCK + LOFF, y2 * LCK + LOFF]; P.face = 1; __vp(2.8); __snap(); __step(3); __nomsg();
    });
    await cap('bar_b', 96, `i => { __calm(); __quiet(900); __clear(); const c = window.__c; if (!window.__over) { if (__go(c.px * LCK + LOFF + 10, c.py * LCK + LOFF, 6)) window.__over = 1; } else __go(window.__t2[0], window.__t2[1], 4); window.__log.push([Math.round(P.x), Math.round(P.y)]); }`);
    await ev(() => { __off2(); window.__over = 0; });
  }

  // Leuchtfeuer setzen: Bildschirm, Entzünden, das Feuer brennt in der Welt
  if (R.want('cp_screen') || R.want('cp_light') || R.want('cp_gate')) {
    await ev(() => {
      __lgo({ seed: 9, tools: 1, stones: 2 }); const [x, y] = lRoadPt(1, 8); __tp(x * LCK + LOFF, y * LCK + LOFF); __quiet(1200);
      for (const o of lNear(P.x, P.y, 400)) if (o.k === 'camp') o.state = 'done'; P.face = 1; __vp(3.0); __snap(); __step(10); __clear();
    });
    fresh('cp_screen');
    await still('cp_screen', 'screen', () => { lCpScreen(); panel.scrollTop = 0; });
    await rect('cp_screen', 'panel', '#panel'); await rect('cp_screen', 'ok', '[data-act="l_cpok"]'); await rect('cp_screen', 'rules', '#panel .lrules');
    await ev(() => { LW.hurtT = -99; __clear(); __nomsg(); ON.l_cpok(); });
    // Bilder ab dem Entzünden (das Banner kam eben)
    await R.cap('cp_light', 72, `i => { window.__fi = i + 1; __calm(); __clear(); P.face = 1; __off2(); }`);
    fs.writeFileSync(`${R.out}cp_light/msgs.json`, JSON.stringify(await ev(() => ({ msg: window.__msg.map(m => Object.assign(m, { f: 0 })), log: [] }))));
    // Ausflug beenden (durch das eigene Leuchtfeuer), dann das Weltentor im Versteck: Startpunkt wählen
    fresh('cp_gate');
    await ev(() => { const b = lNear(P.x, P.y, 200).find(x => x.k === 'beacon'); lExtract(b); ON.l_home(); hideOverlay(); lGate('hide'); panel.scrollTop = 0; });
    await still('cp_gate', 'g0', () => { ON.l_start('tor'); panel.scrollTop = 0; }); await rect('cp_gate', 'starts', '#panel .lstart'); await rect('cp_gate', 'opt1', '#panel .lstart [data-act="l_start"]', 1); await rect('cp_gate', 'opt0', '#panel .lstart [data-act="l_start"]', 0);
    await rectTxt('cp_gate', 'head', '#panel h3', 'STARTPUNKT');
    await still('cp_gate', 'g1', () => { ON.l_start('c0'); panel.scrollTop = 0; });
    info('cp_gate', await ev(() => ({ starts: [...panel.querySelectorAll('.lstart [data-act="l_start"]')].map(e => e.textContent) })));
  }

  // Die Nacht bricht an (Zeitraffer): es wird dunkel, Jäger der Nacht kommen
  if (R.want('night')) {
    await ev(() => {
      __lgo({ seed: 10, tools: 2047 }); const [x, y] = lRoadPt(2, 14); __tp(x * LCK + LOFF, y * LCK + LOFF); __quiet(1500);
      window.__rd = []; for (let k = 0; k < 60; k++) window.__rd.push(lRoadPt(2, 14 + k * .06).map(v => v * LCK + LOFF));
      LW.t = LDAY * .56; P.face = 1; __vp(2.8); __snap(); __step(3); __clear(); __nomsg();
    });
    await cap('night', 132, `i => {
      __calm(); __quiet(900); const L = LW; L.t = LDAY * (.56 + i * .0016); L.tick = 0;
      const q = window.__rd[Math.min(window.__rd.length - 1, 2 + Math.floor(i / 5))]; __go(q[0], q[1], 6);
      if (i === 50 || i === 78 || i === 102) { const st = lStage(P.x, P.y), pool = lPool(lBioAt(P.x, P.y), st); for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; lSpawn(pick(pool), P.x + Math.cos(a) * 70, P.y + Math.sin(a) * 46, { instant: false, elite: k === 0 }); } }
      keys.KeyJ = enemies.some(e => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 44);
      window.__log.push([LDNG[lPhase(L.t)].n, +lNight(L.t).toFixed(2), enemies.filter(e => !e.dead).length]);
    }`);
    await ev(() => __off2());
  }

  // Tor der Alten: hineinstellen, warten, entkommen
  if (R.want('exit')) {
    const st = await ev(() => {
      __lgo({ seed: 11, tools: 2047 });
      let ex = null; for (let r = 1; r < 6 && !ex; r++) for (let gy = -r; gy <= r && !ex; gy++) for (let gx = -r; gx <= r && !ex; gx++) { const e = lExitCell(gx, gy); if (e && e.t === 'portal') ex = e; }
      const p = __wp(ex.x, ex.y); __tp(p.x + 64, p.y + 26); __quiet(1500);
      const o = lNear(P.x, P.y, 300).find(x => x.k === 'exit'); window.__ex = o; LW.t = 300;
      LW.pack = [{ t: 'item', it: lItem(4, 3) }, { t: 'item', it: lItem(3, 2) }, { t: 'gold', n: 1840 }, { t: 'mod', k: 'glyphe_meteor:4', n: 1 }, { t: 'gem', k: 'rubin:3', n: 1 }, { t: 'mat', k: 'mithril', n: 6 }, { t: 'part', k: 'klinge:5', n: 1 }];
      for (const e of LW.pack) if (e.t === 'item') e.it.lw = LW.id;
      P.face = -1; __vp(3.0); __snap(); __step(3); __clear(); __nomsg();
      return { t: o.t, x: o.x, y: o.y, need: lChannel(o) };
    });
    console.log('Tor', JSON.stringify(st));
    await cap('exit', 120, `i => { __calm(); __quiet(900); __clear(); const o = window.__ex; if (LW && LW.on) { __go(o.x, o.y + 1, 3); window.__log.push([+LW.ch.toFixed(2), $('objective').textContent]); } else window.__log.push([-1, '']); }`);
    fresh('exit_done');
    await ev(() => { for (let k = 0; k < 200 && LW && LW.on; k++) { __calm(); __step(1); } });
    await still('exit_done', 'done', () => { panel.scrollTop = 0; }, null, 2400);
    await rect('exit_done', 'panel', '#panel'); await rect('exit_done', 'kv', '#panel .kv'); await rect('exit_done', 'head', '#panel .head');
    info('exit', st);
  }

  /* ================= 2 1200 Bosse ================= */
  // Boss-Kodex: 137 Trophäen, Rang-Bänder von Leicht bis Fast unmöglich
  if (R.want('kodex')) {
    fresh('kodex');
    await ev(() => {
      __ui(); __hero(0); const M = SAVE.meta.bosses; M.b = {}; M.l = {}; for (let i = 0; i < 137; i++) M.b[i * 3] = [29400000, 1 + i % 3, i, -i]; for (let i = 0; i < 40; i++) M.b[i * 3 + 1] = [0, 0, 5, 5]; BTROPH = -1;
      KX.band = 0; KX.sel = -1; KX.filt = 'all'; bossKodex('title'); panel.scrollTop = 0;
    });
    await still('kodex', 'k0'); await rect('kodex', 'top', '#panel .bk-top'); await rect('kodex', 'bands', '#panel .bk-bands'); await rect('kodex', 'n', '#panel .bk-n');
    await rect('kodex', 'b0', '#panel .bk-band', 0); await rect('kodex', 'b11', '#panel .bk-band', 11); await rect('kodex', 'grid', '#panel .bk-grid');
    await still('kodex', 'k1', () => { KX.band = 11; KX.sel = -1; bossKodex(); panel.scrollTop = 0; });
    await rect('kodex', 'grid1', '#panel .bk-grid');
    await still('kodex', 'k2', () => { KX.band = 0; KX.sel = 9; bossKodex(); const s = panel.querySelector('.side.sheet'); panel.scrollTop = 0; if (s) panel.scrollTop = s.getBoundingClientRect().top - panel.getBoundingClientRect().top - 120; });
    await rect('kodex', 'side', '#panel .side.sheet');
  }
  // Bosskämpfe im echten Kampfplatz: Rang 1 und Rang 1200 (Held unverwundbar), Mechaniken aus ihrer eigenen Liste
  const FIGHTS = [['b_low', 0, 108], ['b_high', 1199, 132]];
  for (const [scene, id, n] of FIGHTS) {
    if (!R.want(scene)) continue;
    const st = await ev(id => {
      __ui(); __hero(0); const M = SAVE.meta.bosses; M.b = {}; for (let i = 0; i < 137; i++) M.b[i * 3 + 3] = [29400000, 1, i, -i]; BTROPH = -1;
      hideOverlay(); BA = null; slowmo = 0; hitStop = 0; bossArena(id, { practice: false }); __vp(2.6); P.inv = 1e9; for (let k = 0; k < 240 && !enemies.some(x => x.bz); k++) __step(1); __step(8);
      // zäher Boss (×40 Leben): der Held auf Level 40 hätte Rang 1 sonst mit zwei Treffern besiegt, bevor die Mechanik zu sehen ist
      const e = enemies.find(x => x.bz); e.maxHp *= 40; e.hp = e.maxHp; P.x = e.x + 6; P.y = e.y + 64; P.face = 1; window.__camDY = -54; window.__camDX = 0; __step(2); __snap(); window.__msg = [];
      const B = bossDef(id); return { id, name: B.name, title: B.title, rank: B.rank, band: BBAND[B.band], mech: B.mech.map(k => BMECH[k].n), keys: B.mech, el: B.el };
    }, id);
    console.log(scene, JSON.stringify(st));
    // die eigenen Mechaniken des Bosses der Reihe nach auslösen (sonst wartet er auf die Abklingzeit); beim hohen Rang mehrere gleichzeitig
    await cap(scene, n, `i => {
      P.inv = 1e9; P.hp = P.st.hp; P.res = P.st.resMax; const e = enemies.find(x => x.bz && !x.dead); if (!e) return;
      e.hp = Math.max(e.hp, e.maxHp * .62); const ks = e.bDef.mech.filter(k => !BMECH[k].p), every = ${id > 600 ? 22 : 40};
      if (i % every === 4) { const k = ks[Math.floor(i / every) % ks.length]; bossCast(e, k); window.__log.push(['cast', i, k]); }
      const d = Math.hypot(e.x - P.x, e.y - P.y); keys.KeyJ = d < 70; __go(e.x + 4, e.y + 40, 18);
      window.__camDX = clamp((e.x - P.x) * .4, -40, 40); window.__camDY = clamp((e.y - P.y) * .5, -50, 0) - 24;   // etwas tiefer: oben ist Platz für die Überschriften
      window.__log.push(['z', i, BZ.fx.length]);
    }`);
    await ev(() => __off2());
    info(scene, st);
  }
  // Erster Sieg über Rang 1200: Trophäe, Beute
  if (R.want('b_kill')) {
    await ev(() => {
      const e = enemies.find(x => x.bz && !x.dead); if (e) { e.hp = 1; e.armor = 0; } window.__msg = [];
    });
    // der Kampf ist gekürzt: der letzte Treffer fällt in Bild 8 (killEnemy wie im Spiel), danach Beute, „BOSS BESIEGT“ und die Trophäe
    await cap('b_kill', 132, `i => { P.inv = 1e9; P.hp = P.st.hp; let e = enemies.find(x => x.bz && !x.dead); if (e && i === 8) { killEnemy(e, 0, -1); e = null; } if (e) { const d = Math.hypot(e.x - P.x, e.y - P.y); keys.KeyJ = true; __go(e.x + 4, e.y + 30, 16); window.__camDX = clamp((e.x - P.x) * .4, -40, 40); window.__camDY = clamp((e.y - P.y) * .5, -50, 50) - 24; } else { __off2(); window.__camDX *= .9; window.__camDY *= .9; for (const c of pickups) c.mag = 0; } window.__log.push([e ? 1 : 0, pickups.length]); }`);
    await ev(() => { __off2(); BA && (BA.end = 0); });
  }

  /* ================= 3 Artefakte & Begegnungen ================= */
  // Außenposten am Tor: Kundschafterin Elwa kennt ein Gerücht über eine Spur
  if (R.want('elwa_walk')) {
    await ev(() => { __lgo({ seed: 12, tools: 0 }); const o = lNear(P.x, P.y, 500).find(n => n.k === 'npc' && n.role === 'mis'); window.__npc = o; __tp(o.x - 76, o.y + 30); __quiet(900); P.face = 1; __vp(3.0); __snap(); __step(2); __clear(); });
    await cap('elwa_walk', 48, `i => { __calm(); __clear(); const o = window.__npc; __go(o.x - 16, o.y + 8, 3); }`);
    await ev(() => __off2());
  }
  if (R.want('elwa')) {
    fresh('elwa');
    await ev(() => { const o = window.__npc || lNear(P.x, P.y, 500).find(n => n.k === 'npc' && n.role === 'mis'); lMisScreen(o); panel.scrollTop = 0; });
    await still('elwa', 'mis'); await rectTxt('elwa', 'rumor', '#panel .lmis', 'Gerücht über eine Spur'); await rectTxt('elwa', 'tool', '#panel .lmis', 'Gerücht: '); await rect('elwa', 'say', '#panel .say');
    info('elwa', await ev(() => ({ rumor: ([...panel.querySelectorAll('.lmis')].find(e => /Gerücht über eine Spur/.test(e.textContent)) || {}).textContent })));
  }
  // Ein Artefakt in der Welt: hinlaufen, aufheben → Lesebildschirm
  if (R.want('a_walk')) {
    const st = await ev(() => {
      __lgo({ seed: 13, tools: 0 }); const r = arteRumor(0, 0), C = aChain(r.chain), s0 = C.sites[0]; window.__arc = r.chain; window.__s0 = s0;
      __tp(s0.x + LOFF - 70, s0.y + LOFF + 30); __quiet(900); P.face = 1; __vp(3.0); __snap(); __step(2); __clear(); __nomsg();
      return { chain: r.chain, title: C.title, L: C.L, guard: C.rw.guard };
    });
    console.log('Spur', JSON.stringify(st));
    await cap('a_walk', 54, `i => { if (state !== 'play') { window.__log.push([1]); return; } __calm(); __clear(); const s = window.__s0; __go(s.x + LOFF, s.y + LOFF, 1); window.__log.push([0]); }`);
    await ev(() => __off2());
    info('a_walk', st);
  }
  if (R.want('a_read')) {
    fresh('a_read');
    await ev(() => { if (!document.querySelector('#panel .arp')) arteRead(aChain(window.__arc).off, 'play', { fresh: true }); panel.scrollTop = 0; });
    await still('a_read', 'read'); await rect('a_read', 'panel', '#panel'); await rect('a_read', 'arp', '#panel .arp'); await rect('a_read', 'hint', '#panel .arhint'); await rect('a_read', 'new', '#panel .arnew'); await rect('a_read', 'side', '#panel .arside');
    await rect('a_read', 'spur', '#panel .arspur'); await rect('a_read', 'head', '#panel .head');
    info('a_read', await ev(() => ({ hint: (panel.querySelector('.arhint') || {}).textContent, new: (panel.querySelector('.arnew') || {}).textContent, name: (panel.querySelector('.arnm') || {}).textContent })));
  }
  // Karte: Suchkreis um das nächste Artefakt (aufgedeckt ist nur die Gegend, durch die der Held vom Tor hierher gelaufen ist)
  if (R.want('a_map')) {
    fresh('a_map');
    await ev(() => {
      ON.arte_back(); const s0 = window.__s0; for (let k = 0; k <= 12; k++) lRevealW(384 + (s0.x - 384) * k / 12, 372 + (s0.y - 372) * k / 12, 2);
      lMapScreen(); LMV.z = 24; const h = arteHints().find(x => x.chain === window.__arc && x.k === 'arte'); LMV.cx = (P.x - LOFF + h.x) / 2; LMV.cy = (P.y - LOFF + h.y) / 2; lMapRender(); panel.scrollTop = 0;
    });
    await still('a_map', 'map'); await rect('a_map', 'cv', '#lmapBig');
    info('a_map', await ev(() => { const h = arteHints().find(x => x.chain === window.__arc && x.k === 'arte'), z = LMV.z, S = 240; return { hx: (h.x - LMV.cx) / z + S / 2, hy: (h.y - LMV.cy) / z + S / 2, hr: h.r / z, label: h.label }; }));
  }
  // Versiegelter Schatz (noch nicht alle Teile) – und später, mit allen Teilen, geborgen
  if (R.want('a_seal')) {
    fresh('a_seal');
    await ev(() => { lResume(); const C = aChain(window.__arc), t = C.sites[C.L]; window.__ts = t; __tp(t.x + LOFF, t.y + LOFF + 50); __quiet(900); for (let i = 0; i < 60 && state === 'play'; i++) { __calm(); __go(t.x + LOFF, t.y + LOFF, 1); __step(1); } __off2(); panel.scrollTop = 0; });
    await still('a_seal', 'seal'); await rect('a_seal', 'box', '#panel .artr'); await rect('a_seal', 'panel', '#panel');
  }
  if (R.want('a_walk2')) {
    // die übrigen Teile der Spur sind gefunden (gestellt: im Video übersprungen), der Held kommt zurück zum Schatz
    await ev(() => {
      ON.arte_back(); const c = window.__arc, C = aChain(c); for (let i = 1; i < C.L; i++) artePickup(C.off + i, { quiet: true }); lArteReady(c);
      const t = window.__ts; __tp(t.x + LOFF - 60, t.y + LOFF + 34); __quiet(900); P.face = 1; __step(2); __clear(); __nomsg();
    });
    await cap('a_walk2', 48, `i => { if (state !== 'play') { window.__log.push([1]); return; } __calm(); __clear(); const t = window.__ts; __go(t.x + LOFF, t.y + LOFF, 1); window.__log.push([0]); }`);
    await ev(() => __off2());
  }
  if (R.want('a_open')) {
    fresh('a_open');
    await ev(() => { if (!document.querySelector('#panel .artr')) arteTreasureOpen(window.__arc, { noGuard: true }); panel.scrollTop = 0; });
    await still('a_open', 'open', null, null, 600); await rect('a_open', 'panel', '#panel'); await rect('a_open', 'box', '#panel .artr'); await rectTxt('a_open', 'fund', '#panel h3', 'DEIN FUND');
    await ev(() => ON.arte_back());
  }
  // Mystische Begegnungen
  if (R.want('enc')) {
    fresh('enc');
    for (const k of ['sphinx', 'spiegelhexe', 'feenring', 'drache']) {
      await still('enc', k, k => { __ui(); __hero(0); __lgo({ seed: 14, tools: 0 }); setState('play'); encounterOpen({ key: k, x: P.x, y: P.y, depth: .2, cx: 5, cy: 5, teleport: () => { } }); panel.scrollTop = 0; }, k);
      await rect('enc', k, '#panel');
    }
    info('enc', await ev(() => ({ n: Object.keys(ENCD).length })));
  }

  /* ================= 4 Kreaturen ================= */
  // Grafiken: alle 77 Arten (Stufe Erwachsen), Mutationen an einer Art, Eier
  if (R.want('p_art')) {
    fresh('p_art');
    const A = await ev(() => {
      const o = { pets: [], mut: [], tiers: PET_TIERS.map(t => ({ n: t.n, c: t.c })) };
      for (const sp of PET_ORDER) { const S = PET_SP[sp], U = petImgURL(sp, 3, 0, false, true); o.pets.push({ sp, n: S.n, t: S.t, hy: !!S.hy, fly: !!S.fly, u: U.url, W: U.W, H: U.H }); }
      for (const mu of ['', 'kristall', 'schatten', 'gold', 'sternen']) { const U = petImgURL('wolf', 4, 0, false, true, mu); o.mut.push({ mu, n: mu ? PET_MUT[mu].n : _t('Normal'), u: U.url, W: U.W, H: U.H }); }
      for (const sp of ['eule', 'baer', 'eulenbaer']) { const U = petImgURL(sp, 4, 0, false, true, sp === 'eulenbaer' ? 'sternen' : ''); o['br_' + sp] = { u: U.url, W: U.W, H: U.H, n: PET_SP[sp].n }; }
      return o;
    });
    for (const p of A.pets) { R.saveData(`p_art/pet_${p.sp}.png`, p.u); delete p.u; }
    for (const m of A.mut) { R.saveData(`p_art/mut_${m.mu || 'normal'}.png`, m.u); delete m.u; }
    for (const k of ['br_eule', 'br_baer', 'br_eulenbaer']) { R.saveData(`p_art/${k}.png`, A[k].u); delete A[k].u; }
    info('p_art', A); console.log('Kreaturen', A.pets.length, 'Hybride', A.pets.filter(p => p.hy).length);
  }
  // Zucht im Brutnest: Eule × Bärenjunges – Vorschau mit Chancen (Mischform Eulenbär), dann paaren
  if (R.want('p_breed')) {
    fresh('p_breed');
    await ev(() => {
      __ui(); __hero(0, true); const M = SAVE.meta.pets; M.eggs = []; P.gold = 1e6; for (const k of MATORDER) P.mats[k] = 200;
      const a = petGive('eule', { lv: 40, gn: [80, 60, 40, 70, 95] }), b = petGive('baer', { lv: 40, gn: [60, 40, 60, 30, 80] }); petGive('drache', { lv: 60, mu: 'kristall' }); petGive('wolf', { lv: 30 });
      M.act = a.id; M.seen = PET_ORDER.slice(0, 40); M.mut = ['kristall']; window.__br = [a.id, b.id];
      enterHideout(); PET_BR.a = PET_BR.b = null; openNest('hide');
      document.querySelector(`.nestscr [data-act="petbrsel"][data-id="${a.id}"]`).click(); document.querySelector(`.nestscr [data-act="petbrsel"][data-id="${b.id}"]`).click();
      const el = panel.querySelector('.nestscr .pbr'); panel.scrollTop = el ? el.offsetTop - 30 : 0;
    });
    await still('p_breed', 'sel'); await rect('p_breed', 'pbr', '#panel .nestscr .pbr'); await rect('p_breed', 'go', '#panel [data-act="petbrgo"]');
    info('p_breed', await ev(() => ({ txt: (panel.querySelector('.nestscr .pbr') || {}).textContent })));
    await still('p_breed', 'done', () => { window.__msg = []; document.querySelector('#panel [data-act="petbrgo"]').click(); panel.scrollTop = 0; });
    await rect('p_breed', 'eggs', '#panel .nestscr .ncard', 0); await rect('p_breed', 'nsum', '#panel .nsum');
    fs.writeFileSync(`${R.out}p_breed/msgs.json`, JSON.stringify({ msg: await ev(() => window.__msg), log: [] }));
  }
  // Begleiter-Reiter: Gene, Ausrüstung, Talente, Magie
  if (R.want('p_tab')) {
    fresh('p_tab');
    await ev(() => {
      __ui(); __hero(0); const M = SAVE.meta.pets, w = M.list[0]; P.gold = 1e6; for (const k of MATORDER) P.mats[k] = 200;
      w.eq = { h: petGearNew('h', 4, 80, mulberry(3)), p: petGearNew('p', 3, 80, mulberry(4)), t: petGearNew('t', 4, 80, mulberry(5)) };
      w.tl = petTlFix('553103300000000', 80); M.mut = ['sternen', 'kristall']; M.runes = { feuerball: 1, heilung: 2 }; computeStats();
      setState('title'); petSub = 'ov'; openChar('pet', 'title'); panel.scrollTop = 0;
    });
    for (const s of ['ov', 'gen', 'eq', 'tal', 'mag']) {
      await still('p_tab', s, s => { ON.petsub(s); const el = panel.querySelector('.psub'); panel.scrollTop = el ? el.offsetTop - 8 : 0; }, s);
      await rect('p_tab', s + '_psub', '#panel .psub'); await rect('p_tab', s + '_panel', '#panel');
    }
  }
  // Der Begleiter zaubert im Kampf (Meteor, Blitz, Schild) – in den Landen, Kristallfelder
  if (R.want('p_fight')) {
    await ev(() => {
      __lgo({ seed: 15, tools: 2047 }); const S = __bio.kristall, p0 = __wp(S.sx + 1, S.sy + 1), p = lFreeNear(p0.x, p0.y, 200) || p0; __tp(p.x, p.y); __quiet(1500);
      window.__txtOK = /METEOR|BLITZ|SCHILD/; window.__txtNo = /^\d+$|SCHWÄCHE|MONSTER|PANZER/; __vp(3.2); __snap(); for (let i = 0; i < 5; i++) __lkeep(6); __step(6);
      if (!window.__pc) { window.__pc = petCast; window.petCast = function (p, k) { const r = window.__pc(p, k); if (r) window.__msg.push({ f: window.__fi, k: 'c', t: k }); return r; }; }
    });
    // 20 s echte Zeit mit echten Abklingzeiten – der Schnitt nimmt die Stellen, an denen ein Zauber kommt
    await cap('p_fight', 600, `i => { __calm(); __quiet(900); __lkeep(7, i % 30 > 6); keys.KeyD = keys.KeyA = false; window.__log.push([PET_RT.casts || 0]); }`);
    await ev(() => { window.__txtOK = null; window.__txtNo = null; __off2(); });
  }

  /* ================= 5 Mods ================= */
  // Werkbank: Mod-Plätze, Glyphe einsetzen, Essenz → Resonanz entdeckt, Resonanz-Buch
  if (R.want('m_wb')) {
    fresh('m_wb');
    await ev(() => {
      __ui(); __hero(0, true); P.gold = 99999; for (const k of MATORDER) P.mats[k] = 200;
      P.mods = { 'glyphe_kette:6': 2, 'essenz_blitz:5': 1, 'rune_kraft:5': 4, 'rune_eile:5': 1, 'kern_salve:3': 1, 'praeg_gold:2': 1, 'glyphe_meteor:6': 1, 'praeg_stern:4': 3, 'glyphe_frost:3': 1, 'kern_wucht:4': 1 };
      SAVE.meta.mods.found = 12; SAVE.meta.mods.book = {};
      const w = P.gear.weapon; w.mods = []; delete w.el0; computeStats(); enterHideout(); selItem = w.uid; wbTab = 'ver'; WB.act = 'mods'; WB.mod = null; openWorkbench('smith');
      const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; window.__msg = [];
    });
    const scrollMods = () => { const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; };
    await still('m_wb', 'w0', scrollMods); await rect('m_wb', 'pick0', '#panel [data-act="mod_pick"][data-id="glyphe_kette:6"]'); await rect('m_wb', 'act0', '#panel .wbact.open'); await rect('m_wb', 'slots0', '#panel .wbact.open .mslots'); await rect('m_wb', 'item0', '#panel .wbsel, #panel .detail');
    await still('m_wb', 'w1', () => { document.querySelector('#panel [data-act="mod_pick"][data-id="glyphe_kette:6"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_wb', 'act1', '#panel .wbact.open'); await rect('m_wb', 'in1', '#panel [data-act="mod_in"]'); await rect('m_wb', 'cmp1', '#panel .wbact.open .wbcmp');
    await still('m_wb', 'w2', () => { document.querySelector('#panel [data-act="mod_in"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_wb', 'slots2', '#panel .wbact.open .mslots'); await rect('m_wb', 'pick2', '#panel [data-act="mod_pick"][data-id="essenz_blitz:5"]');
    await still('m_wb', 'w3', () => { document.querySelector('#panel [data-act="mod_pick"][data-id="essenz_blitz:5"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_wb', 'act3', '#panel .wbact.open'); await rect('m_wb', 'resn', '#panel .mresn'); await rect('m_wb', 'in3', '#panel [data-act="mod_in"]');
    await still('m_wb', 'w4', () => { document.querySelector('#panel [data-act="mod_in"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_wb', 'act4', '#panel .wbact.open'); await rect('m_wb', 'slots4', '#panel .wbact.open .mslots');
    info('m_wb', await ev(() => ({ msg: window.__msg, res: Object.keys(SAVE.meta.mods.book), resn: (panel.querySelector('.mres, .mresn') || {}).textContent, el: P.gear.weapon.el })));
    await still('m_wb', 'book', () => { document.querySelector('#panel [data-act="mod_book"]').click(); panel.scrollTop = 0; });
    await rect('m_wb', 'bookhead', '#panel .head'); await rect('m_wb', 'res0', '#panel .mres:not(.unk)');
  }
  // Glyphen im Kampf: Kettenblitz und Meteor (Stufe 10) – Sternenfeld bei Nacht
  if (R.want('m_fight')) {
    await ev(() => {
      __lgo({ seed: 16, tools: 2047, noPet: true }); const w = P.gear.weapon; w.mods = []; delete w.el0;
      for (const k of ['glyphe_kette:10', 'glyphe_meteor:10', 'essenz_blitz:8', 'glyphe_explosion:8']) modPut(w, k); computeStats();
      const S = __bio.riff, p0 = __wp(S.sx + 1, S.sy + .8), p = lFreeNear(p0.x, p0.y, 200) || p0; __tp(p.x, p.y); __quiet(1500);
      MODS.fired = {}; window.__txtNo = /^\d+$|SCHWÄCHE|MONSTER|PANZER/; __vp(3.2); __snap(); for (let i = 0; i < 6; i++) __lkeep(8); __step(6);
    });
    await cap('m_fight', 300, `i => { __calm(); __quiet(900); __lkeep(9); for (const e of enemies) if (!e.dead && !e.boss) e.hp = Math.min(e.hp, e.maxHp * .55); window.__log.push(Object.assign({}, MODS.fired)); }`);
    await ev(() => { window.__txtNo = null; __off2(); });
  }
  // Werkbank: Umschmieden, Veredeln, Extrahieren – vorher/nachher
  if (R.want('m_forge')) {
    fresh('m_forge');
    await ev(() => {
      __ui(); __hero(0, true); P.gold = 999999; for (const k of MATORDER) P.mats[k] = 400; P.mats.aether = 50; P.mats.stern = 50;
      const w = P.gear.weapon; w.mods = ['glyphe_kette:6']; computeStats(); enterHideout(); selItem = w.uid; wbTab = 'ver'; WB.act = 'reroll'; WB.mod = null; openWorkbench('smith');
      const r = panel.querySelectorAll('#panel .afrow')[1]; if (r) r.click();
      const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; window.__msg = [];
    });
    const sc = () => { const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; };
    await still('m_forge', 'rr0', sc); await rect('m_forge', 'rr0', '#panel .wbact.open'); await rect('m_forge', 'rrsel0', '#panel .afrow.sel, #panel .afrow[aria-selected="true"]');
    const a0 = await ev(() => { const x = mSel(); return { k: x.S.aff, s: affPool(x.it)[x.S.aff].s(x.it.aff[x.S.aff]) }; });
    await still('m_forge', 'rr1', () => { document.querySelector('#panel [data-act="af_rr"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_forge', 'rr1', '#panel .wbact.open');
    const a1 = await ev(() => { const x = mSel(); return { k: x.S.aff, s: affPool(x.it)[x.S.aff].s(x.it.aff[x.S.aff]) }; });
    await still('m_forge', 'vd0', () => { document.querySelector('#panel [data-act="wb_act"][data-id="refine"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_forge', 'vd0', '#panel .wbact.open');
    const v0 = await ev(() => { const x = mSel(); return { k: x.S.aff, s: affPool(x.it)[x.S.aff].s(x.it.aff[x.S.aff]), st: affStufe(x.it, x.S.aff) }; });
    await still('m_forge', 'vd1', () => { document.querySelector('#panel [data-act="af_ref"]').click(); const el = panel.querySelector('.wbact.open'); panel.scrollTop = el ? el.offsetTop - 140 : 0; });
    await rect('m_forge', 'vd1', '#panel .wbact.open');
    const v1 = await ev(() => { const x = mSel(); return { k: x.S.aff, s: affPool(x.it)[x.S.aff].s(x.it.aff[x.S.aff]), st: affStufe(x.it, x.S.aff) }; });
    // Extrahieren: ein Gegenstand aus dem Beutel wird zur Affix-Essenz
    await ev(() => {
      const it = makeItem({ slot: 'weapon', base: 'sword', form: 'lang', tier: 5, rar: 6, myth: 'klinge' }); P.bag = [it]; selItem = it.uid; WB.act = 'extract'; WB.mod = null; openWorkbench('smith');
      const r = panel.querySelectorAll('#panel .afrow')[0]; if (r) r.click(); document.querySelector('#panel [data-act="af_ex"]').click();
    });
    await still('m_forge', 'ex0', sc); await rect('m_forge', 'ex0', '#panel .wbact.open');
    await still('m_forge', 'ex1', () => { document.querySelector('#panel [data-act="af_ex"]').click(); panel.scrollTop = 0; });
    info('m_forge', { a0, a1, v0, v1, msg: await ev(() => window.__msg) });
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
